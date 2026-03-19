namespace Monolith.Entities;

public class ChatParticipant
{
    public long ChatId { get; set; }
    public long UserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Chat Chat { get; set; } = null!;
    public User User { get; set; } = null!;
}
