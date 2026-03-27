using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Employer;
using Monolith.Models.Media;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "employer")]
[Route("employer/company")]
[Produces("application/json")]
public class EmployerCompaniesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Создает черновик компании для текущего пользователя-работодателя.
    /// </summary>
    /// <param name="request">Базовые данные создаваемой компании.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Идентификатор созданной компании и ее текущий статус.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<object>> Create(CreateEmployerCompanyRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var alreadyMember = await dbContext.CompanyMembers.AnyAsync(x => x.UserId == userId, cancellationToken);
        if (alreadyMember)
        {
            return this.ToConflictError("companies.membership.exists", "User already belongs to a company.");
        }

        var company = new Company
        {
            LegalName = request.LegalName.Trim(),
            BrandName = string.IsNullOrWhiteSpace(request.BrandName) ? null : request.BrandName.Trim(),
            LogoUrl = string.IsNullOrWhiteSpace(request.LogoUrl) ? null : request.LogoUrl.Trim(),
            LegalType = CompanyLegalType.LegalEntity,
            TaxId = $"draft-{Guid.NewGuid():N}"[..20],
            RegistrationNumber = $"draft-{Guid.NewGuid():N}"[..20],
            Industry = "Not specified",
            Description = "Company draft",
            BaseCityId = 1,
            Status = CompanyStatus.Draft
        };
        dbContext.Companies.Add(company);
        await dbContext.SaveChangesAsync(cancellationToken);

        dbContext.CompanyMembers.Add(new CompanyMember
        {
            CompanyId = company.Id,
            UserId = userId,
            Role = CompanyMemberRole.Owner
        });

        dbContext.CompanyChatSettings.Add(new CompanyChatSettings
        {
            CompanyId = company.Id,
            AutoGreetingEnabled = false,
            WorkingHoursTimezone = "Europe/Moscow"
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetMine), new { }, new { companyId = company.Id, status = company.Status.ToString().ToLowerInvariant() });
    }

    /// <summary>
    /// Возвращает компанию текущего работодателя.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Карточка компании с настройками чата и ролью пользователя.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(EmployerCompanyResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployerCompanyResponse>> GetMine(CancellationToken cancellationToken)
    {
        var membership = await GetMembershipWithCompany(User.GetUserId(), cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company not found for current user.");
        }

        return Ok(ToEmployerCompanyResponse(membership));
    }

    /// <summary>
    /// Обновляет юридические и верификационные данные компании.
    /// </summary>
    /// <param name="request">Новые значения юридических и публичных полей.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешном обновлении.</returns>
    [HttpPatch("verification")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateVerification(UpdateCompanyVerificationRequest request, CancellationToken cancellationToken)
    {
        var company = await GetOwnedCompany(cancellationToken);
        if (company is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.verification.forbidden", "Only company owner can edit legal data."));
        }

        company.LegalName = request.LegalName.Trim();
        company.BrandName = string.IsNullOrWhiteSpace(request.BrandName) ? null : request.BrandName.Trim();
        company.LegalType = request.LegalType;
        company.TaxId = request.TaxId.Trim();
        company.RegistrationNumber = request.RegistrationNumber.Trim();
        company.Industry = request.Industry.Trim();
        company.Description = request.Description.Trim();
        company.BaseCityId = request.BaseCityId;
        company.WebsiteUrl = string.IsNullOrWhiteSpace(request.WebsiteUrl) ? null : request.WebsiteUrl.Trim();
        company.PublicEmail = string.IsNullOrWhiteSpace(request.PublicEmail) ? null : request.PublicEmail.Trim();
        company.PublicPhone = string.IsNullOrWhiteSpace(request.PublicPhone) ? null : request.PublicPhone.Trim();

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Отправляет компанию на верификацию.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешной отправке на проверку.</returns>
    [HttpPost("submit-verification")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SubmitVerification(CancellationToken cancellationToken)
    {
        var company = await GetOwnedCompany(cancellationToken);
        if (company is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.verification.forbidden", "Only company owner can submit verification."));
        }

        if (string.IsNullOrWhiteSpace(company.LegalName) ||
            string.IsNullOrWhiteSpace(company.TaxId) ||
            string.IsNullOrWhiteSpace(company.RegistrationNumber) ||
            string.IsNullOrWhiteSpace(company.Industry) ||
            string.IsNullOrWhiteSpace(company.Description) ||
            company.BaseCityId <= 0 ||
            (string.IsNullOrWhiteSpace(company.PublicEmail) && string.IsNullOrWhiteSpace(company.PublicPhone)))
        {
            return this.ToBadRequestError("companies.verification.required_fields", "Required verification fields are not filled.");
        }

        company.Status = CompanyStatus.PendingVerification;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Обновляет настройки чата компании.
    /// </summary>
    /// <param name="request">Новые параметры автосообщений и рабочего времени.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешном обновлении.</returns>
    [HttpPatch("chat-settings")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateChatSettings(UpdateCompanyChatSettingsRequest request, CancellationToken cancellationToken)
    {
        var company = await GetCompanyForManagement(cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company membership not found.");
        }

        var settings = await dbContext.CompanyChatSettings.FirstOrDefaultAsync(x => x.CompanyId == company.Id, cancellationToken)
            ?? new CompanyChatSettings { CompanyId = company.Id };

        settings.AutoGreetingEnabled = request.AutoGreetingEnabled;
        settings.AutoGreetingText = string.IsNullOrWhiteSpace(request.AutoGreetingText) ? null : request.AutoGreetingText.Trim();
        settings.OutsideHoursEnabled = request.OutsideHoursEnabled;
        settings.OutsideHoursText = string.IsNullOrWhiteSpace(request.OutsideHoursText) ? null : request.OutsideHoursText.Trim();
        settings.WorkingHoursTimezone = string.IsNullOrWhiteSpace(request.WorkingHoursTimezone) ? "Europe/Moscow" : request.WorkingHoursTimezone.Trim();
        settings.WorkingHoursFrom = request.WorkingHoursFrom;
        settings.WorkingHoursTo = request.WorkingHoursTo;

        if (dbContext.Entry(settings).State == EntityState.Detached)
        {
            dbContext.CompanyChatSettings.Add(settings);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Возвращает список участников компании.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Список участников компании с ролями.</returns>
    [HttpGet("members")]
    [ProducesResponseType(typeof(IReadOnlyCollection<EmployerCompanyMemberDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyCollection<EmployerCompanyMemberDto>>> GetMembers(CancellationToken cancellationToken)
    {
        var membership = await GetMembership(User.GetUserId(), cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company membership not found.");
        }

        var members = await dbContext.CompanyMembers
            .AsNoTracking()
            .Where(x => x.CompanyId == membership.CompanyId)
            .OrderBy(x => x.Role)
            .ThenBy(x => x.CreatedAt)
            .Select(x => new EmployerCompanyMemberDto(
                x.UserId,
                x.User.Email,
                x.User.Username,
                x.User.DisplayName,
                x.User.AvatarUrl,
                x.Role,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(members);
    }

    /// <summary>
    /// Передает роль владельца компании другому участнику.
    /// </summary>
    /// <param name="request">Идентификатор нового владельца.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешной передаче роли.</returns>
    [HttpPost("owner/transfer")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TransferOwner(TransferCompanyOwnerRequest request, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();
        var currentOwnerMembership = await dbContext.CompanyMembers
            .FirstOrDefaultAsync(x => x.UserId == currentUserId && x.Role == CompanyMemberRole.Owner, cancellationToken);
        if (currentOwnerMembership is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.owner_transfer.forbidden", "Only current owner can transfer ownership."));
        }

        if (request.NewOwnerUserId == currentUserId)
        {
            return this.ToBadRequestError("companies.owner_transfer.same_user", "New owner must be another user.");
        }

        var newOwnerMembership = await dbContext.CompanyMembers
            .FirstOrDefaultAsync(x => x.CompanyId == currentOwnerMembership.CompanyId && x.UserId == request.NewOwnerUserId, cancellationToken);
        if (newOwnerMembership is null)
        {
            return this.ToNotFoundError("companies.owner_transfer.target_not_found", "Target user is not a company member.");
        }

        if (newOwnerMembership.Role == CompanyMemberRole.Owner)
        {
            return NoContent();
        }

        var owners = await dbContext.CompanyMembers
            .Where(x => x.CompanyId == currentOwnerMembership.CompanyId && x.Role == CompanyMemberRole.Owner)
            .ToListAsync(cancellationToken);
        foreach (var owner in owners)
        {
            owner.Role = CompanyMemberRole.Admin;
        }

        newOwnerMembership.Role = CompanyMemberRole.Owner;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<Company?> GetOwnedCompany(CancellationToken cancellationToken)
    {
        var membership = await dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == User.GetUserId() && x.Role == CompanyMemberRole.Owner, cancellationToken);
        if (membership is null)
        {
            return null;
        }

        return await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == membership.CompanyId, cancellationToken);
    }

    private async Task<Company?> GetCompanyForManagement(CancellationToken cancellationToken)
    {
        var membership = await dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.UserId == User.GetUserId() &&
                     (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin),
                cancellationToken);
        if (membership is null)
        {
            return null;
        }

        return await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == membership.CompanyId, cancellationToken);
    }

    private Task<CompanyMember?> GetMembership(long userId, CancellationToken cancellationToken)
        => dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

    private Task<CompanyMember?> GetMembershipWithCompany(long userId, CancellationToken cancellationToken)
        => dbContext.CompanyMembers
            .AsNoTracking()
            .Include(x => x.Company)
                .ThenInclude(x => x.ChatSettings)
            .Include(x => x.Company)
                .ThenInclude(x => x.Media)
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

    private static EmployerCompanyResponse ToEmployerCompanyResponse(CompanyMember membership)
    {
        var c = membership.Company;
        var chatSettings = c.ChatSettings;
        return new EmployerCompanyResponse(
            c.Id,
            c.LegalName,
            c.BrandName,
            c.LegalType,
            c.TaxId,
            c.RegistrationNumber,
            c.Industry,
            c.Description,
            c.LogoUrl,
            c.WebsiteUrl,
            c.PublicEmail,
            c.PublicPhone,
            c.Media
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.Id)
                .Select(x => new CompanyMediaItemDto(
                    x.Id,
                    x.MediaType == CompanyMediaType.Video ? "video" : "image",
                    x.Url,
                    x.MimeType,
                    x.SortOrder))
                .ToArray(),
            c.BaseCityId,
            c.Status,
            membership.Role,
            new EmployerCompanyChatSettingsDto(
                chatSettings?.AutoGreetingEnabled == true,
                chatSettings?.AutoGreetingText,
                chatSettings?.OutsideHoursEnabled == true,
                chatSettings?.OutsideHoursText,
                chatSettings?.WorkingHoursTimezone ?? "Europe/Moscow",
                chatSettings?.WorkingHoursFrom,
                chatSettings?.WorkingHoursTo));
    }
}
