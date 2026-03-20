using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Opportunities;

namespace Monolith.Controllers;

[ApiController]
[Route("map")]
[Produces("application/json")]
public class MapController(AppDbContext dbContext) : ControllerBase
{
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
                    CityName = x.City != null ? x.City.CityName : (x.Location != null ? x.Location.City.CityName : "Unknown"),
                    Lat = x.City != null ? x.City.Latitude : (x.Location != null ? x.Location.City.Latitude : null),
                    Lng = x.City != null ? x.City.Longitude : (x.Location != null ? x.Location.City.Longitude : null),
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
                    CityName = x.City != null ? x.City.CityName : (x.Location != null ? x.Location.City.CityName : "Unknown"),
                    Lat = x.City != null ? x.City.Latitude : (x.Location != null ? x.Location.City.Latitude : null),
                    Lng = x.City != null ? x.City.Longitude : (x.Location != null ? x.Location.City.Longitude : null),
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
                    (x.City != null && x.City.Latitude >= bounds.MinLat) ||
                    (x.Location != null && x.Location.City.Latitude >= bounds.MinLat));
            }

            if (bounds.MaxLat is not null)
            {
                vacancies = vacancies.Where(x =>
                    (x.City != null && x.City.Latitude <= bounds.MaxLat) ||
                    (x.Location != null && x.Location.City.Latitude <= bounds.MaxLat));
            }

            if (bounds.MinLng is not null)
            {
                vacancies = vacancies.Where(x =>
                    (x.City != null && x.City.Longitude >= bounds.MinLng) ||
                    (x.Location != null && x.Location.City.Longitude >= bounds.MinLng));
            }

            if (bounds.MaxLng is not null)
            {
                vacancies = vacancies.Where(x =>
                    (x.City != null && x.City.Longitude <= bounds.MaxLng) ||
                    (x.Location != null && x.Location.City.Longitude <= bounds.MaxLng));
            }

            return (IQueryable<T>)vacancies;
        }

        var opportunities = (IQueryable<Opportunity>)query;
        if (bounds.MinLat is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.City != null && x.City.Latitude >= bounds.MinLat) ||
                (x.Location != null && x.Location.City.Latitude >= bounds.MinLat));
        }

        if (bounds.MaxLat is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.City != null && x.City.Latitude <= bounds.MaxLat) ||
                (x.Location != null && x.Location.City.Latitude <= bounds.MaxLat));
        }

        if (bounds.MinLng is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.City != null && x.City.Longitude >= bounds.MinLng) ||
                (x.Location != null && x.Location.City.Longitude >= bounds.MinLng));
        }

        if (bounds.MaxLng is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.City != null && x.City.Longitude <= bounds.MaxLng) ||
                (x.Location != null && x.Location.City.Longitude <= bounds.MaxLng));
        }

        return (IQueryable<T>)opportunities;
    }
}
