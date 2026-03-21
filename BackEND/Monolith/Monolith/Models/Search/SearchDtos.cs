namespace Monolith.Models.Search;

/// <summary>
/// Тип сущности поисковой подсказки.
/// </summary>
public enum SearchSuggestEntityType
{
    Vacancy = 1,
    Opportunity = 2
}

/// <summary>
/// Ответ поисковых подсказок.
/// </summary>
/// <param name="Query">Нормализованный поисковый запрос.</param>
/// <param name="Items">Список найденных подсказок.</param>
public record SearchSuggestResponse(
    string Query,
    IReadOnlyCollection<SearchSuggestItemDto> Items);

/// <summary>
/// Элемент поисковой подсказки.
/// </summary>
public record SearchSuggestItemDto(
    SearchSuggestEntityType EntityType,
    long Id,
    string Title,
    string CompanyName,
    string LocationName,
    DateTimeOffset PublishAt,
    double Score);
