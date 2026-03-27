using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Hubs;
using Monolith.Models.Chat;
using Monolith.Models.Common;
using Monolith.Models.Employer;
using Monolith.Models.Resumes;
using Monolith.Services.Chats;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "employer")]
[Route("employer/applications")]
[Produces("application/json")]
public class EmployerApplicationsController(
    AppDbContext dbContext,
    IHubContext<ChatHub> hubContext,
    IChatCacheService chatCache) : ControllerBase
{
    /// <summary>
    /// Возвращает отклики компании с фильтрами и пагинацией.
    /// </summary>
    /// <param name="query">Параметры фильтрации и пагинации откликов.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Пагинированный список откликов компании.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<EmployerApplicationListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PagedResponse<EmployerApplicationListItemDto>>> GetList([FromQuery] EmployerApplicationListQuery query, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);

        var applications = dbContext.Applications
            .AsNoTracking()
            .Include(x => x.Vacancy)
            .Include(x => x.CandidateUser)
            .Include(x => x.Chat)
            .Where(x => x.CompanyId == membership.CompanyId);

        if (query.VacancyId is not null)
        {
            applications = applications.Where(x => x.VacancyId == query.VacancyId.Value);
        }

        if (query.Statuses is { Length: > 0 })
        {
            applications = applications.Where(x => query.Statuses.Contains(x.Status));
        }

        if (query.CreatedFrom is not null)
        {
            applications = applications.Where(x => x.CreatedAt >= query.CreatedFrom.Value);
        }

        if (query.CreatedTo is not null)
        {
            applications = applications.Where(x => x.CreatedAt <= query.CreatedTo.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            applications = applications.Where(x =>
                x.Vacancy.Title.ToLower().Contains(term) ||
                x.CandidateUser.Fio.ToLower().Contains(term) ||
                x.CandidateUser.Username.ToLower().Contains(term) ||
                x.CandidateUser.Email.ToLower().Contains(term));
        }

        var total = await applications.CountAsync(cancellationToken);
        var rows = await applications
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new EmployerApplicationListItemDto(
                x.Id,
                x.VacancyId,
                x.Vacancy.Title,
                x.CandidateUserId,
                x.CandidateUser.Fio,
                x.CandidateUser.AvatarUrl,
                x.Status,
                x.CreatedAt,
                x.UpdatedAt,
                x.Chat != null ? (long?)x.Chat.Id : null))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<EmployerApplicationListItemDto>(rows, total, page, pageSize));
    }

    /// <summary>
    /// Возвращает детальную карточку отклика для работодателя.
    /// </summary>
    /// <param name="id">Идентификатор отклика.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Детальная информация по отклику.</returns>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(EmployerApplicationDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployerApplicationDetailDto>> GetById(long id, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var application = await dbContext.Applications
            .AsNoTracking()
            .Include(x => x.Vacancy)
            .Include(x => x.CandidateUser)
                .ThenInclude(x => x.CandidateProfile!)
                    .ThenInclude(x => x.ResumeProfile)
            .Include(x => x.CandidateUser)
                .ThenInclude(x => x.CandidateProfile!)
                    .ThenInclude(x => x.PrivacySettings)
            .Include(x => x.Chat)
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);

        if (application is null)
        {
            return this.ToNotFoundError("employer.applications.not_found", "Application not found.");
        }

        var candidateProfile = application.CandidateUser.CandidateProfile;
        var resume = candidateProfile?.ResumeProfile;
        var privacy = candidateProfile?.PrivacySettings;

        var skills = await dbContext.CandidateResumeSkills
            .AsNoTracking()
            .Include(x => x.Tag)
            .Where(x => x.UserId == application.CandidateUserId)
            .OrderBy(x => x.Tag.Name)
            .Select(x => new ResumeSkillDto(x.TagId, x.Tag.Name, x.Level, x.YearsExperience))
            .ToListAsync(cancellationToken);

        var experiences = await dbContext.CandidateResumeExperiences
            .AsNoTracking()
            .Where(x => x.UserId == application.CandidateUserId)
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
            .Where(x => x.UserId == application.CandidateUserId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new ResumeProjectDto(x.Id, x.Title, x.Role, x.Description, x.StartDate, x.EndDate, x.RepoUrl, x.DemoUrl))
            .ToListAsync(cancellationToken);

        var education = await dbContext.CandidateResumeEducation
            .AsNoTracking()
            .Where(x => x.UserId == application.CandidateUserId)
            .OrderByDescending(x => x.GraduationYear)
            .Select(x => new ResumeEducationDto(x.Id, x.University, x.Faculty, x.Specialty, x.Course, x.GraduationYear))
            .ToListAsync(cancellationToken);

        var links = await dbContext.CandidateResumeLinks
            .AsNoTracking()
            .Where(x => x.UserId == application.CandidateUserId)
            .OrderBy(x => x.Id)
            .Select(x => new ResumeLinkDto(x.Id, x.Kind, x.Url, x.Label))
            .ToListAsync(cancellationToken);

        var hasResumeData =
            candidateProfile is not null ||
            resume is not null ||
            skills.Count > 0 ||
            experiences.Count > 0 ||
            projects.Count > 0 ||
            education.Count > 0 ||
            links.Count > 0;

        var fallbackFio = string.IsNullOrWhiteSpace(application.CandidateUser.Fio)
            ? application.CandidateUser.Username
            : application.CandidateUser.Fio;

        var candidateResume = !hasResumeData
            ? null
            : new ResumeDetailDto(
                candidateProfile?.UserId ?? application.CandidateUserId,
                application.CandidateUser.Username,
                string.IsNullOrWhiteSpace(candidateProfile?.Fio) ? fallbackFio : candidateProfile.Fio,
                candidateProfile?.BirthDate,
                candidateProfile?.Gender ?? CandidateGender.Unknown,
                candidateProfile?.Phone,
                candidateProfile?.About,
                application.CandidateUser.AvatarUrl,
                resume?.Headline,
                resume?.DesiredPosition,
                resume?.Summary,
                resume?.SalaryFrom,
                resume?.SalaryTo,
                resume?.CurrencyCode,
                privacy?.OpenToWork ?? true,
                skills,
                experiences,
                projects,
                education,
                links);

        var dto = new EmployerApplicationDetailDto(
            application.Id,
            application.CompanyId,
            application.VacancyId,
            application.Vacancy.Title,
            application.CandidateUserId,
            application.CandidateUser.Fio,
            application.CandidateUser.AvatarUrl,
            resume?.Headline,
            resume?.DesiredPosition,
            resume?.SalaryFrom,
            resume?.SalaryTo,
            resume?.CurrencyCode,
            application.Status,
            application.InitiatorRole,
            application.CreatedAt,
            application.UpdatedAt,
            application.Chat?.Id,
            candidateResume);

        return Ok(dto);
    }

    /// <summary>
    /// Обновляет статус отклика с проверкой допустимого перехода.
    /// </summary>
    /// <param name="id">Идентификатор отклика.</param>
    /// <param name="request">Новый статус отклика.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешном обновлении статуса.</returns>
    [HttpPatch("{id:long}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(long id, EmployerApplicationStatusUpdateRequest request, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var application = await dbContext.Applications
            .Include(x => x.Chat)
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (application is null)
        {
            return this.ToNotFoundError("employer.applications.not_found", "Application not found.");
        }

        if (!CanTransition(application.Status, request.Status))
        {
            return this.ToBadRequestError(
                "employer.applications.transition_invalid",
                $"Invalid status transition from {application.Status} to {request.Status}.");
        }

        var previousStatus = application.Status;
        application.Status = request.Status;

        if (application.Chat is not null)
        {
            var actor = await dbContext.Users
                .AsNoTracking()
                .Where(x => x.Id == membership.UserId)
                .Select(x => new { x.Fio, x.Username, x.AvatarUrl })
                .FirstOrDefaultAsync(cancellationToken);

            var statusMessage = new ChatMessage
            {
                ChatId = application.Chat.Id,
                SenderUserId = membership.UserId,
                Text = $"Статус отклика изменён: {ToRussianStatusLabel(previousStatus)} -> {ToRussianStatusLabel(request.Status)}.",
                IsSystem = true
            };

            dbContext.ChatMessages.Add(statusMessage);
            await dbContext.SaveChangesAsync(cancellationToken);

            await chatCache.InvalidateChatHistoryAsync(application.Chat.Id, cancellationToken);
            await InvalidateChatListForParticipants(application.Chat.Id, cancellationToken);

            await hubContext.Clients.Group(ChatHub.GroupName(application.Chat.Id)).SendAsync(
                "new",
                new ChatMessageDto(
                    statusMessage.Id,
                    statusMessage.ChatId,
                    statusMessage.SenderUserId,
                    actor?.Fio ?? actor?.Username ?? "System",
                    actor?.Username,
                    actor?.AvatarUrl,
                    statusMessage.Text,
                    statusMessage.IsSystem,
                    statusMessage.CreatedAt,
                    []),
                cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task InvalidateChatListForParticipants(long chatId, CancellationToken cancellationToken)
    {
        var participantIds = await dbContext.ChatParticipants
            .Where(x => x.ChatId == chatId)
            .Select(x => x.UserId)
            .ToArrayAsync(cancellationToken);

        foreach (var participantId in participantIds)
        {
            await chatCache.InvalidateUserListAsync(participantId, cancellationToken);
        }
    }

    private async Task<CompanyMember?> GetManagementMembership(CancellationToken cancellationToken)
        => await dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.UserId == User.GetUserId() &&
                     (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin || x.Role == CompanyMemberRole.Staff),
                cancellationToken);

    private static bool CanTransition(ApplicationStatus from, ApplicationStatus to)
    {
        if (from == to)
        {
            return true;
        }

        return from switch
        {
            ApplicationStatus.New => to is ApplicationStatus.InReview or ApplicationStatus.Rejected or ApplicationStatus.Canceled,
            ApplicationStatus.InReview => to is ApplicationStatus.Interview or ApplicationStatus.Offer or ApplicationStatus.Rejected or ApplicationStatus.Canceled,
            ApplicationStatus.Interview => to is ApplicationStatus.Offer or ApplicationStatus.Rejected or ApplicationStatus.Canceled,
            ApplicationStatus.Offer => to is ApplicationStatus.Hired or ApplicationStatus.Rejected or ApplicationStatus.Canceled,
            ApplicationStatus.Hired => false,
            ApplicationStatus.Rejected => false,
            ApplicationStatus.Canceled => false,
            _ => false
        };
    }

    private static string ToRussianStatusLabel(ApplicationStatus status)
        => status switch
        {
            ApplicationStatus.New => "Новый",
            ApplicationStatus.InReview => "На рассмотрении",
            ApplicationStatus.Interview => "Интервью",
            ApplicationStatus.Offer => "Оффер",
            ApplicationStatus.Hired => "Нанят",
            ApplicationStatus.Rejected => "Отклонен",
            ApplicationStatus.Canceled => "Отменен",
            _ => status.ToString()
        };
}
