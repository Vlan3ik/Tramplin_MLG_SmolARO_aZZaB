namespace Monolith.Entities;

public class UserSubscription
{
    public long FollowerUserId { get; set; }
    public long FollowingUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public User FollowerUser { get; set; } = null!;
    public User FollowingUser { get; set; } = null!;
}
