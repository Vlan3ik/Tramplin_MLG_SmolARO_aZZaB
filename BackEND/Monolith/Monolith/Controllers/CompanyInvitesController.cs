using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Employer;
using Monolith.Services.Common;

namespace Monolith.Controllers;

/// <summary>
/// Операции с приглашениями в компанию по токен-ссылке.
/// </summary>
[ApiController]
[Authorize]
[Produces("application/json")]
public class CompanyInvitesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Создает приглашение в компанию.
    /// </summary>
    /// <remarks>
    /// Доступно только участникам компании с ролью owner/admin.
    /// Возвращает токен и относительную ссылку приглашения.
    /// </remarks>
    /// <param name="companyId">Идентификатор компании.</param>
    /// <param name="request">Роль приглашенного участника и срок действия ссылки.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Данные созданного приглашения.</returns>
    [HttpPost("companies/{companyId:long}/invites")]
    [ProducesResponseType(typeof(CompanyInviteCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CompanyInviteCreatedResponse>> CreateInvite(long companyId, CreateCompanyInviteRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var membership = await dbContext.CompanyMembers
            .FirstOrDefaultAsync(x => x.CompanyId == companyId && x.UserId == userId, cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Участник компании не найден.");
        }

        if (membership.Role is not (CompanyMemberRole.Owner or CompanyMemberRole.Admin))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.invites.forbidden", "Недостаточно прав для приглашения сотрудников."));
        }

        var expiresDays = request.ExpiresInDays <= 0 ? 7 : Math.Min(request.ExpiresInDays, 30);
        var invite = new CompanyInvite
        {
            CompanyId = companyId,
            InvitedByUserId = userId,
            Role = request.Role,
            Token = Guid.NewGuid().ToString("N"),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(expiresDays)
        };
        dbContext.CompanyInvites.Add(invite);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Created(string.Empty, new CompanyInviteCreatedResponse(invite.Token, $"/invites/company/{invite.Token}", invite.ExpiresAt));
    }

    /// <summary>
    /// Принимает приглашение в компанию по токену.
    /// </summary>
    /// <remarks>
    /// Проверяет существование, срок действия и одноразовость приглашения.
    /// Пользователь может состоять только в одной компании.
    /// </remarks>
    /// <param name="token">Токен приглашения.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    [HttpPost("company-invites/{token}/accept")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Accept(string token, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var invite = await dbContext.CompanyInvites
            .FirstOrDefaultAsync(x => x.Token == token, cancellationToken);
        if (invite is null)
        {
            return this.ToNotFoundError("companies.invites.not_found", "Приглашение не найдено.");
        }

        if (invite.AcceptedAt is not null)
        {
            return this.ToConflictError("companies.invites.already_accepted", "Приглашение уже использовано.");
        }

        if (invite.ExpiresAt < DateTimeOffset.UtcNow)
        {
            return this.ToBadRequestError("companies.invites.expired", "Срок действия приглашения истек.");
        }

        var existingMembership = await dbContext.CompanyMembers.AnyAsync(x => x.UserId == userId, cancellationToken);
        if (existingMembership)
        {
            return this.ToConflictError("companies.membership.exists", "Пользователь уже состоит в компании.");
        }

        dbContext.CompanyMembers.Add(new CompanyMember
        {
            CompanyId = invite.CompanyId,
            UserId = userId,
            Role = invite.Role
        });
        invite.AcceptedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
