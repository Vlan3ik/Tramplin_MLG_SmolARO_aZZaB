namespace Monolith.Entities;

public class CandidateResumeProfile
{
    public long UserId { get; set; }
    public string? Headline { get; set; }
    public string? DesiredPosition { get; set; }
    public string? Summary { get; set; }
    public decimal? SalaryFrom { get; set; }
    public decimal? SalaryTo { get; set; }
    public string? CurrencyCode { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public CandidateProfile CandidateProfile { get; set; } = null!;
}
