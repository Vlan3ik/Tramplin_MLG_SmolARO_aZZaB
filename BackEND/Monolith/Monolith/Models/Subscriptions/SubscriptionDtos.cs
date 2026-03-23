namespace Monolith.Models.Subscriptions;

public record SubscriptionUserDto(
    long UserId,
    string Username,
    string DisplayName,
    string? AvatarUrl,
    DateTimeOffset SubscribedAt);

public record SubscriptionStatsDto(
    int FollowingCount,
    int FollowersCount);
