namespace Monolith.Entities;

public class CandidateProfile
{
    public long UserId { get; set; }
    public string Fio { get; set; } = string.Empty;
    public DateOnly? BirthDate { get; set; }
    public CandidateGender Gender { get; set; } = CandidateGender.Unknown;
    public string? Phone { get; set; }
    public long? CityId { get; set; }
    public string? About { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public User User { get; set; } = null!;
    public City? City { get; set; }
    public CandidatePrivacySettings PrivacySettings { get; set; } = null!;
    public CandidateResumeProfile ResumeProfile { get; set; } = null!;
}
