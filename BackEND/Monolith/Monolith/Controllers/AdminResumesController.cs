using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Admin;
using Monolith.Models.Common;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "curator,admin")]
[Route("admin/resumes")]
[Produces("application/json")]
public class AdminResumesController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminResumeListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<AdminResumeListItemDto>>> GetList(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = page <= 0 ? 1 : page;
        var safePageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        var query = dbContext.CandidateResumeProfiles
            .AsNoTracking()
            .Join(
                dbContext.CandidateProfiles.AsNoTracking(),
                resume => resume.UserId,
                profile => profile.UserId,
                (resume, profile) => new { resume, profile })
            .Join(
                dbContext.Users.AsNoTracking(),
                item => item.resume.UserId,
                user => user.Id,
                (item, user) => new { item.resume, item.profile, user })
            .GroupJoin(
                dbContext.CandidatePrivacySettings.AsNoTracking(),
                item => item.resume.UserId,
                privacy => privacy.UserId,
                (item, privacy) => new { item.resume, item.profile, item.user, privacy = privacy.FirstOrDefault() });

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.user.Email.ToLower().Contains(term) ||
                x.user.Username.ToLower().Contains(term) ||
                x.profile.Fio.ToLower().Contains(term) ||
                (x.resume.Headline != null && x.resume.Headline.ToLower().Contains(term)) ||
                (x.resume.DesiredPosition != null && x.resume.DesiredPosition.ToLower().Contains(term)));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.resume.UpdatedAt)
            .ThenBy(x => x.profile.Fio)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new AdminResumeListItemDto(
                x.resume.UserId,
                x.user.Username,
                x.profile.Fio,
                x.resume.Headline,
                x.resume.DesiredPosition,
                x.resume.UpdatedAt,
                x.privacy != null && x.privacy.ResumeVisibility == PrivacyScope.Private,
                x.user.Status))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<AdminResumeListItemDto>(rows, total, safePage, safePageSize));
    }

    [HttpGet("{userId:long}")]
    [ProducesResponseType(typeof(AdminResumeDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminResumeDetailDto>> GetByUserId(long userId, CancellationToken cancellationToken)
    {
        var item = await dbContext.CandidateResumeProfiles
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Join(
                dbContext.CandidateProfiles.AsNoTracking(),
                resume => resume.UserId,
                profile => profile.UserId,
                (resume, profile) => new { resume, profile })
            .Join(
                dbContext.Users.AsNoTracking(),
                item => item.resume.UserId,
                user => user.Id,
                (item, user) => new { item.resume, item.profile, user })
            .GroupJoin(
                dbContext.CandidatePrivacySettings.AsNoTracking(),
                item => item.resume.UserId,
                privacy => privacy.UserId,
                (item, privacy) => new { item.resume, item.profile, item.user, privacy = privacy.FirstOrDefault() })
            .Select(x => new AdminResumeDetailDto(
                x.resume.UserId,
                x.user.Username,
                x.profile.Fio,
                x.resume.Headline,
                x.resume.DesiredPosition,
                x.resume.Summary,
                x.resume.UpdatedAt,
                x.privacy != null && x.privacy.ResumeVisibility == PrivacyScope.Private,
                x.user.Status))
            .FirstOrDefaultAsync(cancellationToken);

        if (item is null)
        {
            return this.ToNotFoundError("admin.resumes.not_found", "Резюме не найдено.");
        }

        return Ok(item);
    }

    [HttpPatch("{userId:long}/archive")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateArchiveState(long userId, AdminResumeArchiveUpdateRequest request, CancellationToken cancellationToken)
    {
        var resume = await dbContext.CandidateResumeProfiles.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (resume is null)
        {
            return this.ToNotFoundError("admin.resumes.not_found", "Резюме не найдено.");
        }

        var privacy = await dbContext.CandidatePrivacySettings.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (privacy is null)
        {
            privacy = new CandidatePrivacySettings { UserId = userId };
            dbContext.CandidatePrivacySettings.Add(privacy);
        }

        privacy.ResumeVisibility = request.IsArchived ? PrivacyScope.Private : PrivacyScope.AuthorizedUsers;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{userId:long}/ban-author")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> BanResumeAuthor(long userId, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return this.ToNotFoundError("admin.users.not_found", "Пользователь не найден.");
        }

        user.Status = AccountStatus.Blocked;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{userId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(long userId, CancellationToken cancellationToken)
    {
        var resume = await dbContext.CandidateResumeProfiles.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (resume is null)
        {
            return this.ToNotFoundError("admin.resumes.not_found", "Резюме не найдено.");
        }

        dbContext.CandidateResumeProfiles.Remove(resume);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
