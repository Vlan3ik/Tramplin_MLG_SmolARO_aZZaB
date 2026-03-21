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

        return Ok(new MeResponse(user.Id, user.Email, user.Username, user.AvatarUrl, user.ProfileBannerUrl, roles));
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
            profile.User.Username,
            profile.FirstName,
            profile.LastName,
            profile.MiddleName,
            profile.BirthDate,
            profile.Gender,
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

        profile.FirstName = request.FirstName.Trim();
        profile.LastName = request.LastName.Trim();
        profile.User.DisplayName = $"{profile.FirstName} {profile.LastName}".Trim();
        profile.MiddleName = request.MiddleName?.Trim();
        profile.BirthDate = request.BirthDate;
        profile.Gender = request.Gender ?? CandidateGender.Unknown;
        profile.Phone = request.Phone?.Trim();
        profile.About = request.About?.Trim();
        profile.AvatarUrl = request.AvatarUrl?.Trim();
        profile.User.AvatarUrl = request.AvatarUrl?.Trim();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ProfileResponse(
            profile.UserId,
            profile.User.Username,
            profile.FirstName,
            profile.LastName,
            profile.MiddleName,
            profile.BirthDate,
            profile.Gender,
            profile.Phone,
            profile.About,
            profile.AvatarUrl));
    }

    /// <summary>
    /// Изменяет username текущего пользователя.
    /// </summary>
    [HttpPatch("username")]
    [ProducesResponseType(typeof(UsernameResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UsernameResponse>> UpdateUsername(UpdateUsernameRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return this.ToUnauthorizedError("me.user.unauthorized", "Пользователь не авторизован.");
        }

        var normalized = UsernameGenerator.Normalize(request.Username);
        if (string.IsNullOrWhiteSpace(normalized) || normalized.Length < 3)
        {
            return this.ToBadRequestError("me.username.invalid", "Username должен содержать не менее 3 символов латиницы/цифр.");
        }

        var exists = await dbContext.Users.AnyAsync(x => x.Id != userId && x.Username == normalized, cancellationToken);
        if (exists)
        {
            return this.ToConflictError("me.username.exists", "Username уже занят.");
        }

        user.Username = normalized;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new UsernameResponse(user.Username));
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

    /// <summary>
    /// Возвращает подробные секции резюме текущего пользователя.
    /// </summary>
    [HttpGet("resume/details")]
    [ProducesResponseType(typeof(ResumeDetailsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ResumeDetailsResponse>> GetResumeDetails(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        await EnsureResumeExists(userId, cancellationToken);
        return Ok(await BuildResumeDetails(userId, cancellationToken));
    }

    /// <summary>
    /// Обновляет подробные секции резюме текущего пользователя.
    /// </summary>
    [HttpPut("resume/details")]
    [ProducesResponseType(typeof(ResumeDetailsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ResumeDetailsResponse>> UpdateResumeDetails(UpdateResumeDetailsRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var resume = await EnsureResumeExists(userId, cancellationToken);

        if (request.SalaryFrom is not null && request.SalaryTo is not null && request.SalaryTo < request.SalaryFrom)
        {
            return this.ToBadRequestError("me.resume.salary_range_invalid", "Значение salaryTo должно быть больше или равно salaryFrom.");
        }

        var requestedTagIds = request.Skills.Select(x => x.TagId).Distinct().ToArray();
        if (requestedTagIds.Length > 0)
        {
            var existingTagIds = await dbContext.Tags
                .Where(x => requestedTagIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToArrayAsync(cancellationToken);
            if (existingTagIds.Length != requestedTagIds.Length)
            {
                return this.ToBadRequestError("me.resume.skills.tag_not_found", "Один или несколько tagId не найдены.");
            }
        }

        await using var tx = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        resume.Headline = request.Headline?.Trim();
        resume.DesiredPosition = request.DesiredPosition?.Trim();
        resume.Summary = request.Summary?.Trim();
        resume.SalaryFrom = request.SalaryFrom;
        resume.SalaryTo = request.SalaryTo;
        resume.CurrencyCode = request.CurrencyCode?.Trim().ToUpperInvariant();

        var oldSkills = await dbContext.CandidateResumeSkills.Where(x => x.UserId == userId).ToListAsync(cancellationToken);
        var oldProjects = await dbContext.CandidateResumeProjects.Where(x => x.UserId == userId).ToListAsync(cancellationToken);
        var oldEducation = await dbContext.CandidateResumeEducation.Where(x => x.UserId == userId).ToListAsync(cancellationToken);
        var oldLinks = await dbContext.CandidateResumeLinks.Where(x => x.UserId == userId).ToListAsync(cancellationToken);

        dbContext.CandidateResumeSkills.RemoveRange(oldSkills);
        dbContext.CandidateResumeProjects.RemoveRange(oldProjects);
        dbContext.CandidateResumeEducation.RemoveRange(oldEducation);
        dbContext.CandidateResumeLinks.RemoveRange(oldLinks);

        dbContext.CandidateResumeSkills.AddRange(request.Skills
            .DistinctBy(x => x.TagId)
            .Select(x => new CandidateResumeSkill
            {
                UserId = userId,
                TagId = x.TagId,
                Level = x.Level,
                YearsExperience = x.YearsExperience
            }));

        dbContext.CandidateResumeProjects.AddRange(request.Projects.Select(x => new CandidateResumeProject
        {
            UserId = userId,
            Title = x.Title.Trim(),
            Role = x.Role?.Trim(),
            Description = x.Description?.Trim(),
            StartDate = x.StartDate,
            EndDate = x.EndDate,
            RepoUrl = x.RepoUrl?.Trim(),
            DemoUrl = x.DemoUrl?.Trim()
        }));

        dbContext.CandidateResumeEducation.AddRange(request.Education.Select(x => new CandidateResumeEducation
        {
            UserId = userId,
            University = x.University.Trim(),
            Faculty = x.Faculty?.Trim(),
            Specialty = x.Specialty?.Trim(),
            Course = x.Course,
            GraduationYear = x.GraduationYear
        }));

        dbContext.CandidateResumeLinks.AddRange(request.Links.Select(x => new CandidateResumeLink
        {
            UserId = userId,
            Kind = x.Kind.Trim().ToLowerInvariant(),
            Url = x.Url.Trim(),
            Label = x.Label?.Trim()
        }));

        await dbContext.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return Ok(await BuildResumeDetails(userId, cancellationToken));
    }

    private async Task<CandidateResumeProfile> EnsureResumeExists(long userId, CancellationToken cancellationToken)
    {
        var resume = await dbContext.CandidateResumeProfiles.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (resume is not null)
        {
            return resume;
        }

        resume = new CandidateResumeProfile { UserId = userId };
        dbContext.CandidateResumeProfiles.Add(resume);
        await dbContext.SaveChangesAsync(cancellationToken);
        return resume;
    }

    private async Task<ResumeDetailsResponse> BuildResumeDetails(long userId, CancellationToken cancellationToken)
    {
        var resume = await dbContext.CandidateResumeProfiles.AsNoTracking().FirstAsync(x => x.UserId == userId, cancellationToken);
        var skills = await dbContext.CandidateResumeSkills
            .AsNoTracking()
            .Include(x => x.Tag)
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.Tag.Name)
            .Select(x => new ResumeSkillItemDto(x.TagId, x.Tag.Name, x.Level, x.YearsExperience))
            .ToListAsync(cancellationToken);
        var projects = await dbContext.CandidateResumeProjects
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResumeProjectItemDto(x.Id, x.Title, x.Role, x.Description, x.StartDate, x.EndDate, x.RepoUrl, x.DemoUrl))
            .ToListAsync(cancellationToken);
        var education = await dbContext.CandidateResumeEducation
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.GraduationYear)
            .Select(x => new ResumeEducationItemDto(x.Id, x.University, x.Faculty, x.Specialty, x.Course, x.GraduationYear))
            .ToListAsync(cancellationToken);
        var links = await dbContext.CandidateResumeLinks
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.Id)
            .Select(x => new ResumeLinkItemDto(x.Id, x.Kind, x.Url, x.Label))
            .ToListAsync(cancellationToken);

        return new ResumeDetailsResponse(
            userId,
            resume.Headline,
            resume.DesiredPosition,
            resume.Summary,
            resume.SalaryFrom,
            resume.SalaryTo,
            resume.CurrencyCode,
            skills,
            projects,
            education,
            links);
    }
}
