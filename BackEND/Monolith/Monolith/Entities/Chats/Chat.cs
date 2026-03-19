namespace Monolith.Entities;

public class Chat
{
    public long Id { get; set; }
    public ChatType Type { get; set; } = ChatType.Direct;
    public long? ApplicationId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Application? Application { get; set; }
    public List<ChatParticipant> Participants { get; set; } = new();
    public List<ChatMessage> Messages { get; set; } = new();
}
