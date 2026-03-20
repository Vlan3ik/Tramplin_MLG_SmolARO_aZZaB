using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Employer;
using Monolith.Models.Opportunities;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "employer")]
[Route("employer/vacancies")]
[Produces("application/json")]
public class EmployerVacanciesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Get employer vacancies with filters and paging.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<EmployerVacancyListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PagedResponse<EmployerVacancyListItemDto>>> GetList([FromQuery] EmployerVacancyListQuery query, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);
        var last24 = DateTimeOffset.UtcNow.AddHours(-24);

        var vacancies = dbContext.Vacancies
            .AsNoTracking()
            .Include(x => x.VacancyTags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.Applications)
            .Where(x => x.CompanyId == membership.CompanyId);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            vacancies = vacancies.Where(x =>
                x.Title.ToLower().Contains(term) ||
                x.ShortDescription.ToLower().Contains(term) ||
                x.FullDescription.ToLower().Contains(term));
        }

        if (query.Statuses is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.Statuses.Contains(x.Status));
        }

        if (query.Kinds is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.Kinds.Contains(x.Kind));
        }

        if (query.Formats is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.Formats.Contains(x.Format));
        }

        if (query.SalaryTaxModes is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.SalaryTaxModes.Contains(x.SalaryTaxMode));
        }

        if (query.SalaryFrom is not null)
        {
            vacancies = vacancies.Where(x => x.SalaryTo == null || x.SalaryTo >= query.SalaryFrom);
        }

        if (query.SalaryTo is not null)
        {
            vacancies = vacancies.Where(x => x.SalaryFrom == null || x.SalaryFrom <= query.SalaryTo);
        }

        if (query.TagIds is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => x.VacancyTags.Any(t => query.TagIds.Contains(t.TagId)));
        }

        var total = await vacancies.CountAsync(cancellationToken);
        var rows = await vacancies
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new EmployerVacancyListItemDto(
                x.Id,
                x.Title,
                x.Kind,
                x.Format,
                x.Status,
                x.SalaryFrom,
                x.SalaryTo,
                x.CurrencyCode,
                x.SalaryTaxMode,
                x.PublishAt,
                x.ApplicationDeadline,
                x.Applications.Count,
                x.Applications.Count(a => a.CreatedAt >= last24),
                x.VacancyTags.Select(t => t.Tag.Name).ToArray()))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<EmployerVacancyListItemDto>(rows, total, page, pageSize));
    }

    /// <summary>
    /// Get employer vacancy detail with application statistics.
    /// </summary>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(EmployerVacancyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployerVacancyDetailDto>> GetById(long id, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var vacancy = await dbContext.Vacancies
            .AsNoTracking()
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.VacancyTags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.Applications)
                .ThenInclude(x => x.CandidateUser)
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);

        if (vacancy is null)
        {
            return this.ToNotFoundError("employer.vacancies.not_found", "Vacancy not found.");
        }

        var last24 = DateTimeOffset.UtcNow.AddHours(-24);
        var stats = new EmployerVacancyStatsDto(
            vacancy.Applications.Count,
            vacancy.Applications.Count(a => a.CreatedAt >= last24),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.New),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.InReview),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.Interview),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.Offer),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.Hired),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.Rejected),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.Canceled));

        var locationCity = vacancy.City ?? vacancy.Location?.City;
        var location = locationCity is null
            ? null
            : new LocationDto(
                locationCity.Id,
                locationCity.CityName,
                locationCity.Latitude,
                locationCity.Longitude,
                vacancy.Location?.StreetName,
                vacancy.Location?.HouseNumber);

        var recent = vacancy.Applications
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .Select(x => new EmployerVacancyRecentApplicationDto(
                x.Id,
                x.CandidateUserId,
                x.CandidateUser.DisplayName,
                x.CandidateUser.AvatarUrl,
                x.Status,
                x.CreatedAt))
            .ToArray();

        var dto = new EmployerVacancyDetailDto(
            vacancy.Id,
            vacancy.Title,
            vacancy.ShortDescription,
            vacancy.FullDescription,
            vacancy.Kind,
            vacancy.Format,
            vacancy.Status,
            vacancy.PublishAt,
            vacancy.ApplicationDeadline,
            vacancy.SalaryFrom,
            vacancy.SalaryTo,
            vacancy.CurrencyCode,
            vacancy.SalaryTaxMode,
            location,
            stats,
            recent,
            vacancy.VacancyTags.Select(t => t.Tag.Name).ToArray());

        return Ok(dto);
    }

    /// <summary>
    /// Create vacancy in employer company.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<object>> Create(EmployerVacancyUpsertRequest request, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var validationError = ValidateVacancy(request);
        if (validationError is not null)
        {
            return this.ToBadRequestError("employer.vacancies.invalid", validationError);
        }

        var vacancy = new Vacancy
        {
            CompanyId = membership.CompanyId,
            CreatedByUserId = membership.UserId,
            Title = request.Title.Trim(),
            ShortDescription = request.ShortDescription.Trim(),
            FullDescription = request.FullDescription.Trim(),
            Kind = request.Kind,
            Format = request.Format,
            Status = request.Status,
            CityId = request.CityId,
            LocationId = request.LocationId,
            SalaryFrom = request.SalaryFrom,
            SalaryTo = request.SalaryTo,
            CurrencyCode = request.CurrencyCode?.Trim().ToUpperInvariant(),
            SalaryTaxMode = request.SalaryTaxMode,
            PublishAt = request.PublishAt,
            ApplicationDeadline = request.ApplicationDeadline
        };

        dbContext.Vacancies.Add(vacancy);
        await dbContext.SaveChangesAsync(cancellationToken);
        await ReplaceVacancyTags(vacancy.Id, request.TagIds, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = vacancy.Id }, new { vacancyId = vacancy.Id });
    }

    /// <summary>
    /// Update vacancy in employer company.
    /// </summary>
    [HttpPatch("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(long id, EmployerVacancyUpsertRequest request, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var validationError = ValidateVacancy(request);
        if (validationError is not null)
        {
            return this.ToBadRequestError("employer.vacancies.invalid", validationError);
        }

        var vacancy = await dbContext.Vacancies.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("employer.vacancies.not_found", "Vacancy not found.");
        }

        vacancy.Title = request.Title.Trim();
        vacancy.ShortDescription = request.ShortDescription.Trim();
        vacancy.FullDescription = request.FullDescription.Trim();
        vacancy.Kind = request.Kind;
        vacancy.Format = request.Format;
        vacancy.Status = request.Status;
        vacancy.CityId = request.CityId;
        vacancy.LocationId = request.LocationId;
        vacancy.SalaryFrom = request.SalaryFrom;
        vacancy.SalaryTo = request.SalaryTo;
        vacancy.CurrencyCode = request.CurrencyCode?.Trim().ToUpperInvariant();
        vacancy.SalaryTaxMode = request.SalaryTaxMode;
        vacancy.PublishAt = request.PublishAt;
        vacancy.ApplicationDeadline = request.ApplicationDeadline;

        await dbContext.SaveChangesAsync(cancellationToken);
        await ReplaceVacancyTags(vacancy.Id, request.TagIds, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Archive vacancy (soft-delete).
    /// </summary>
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var vacancy = await dbContext.Vacancies.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("employer.vacancies.not_found", "Vacancy not found.");
        }

        vacancy.Status = OpportunityStatus.Archived;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Update vacancy status.
    /// </summary>
    [HttpPatch("{id:long}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(long id, EmployerVacancyStatusUpdateRequest request, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var vacancy = await dbContext.Vacancies.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("employer.vacancies.not_found", "Vacancy not found.");
        }

        vacancy.Status = request.Status;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task ReplaceVacancyTags(long vacancyId, IReadOnlyCollection<long>? tagIds, CancellationToken cancellationToken)
    {
        var normalizedTagIds = (tagIds ?? Array.Empty<long>())
            .Where(x => x > 0)
            .Distinct()
            .ToArray();

        var existing = await dbContext.VacancyTags.Where(x => x.VacancyId == vacancyId).ToListAsync(cancellationToken);
        dbContext.VacancyTags.RemoveRange(existing);

        if (normalizedTagIds.Length > 0)
        {
            var existingTagIds = await dbContext.Tags
                .Where(x => normalizedTagIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToArrayAsync(cancellationToken);

            dbContext.VacancyTags.AddRange(existingTagIds.Select(tagId => new VacancyTag
            {
                VacancyId = vacancyId,
                TagId = tagId
            }));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<CompanyMember?> GetManagementMembership(CancellationToken cancellationToken)
        => await dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.UserId == User.GetUserId() &&
                     (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin || x.Role == CompanyMemberRole.Staff),
                cancellationToken);

    private static string? ValidateVacancy(EmployerVacancyUpsertRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) ||
            string.IsNullOrWhiteSpace(request.ShortDescription) ||
            string.IsNullOrWhiteSpace(request.FullDescription))
        {
            return "Title and descriptions are required.";
        }

        if (request.SalaryFrom is not null && request.SalaryTo is not null && request.SalaryTo < request.SalaryFrom)
        {
            return "salaryTo must be >= salaryFrom.";
        }

        return null;
    }
}
