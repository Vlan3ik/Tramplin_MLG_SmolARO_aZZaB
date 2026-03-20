namespace Monolith.Entities;

public class OpportunityParticipant
{
    public long OpportunityId { get; set; }
    public long UserId { get; set; }
    public DateTimeOffset JoinedAt { get; set; }

    public Opportunity Opportunity { get; set; } = null!;
    public User User { get; set; } = null!;
}
