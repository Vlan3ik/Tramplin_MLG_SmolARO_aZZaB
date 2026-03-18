namespace Monolith.Entities;

public class Opportunity
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public long CreatedByUserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ShortDescription { get; set; } = string.Empty;
    public string FullDescription { get; set; } = string.Empty;
    public OpportunityType OppType { get; set; }
    public WorkFormat Format { get; set; }
    public OpportunityStatus Status { get; set; } = OpportunityStatus.Draft;
    public long? CityId { get; set; }
    public long? LocationId { get; set; }
    public decimal? SalaryFrom { get; set; }
    public decimal? SalaryTo { get; set; }
    public string? CurrencyCode { get; set; }
    public DateTimeOffset PublishAt { get; set; }
    public DateTimeOffset? ApplicationDeadline { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Company Company { get; set; } = null!;
    public City? City { get; set; }
    public Location? Location { get; set; }
    public List<OpportunityTag> OpportunityTags { get; set; } = new();
}
