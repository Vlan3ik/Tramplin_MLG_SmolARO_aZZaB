namespace Monolith.Entities;

public class ChatMessageRead
{
    public long MessageId { get; set; }
    public long UserId { get; set; }
    public DateTimeOffset ReadAt { get; set; }

    public ChatMessage Message { get; set; } = null!;
    public User User { get; set; } = null!;
}
