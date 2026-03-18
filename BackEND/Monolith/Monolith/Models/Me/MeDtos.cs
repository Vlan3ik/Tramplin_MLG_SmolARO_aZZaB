using Monolith.Entities;

namespace Monolith.Models.Me;

public record MeResponse(long Id, string Email, string DisplayName, string? AvatarUrl, IReadOnlyCollection<string> Roles);

public record UpdateProfileRequest(
    string DisplayName,
    string FirstName,
    string LastName,
    string? MiddleName,
    string? Phone,
    string? About,
    string? AvatarUrl);

public record ProfileResponse(
    long UserId,
    string DisplayName,
    string FirstName,
    string LastName,
    string? MiddleName,
    string? Phone,
    string? About,
    string? AvatarUrl);

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
