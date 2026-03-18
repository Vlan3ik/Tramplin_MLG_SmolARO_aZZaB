namespace Monolith.Entities;

public class OpportunityTag
{
    public long OpportunityId { get; set; }
    public long TagId { get; set; }
    public Opportunity Opportunity { get; set; } = null!;
    public Tag Tag { get; set; } = null!;
}
