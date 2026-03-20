using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Models.Common;
using Monolith.Models.Opportunities;
using Monolith.Services.Common;
using Monolith.Entities;
using Monolith.Contexts;

namespace Monolith.Controllers;

[ApiController]
[Route("opportunities")]
[Produces("application/json")]
public class OpportunitiesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список возможностей с фильтрацией и пагинацией.
    /// </summary>
    /// <param name="query">Параметры фильтрации и пагинации.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Пагинированный список карточек возможностей.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<OpportunityListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<OpportunityListItemDto>>> GetList([FromQuery] OpportunityListQuery query, CancellationToken cancellationToken)
    {
        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);

        var baseQuery = BuildFilteredQuery(query);

        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var opportunities = await baseQuery
            .OrderByDescending(x => x.PublishAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                Opportunity = x,
                CompanyName = x.Company.BrandName ?? x.Company.LegalName,
                CityName = x.City != null ? x.City.CityName : (x.Location != null ? x.Location.City.CityName : "Unknown"),
                Latitude = x.City != null ? x.City.Latitude : (x.Location != null ? x.Location.City.Latitude : null),
                Longitude = x.City != null ? x.City.Longitude : (x.Location != null ? x.Location.City.Longitude : null),
                Tags = x.OpportunityTags.Select(t => t.Tag.Name).ToArray()
            })
            .ToListAsync(cancellationToken);

        var items = opportunities.Select(x => new OpportunityListItemDto(
            x.Opportunity.Id,
            x.Opportunity.Title,
            x.Opportunity.OppType,
            x.Opportunity.Format,
            x.CompanyName,
            x.CityName,
            x.Opportunity.SalaryFrom,
            x.Opportunity.SalaryTo,
            x.Opportunity.CurrencyCode,
            x.Opportunity.PublishAt,
            x.Opportunity.Company.Status == CompanyStatus.Verified,
            x.Tags
        )).ToList();

        return Ok(new PagedResponse<OpportunityListItemDto>(items, totalCount, page, pageSize));
    }

    /// <summary>
    /// Возвращает детальную информацию о возможности.
    /// </summary>
    /// <param name="id">Идентификатор возможности.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Детальная карточка возможности.</returns>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(OpportunityDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OpportunityDetailDto>> GetDetail(long id, CancellationToken cancellationToken)
    {
        var opportunity = await dbContext.Opportunities
            .Include(x => x.Company)
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.OpportunityTags)
                .ThenInclude(x => x.Tag)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (opportunity is null)
        {
            return this.ToNotFoundError("opportunities.not_found", "Вакансия или возможность не найдена.");
        }

        var city = opportunity.City ?? opportunity.Location?.City;
        var locationDto = city is null
            ? null
            : new LocationDto(
                city.Id,
                city.CityName,
                city.Latitude,
                city.Longitude,
                opportunity.Location?.StreetName,
                opportunity.Location?.HouseNumber
            );

        var dto = new OpportunityDetailDto(
            opportunity.Id,
            opportunity.Title,
            opportunity.ShortDescription,
            opportunity.FullDescription,
            opportunity.OppType,
            opportunity.Format,
            opportunity.Status,
            opportunity.PublishAt,
            opportunity.ApplicationDeadline,
            opportunity.SalaryFrom,
            opportunity.SalaryTo,
            opportunity.CurrencyCode,
            new CompanyShortDto(
                opportunity.CompanyId,
                opportunity.Company.BrandName ?? opportunity.Company.LegalName,
                opportunity.Company.Status == CompanyStatus.Verified,
                opportunity.Company.WebsiteUrl,
                opportunity.Company.PublicEmail),
            locationDto,
            opportunity.OpportunityTags.Select(x => x.Tag.Name).ToArray());

        return Ok(dto);
    }

    private IQueryable<Opportunity> BuildFilteredQuery(OpportunityListQuery query)
    {
        var opportunities = dbContext.Opportunities
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.OpportunityTags)
                .ThenInclude(x => x.Tag)
            .Where(x => x.Status == OpportunityStatus.Published);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            opportunities = opportunities.Where(x =>
                x.Title.ToLower().Contains(search) ||
                x.ShortDescription.ToLower().Contains(search) ||
                (x.Company.BrandName != null && x.Company.BrandName.ToLower().Contains(search)) ||
                x.Company.LegalName.ToLower().Contains(search));
        }

        if (query.CityId is not null)
        {
            opportunities = opportunities.Where(x => x.CityId == query.CityId || (x.Location != null && x.Location.CityId == query.CityId));
        }

        if (query.CompanyId is not null)
        {
            opportunities = opportunities.Where(x => x.CompanyId == query.CompanyId);
        }

        if (query.Types is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.Types.Contains(x.OppType));
        }

        if (query.EventKinds is { Length: > 0 })
        {
            var eventKindSlugs = query.EventKinds
                .Distinct()
                .Select(x => x.ToTagSlug())
                .ToArray();

            opportunities = opportunities.Where(x =>
                x.OppType == OpportunityType.CareerEvent &&
                x.OpportunityTags.Any(t =>
                    t.Tag.Group.Code == "event_kind" &&
                    eventKindSlugs.Contains(t.Tag.Slug)));
        }

        if (query.Formats is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.Formats.Contains(x.Format));
        }

        if (query.TagIds is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => x.OpportunityTags.Any(t => query.TagIds.Contains(t.TagId)));
        }

        if (query.SalaryFrom is not null)
        {
            opportunities = opportunities.Where(x => x.SalaryTo == null || x.SalaryTo >= query.SalaryFrom);
        }

        if (query.SalaryTo is not null)
        {
            opportunities = opportunities.Where(x => x.SalaryFrom == null || x.SalaryFrom <= query.SalaryTo);
        }

        if (query.VerifiedOnly == true)
        {
            opportunities = opportunities.Where(x => x.Company.Status == CompanyStatus.Verified);
        }

        return opportunities;
    }
}
