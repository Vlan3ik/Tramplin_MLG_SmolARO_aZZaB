using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Opportunities;
using Monolith.Models.Vacancies;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Route("vacancies")]
[Produces("application/json")]
public class VacanciesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список активных вакансий с фильтрами и пагинацией.
    /// </summary>
    /// <param name="query">Параметры фильтрации и пагинации вакансий.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Пагинированный список вакансий.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<VacancyListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<VacancyListItemDto>>> GetList([FromQuery] VacancyListQuery query, CancellationToken cancellationToken)
    {
        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);

        var baseQuery = BuildFilteredQuery(query);
        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var rows = await baseQuery
            .OrderByDescending(x => x.PublishAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.Title,
                x.Kind,
                x.Format,
                CompanyName = x.Company.BrandName ?? x.Company.LegalName,
                CityName = x.City != null ? x.City.CityName : (x.Location != null ? x.Location.City.CityName : "Unknown"),
                x.SalaryFrom,
                x.SalaryTo,
                x.CurrencyCode,
                x.SalaryTaxMode,
                x.PublishAt,
                Verified = x.Company.Status == CompanyStatus.Verified,
                Tags = x.VacancyTags.Select(t => t.Tag.Name).ToArray()
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(x => new VacancyListItemDto(
            x.Id,
            x.Title,
            x.Kind,
            x.Format,
            x.CompanyName,
            x.CityName,
            x.SalaryFrom,
            x.SalaryTo,
            x.CurrencyCode,
            x.SalaryTaxMode,
            x.PublishAt,
            x.Verified,
            x.Tags)).ToList();

        return Ok(new PagedResponse<VacancyListItemDto>(items, totalCount, page, pageSize));
    }

    /// <summary>
    /// Возвращает детальную карточку вакансии.
    /// </summary>
    /// <param name="id">Идентификатор вакансии.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Детальная карточка вакансии.</returns>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(VacancyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VacancyDetailDto>> GetDetail(long id, CancellationToken cancellationToken)
    {
        var vacancy = await dbContext.Vacancies
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.VacancyTags)
                .ThenInclude(x => x.Tag)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (vacancy is null)
        {
            return this.ToNotFoundError("vacancies.not_found", "Vacancy not found.");
        }

        var city = vacancy.City ?? vacancy.Location?.City;
        var locationLatitude = vacancy.Location is not null ? (decimal?)vacancy.Location.GeoPoint.Y : city?.Latitude;
        var locationLongitude = vacancy.Location is not null ? (decimal?)vacancy.Location.GeoPoint.X : city?.Longitude;
        var locationDto = city is null
            ? null
            : new LocationDto(
                city.Id,
                city.CityName,
                locationLatitude,
                locationLongitude,
                vacancy.Location?.StreetName,
                vacancy.Location?.HouseNumber);

        var dto = new VacancyDetailDto(
            vacancy.Id,
            vacancy.Title,
            vacancy.ShortDescription,
            vacancy.FullDescription,
            vacancy.Kind,
            vacancy.Format,
            vacancy.Status,
            vacancy.PublishAt,
            vacancy.ApplicationDeadline,
            vacancy.SalaryFrom,
            vacancy.SalaryTo,
            vacancy.CurrencyCode,
            vacancy.SalaryTaxMode,
            new CompanyShortDto(
                vacancy.CompanyId,
                vacancy.Company.BrandName ?? vacancy.Company.LegalName,
                vacancy.Company.Status == CompanyStatus.Verified,
                vacancy.Company.WebsiteUrl,
                vacancy.Company.PublicEmail),
            locationDto,
            vacancy.VacancyTags.Select(t => t.Tag.Name).ToArray());

        return Ok(dto);
    }

    private IQueryable<Vacancy> BuildFilteredQuery(VacancyListQuery query)
    {
        var vacancies = dbContext.Vacancies
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.VacancyTags)
                .ThenInclude(x => x.Tag)
            .Where(x => x.Status == OpportunityStatus.Active);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            vacancies = vacancies.Where(x =>
                x.Title.ToLower().Contains(search) ||
                x.ShortDescription.ToLower().Contains(search) ||
                (x.Company.BrandName != null && x.Company.BrandName.ToLower().Contains(search)) ||
                x.Company.LegalName.ToLower().Contains(search));
        }

        if (query.CityId is not null)
        {
            vacancies = vacancies.Where(x => x.CityId == query.CityId || (x.Location != null && x.Location.CityId == query.CityId));
        }

        if (query.CompanyId is not null)
        {
            vacancies = vacancies.Where(x => x.CompanyId == query.CompanyId);
        }

        if (query.Kinds is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.Kinds.Contains(x.Kind));
        }

        if (query.Formats is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.Formats.Contains(x.Format));
        }

        if (query.TagIds is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => x.VacancyTags.Any(t => query.TagIds.Contains(t.TagId)));
        }

        if (query.SalaryFrom is not null)
        {
            vacancies = vacancies.Where(x => x.SalaryTo == null || x.SalaryTo >= query.SalaryFrom);
        }

        if (query.SalaryTo is not null)
        {
            vacancies = vacancies.Where(x => x.SalaryFrom == null || x.SalaryFrom <= query.SalaryTo);
        }

        if (query.SalaryTaxModes is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.SalaryTaxModes.Contains(x.SalaryTaxMode));
        }

        if (query.VerifiedOnly == true)
        {
            vacancies = vacancies.Where(x => x.Company.Status == CompanyStatus.Verified);
        }

        return vacancies;
    }
}
