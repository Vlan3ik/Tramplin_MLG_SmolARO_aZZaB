namespace Monolith.Entities;

public class ChatMessage
{
    public long Id { get; set; }
    public long ChatId { get; set; }
    public long SenderUserId { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsSystem { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Chat Chat { get; set; } = null!;
    public User SenderUser { get; set; } = null!;
    public List<ChatMessageRead> Reads { get; set; } = new();
}
