namespace Monolith.Entities;

public class CandidateProfile
{
    public long UserId { get; set; }
    public string LastName { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public DateOnly? BirthDate { get; set; }
    public CandidateGender Gender { get; set; } = CandidateGender.Unknown;
    public string? Phone { get; set; }
    public string? About { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public User User { get; set; } = null!;
    public CandidatePrivacySettings PrivacySettings { get; set; } = null!;
    public CandidateResumeProfile ResumeProfile { get; set; } = null!;
}
