namespace Monolith.Entities;

public class CandidateResumeSkill
{
    public long UserId { get; set; }
    public long TagId { get; set; }
    public int? Level { get; set; }
    public decimal? YearsExperience { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public CandidateResumeProfile Resume { get; set; } = null!;
    public Tag Tag { get; set; } = null!;
}
