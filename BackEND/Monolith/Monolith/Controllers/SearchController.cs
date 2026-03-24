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
        var includeProfiles = parsedTypes.Count == 0 || parsedTypes.Contains(SearchSuggestEntityType.Profile);

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
                Math.Max(x.TitleSimilarity, x.CompanySimilarity),
                null)));
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
                Math.Max(x.TitleSimilarity, x.CompanySimilarity),
                null)));
        }

        if (includeProfiles)
        {
            var profileRows = await dbContext.Users
                .AsNoTracking()
                .Where(x => x.Status == AccountStatus.Active)
                .Where(x =>
                    EF.Functions.ILike(x.Username, like) ||
                    EF.Functions.ILike(x.DisplayName, like) ||
                    (x.CandidateProfile != null && (
                        EF.Functions.ILike(x.CandidateProfile.FirstName, like) ||
                        EF.Functions.ILike(x.CandidateProfile.LastName, like) ||
                        (x.CandidateProfile.MiddleName != null && EF.Functions.ILike(x.CandidateProfile.MiddleName, like)))))
                .Select(x => new
                {
                    x.Id,
                    x.Username,
                    x.DisplayName,
                    FirstName = x.CandidateProfile != null ? x.CandidateProfile.FirstName : null,
                    LastName = x.CandidateProfile != null ? x.CandidateProfile.LastName : null,
                    x.UpdatedAt,
                    UsernameSimilarity = EF.Functions.TrigramsSimilarity(x.Username, normalizedQuery),
                    DisplayNameSimilarity = EF.Functions.TrigramsSimilarity(x.DisplayName, normalizedQuery)
                })
                .OrderByDescending(x => x.UsernameSimilarity)
                .ThenByDescending(x => x.DisplayNameSimilarity)
                .ThenByDescending(x => x.UpdatedAt)
                .Take(safeLimit * 2)
                .ToListAsync(cancellationToken);

            items.AddRange(profileRows.Select(x =>
            {
                var fio = $"{x.FirstName} {x.LastName}".Trim();
                var title = !string.IsNullOrWhiteSpace(x.DisplayName)
                    ? x.DisplayName
                    : !string.IsNullOrWhiteSpace(fio)
                        ? fio
                        : x.Username;

                return new SearchSuggestItemDto(
                    SearchSuggestEntityType.Profile,
                    x.Id,
                    title,
                    string.Empty,
                    string.Empty,
                    x.UpdatedAt,
                    Math.Max(x.UsernameSimilarity, x.DisplayNameSimilarity),
                    x.Username);
            }));
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

    /// <summary>
    /// Подсказки для выбора вакансий в коллаборациях проектов портфолио.
    /// </summary>
    [HttpGet("suggest/vacancies")]
    [ProducesResponseType(typeof(SearchSuggestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SearchSuggestResponse>> SuggestVacancies(
        [FromQuery] string? q,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuery = q?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedQuery) || normalizedQuery.Length < 1)
        {
            return BadRequest(new ErrorResponse("search.query.too_short", "Parameter q must contain at least 1 character."));
        }

        var safeLimit = Math.Clamp(limit, 1, 20);
        var like = $"%{EscapeLikePattern(normalizedQuery)}%";
        var cacheKey = $"search:suggest:collab:vacancies:{normalizedQuery.ToLowerInvariant()}:{safeLimit}";
        if (memoryCache.TryGetValue<SearchSuggestResponse>(cacheKey, out var cached) && cached is not null)
        {
            return Ok(cached);
        }

        var rows = await dbContext.Vacancies
            .AsNoTracking()
            .Where(x =>
                EF.Functions.ILike(x.Title, like) ||
                EF.Functions.ILike(x.ShortDescription, like) ||
                EF.Functions.ILike(x.FullDescription, like) ||
                EF.Functions.ILike(x.Company.LegalName, like) ||
                (x.Company.BrandName != null && EF.Functions.ILike(x.Company.BrandName, like)) ||
                (x.City != null && EF.Functions.ILike(x.City.CityName, like)) ||
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
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var response = new SearchSuggestResponse(
            normalizedQuery,
            rows.Select(x => new SearchSuggestItemDto(
                SearchSuggestEntityType.Vacancy,
                x.Id,
                x.Title,
                x.CompanyName,
                x.LocationName,
                x.PublishAt,
                Math.Max(x.TitleSimilarity, x.CompanySimilarity),
                null)).ToArray());

        memoryCache.Set(cacheKey, response, TimeSpan.FromSeconds(20));
        return Ok(response);
    }

    /// <summary>
    /// Подсказки для выбора мероприятий в коллаборациях проектов портфолио.
    /// </summary>
    [HttpGet("suggest/opportunities")]
    [ProducesResponseType(typeof(SearchSuggestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SearchSuggestResponse>> SuggestOpportunities(
        [FromQuery] string? q,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuery = q?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedQuery) || normalizedQuery.Length < 1)
        {
            return BadRequest(new ErrorResponse("search.query.too_short", "Parameter q must contain at least 1 character."));
        }

        var safeLimit = Math.Clamp(limit, 1, 20);
        var like = $"%{EscapeLikePattern(normalizedQuery)}%";
        var cacheKey = $"search:suggest:collab:opportunities:{normalizedQuery.ToLowerInvariant()}:{safeLimit}";
        if (memoryCache.TryGetValue<SearchSuggestResponse>(cacheKey, out var cached) && cached is not null)
        {
            return Ok(cached);
        }

        var rows = await dbContext.Opportunities
            .AsNoTracking()
            .Where(x =>
                EF.Functions.ILike(x.Title, like) ||
                EF.Functions.ILike(x.ShortDescription, like) ||
                EF.Functions.ILike(x.FullDescription, like) ||
                EF.Functions.ILike(x.Company.LegalName, like) ||
                (x.Company.BrandName != null && EF.Functions.ILike(x.Company.BrandName, like)) ||
                (x.City != null && EF.Functions.ILike(x.City.CityName, like)) ||
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
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var response = new SearchSuggestResponse(
            normalizedQuery,
            rows.Select(x => new SearchSuggestItemDto(
                SearchSuggestEntityType.Opportunity,
                x.Id,
                x.Title,
                x.CompanyName,
                x.LocationName,
                x.PublishAt,
                Math.Max(x.TitleSimilarity, x.CompanySimilarity),
                null)).ToArray());

        memoryCache.Set(cacheKey, response, TimeSpan.FromSeconds(20));
        return Ok(response);
    }

    /// <summary>
    /// Подсказки для выбора пользователей в участниках/коллаборациях проектов.
    /// </summary>
    [HttpGet("suggest/profiles")]
    [ProducesResponseType(typeof(SearchSuggestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SearchSuggestResponse>> SuggestProfiles(
        [FromQuery] string? q,
        [FromQuery] int limit = 10,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuery = q?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedQuery) || normalizedQuery.Length < 1)
        {
            return BadRequest(new ErrorResponse("search.query.too_short", "Parameter q must contain at least 1 character."));
        }

        var safeLimit = Math.Clamp(limit, 1, 20);
        var like = $"%{EscapeLikePattern(normalizedQuery)}%";
        var cacheKey = $"search:suggest:collab:profiles:{normalizedQuery.ToLowerInvariant()}:{safeLimit}";
        if (memoryCache.TryGetValue<SearchSuggestResponse>(cacheKey, out var cached) && cached is not null)
        {
            return Ok(cached);
        }

        var isNumeric = long.TryParse(normalizedQuery, out var numericId);

        var rows = await dbContext.Users
            .AsNoTracking()
            .Where(x =>
                EF.Functions.ILike(x.Username, like) ||
                EF.Functions.ILike(x.DisplayName, like) ||
                (x.CandidateProfile != null && (
                    EF.Functions.ILike(x.CandidateProfile.FirstName, like) ||
                    EF.Functions.ILike(x.CandidateProfile.LastName, like) ||
                    (x.CandidateProfile.MiddleName != null && EF.Functions.ILike(x.CandidateProfile.MiddleName, like))
                )) ||
                (isNumeric && x.Id == numericId))
            .Select(x => new
            {
                x.Id,
                x.Username,
                x.DisplayName,
                FirstName = x.CandidateProfile != null ? x.CandidateProfile.FirstName : null,
                LastName = x.CandidateProfile != null ? x.CandidateProfile.LastName : null,
                x.UpdatedAt,
                UsernameSimilarity = EF.Functions.TrigramsSimilarity(x.Username, normalizedQuery),
                DisplayNameSimilarity = EF.Functions.TrigramsSimilarity(x.DisplayName, normalizedQuery)
            })
            .OrderByDescending(x => x.UsernameSimilarity)
            .ThenByDescending(x => x.DisplayNameSimilarity)
            .ThenByDescending(x => x.UpdatedAt)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var response = new SearchSuggestResponse(
            normalizedQuery,
            rows.Select(x =>
            {
                var fio = $"{x.FirstName} {x.LastName}".Trim();
                var title = !string.IsNullOrWhiteSpace(x.DisplayName)
                    ? x.DisplayName
                    : !string.IsNullOrWhiteSpace(fio)
                        ? fio
                        : x.Username;

                return new SearchSuggestItemDto(
                    SearchSuggestEntityType.Profile,
                    x.Id,
                    title,
                    string.Empty,
                    string.Empty,
                    x.UpdatedAt,
                    Math.Max(x.UsernameSimilarity, x.DisplayNameSimilarity),
                    x.Username);
            }).ToArray());

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
                case "profile":
                    result.Add(SearchSuggestEntityType.Profile);
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
