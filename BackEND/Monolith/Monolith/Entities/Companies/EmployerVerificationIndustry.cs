namespace Monolith.Entities;

public class EmployerVerificationIndustry
{
    public long Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public List<EmployerVerificationProfile> Profiles { get; set; } = new();
}
