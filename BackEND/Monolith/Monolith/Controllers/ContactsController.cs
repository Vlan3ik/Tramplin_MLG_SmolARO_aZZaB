using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Contacts;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize]
[Route("contacts")]
[Produces("application/json")]
public class ContactsController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список контактов текущего авторизованного пользователя.
    /// </summary>
    /// <remarks>
    /// Метод возвращает только двусторонние связи из справочника контактов пользователя.
    /// Поле <c>userId</c> в элементах ответа используется как идентификатор контакта
    /// для операции удаления контакта <c>DELETE /contacts/{contactUserId}</c>.
    /// </remarks>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Коллекция контактов с идентификатором пользователя, username и ссылкой на аватар.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<ContactUserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyCollection<ContactUserDto>>> GetContacts(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var contacts = await dbContext.UserContacts
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => new ContactUserDto(x.ContactUserId, x.ContactUser.Username, x.ContactUser.AvatarUrl))
            .ToListAsync(cancellationToken);
        return Ok(contacts);
    }

    /// <summary>
    /// Создает исходящий запрос в контакты от текущего пользователя к целевому пользователю.
    /// </summary>
    /// <remarks>
    /// <c>targetUserId</c> — числовой <c>UserId</c> пользователя, которому отправляется запрос.
    /// Идентификатор можно получить из API профилей/контактов (например, из <c>GET /contacts</c>
    /// или из данных публичного профиля пользователя).
    /// При наличии встречного запроса со статусом Rejected он переоткрывается как новый Pending.
    /// </remarks>
    /// <param name="targetUserId">Идентификатор целевого пользователя (не может совпадать с id текущего пользователя).</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ со статусом 204 при успешном создании/переоткрытии запроса.</returns>
    [HttpPost("requests/{targetUserId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SendRequest(long targetUserId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (userId == targetUserId)
        {
            return this.ToBadRequestError("contacts.request.self", "Нельзя отправить запрос самому себе.");
        }

        if (!await dbContext.Users.AnyAsync(x => x.Id == targetUserId, cancellationToken))
        {
            return this.ToNotFoundError("contacts.target.not_found", "Пользователь не найден.");
        }

        if (await dbContext.UserContacts.AnyAsync(x => x.UserId == userId && x.ContactUserId == targetUserId, cancellationToken))
        {
            return this.ToConflictError("contacts.request.already_contact", "Пользователь уже в контактах.");
        }

        var existing = await dbContext.ContactRequests
            .FirstOrDefaultAsync(x =>
                (x.FromUserId == userId && x.ToUserId == targetUserId) ||
                (x.FromUserId == targetUserId && x.ToUserId == userId), cancellationToken);

        if (existing is not null && existing.Status == ContactRequestStatus.Pending)
        {
            return this.ToConflictError("contacts.request.pending_exists", "Запрос в контакты уже отправлен.");
        }

        if (existing is not null && existing.Status == ContactRequestStatus.Rejected)
        {
            existing.FromUserId = userId;
            existing.ToUserId = targetUserId;
            existing.Status = ContactRequestStatus.Pending;
            await dbContext.SaveChangesAsync(cancellationToken);
            return NoContent();
        }

        dbContext.ContactRequests.Add(new ContactRequest
        {
            FromUserId = userId,
            ToUserId = targetUserId,
            Status = ContactRequestStatus.Pending
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Возвращает входящие запросы в контакты для текущего пользователя.
    /// </summary>
    /// <remarks>
    /// В выборку попадают только запросы со статусом <c>Pending</c>, где текущий пользователь является получателем.
    /// Поле <c>id</c> в элементах ответа — это <c>requestId</c>, который используется
    /// в операциях <c>POST /contacts/requests/{requestId}/accept</c> и
    /// <c>POST /contacts/requests/{requestId}/reject</c>.
    /// </remarks>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Коллекция входящих заявок с участниками, статусом и временем создания.</returns>
    [HttpGet("requests/incoming")]
    [ProducesResponseType(typeof(IReadOnlyCollection<ContactRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyCollection<ContactRequestDto>>> GetIncoming(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var items = await dbContext.ContactRequests
            .AsNoTracking()
            .Where(x => x.ToUserId == userId && x.Status == ContactRequestStatus.Pending)
            .Include(x => x.FromUser)
            .Include(x => x.ToUser)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ContactRequestDto(
                x.Id,
                new ContactUserDto(x.FromUserId, x.FromUser.Username, x.FromUser.AvatarUrl),
                new ContactUserDto(x.ToUserId, x.ToUser.Username, x.ToUser.AvatarUrl),
                x.Status,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
        return Ok(items);
    }

    /// <summary>
    /// Возвращает исходящие запросы в контакты, отправленные текущим пользователем.
    /// </summary>
    /// <remarks>
    /// В выборку попадают только запросы со статусом <c>Pending</c>, где текущий пользователь является отправителем.
    /// Поле <c>id</c> в элементах ответа — это <c>requestId</c>, который используется
    /// в операциях обработки запроса получателем:
    /// <c>POST /contacts/requests/{requestId}/accept</c> и <c>POST /contacts/requests/{requestId}/reject</c>.
    /// </remarks>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Коллекция исходящих заявок с участниками, статусом и временем создания.</returns>
    [HttpGet("requests/outgoing")]
    [ProducesResponseType(typeof(IReadOnlyCollection<ContactRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyCollection<ContactRequestDto>>> GetOutgoing(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var items = await dbContext.ContactRequests
            .AsNoTracking()
            .Where(x => x.FromUserId == userId && x.Status == ContactRequestStatus.Pending)
            .Include(x => x.FromUser)
            .Include(x => x.ToUser)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ContactRequestDto(
                x.Id,
                new ContactUserDto(x.FromUserId, x.FromUser.Username, x.FromUser.AvatarUrl),
                new ContactUserDto(x.ToUserId, x.ToUser.Username, x.ToUser.AvatarUrl),
                x.Status,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
        return Ok(items);
    }

    /// <summary>
    /// Принимает входящий запрос в контакты и создает двустороннюю контактную связь.
    /// </summary>
    /// <remarks>
    /// <c>requestId</c> — идентификатор записи запроса в контакты (<c>ContactRequest.Id</c>).
    /// Для корректной обработки используйте id из <c>GET /contacts/requests/incoming</c>
    /// (или <c>GET /contacts/requests/outgoing</c> для диагностики состояния).
    /// Операция доступна только получателю запроса и только для статуса <c>Pending</c>.
    /// </remarks>
    /// <param name="requestId">Идентификатор запроса в контакты.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ со статусом 204 при успешном принятии запроса.</returns>
    [HttpPost("requests/{requestId:long}/accept")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Accept(long requestId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var request = await dbContext.ContactRequests.FirstOrDefaultAsync(x => x.Id == requestId, cancellationToken);
        if (request is null || request.ToUserId != userId)
        {
            return this.ToNotFoundError("contacts.request.not_found", "Запрос не найден.");
        }

        if (request.Status != ContactRequestStatus.Pending)
        {
            return this.ToConflictError("contacts.request.invalid_status", "Запрос уже обработан.");
        }

        request.Status = ContactRequestStatus.Accepted;
        if (!await dbContext.UserContacts.AnyAsync(x => x.UserId == request.FromUserId && x.ContactUserId == request.ToUserId, cancellationToken))
        {
            dbContext.UserContacts.Add(new UserContact { UserId = request.FromUserId, ContactUserId = request.ToUserId });
        }
        if (!await dbContext.UserContacts.AnyAsync(x => x.UserId == request.ToUserId && x.ContactUserId == request.FromUserId, cancellationToken))
        {
            dbContext.UserContacts.Add(new UserContact { UserId = request.ToUserId, ContactUserId = request.FromUserId });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Отклоняет входящий запрос в контакты.
    /// </summary>
    /// <remarks>
    /// <c>requestId</c> — идентификатор записи запроса в контакты (<c>ContactRequest.Id</c>).
    /// Идентификатор необходимо брать из списка входящих/исходящих заявок:
    /// <c>GET /contacts/requests/incoming</c> или <c>GET /contacts/requests/outgoing</c>.
    /// Операция доступна только получателю запроса и только для статуса <c>Pending</c>.
    /// </remarks>
    /// <param name="requestId">Идентификатор запроса в контакты.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ со статусом 204 при успешном отклонении запроса.</returns>
    [HttpPost("requests/{requestId:long}/reject")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Reject(long requestId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var request = await dbContext.ContactRequests.FirstOrDefaultAsync(x => x.Id == requestId, cancellationToken);
        if (request is null || request.ToUserId != userId)
        {
            return this.ToNotFoundError("contacts.request.not_found", "Запрос не найден.");
        }

        if (request.Status != ContactRequestStatus.Pending)
        {
            return this.ToConflictError("contacts.request.invalid_status", "Запрос уже обработан.");
        }

        request.Status = ContactRequestStatus.Rejected;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Удаляет пользователя из контактов текущего пользователя.
    /// </summary>
    /// <remarks>
    /// <c>contactUserId</c> — числовой <c>UserId</c> контакта, который нужно удалить.
    /// Значение берется из ответа <c>GET /contacts</c> (поле <c>userId</c>).
    /// Удаляются обе стороны связи: текущий пользователь → контакт и контакт → текущий пользователь.
    /// </remarks>
    /// <param name="contactUserId">Идентификатор пользователя-контакта.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ со статусом 204 при успешном удалении контакта.</returns>
    [HttpDelete("{contactUserId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Remove(long contactUserId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var links = await dbContext.UserContacts
            .Where(x =>
                (x.UserId == userId && x.ContactUserId == contactUserId) ||
                (x.UserId == contactUserId && x.ContactUserId == userId))
            .ToListAsync(cancellationToken);

        if (links.Count == 0)
        {
            return this.ToNotFoundError("contacts.not_found", "Контакт не найден.");
        }

        dbContext.UserContacts.RemoveRange(links);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
