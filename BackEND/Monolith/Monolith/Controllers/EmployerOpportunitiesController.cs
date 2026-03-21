using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Employer;
using Monolith.Models.Opportunities;
using Monolith.Services.Common;
using Monolith.Services.Geo;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "employer")]
[Route("employer/opportunities")]
[Produces("application/json")]
public class EmployerOpportunitiesController(
    AppDbContext dbContext,
    IEmployerLocationService employerLocationService) : ControllerBase
{
    /// <summary>
    /// Возвращает возможности компании работодателя с фильтрами и пагинацией.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<EmployerOpportunityListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PagedResponse<EmployerOpportunityListItemDto>>> GetList([FromQuery] EmployerOpportunityListQuery query, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);
        var last24 = DateTimeOffset.UtcNow.AddHours(-24);

        var opportunities = dbContext.Opportunities
            .AsNoTracking()
            .Include(x => x.OpportunityTags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.Participants)
            .Where(x => x.CompanyId == membership.CompanyId);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            opportunities = opportunities.Where(x =>
                x.Title.ToLower().Contains(term) ||
                x.ShortDescription.ToLower().Contains(term) ||
                x.FullDescription.ToLower().Contains(term));
        }

        if (query.Statuses is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.Statuses.Contains(x.Status));
        }

        if (query.Kinds is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.Kinds.Contains(x.Kind));
        }

        if (query.Formats is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.Formats.Contains(x.Format));
        }

        if (query.PriceTypes is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.PriceTypes.Contains(x.PriceType));
        }

        if (query.PriceFrom is not null)
        {
            opportunities = opportunities.Where(x => x.PriceAmount == null || x.PriceAmount >= query.PriceFrom);
        }

        if (query.PriceTo is not null)
        {
            opportunities = opportunities.Where(x => x.PriceAmount == null || x.PriceAmount <= query.PriceTo);
        }

        if (query.TagIds is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => x.OpportunityTags.Any(t => query.TagIds.Contains(t.TagId)));
        }

        var total = await opportunities.CountAsync(cancellationToken);
        var rows = await opportunities
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new EmployerOpportunityListItemDto(
                x.Id,
                x.Title,
                x.Kind,
                x.Format,
                x.Status,
                x.PriceType,
                x.PriceAmount,
                x.PriceCurrencyCode,
                x.ParticipantsCanWrite,
                x.PublishAt,
                x.EventDate,
                x.Participants.Count,
                x.Participants.Count(p => p.JoinedAt >= last24),
                x.OpportunityTags.Select(t => t.Tag.Name).ToArray()))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<EmployerOpportunityListItemDto>(rows, total, page, pageSize));
    }

    /// <summary>
    /// Возвращает детальную карточку возможности со статистикой участников.
    /// </summary>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(EmployerOpportunityDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployerOpportunityDetailDto>> GetById(long id, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var opportunity = await dbContext.Opportunities
            .AsNoTracking()
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.OpportunityTags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.Participants)
                .ThenInclude(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);

        if (opportunity is null)
        {
            return this.ToNotFoundError("employer.opportunities.not_found", "Opportunity not found.");
        }

        var last24 = DateTimeOffset.UtcNow.AddHours(-24);
        var stats = new EmployerOpportunityStatsDto(
            opportunity.Participants.Count,
            opportunity.Participants.Count(p => p.JoinedAt >= last24));

        var locationCity = opportunity.City ?? opportunity.Location?.City;
        var location = locationCity is null
            ? null
            : new LocationDto(
                locationCity.Id,
                locationCity.CityName,
                locationCity.Latitude,
                locationCity.Longitude,
                opportunity.Location?.StreetName,
                opportunity.Location?.HouseNumber);

        var recentParticipants = opportunity.Participants
            .OrderByDescending(x => x.JoinedAt)
            .Take(10)
            .Select(x => new EmployerOpportunityRecentParticipantDto(
                x.UserId,
                x.User.DisplayName,
                x.User.AvatarUrl,
                x.JoinedAt))
            .ToArray();

        var dto = new EmployerOpportunityDetailDto(
            opportunity.Id,
            opportunity.Title,
            opportunity.ShortDescription,
            opportunity.FullDescription,
            opportunity.Kind,
            opportunity.Format,
            opportunity.Status,
            opportunity.PublishAt,
            opportunity.EventDate,
            opportunity.PriceType,
            opportunity.PriceAmount,
            opportunity.PriceCurrencyCode,
            opportunity.ParticipantsCanWrite,
            location,
            stats,
            recentParticipants,
            opportunity.OpportunityTags.Select(t => t.Tag.Name).ToArray());

        return Ok(dto);
    }

    /// <summary>
    /// Создает возможность в компании работодателя.
    /// </summary>
    /// <remarks>
    /// При передаче mapPoint сервер выполняет reverse geocode и сам заполняет CityId/LocationId.
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<object>> Create(EmployerOpportunityUpsertRequest request, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var validationError = ValidateOpportunity(request);
        if (validationError is not null)
        {
            return this.ToBadRequestError("employer.opportunities.invalid", validationError);
        }

        var resolvedLocation = await ResolveMapPointAsync(request.MapPoint, cancellationToken);
        var opportunity = new Opportunity
        {
            CompanyId = membership.CompanyId,
            CreatedByUserId = membership.UserId,
            Title = request.Title.Trim(),
            ShortDescription = request.ShortDescription.Trim(),
            FullDescription = request.FullDescription.Trim(),
            Kind = request.Kind,
            Format = request.Format,
            Status = request.Status,
            CityId = request.CityId,
            LocationId = request.LocationId,
            PriceType = request.PriceType,
            PriceAmount = request.PriceAmount,
            PriceCurrencyCode = request.PriceCurrencyCode?.Trim().ToUpperInvariant(),
            ParticipantsCanWrite = request.ParticipantsCanWrite,
            PublishAt = request.PublishAt,
            EventDate = request.EventDate
        };

        if (resolvedLocation is not null)
        {
            opportunity.CityId = resolvedLocation.CityId;
            opportunity.LocationId = resolvedLocation.LocationId;
        }

        dbContext.Opportunities.Add(opportunity);
        await dbContext.SaveChangesAsync(cancellationToken);
        await ReplaceOpportunityTags(opportunity.Id, request.TagIds, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = opportunity.Id }, new { opportunityId = opportunity.Id });
    }

    /// <summary>
    /// Обновляет возможность в компании работодателя.
    /// </summary>
    /// <remarks>
    /// При передаче mapPoint сервер выполняет reverse geocode и сам заполняет CityId/LocationId.
    /// </remarks>
    [HttpPatch("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(long id, EmployerOpportunityUpsertRequest request, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var validationError = ValidateOpportunity(request);
        if (validationError is not null)
        {
            return this.ToBadRequestError("employer.opportunities.invalid", validationError);
        }

        var opportunity = await dbContext.Opportunities.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (opportunity is null)
        {
            return this.ToNotFoundError("employer.opportunities.not_found", "Opportunity not found.");
        }

        var resolvedLocation = await ResolveMapPointAsync(request.MapPoint, cancellationToken);

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

        if (resolvedLocation is not null)
        {
            opportunity.CityId = resolvedLocation.CityId;
            opportunity.LocationId = resolvedLocation.LocationId;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await ReplaceOpportunityTags(opportunity.Id, request.TagIds, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Архивирует возможность (мягкое удаление).
    /// </summary>
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var opportunity = await dbContext.Opportunities.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (opportunity is null)
        {
            return this.ToNotFoundError("employer.opportunities.not_found", "Opportunity not found.");
        }

        opportunity.Status = OpportunityStatus.Archived;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Обновляет статус возможности.
    /// </summary>
    [HttpPatch("{id:long}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(long id, EmployerOpportunityStatusUpdateRequest request, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var opportunity = await dbContext.Opportunities.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (opportunity is null)
        {
            return this.ToNotFoundError("employer.opportunities.not_found", "Opportunity not found.");
        }

        opportunity.Status = request.Status;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task ReplaceOpportunityTags(long opportunityId, IReadOnlyCollection<long>? tagIds, CancellationToken cancellationToken)
    {
        var normalizedTagIds = (tagIds ?? Array.Empty<long>())
            .Where(x => x > 0)
            .Distinct()
            .ToArray();

        var existing = await dbContext.OpportunityTags.Where(x => x.OpportunityId == opportunityId).ToListAsync(cancellationToken);
        dbContext.OpportunityTags.RemoveRange(existing);

        if (normalizedTagIds.Length > 0)
        {
            var existingTagIds = await dbContext.Tags
                .Where(x => normalizedTagIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToArrayAsync(cancellationToken);

            dbContext.OpportunityTags.AddRange(existingTagIds.Select(tagId => new OpportunityTag
            {
                OpportunityId = opportunityId,
                TagId = tagId
            }));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<CompanyMember?> GetManagementMembership(CancellationToken cancellationToken)
        => await dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.UserId == User.GetUserId() &&
                     (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin || x.Role == CompanyMemberRole.Staff),
                cancellationToken);

    private static string? ValidateOpportunity(EmployerOpportunityUpsertRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) ||
            string.IsNullOrWhiteSpace(request.ShortDescription) ||
            string.IsNullOrWhiteSpace(request.FullDescription))
        {
            return "Title and descriptions are required.";
        }

        if (request.PriceAmount is < 0)
        {
            return "Price amount must be >= 0.";
        }

        if (request.PriceType == PriceType.Free)
        {
            if (request.PriceAmount is not null || !string.IsNullOrWhiteSpace(request.PriceCurrencyCode))
            {
                return "Free event cannot have price amount or currency.";
            }
        }
        else
        {
            if (request.PriceAmount is null || string.IsNullOrWhiteSpace(request.PriceCurrencyCode))
            {
                return "Paid and prize events require amount and currency.";
            }
        }

        if (request.MapPoint is not null)
        {
            if (request.MapPoint.Latitude is < -90 or > 90)
            {
                return "mapPoint.latitude must be between -90 and 90.";
            }

            if (request.MapPoint.Longitude is < -180 or > 180)
            {
                return "mapPoint.longitude must be between -180 and 180.";
            }
        }

        return null;
    }

    private async Task<ResolvedLocationResult?> ResolveMapPointAsync(MapPointDto? mapPoint, CancellationToken cancellationToken)
    {
        if (mapPoint is null)
        {
            return null;
        }

        return await employerLocationService.ResolveOrCreateAsync(mapPoint.Latitude, mapPoint.Longitude, cancellationToken);
    }
}
