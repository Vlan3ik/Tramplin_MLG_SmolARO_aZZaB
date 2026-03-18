using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Models.Common;
using Monolith.Models.Me;
using Monolith.Services.Common;
using Monolith.Entities;
using Monolith.Contexts;

namespace Monolith.Controllers;

[ApiController]
[Authorize]
[Route("me")]
[Produces("application/json")]
public class MeController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает краткие данные текущего пользователя и его роли.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Идентификатор, email, отображаемое имя и список ролей.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(MeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MeResponse>> GetMe(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return this.ToNotFoundError("me.user.not_found", "Пользователь не найден.");
        }

        var roles = await dbContext.UserRoles
            .Where(x => x.UserId == userId)
            .Select(x => x.Role.ToString().ToLowerInvariant())
            .ToListAsync(cancellationToken);

        return Ok(new MeResponse(user.Id, user.Email, user.DisplayName, user.AvatarUrl, roles));
    }

    /// <summary>
    /// Возвращает профиль соискателя текущего пользователя.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Профиль соискателя.</returns>
    [HttpGet("profile")]
    [ProducesResponseType(typeof(ProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ProfileResponse>> GetProfile(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var profile = await dbContext.CandidateProfiles
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return this.ToNotFoundError("me.profile.not_found", "Профиль соискателя не найден.");
        }

        return Ok(new ProfileResponse(
            profile.UserId,
            profile.User.DisplayName,
            profile.FirstName,
            profile.LastName,
            profile.MiddleName,
            profile.Phone,
            profile.About,
            profile.AvatarUrl));
    }

    /// <summary>
    /// Обновляет профиль соискателя текущего пользователя.
    /// </summary>
    /// <param name="request">Данные профиля для обновления.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Актуальный профиль после сохранения.</returns>
    [HttpPut("profile")]
    [ProducesResponseType(typeof(ProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ProfileResponse>> UpdateProfile(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var profile = await dbContext.CandidateProfiles
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (profile is null)
        {
            return this.ToNotFoundError("me.profile.not_found", "Профиль соискателя не найден.");
        }

        profile.User.DisplayName = request.DisplayName.Trim();
        profile.FirstName = request.FirstName.Trim();
        profile.LastName = request.LastName.Trim();
        profile.MiddleName = request.MiddleName?.Trim();
        profile.Phone = request.Phone?.Trim();
        profile.About = request.About?.Trim();
        profile.AvatarUrl = request.AvatarUrl?.Trim();
        profile.User.AvatarUrl = request.AvatarUrl?.Trim();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ProfileResponse(
            profile.UserId,
            profile.User.DisplayName,
            profile.FirstName,
            profile.LastName,
            profile.MiddleName,
            profile.Phone,
            profile.About,
            profile.AvatarUrl));
    }

    /// <summary>
    /// Возвращает настройки приватности и доступности пользователя.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Текущие настройки пользователя.</returns>
    [HttpGet("settings")]
    [ProducesResponseType(typeof(SettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<SettingsResponse>> GetSettings(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var settings = await dbContext.CandidatePrivacySettings.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (settings is null)
        {
            settings = new CandidatePrivacySettings { UserId = userId };
            dbContext.CandidatePrivacySettings.Add(settings);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(new SettingsResponse(
            settings.UserId,
            settings.ProfileVisibility,
            settings.ResumeVisibility,
            settings.OpenToWork,
            settings.ShowContactsInResume));
    }

    /// <summary>
    /// Обновляет настройки приватности и доступности пользователя.
    /// </summary>
    /// <param name="request">Новые настройки пользователя.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Актуальные настройки после сохранения.</returns>
    [HttpPut("settings")]
    [ProducesResponseType(typeof(SettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<SettingsResponse>> UpdateSettings(UpdateSettingsRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var settings = await dbContext.CandidatePrivacySettings.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (settings is null)
        {
            settings = new CandidatePrivacySettings { UserId = userId };
            dbContext.CandidatePrivacySettings.Add(settings);
        }

        settings.ProfileVisibility = request.ProfileVisibility;
        settings.ResumeVisibility = request.ResumeVisibility;
        settings.OpenToWork = request.OpenToWork;
        settings.ShowContactsInResume = request.ShowContactsInResume;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new SettingsResponse(
            settings.UserId,
            settings.ProfileVisibility,
            settings.ResumeVisibility,
            settings.OpenToWork,
            settings.ShowContactsInResume));
    }

    /// <summary>
    /// Возвращает резюме текущего пользователя.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Текущее резюме пользователя.</returns>
    [HttpGet("resume")]
    [ProducesResponseType(typeof(ResumeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ResumeResponse>> GetResume(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var resume = await dbContext.CandidateResumeProfiles.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (resume is null)
        {
            resume = new CandidateResumeProfile { UserId = userId };
            dbContext.CandidateResumeProfiles.Add(resume);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(new ResumeResponse(
            resume.UserId,
            resume.Headline,
            resume.DesiredPosition,
            resume.Summary,
            resume.SalaryFrom,
            resume.SalaryTo,
            resume.CurrencyCode));
    }

    /// <summary>
    /// Обновляет резюме текущего пользователя.
    /// </summary>
    /// <param name="request">Данные резюме для обновления.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Актуальное резюме после сохранения.</returns>
    [HttpPut("resume")]
    [ProducesResponseType(typeof(ResumeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ResumeResponse>> UpdateResume(UpdateResumeRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var resume = await dbContext.CandidateResumeProfiles.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (resume is null)
        {
            resume = new CandidateResumeProfile { UserId = userId };
            dbContext.CandidateResumeProfiles.Add(resume);
        }

        if (request.SalaryFrom is not null && request.SalaryTo is not null && request.SalaryTo < request.SalaryFrom)
        {
            return this.ToBadRequestError("me.resume.salary_range_invalid", "Значение salaryTo должно быть больше или равно salaryFrom.");
        }

        resume.Headline = request.Headline?.Trim();
        resume.DesiredPosition = request.DesiredPosition?.Trim();
        resume.Summary = request.Summary?.Trim();
        resume.SalaryFrom = request.SalaryFrom;
        resume.SalaryTo = request.SalaryTo;
        resume.CurrencyCode = request.CurrencyCode?.Trim().ToUpperInvariant();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ResumeResponse(
            resume.UserId,
            resume.Headline,
            resume.DesiredPosition,
            resume.Summary,
            resume.SalaryFrom,
            resume.SalaryTo,
            resume.CurrencyCode));
    }
}
