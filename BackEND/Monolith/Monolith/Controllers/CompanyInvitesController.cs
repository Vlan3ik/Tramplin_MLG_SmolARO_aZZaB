using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Employer;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "employer")]
[Route("employer/company")]
[Produces("application/json")]
public class CompanyInvitesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Создает одноразовую ссылку-приглашение в компанию.
    /// </summary>
    /// <param name="request">Параметры срока действия приглашения.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Токен приглашения, относительная ссылка и срок действия.</returns>
    [HttpPost("invites")]
    [ProducesResponseType(typeof(CompanyInviteCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<CompanyInviteCreatedResponse>> CreateInvite(CreateCompanyInviteRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var membership = await dbContext.CompanyMembers
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company membership not found.");
        }

        if (membership.Role is not (CompanyMemberRole.Owner or CompanyMemberRole.Admin))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.invites.forbidden", "Insufficient permissions for invite creation."));
        }

        var isPermanentInvite = request.ExpiresInDays == 0;
        var expiresAt = isPermanentInvite
            ? DateTimeOffset.UtcNow.AddYears(100)
            : DateTimeOffset.UtcNow.AddDays(request.ExpiresInDays <= 0 ? 7 : Math.Min(request.ExpiresInDays, 30));
        var invite = new CompanyInvite
        {
            CompanyId = membership.CompanyId,
            InvitedByUserId = userId,
            Role = CompanyMemberRole.Admin,
            Token = Guid.NewGuid().ToString("N"),
            ExpiresAt = expiresAt
        };

        dbContext.CompanyInvites.Add(invite);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Created(string.Empty, new CompanyInviteCreatedResponse(
            invite.Token,
            $"/employer/company/invites/{invite.Token}/accept",
            invite.ExpiresAt,
            invite.Role));
    }

    /// <summary>
    /// Принимает одноразовое приглашение в компанию.
    /// </summary>
    /// <param name="token">Токен приглашения из ссылки.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешном вступлении в компанию.</returns>
    [HttpPost("invites/{token}/accept")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Accept(string token, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var invite = await dbContext.CompanyInvites
            .FirstOrDefaultAsync(x => x.Token == token, cancellationToken);
        if (invite is null)
        {
            return this.ToNotFoundError("companies.invites.not_found", "Invite not found.");
        }

        if (invite.AcceptedAt is not null)
        {
            return this.ToConflictError("companies.invites.already_accepted", "Invite is already used.");
        }

        if (invite.ExpiresAt < DateTimeOffset.UtcNow)
        {
            return this.ToBadRequestError("companies.invites.expired", "Invite is expired.");
        }

        var existingMembership = await dbContext.CompanyMembers.AnyAsync(x => x.UserId == userId, cancellationToken);
        if (existingMembership)
        {
            return this.ToConflictError("companies.membership.exists", "User already belongs to company.");
        }

        dbContext.CompanyMembers.Add(new CompanyMember
        {
            CompanyId = invite.CompanyId,
            UserId = userId,
            Role = CompanyMemberRole.Admin
        });

        invite.AcceptedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
