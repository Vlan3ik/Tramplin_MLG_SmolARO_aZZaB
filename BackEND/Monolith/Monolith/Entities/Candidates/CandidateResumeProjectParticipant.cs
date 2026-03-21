namespace Monolith.Entities;

public class CandidateResumeProjectParticipant
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public long UserId { get; set; }
    public string Role { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }

    public CandidateResumeProject Project { get; set; } = null!;
    public User User { get; set; } = null!;
}
