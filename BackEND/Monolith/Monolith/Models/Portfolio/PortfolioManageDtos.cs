using Monolith.Entities;

namespace Monolith.Models.Portfolio;

/// <summary>
/// Запрос на создание или обновление проекта портфолио.
/// </summary>
public record UpsertPortfolioProjectRequest(
    string Title,
    string? Role,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? RepoUrl,
    string? DemoUrl,
    bool IsPrivate,
    IReadOnlyCollection<UpsertPortfolioProjectParticipantDto> Participants,
    IReadOnlyCollection<UpsertPortfolioProjectCollaborationDto> Collaborations);

/// <summary>
/// Участник проекта портфолио для сохранения.
/// </summary>
public record UpsertPortfolioProjectParticipantDto(
    long UserId,
    string Role);

/// <summary>
/// Коллаборация проекта портфолио для сохранения.
/// </summary>
public record UpsertPortfolioProjectCollaborationDto(
    PortfolioCollaborationType Type,
    long? UserId,
    long? VacancyId,
    long? OpportunityId,
    string? Label,
    int SortOrder);

/// <summary>
/// Результат сохранения проекта портфолио.
/// </summary>
public record PortfolioProjectMutationResponse(long ProjectId);

/// <summary>
/// Результат загрузки фото проекта портфолио.
/// </summary>
public record UploadPortfolioProjectPhotoResponse(
    long PhotoId,
    string Url,
    int SortOrder,
    bool IsMain);

/// <summary>
/// Запрос на изменение параметров фото проекта портфолио.
/// </summary>
public record UpdatePortfolioProjectPhotoRequest(
    int SortOrder,
    bool IsMain);
