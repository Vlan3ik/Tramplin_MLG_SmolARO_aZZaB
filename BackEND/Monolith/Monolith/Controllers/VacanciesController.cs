using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Opportunities;
using Monolith.Models.Vacancies;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Route("vacancies")]
[Produces("application/json")]
public class VacanciesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список активных вакансий с фильтрами и пагинацией.
    /// </summary>
    /// <param name="query">Параметры фильтрации и пагинации вакансий.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Пагинированный список вакансий.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<VacancyListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<VacancyListItemDto>>> GetList([FromQuery] VacancyListQuery query, CancellationToken cancellationToken)
    {
        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);
        var currentUserId = TryGetCurrentUserId();
        var viewerTagIds = currentUserId is null
            ? Array.Empty<long>()
            : await dbContext.CandidateResumeSkills
                .AsNoTracking()
                .Where(x => x.UserId == currentUserId.Value)
                .Select(x => x.TagId)
                .ToArrayAsync(cancellationToken);

        var baseQuery = BuildFilteredQuery(query);
        var totalCount = await baseQuery.CountAsync(cancellationToken);
        var rows = await baseQuery
            .Select(x => new
            {
                x.Id,
                x.Title,
                x.Kind,
                x.Format,
                x.CompanyId,
                CompanyName = x.Company.BrandName ?? x.Company.LegalName,
                CompanyLogoUrl = x.Company.LogoUrl,
                CityName = x.City != null ? x.City.CityName : (x.Location != null ? x.Location.City.CityName : "Unknown"),
                x.SalaryFrom,
                x.SalaryTo,
                x.CurrencyCode,
                x.SalaryTaxMode,
                x.PublishAt,
                Verified = x.Company.Status == CompanyStatus.Verified,
                TagMatchCount = viewerTagIds.Length == 0 ? 0 : x.VacancyTags.Count(t => viewerTagIds.Contains(t.TagId)),
                Tags = x.VacancyTags.Select(t => t.Tag.Name).ToArray()
            })
            .OrderByDescending(x => x.TagMatchCount)
            .ThenByDescending(x => x.PublishAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var vacancyIds = rows.Select(x => x.Id).ToArray();
        var favoriteByMeIds = new HashSet<long>();
        var friendFavoriteCounts = new Dictionary<long, int>();
        var friendApplicationCounts = new Dictionary<long, int>();
        if (currentUserId is not null && vacancyIds.Length > 0)
        {
            var favoriteList = await dbContext.UserOpportunityFavorites
                .AsNoTracking()
                .Where(x => x.UserId == currentUserId.Value && x.VacancyId != null && vacancyIds.Contains(x.VacancyId.Value))
                .Select(x => x.VacancyId!.Value)
                .ToListAsync(cancellationToken);
            favoriteByMeIds = favoriteList.ToHashSet();

            var mutualFriendIds = await GetMutualFriendIds(currentUserId.Value, cancellationToken);
            if (mutualFriendIds.Length > 0)
            {
                var visibleFavoritesFriendIds = await FilterVisibleFriendIdsForFavorites(mutualFriendIds, cancellationToken);
                friendFavoriteCounts = await dbContext.UserOpportunityFavorites
                    .AsNoTracking()
                    .Where(x =>
                        x.VacancyId != null &&
                        vacancyIds.Contains(x.VacancyId.Value) &&
                        visibleFavoritesFriendIds.Contains(x.UserId))
                    .GroupBy(x => x.VacancyId!.Value)
                    .Select(x => new { VacancyId = x.Key, Count = x.Count() })
                    .ToDictionaryAsync(x => x.VacancyId, x => x.Count, cancellationToken);

                var visibleApplicationsFriendIds = await FilterVisibleFriendIdsForApplications(mutualFriendIds, cancellationToken);
                friendApplicationCounts = await dbContext.Applications
                    .AsNoTracking()
                    .Where(x =>
                        vacancyIds.Contains(x.VacancyId) &&
                        visibleApplicationsFriendIds.Contains(x.CandidateUserId))
                    .GroupBy(x => x.VacancyId)
                    .Select(x => new { VacancyId = x.Key, Count = x.Select(y => y.CandidateUserId).Distinct().Count() })
                    .ToDictionaryAsync(x => x.VacancyId, x => x.Count, cancellationToken);
            }
        }

        var items = rows.Select(x => new VacancyListItemDto(
            x.Id,
            x.Title,
            x.Kind,
            x.Format,
            x.CompanyName,
            x.CityName,
            x.SalaryFrom,
            x.SalaryTo,
            x.CurrencyCode,
            x.SalaryTaxMode,
            x.PublishAt,
            x.Verified,
            x.Tags)
        {
            CompanyId = x.CompanyId,
            CompanyLogoUrl = x.CompanyLogoUrl,
            TagMatchCount = x.TagMatchCount,
            IsFavoriteByMe = favoriteByMeIds.Contains(x.Id),
            FriendFavoritesCount = friendFavoriteCounts.GetValueOrDefault(x.Id),
            FriendApplicationsCount = friendApplicationCounts.GetValueOrDefault(x.Id)
        }).ToList();

        return Ok(new PagedResponse<VacancyListItemDto>(items, totalCount, page, pageSize));
    }

    /// <summary>
    /// Возвращает детальную карточку вакансии.
    /// </summary>
    /// <param name="id">Идентификатор вакансии.</param>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Детальная карточка вакансии.</returns>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(VacancyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<VacancyDetailDto>> GetDetail(long id, CancellationToken cancellationToken)
    {
        var currentUserId = TryGetCurrentUserId();
        var vacancy = await dbContext.Vacancies
            .AsNoTracking()
            .Include(x => x.Company)
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.VacancyTags)
                .ThenInclude(x => x.Tag)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (vacancy is null)
        {
            return this.ToNotFoundError("vacancies.not_found", "Vacancy not found.");
        }

        var city = vacancy.City ?? vacancy.Location?.City;
        var locationLatitude = vacancy.Location is not null ? (decimal?)vacancy.Location.GeoPoint.Y : city?.Latitude;
        var locationLongitude = vacancy.Location is not null ? (decimal?)vacancy.Location.GeoPoint.X : city?.Longitude;
        var locationDto = city is null
            ? null
            : new LocationDto(
                city.Id,
                city.CityName,
                locationLatitude,
                locationLongitude,
                vacancy.Location?.StreetName,
                vacancy.Location?.HouseNumber);

        var dto = new VacancyDetailDto(
            vacancy.Id,
            vacancy.Title,
            vacancy.ShortDescription,
            vacancy.FullDescription,
            vacancy.Kind,
            vacancy.Format,
            vacancy.Status,
            vacancy.PublishAt,
            vacancy.ApplicationDeadline,
            vacancy.SalaryFrom,
            vacancy.SalaryTo,
            vacancy.CurrencyCode,
            vacancy.SalaryTaxMode,
            new CompanyShortDto(
                vacancy.CompanyId,
                vacancy.Company.BrandName ?? vacancy.Company.LegalName,
                vacancy.Company.Status == CompanyStatus.Verified,
                vacancy.Company.WebsiteUrl,
                vacancy.Company.PublicEmail),
            locationDto,
            vacancy.VacancyTags.Select(t => t.Tag.Name).ToArray());

        if (currentUserId is not null)
        {
            var viewerTagIds = await dbContext.CandidateResumeSkills
                .AsNoTracking()
                .Where(x => x.UserId == currentUserId.Value)
                .Select(x => x.TagId)
                .ToArrayAsync(cancellationToken);
            var tagSet = viewerTagIds.ToHashSet();
            var mutualFriendIds = await GetMutualFriendIds(currentUserId.Value, cancellationToken);
            var visibleFavoritesFriendIds = await FilterVisibleFriendIdsForFavorites(mutualFriendIds, cancellationToken);
            var visibleApplicationsFriendIds = await FilterVisibleFriendIdsForApplications(mutualFriendIds, cancellationToken);

            dto = dto with
            {
                TagMatchCount = viewerTagIds.Length == 0 ? 0 : vacancy.VacancyTags.Count(t => tagSet.Contains(t.TagId)),
                IsFavoriteByMe = await dbContext.UserOpportunityFavorites
                    .AsNoTracking()
                    .AnyAsync(x => x.UserId == currentUserId.Value && x.VacancyId == id, cancellationToken),
                FriendFavoritesCount = visibleFavoritesFriendIds.Length == 0
                    ? 0
                    : await dbContext.UserOpportunityFavorites
                        .AsNoTracking()
                        .CountAsync(x => x.VacancyId == id && visibleFavoritesFriendIds.Contains(x.UserId), cancellationToken),
                FriendApplicationsCount = visibleApplicationsFriendIds.Length == 0
                    ? 0
                    : await dbContext.Applications
                        .AsNoTracking()
                        .Where(x => x.VacancyId == id && visibleApplicationsFriendIds.Contains(x.CandidateUserId))
                        .Select(x => x.CandidateUserId)
                        .Distinct()
                        .CountAsync(cancellationToken)
            };
        }

        return Ok(dto);
    }

    private IQueryable<Vacancy> BuildFilteredQuery(VacancyListQuery query)
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
                (x.Company.BrandName != null && x.Company.BrandName.ToLower().Contains(search)) ||
                x.Company.LegalName.ToLower().Contains(search));
        }

        if (query.CityId is not null)
        {
            vacancies = vacancies.Where(x => x.CityId == query.CityId || (x.Location != null && x.Location.CityId == query.CityId));
        }

        if (query.CompanyId is not null)
        {
            vacancies = vacancies.Where(x => x.CompanyId == query.CompanyId);
        }

        if (query.Kinds is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.Kinds.Contains(x.Kind));
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

        return vacancies;
    }

    private long? TryGetCurrentUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return long.TryParse(value, out var userId) ? userId : null;
    }

    private Task<long[]> GetMutualFriendIds(long userId, CancellationToken cancellationToken)
    {
        var following = dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => x.FollowerUserId == userId);
        var followers = dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => x.FollowingUserId == userId);

        var mutualSubscriptionIds = following
            .Join(
                followers,
                left => left.FollowingUserId,
                right => right.FollowerUserId,
                (left, _) => left.FollowingUserId)
            .Distinct();

        var contactIds = dbContext.UserContacts
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => x.ContactUserId);

        return mutualSubscriptionIds
            .Union(contactIds)
            .Distinct()
            .ToArrayAsync(cancellationToken);
    }

    private async Task<long[]> FilterVisibleFriendIdsForFavorites(long[] candidateUserIds, CancellationToken cancellationToken)
    {
        if (candidateUserIds.Length == 0)
        {
            return [];
        }

        var hiddenUserIds = await dbContext.CandidatePrivacySettings
            .AsNoTracking()
            .Where(x => candidateUserIds.Contains(x.UserId) && !x.ShowInFriendsFavorites)
            .Select(x => x.UserId)
            .ToArrayAsync(cancellationToken);

        return candidateUserIds.Except(hiddenUserIds).ToArray();
    }

    private async Task<long[]> FilterVisibleFriendIdsForApplications(long[] candidateUserIds, CancellationToken cancellationToken)
    {
        if (candidateUserIds.Length == 0)
        {
            return [];
        }

        var hiddenUserIds = await dbContext.CandidatePrivacySettings
            .AsNoTracking()
            .Where(x => candidateUserIds.Contains(x.UserId) && !x.ShowInFriendsApplications)
            .Select(x => x.UserId)
            .ToArrayAsync(cancellationToken);

        return candidateUserIds.Except(hiddenUserIds).ToArray();
    }
}
