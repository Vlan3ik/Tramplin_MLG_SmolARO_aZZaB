namespace Monolith.Entities;

public class CompanyMedia
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public CompanyMediaType MediaType { get; set; }
    public string Url { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Company Company { get; set; } = null!;
}
