using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Admin;
using Monolith.Models.Common;
using Monolith.Services.Common;

namespace Monolith.Controllers;

/// <summary>
/// Административные операции над вакансиями/возможностями.
/// Доступ только для роли curator.
/// </summary>
[ApiController]
[Authorize(Roles = "curator")]
[Route("admin/opportunities")]
[Produces("application/json")]
public class AdminOpportunitiesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список вакансий с пагинацией и поиском.
    /// </summary>
    /// <param name="page">Номер страницы (начиная с 1).</param>
    /// <param name="pageSize">Размер страницы (максимум 100).</param>
    /// <param name="search">Поиск по title и shortDescription.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Пагинированный список вакансий.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminOpportunityListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResponse<AdminOpportunityListItemDto>>> GetList(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = page <= 0 ? 1 : page;
        var safePageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);
        var query = dbContext.Opportunities.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x => x.Title.ToLower().Contains(term) || x.ShortDescription.ToLower().Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new AdminOpportunityListItemDto(x.Id, x.CompanyId, x.Title, x.Status, x.OppType, x.Format, x.PublishAt))
            .ToListAsync(cancellationToken);
        return Ok(new PagedResponse<AdminOpportunityListItemDto>(rows, total, safePage, safePageSize));
    }

    /// <summary>
    /// Создает вакансию в административном контуре.
    /// </summary>
    /// <param name="request">Полный набор полей вакансии.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Созданная вакансия.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(AdminOpportunityListItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminOpportunityListItemDto>> Create(AdminOpportunityUpsertRequest request, CancellationToken cancellationToken)
    {
        var opportunity = new Opportunity();
        Apply(opportunity, request);
        dbContext.Opportunities.Add(opportunity);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminOpportunityListItemDto(opportunity.Id, opportunity.CompanyId, opportunity.Title, opportunity.Status, opportunity.OppType, opportunity.Format, opportunity.PublishAt);
        return CreatedAtAction(nameof(GetList), new { id = opportunity.Id }, dto);
    }

    /// <summary>
    /// Обновляет вакансию.
    /// </summary>
    /// <param name="id">Идентификатор вакансии.</param>
    /// <param name="request">Новые значения полей вакансии.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Обновленная вакансия.</returns>
    [HttpPut("{id:long}")]
    [ProducesResponseType(typeof(AdminOpportunityListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminOpportunityListItemDto>> Update(long id, AdminOpportunityUpsertRequest request, CancellationToken cancellationToken)
    {
        var opportunity = await dbContext.Opportunities.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (opportunity is null)
        {
            return this.ToNotFoundError("admin.opportunities.not_found", "Вакансия не найдена.");
        }

        Apply(opportunity, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminOpportunityListItemDto(opportunity.Id, opportunity.CompanyId, opportunity.Title, opportunity.Status, opportunity.OppType, opportunity.Format, opportunity.PublishAt);
        return Ok(dto);
    }

    /// <summary>
    /// Удаляет вакансию.
    /// </summary>
    /// <remarks>
    /// Удаление физическое (hard delete), включая зависимые записи по каскадным FK.
    /// </remarks>
    /// <param name="id">Идентификатор вакансии.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var opportunity = await dbContext.Opportunities.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (opportunity is null)
        {
            return this.ToNotFoundError("admin.opportunities.not_found", "Вакансия не найдена.");
        }

        dbContext.Opportunities.Remove(opportunity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void Apply(Opportunity opportunity, AdminOpportunityUpsertRequest request)
    {
        opportunity.CompanyId = request.CompanyId;
        opportunity.CreatedByUserId = request.CreatedByUserId;
        opportunity.Title = request.Title.Trim();
        opportunity.ShortDescription = request.ShortDescription.Trim();
        opportunity.FullDescription = request.FullDescription.Trim();
        opportunity.OppType = request.OppType;
        opportunity.Format = request.Format;
        opportunity.Status = request.Status;
        opportunity.CityId = request.CityId;
        opportunity.LocationId = request.LocationId;
        opportunity.SalaryFrom = request.SalaryFrom;
        opportunity.SalaryTo = request.SalaryTo;
        opportunity.CurrencyCode = request.CurrencyCode;
        opportunity.PublishAt = request.PublishAt;
        opportunity.ApplicationDeadline = request.ApplicationDeadline;
    }
}
