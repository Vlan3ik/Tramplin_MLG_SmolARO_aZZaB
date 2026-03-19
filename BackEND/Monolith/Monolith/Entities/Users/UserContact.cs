namespace Monolith.Entities;

public class UserContact
{
    public long UserId { get; set; }
    public long ContactUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public User ContactUser { get; set; } = null!;
}
