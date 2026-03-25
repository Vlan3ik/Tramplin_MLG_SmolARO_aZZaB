namespace Monolith.Entities;

public class ChatMessageAttachment
{
    public long Id { get; set; }
    public long MessageId { get; set; }
    public ChatMessageAttachmentType Type { get; set; }
    public string? Url { get; set; }
    public string? MimeType { get; set; }
    public string? FileName { get; set; }
    public long? SizeBytes { get; set; }
    public long? VacancyId { get; set; }
    public long? OpportunityId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public ChatMessage Message { get; set; } = null!;
    public Vacancy? Vacancy { get; set; }
    public Opportunity? Opportunity { get; set; }
}
