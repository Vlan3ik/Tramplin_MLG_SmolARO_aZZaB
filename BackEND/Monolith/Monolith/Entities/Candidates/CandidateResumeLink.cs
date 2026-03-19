namespace Monolith.Entities;

public class CandidateResumeLink
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? Label { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public CandidateResumeProfile Resume { get; set; } = null!;
}
