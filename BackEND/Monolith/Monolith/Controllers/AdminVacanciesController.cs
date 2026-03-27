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
[Authorize(Roles = "curator,admin")]
[Route("admin/vacancies")]
[Produces("application/json")]
public class AdminVacanciesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Р’РѕР·РІСЂР°С‰Р°РµС‚ СЃРїРёСЃРѕРє РІР°РєР°РЅСЃРёР№ РґР»СЏ РјРѕРґРµСЂР°С†РёРё СЃ РїР°РіРёРЅР°С†РёРµР№ Рё РїРѕРёСЃРєРѕРј.
    /// </summary>
    /// <param name="page">РќРѕРјРµСЂ СЃС‚СЂР°РЅРёС†С‹ (РЅР°С‡РёРЅР°СЏ СЃ 1).</param>
    /// <param name="pageSize">Р Р°Р·РјРµСЂ СЃС‚СЂР°РЅРёС†С‹ (РјР°РєСЃРёРјСѓРј 100).</param>
    /// <param name="search">РџРѕРёСЃРєРѕРІР°СЏ СЃС‚СЂРѕРєР° РїРѕ Р·Р°РіРѕР»РѕРІРєСѓ Рё РєСЂР°С‚РєРѕРјСѓ РѕРїРёСЃР°РЅРёСЋ.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё С‡С‚РµРЅРёСЏ.</param>
    /// <returns>РџР°РіРёРЅРёСЂРѕРІР°РЅРЅС‹Р№ СЃРїРёСЃРѕРє РІР°РєР°РЅСЃРёР№.</returns>
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

    /// <summary>
    /// РЎРѕР·РґР°РµС‚ РІР°РєР°РЅСЃРёСЋ РѕС‚ РёРјРµРЅРё Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°.
    /// </summary>
    /// <param name="request">Р”Р°РЅРЅС‹Рµ РІР°РєР°РЅСЃРёРё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё Р·Р°РїРёСЃРё.</param>
    /// <returns>РЎРѕР·РґР°РЅРЅР°СЏ РІР°РєР°РЅСЃРёСЏ РІ РєСЂР°С‚РєРѕРј С„РѕСЂРјР°С‚Рµ.</returns>
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

    /// <summary>
    /// РћР±РЅРѕРІР»СЏРµС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰СѓСЋ РІР°РєР°РЅСЃРёСЋ.
    /// </summary>
    /// <param name="id">РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РІР°РєР°РЅСЃРёРё.</param>
    /// <param name="request">РќРѕРІС‹Рµ Р·РЅР°С‡РµРЅРёСЏ РїРѕР»РµР№ РІР°РєР°РЅСЃРёРё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё Р·Р°РїРёСЃРё.</param>
    /// <returns>РћР±РЅРѕРІР»РµРЅРЅР°СЏ РІР°РєР°РЅСЃРёСЏ РІ РєСЂР°С‚РєРѕРј С„РѕСЂРјР°С‚Рµ.</returns>
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

    /// <summary>
    /// РЈРґР°Р»СЏРµС‚ РІР°РєР°РЅСЃРёСЋ РїРѕ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂСѓ.
    /// </summary>
    /// <param name="id">РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РІР°РєР°РЅСЃРёРё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё СѓРґР°Р»РµРЅРёСЏ.</param>
    /// <returns>РџСѓСЃС‚РѕР№ РѕС‚РІРµС‚ РїСЂРё СѓСЃРїРµС€РЅРѕРј СѓРґР°Р»РµРЅРёРё.</returns>
    /// <param name="request">РќРѕРІС‹Р№ СЃС‚Р°С‚СѓСЃ РІР°РєР°РЅСЃРёРё.</param>
    [HttpPatch("{id:long}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(long id, AdminVacancyStatusUpdateRequest request, CancellationToken cancellationToken)
    {
        var vacancy = await dbContext.Vacancies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("admin.vacancies.not_found", "Vacancy not found.");
        }

        vacancy.Status = request.Status;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
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

