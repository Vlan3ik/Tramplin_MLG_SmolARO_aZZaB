namespace Monolith.Services.Geo;

public sealed record ReverseGeocodingAddress(
    string? CountryCode,
    string? RegionName,
    string? CityName,
    string? StreetName,
    string? HouseNumber,
    decimal? Latitude,
    decimal? Longitude);

public interface IReverseGeocodingService
{
    Task<ReverseGeocodingAddress?> ReverseAsync(decimal latitude, decimal longitude, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<ReverseGeocodingAddress>> SearchAsync(string query, int limit, CancellationToken cancellationToken);
}

public sealed record ResolvedLocationResult(long CityId, long LocationId);

public sealed record ResolvedAddressResult(
    string? CountryCode,
    string? RegionName,
    string? CityName,
    string? StreetName,
    string? HouseNumber,
    decimal? Latitude,
    decimal? Longitude);

public interface IEmployerLocationService
{
    Task<ResolvedLocationResult?> ResolveOrCreateAsync(decimal latitude, decimal longitude, CancellationToken cancellationToken);
    Task<ResolvedLocationResult?> ResolveOrCreateByAddressAsync(long cityId, string? streetName, string? houseNumber, CancellationToken cancellationToken);
    Task<ResolvedAddressResult?> ResolveAddressAsync(decimal latitude, decimal longitude, CancellationToken cancellationToken);
}
