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
/// РђРґРјРёРЅРёСЃС‚СЂР°С‚РёРІРЅС‹Рµ РѕРїРµСЂР°С†РёРё РЅР°Рґ РєРѕРјРїР°РЅРёСЏРјРё.
/// Р”РѕСЃС‚СѓРї С‚РѕР»СЊРєРѕ РґР»СЏ СЂРѕР»Рё curator.
/// </summary>
[ApiController]
[Authorize(Roles = "curator,admin")]
[Route("admin/companies")]
[Produces("application/json")]
public class AdminCompaniesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Р’РѕР·РІСЂР°С‰Р°РµС‚ СЃРїРёСЃРѕРє РєРѕРјРїР°РЅРёР№ СЃ РїР°РіРёРЅР°С†РёРµР№ Рё РїРѕРёСЃРєРѕРј.
    /// </summary>
    /// <param name="page">РќРѕРјРµСЂ СЃС‚СЂР°РЅРёС†С‹ (РЅР°С‡РёРЅР°СЏ СЃ 1).</param>
    /// <param name="pageSize">Р Р°Р·РјРµСЂ СЃС‚СЂР°РЅРёС†С‹ (РјР°РєСЃРёРјСѓРј 100).</param>
    /// <param name="search">РџРѕРёСЃРєРѕРІР°СЏ СЃС‚СЂРѕРєР° РїРѕ legalName/brandName/industry.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё.</param>
    /// <returns>РџР°РіРёРЅРёСЂРѕРІР°РЅРЅС‹Р№ СЃРїРёСЃРѕРє РєРѕРјРїР°РЅРёР№.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminCompanyListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResponse<AdminCompanyListItemDto>>> GetList(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = page <= 0 ? 1 : page;
        var safePageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);
        var query = dbContext.Companies.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.LegalName.ToLower().Contains(term) ||
                (x.BrandName != null && x.BrandName.ToLower().Contains(term)) ||
                x.Industry.ToLower().Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new AdminCompanyListItemDto(x.Id, x.LegalName, x.BrandName, x.Status, x.BaseCityId, x.Industry, x.CreatedAt))
            .ToListAsync(cancellationToken);
        return Ok(new PagedResponse<AdminCompanyListItemDto>(rows, total, safePage, safePageSize));
    }

    /// <summary>
    /// РЎРѕР·РґР°РµС‚ РєРѕРјРїР°РЅРёСЋ РІ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РёРІРЅРѕРј РєРѕРЅС‚СѓСЂРµ.
    /// </summary>
    /// <param name="request">РџРѕР»РЅС‹Р№ РЅР°Р±РѕСЂ РїРѕР»РµР№ РєРѕРјРїР°РЅРёРё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё.</param>
    /// <returns>РЎРѕР·РґР°РЅРЅР°СЏ РєРѕРјРїР°РЅРёСЏ.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(AdminCompanyListItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminCompanyListItemDto>> Create(AdminCompanyUpsertRequest request, CancellationToken cancellationToken)
    {
        var company = new Company();
        Apply(company, request);
        dbContext.Companies.Add(company);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminCompanyListItemDto(company.Id, company.LegalName, company.BrandName, company.Status, company.BaseCityId, company.Industry, company.CreatedAt);
        return CreatedAtAction(nameof(GetList), new { id = company.Id }, dto);
    }

    /// <summary>
    /// РћР±РЅРѕРІР»СЏРµС‚ РґР°РЅРЅС‹Рµ РєРѕРјРїР°РЅРёРё.
    /// </summary>
    /// <param name="id">РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РєРѕРјРїР°РЅРёРё.</param>
    /// <param name="request">РќРѕРІС‹Рµ Р·РЅР°С‡РµРЅРёСЏ РїРѕР»РµР№ РєРѕРјРїР°РЅРёРё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё.</param>
    /// <returns>РћР±РЅРѕРІР»РµРЅРЅР°СЏ РєРѕРјРїР°РЅРёСЏ.</returns>
    [HttpPut("{id:long}")]
    [ProducesResponseType(typeof(AdminCompanyListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminCompanyListItemDto>> Update(long id, AdminCompanyUpsertRequest request, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "РљРѕРјРїР°РЅРёСЏ РЅРµ РЅР°Р№РґРµРЅР°.");
        }

        Apply(company, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminCompanyListItemDto(company.Id, company.LegalName, company.BrandName, company.Status, company.BaseCityId, company.Industry, company.CreatedAt);
        return Ok(dto);
    }

    /// <summary>
    /// РЈРґР°Р»СЏРµС‚ РєРѕРјРїР°РЅРёСЋ.
    /// </summary>
    /// <remarks>
    /// РЈРґР°Р»РµРЅРёРµ С„РёР·РёС‡РµСЃРєРѕРµ (hard delete), РІРєР»СЋС‡Р°СЏ Р·Р°РІРёСЃРёРјС‹Рµ Р·Р°РїРёСЃРё РїРѕ РєР°СЃРєР°РґРЅС‹Рј FK.
    /// </remarks>
    /// <param name="id">РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РєРѕРјРїР°РЅРёРё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё.</param>
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "РљРѕРјРїР°РЅРёСЏ РЅРµ РЅР°Р№РґРµРЅР°.");
        }

        dbContext.Companies.Remove(company);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// РџРѕРґС‚РІРµСЂР¶РґР°РµС‚ РІРµСЂРёС„РёРєР°С†РёСЋ РєРѕРјРїР°РЅРёРё.
    /// </summary>
    /// <param name="id">РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РєРѕРјРїР°РЅРёРё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё.</param>
    [HttpPost("{id:long}/verify")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Verify(long id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "РљРѕРјРїР°РЅРёСЏ РЅРµ РЅР°Р№РґРµРЅР°.");
        }

        company.Status = CompanyStatus.Verified;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// РћС‚РєР»РѕРЅСЏРµС‚ РІРµСЂРёС„РёРєР°С†РёСЋ РєРѕРјРїР°РЅРёРё.
    /// </summary>
    /// <param name="id">РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РєРѕРјРїР°РЅРёРё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё.</param>
    [HttpPost("{id:long}/reject")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Reject(long id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "РљРѕРјРїР°РЅРёСЏ РЅРµ РЅР°Р№РґРµРЅР°.");
        }

        company.Status = CompanyStatus.Rejected;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void Apply(Company company, AdminCompanyUpsertRequest request)
    {
        company.LegalName = request.LegalName.Trim();
        company.BrandName = string.IsNullOrWhiteSpace(request.BrandName) ? null : request.BrandName.Trim();
        company.LegalType = request.LegalType;
        company.TaxId = request.TaxId.Trim();
        company.RegistrationNumber = request.RegistrationNumber.Trim();
        company.Industry = request.Industry.Trim();
        company.Description = request.Description.Trim();
        company.BaseCityId = request.BaseCityId;
        company.WebsiteUrl = string.IsNullOrWhiteSpace(request.WebsiteUrl) ? null : request.WebsiteUrl.Trim();
        company.PublicEmail = string.IsNullOrWhiteSpace(request.PublicEmail) ? null : request.PublicEmail.Trim();
        company.PublicPhone = string.IsNullOrWhiteSpace(request.PublicPhone) ? null : request.PublicPhone.Trim();
        company.Status = request.Status;
    }
}

