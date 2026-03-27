using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Map;
using Monolith.Models.Opportunities;
using Monolith.Services.Geo;

namespace Monolith.Controllers;

[ApiController]
[Route("map")]
[Produces("application/json")]
public class MapController(AppDbContext dbContext, IEmployerLocationService employerLocationService) : ControllerBase
{
    /// <summary>
    /// Определяет адрес по координатам.
    /// </summary>
    /// <param name="latitude">Широта точки.</param>
    /// <param name="longitude">Долгота точки.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    /// <returns>Нормализованный адрес для переданных координат.</returns>
    [HttpGet("reverse-geocode")]
    [ProducesResponseType(typeof(MapReverseGeocodeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MapReverseGeocodeResponse>> ReverseGeocode(
        [FromQuery] decimal latitude,
        [FromQuery] decimal longitude,
        CancellationToken cancellationToken)
    {
        if (latitude is < -90 or > 90)
        {
            return BadRequest(new { code = "map.invalid_latitude", message = "latitude must be between -90 and 90." });
        }

        if (longitude is < -180 or > 180)
        {
            return BadRequest(new { code = "map.invalid_longitude", message = "longitude must be between -180 and 180." });
        }

        var result = await employerLocationService.ResolveAddressAsync(latitude, longitude, cancellationToken);
        if (result is null)
        {
            return NotFound(new { code = "map.address_not_found", message = "Address not found for these coordinates." });
        }

        return Ok(new MapReverseGeocodeResponse(
            latitude,
            longitude,
            result.Latitude,
            result.Longitude,
            result.CountryCode,
            result.RegionName,
            result.CityName,
            result.StreetName,
            result.HouseNumber));
    }

    /// <summary>
    /// Возвращает GeoJSON-коллекцию активных вакансий и возможностей для карты.
    /// </summary>
    /// <param name="query">Параметры фильтрации карточек на карте.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>GeoJSON FeatureCollection с точками публикаций.</returns>
    [HttpGet("opportunities")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMapData([FromQuery] MapQuery query, CancellationToken cancellationToken)
    {
        var includeVacancies = query.EntityTypes is null || query.EntityTypes.Length == 0 || query.EntityTypes.Contains(MapEntityType.Vacancy);
        var includeOpportunities = query.EntityTypes is null || query.EntityTypes.Length == 0 || query.EntityTypes.Contains(MapEntityType.Opportunity);

        var features = new List<object>();

        if (includeVacancies)
        {
            var vacancies = BuildVacancyQuery(query);
            var vacancyRows = await vacancies
                .OrderByDescending(x => x.PublishAt)
                .Select(x => new
                {
                    x.Id,
                    x.Title,
                    x.ShortDescription,
                    x.Kind,
                    x.Format,
                    x.SalaryFrom,
                    x.SalaryTo,
                    x.CurrencyCode,
                    x.SalaryTaxMode,
                    x.PublishAt,
                    CompanyId = x.CompanyId,
                    CompanyName = x.Company.BrandName ?? x.Company.LegalName,
                    Verified = x.Company.Status == CompanyStatus.Verified,
                    CityId = x.City != null ? x.City.Id : (x.Location != null ? x.Location.City.Id : 0),
                    CityName = x.Location != null ? x.Location.City.CityName : (x.City != null ? x.City.CityName : "Unknown"),
                    Lat = x.Location != null ? (decimal?)x.Location.GeoPoint.Y : (x.City != null ? x.City.Latitude : null),
                    Lng = x.Location != null ? (decimal?)x.Location.GeoPoint.X : (x.City != null ? x.City.Longitude : null),
                    Street = x.Location != null ? x.Location.StreetName : null,
                    House = x.Location != null ? x.Location.HouseNumber : null,
                    Tags = x.VacancyTags.Select(t => t.Tag.Name).ToArray()
                })
                .ToListAsync(cancellationToken);

            features.AddRange(vacancyRows
                .Where(x => x.Lat is not null && x.Lng is not null)
                .Select(x => new
                {
                    type = "Feature",
                    geometry = new
                    {
                        type = "Point",
                        coordinates = new[] { x.Lng!.Value, x.Lat!.Value }
                    },
                    properties = new
                    {
                        id = x.Id,
                        entityType = "vacancy",
                        title = x.Title,
                        shortDescription = x.ShortDescription,
                        kind = x.Kind.ToString().ToLowerInvariant(),
                        format = x.Format.ToString().ToLowerInvariant(),
                        publishAt = x.PublishAt,
                        salaryFrom = x.SalaryFrom,
                        salaryTo = x.SalaryTo,
                        currencyCode = x.CurrencyCode,
                        salaryTaxMode = x.SalaryTaxMode.ToString().ToLowerInvariant(),
                        company = new
                        {
                            id = x.CompanyId,
                            name = x.CompanyName,
                            verified = x.Verified
                        },
                        location = new
                        {
                            cityId = x.CityId,
                            cityName = x.CityName,
                            street = x.Street,
                            houseNumber = x.House
                        },
                        tags = x.Tags
                    }
                }));
        }

        if (includeOpportunities)
        {
            var opportunities = BuildOpportunityQuery(query);
            var opportunityRows = await opportunities
                .OrderByDescending(x => x.PublishAt)
                .Select(x => new
                {
                    x.Id,
                    x.Title,
                    x.ShortDescription,
                    x.Kind,
                    x.Format,
                    x.PriceType,
                    x.PriceAmount,
                    x.PriceCurrencyCode,
                    x.PublishAt,
                    x.EventDate,
                    x.ParticipantsCanWrite,
                    CompanyId = x.CompanyId,
                    CompanyName = x.Company.BrandName ?? x.Company.LegalName,
                    Verified = x.Company.Status == CompanyStatus.Verified,
                    CityId = x.City != null ? x.City.Id : (x.Location != null ? x.Location.City.Id : 0),
                    CityName = x.Location != null ? x.Location.City.CityName : (x.City != null ? x.City.CityName : "Unknown"),
                    Lat = x.Location != null ? (decimal?)x.Location.GeoPoint.Y : (x.City != null ? x.City.Latitude : null),
                    Lng = x.Location != null ? (decimal?)x.Location.GeoPoint.X : (x.City != null ? x.City.Longitude : null),
                    Street = x.Location != null ? x.Location.StreetName : null,
                    House = x.Location != null ? x.Location.HouseNumber : null,
                    ParticipantsCount = x.Participants.Count,
                    Tags = x.OpportunityTags.Select(t => t.Tag.Name).ToArray()
                })
                .ToListAsync(cancellationToken);

            features.AddRange(opportunityRows
                .Where(x => x.Lat is not null && x.Lng is not null)
                .Select(x => new
                {
                    type = "Feature",
                    geometry = new
                    {
                        type = "Point",
                        coordinates = new[] { x.Lng!.Value, x.Lat!.Value }
                    },
                    properties = new
                    {
                        id = x.Id,
                        entityType = "opportunity",
                        title = x.Title,
                        shortDescription = x.ShortDescription,
                        kind = x.Kind.ToString().ToLowerInvariant(),
                        format = x.Format.ToString().ToLowerInvariant(),
                        publishAt = x.PublishAt,
                        eventDate = x.EventDate,
                        priceType = x.PriceType.ToString().ToLowerInvariant(),
                        priceAmount = x.PriceAmount,
                        priceCurrencyCode = x.PriceCurrencyCode,
                        participantsCanWrite = x.ParticipantsCanWrite,
                        participantsCount = x.ParticipantsCount,
                        company = new
                        {
                            id = x.CompanyId,
                            name = x.CompanyName,
                            verified = x.Verified
                        },
                        location = new
                        {
                            cityId = x.CityId,
                            cityName = x.CityName,
                            street = x.Street,
                            houseNumber = x.House
                        },
                        tags = x.Tags
                    }
                }));
        }

        return Ok(new
        {
            type = "FeatureCollection",
            features
        });
    }

    private IQueryable<Vacancy> BuildVacancyQuery(MapQuery query)
    {
        var vacancies = dbContext.Vacancies
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.VacancyTags)
                .ThenInclude(x => x.Tag)
            .Where(x => x.Status == OpportunityStatus.Active);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            vacancies = vacancies.Where(x =>
                x.Title.ToLower().Contains(search) ||
                x.ShortDescription.ToLower().Contains(search) ||
                x.Company.LegalName.ToLower().Contains(search) ||
                (x.Company.BrandName != null && x.Company.BrandName.ToLower().Contains(search)));
        }

        if (query.CityId is not null)
        {
            vacancies = vacancies.Where(x => x.CityId == query.CityId || (x.Location != null && x.Location.CityId == query.CityId));
        }

        if (query.VacancyKinds is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.VacancyKinds.Contains(x.Kind));
        }

        if (query.Formats is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.Formats.Contains(x.Format));
        }

        if (query.TagIds is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => x.VacancyTags.Any(t => query.TagIds.Contains(t.TagId)));
        }

        if (query.SalaryFrom is not null)
        {
            vacancies = vacancies.Where(x => x.SalaryTo == null || x.SalaryTo >= query.SalaryFrom);
        }

        if (query.SalaryTo is not null)
        {
            vacancies = vacancies.Where(x => x.SalaryFrom == null || x.SalaryFrom <= query.SalaryTo);
        }

        if (query.SalaryTaxModes is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.SalaryTaxModes.Contains(x.SalaryTaxMode));
        }

        if (query.VerifiedOnly == true)
        {
            vacancies = vacancies.Where(x => x.Company.Status == CompanyStatus.Verified);
        }

        vacancies = ApplyBounds(vacancies, query);
        return vacancies;
    }

    private IQueryable<Opportunity> BuildOpportunityQuery(MapQuery query)
    {
        var opportunities = dbContext.Opportunities
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.OpportunityTags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.Participants)
            .Where(x => x.Status == OpportunityStatus.Active);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLowerInvariant();
            opportunities = opportunities.Where(x =>
                x.Title.ToLower().Contains(search) ||
                x.ShortDescription.ToLower().Contains(search) ||
                x.Company.LegalName.ToLower().Contains(search) ||
                (x.Company.BrandName != null && x.Company.BrandName.ToLower().Contains(search)));
        }

        if (query.CityId is not null)
        {
            opportunities = opportunities.Where(x => x.CityId == query.CityId || (x.Location != null && x.Location.CityId == query.CityId));
        }

        if (query.OpportunityKinds is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.OpportunityKinds.Contains(x.Kind));
        }

        if (query.Formats is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.Formats.Contains(x.Format));
        }

        if (query.TagIds is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => x.OpportunityTags.Any(t => query.TagIds.Contains(t.TagId)));
        }

        if (query.PriceTypes is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.PriceTypes.Contains(x.PriceType));
        }

        if (query.PriceFrom is not null)
        {
            opportunities = opportunities.Where(x => x.PriceAmount == null || x.PriceAmount >= query.PriceFrom);
        }

        if (query.PriceTo is not null)
        {
            opportunities = opportunities.Where(x => x.PriceAmount == null || x.PriceAmount <= query.PriceTo);
        }

        if (query.VerifiedOnly == true)
        {
            opportunities = opportunities.Where(x => x.Company.Status == CompanyStatus.Verified);
        }

        opportunities = ApplyBounds(opportunities, query);
        return opportunities;
    }

    private static IQueryable<T> ApplyBounds<T>(IQueryable<T> query, MapQuery bounds) where T : class
    {
        if (typeof(T) == typeof(Vacancy))
        {
            var vacancies = (IQueryable<Vacancy>)query;
            if (bounds.MinLat is not null)
            {
                vacancies = vacancies.Where(x =>
                    (x.Location != null && x.Location.GeoPoint.Y >= (double)bounds.MinLat) ||
                    (x.Location == null && x.City != null && x.City.Latitude >= bounds.MinLat));
            }

            if (bounds.MaxLat is not null)
            {
                vacancies = vacancies.Where(x =>
                    (x.Location != null && x.Location.GeoPoint.Y <= (double)bounds.MaxLat) ||
                    (x.Location == null && x.City != null && x.City.Latitude <= bounds.MaxLat));
            }

            if (bounds.MinLng is not null)
            {
                vacancies = vacancies.Where(x =>
                    (x.Location != null && x.Location.GeoPoint.X >= (double)bounds.MinLng) ||
                    (x.Location == null && x.City != null && x.City.Longitude >= bounds.MinLng));
            }

            if (bounds.MaxLng is not null)
            {
                vacancies = vacancies.Where(x =>
                    (x.Location != null && x.Location.GeoPoint.X <= (double)bounds.MaxLng) ||
                    (x.Location == null && x.City != null && x.City.Longitude <= bounds.MaxLng));
            }

            return (IQueryable<T>)vacancies;
        }

        var opportunities = (IQueryable<Opportunity>)query;
        if (bounds.MinLat is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.Location != null && x.Location.GeoPoint.Y >= (double)bounds.MinLat) ||
                (x.Location == null && x.City != null && x.City.Latitude >= bounds.MinLat));
        }

        if (bounds.MaxLat is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.Location != null && x.Location.GeoPoint.Y <= (double)bounds.MaxLat) ||
                (x.Location == null && x.City != null && x.City.Latitude <= bounds.MaxLat));
        }

        if (bounds.MinLng is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.Location != null && x.Location.GeoPoint.X >= (double)bounds.MinLng) ||
                (x.Location == null && x.City != null && x.City.Longitude >= bounds.MinLng));
        }

        if (bounds.MaxLng is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.Location != null && x.Location.GeoPoint.X <= (double)bounds.MaxLng) ||
                (x.Location == null && x.City != null && x.City.Longitude <= bounds.MaxLng));
        }

        return (IQueryable<T>)opportunities;
    }
}
