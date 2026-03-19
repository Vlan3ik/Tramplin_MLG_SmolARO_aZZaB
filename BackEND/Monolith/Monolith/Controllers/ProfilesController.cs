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
    [HttpGet("{username}")]
    [ProducesResponseType(typeof(PublicProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicProfileResponse>> GetByUsername(string username, CancellationToken cancellationToken)
    {
        var normalized = UsernameGenerator.Normalize(username);
        var profile = await dbContext.CandidateProfiles
            .AsNoTracking()
            .Include(x => x.User)
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
            canViewProfile ? profile.FirstName : string.Empty,
            canViewProfile ? profile.LastName : string.Empty,
            canViewProfile ? profile.MiddleName : null,
            canViewProfile && settings.ShowContactsInResume ? profile.Phone : null,
            canViewProfile ? profile.About : null,
            canViewProfile ? profile.AvatarUrl : null,
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
            .Select(x => new { x.Status, OpportunityType = x.Opportunity != null ? x.Opportunity.OppType : (OpportunityType?)null })
            .ToListAsync(cancellationToken);

        return new ProfileStatsResponse(
            applications.Count,
            applications.Count(x => x.Status == ApplicationStatus.Open),
            applications.Count(x => x.Status == ApplicationStatus.Closed),
            applications.Count(x => x.Status == ApplicationStatus.Rejected),
            applications.Count(x => x.Status == ApplicationStatus.Closed && x.OpportunityType == OpportunityType.Internship),
            applications.Count(x => x.Status == ApplicationStatus.Closed && x.OpportunityType == OpportunityType.CareerEvent),
            applications.Count(x => x.Status == ApplicationStatus.Closed && x.OpportunityType == OpportunityType.MentorshipProgram));
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
