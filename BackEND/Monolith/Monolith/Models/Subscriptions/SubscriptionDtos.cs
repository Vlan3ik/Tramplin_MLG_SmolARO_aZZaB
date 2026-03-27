using Monolith.Entities;

namespace Monolith.Models.Subscriptions;

public record SubscriptionUserDto(
    long UserId,
    string Username,
    string Fio,
    string? AvatarUrl,
    PlatformRole AccountType,
    string? OrganizationName,
    DateTimeOffset SubscribedAt);

public record SubscriptionStatsDto(
    int FollowingCount,
    int FollowersCount);
