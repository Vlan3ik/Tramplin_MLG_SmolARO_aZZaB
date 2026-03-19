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
/// Операции работодателя со своей компанией.
/// </summary>
[ApiController]
[Authorize(Roles = "employer")]
[Route("employer/company")]
[Produces("application/json")]
public class EmployerCompaniesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Создает черновик компании для текущего работодателя.
    /// </summary>
    /// <remarks>
    /// Пользователь может состоять только в одной компании.
    /// При создании добавляется owner membership и базовые настройки чата.
    /// </remarks>
    /// <param name="request">Минимальные данные компании на этапе черновика.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Идентификатор созданной компании и статус.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<object>> Create(CreateEmployerCompanyRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var alreadyMember = await dbContext.CompanyMembers.AnyAsync(x => x.UserId == userId, cancellationToken);
        if (alreadyMember)
        {
            return this.ToConflictError("companies.membership.exists", "Пользователь уже состоит в компании.");
        }

        var company = new Company
        {
            LegalName = request.LegalName.Trim(),
            BrandName = string.IsNullOrWhiteSpace(request.BrandName) ? null : request.BrandName.Trim(),
            LogoUrl = string.IsNullOrWhiteSpace(request.LogoUrl) ? null : request.LogoUrl.Trim(),
            LegalType = CompanyLegalType.LegalEntity,
            TaxId = $"draft-{Guid.NewGuid():N}"[..20],
            RegistrationNumber = $"draft-{Guid.NewGuid():N}"[..20],
            Industry = "Не указано",
            Description = "Черновик компании",
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
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Карточка компании, роль участника и настройки чата.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<object>> GetMine(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var membership = await dbContext.CompanyMembers
            .Include(x => x.Company)
            .ThenInclude(x => x.ChatSettings)
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Компания пользователя не найдена.");
        }

        var c = membership.Company;
        return Ok(new
        {
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
            c.BaseCityId,
            status = c.Status.ToString().ToLowerInvariant(),
            membershipRole = membership.Role.ToString().ToLowerInvariant(),
            chatSettings = c.ChatSettings
        });
    }

    /// <summary>
    /// Обновляет данные компании для прохождения верификации.
    /// </summary>
    /// <remarks>
    /// Доступно ролям company owner/admin.
    /// </remarks>
    /// <param name="request">Юридические и публичные данные компании.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    [HttpPatch("verification")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateVerification(UpdateCompanyVerificationRequest request, CancellationToken cancellationToken)
    {
        var company = await GetEditableCompany(cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Компания пользователя не найдена.");
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
    /// <remarks>
    /// Проверяет обязательные поля: legalName, legalType, taxId, registrationNumber, industry, description,
    /// baseCityId и хотя бы один публичный контакт (email или phone).
    /// </remarks>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    [HttpPost("submit-verification")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SubmitVerification(CancellationToken cancellationToken)
    {
        var company = await GetEditableCompany(cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Компания пользователя не найдена.");
        }

        if (string.IsNullOrWhiteSpace(company.LegalName) ||
            string.IsNullOrWhiteSpace(company.TaxId) ||
            string.IsNullOrWhiteSpace(company.RegistrationNumber) ||
            string.IsNullOrWhiteSpace(company.Industry) ||
            string.IsNullOrWhiteSpace(company.Description) ||
            company.BaseCityId <= 0 ||
            (string.IsNullOrWhiteSpace(company.PublicEmail) && string.IsNullOrWhiteSpace(company.PublicPhone)))
        {
            return this.ToBadRequestError("companies.verification.required_fields", "Не заполнены обязательные поля верификации компании.");
        }

        company.Status = CompanyStatus.PendingVerification;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Обновляет настройки чата компании (авто-приветствие и рабочие часы).
    /// </summary>
    /// <param name="request">Новые значения настроек чата.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    [HttpPatch("chat-settings")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateChatSettings(UpdateCompanyChatSettingsRequest request, CancellationToken cancellationToken)
    {
        var company = await GetEditableCompany(cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Компания пользователя не найдена.");
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

    private async Task<Company?> GetEditableCompany(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var membership = await dbContext.CompanyMembers
            .FirstOrDefaultAsync(x => x.UserId == userId && (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin), cancellationToken);
        if (membership is null)
        {
            return null;
        }

        return await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == membership.CompanyId, cancellationToken);
    }
}
