using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Hubs;
using Monolith.Models.Chat;
using Monolith.Models.Common;
using Monolith.Services.Chats;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize]
[Route("chats")]
[Produces("application/json")]
public class ChatsController(AppDbContext dbContext, IHubContext<ChatHub> hubContext, IChatCacheService chatCache) : ControllerBase
{
    /// <summary>
    /// Возвращает список чатов текущего пользователя.
    /// </summary>
    /// <remarks>
    /// Доступен по двум маршрутам: <c>/chats</c> и <c>/employer/chats</c>.
    /// </remarks>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Список чатов с последними сообщениями.</returns>
    [HttpGet]
    [HttpGet("/employer/chats")]
    [ProducesResponseType(typeof(IReadOnlyCollection<ChatListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<ChatListItemDto>>> GetMyChats(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var listToken = await chatCache.GetUserListTokenAsync(userId, cancellationToken);
        var cacheKey = $"chats:list:user:{userId}:v:{listToken}";

        var cached = await chatCache.GetAsync<List<ChatListItemDto>>(cacheKey, cancellationToken);
        if (cached is not null)
        {
            return Ok(cached);
        }

        var chats = await dbContext.Chats
            .AsNoTracking()
            .Where(x => x.Participants.Any(p => p.UserId == userId))
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ChatProjection(
                x.Id,
                x.Type,
                x.CreatedAt,
                x.Application == null ? null : (x.Application.Company.BrandName ?? x.Application.Company.LegalName),
                x.Application == null ? null : (long?)x.Application.CandidateUserId,
                x.Opportunity == null ? null : x.Opportunity.Title,
                x.Participants.Count,
                x.Participants.Select(p => new ChatParticipantProjection(
                    p.UserId,
                    p.User.DisplayName,
                    p.User.AvatarUrl,
                    p.User.CandidateProfile != null ? p.User.CandidateProfile.LastName : null,
                    p.User.CandidateProfile != null ? p.User.CandidateProfile.FirstName : null,
                    p.User.CandidateProfile != null ? p.User.CandidateProfile.MiddleName : null))
                    .ToArray(),
                x.Messages
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => new ChatMessageProjection(
                        m.Id,
                        m.ChatId,
                        m.SenderUserId,
                        m.SenderUser.DisplayName,
                        m.SenderUser.AvatarUrl,
                        m.Text,
                        m.IsSystem,
                        m.CreatedAt))
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);

        var result = chats.Select(x => new ChatListItemDto(
                x.Id,
                x.Type,
                ResolveChatTitle(userId, x),
                x.Type == ChatType.Opportunity ? null : x.Participants.Select(p => p.UserId).ToArray(),
                x.ParticipantsCount,
                x.CreatedAt,
                x.LastMessage is null ? null : ToDto(x.LastMessage)))
            .ToList();

        await chatCache.SetAsync(cacheKey, result, TimeSpan.FromSeconds(20), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Создает прямой чат между текущим и целевым пользователем.
    /// </summary>
    /// <param name="request">Идентификатор пользователя-собеседника.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Идентификатор созданного или уже существующего direct-чата.</returns>
    [HttpPost("direct")]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<object>> CreateDirectChat(CreateDirectChatRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (request.UserId == userId)
        {
            return this.ToBadRequestError("chats.direct.self", "Cannot create direct chat with self.");
        }

        var targetExists = await dbContext.Users.AnyAsync(x => x.Id == request.UserId, cancellationToken);
        if (!targetExists)
        {
            return this.ToNotFoundError("chats.direct.target_not_found", "Target user not found.");
        }

        var currentUserIsSeeker = await dbContext.UserRoles
            .AsNoTracking()
            .AnyAsync(x => x.UserId == userId && x.Role == PlatformRole.Seeker, cancellationToken);

        if (!currentUserIsSeeker)
        {
            var hasMutualContext =
                await dbContext.CompanyMembers.AnyAsync(x => x.UserId == userId &&
                    dbContext.CompanyMembers.Any(y => y.CompanyId == x.CompanyId && y.UserId == request.UserId), cancellationToken)
                || await dbContext.Applications.AnyAsync(x =>
                    (x.CandidateUserId == userId && dbContext.CompanyMembers.Any(m => m.CompanyId == x.CompanyId && m.UserId == request.UserId))
                    || (x.CandidateUserId == request.UserId && dbContext.CompanyMembers.Any(m => m.CompanyId == x.CompanyId && m.UserId == userId)),
                    cancellationToken);

            if (!hasMutualContext)
            {
                return this.ToBadRequestError("chats.direct.mutual_context_required", "Cannot create direct chat without mutual context.");
            }
        }

        var existingChatId = await dbContext.Chats
            .Where(x => x.Type == ChatType.Direct)
            .Where(x => x.Participants.Any(p => p.UserId == userId) && x.Participants.Any(p => p.UserId == request.UserId))
            .Select(x => (long?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (existingChatId is not null)
        {
            return Created(string.Empty, new { chatId = existingChatId.Value });
        }

        var chat = new Chat { Type = ChatType.Direct };
        dbContext.Chats.Add(chat);
        await dbContext.SaveChangesAsync(cancellationToken);

        dbContext.ChatParticipants.AddRange(
            new ChatParticipant { ChatId = chat.Id, UserId = userId },
            new ChatParticipant { ChatId = chat.Id, UserId = request.UserId });
        await dbContext.SaveChangesAsync(cancellationToken);

        await chatCache.InvalidateUserListAsync(userId, cancellationToken);
        await chatCache.InvalidateUserListAsync(request.UserId, cancellationToken);
        await chatCache.InvalidateChatHistoryAsync(chat.Id, cancellationToken);

        return Created(string.Empty, new { chatId = chat.Id });
    }

    /// <summary>
    /// Возвращает страницу истории сообщений чата.
    /// </summary>
    /// <param name="chatId">Идентификатор чата.</param>
    /// <param name="beforeMessageId">Идентификатор сообщения для пагинации назад.</param>
    /// <param name="limit">Размер страницы (1..200).</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Страница истории сообщений с признаком продолжения.</returns>
    [HttpGet("{chatId:long}/history")]
    [ProducesResponseType(typeof(ChatHistoryPageDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatHistoryPageDto>> GetHistory(
        long chatId,
        [FromQuery] long? beforeMessageId,
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        if (!await IsParticipant(chatId, userId, cancellationToken))
        {
            return this.ToNotFoundError("chats.not_found", "Chat not found.");
        }

        var normalizedLimit = Math.Clamp(limit, 1, 200);
        var historyToken = await chatCache.GetChatHistoryTokenAsync(chatId, cancellationToken);
        var cacheKey = $"chats:history:chat:{chatId}:before:{beforeMessageId?.ToString() ?? "null"}:limit:{normalizedLimit}:v:{historyToken}";

        var cached = await chatCache.GetAsync<ChatHistoryPageDto>(cacheKey, cancellationToken);
        if (cached is not null)
        {
            return Ok(cached);
        }

        var page = await BuildHistoryPageAsync(chatId, beforeMessageId, normalizedLimit, cancellationToken);
        await chatCache.SetAsync(cacheKey, page, TimeSpan.FromSeconds(20), cancellationToken);
        return Ok(page);
    }

    /// <summary>
    /// Возвращает детальную информацию о чате, связанную карточку и первую страницу истории.
    /// </summary>
    /// <remarks>
    /// Доступен по двум маршрутам: <c>/chats/{chatId}/detail</c> и <c>/employer/chats/{chatId}/detail</c>.
    /// </remarks>
    /// <param name="chatId">Идентификатор чата.</param>
    /// <param name="beforeMessageId">Идентификатор сообщения для пагинации назад.</param>
    /// <param name="limit">Размер страницы истории (1..200).</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Детальная карточка чата.</returns>
    [HttpGet("{chatId:long}/detail")]
    [HttpGet("/employer/chats/{chatId:long}/detail")]
    [ProducesResponseType(typeof(ChatDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatDetailDto>> GetDetail(
        long chatId,
        [FromQuery] long? beforeMessageId,
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        if (!await IsParticipant(chatId, userId, cancellationToken))
        {
            return this.ToNotFoundError("chats.not_found", "Chat not found.");
        }

        var chat = await dbContext.Chats
            .AsNoTracking()
            .Include(x => x.Participants)
                .ThenInclude(x => x.User)
                    .ThenInclude(x => x.CandidateProfile)
            .Include(x => x.Opportunity)
            .Include(x => x.Application!)
                .ThenInclude(x => x.Company)
            .Include(x => x.Application!)
                .ThenInclude(x => x.Vacancy)
            .Include(x => x.Application!)
                .ThenInclude(x => x.CandidateUser)
                    .ThenInclude(x => x.CandidateProfile!)
                        .ThenInclude(x => x.ResumeProfile)
            .FirstOrDefaultAsync(x => x.Id == chatId, cancellationToken);

        if (chat is null)
        {
            return this.ToNotFoundError("chats.not_found", "Chat not found.");
        }

        var normalizedLimit = Math.Clamp(limit, 1, 200);
        var history = await BuildHistoryPageAsync(chatId, beforeMessageId, normalizedLimit, cancellationToken);
        var linkedCard = BuildLinkedCard(chat, userId);

        var dto = new ChatDetailDto(
            chat.Id,
            chat.Type,
            ResolveChatTitle(userId, chat),
            chat.Participants.Count,
            chat.CreatedAt,
            linkedCard,
            history);

        return Ok(dto);
    }

    /// <summary>
    /// Возвращает новые сообщения чата от указанного курсора.
    /// </summary>
    /// <param name="chatId">Идентификатор чата.</param>
    /// <param name="cursor">Идентификатор сообщения, после которого нужно читать сообщения.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Список сообщений в порядке возрастания идентификатора.</returns>
    [HttpGet("{chatId:long}/messages")]
    [ProducesResponseType(typeof(IReadOnlyCollection<ChatMessageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyCollection<ChatMessageDto>>> GetMessages(long chatId, [FromQuery] long? cursor, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (!await IsParticipant(chatId, userId, cancellationToken))
        {
            return this.ToNotFoundError("chats.not_found", "Chat not found.");
        }

        var query = dbContext.ChatMessages.AsNoTracking().Where(x => x.ChatId == chatId);
        if (cursor is not null)
        {
            query = query.Where(x => x.Id > cursor);
        }

        var messages = await query
            .OrderBy(x => x.Id)
            .Take(200)
            .Select(x => new ChatMessageDto(
                x.Id,
                x.ChatId,
                x.SenderUserId,
                x.SenderUser.DisplayName,
                x.SenderUser.AvatarUrl,
                x.Text,
                x.IsSystem,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
        return Ok(messages);
    }

    /// <summary>
    /// Отправляет сообщение в чат от имени текущего пользователя.
    /// </summary>
    /// <param name="chatId">Идентификатор чата.</param>
    /// <param name="request">Текст отправляемого сообщения.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Созданное сообщение.</returns>
    [HttpPost("{chatId:long}/messages")]
    [ProducesResponseType(typeof(ChatMessageDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ChatMessageDto>> SendMessage(long chatId, SendChatMessageRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (!await IsParticipant(chatId, userId, cancellationToken))
        {
            return this.ToNotFoundError("chats.not_found", "Chat not found.");
        }

        var chatMeta = await dbContext.Chats
            .AsNoTracking()
            .Where(x => x.Id == chatId)
            .Select(x => new { x.Type, x.OpportunityId })
            .FirstOrDefaultAsync(cancellationToken);
        if (chatMeta is null)
        {
            return this.ToNotFoundError("chats.not_found", "Chat not found.");
        }

        if (chatMeta.Type == ChatType.Opportunity && chatMeta.OpportunityId is not null)
        {
            var canSend = await CanSendToOpportunityChat(chatMeta.OpportunityId.Value, userId, cancellationToken);
            if (!canSend)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("chats.opportunity.write_forbidden", "Writing in this event chat is disabled."));
            }
        }

        var message = new ChatMessage
        {
            ChatId = chatId,
            SenderUserId = userId,
            Text = request.Text.Trim(),
            IsSystem = false
        };
        dbContext.ChatMessages.Add(message);
        await dbContext.SaveChangesAsync(cancellationToken);

        await chatCache.InvalidateChatHistoryAsync(chatId, cancellationToken);
        await InvalidateChatListForParticipants(chatId, cancellationToken);

        var sender = await dbContext.Users
            .AsNoTracking()
            .Where(x => x.Id == userId)
            .Select(x => new { x.DisplayName, x.AvatarUrl })
            .FirstAsync(cancellationToken);

        var dto = new ChatMessageDto(
            message.Id,
            message.ChatId,
            message.SenderUserId,
            sender.DisplayName,
            sender.AvatarUrl,
            message.Text,
            message.IsSystem,
            message.CreatedAt);

        await hubContext.Clients.Group(ChatHub.GroupName(chatId)).SendAsync("new", dto, cancellationToken);
        return Created(string.Empty, dto);
    }

    /// <summary>
    /// Отмечает сообщение как прочитанное текущим пользователем.
    /// </summary>
    /// <param name="chatId">Идентификатор чата.</param>
    /// <param name="request">Идентификатор сообщения для отметки о прочтении.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешной отметке.</returns>
    [HttpPost("{chatId:long}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Read(long chatId, MarkChatReadRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (!await IsParticipant(chatId, userId, cancellationToken))
        {
            return this.ToNotFoundError("chats.not_found", "Chat not found.");
        }

        var messageExists = await dbContext.ChatMessages.AnyAsync(x => x.Id == request.MessageId && x.ChatId == chatId, cancellationToken);
        if (!messageExists)
        {
            return this.ToNotFoundError("chats.message.not_found", "Message not found.");
        }

        var existing = await dbContext.ChatMessageReads.FirstOrDefaultAsync(x => x.MessageId == request.MessageId && x.UserId == userId, cancellationToken);
        if (existing is null)
        {
            dbContext.ChatMessageReads.Add(new ChatMessageRead
            {
                MessageId = request.MessageId,
                UserId = userId,
                ReadAt = DateTimeOffset.UtcNow
            });
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await hubContext.Clients.Group(ChatHub.GroupName(chatId)).SendAsync("read", new { chatId, messageId = request.MessageId, userId }, cancellationToken);
        return NoContent();
    }

    private Task<bool> IsParticipant(long chatId, long userId, CancellationToken cancellationToken)
        => dbContext.ChatParticipants.AnyAsync(x => x.ChatId == chatId && x.UserId == userId, cancellationToken);

    private async Task<bool> CanSendToOpportunityChat(long opportunityId, long userId, CancellationToken cancellationToken)
    {
        var opportunity = await dbContext.Opportunities
            .AsNoTracking()
            .Where(x => x.Id == opportunityId)
            .Select(x => new { x.CompanyId, x.ParticipantsCanWrite })
            .FirstOrDefaultAsync(cancellationToken);
        if (opportunity is null)
        {
            return false;
        }

        if (opportunity.ParticipantsCanWrite)
        {
            return true;
        }

        var isCurator = await dbContext.UserRoles
            .AsNoTracking()
            .AnyAsync(x => x.UserId == userId && x.Role == PlatformRole.Curator, cancellationToken);
        if (isCurator)
        {
            return true;
        }

        var isCompanyMember = await dbContext.CompanyMembers
            .AsNoTracking()
            .AnyAsync(x =>
                x.CompanyId == opportunity.CompanyId &&
                x.UserId == userId &&
                (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin || x.Role == CompanyMemberRole.Staff),
                cancellationToken);

        return isCompanyMember;
    }

    private async Task<ChatHistoryPageDto> BuildHistoryPageAsync(long chatId, long? beforeMessageId, int limit, CancellationToken cancellationToken)
    {
        var query = dbContext.ChatMessages.AsNoTracking().Where(x => x.ChatId == chatId);
        if (beforeMessageId is not null)
        {
            query = query.Where(x => x.Id < beforeMessageId.Value);
        }

        var chunk = await query
            .OrderByDescending(x => x.Id)
            .Take(limit + 1)
            .Select(x => new ChatMessageDto(
                x.Id,
                x.ChatId,
                x.SenderUserId,
                x.SenderUser.DisplayName,
                x.SenderUser.AvatarUrl,
                x.Text,
                x.IsSystem,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        var hasMore = chunk.Count > limit;
        if (hasMore)
        {
            chunk.RemoveAt(chunk.Count - 1);
        }

        var messages = chunk.OrderBy(x => x.Id).ToArray();
        var nextBeforeMessageId = hasMore && messages.Length > 0 ? (long?)messages[0].Id : null;
        return new ChatHistoryPageDto(chatId, messages, hasMore, nextBeforeMessageId);
    }

    private async Task InvalidateChatListForParticipants(long chatId, CancellationToken cancellationToken)
    {
        var participantIds = await dbContext.ChatParticipants
            .Where(x => x.ChatId == chatId)
            .Select(x => x.UserId)
            .ToArrayAsync(cancellationToken);

        foreach (var participantId in participantIds)
        {
            await chatCache.InvalidateUserListAsync(participantId, cancellationToken);
        }
    }

    private static ChatMessageDto ToDto(ChatMessageProjection projection) => new(
        projection.Id,
        projection.ChatId,
        projection.SenderUserId,
        projection.SenderDisplayName,
        projection.SenderAvatarUrl,
        projection.Text,
        projection.IsSystem,
        projection.CreatedAt);

    private static ChatLinkedCardDto? BuildLinkedCard(Chat chat, long currentUserId)
    {
        if (chat.Type == ChatType.Opportunity && chat.Opportunity is not null)
        {
            var opportunity = chat.Opportunity;
            return new ChatLinkedCardDto(
                "opportunity",
                new OpportunityLinkedCardDto(
                    opportunity.Id,
                    opportunity.Title,
                    opportunity.Kind,
                    opportunity.Format,
                    opportunity.Status,
                    opportunity.EventDate,
                    opportunity.PriceType,
                    opportunity.PriceAmount,
                    opportunity.PriceCurrencyCode),
                null,
                null);
        }

        if (chat.Type == ChatType.Application && chat.Application is not null)
        {
            var application = chat.Application;
            var vacancy = application.Vacancy;
            var vacancyCard = new VacancyLinkedCardDto(
                vacancy.Id,
                vacancy.Title,
                vacancy.Kind,
                vacancy.Format,
                vacancy.Status,
                vacancy.SalaryTaxMode,
                vacancy.SalaryFrom,
                vacancy.SalaryTo,
                vacancy.CurrencyCode);

            if (application.CandidateUserId == currentUserId)
            {
                return new ChatLinkedCardDto(
                    "application-seeker",
                    null,
                    null,
                    new ApplicationSeekerLinkedCardDto(
                        application.Id,
                        application.Status,
                        application.CreatedAt,
                        vacancyCard));
            }

            var resume = application.CandidateUser.CandidateProfile?.ResumeProfile;
            var candidateCard = new CandidateLinkedCardDto(
                application.CandidateUserId,
                application.CandidateUser.DisplayName,
                application.CandidateUser.AvatarUrl,
                resume?.Headline,
                resume?.DesiredPosition,
                resume?.SalaryFrom,
                resume?.SalaryTo,
                resume?.CurrencyCode);

            return new ChatLinkedCardDto(
                "application-employer",
                null,
                new ApplicationEmployerLinkedCardDto(
                    application.Id,
                    application.Status,
                    application.CreatedAt,
                    vacancyCard,
                    candidateCard),
                null);
        }

        return null;
    }

    private static string ResolveChatTitle(long currentUserId, ChatProjection chat)
    {
        if (chat.Type == ChatType.Opportunity)
        {
            return string.IsNullOrWhiteSpace(chat.OpportunityTitle) ? "Event chat" : chat.OpportunityTitle;
        }

        if (chat.Type == ChatType.Application)
        {
            if (chat.CandidateUserId == currentUserId)
            {
                return string.IsNullOrWhiteSpace(chat.ApplicationCompanyName) ? "Company" : chat.ApplicationCompanyName;
            }

            var candidate = chat.Participants.FirstOrDefault(x => x.UserId == chat.CandidateUserId);
            if (candidate is not null)
            {
                return FormatUserTitle(candidate);
            }

            if (!string.IsNullOrWhiteSpace(chat.ApplicationCompanyName))
            {
                return chat.ApplicationCompanyName;
            }
        }

        var other = chat.Participants.FirstOrDefault(x => x.UserId != currentUserId);
        return other is null ? "Chat" : FormatUserTitle(other);
    }

    private static string ResolveChatTitle(long currentUserId, Chat chat)
    {
        if (chat.Type == ChatType.Opportunity)
        {
            return string.IsNullOrWhiteSpace(chat.Opportunity?.Title) ? "Event chat" : chat.Opportunity.Title;
        }

        if (chat.Type == ChatType.Application)
        {
            if (chat.Application?.CandidateUserId == currentUserId)
            {
                var companyName = chat.Application.Company.BrandName ?? chat.Application.Company.LegalName;
                return string.IsNullOrWhiteSpace(companyName) ? "Company" : companyName;
            }

            var candidateParticipant = chat.Participants.FirstOrDefault(x => x.UserId == chat.Application?.CandidateUserId);
            if (candidateParticipant is not null)
            {
                return FormatUserTitle(new ChatParticipantProjection(
                    candidateParticipant.UserId,
                    candidateParticipant.User.DisplayName,
                    candidateParticipant.User.AvatarUrl,
                    candidateParticipant.User.CandidateProfile?.LastName,
                    candidateParticipant.User.CandidateProfile?.FirstName,
                    candidateParticipant.User.CandidateProfile?.MiddleName));
            }
        }

        var other = chat.Participants.FirstOrDefault(x => x.UserId != currentUserId);
        if (other is null)
        {
            return "Chat";
        }

        return FormatUserTitle(new ChatParticipantProjection(
            other.UserId,
            other.User.DisplayName,
            other.User.AvatarUrl,
            other.User.CandidateProfile?.LastName,
            other.User.CandidateProfile?.FirstName,
            other.User.CandidateProfile?.MiddleName));
    }

    private static string FormatUserTitle(ChatParticipantProjection participant)
    {
        if (!string.IsNullOrWhiteSpace(participant.LastName) && !string.IsNullOrWhiteSpace(participant.FirstName))
        {
            var firstInitial = char.ToUpperInvariant(participant.FirstName.Trim()[0]);
            char? middleInitial = string.IsNullOrWhiteSpace(participant.MiddleName)
                ? null
                : char.ToUpperInvariant(participant.MiddleName.Trim()[0]);

            return middleInitial is null
                ? $"{participant.LastName.Trim()} {firstInitial}."
                : $"{participant.LastName.Trim()} {firstInitial}.{middleInitial}.";
        }

        return string.IsNullOrWhiteSpace(participant.DisplayName) ? "User" : participant.DisplayName.Trim();
    }

    private sealed record ChatProjection(
        long Id,
        ChatType Type,
        DateTimeOffset CreatedAt,
        string? ApplicationCompanyName,
        long? CandidateUserId,
        string? OpportunityTitle,
        int ParticipantsCount,
        ChatParticipantProjection[] Participants,
        ChatMessageProjection? LastMessage);

    private sealed record ChatParticipantProjection(
        long UserId,
        string DisplayName,
        string? AvatarUrl,
        string? LastName,
        string? FirstName,
        string? MiddleName);

    private sealed record ChatMessageProjection(
        long Id,
        long ChatId,
        long SenderUserId,
        string SenderDisplayName,
        string? SenderAvatarUrl,
        string Text,
        bool IsSystem,
        DateTimeOffset CreatedAt);
}
