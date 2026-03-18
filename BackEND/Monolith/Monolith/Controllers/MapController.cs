using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Models.Opportunities;
using Monolith.Entities;
using Monolith.Contexts;

namespace Monolith.Controllers;

[ApiController]
[Route("map")]
[Produces("application/json")]
public class MapController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает набор гео-объектов возможностей в формате GeoJSON.
    /// </summary>
    /// <remarks>
    /// В ответе формируется FeatureCollection c координатами и краткими свойствами карточек.
    /// Поддерживаются фильтры по территории, типу, формату, тегам, зарплате и верификации компании.
    /// </remarks>
    /// <param name="query">Параметры фильтрации и границ карты.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>GeoJSON FeatureCollection.</returns>
    [HttpGet("opportunities")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMapData([FromQuery] MapQuery query, CancellationToken cancellationToken)
    {
        var opportunities = dbContext.Opportunities
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.OpportunityTags)
                .ThenInclude(x => x.Tag)
            .Where(x => x.Status == OpportunityStatus.Published);

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

        if (query.Types is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.Types.Contains(x.OppType));
        }

        if (query.Formats is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => query.Formats.Contains(x.Format));
        }

        if (query.TagIds is { Length: > 0 })
        {
            opportunities = opportunities.Where(x => x.OpportunityTags.Any(t => query.TagIds.Contains(t.TagId)));
        }

        if (query.SalaryFrom is not null)
        {
            opportunities = opportunities.Where(x => x.SalaryTo == null || x.SalaryTo >= query.SalaryFrom);
        }

        if (query.SalaryTo is not null)
        {
            opportunities = opportunities.Where(x => x.SalaryFrom == null || x.SalaryFrom <= query.SalaryTo);
        }

        if (query.VerifiedOnly == true)
        {
            opportunities = opportunities.Where(x => x.Company.Status == CompanyStatus.Verified);
        }

        if (query.MinLat is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.City != null && x.City.Latitude >= query.MinLat) ||
                (x.Location != null && x.Location.City.Latitude >= query.MinLat));
        }

        if (query.MaxLat is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.City != null && x.City.Latitude <= query.MaxLat) ||
                (x.Location != null && x.Location.City.Latitude <= query.MaxLat));
        }

        if (query.MinLng is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.City != null && x.City.Longitude >= query.MinLng) ||
                (x.Location != null && x.Location.City.Longitude >= query.MinLng));
        }

        if (query.MaxLng is not null)
        {
            opportunities = opportunities.Where(x =>
                (x.City != null && x.City.Longitude <= query.MaxLng) ||
                (x.Location != null && x.Location.City.Longitude <= query.MaxLng));
        }

        var rows = await opportunities
            .OrderByDescending(x => x.PublishAt)
            .Select(x => new
            {
                x.Id,
                x.Title,
                x.ShortDescription,
                x.OppType,
                x.Format,
                x.SalaryFrom,
                x.SalaryTo,
                x.CurrencyCode,
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
                Tags = x.OpportunityTags.Select(t => t.Tag.Name).ToArray()
            })
            .ToListAsync(cancellationToken);

        var features = rows
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
                    title = x.Title,
                    shortDescription = x.ShortDescription,
                    type = x.OppType.ToString().ToLowerInvariant(),
                    format = x.Format.ToString().ToLowerInvariant(),
                    publishAt = x.PublishAt,
                    salaryFrom = x.SalaryFrom,
                    salaryTo = x.SalaryTo,
                    currencyCode = x.CurrencyCode,
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
            });

        return Ok(new
        {
            type = "FeatureCollection",
            features
        });
    }
}
