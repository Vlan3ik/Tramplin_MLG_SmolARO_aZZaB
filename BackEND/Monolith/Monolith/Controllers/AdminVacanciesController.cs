using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Admin;
using Monolith.Models.Common;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "curator")]
[Route("admin/vacancies")]
[Produces("application/json")]
public class AdminVacanciesController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminVacancyListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<AdminVacancyListItemDto>>> GetList(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = page <= 0 ? 1 : page;
        var safePageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);
        var query = dbContext.Vacancies.AsNoTracking().AsQueryable();
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
            .Select(x => new AdminVacancyListItemDto(x.Id, x.CompanyId, x.Title, x.Status, x.Kind, x.Format, x.PublishAt))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<AdminVacancyListItemDto>(rows, total, safePage, safePageSize));
    }

    [HttpPost]
    [ProducesResponseType(typeof(AdminVacancyListItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AdminVacancyListItemDto>> Create(AdminVacancyUpsertRequest request, CancellationToken cancellationToken)
    {
        if (request.SalaryFrom is not null && request.SalaryTo is not null && request.SalaryTo < request.SalaryFrom)
        {
            return this.ToBadRequestError("admin.vacancies.invalid_salary_range", "salaryTo must be >= salaryFrom.");
        }

        var vacancy = new Vacancy();
        Apply(vacancy, request);
        dbContext.Vacancies.Add(vacancy);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminVacancyListItemDto(vacancy.Id, vacancy.CompanyId, vacancy.Title, vacancy.Status, vacancy.Kind, vacancy.Format, vacancy.PublishAt);
        return CreatedAtAction(nameof(GetList), new { id = vacancy.Id }, dto);
    }

    [HttpPut("{id:long}")]
    [ProducesResponseType(typeof(AdminVacancyListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AdminVacancyListItemDto>> Update(long id, AdminVacancyUpsertRequest request, CancellationToken cancellationToken)
    {
        if (request.SalaryFrom is not null && request.SalaryTo is not null && request.SalaryTo < request.SalaryFrom)
        {
            return this.ToBadRequestError("admin.vacancies.invalid_salary_range", "salaryTo must be >= salaryFrom.");
        }

        var vacancy = await dbContext.Vacancies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("admin.vacancies.not_found", "Vacancy not found.");
        }

        Apply(vacancy, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminVacancyListItemDto(vacancy.Id, vacancy.CompanyId, vacancy.Title, vacancy.Status, vacancy.Kind, vacancy.Format, vacancy.PublishAt);
        return Ok(dto);
    }

    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var vacancy = await dbContext.Vacancies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("admin.vacancies.not_found", "Vacancy not found.");
        }

        dbContext.Vacancies.Remove(vacancy);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void Apply(Vacancy vacancy, AdminVacancyUpsertRequest request)
    {
        vacancy.CompanyId = request.CompanyId;
        vacancy.CreatedByUserId = request.CreatedByUserId;
        vacancy.Title = request.Title.Trim();
        vacancy.ShortDescription = request.ShortDescription.Trim();
        vacancy.FullDescription = request.FullDescription.Trim();
        vacancy.Kind = request.Kind;
        vacancy.Format = request.Format;
        vacancy.Status = request.Status;
        vacancy.CityId = request.CityId;
        vacancy.LocationId = request.LocationId;
        vacancy.SalaryFrom = request.SalaryFrom;
        vacancy.SalaryTo = request.SalaryTo;
        vacancy.CurrencyCode = request.CurrencyCode?.Trim().ToUpperInvariant();
        vacancy.SalaryTaxMode = request.SalaryTaxMode;
        vacancy.PublishAt = request.PublishAt;
        vacancy.ApplicationDeadline = request.ApplicationDeadline;
    }
}
