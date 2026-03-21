namespace Monolith.Models.Me;

/// <summary>
/// Публичная ссылка пользователя.
/// </summary>
public record MePublicLinkDto(
    long Id,
    string Kind,
    string Url,
    string? Label,
    int SortOrder);

/// <summary>
/// Публичная ссылка пользователя для сохранения.
/// </summary>
public record MePublicLinkUpsertDto(
    string Kind,
    string Url,
    string? Label,
    int SortOrder);

/// <summary>
/// Запрос на обновление набора публичных ссылок пользователя.
/// </summary>
public record UpdateMePublicLinksRequest(IReadOnlyCollection<MePublicLinkUpsertDto> Links);
