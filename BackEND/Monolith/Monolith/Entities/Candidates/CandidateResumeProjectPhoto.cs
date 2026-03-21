namespace Monolith.Entities;

public class CandidateResumeProjectPhoto
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public string Url { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsMain { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public CandidateResumeProject Project { get; set; } = null!;
}
