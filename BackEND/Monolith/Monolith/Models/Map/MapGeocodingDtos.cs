namespace Monolith.Models.Map;

public record MapReverseGeocodeResponse(
    decimal RequestedLatitude,
    decimal RequestedLongitude,
    decimal? Latitude,
    decimal? Longitude,
    string? CountryCode,
    string? RegionName,
    string? CityName,
    string? StreetName,
    string? HouseNumber);
