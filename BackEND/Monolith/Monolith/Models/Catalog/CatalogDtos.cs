namespace Monolith.Models.Catalog;

/// <summary>
/// Элемент списка городов.
/// </summary>
/// <param name="Id">Идентификатор города.</param>
/// <param name="Name">Название города.</param>
/// <param name="Region">Название региона.</param>
/// <param name="CountryCode">Код страны ISO-3166-1 alpha-2.</param>
/// <param name="Latitude">Широта города.</param>
/// <param name="Longitude">Долгота города.</param>
public record CityListItemDto(long Id, string Name, string Region, string CountryCode, decimal? Latitude, decimal? Longitude);

/// <summary>
/// Элемент списка локаций.
/// </summary>
/// <param name="Id">Идентификатор локации.</param>
/// <param name="CityId">Идентификатор города.</param>
/// <param name="CityName">Название города.</param>
/// <param name="StreetName">Название улицы.</param>
/// <param name="HouseNumber">Номер дома.</param>
public record LocationListItemDto(long Id, long CityId, string CityName, string? StreetName, string? HouseNumber);

/// <summary>
/// Элемент списка групп тегов.
/// </summary>
/// <param name="Id">Идентификатор группы.</param>
/// <param name="Code">Системный код группы.</param>
/// <param name="Name">Название группы.</param>
public record TagGroupListItemDto(long Id, string Code, string Name);

/// <summary>
/// Элемент списка тегов.
/// </summary>
/// <param name="Id">Идентификатор тега.</param>
/// <param name="GroupId">Идентификатор группы тега.</param>
/// <param name="GroupCode">Системный код группы тега.</param>
/// <param name="Name">Название тега.</param>
/// <param name="Slug">Уникальный slug тега.</param>
public record TagListItemDto(long Id, long GroupId, string GroupCode, string Name, string Slug);
