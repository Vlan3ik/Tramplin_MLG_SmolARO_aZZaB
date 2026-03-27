using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Resumes;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[AllowAnonymous]
[Route("resumes")]
[Produces("application/json")]
public class ResumesController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<ResumeListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<ResumeListItemDto>>> GetList(
        [FromQuery] ResumeListQuery query,
        CancellationToken cancellationToken)
    {
        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);
        var viewerId = TryGetViewerId();
        var tagIds = (query.TagIds ?? [])
            .Where(x => x > 0)
            .Distinct()
            .ToArray();

        if (query.OnlyFollowed && viewerId is null)
        {
            return Ok(new PagedResponse<ResumeListItemDto>([], 0, page, pageSize));
        }

        var baseQuery = dbContext.CandidateProfiles
            .AsNoTracking()
            .Include(x => x.User)
            .Include(x => x.ResumeProfile)
            .Include(x => x.PrivacySettings)
            .Where(x =>
                x.ResumeProfile != null &&
                !string.IsNullOrEmpty(x.ResumeProfile.DesiredPosition));

        if (viewerId is null)
        {
            return Ok(new PagedResponse<ResumeListItemDto>([], 0, page, pageSize));
        }

        var currentViewerId = viewerId.Value;
        baseQuery = baseQuery.Where(x =>
            x.UserId == currentViewerId ||
            x.PrivacySettings == null ||
            x.PrivacySettings.ResumeVisibility == PrivacyScope.AuthorizedUsers ||
            (x.PrivacySettings.ResumeVisibility == PrivacyScope.ContactsOnly &&
             dbContext.UserContacts.Any(c => c.UserId == x.UserId && c.ContactUserId == currentViewerId)));

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            baseQuery = baseQuery.Where(x =>
                x.User.Fio.ToLower().Contains(term) ||
                x.User.Username.ToLower().Contains(term) ||
                (x.ResumeProfile!.Headline != null && x.ResumeProfile.Headline.ToLower().Contains(term)) ||
                (x.ResumeProfile.DesiredPosition != null && x.ResumeProfile.DesiredPosition.ToLower().Contains(term)) ||
                (x.ResumeProfile.Summary != null && x.ResumeProfile.Summary.ToLower().Contains(term)));
        }

        if (query.OpenToWork is not null)
        {
            baseQuery = query.OpenToWork.Value
                ? baseQuery.Where(x => x.PrivacySettings == null || x.PrivacySettings.OpenToWork)
                : baseQuery.Where(x => x.PrivacySettings != null && !x.PrivacySettings.OpenToWork);
        }

        if (query.SalaryFrom is not null)
        {
            var minSalary = query.SalaryFrom.Value;
            baseQuery = baseQuery.Where(x =>
                (x.ResumeProfile!.SalaryTo ?? x.ResumeProfile.SalaryFrom) != null &&
                (x.ResumeProfile.SalaryTo ?? x.ResumeProfile.SalaryFrom) >= minSalary);
        }

        if (query.SalaryTo is not null)
        {
            var maxSalary = query.SalaryTo.Value;
            baseQuery = baseQuery.Where(x =>
                x.ResumeProfile!.SalaryFrom != null &&
                x.ResumeProfile.SalaryFrom <= maxSalary);
        }

        if (tagIds.Length > 0)
        {
            baseQuery = baseQuery.Where(x =>
                dbContext.CandidateResumeSkills.Any(s =>
                    s.UserId == x.UserId &&
                    tagIds.Contains(s.TagId)));
        }

        if (query.OnlyFollowed && viewerId is not null)
        {
            var currentUserId = viewerId.Value;
            baseQuery = baseQuery.Where(x =>
                dbContext.UserSubscriptions.Any(s =>
                    s.FollowerUserId == currentUserId &&
                    s.FollowingUserId == x.UserId));
        }

        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var rows = await baseQuery
            .OrderByDescending(x => x.ResumeProfile!.UpdatedAt)
            .ThenBy(x => x.User.Fio)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.UserId,
                x.User.Username,
                x.User.Fio,
                x.User.AvatarUrl,
                x.ResumeProfile!.Headline,
                x.ResumeProfile.DesiredPosition,
                x.ResumeProfile.SalaryFrom,
                x.ResumeProfile.SalaryTo,
                x.ResumeProfile.CurrencyCode,
                x.ResumeProfile.UpdatedAt,
                OpenToWork = x.PrivacySettings != null && x.PrivacySettings.OpenToWork
            })
            .ToListAsync(cancellationToken);

        if (rows.Count == 0)
        {
            return Ok(new PagedResponse<ResumeListItemDto>([], totalCount, page, pageSize));
        }

        var userIds = rows.Select(x => x.UserId).ToArray();

        var skillRows = await dbContext.CandidateResumeSkills
            .AsNoTracking()
            .Include(x => x.Tag)
            .Where(x => userIds.Contains(x.UserId))
            .OrderByDescending(x => x.YearsExperience)
            .ThenBy(x => x.Tag.Name)
            .Select(x => new { x.UserId, x.TagId, x.Tag.Name })
            .ToListAsync(cancellationToken);

        var skillMap = skillRows
            .GroupBy(x => x.UserId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyCollection<ResumeSkillShortDto>)g
                    .Take(8)
                    .Select(x => new ResumeSkillShortDto(x.TagId, x.Name))
                    .ToArray());

        var followerRows = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => userIds.Contains(x.FollowingUserId))
            .GroupBy(x => x.FollowingUserId)
            .Select(x => new { UserId = x.Key, Count = x.Count() })
            .ToListAsync(cancellationToken);

        var followerMap = followerRows.ToDictionary(x => x.UserId, x => x.Count);

        HashSet<long> followedByViewer = [];
        if (viewerId is not null)
        {
            var currentUserId = viewerId.Value;
            var followedIds = await dbContext.UserSubscriptions
                .AsNoTracking()
                .Where(x => x.FollowerUserId == currentUserId && userIds.Contains(x.FollowingUserId))
                .Select(x => x.FollowingUserId)
                .ToListAsync(cancellationToken);

            followedByViewer = followedIds.ToHashSet();
        }

        var items = rows
            .Select(x => new ResumeListItemDto(
                x.UserId,
                x.Username,
                x.Fio,
                x.AvatarUrl,
                x.Headline,
                x.DesiredPosition,
                x.SalaryFrom,
                x.SalaryTo,
                x.CurrencyCode,
                x.OpenToWork,
                x.UpdatedAt,
                skillMap.GetValueOrDefault(x.UserId, []),
                followedByViewer.Contains(x.UserId),
                followerMap.GetValueOrDefault(x.UserId)))
            .ToArray();

        return Ok(new PagedResponse<ResumeListItemDto>(items, totalCount, page, pageSize));
    }

    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(ResumeDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ResumeDetailDto>> GetById(long id, CancellationToken cancellationToken)
    {
        var profile = await dbContext.CandidateProfiles
            .AsNoTracking()
            .Include(x => x.User)
            .Include(x => x.ResumeProfile)
            .Include(x => x.PrivacySettings)
            .FirstOrDefaultAsync(x => x.UserId == id, cancellationToken);
        if (profile is null)
        {
            return this.ToNotFoundError("resumes.not_found", "Резюме не найдено.");
        }

        if (profile.ResumeProfile is null)
        {
            return this.ToNotFoundError("resumes.not_found", "Резюме не найдено.");
        }

        var viewerId = TryGetViewerId();
        var privacy = profile.PrivacySettings ?? new CandidatePrivacySettings { UserId = profile.UserId };
        var canView = await CanViewResume(profile.UserId, viewerId, privacy.ResumeVisibility, cancellationToken);
        if (!canView)
        {
            return this.ToNotFoundError("resumes.not_found", "Резюме не найдено.");
        }

        var skills = await dbContext.CandidateResumeSkills
            .AsNoTracking()
            .Include(x => x.Tag)
            .Where(x => x.UserId == id)
            .OrderBy(x => x.Tag.Name)
            .Select(x => new ResumeSkillDto(x.TagId, x.Tag.Name, x.Level, x.YearsExperience))
            .ToListAsync(cancellationToken);

        var experiences = await dbContext.CandidateResumeExperiences
            .AsNoTracking()
            .Where(x => x.UserId == id)
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
            .Select(x => new ResumeExperienceDto(
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
            .Where(x => x.UserId == id)
            .Where(x => !x.IsPrivate || viewerId == id)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResumeProjectDto(x.Id, x.Title, x.Role, x.Description, x.StartDate, x.EndDate, x.RepoUrl, x.DemoUrl))
            .ToListAsync(cancellationToken);

        var education = await dbContext.CandidateResumeEducation
            .AsNoTracking()
            .Where(x => x.UserId == id)
            .OrderByDescending(x => x.GraduationYear)
            .Select(x => new ResumeEducationDto(x.Id, x.University, x.Faculty, x.Specialty, x.Course, x.GraduationYear))
            .ToListAsync(cancellationToken);

        var links = await dbContext.CandidateResumeLinks
            .AsNoTracking()
            .Where(x => x.UserId == id)
            .OrderBy(x => x.Id)
            .Select(x => new ResumeLinkDto(x.Id, x.Kind, x.Url, x.Label))
            .ToListAsync(cancellationToken);

        var dto = new ResumeDetailDto(
            profile.UserId,
            profile.User.Username,
            profile.Fio,
            profile.BirthDate,
            profile.Gender,
            privacy.ShowContactsInResume ? profile.Phone : null,
            profile.About,
            profile.User.AvatarUrl,
            profile.ResumeProfile.Headline,
            profile.ResumeProfile.DesiredPosition,
            profile.ResumeProfile.Summary,
            profile.ResumeProfile.SalaryFrom,
            profile.ResumeProfile.SalaryTo,
            profile.ResumeProfile.CurrencyCode,
            privacy.OpenToWork,
            skills,
            experiences,
            projects,
            education,
            links);

        return Ok(dto);
    }

    private long? TryGetViewerId()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return long.TryParse(id, out var value) ? value : null;
    }

    private async Task<bool> CanViewResume(long ownerUserId, long? viewerUserId, PrivacyScope scope, CancellationToken cancellationToken)
    {
        if (viewerUserId == ownerUserId)
        {
            return true;
        }

        if (viewerUserId is null)
        {
            return false;
        }

        return scope switch
        {
            PrivacyScope.Private => false,
            PrivacyScope.ContactsOnly => await dbContext.UserContacts.AnyAsync(
                x => x.UserId == ownerUserId && x.ContactUserId == viewerUserId.Value,
                cancellationToken),
            PrivacyScope.AuthorizedUsers => true,
            _ => false
        };
    }
}

