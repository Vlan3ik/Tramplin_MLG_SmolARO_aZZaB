using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Portfolio;
using Monolith.Services.Common;

namespace Monolith.Controllers;

/// <summary>
/// Управление проектами портфолио текущего пользователя.
/// </summary>
[ApiController]
[Authorize]
[Route("me/portfolio/projects")]
[Produces("application/json")]
public class MePortfolioProjectsController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Создает проект портфолио текущего пользователя.
    /// </summary>
    /// <param name="request">Данные проекта для создания.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Идентификатор созданного проекта.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(PortfolioProjectMutationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<PortfolioProjectMutationResponse>> Create(
        UpsertPortfolioProjectRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var validation = await ValidateUpsertRequest(request, userId, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        var project = new CandidateResumeProject
        {
            UserId = userId,
            Title = request.Title.Trim(),
            Role = request.Role?.Trim(),
            Description = request.Description?.Trim(),
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            RepoUrl = request.RepoUrl?.Trim(),
            DemoUrl = request.DemoUrl?.Trim(),
            IsPrivate = request.IsPrivate
        };

        dbContext.CandidateResumeProjects.Add(project);
        await dbContext.SaveChangesAsync(cancellationToken);

        ApplyParticipantsAndCollaborations(project.Id, userId, request);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new PortfolioProjectMutationResponse(project.Id));
    }

    /// <summary>
    /// Обновляет проект портфолио текущего пользователя.
    /// </summary>
    /// <param name="id">Идентификатор проекта.</param>
    /// <param name="request">Новые данные проекта.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Идентификатор обновленного проекта.</returns>
    [HttpPut("{id:long}")]
    [ProducesResponseType(typeof(PortfolioProjectMutationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<PortfolioProjectMutationResponse>> Update(
        long id,
        UpsertPortfolioProjectRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var project = await dbContext.CandidateResumeProjects
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (project is null || project.UserId != userId)
        {
            return this.ToNotFoundError("me.portfolio.project.not_found", "Проект портфолио не найден.");
        }

        var validation = await ValidateUpsertRequest(request, userId, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        project.Title = request.Title.Trim();
        project.Role = request.Role?.Trim();
        project.Description = request.Description?.Trim();
        project.StartDate = request.StartDate;
        project.EndDate = request.EndDate;
        project.RepoUrl = request.RepoUrl?.Trim();
        project.DemoUrl = request.DemoUrl?.Trim();
        project.IsPrivate = request.IsPrivate;

        var oldParticipants = await dbContext.CandidateResumeProjectParticipants
            .Where(x => x.ProjectId == id)
            .ToListAsync(cancellationToken);
        var oldCollaborations = await dbContext.CandidateResumeProjectCollaborations
            .Where(x => x.ProjectId == id)
            .ToListAsync(cancellationToken);

        dbContext.CandidateResumeProjectParticipants.RemoveRange(oldParticipants);
        dbContext.CandidateResumeProjectCollaborations.RemoveRange(oldCollaborations);

        ApplyParticipantsAndCollaborations(id, userId, request);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new PortfolioProjectMutationResponse(id));
    }

    /// <summary>
    /// Удаляет проект портфолио текущего пользователя.
    /// </summary>
    /// <param name="id">Идентификатор проекта.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешном удалении.</returns>
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var project = await dbContext.CandidateResumeProjects
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (project is null || project.UserId != userId)
        {
            return this.ToNotFoundError("me.portfolio.project.not_found", "Проект портфолио не найден.");
        }

        dbContext.CandidateResumeProjects.Remove(project);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Обновляет параметры фото проекта портфолио текущего пользователя.
    /// </summary>
    /// <param name="projectId">Идентификатор проекта.</param>
    /// <param name="photoId">Идентификатор фото.</param>
    /// <param name="request">Новые параметры фото.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешном обновлении.</returns>
    [HttpPatch("{projectId:long}/photos/{photoId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdatePhoto(
        long projectId,
        long photoId,
        UpdatePortfolioProjectPhotoRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var project = await dbContext.CandidateResumeProjects
            .FirstOrDefaultAsync(x => x.Id == projectId, cancellationToken);
        if (project is null || project.UserId != userId)
        {
            return this.ToNotFoundError("me.portfolio.project.not_found", "Проект портфолио не найден.");
        }

        var photo = await dbContext.CandidateResumeProjectPhotos
            .FirstOrDefaultAsync(x => x.Id == photoId && x.ProjectId == projectId, cancellationToken);
        if (photo is null)
        {
            return this.ToNotFoundError("me.portfolio.photo.not_found", "Фото проекта портфолио не найдено.");
        }

        photo.SortOrder = request.SortOrder;
        if (request.IsMain)
        {
            var oldMainPhotos = await dbContext.CandidateResumeProjectPhotos
                .Where(x => x.ProjectId == projectId && x.IsMain && x.Id != photoId)
                .ToListAsync(cancellationToken);
            foreach (var oldMainPhoto in oldMainPhotos)
            {
                oldMainPhoto.IsMain = false;
            }
        }

        photo.IsMain = request.IsMain;

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Удаляет фото проекта портфолио текущего пользователя.
    /// </summary>
    /// <param name="projectId">Идентификатор проекта.</param>
    /// <param name="photoId">Идентификатор фото.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Пустой ответ при успешном удалении.</returns>
    [HttpDelete("{projectId:long}/photos/{photoId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> DeletePhoto(long projectId, long photoId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var project = await dbContext.CandidateResumeProjects
            .FirstOrDefaultAsync(x => x.Id == projectId, cancellationToken);
        if (project is null || project.UserId != userId)
        {
            return this.ToNotFoundError("me.portfolio.project.not_found", "Проект портфолио не найден.");
        }

        var photo = await dbContext.CandidateResumeProjectPhotos
            .FirstOrDefaultAsync(x => x.Id == photoId && x.ProjectId == projectId, cancellationToken);
        if (photo is null)
        {
            return this.ToNotFoundError("me.portfolio.photo.not_found", "Фото проекта портфолио не найдено.");
        }

        dbContext.CandidateResumeProjectPhotos.Remove(photo);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private void ApplyParticipantsAndCollaborations(long projectId, long ownerUserId, UpsertPortfolioProjectRequest request)
    {
        var participants = request.Participants
            .Where(x => x.UserId > 0)
            .GroupBy(x => x.UserId)
            .Select(x => x.First())
            .ToList();

        if (participants.All(x => x.UserId != ownerUserId))
        {
            participants.Insert(0, new UpsertPortfolioProjectParticipantDto(ownerUserId, request.Role?.Trim() ?? "Author"));
        }

        dbContext.CandidateResumeProjectParticipants.AddRange(participants.Select(x => new CandidateResumeProjectParticipant
        {
            ProjectId = projectId,
            UserId = x.UserId,
            Role = string.IsNullOrWhiteSpace(x.Role) ? "Contributor" : x.Role.Trim()
        }));

        dbContext.CandidateResumeProjectCollaborations.AddRange(request.Collaborations.Select(x => new CandidateResumeProjectCollaboration
        {
            ProjectId = projectId,
            Type = x.Type,
            UserId = x.UserId,
            VacancyId = x.VacancyId,
            OpportunityId = x.OpportunityId,
            Label = x.Label?.Trim(),
            SortOrder = x.SortOrder
        }));
    }

    private async Task<ActionResult?> ValidateUpsertRequest(
        UpsertPortfolioProjectRequest request,
        long ownerUserId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return this.ToBadRequestError("me.portfolio.project.title_required", "Поле title обязательно.");
        }

        if (request.EndDate.HasValue && request.StartDate.HasValue && request.EndDate.Value < request.StartDate.Value)
        {
            return this.ToBadRequestError("me.portfolio.project.invalid_period", "Дата окончания не может быть меньше даты начала.");
        }

        var participantIds = request.Participants.Select(x => x.UserId).Where(x => x > 0).Distinct().ToList();
        if (!participantIds.Contains(ownerUserId))
        {
            participantIds.Add(ownerUserId);
        }

        if (participantIds.Count > 0)
        {
            var existingUserIds = await dbContext.Users
                .Where(x => participantIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            if (existingUserIds.Count != participantIds.Count)
            {
                return this.ToBadRequestError("me.portfolio.project.participants_invalid", "Один или несколько участников не найдены.");
            }
        }

        var collabUserIds = request.Collaborations
            .Where(x => x.Type == PortfolioCollaborationType.User)
            .Select(x => x.UserId)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
        if (collabUserIds.Count > 0)
        {
            var existingUserIds = await dbContext.Users
                .Where(x => collabUserIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            if (existingUserIds.Count != collabUserIds.Count)
            {
                return this.ToBadRequestError("me.portfolio.project.collaboration_user_invalid", "Пользователь в коллаборации не найден.");
            }
        }

        var vacancyIds = request.Collaborations
            .Where(x => x.Type == PortfolioCollaborationType.Vacancy)
            .Select(x => x.VacancyId)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
        if (vacancyIds.Count > 0)
        {
            var existingVacancyIds = await dbContext.Vacancies
                .Where(x => vacancyIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            if (existingVacancyIds.Count != vacancyIds.Count)
            {
                return this.ToBadRequestError("me.portfolio.project.collaboration_vacancy_invalid", "Вакансия в коллаборации не найдена.");
            }
        }

        var opportunityIds = request.Collaborations
            .Where(x => x.Type == PortfolioCollaborationType.Opportunity)
            .Select(x => x.OpportunityId)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
        if (opportunityIds.Count > 0)
        {
            var existingOpportunityIds = await dbContext.Opportunities
                .Where(x => opportunityIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            if (existingOpportunityIds.Count != opportunityIds.Count)
            {
                return this.ToBadRequestError("me.portfolio.project.collaboration_opportunity_invalid", "Мероприятие в коллаборации не найдено.");
            }
        }

        foreach (var collaboration in request.Collaborations)
        {
            var valid = collaboration.Type switch
            {
                PortfolioCollaborationType.User => collaboration.UserId.HasValue && !collaboration.VacancyId.HasValue && !collaboration.OpportunityId.HasValue,
                PortfolioCollaborationType.Vacancy => !collaboration.UserId.HasValue && collaboration.VacancyId.HasValue && !collaboration.OpportunityId.HasValue,
                PortfolioCollaborationType.Opportunity => !collaboration.UserId.HasValue && !collaboration.VacancyId.HasValue && collaboration.OpportunityId.HasValue,
                PortfolioCollaborationType.Custom => !collaboration.UserId.HasValue && !collaboration.VacancyId.HasValue && !collaboration.OpportunityId.HasValue,
                _ => false
            };
            if (!valid)
            {
                return this.ToBadRequestError("me.portfolio.project.collaboration_invalid", "Неверная структура коллаборации.");
            }
        }

        return null;
    }
}
