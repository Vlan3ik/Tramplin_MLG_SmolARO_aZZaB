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

/// <summary>
/// REST-операции модуля чатов.
/// Realtime-события передаются через SignalR hub /hubs/chat.
/// </summary>
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
    /// Поле <c>title</c> содержит:
    /// 1) для application-чата: название компании (для соискателя) или ФИО кандидата в формате "Иванов И.И." (для работодателя);
    /// 2) для direct-чата: ФИО второго участника в формате "Иванов И.И." (если доступен профиль кандидата), иначе displayName.
    /// Для снижения нагрузки используется Redis-кэш списка чатов пользователя.
    /// </remarks>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Список чатов с отображаемым названием, участниками и последним сообщением.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<ChatListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
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
                x.Participants.Select(p => new ChatParticipantProjection(
                    p.UserId,
                    p.User.DisplayName,
                    p.User.CandidateProfile != null ? p.User.CandidateProfile.LastName : null,
                    p.User.CandidateProfile != null ? p.User.CandidateProfile.FirstName : null,
                    p.User.CandidateProfile != null ? p.User.CandidateProfile.MiddleName : null))
                    .ToArray(),
                x.Messages
                    .OrderByDescending(m => m.CreatedAt)
                    .Select(m => new ChatMessageDto(m.Id, m.ChatId, m.SenderUserId, m.Text, m.IsSystem, m.CreatedAt))
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);

        var result = chats.Select(x => new ChatListItemDto(
                x.Id,
                x.Type,
                ResolveChatTitle(userId, x),
                x.Participants.Select(p => p.UserId).ToArray(),
                x.CreatedAt,
                x.LastMessage))
            .ToList();

        await chatCache.SetAsync(cacheKey, result, TimeSpan.FromSeconds(20), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Создает direct-чат между текущим пользователем и указанным пользователем.
    /// </summary>
    /// <remarks>
    /// Создание разрешено только при наличии общего контекста (совместная компания или связь через application).
    /// При наличии существующего direct-чата возвращается его идентификатор.
    /// </remarks>
    /// <param name="request">Идентификатор второго участника чата.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Идентификатор созданного или найденного чата.</returns>
    [HttpPost("direct")]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<object>> CreateDirectChat(CreateDirectChatRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (request.UserId == userId)
        {
            return this.ToBadRequestError("chats.direct.self", "Нельзя создать direct-чат с самим собой.");
        }

        var hasMutualContext =
            await dbContext.CompanyMembers.AnyAsync(x => x.UserId == userId &&
                dbContext.CompanyMembers.Any(y => y.CompanyId == x.CompanyId && y.UserId == request.UserId), cancellationToken)
            || await dbContext.Applications.AnyAsync(x =>
                (x.CandidateUserId == userId && dbContext.CompanyMembers.Any(m => m.CompanyId == x.CompanyId && m.UserId == request.UserId))
                || (x.CandidateUserId == request.UserId && dbContext.CompanyMembers.Any(m => m.CompanyId == x.CompanyId && m.UserId == userId)),
                cancellationToken);

        if (!hasMutualContext)
        {
            return this.ToBadRequestError("chats.direct.mutual_context_required", "Нельзя создать direct-чат без общего контекста.");
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
    /// Возвращает страницу истории сообщений чата для подгрузки вверх.
    /// </summary>
    /// <remarks>
    /// Сценарий infinite-scroll:
    /// 1) первый вызов без <c>beforeMessageId</c> вернет последние <c>limit</c> сообщений;
    /// 2) для подгрузки старых сообщений передайте <c>beforeMessageId = nextBeforeMessageId</c> из предыдущего ответа;
    /// 3) если <c>hasMore = false</c>, история загружена полностью.
    /// Для снижения нагрузки используется Redis-кэш страниц истории.
    /// </remarks>
    /// <param name="chatId">Идентификатор чата.</param>
    /// <param name="beforeMessageId">Курсор: вернуть сообщения с id меньше указанного.</param>
    /// <param name="limit">Размер страницы (1..200, по умолчанию 50).</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Страница истории с курсором для следующей подгрузки.</returns>
    [HttpGet("{chatId:long}/history")]
    [ProducesResponseType(typeof(ChatHistoryPageDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ChatHistoryPageDto>> GetHistory(
        long chatId,
        [FromQuery] long? beforeMessageId,
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        if (!await IsParticipant(chatId, userId, cancellationToken))
        {
            return this.ToNotFoundError("chats.not_found", "Чат не найден.");
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
    /// Возвращает сообщения чата с курсорной пагинацией "вперед".
    /// </summary>
    /// <remarks>
    /// Legacy endpoint для выборки новых сообщений (id &gt; cursor). Для подгрузки истории "вверх" используйте <c>GET /chats/{chatId}/history</c>.
    /// </remarks>
    /// <param name="chatId">Идентификатор чата.</param>
    /// <param name="cursor">Опциональный курсор: вернуть сообщения с id больше указанного.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Список сообщений чата (до 200 записей).</returns>
    [HttpGet("{chatId:long}/messages")]
    [ProducesResponseType(typeof(IReadOnlyCollection<ChatMessageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyCollection<ChatMessageDto>>> GetMessages(long chatId, [FromQuery] long? cursor, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (!await IsParticipant(chatId, userId, cancellationToken))
        {
            return this.ToNotFoundError("chats.not_found", "Чат не найден.");
        }

        var query = dbContext.ChatMessages.AsNoTracking().Where(x => x.ChatId == chatId);
        if (cursor is not null)
        {
            query = query.Where(x => x.Id > cursor);
        }

        var messages = await query
            .OrderBy(x => x.Id)
            .Take(200)
            .Select(x => new ChatMessageDto(x.Id, x.ChatId, x.SenderUserId, x.Text, x.IsSystem, x.CreatedAt))
            .ToListAsync(cancellationToken);
        return Ok(messages);
    }

    /// <summary>
    /// Отправляет сообщение в чат.
    /// </summary>
    /// <remarks>
    /// После сохранения сообщения публикуется realtime-событие <c>new</c> в группу чата.
    /// </remarks>
    /// <param name="chatId">Идентификатор чата.</param>
    /// <param name="request">Текст сообщения.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Созданное сообщение.</returns>
    [HttpPost("{chatId:long}/messages")]
    [ProducesResponseType(typeof(ChatMessageDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ChatMessageDto>> SendMessage(long chatId, SendChatMessageRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (!await IsParticipant(chatId, userId, cancellationToken))
        {
            return this.ToNotFoundError("chats.not_found", "Чат не найден.");
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

        var dto = new ChatMessageDto(message.Id, message.ChatId, message.SenderUserId, message.Text, message.IsSystem, message.CreatedAt);
        await hubContext.Clients.Group(ChatHub.GroupName(chatId)).SendAsync("new", dto, cancellationToken);
        return Created(string.Empty, dto);
    }

    /// <summary>
    /// Помечает сообщение как прочитанное текущим пользователем.
    /// </summary>
    /// <remarks>
    /// Если запись о прочтении уже существует, операция является идемпотентной.
    /// После фиксации отправляется realtime-событие <c>read</c>.
    /// </remarks>
    /// <param name="chatId">Идентификатор чата.</param>
    /// <param name="request">Идентификатор сообщения для отметки прочтения.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    [HttpPost("{chatId:long}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Read(long chatId, MarkChatReadRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (!await IsParticipant(chatId, userId, cancellationToken))
        {
            return this.ToNotFoundError("chats.not_found", "Чат не найден.");
        }

        var messageExists = await dbContext.ChatMessages.AnyAsync(x => x.Id == request.MessageId && x.ChatId == chatId, cancellationToken);
        if (!messageExists)
        {
            return this.ToNotFoundError("chats.message.not_found", "Сообщение не найдено.");
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

    private async Task<ChatHistoryPageDto> BuildHistoryPageAsync(
        long chatId,
        long? beforeMessageId,
        int limit,
        CancellationToken cancellationToken)
    {
        var query = dbContext.ChatMessages.AsNoTracking().Where(x => x.ChatId == chatId);
        if (beforeMessageId is not null)
        {
            query = query.Where(x => x.Id < beforeMessageId.Value);
        }

        var chunk = await query
            .OrderByDescending(x => x.Id)
            .Take(limit + 1)
            .Select(x => new ChatMessageDto(x.Id, x.ChatId, x.SenderUserId, x.Text, x.IsSystem, x.CreatedAt))
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

    private static string ResolveChatTitle(long currentUserId, ChatProjection chat)
    {
        if (chat.Type == ChatType.Application)
        {
            if (chat.CandidateUserId == currentUserId)
            {
                return string.IsNullOrWhiteSpace(chat.ApplicationCompanyName) ? "Компания" : chat.ApplicationCompanyName;
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
        return other is null ? "Чат" : FormatUserTitle(other);
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

        return string.IsNullOrWhiteSpace(participant.DisplayName) ? "Пользователь" : participant.DisplayName.Trim();
    }

    private sealed record ChatProjection(
        long Id,
        ChatType Type,
        DateTimeOffset CreatedAt,
        string? ApplicationCompanyName,
        long? CandidateUserId,
        ChatParticipantProjection[] Participants,
        ChatMessageDto? LastMessage);

    private sealed record ChatParticipantProjection(
        long UserId,
        string DisplayName,
        string? LastName,
        string? FirstName,
        string? MiddleName);
}
