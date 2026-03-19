using Monolith.Entities;

namespace Monolith.Models.Me;

public record MeResponse(long Id, string Email, string Username, string? AvatarUrl, IReadOnlyCollection<string> Roles);

public record UpdateProfileRequest(
    string FirstName,
    string LastName,
    string? MiddleName,
    string? Phone,
    string? About,
    string? AvatarUrl);

public record ProfileResponse(
    long UserId,
    string Username,
    string FirstName,
    string LastName,
    string? MiddleName,
    string? Phone,
    string? About,
    string? AvatarUrl);

public record UpdateUsernameRequest(string Username);

public record UsernameResponse(string Username);

public record UpdateSettingsRequest(
    PrivacyScope ProfileVisibility,
    PrivacyScope ResumeVisibility,
    bool OpenToWork,
    bool ShowContactsInResume);

public record SettingsResponse(
    long UserId,
    PrivacyScope ProfileVisibility,
    PrivacyScope ResumeVisibility,
    bool OpenToWork,
    bool ShowContactsInResume);

public record UpdateResumeRequest(
    string? Headline,
    string? DesiredPosition,
    string? Summary,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode);

public record ResumeResponse(
    long UserId,
    string? Headline,
    string? DesiredPosition,
    string? Summary,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode);

public record ResumeSkillItemDto(long TagId, string TagName, int? Level, decimal? YearsExperience);
public record ResumeProjectItemDto(long Id, string Title, string? Role, string? Description, DateOnly? StartDate, DateOnly? EndDate, string? RepoUrl, string? DemoUrl);
public record ResumeEducationItemDto(long Id, string University, string? Faculty, string? Specialty, int? Course, int? GraduationYear);
public record ResumeLinkItemDto(long Id, string Kind, string Url, string? Label);

public record ResumeDetailsResponse(
    long UserId,
    string? Headline,
    string? DesiredPosition,
    string? Summary,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    IReadOnlyCollection<ResumeSkillItemDto> Skills,
    IReadOnlyCollection<ResumeProjectItemDto> Projects,
    IReadOnlyCollection<ResumeEducationItemDto> Education,
    IReadOnlyCollection<ResumeLinkItemDto> Links);

public record ResumeSkillUpsertDto(long TagId, int? Level, decimal? YearsExperience);
public record ResumeProjectUpsertDto(string Title, string? Role, string? Description, DateOnly? StartDate, DateOnly? EndDate, string? RepoUrl, string? DemoUrl);
public record ResumeEducationUpsertDto(string University, string? Faculty, string? Specialty, int? Course, int? GraduationYear);
public record ResumeLinkUpsertDto(string Kind, string Url, string? Label);

public record UpdateResumeDetailsRequest(
    string? Headline,
    string? DesiredPosition,
    string? Summary,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    IReadOnlyCollection<ResumeSkillUpsertDto> Skills,
    IReadOnlyCollection<ResumeProjectUpsertDto> Projects,
    IReadOnlyCollection<ResumeEducationUpsertDto> Education,
    IReadOnlyCollection<ResumeLinkUpsertDto> Links);

public record ProfileStatsResponse(
    int ApplicationsTotal,
    int ApplicationsOpen,
    int ApplicationsClosed,
    int ApplicationsRejected,
    int InternshipsCompleted,
    int EventsAttended,
    int MentorshipParticipations);

public record PublicProfileResponse(
    long UserId,
    string Username,
    string FirstName,
    string LastName,
    string? MiddleName,
    string? Phone,
    string? About,
    string? AvatarUrl,
    ResumeDetailsResponse? Resume,
    ProfileStatsResponse Stats,
    string VisibilityMode);
