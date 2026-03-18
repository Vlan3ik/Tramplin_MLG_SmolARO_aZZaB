namespace Monolith.Entities;

public class CandidatePrivacySettings
{
    public long UserId { get; set; }
    public PrivacyScope ProfileVisibility { get; set; } = PrivacyScope.AuthorizedUsers;
    public PrivacyScope ResumeVisibility { get; set; } = PrivacyScope.AuthorizedUsers;
    public bool OpenToWork { get; set; } = true;
    public bool ShowContactsInResume { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public CandidateProfile CandidateProfile { get; set; } = null!;
}
