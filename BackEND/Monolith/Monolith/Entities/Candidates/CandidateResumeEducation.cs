namespace Monolith.Entities;

public class CandidateResumeEducation
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string University { get; set; } = string.Empty;
    public string? Faculty { get; set; }
    public string? Specialty { get; set; }
    public int? Course { get; set; }
    public int? GraduationYear { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public CandidateResumeProfile Resume { get; set; } = null!;
}
