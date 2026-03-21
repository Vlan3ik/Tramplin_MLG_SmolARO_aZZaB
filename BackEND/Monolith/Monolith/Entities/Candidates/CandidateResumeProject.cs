namespace Monolith.Entities;

public class CandidateResumeProject
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Role { get; set; }
    public string? Description { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string? RepoUrl { get; set; }
    public string? DemoUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public CandidateResumeProfile Resume { get; set; } = null!;
    public List<CandidateResumeProjectPhoto> Photos { get; set; } = new();
    public List<CandidateResumeProjectParticipant> Participants { get; set; } = new();
    public List<CandidateResumeProjectCollaboration> Collaborations { get; set; } = new();
}
