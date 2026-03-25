using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using NetTopologySuite;
using NetTopologySuite.Geometries;
using LocationEntity = Monolith.Entities.Location;

namespace Monolith.Services.Geo;

public class EmployerLocationService(AppDbContext dbContext, IReverseGeocodingService reverseGeocodingService) : IEmployerLocationService
{
    private static readonly GeometryFactory GeometryFactory =
        NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);

    public async Task<ResolvedLocationResult?> ResolveOrCreateAsync(decimal latitude, decimal longitude, CancellationToken cancellationToken)
    {
        var reverse = await reverseGeocodingService.ReverseAsync(latitude, longitude, cancellationToken);
        var city = await ResolveCityAsync(reverse, latitude, longitude, cancellationToken);
        if (city is null)
        {
            return null;
        }

        var street = CleanText(reverse?.StreetName);
        var house = CleanText(reverse?.HouseNumber);

        var location = await FindLocationAsync(city.Id, latitude, longitude, cancellationToken);
        if (location is null)
        {
            location = new LocationEntity
            {
                CityId = city.Id,
                GeoPoint = GeometryFactory.CreatePoint(new Coordinate((double)longitude, (double)latitude)),
                StreetName = street,
                HouseNumber = house
            };

            dbContext.Locations.Add(location);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return new ResolvedLocationResult(city.Id, location.Id);
    }

    public async Task<ResolvedAddressResult?> ResolveAddressAsync(decimal latitude, decimal longitude, CancellationToken cancellationToken)
    {
        var reverse = await reverseGeocodingService.ReverseAsync(latitude, longitude, cancellationToken);
        var nearestCity = await ResolveNearestCityAsync(latitude, longitude, cancellationToken);

        var cityName = CleanText(reverse?.CityName) ?? nearestCity?.CityName;
        var regionName = CleanText(reverse?.RegionName) ?? nearestCity?.RegionName;
        var countryCode = CleanText(reverse?.CountryCode) ?? nearestCity?.CountryCode;
        var street = CleanText(reverse?.StreetName);
        var house = CleanText(reverse?.HouseNumber);
        var resolvedLatitude = reverse?.Latitude ?? nearestCity?.Latitude ?? latitude;
        var resolvedLongitude = reverse?.Longitude ?? nearestCity?.Longitude ?? longitude;

        if (cityName is null && street is null && house is null)
        {
            return null;
        }

        return new ResolvedAddressResult(
            countryCode,
            regionName,
            cityName,
            street,
            house,
            resolvedLatitude,
            resolvedLongitude);
    }

    private async Task<City?> ResolveCityAsync(
        ReverseGeocodingAddress? reverse,
        decimal latitude,
        decimal longitude,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(reverse?.CityName))
        {
            var cityName = reverse.CityName.Trim();
            var countryCode = string.IsNullOrWhiteSpace(reverse.CountryCode) ? "RU" : reverse.CountryCode.Trim().ToUpperInvariant();
            var regionName = string.IsNullOrWhiteSpace(reverse.RegionName) ? "Unknown" : reverse.RegionName.Trim();

            var existing = await dbContext.Cities
                .FirstOrDefaultAsync(
                    x => x.CountryCode.ToLower() == countryCode.ToLower()
                         && x.CityName.ToLower() == cityName.ToLower(),
                    cancellationToken);
            if (existing is not null)
            {
                return existing;
            }

            var city = new City
            {
                CountryCode = countryCode,
                RegionName = regionName,
                CityName = cityName,
                Latitude = reverse.Latitude ?? latitude,
                Longitude = reverse.Longitude ?? longitude
            };
            dbContext.Cities.Add(city);
            await dbContext.SaveChangesAsync(cancellationToken);
            return city;
        }

        return await dbContext.Cities
            .Where(x => x.Latitude != null && x.Longitude != null)
            .OrderBy(x =>
                Math.Abs(x.Latitude!.Value - latitude) +
                Math.Abs(x.Longitude!.Value - longitude))
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<City?> ResolveNearestCityAsync(decimal latitude, decimal longitude, CancellationToken cancellationToken)
        => await dbContext.Cities
            .AsNoTracking()
            .Where(x => x.Latitude != null && x.Longitude != null)
            .OrderBy(x =>
                Math.Abs(x.Latitude!.Value - latitude) +
                Math.Abs(x.Longitude!.Value - longitude))
            .FirstOrDefaultAsync(cancellationToken);

    private async Task<LocationEntity?> FindLocationAsync(long cityId, decimal latitude, decimal longitude, CancellationToken cancellationToken)
    {
        var pointLatitude = (double)latitude;
        var pointLongitude = (double)longitude;
        return await dbContext.Locations
            .FirstOrDefaultAsync(
                x => x.CityId == cityId
                     && x.GeoPoint.Y == pointLatitude
                     && x.GeoPoint.X == pointLongitude,
                cancellationToken);
    }

    private static string? CleanText(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
