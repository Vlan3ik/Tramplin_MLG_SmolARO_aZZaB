namespace Monolith.Entities;

public class Tag
{
    public long Id { get; set; }
    public long GroupId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public CatalogStatus Status { get; set; } = CatalogStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public TagGroup Group { get; set; } = null!;
    public List<OpportunityTag> OpportunityTags { get; set; } = new();
}
