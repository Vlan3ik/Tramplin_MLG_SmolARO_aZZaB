namespace Monolith.Entities;

public class CandidateResumeProjectCollaboration
{
    public long Id { get; set; }
    public long ProjectId { get; set; }
    public PortfolioCollaborationType Type { get; set; }
    public long? UserId { get; set; }
    public long? VacancyId { get; set; }
    public long? OpportunityId { get; set; }
    public string? Label { get; set; }
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public CandidateResumeProject Project { get; set; } = null!;
    public User? User { get; set; }
    public Vacancy? Vacancy { get; set; }
    public Opportunity? Opportunity { get; set; }
}
