namespace Monolith.Entities;

public class CandidateResumeExperience
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public long? CompanyId { get; set; }
    public string? CompanyName { get; set; }
    public string Position { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public bool IsCurrent { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public CandidateResumeProfile Resume { get; set; } = null!;
    public Company? Company { get; set; }
}
