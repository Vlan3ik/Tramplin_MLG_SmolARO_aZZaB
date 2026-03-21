using Monolith.Entities;

namespace Monolith.Models.Portfolio;

/// <summary>
/// Параметры фильтрации и пагинации списка проектов портфолио.
/// </summary>
public class PortfolioProjectListQuery
{
    /// <summary>
    /// Номер страницы (начиная с 1).
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Размер страницы (максимум 100).
    /// </summary>
    public int PageSize { get; set; } = 20;

    /// <summary>
    /// Поисковая строка по названию и описанию проекта.
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// Фильтр по идентификатору пользователя.
    /// </summary>
    public long? UserId { get; set; }

    /// <summary>
    /// Фильтр по username пользователя.
    /// </summary>
    public string? Username { get; set; }

    /// <summary>
    /// Фильтр по роли участника в проекте.
    /// </summary>
    public string? Role { get; set; }

    /// <summary>
    /// Фильтр по типам коллабораций проекта.
    /// </summary>
    public PortfolioCollaborationType[]? CollaborationTypes { get; set; }
}

/// <summary>
/// Краткая карточка проекта портфолио.
/// </summary>
public record PortfolioProjectListItemDto(
    long ProjectId,
    string Title,
    string? MainPhotoUrl,
    string AuthorFio,
    string? PrimaryRole,
    string? ShortDescription);

/// <summary>
/// Фото проекта портфолио.
/// </summary>
public record PortfolioProjectPhotoDto(
    long Id,
    string Url,
    int SortOrder,
    bool IsMain);

/// <summary>
/// Участник проекта портфолио.
/// </summary>
public record PortfolioProjectParticipantDto(
    long UserId,
    string Username,
    string Fio,
    string Role);

/// <summary>
/// Коллаборация проекта портфолио.
/// </summary>
public record PortfolioProjectCollaborationDto(
    long Id,
    PortfolioCollaborationType Type,
    long? UserId,
    string? Username,
    string? UserFio,
    long? VacancyId,
    string? VacancyTitle,
    long? OpportunityId,
    string? OpportunityTitle,
    string? Label);

/// <summary>
/// Подробная карточка проекта портфолио.
/// </summary>
public record PortfolioProjectDetailDto(
    long ProjectId,
    long AuthorUserId,
    string AuthorUsername,
    string AuthorFio,
    string Title,
    string? AuthorRole,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? RepoUrl,
    string? DemoUrl,
    IReadOnlyCollection<PortfolioProjectPhotoDto> Photos,
    IReadOnlyCollection<PortfolioProjectParticipantDto> Participants,
    IReadOnlyCollection<PortfolioProjectCollaborationDto> Collaborations,
    IReadOnlyCollection<PortfolioProjectListItemDto> SimilarProjects);
