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
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<ContactUserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyCollection<ContactUserDto>>> GetContacts(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var contacts = await dbContext.UserContacts
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => new ContactUserDto(x.ContactUserId, x.ContactUser.Username, x.ContactUser.DisplayName, x.ContactUser.AvatarUrl))
            .ToListAsync(cancellationToken);
        return Ok(contacts);
    }

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
                new ContactUserDto(x.FromUserId, x.FromUser.Username, x.FromUser.DisplayName, x.FromUser.AvatarUrl),
                new ContactUserDto(x.ToUserId, x.ToUser.Username, x.ToUser.DisplayName, x.ToUser.AvatarUrl),
                x.Status,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
        return Ok(items);
    }

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
                new ContactUserDto(x.FromUserId, x.FromUser.Username, x.FromUser.DisplayName, x.FromUser.AvatarUrl),
                new ContactUserDto(x.ToUserId, x.ToUser.Username, x.ToUser.DisplayName, x.ToUser.AvatarUrl),
                x.Status,
                x.CreatedAt))
            .ToListAsync(cancellationToken);
        return Ok(items);
    }

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
