namespace Monolith.Entities;

public class Company
{
    public long Id { get; set; }
    public string LegalName { get; set; } = string.Empty;
    public string? BrandName { get; set; }
    public CompanyLegalType LegalType { get; set; }
    public string TaxId { get; set; } = string.Empty;
    public string RegistrationNumber { get; set; } = string.Empty;
    public string Industry { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? PublicEmail { get; set; }
    public string? PublicPhone { get; set; }
    public long BaseCityId { get; set; }
    public CompanyStatus Status { get; set; } = CompanyStatus.Draft;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public City BaseCity { get; set; } = null!;
    public List<CompanyLink> Links { get; set; } = new();
    public List<CompanyMedia> Media { get; set; } = new();
    public List<Vacancy> Vacancies { get; set; } = new();
    public List<Opportunity> Opportunities { get; set; } = new();
    public List<CompanyMember> Members { get; set; } = new();
    public List<CompanyInvite> Invites { get; set; } = new();
    public List<Application> Applications { get; set; } = new();
    public List<CandidateResumeExperience> ResumeExperiences { get; set; } = new();
    public CompanyChatSettings? ChatSettings { get; set; }
}
