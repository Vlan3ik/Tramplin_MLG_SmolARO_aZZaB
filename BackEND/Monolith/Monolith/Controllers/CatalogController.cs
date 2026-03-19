using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Models.Catalog;
using Monolith.Models.Common;

namespace Monolith.Controllers;

/// <summary>
/// Публичные справочники платформы (города, локации, теги).
/// </summary>
[ApiController]
[Route("catalog")]
[Produces("application/json")]
public class CatalogController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает справочник городов с пагинацией и поиском.
    /// </summary>
    /// <param name="page">Номер страницы (начиная с 1).</param>
    /// <param name="pageSize">Размер страницы (максимум 100).</param>
    /// <param name="search">Поиск по названию города и региона.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Пагинированный список городов.</returns>
    [HttpGet("cities")]
    [ProducesResponseType(typeof(PagedResponse<CityListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<CityListItemDto>>> GetCities(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = page <= 0 ? 1 : page;
        var safePageSize = pageSize <= 0 ? 50 : Math.Min(pageSize, 100);
        var query = dbContext.Cities.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x => x.CityName.ToLower().Contains(term) || x.RegionName.ToLower().Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderBy(x => x.CityName)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new CityListItemDto(x.Id, x.CityName, x.RegionName, x.CountryCode, x.Latitude, x.Longitude))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<CityListItemDto>(rows, total, safePage, safePageSize));
    }

    /// <summary>
    /// Возвращает справочник локаций с пагинацией и фильтрацией.
    /// </summary>
    /// <param name="page">Номер страницы (начиная с 1).</param>
    /// <param name="pageSize">Размер страницы (максимум 100).</param>
    /// <param name="cityId">Фильтр по идентификатору города.</param>
    /// <param name="search">Поиск по городу, улице или номеру дома.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Пагинированный список локаций.</returns>
    [HttpGet("locations")]
    [ProducesResponseType(typeof(PagedResponse<LocationListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<LocationListItemDto>>> GetLocations(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] long? cityId = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = page <= 0 ? 1 : page;
        var safePageSize = pageSize <= 0 ? 50 : Math.Min(pageSize, 100);
        var query = dbContext.Locations.AsNoTracking().Include(x => x.City).AsQueryable();

        if (cityId is not null)
        {
            query = query.Where(x => x.CityId == cityId);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                (x.StreetName != null && x.StreetName.ToLower().Contains(term)) ||
                (x.HouseNumber != null && x.HouseNumber.ToLower().Contains(term)) ||
                x.City.CityName.ToLower().Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderBy(x => x.City.CityName)
            .ThenBy(x => x.StreetName)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new LocationListItemDto(x.Id, x.CityId, x.City.CityName, x.StreetName, x.HouseNumber))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<LocationListItemDto>(rows, total, safePage, safePageSize));
    }

    /// <summary>
    /// Возвращает группы тегов.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Список групп тегов.</returns>
    [HttpGet("tag-groups")]
    [ProducesResponseType(typeof(IReadOnlyCollection<TagGroupListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<TagGroupListItemDto>>> GetTagGroups(CancellationToken cancellationToken)
    {
        var rows = await dbContext.TagGroups
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new TagGroupListItemDto(x.Id, x.Code, x.Name))
            .ToListAsync(cancellationToken);
        return Ok(rows);
    }

    /// <summary>
    /// Возвращает теги.
    /// </summary>
    /// <param name="groupId">Опциональный фильтр по группе тегов.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Список тегов.</returns>
    [HttpGet("tags")]
    [ProducesResponseType(typeof(IReadOnlyCollection<TagListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<TagListItemDto>>> GetTags([FromQuery] long? groupId, CancellationToken cancellationToken)
    {
        var query = dbContext.Tags.AsNoTracking().Include(x => x.Group).AsQueryable();
        if (groupId is not null)
        {
            query = query.Where(x => x.GroupId == groupId);
        }

        var rows = await query
            .OrderBy(x => x.Name)
            .Select(x => new TagListItemDto(x.Id, x.GroupId, x.Group.Code, x.Name, x.Slug))
            .ToListAsync(cancellationToken);
        return Ok(rows);
    }
}
