namespace Monolith.Entities;

public class CompanyLink
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public LinkType LinkKind { get; set; }
    public string? Label { get; set; }
    public string Url { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public Company Company { get; set; } = null!;
}
