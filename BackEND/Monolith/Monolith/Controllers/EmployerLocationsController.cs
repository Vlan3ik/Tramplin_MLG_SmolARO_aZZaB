using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Models.Common;
using Monolith.Models.Employer;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "employer")]
[Route("employer/locations")]
[Produces("application/json")]
public class EmployerLocationsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("cities")]
    [ProducesResponseType(typeof(IReadOnlyCollection<EmployerAddressCitySuggestionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<EmployerAddressCitySuggestionDto>>> GetCities(
        [FromQuery] string query,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        var term = query?.Trim();
        if (string.IsNullOrWhiteSpace(term))
        {
            return Ok(Array.Empty<EmployerAddressCitySuggestionDto>());
        }

        var normalizedLimit = Math.Clamp(limit, 1, 20);
        var items = await dbContext.Cities
            .AsNoTracking()
            .Where(x => x.CityName.ToLower().Contains(term.ToLower()))
            .OrderBy(x => x.CityName)
            .Take(normalizedLimit)
            .Select(x => new EmployerAddressCitySuggestionDto(x.Id, x.CityName, x.RegionName, x.CountryCode))
            .ToListAsync(cancellationToken);

        return Ok(items);
    }

    [HttpGet("streets")]
    [ProducesResponseType(typeof(IReadOnlyCollection<EmployerAddressStreetSuggestionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyCollection<EmployerAddressStreetSuggestionDto>>> GetStreets(
        [FromQuery] long cityId,
        [FromQuery] string query,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        if (cityId <= 0)
        {
            return this.ToBadRequestError("employer.locations.city_id_invalid", "cityId must be > 0.");
        }

        var term = query?.Trim();
        if (string.IsNullOrWhiteSpace(term))
        {
            return Ok(Array.Empty<EmployerAddressStreetSuggestionDto>());
        }

        var normalizedLimit = Math.Clamp(limit, 1, 20);
        var items = await dbContext.Locations
            .AsNoTracking()
            .Where(x => x.CityId == cityId && x.StreetName != null && x.StreetName.ToLower().Contains(term.ToLower()))
            .Select(x => x.StreetName!)
            .Distinct()
            .OrderBy(x => x)
            .Take(normalizedLimit)
            .Select(x => new EmployerAddressStreetSuggestionDto(x))
            .ToListAsync(cancellationToken);

        return Ok(items);
    }

    [HttpGet("houses")]
    [ProducesResponseType(typeof(IReadOnlyCollection<EmployerAddressHouseSuggestionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyCollection<EmployerAddressHouseSuggestionDto>>> GetHouses(
        [FromQuery] long cityId,
        [FromQuery] string streetName,
        [FromQuery] string? query = null,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        if (cityId <= 0)
        {
            return this.ToBadRequestError("employer.locations.city_id_invalid", "cityId must be > 0.");
        }

        var street = streetName?.Trim();
        if (string.IsNullOrWhiteSpace(street))
        {
            return this.ToBadRequestError("employer.locations.street_required", "streetName is required.");
        }

        var houseQuery = query?.Trim();
        var normalizedLimit = Math.Clamp(limit, 1, 20);
        var houses = dbContext.Locations
            .AsNoTracking()
            .Where(x => x.CityId == cityId && x.StreetName == street && x.HouseNumber != null);

        if (!string.IsNullOrWhiteSpace(houseQuery))
        {
            houses = houses.Where(x => x.HouseNumber!.ToLower().Contains(houseQuery.ToLower()));
        }

        var items = await houses
            .Select(x => x.HouseNumber!)
            .Distinct()
            .OrderBy(x => x)
            .Take(normalizedLimit)
            .Select(x => new EmployerAddressHouseSuggestionDto(x))
            .ToListAsync(cancellationToken);

        return Ok(items);
    }
}
