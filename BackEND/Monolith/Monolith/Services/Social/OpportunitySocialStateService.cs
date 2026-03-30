using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using System.Security.Claims;

namespace Monolith.Services.Social;

public readonly record struct OpportunitySocialStateSnapshot(
    bool IsFavoriteByMe,
    int FriendFavoritesCount,
    int FriendApplicationsCount);

public interface IOpportunitySocialStateService
{
    long? TryGetCurrentUserId(ClaimsPrincipal user);

    Task<OpportunitySocialStateSnapshot> GetVacancySnapshot(long? currentUserId, long vacancyId, CancellationToken cancellationToken);

    Task<OpportunitySocialStateSnapshot> GetOpportunitySnapshot(long? currentUserId, long opportunityId, CancellationToken cancellationToken);

    Task<Dictionary<long, OpportunitySocialStateSnapshot>> GetVacancySnapshots(
        long? currentUserId,
        IReadOnlyCollection<long> vacancyIds,
        CancellationToken cancellationToken);

    Task<Dictionary<long, OpportunitySocialStateSnapshot>> GetOpportunitySnapshots(
        long? currentUserId,
        IReadOnlyCollection<long> opportunityIds,
        CancellationToken cancellationToken);
}

public class OpportunitySocialStateService(AppDbContext dbContext) : IOpportunitySocialStateService
{
    public long? TryGetCurrentUserId(ClaimsPrincipal user)
    {
        var rawValue = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return long.TryParse(rawValue, out var parsed) ? parsed : null;
    }

    public async Task<OpportunitySocialStateSnapshot> GetVacancySnapshot(long? currentUserId, long vacancyId, CancellationToken cancellationToken)
    {
        var snapshots = await GetVacancySnapshots(currentUserId, [vacancyId], cancellationToken);
        return snapshots.GetValueOrDefault(vacancyId, default);
    }

    public async Task<OpportunitySocialStateSnapshot> GetOpportunitySnapshot(long? currentUserId, long opportunityId, CancellationToken cancellationToken)
    {
        var snapshots = await GetOpportunitySnapshots(currentUserId, [opportunityId], cancellationToken);
        return snapshots.GetValueOrDefault(opportunityId, default);
    }

    public async Task<Dictionary<long, OpportunitySocialStateSnapshot>> GetVacancySnapshots(
        long? currentUserId,
        IReadOnlyCollection<long> vacancyIds,
        CancellationToken cancellationToken)
    {
        var result = vacancyIds
            .Distinct()
            .ToDictionary(id => id, _ => default(OpportunitySocialStateSnapshot));

        if (currentUserId is null || result.Count == 0)
        {
            return result;
        }

        var ids = result.Keys.ToArray();
        var favoriteByMeIds = await dbContext.UserOpportunityFavorites
            .AsNoTracking()
            .Where(x => x.UserId == currentUserId.Value && x.VacancyId != null && ids.Contains(x.VacancyId.Value))
            .Select(x => x.VacancyId!.Value)
            .ToListAsync(cancellationToken);

        var mutualFriendIds = await GetMutualFriendIds(currentUserId.Value, cancellationToken);
        Dictionary<long, int> friendFavoriteCounts = [];
        Dictionary<long, int> friendApplicationCounts = [];

        if (mutualFriendIds.Length > 0)
        {
            var visibleFavoritesFriendIds = await FilterVisibleFriendIdsForFavorites(mutualFriendIds, cancellationToken);
            if (visibleFavoritesFriendIds.Length > 0)
            {
                friendFavoriteCounts = await dbContext.UserOpportunityFavorites
                    .AsNoTracking()
                    .Where(x =>
                        x.VacancyId != null &&
                        ids.Contains(x.VacancyId.Value) &&
                        visibleFavoritesFriendIds.Contains(x.UserId))
                    .GroupBy(x => x.VacancyId!.Value)
                    .Select(x => new { Id = x.Key, Count = x.Count() })
                    .ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
            }

            var visibleApplicationsFriendIds = await FilterVisibleFriendIdsForApplications(mutualFriendIds, cancellationToken);
            if (visibleApplicationsFriendIds.Length > 0)
            {
                friendApplicationCounts = await dbContext.Applications
                    .AsNoTracking()
                    .Where(x =>
                        ids.Contains(x.VacancyId) &&
                        visibleApplicationsFriendIds.Contains(x.CandidateUserId))
                    .GroupBy(x => x.VacancyId)
                    .Select(x => new { Id = x.Key, Count = x.Select(y => y.CandidateUserId).Distinct().Count() })
                    .ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
            }
        }

        var favoriteByMeSet = favoriteByMeIds.ToHashSet();
        foreach (var id in ids)
        {
            result[id] = new OpportunitySocialStateSnapshot(
                favoriteByMeSet.Contains(id),
                friendFavoriteCounts.GetValueOrDefault(id),
                friendApplicationCounts.GetValueOrDefault(id));
        }

        return result;
    }

    public async Task<Dictionary<long, OpportunitySocialStateSnapshot>> GetOpportunitySnapshots(
        long? currentUserId,
        IReadOnlyCollection<long> opportunityIds,
        CancellationToken cancellationToken)
    {
        var result = opportunityIds
            .Distinct()
            .ToDictionary(id => id, _ => default(OpportunitySocialStateSnapshot));

        if (currentUserId is null || result.Count == 0)
        {
            return result;
        }

        var ids = result.Keys.ToArray();
        var favoriteByMeIds = await dbContext.UserOpportunityFavorites
            .AsNoTracking()
            .Where(x => x.UserId == currentUserId.Value && x.OpportunityId != null && ids.Contains(x.OpportunityId.Value))
            .Select(x => x.OpportunityId!.Value)
            .ToListAsync(cancellationToken);

        var mutualFriendIds = await GetMutualFriendIds(currentUserId.Value, cancellationToken);
        Dictionary<long, int> friendFavoriteCounts = [];
        Dictionary<long, int> friendApplicationCounts = [];

        if (mutualFriendIds.Length > 0)
        {
            var visibleFavoritesFriendIds = await FilterVisibleFriendIdsForFavorites(mutualFriendIds, cancellationToken);
            if (visibleFavoritesFriendIds.Length > 0)
            {
                friendFavoriteCounts = await dbContext.UserOpportunityFavorites
                    .AsNoTracking()
                    .Where(x =>
                        x.OpportunityId != null &&
                        ids.Contains(x.OpportunityId.Value) &&
                        visibleFavoritesFriendIds.Contains(x.UserId))
                    .GroupBy(x => x.OpportunityId!.Value)
                    .Select(x => new { Id = x.Key, Count = x.Count() })
                    .ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
            }

            var visibleApplicationsFriendIds = await FilterVisibleFriendIdsForApplications(mutualFriendIds, cancellationToken);
            if (visibleApplicationsFriendIds.Length > 0)
            {
                friendApplicationCounts = await dbContext.OpportunityParticipants
                    .AsNoTracking()
                    .Where(x =>
                        ids.Contains(x.OpportunityId) &&
                        visibleApplicationsFriendIds.Contains(x.UserId))
                    .GroupBy(x => x.OpportunityId)
                    .Select(x => new { Id = x.Key, Count = x.Select(y => y.UserId).Distinct().Count() })
                    .ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
            }
        }

        var favoriteByMeSet = favoriteByMeIds.ToHashSet();
        foreach (var id in ids)
        {
            result[id] = new OpportunitySocialStateSnapshot(
                favoriteByMeSet.Contains(id),
                friendFavoriteCounts.GetValueOrDefault(id),
                friendApplicationCounts.GetValueOrDefault(id));
        }

        return result;
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
