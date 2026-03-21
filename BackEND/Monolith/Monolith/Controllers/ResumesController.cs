using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Resumes;
using Monolith.Services.Common;

namespace Monolith.Controllers;

/// <summary>
/// Публичные endpoints опубликованных резюме.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("resumes")]
[Produces("application/json")]
public class ResumesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список опубликованных резюме.
    /// </summary>
    /// <remarks>
    /// В выборку попадают только пользователи с ResumeVisibility = AuthorizedUsers.
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<ResumeListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<ResumeListItemDto>>> GetList(
        [FromQuery] ResumeListQuery query,
        CancellationToken cancellationToken)
    {
        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);

        var baseQuery = dbContext.CandidateProfiles
            .AsNoTracking()
            .Include(x => x.User)
            .Include(x => x.ResumeProfile)
            .Include(x => x.PrivacySettings)
            .Where(x => x.PrivacySettings != null && x.PrivacySettings.ResumeVisibility == PrivacyScope.AuthorizedUsers);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            baseQuery = baseQuery.Where(x =>
                x.User.DisplayName.ToLower().Contains(term) ||
                x.User.Username.ToLower().Contains(term) ||
                (x.ResumeProfile.Headline != null && x.ResumeProfile.Headline.ToLower().Contains(term)) ||
                (x.ResumeProfile.DesiredPosition != null && x.ResumeProfile.DesiredPosition.ToLower().Contains(term)));
        }

        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var rows = await baseQuery
            .OrderByDescending(x => x.ResumeProfile.UpdatedAt)
            .ThenBy(x => x.User.DisplayName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ResumeListItemDto(
                x.UserId,
                x.User.Username,
                x.User.DisplayName,
                x.User.AvatarUrl,
                x.ResumeProfile.Headline,
                x.ResumeProfile.DesiredPosition,
                x.ResumeProfile.SalaryFrom,
                x.ResumeProfile.SalaryTo,
                x.ResumeProfile.CurrencyCode,
                x.PrivacySettings != null && x.PrivacySettings.OpenToWork,
                x.ResumeProfile.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<ResumeListItemDto>(rows, totalCount, page, pageSize));
    }

    /// <summary>
    /// Возвращает подробные данные одного опубликованного резюме.
    /// </summary>
    /// <param name="id">Идентификатор пользователя-владельца резюме.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
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

        var privacy = profile.PrivacySettings;
        if (privacy is null || privacy.ResumeVisibility != PrivacyScope.AuthorizedUsers)
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

        var projects = await dbContext.CandidateResumeProjects
            .AsNoTracking()
            .Where(x => x.UserId == id)
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
            profile.FirstName,
            profile.LastName,
            profile.MiddleName,
            profile.BirthDate,
            profile.Gender,
            privacy?.ShowContactsInResume == true ? profile.Phone : null,
            profile.About,
            profile.User.AvatarUrl,
            profile.ResumeProfile.Headline,
            profile.ResumeProfile.DesiredPosition,
            profile.ResumeProfile.Summary,
            profile.ResumeProfile.SalaryFrom,
            profile.ResumeProfile.SalaryTo,
            profile.ResumeProfile.CurrencyCode,
            privacy?.OpenToWork == true,
            skills,
            projects,
            education,
            links);

        return Ok(dto);
    }
}
