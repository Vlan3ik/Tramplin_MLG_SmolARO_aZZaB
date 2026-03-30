using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Companies;
using Monolith.Models.Media;
using Monolith.Models.Opportunities;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Route("companies")]
[Produces("application/json")]
public class CompaniesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список компаний с фильтрами и пагинацией.
    /// </summary>
    /// <param name="query">Параметры фильтрации и пагинации списка компаний.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Пагинированный список компаний.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<CompanyListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<CompanyListItemDto>>> GetList([FromQuery] CompanyListQuery query, CancellationToken cancellationToken)
    {
        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);

        var companies = dbContext.Companies
            .AsNoTracking()
            .Include(x => x.BaseCity)
            .Include(x => x.VerificationProfile)
                .ThenInclude(x => x!.MainIndustry)
            .Include(x => x.Vacancies)
            .Include(x => x.Opportunities)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            companies = companies.Where(x =>
                x.LegalName.ToLower().Contains(search) ||
                (x.BrandName != null && x.BrandName.ToLower().Contains(search)) ||
                x.Description.ToLower().Contains(search));
        }

        if (query.CityId is not null)
        {
            companies = companies.Where(x => x.BaseCityId == query.CityId);
        }

        if (!string.IsNullOrWhiteSpace(query.Industry))
        {
            var industry = query.Industry.Trim().ToLowerInvariant();
            companies = companies.Where(x => x.VerificationProfile != null && x.VerificationProfile.MainIndustry.Name.ToLower().Contains(industry));
        }

        if (query.VerifiedOnly == true)
        {
            companies = companies.Where(x => x.Status == CompanyStatus.Verified);
        }

        var totalCount = await companies.CountAsync(cancellationToken);
        var rows = await companies
            .OrderBy(x => x.BrandName ?? x.LegalName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new CompanyListItemDto(
                x.Id,
                x.BrandName ?? x.LegalName,
                x.VerificationProfile != null ? x.VerificationProfile.MainIndustry.Name : null,
                x.Status == CompanyStatus.Verified,
                x.BaseCity.CityName,
                x.LogoUrl,
                x.WebsiteUrl,
                x.PublicEmail,
                x.Vacancies.Count(v => v.Status == OpportunityStatus.Active) + x.Opportunities.Count(o => o.Status == OpportunityStatus.Active)))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<CompanyListItemDto>(rows, totalCount, page, pageSize));
    }

    /// <summary>
    /// Возвращает детальную карточку компании по идентификатору.
    /// </summary>
    /// <param name="id">Идентификатор компании.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Детальная карточка компании со ссылками и активными публикациями.</returns>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(CompanyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CompanyDetailDto>> GetById(long id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies
            .AsNoTracking()
            .Include(x => x.BaseCity)
            .Include(x => x.Links)
            .Include(x => x.Media)
            .Include(x => x.VerificationProfile)
                .ThenInclude(x => x!.MainIndustry)
            .Include(x => x.Vacancies)
            .Include(x => x.Opportunities)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (company is null)
        {
            return this.ToNotFoundError("companies.not_found", "Company not found.");
        }

        var activeVacancies = company.Vacancies
            .Where(x => x.Status == OpportunityStatus.Active)
            .Select(x => new CompanyOpportunityDto(
                x.Id,
                "vacancy",
                x.Title,
                x.Kind.ToString().ToLowerInvariant(),
                x.Format.ToString().ToLowerInvariant(),
                x.PublishAt));

        var activeOpportunities = company.Opportunities
            .Where(x => x.Status == OpportunityStatus.Active)
            .Select(x => new CompanyOpportunityDto(
                x.Id,
                "opportunity",
                x.Title,
                x.Kind.ToString().ToLowerInvariant(),
                x.Format.ToString().ToLowerInvariant(),
                x.PublishAt));

        var dto = new CompanyDetailDto(
            company.Id,
            company.LegalName,
            company.BrandName,
            company.VerificationProfile?.MainIndustry.Name,
            company.Description,
            company.Status == CompanyStatus.Verified,
            company.BaseCity.CityName,
            company.LogoUrl,
            company.WebsiteUrl,
            company.PublicEmail,
            company.PublicPhone,
            company.Media
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.Id)
                .Select(x => new CompanyMediaItemDto(
                    x.Id,
                    x.MediaType == CompanyMediaType.Video ? "video" : "image",
                    x.Url,
                    x.MimeType,
                    x.SortOrder))
                .ToArray(),
            company.Links.Select(x => new CompanyLinkDto(x.LinkKind.ToString().ToLowerInvariant(), x.Url, x.Label)).ToArray(),
            activeVacancies
                .Concat(activeOpportunities)
                .OrderByDescending(x => x.PublishAt)
                .Take(30)
                .ToArray());

        return Ok(dto);
    }
}
