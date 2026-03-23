using Monolith.Entities;

namespace Monolith.Models.Me;

public record MeResponse(long Id, string Email, string Username, string? AvatarUrl, string? ProfileBannerUrl, IReadOnlyCollection<string> Roles);

public record UpdateProfileRequest(
    string FirstName,
    string LastName,
    string? MiddleName,
    DateOnly? BirthDate,
    CandidateGender? Gender,
    string? Phone,
    string? About,
    string? AvatarUrl);

public record ProfileResponse(
    long UserId,
    string Username,
    string FirstName,
    string LastName,
    string? MiddleName,
    DateOnly? BirthDate,
    CandidateGender Gender,
    string? Phone,
    string? About,
    string? AvatarUrl);

public record UpdateUsernameRequest(string Username);

public record UsernameResponse(string Username);

/// <summary>
/// Обновление настроек приватности профиля соискателя.
/// </summary>
/// <param name="ProfileVisibility">
/// Видимость профиля (enum PrivacyScope):
/// 1 = Private, 2 = ContactsOnly, 3 = AuthorizedUsers.
/// </param>
/// <param name="ResumeVisibility">
/// Видимость резюме (enum PrivacyScope):
/// 1 = Private, 2 = ContactsOnly, 3 = AuthorizedUsers.
/// </param>
/// <param name="OpenToWork">Флаг готовности к предложениям.</param>
/// <param name="ShowContactsInResume">Показывать ли контакты в резюме.</param>
public record UpdateSettingsRequest(
    PrivacyScope ProfileVisibility,
    PrivacyScope ResumeVisibility,
    bool OpenToWork,
    bool ShowContactsInResume);

/// <summary>
/// Текущие настройки приватности профиля соискателя.
/// </summary>
/// <param name="UserId">ID пользователя, для которого возвращены настройки.</param>
/// <param name="ProfileVisibility">
/// Видимость профиля (enum PrivacyScope):
/// 1 = Private, 2 = ContactsOnly, 3 = AuthorizedUsers.
/// </param>
/// <param name="ResumeVisibility">
/// Видимость резюме (enum PrivacyScope):
/// 1 = Private, 2 = ContactsOnly, 3 = AuthorizedUsers.
/// </param>
/// <param name="OpenToWork">Флаг готовности к предложениям.</param>
/// <param name="ShowContactsInResume">Показывать ли контакты в резюме.</param>
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

/// <summary>
/// Элемент навыка в резюме.
/// </summary>
/// <param name="TagId">ID тега навыка из GET /catalog/tags.</param>
/// <param name="TagName">Название тега навыка.</param>
/// <param name="Level">Уровень навыка от 1 до 5.</param>
/// <param name="YearsExperience">Опыт в годах.</param>
public record ResumeSkillItemDto(long TagId, string TagName, int? Level, decimal? YearsExperience);
public record ResumeProjectItemDto(long Id, string Title, string? Role, string? Description, DateOnly? StartDate, DateOnly? EndDate, string? RepoUrl, string? DemoUrl, bool IsPrivate);
public record ResumeExperienceItemDto(
    long Id,
    long? CompanyId,
    string CompanyName,
    string Position,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool IsCurrent);
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
    IReadOnlyCollection<ResumeExperienceItemDto> Experiences,
    IReadOnlyCollection<ResumeProjectItemDto> Projects,
    IReadOnlyCollection<ResumeEducationItemDto> Education,
    IReadOnlyCollection<ResumeLinkItemDto> Links);

/// <summary>
/// Навык для сохранения в резюме.
/// </summary>
/// <param name="TagId">ID тега навыка из GET /catalog/tags.</param>
/// <param name="Level">Уровень навыка от 1 до 5.</param>
/// <param name="YearsExperience">Опыт в годах.</param>
public record ResumeSkillUpsertDto(long TagId, int? Level, decimal? YearsExperience);
public record ResumeExperienceUpsertDto(
    long? CompanyId,
    string? CompanyName,
    string Position,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool IsCurrent);
public record ResumeProjectUpsertDto(
    long? Id,
    string Title,
    string? Role,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? RepoUrl,
    string? DemoUrl);
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
    IReadOnlyCollection<ResumeExperienceUpsertDto> Experiences,
    IReadOnlyCollection<ResumeProjectUpsertDto> Projects,
    IReadOnlyCollection<ResumeEducationUpsertDto> Education,
    IReadOnlyCollection<ResumeLinkUpsertDto> Links);

public record ProfileStatsResponse(
    int ApplicationsTotal,
    int ApplicationsNew,
    int ApplicationsInReview,
    int ApplicationsInterview,
    int ApplicationsOffer,
    int ApplicationsHired,
    int ApplicationsRejected,
    int ApplicationsCanceled,
    int InternshipsCompleted,
    int JobsCompleted,
    int EventsParticipations);

public record PublicProfileResponse(
    long UserId,
    string Username,
    string FirstName,
    string LastName,
    string? MiddleName,
    DateOnly? BirthDate,
    CandidateGender? Gender,
    string? Phone,
    string? About,
    string? AvatarUrl,
    ResumeDetailsResponse? Resume,
    ProfileStatsResponse Stats,
    string VisibilityMode);
