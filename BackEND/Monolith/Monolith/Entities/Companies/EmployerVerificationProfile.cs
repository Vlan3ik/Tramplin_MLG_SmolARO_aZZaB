namespace Monolith.Entities;

public class EmployerVerificationProfile
{
    public long CompanyId { get; set; }
    public EmployerType EmployerType { get; set; } = EmployerType.LegalEntity;
    public string OgrnOrOgrnip { get; set; } = string.Empty;
    public string Inn { get; set; } = string.Empty;
    public string? Kpp { get; set; }
    public string LegalAddress { get; set; } = string.Empty;
    public string? ActualAddress { get; set; }
    public string RepresentativeFullName { get; set; } = string.Empty;
    public string? RepresentativePosition { get; set; }
    public long MainIndustryId { get; set; }
    public string? TaxOffice { get; set; }
    public string WorkEmail { get; set; } = string.Empty;
    public string WorkPhone { get; set; } = string.Empty;
    public string? SiteOrPublicLinks { get; set; }
    public VerificationReviewStatus ReviewStatus { get; set; } = VerificationReviewStatus.Draft;
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public long? VerifiedByUserId { get; set; }
    public string? RejectReason { get; set; }
    public string? MissingDocs { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Company Company { get; set; } = null!;
    public EmployerVerificationIndustry MainIndustry { get; set; } = null!;
    public User? VerifiedByUser { get; set; }
    public List<EmployerVerificationDocument> Documents { get; set; } = new();
}
