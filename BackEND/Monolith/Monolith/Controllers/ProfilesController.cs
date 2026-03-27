using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Me;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[AllowAnonymous]
[Route("profiles")]
[Produces("application/json")]
public class ProfilesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает публичный профиль кандидата по уникальному username.
    /// </summary>
    /// <remarks>
    /// Параметр маршрута <c>username</c> — это строковый логин пользователя, а не числовой идентификатор.
    /// Поиск выполняется по нормализованному значению username.
    /// В ответе применяются настройки приватности профиля: часть полей может быть скрыта
    /// для неавторизованных пользователей или пользователей вне контактов владельца профиля.
    /// </remarks>
    /// <param name="username">Уникальное имя пользователя (handle) из профиля.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Публичное представление профиля с учетом правил приватности.</returns>
    [HttpGet("{username}")]
    [ProducesResponseType(typeof(PublicProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicProfileResponse>> GetByUsername(string username, CancellationToken cancellationToken)
    {
        var normalized = UsernameGenerator.Normalize(username);
        var profile = await dbContext.CandidateProfiles
            .AsNoTracking()
            .Include(x => x.User)
            .Include(x => x.City)
            .FirstOrDefaultAsync(x => x.User.Username == normalized, cancellationToken);
        if (profile is null)
        {
            return this.ToNotFoundError("profiles.not_found", "Профиль не найден.");
        }

        var viewerId = GetViewerId();
        var isOwner = viewerId == profile.UserId;
        var isAuthorizedViewer = viewerId is not null;
        var isContact = viewerId is not null && await IsContact(profile.UserId, viewerId.Value, cancellationToken);

        var settings = await dbContext.CandidatePrivacySettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == profile.UserId, cancellationToken)
            ?? new CandidatePrivacySettings { UserId = profile.UserId };

        var canViewProfile = HasAccess(settings.ProfileVisibility, isOwner, isContact, isAuthorizedViewer);
        var canViewResume = HasAccess(settings.ResumeVisibility, isOwner, isContact, isAuthorizedViewer);

        var stats = await BuildStats(profile.UserId, cancellationToken);
        var resume = canViewResume ? await BuildResumeDetails(profile.UserId, cancellationToken) : null;

        return Ok(new PublicProfileResponse(
            profile.UserId,
            profile.User.Username,
            canViewProfile ? profile.Fio : string.Empty,
            canViewProfile ? profile.BirthDate : null,
            canViewProfile ? profile.Gender : null,
            canViewProfile && settings.ShowContactsInResume ? profile.Phone : null,
            canViewProfile ? profile.CityId : null,
            canViewProfile ? profile.City?.CityName : null,
            canViewProfile ? profile.About : null,
            canViewProfile ? profile.AvatarUrl : null,
            canViewProfile ? profile.User.ProfileBannerUrl : null,
            resume,
            stats,
            canViewProfile ? "visible" : "hidden"));
    }

    private long? GetViewerId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return long.TryParse(id, out var value) ? value : null;
    }

    private async Task<bool> IsContact(long ownerUserId, long viewerUserId, CancellationToken cancellationToken)
    {
        return await dbContext.UserContacts.AnyAsync(
            x => x.UserId == ownerUserId && x.ContactUserId == viewerUserId,
            cancellationToken);
    }

    private static bool HasAccess(PrivacyScope scope, bool isOwner, bool isContact, bool isAuthorizedViewer)
    {
        if (isOwner)
        {
            return true;
        }

        return scope switch
        {
            PrivacyScope.Private => false,
            PrivacyScope.ContactsOnly => isContact,
            PrivacyScope.AuthorizedUsers => isAuthorizedViewer,
            _ => false
        };
    }

    private async Task<ProfileStatsResponse> BuildStats(long userId, CancellationToken cancellationToken)
    {
        var applications = await dbContext.Applications
            .AsNoTracking()
            .Where(x => x.CandidateUserId == userId)
            .Select(x => new { x.Status, VacancyKind = x.Vacancy.Kind })
            .ToListAsync(cancellationToken);

        var participationsCount = await dbContext.OpportunityParticipants
            .AsNoTracking()
            .CountAsync(x => x.UserId == userId, cancellationToken);

        return new ProfileStatsResponse(
            applications.Count,
            applications.Count(x => x.Status == ApplicationStatus.New),
            applications.Count(x => x.Status == ApplicationStatus.InReview),
            applications.Count(x => x.Status == ApplicationStatus.Interview),
            applications.Count(x => x.Status == ApplicationStatus.Offer),
            applications.Count(x => x.Status == ApplicationStatus.Hired),
            applications.Count(x => x.Status == ApplicationStatus.Rejected),
            applications.Count(x => x.Status == ApplicationStatus.Canceled),
            applications.Count(x => x.Status == ApplicationStatus.Hired && x.VacancyKind == VacancyKind.Internship),
            applications.Count(x => x.Status == ApplicationStatus.Hired && x.VacancyKind == VacancyKind.Job),
            participationsCount);
    }

    private async Task<ResumeDetailsResponse> BuildResumeDetails(long userId, CancellationToken cancellationToken)
    {
        var resume = await dbContext.CandidateResumeProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken)
            ?? new CandidateResumeProfile { UserId = userId };

        var skills = await dbContext.CandidateResumeSkills
            .AsNoTracking()
            .Include(x => x.Tag)
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.Tag.Name)
            .Select(x => new ResumeSkillItemDto(x.TagId, x.Tag.Name, x.Level, x.YearsExperience))
            .ToListAsync(cancellationToken);
        var experiences = await dbContext.CandidateResumeExperiences
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => new
            {
                x.Id,
                x.CompanyId,
                x.CompanyName,
                x.Position,
                x.Description,
                x.StartDate,
                x.EndDate,
                x.IsCurrent,
                LinkedCompanyName = x.Company != null ? (x.Company.BrandName ?? x.Company.LegalName) : null
            })
            .OrderByDescending(x => x.IsCurrent)
            .ThenByDescending(x => x.EndDate)
            .ThenByDescending(x => x.StartDate)
            .ThenByDescending(x => x.Id)
            .Select(x => new ResumeExperienceItemDto(
                x.Id,
                x.CompanyId,
                x.LinkedCompanyName ?? x.CompanyName ?? "Компания не указана",
                x.Position,
                x.Description,
                x.StartDate,
                x.EndDate,
                x.IsCurrent))
            .ToListAsync(cancellationToken);
        var projects = await dbContext.CandidateResumeProjects
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Where(x => !x.IsPrivate)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResumeProjectItemDto(x.Id, x.Title, x.Role, x.Description, x.StartDate, x.EndDate, x.RepoUrl, x.DemoUrl, x.IsPrivate))
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
            experiences,
            projects,
            education,
            links);
    }
}
