using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Search;

namespace Monolith.Controllers;

[ApiController]
[Route("search")]
[Produces("application/json")]
public class SearchController(AppDbContext dbContext, IMemoryCache memoryCache) : ControllerBase
{
    /// <summary>
    /// Возвращает подсказки поиска по вакансиям и возможностям.
    /// </summary>
    /// <param name="q">Текст запроса (минимум 2 символа).</param>
    /// <param name="limit">Размер ответа (1..20).</param>
    /// <param name="types">Массив query-параметров: types=vacancy&amp;types=opportunity.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    [HttpGet("suggest")]
    [ProducesResponseType(typeof(SearchSuggestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SearchSuggestResponse>> Suggest(
        [FromQuery] string? q,
        [FromQuery] int limit = 10,
        [FromQuery] string[]? types = null,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuery = q?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedQuery) || normalizedQuery.Length < 2)
        {
            return BadRequest(new ErrorResponse("search.query.too_short", "Parameter q must contain at least 2 characters."));
        }

        var safeLimit = Math.Clamp(limit, 1, 20);
        var parsedTypes = ParseTypes(types ?? Array.Empty<string>());
        var includeVacancies = parsedTypes.Count == 0 || parsedTypes.Contains(SearchSuggestEntityType.Vacancy);
        var includeOpportunities = parsedTypes.Count == 0 || parsedTypes.Contains(SearchSuggestEntityType.Opportunity);

        var cacheKey = $"search:suggest:{normalizedQuery.ToLowerInvariant()}:{safeLimit}:{string.Join(",", parsedTypes.OrderBy(x => x))}";
        if (memoryCache.TryGetValue<SearchSuggestResponse>(cacheKey, out var cached) && cached is not null)
        {
            return Ok(cached);
        }

        var like = $"%{EscapeLikePattern(normalizedQuery)}%";
        var items = new List<SearchSuggestItemDto>(safeLimit * 4);

        if (includeVacancies)
        {
            var vacancyRows = await dbContext.Vacancies
                .AsNoTracking()
                .Where(x => x.Status == OpportunityStatus.Active)
                .Where(x =>
                    EF.Functions.ILike(x.Title, like) ||
                    EF.Functions.ILike(x.ShortDescription, like) ||
                    EF.Functions.ILike(x.FullDescription, like) ||
                    EF.Functions.ILike(x.Company.LegalName, like) ||
                    (x.Company.BrandName != null && EF.Functions.ILike(x.Company.BrandName, like)) ||
                    (x.City != null && EF.Functions.ILike(x.City.CityName, like)) ||
                    (x.Location != null && x.Location.StreetName != null && EF.Functions.ILike(x.Location.StreetName, like)) ||
                    (x.Location != null && x.Location.HouseNumber != null && EF.Functions.ILike(x.Location.HouseNumber, like)) ||
                    x.VacancyTags.Any(t => EF.Functions.ILike(t.Tag.Name, like)) ||
                    EF.Functions.TrigramsAreSimilar(x.Title, normalizedQuery) ||
                    EF.Functions.TrigramsAreSimilar(x.Company.LegalName, normalizedQuery))
                .Select(x => new
                {
                    x.Id,
                    x.Title,
                    CompanyName = x.Company.BrandName ?? x.Company.LegalName,
                    LocationName = x.City != null ? x.City.CityName : (x.Location != null ? x.Location.City.CityName : "Unknown"),
                    x.PublishAt,
                    TitleSimilarity = EF.Functions.TrigramsSimilarity(x.Title, normalizedQuery),
                    CompanySimilarity = EF.Functions.TrigramsSimilarity(x.Company.LegalName, normalizedQuery)
                })
                .OrderByDescending(x => x.TitleSimilarity)
                .ThenByDescending(x => x.CompanySimilarity)
                .ThenByDescending(x => x.PublishAt)
                .Take(safeLimit * 2)
                .ToListAsync(cancellationToken);

            items.AddRange(vacancyRows.Select(x => new SearchSuggestItemDto(
                SearchSuggestEntityType.Vacancy,
                x.Id,
                x.Title,
                x.CompanyName,
                x.LocationName,
                x.PublishAt,
                Math.Max(x.TitleSimilarity, x.CompanySimilarity))));
        }

        if (includeOpportunities)
        {
            var opportunityRows = await dbContext.Opportunities
                .AsNoTracking()
                .Where(x => x.Status == OpportunityStatus.Active)
                .Where(x =>
                    EF.Functions.ILike(x.Title, like) ||
                    EF.Functions.ILike(x.ShortDescription, like) ||
                    EF.Functions.ILike(x.FullDescription, like) ||
                    EF.Functions.ILike(x.Company.LegalName, like) ||
                    (x.Company.BrandName != null && EF.Functions.ILike(x.Company.BrandName, like)) ||
                    (x.City != null && EF.Functions.ILike(x.City.CityName, like)) ||
                    (x.Location != null && x.Location.StreetName != null && EF.Functions.ILike(x.Location.StreetName, like)) ||
                    (x.Location != null && x.Location.HouseNumber != null && EF.Functions.ILike(x.Location.HouseNumber, like)) ||
                    x.OpportunityTags.Any(t => EF.Functions.ILike(t.Tag.Name, like)) ||
                    EF.Functions.TrigramsAreSimilar(x.Title, normalizedQuery) ||
                    EF.Functions.TrigramsAreSimilar(x.Company.LegalName, normalizedQuery))
                .Select(x => new
                {
                    x.Id,
                    x.Title,
                    CompanyName = x.Company.BrandName ?? x.Company.LegalName,
                    LocationName = x.City != null ? x.City.CityName : (x.Location != null ? x.Location.City.CityName : "Unknown"),
                    x.PublishAt,
                    TitleSimilarity = EF.Functions.TrigramsSimilarity(x.Title, normalizedQuery),
                    CompanySimilarity = EF.Functions.TrigramsSimilarity(x.Company.LegalName, normalizedQuery)
                })
                .OrderByDescending(x => x.TitleSimilarity)
                .ThenByDescending(x => x.CompanySimilarity)
                .ThenByDescending(x => x.PublishAt)
                .Take(safeLimit * 2)
                .ToListAsync(cancellationToken);

            items.AddRange(opportunityRows.Select(x => new SearchSuggestItemDto(
                SearchSuggestEntityType.Opportunity,
                x.Id,
                x.Title,
                x.CompanyName,
                x.LocationName,
                x.PublishAt,
                Math.Max(x.TitleSimilarity, x.CompanySimilarity))));
        }

        var response = new SearchSuggestResponse(
            normalizedQuery,
            items
                .OrderByDescending(x => x.Score)
                .ThenByDescending(x => x.PublishAt)
                .Take(safeLimit)
                .ToArray());

        memoryCache.Set(cacheKey, response, TimeSpan.FromSeconds(20));
        return Ok(response);
    }

    private static HashSet<SearchSuggestEntityType> ParseTypes(IEnumerable<string> rawValues)
    {
        var result = new HashSet<SearchSuggestEntityType>();
        foreach (var raw in rawValues)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                continue;
            }

            switch (raw.Trim().ToLowerInvariant())
            {
                case "vacancy":
                    result.Add(SearchSuggestEntityType.Vacancy);
                    break;
                case "opportunity":
                    result.Add(SearchSuggestEntityType.Opportunity);
                    break;
            }
        }

        return result;
    }

    private static string EscapeLikePattern(string value)
        => value
            .Replace(@"\", @"\\", StringComparison.Ordinal)
            .Replace("%", @"\%", StringComparison.Ordinal)
            .Replace("_", @"\_", StringComparison.Ordinal);
}
