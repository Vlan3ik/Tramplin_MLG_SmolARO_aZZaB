using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Hubs;
using Monolith.Models.Chat;
using Monolith.Models.Common;
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
public class ChatsController(AppDbContext dbContext, IHubContext<ChatHub> hubContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список чатов текущего пользователя.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Список чатов с последним сообщением и участниками.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<ChatListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyCollection<ChatListItemDto>>> GetMyChats(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var chats = await dbContext.ChatParticipants
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => x.Chat)
            .Include(x => x.Participants)
            .Include(x => x.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var result = chats.Select(x =>
        {
            var last = x.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault();
            return new ChatListItemDto(
                x.Id,
                x.Type,
                x.Participants.Select(p => p.UserId).ToArray(),
                x.CreatedAt,
                last is null ? null : new ChatMessageDto(last.Id, last.ChatId, last.SenderUserId, last.Text, last.IsSystem, last.CreatedAt));
        }).ToList();

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
        return Created(string.Empty, new { chatId = chat.Id });
    }

    /// <summary>
    /// Возвращает сообщения чата с курсорной пагинацией.
    /// </summary>
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
}
