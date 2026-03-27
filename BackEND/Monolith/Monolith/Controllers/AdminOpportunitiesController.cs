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
[Route("admin/opportunities")]
[Produces("application/json")]
public class AdminOpportunitiesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Р’РѕР·РІСЂР°С‰Р°РµС‚ СЃРїРёСЃРѕРє РІРѕР·РјРѕР¶РЅРѕСЃС‚РµР№ РґР»СЏ РјРѕРґРµСЂР°С†РёРё СЃ РїР°РіРёРЅР°С†РёРµР№ Рё РїРѕРёСЃРєРѕРј.
    /// </summary>
    /// <param name="page">РќРѕРјРµСЂ СЃС‚СЂР°РЅРёС†С‹ (РЅР°С‡РёРЅР°СЏ СЃ 1).</param>
    /// <param name="pageSize">Р Р°Р·РјРµСЂ СЃС‚СЂР°РЅРёС†С‹ (РјР°РєСЃРёРјСѓРј 100).</param>
    /// <param name="search">РџРѕРёСЃРєРѕРІР°СЏ СЃС‚СЂРѕРєР° РїРѕ Р·Р°РіРѕР»РѕРІРєСѓ Рё РєСЂР°С‚РєРѕРјСѓ РѕРїРёСЃР°РЅРёСЋ.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё С‡С‚РµРЅРёСЏ.</param>
    /// <returns>РџР°РіРёРЅРёСЂРѕРІР°РЅРЅС‹Р№ СЃРїРёСЃРѕРє РІРѕР·РјРѕР¶РЅРѕСЃС‚РµР№.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminOpportunityListItemDto>), StatusCodes.Status200OK)]
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
            .Select(x => new AdminOpportunityListItemDto(x.Id, x.CompanyId, x.Title, x.Status, x.Kind, x.Format, x.PublishAt))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<AdminOpportunityListItemDto>(rows, total, safePage, safePageSize));
    }

    /// <summary>
    /// РЎРѕР·РґР°РµС‚ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ РѕС‚ РёРјРµРЅРё Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°.
    /// </summary>
    /// <param name="request">Р”Р°РЅРЅС‹Рµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё Р·Р°РїРёСЃРё.</param>
    /// <returns>РЎРѕР·РґР°РЅРЅР°СЏ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ РІ РєСЂР°С‚РєРѕРј С„РѕСЂРјР°С‚Рµ.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(AdminOpportunityListItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AdminOpportunityListItemDto>> Create(AdminOpportunityUpsertRequest request, CancellationToken cancellationToken)
    {
        var validationError = ValidateEventPricing(request.PriceType, request.PriceAmount, request.PriceCurrencyCode);
        if (validationError is not null)
        {
            return this.ToBadRequestError("admin.opportunities.invalid_price", validationError);
        }

        var opportunity = new Opportunity();
        Apply(opportunity, request);
        dbContext.Opportunities.Add(opportunity);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminOpportunityListItemDto(opportunity.Id, opportunity.CompanyId, opportunity.Title, opportunity.Status, opportunity.Kind, opportunity.Format, opportunity.PublishAt);
        return CreatedAtAction(nameof(GetById), new { id = opportunity.Id }, dto);
    }

    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(AdminOpportunityDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminOpportunityDetailDto>> GetById(long id, CancellationToken cancellationToken)
    {
        var opportunity = await dbContext.Opportunities
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new AdminOpportunityDetailDto(
                x.Id,
                x.CompanyId,
                x.CreatedByUserId,
                x.Title,
                x.ShortDescription,
                x.FullDescription,
                x.Kind,
                x.Format,
                x.Status,
                x.CityId,
                x.LocationId,
                x.PriceType,
                x.PriceAmount,
                x.PriceCurrencyCode,
                x.ParticipantsCanWrite,
                x.PublishAt,
                x.EventDate))
            .FirstOrDefaultAsync(cancellationToken);

        if (opportunity is null)
        {
            return this.ToNotFoundError("admin.opportunities.not_found", "Opportunity not found.");
        }

        return Ok(opportunity);
    }

    /// <summary>
    /// РћР±РЅРѕРІР»СЏРµС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰СѓСЋ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ.
    /// </summary>
    /// <param name="id">РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё.</param>
    /// <param name="request">РќРѕРІС‹Рµ Р·РЅР°С‡РµРЅРёСЏ РїРѕР»РµР№ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё Р·Р°РїРёСЃРё.</param>
    /// <returns>РћР±РЅРѕРІР»РµРЅРЅР°СЏ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ РІ РєСЂР°С‚РєРѕРј С„РѕСЂРјР°С‚Рµ.</returns>
    [HttpPut("{id:long}")]
    [ProducesResponseType(typeof(AdminOpportunityListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AdminOpportunityListItemDto>> Update(long id, AdminOpportunityUpsertRequest request, CancellationToken cancellationToken)
    {
        var validationError = ValidateEventPricing(request.PriceType, request.PriceAmount, request.PriceCurrencyCode);
        if (validationError is not null)
        {
            return this.ToBadRequestError("admin.opportunities.invalid_price", validationError);
        }

        var opportunity = await dbContext.Opportunities.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (opportunity is null)
        {
            return this.ToNotFoundError("admin.opportunities.not_found", "Opportunity not found.");
        }

        Apply(opportunity, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminOpportunityListItemDto(opportunity.Id, opportunity.CompanyId, opportunity.Title, opportunity.Status, opportunity.Kind, opportunity.Format, opportunity.PublishAt);
        return Ok(dto);
    }

    /// <summary>
    /// РЈРґР°Р»СЏРµС‚ РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ РїРѕ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂСѓ.
    /// </summary>
    /// <param name="id">РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё СѓРґР°Р»РµРЅРёСЏ.</param>
    /// <returns>РџСѓСЃС‚РѕР№ РѕС‚РІРµС‚ РїСЂРё СѓСЃРїРµС€РЅРѕРј СѓРґР°Р»РµРЅРёРё.</returns>
    /// <param name="request">РќРѕРІС‹Р№ СЃС‚Р°С‚СѓСЃ РјРµСЂРѕРїСЂРёСЏС‚РёСЏ.</param>
    [HttpPatch("{id:long}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(long id, AdminOpportunityStatusUpdateRequest request, CancellationToken cancellationToken)
    {
        var opportunity = await dbContext.Opportunities.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (opportunity is null)
        {
            return this.ToNotFoundError("admin.opportunities.not_found", "Opportunity not found.");
        }

        opportunity.Status = request.Status;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var opportunity = await dbContext.Opportunities.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (opportunity is null)
        {
            return this.ToNotFoundError("admin.opportunities.not_found", "Opportunity not found.");
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
        opportunity.Kind = request.Kind;
        opportunity.Format = request.Format;
        opportunity.Status = request.Status;
        opportunity.CityId = request.CityId;
        opportunity.LocationId = request.LocationId;
        opportunity.PriceType = request.PriceType;
        opportunity.PriceAmount = request.PriceAmount;
        opportunity.PriceCurrencyCode = request.PriceCurrencyCode?.Trim().ToUpperInvariant();
        opportunity.ParticipantsCanWrite = request.ParticipantsCanWrite;
        opportunity.PublishAt = request.PublishAt;
        opportunity.EventDate = request.EventDate;
    }

    private static string? ValidateEventPricing(PriceType priceType, decimal? priceAmount, string? priceCurrencyCode)
    {
        if (priceAmount is < 0)
        {
            return "Price amount must be >= 0.";
        }

        if (priceType == PriceType.Free)
        {
            if (priceAmount is not null || !string.IsNullOrWhiteSpace(priceCurrencyCode))
            {
                return "Free event cannot have amount or currency.";
            }

            return null;
        }

        if (priceAmount is null || string.IsNullOrWhiteSpace(priceCurrencyCode))
        {
            return "Paid and prize events require amount and currency.";
        }

        return null;
    }
}

