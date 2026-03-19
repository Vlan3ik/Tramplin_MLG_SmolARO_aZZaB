namespace Monolith.Entities;

public class Application
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public long CandidateUserId { get; set; }
    public long? OpportunityId { get; set; }
    public PlatformRole InitiatorRole { get; set; }
    public ApplicationStatus Status { get; set; } = ApplicationStatus.Open;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Company Company { get; set; } = null!;
    public User CandidateUser { get; set; } = null!;
    public Opportunity? Opportunity { get; set; }
    public Chat? Chat { get; set; }
}
