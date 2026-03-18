namespace Monolith.Entities;

public class UserRole
{
    public long UserId { get; set; }
    public PlatformRole Role { get; set; }
    public DateTimeOffset AssignedAt { get; set; }
    public User User { get; set; } = null!;
}
