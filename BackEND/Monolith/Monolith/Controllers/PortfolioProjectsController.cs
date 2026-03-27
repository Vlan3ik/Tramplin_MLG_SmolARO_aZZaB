using System.Security.Claims;
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
/// Публичные endpoint'ы проектов портфолио.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("portfolio/projects")]
[Produces("application/json")]
public class PortfolioProjectsController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список проектов портфолио с фильтрами и пагинацией.
    /// </summary>
    /// <param name="query">Параметры фильтрации и пагинации.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Пагинированный список кратких карточек проектов.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<PortfolioProjectListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<PortfolioProjectListItemDto>>> GetList(
        [FromQuery] PortfolioProjectListQuery query,
        CancellationToken cancellationToken)
    {
        return Ok(await BuildListResponse(query, null, cancellationToken));
    }

    /// <summary>
    /// Возвращает список проектов портфолио конкретного пользователя по username.
    /// </summary>
    /// <param name="username">Username владельца/участника проектов.</param>
    /// <param name="query">Дополнительные параметры фильтрации и пагинации.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Пагинированный список кратких карточек проектов пользователя.</returns>
    [HttpGet("users/{username}")]
    [ProducesResponseType(typeof(PagedResponse<PortfolioProjectListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<PortfolioProjectListItemDto>>> GetListByUsername(
        string username,
        [FromQuery] PortfolioProjectListQuery query,
        CancellationToken cancellationToken)
    {
        return Ok(await BuildListResponse(query, username, cancellationToken));
    }

    private async Task<PagedResponse<PortfolioProjectListItemDto>> BuildListResponse(
        PortfolioProjectListQuery query,
        string? forcedUsername,
        CancellationToken cancellationToken)
    {
        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);
        var viewerId = TryGetCurrentUserId();

        var baseQuery = dbContext.CandidateResumeProjects.AsNoTracking();
        if (viewerId is not null)
        {
            var currentViewerId = viewerId.Value;
            baseQuery = baseQuery.Where(x => !x.IsPrivate || x.UserId == currentViewerId);
        }
        else
        {
            baseQuery = baseQuery.Where(x => !x.IsPrivate);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            baseQuery = baseQuery.Where(x =>
                x.Title.ToLower().Contains(term) ||
                (x.Description != null && x.Description.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(query.Role))
        {
            var roleTerm = query.Role.Trim().ToLowerInvariant();
            baseQuery = baseQuery.Where(x =>
                (x.Role != null && x.Role.ToLower().Contains(roleTerm)) ||
                x.Participants.Any(p => p.Role.ToLower().Contains(roleTerm)));
        }

        if (query.CollaborationTypes is { Length: > 0 })
        {
            baseQuery = baseQuery.Where(x => x.Collaborations.Any(c => query.CollaborationTypes.Contains(c.Type)));
        }

        var targetUserId = await ResolveTargetUserId(query, forcedUsername, cancellationToken);
        if (targetUserId == -1)
        {
            return new PagedResponse<PortfolioProjectListItemDto>(Array.Empty<PortfolioProjectListItemDto>(), 0, page, pageSize);
        }

        if (targetUserId.HasValue)
        {
            var id = targetUserId.Value;
            baseQuery = baseQuery.Where(x =>
                x.UserId == id ||
                x.Participants.Any(p => p.UserId == id) ||
                x.Collaborations.Any(c => c.Type == PortfolioCollaborationType.User && c.UserId == id));
        }

        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var pageItems = await baseQuery
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(x => x.Photos)
            .Include(x => x.Participants)
            .ToListAsync(cancellationToken);

        var authorIds = pageItems.Select(x => x.UserId).Distinct().ToArray();
        var authorInfos = await LoadUserInfos(authorIds, cancellationToken);

        var items = pageItems
            .Select(x => ToListItem(x, authorInfos, viewerId))
            .ToList();

        return new PagedResponse<PortfolioProjectListItemDto>(items, totalCount, page, pageSize);
    }

    /// <summary>
    /// Возвращает подробную карточку проекта портфолио.
    /// </summary>
    /// <param name="id">Идентификатор проекта.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Подробная карточка проекта со связанными данными и похожими проектами.</returns>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(PortfolioProjectDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PortfolioProjectDetailDto>> GetDetail(long id, CancellationToken cancellationToken)
    {
        var viewerId = TryGetCurrentUserId();
        var project = await dbContext.CandidateResumeProjects
            .AsNoTracking()
            .Include(x => x.Photos)
            .Include(x => x.Participants)
                .ThenInclude(x => x.User)
            .Include(x => x.Collaborations)
                .ThenInclude(x => x.User)
            .Include(x => x.Collaborations)
                .ThenInclude(x => x.Vacancy)
            .Include(x => x.Collaborations)
                .ThenInclude(x => x.Opportunity)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (project is null)
        {
            return this.ToNotFoundError("portfolio.project.not_found", "Проект портфолио не найден.");
        }

        if (project.IsPrivate && viewerId != project.UserId)
        {
            return this.ToNotFoundError("portfolio.project.not_found", "Проект портфолио не найден.");
        }

        var userIds = project.Participants.Select(x => x.UserId).Append(project.UserId).Distinct().ToArray();
        var userInfos = await LoadUserInfos(userIds, cancellationToken);

        var authorInfo = userInfos.TryGetValue(project.UserId, out var info)
            ? info
            : new UserInfo(project.UserId, string.Empty, "Неизвестный пользователь", null);

        var photos = project.Photos
            .OrderByDescending(x => x.IsMain)
            .ThenBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => new PortfolioProjectPhotoDto(x.Id, x.Url, x.SortOrder, x.IsMain))
            .ToList();

        var participants = project.Participants
            .OrderBy(x => x.CreatedAt)
            .Select(x =>
            {
                var participantInfo = userInfos.TryGetValue(x.UserId, out var participantUserInfo)
                    ? participantUserInfo
                    : new UserInfo(x.UserId, x.User.Username, x.User.Fio, null);
                return new PortfolioProjectParticipantDto(
                    x.UserId,
                    participantInfo.Username,
                    participantInfo.Fio,
                    participantInfo.AvatarUrl,
                    x.Role);
            })
            .ToList();

        if (participants.All(x => x.UserId != project.UserId))
        {
            participants.Insert(0, new PortfolioProjectParticipantDto(
                project.UserId,
                authorInfo.Username,
                authorInfo.Fio,
                authorInfo.AvatarUrl,
                project.Role ?? string.Empty));
        }

        var collaborations = project.Collaborations
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x =>
            {
                var collabUserInfo = x.UserId.HasValue && userInfos.TryGetValue(x.UserId.Value, out var value)
                    ? value
                    : null;

                return new PortfolioProjectCollaborationDto(
                    x.Id,
                    x.Type,
                    x.UserId,
                    collabUserInfo?.Username,
                    collabUserInfo?.Fio,
                    collabUserInfo?.AvatarUrl,
                    x.VacancyId,
                    x.Vacancy?.Title,
                    x.OpportunityId,
                    x.Opportunity?.Title,
                    x.Label);
            })
            .ToList();

        var similarProjects = await LoadSimilarProjects(project, viewerId, cancellationToken);

        var detail = new PortfolioProjectDetailDto(
            project.Id,
            project.UserId,
            authorInfo.Username,
            authorInfo.Fio,
            authorInfo.AvatarUrl,
            project.Title,
            project.Role,
            project.Description,
            project.StartDate,
            project.EndDate,
            project.RepoUrl,
            project.DemoUrl,
            photos,
            participants,
            collaborations,
            similarProjects);

        return Ok(detail);
    }

    private async Task<long?> ResolveTargetUserId(PortfolioProjectListQuery query, string? forcedUsername, CancellationToken cancellationToken)
    {
        if (query.UserId.HasValue)
        {
            return query.UserId.Value;
        }

        var effectiveUsername = !string.IsNullOrWhiteSpace(forcedUsername) ? forcedUsername : query.Username;
        if (string.IsNullOrWhiteSpace(effectiveUsername))
        {
            return null;
        }

        var raw = effectiveUsername.Trim().ToLowerInvariant();
        var exactUserId = await dbContext.Users
            .AsNoTracking()
            .Where(x => x.Username.ToLower() == raw)
            .Select(x => (long?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (exactUserId.HasValue)
        {
            return exactUserId.Value;
        }

        var normalized = UsernameGenerator.Normalize(effectiveUsername);
        var userId = await dbContext.Users
            .AsNoTracking()
            .Where(x => x.Username == normalized)
            .Select(x => (long?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        return userId ?? -1;
    }

    private async Task<IReadOnlyCollection<PortfolioProjectListItemDto>> LoadSimilarProjects(
        CandidateResumeProject project,
        long? viewerId,
        CancellationToken cancellationToken)
    {
        const int similarLimit = 5;
        var skillTagIds = await dbContext.CandidateResumeSkills
            .AsNoTracking()
            .Where(x => x.UserId == project.UserId)
            .Select(x => x.TagId)
            .ToArrayAsync(cancellationToken);

        var similarIds = new List<long>();
        if (skillTagIds.Length > 0)
        {
            var currentViewerId = viewerId;
            similarIds = await dbContext.CandidateResumeProjects
                .AsNoTracking()
                .Where(x => x.Id != project.Id)
                .Where(x => !x.IsPrivate || (currentViewerId != null && x.UserId == currentViewerId.Value))
                .Where(x => dbContext.CandidateResumeSkills.Any(s => s.UserId == x.UserId && skillTagIds.Contains(s.TagId)))
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => x.Id)
                .Distinct()
                .Take(similarLimit)
                .ToListAsync(cancellationToken);
        }

        if (similarIds.Count < similarLimit)
        {
            var currentViewerId = viewerId;
            var fallbackIds = await dbContext.CandidateResumeProjects
                .AsNoTracking()
                .Where(x => x.Id != project.Id && !similarIds.Contains(x.Id))
                .Where(x => !x.IsPrivate || (currentViewerId != null && x.UserId == currentViewerId.Value))
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => x.Id)
                .Take(similarLimit - similarIds.Count)
                .ToListAsync(cancellationToken);
            similarIds.AddRange(fallbackIds);
        }

        if (similarIds.Count == 0)
        {
            return Array.Empty<PortfolioProjectListItemDto>();
        }

        var similarProjects = await dbContext.CandidateResumeProjects
            .AsNoTracking()
            .Where(x => similarIds.Contains(x.Id))
            .Include(x => x.Photos)
            .Include(x => x.Participants)
            .ToListAsync(cancellationToken);

        var authorIds = similarProjects.Select(x => x.UserId).Distinct().ToArray();
        var authorInfos = await LoadUserInfos(authorIds, cancellationToken);
        var order = similarIds.Select((id, index) => new { id, index }).ToDictionary(x => x.id, x => x.index);

        return similarProjects
            .OrderBy(x => order[x.Id])
            .Select(x => ToListItem(x, authorInfos, viewerId))
            .ToList();
    }

    private async Task<Dictionary<long, UserInfo>> LoadUserInfos(IReadOnlyCollection<long> userIds, CancellationToken cancellationToken)
    {
        if (userIds.Count == 0)
        {
            return new Dictionary<long, UserInfo>();
        }

        var profiles = await dbContext.CandidateProfiles
            .AsNoTracking()
            .Include(x => x.User)
            .Where(x => userIds.Contains(x.UserId))
            .Select(x => new
            {
                x.UserId,
                x.User.Username,
                x.User.Fio,
                CandidateFio = x.Fio,
                x.AvatarUrl
            })
            .ToListAsync(cancellationToken);

        var result = profiles.ToDictionary(
            x => x.UserId,
            x =>
            {
                var fio = BuildFio(x.CandidateFio, x.Fio);
                return new UserInfo(x.UserId, x.Username, fio, x.AvatarUrl);
            });

        var missingUserIds = userIds.Where(x => !result.ContainsKey(x)).ToArray();
        if (missingUserIds.Length > 0)
        {
            var users = await dbContext.Users
                .AsNoTracking()
                .Where(x => missingUserIds.Contains(x.Id))
                .Select(x => new { x.Id, x.Username, x.Fio })
                .ToListAsync(cancellationToken);

            foreach (var user in users)
            {
                result[user.Id] = new UserInfo(user.Id, user.Username, string.IsNullOrWhiteSpace(user.Fio) ? user.Username : user.Fio, null);
            }
        }

        return result;
    }

    private static PortfolioProjectListItemDto ToListItem(
        CandidateResumeProject project,
        IReadOnlyDictionary<long, UserInfo> authorInfos,
        long? viewerId)
    {
        var authorInfo = authorInfos.TryGetValue(project.UserId, out var info)
            ? info
            : new UserInfo(project.UserId, string.Empty, "Неизвестный пользователь", null);

        var mainPhotoUrl = project.Photos
            .OrderByDescending(x => x.IsMain)
            .ThenBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => x.Url)
            .FirstOrDefault();

        string? role = null;
        if (viewerId.HasValue)
        {
            role = project.Participants.FirstOrDefault(x => x.UserId == viewerId.Value)?.Role;
            if (role is null && project.UserId == viewerId.Value)
            {
                role = project.Role;
            }
        }

        role ??= project.Role ?? project.Participants.FirstOrDefault()?.Role;

        return new PortfolioProjectListItemDto(
            project.Id,
            project.Title,
            mainPhotoUrl,
            authorInfo.Fio,
            authorInfo.AvatarUrl,
            role,
            Shorten(project.Description));
    }

    private static string BuildFio(string? candidateFio, string? fallbackFio)
    {
        var fio = candidateFio?.Trim();
        if (!string.IsNullOrWhiteSpace(fio))
        {
            return fio;
        }

        if (!string.IsNullOrWhiteSpace(fallbackFio))
        {
            return fallbackFio;
        }

        return "Неизвестный пользователь";
    }

    private static string? Shorten(string? source)
    {
        if (string.IsNullOrWhiteSpace(source))
        {
            return null;
        }

        var trimmed = source.Trim();
        if (trimmed.Length <= 220)
        {
            return trimmed;
        }

        return $"{trimmed[..217]}...";
    }

    private long? TryGetCurrentUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return long.TryParse(value, out var userId) ? userId : null;
    }

    private sealed record UserInfo(long UserId, string Username, string Fio, string? AvatarUrl);
}
