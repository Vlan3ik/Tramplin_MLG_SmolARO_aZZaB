using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Models.Common;
using Monolith.Models.Companies;
using Monolith.Models.Opportunities;
using Monolith.Services.Common;
using Monolith.Entities;
using Monolith.Contexts;

namespace Monolith.Controllers;

[ApiController]
[Route("companies")]
[Produces("application/json")]
public class CompaniesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список компаний с фильтрацией и пагинацией.
    /// </summary>
    /// <param name="query">Параметры фильтрации и пагинации.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
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
            companies = companies.Where(x => x.Industry.ToLower().Contains(industry));
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
                x.Industry,
                x.Status == CompanyStatus.Verified,
                x.BaseCity.CityName,
                x.LogoUrl,
                x.WebsiteUrl,
                x.PublicEmail,
                x.Opportunities.Count(o => o.Status == OpportunityStatus.Published)))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<CompanyListItemDto>(rows, totalCount, page, pageSize));
    }

    /// <summary>
    /// Возвращает детальную карточку компании по идентификатору.
    /// </summary>
    /// <param name="id">Идентификатор компании.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Детальные данные компании и список активных возможностей.</returns>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(CompanyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CompanyDetailDto>> GetById(long id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies
            .AsNoTracking()
            .Include(x => x.BaseCity)
            .Include(x => x.Links)
            .Include(x => x.Opportunities)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (company is null)
        {
            return this.ToNotFoundError("companies.not_found", "Компания не найдена.");
        }

        var dto = new CompanyDetailDto(
            company.Id,
            company.LegalName,
            company.BrandName,
            company.Industry,
            company.Description,
            company.Status == CompanyStatus.Verified,
            company.BaseCity.CityName,
            company.LogoUrl,
            company.WebsiteUrl,
            company.PublicEmail,
            company.PublicPhone,
            company.Links.Select(x => new CompanyLinkDto(x.LinkKind.ToString().ToLowerInvariant(), x.Url, x.Label)).ToArray(),
            company.Opportunities
                .Where(x => x.Status == OpportunityStatus.Published)
                .OrderByDescending(x => x.PublishAt)
                .Take(30)
                .Select(x => new CompanyOpportunityDto(
                    x.Id,
                    x.Title,
                    x.OppType.ToString().ToLowerInvariant(),
                    x.Format.ToString().ToLowerInvariant(),
                    x.PublishAt))
                .ToArray()
        );

        return Ok(dto);
    }
}
