using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Opportunities;
using Monolith.Services.Chats;
using Monolith.Services.Common;
using Monolith.Services.Social;

namespace Monolith.Controllers;

[ApiController]
[Route("opportunities")]
[Produces("application/json")]
public class OpportunitiesController(
    AppDbContext dbContext,
    IChatCacheService chatCache,
    IOpportunitySocialStateService socialStateService) : ControllerBase
{
    /// <summary>
    /// Возвращает список активных возможностей с фильтрами и пагинацией.
    /// </summary>
    /// <param name="query">Параметры фильтрации и пагинации возможностей.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Пагинированный список возможностей.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<OpportunityListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<OpportunityListItemDto>>> GetList([FromQuery] OpportunityListQuery query, CancellationToken cancellationToken)
    {
        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);
        var currentUserId = TryGetCurrentUserId();
        var viewerTagIds = currentUserId is null
            ? Array.Empty<long>()
            : await dbContext.CandidateResumeSkills
                .AsNoTracking()
                .Where(x => x.UserId == currentUserId.Value)
                .Select(x => x.TagId)
                .ToArrayAsync(cancellationToken);

        var baseQuery = BuildFilteredQuery(query);
        var totalCount = await baseQuery.CountAsync(cancellationToken);

        var rows = await baseQuery
            .Select(x => new
            {
                x.Id,
                x.Title,
                x.Kind,
                x.Format,
                x.CompanyId,
                CompanyName = x.Company.BrandName ?? x.Company.LegalName,
                CompanyLogoUrl = x.Company.LogoUrl,
                CityName = x.City != null ? x.City.CityName : (x.Location != null ? x.Location.City.CityName : "Unknown"),
                x.PriceType,
                x.PriceAmount,
                x.PriceCurrencyCode,
                x.PublishAt,
                x.EventDate,
                x.ParticipantsCanWrite,
                Verified = x.Company.Status == CompanyStatus.Verified,
                ParticipantsCount = x.Participants.Count,
                IsParticipating = currentUserId != null && x.Participants.Any(p => p.UserId == currentUserId.Value),
                TagMatchCount = viewerTagIds.Length == 0 ? 0 : x.OpportunityTags.Count(t => viewerTagIds.Contains(t.TagId)),
                Tags = x.OpportunityTags.Select(t => t.Tag.Name).ToArray()
            })
            .OrderByDescending(x => x.TagMatchCount)
            .ThenByDescending(x => x.PublishAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var opportunityIds = rows.Select(x => x.Id).ToArray();
        var socialStates = await socialStateService.GetOpportunitySnapshots(currentUserId, opportunityIds, cancellationToken);

        var items = rows.Select(x => new OpportunityListItemDto(
            x.Id,
            x.Title,
            x.Kind,
            x.Format,
            x.CompanyName,
            x.CityName,
            x.PriceType,
            x.PriceAmount,
            x.PriceCurrencyCode,
            x.PublishAt,
            x.EventDate,
            x.Verified,
            x.ParticipantsCount,
            x.IsParticipating,
            x.ParticipantsCanWrite,
            x.Tags)
        {
            CompanyId = x.CompanyId,
            CompanyLogoUrl = x.CompanyLogoUrl,
            TagMatchCount = x.TagMatchCount,
            IsFavoriteByMe = socialStates.GetValueOrDefault(x.Id).IsFavoriteByMe,
            FriendFavoritesCount = socialStates.GetValueOrDefault(x.Id).FriendFavoritesCount,
            FriendApplicationsCount = socialStates.GetValueOrDefault(x.Id).FriendApplicationsCount
        }).ToList();

        return Ok(new PagedResponse<OpportunityListItemDto>(items, totalCount, page, pageSize));
    }

    /// <summary>
    /// Возвращает детальную карточку возможности.
    /// </summary>
    /// <param name="id">Идентификатор возможности.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Детальная карточка возможности.</returns>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(OpportunityDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OpportunityDetailDto>> GetDetail(long id, CancellationToken cancellationToken)
    {
        var currentUserId = TryGetCurrentUserId();
        var opportunity = await dbContext.Opportunities
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.OpportunityTags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.Participants)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (opportunity is null)
        {
            return this.ToNotFoundError("opportunities.not_found", "Opportunity not found.");
        }

        var city = opportunity.City ?? opportunity.Location?.City;
        var locationLatitude = opportunity.Location is not null ? (decimal?)opportunity.Location.GeoPoint.Y : city?.Latitude;
        var locationLongitude = opportunity.Location is not null ? (decimal?)opportunity.Location.GeoPoint.X : city?.Longitude;
        var locationDto = city is null
            ? null
            : new LocationDto(
                city.Id,
                city.CityName,
                locationLatitude,
                locationLongitude,
                opportunity.Location?.StreetName,
                opportunity.Location?.HouseNumber);

        var dto = new OpportunityDetailDto(
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
            opportunity.Participants.Count,
            currentUserId != null && opportunity.Participants.Any(p => p.UserId == currentUserId.Value),
            new CompanyShortDto(
                opportunity.CompanyId,
                opportunity.Company.BrandName ?? opportunity.Company.LegalName,
                opportunity.Company.Status == CompanyStatus.Verified,
                opportunity.Company.WebsiteUrl,
                opportunity.Company.PublicEmail),
            locationDto,
            opportunity.OpportunityTags.Select(t => t.Tag.Name).ToArray());

        if (currentUserId is not null)
        {
            var viewerTagIds = await dbContext.CandidateResumeSkills
                .AsNoTracking()
                .Where(x => x.UserId == currentUserId.Value)
                .Select(x => x.TagId)
                .ToArrayAsync(cancellationToken);
            var tagSet = viewerTagIds.ToHashSet();
            var socialState = await socialStateService.GetOpportunitySnapshot(currentUserId, id, cancellationToken);

            dto = dto with
            {
                TagMatchCount = viewerTagIds.Length == 0 ? 0 : opportunity.OpportunityTags.Count(t => tagSet.Contains(t.TagId)),
                IsFavoriteByMe = socialState.IsFavoriteByMe,
                FriendFavoritesCount = socialState.FriendFavoritesCount,
                FriendApplicationsCount = socialState.FriendApplicationsCount
            };
        }

        return Ok(dto);
    }

    /// <summary>
    /// Добавляет текущего пользователя в участники возможности.
    /// </summary>
    /// <param name="id">Идентификатор возможности.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешном вступлении.</returns>
    [Authorize]
    [HttpPost("{id:long}/participation")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Join(long id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var opportunity = await dbContext.Opportunities
            .Include(x => x.Chat)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (opportunity is null)
        {
            return this.ToNotFoundError("opportunities.not_found", "Opportunity not found.");
        }

        var participationExists = await dbContext.OpportunityParticipants
            .AnyAsync(x => x.OpportunityId == id && x.UserId == userId, cancellationToken);
        if (!participationExists)
        {
            dbContext.OpportunityParticipants.Add(new OpportunityParticipant
            {
                OpportunityId = id,
                UserId = userId,
                JoinedAt = DateTimeOffset.UtcNow
            });
        }

        var chat = opportunity.Chat;
        if (chat is null)
        {
            chat = new Chat
            {
                Type = ChatType.Opportunity,
                OpportunityId = id
            };
            dbContext.Chats.Add(chat);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        var chatParticipantExists = await dbContext.ChatParticipants
            .AnyAsync(x => x.ChatId == chat.Id && x.UserId == userId, cancellationToken);
        if (!chatParticipantExists)
        {
            dbContext.ChatParticipants.Add(new ChatParticipant
            {
                ChatId = chat.Id,
                UserId = userId
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await chatCache.InvalidateUserListAsync(userId, cancellationToken);
        await chatCache.InvalidateChatHistoryAsync(chat.Id, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Удаляет текущего пользователя из участников возможности.
    /// </summary>
    /// <param name="id">Идентификатор возможности.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешном выходе.</returns>
    [Authorize]
    [HttpDelete("{id:long}/participation")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Leave(long id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var opportunity = await dbContext.Opportunities
            .Include(x => x.Chat)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (opportunity is null)
        {
            return this.ToNotFoundError("opportunities.not_found", "Opportunity not found.");
        }

        var participation = await dbContext.OpportunityParticipants
            .FirstOrDefaultAsync(x => x.OpportunityId == id && x.UserId == userId, cancellationToken);
        if (participation is not null)
        {
            dbContext.OpportunityParticipants.Remove(participation);
        }

        if (opportunity.Chat is not null)
        {
            var chatParticipant = await dbContext.ChatParticipants
                .FirstOrDefaultAsync(x => x.ChatId == opportunity.Chat.Id && x.UserId == userId, cancellationToken);
            if (chatParticipant is not null)
            {
                dbContext.ChatParticipants.Remove(chatParticipant);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        if (opportunity.Chat is not null)
        {
            await chatCache.InvalidateChatHistoryAsync(opportunity.Chat.Id, cancellationToken);
        }

        await chatCache.InvalidateUserListAsync(userId, cancellationToken);
        return NoContent();
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
            .Include(x => x.Participants)
            .Where(x => x.Status == OpportunityStatus.Active);

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

        if (query.Kinds is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.Kinds.Contains(x.Kind));
        }

        if (query.Formats is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.Formats.Contains(x.Format));
        }

        if (query.TagIds is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => x.OpportunityTags.Any(t => query.TagIds.Contains(t.TagId)));
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

        if (query.VerifiedOnly == true)
        {
            opportunities = opportunities.Where(x => x.Company.Status == CompanyStatus.Verified);
        }

        return opportunities;
    }

    private long? TryGetCurrentUserId() => socialStateService.TryGetCurrentUserId(User);
}
