using Monolith.Entities;

namespace Monolith.Models.Resumes;

/// <summary>
/// Параметры списка опубликованных резюме.
/// </summary>
public class ResumeListQuery
{
    /// <summary>
    /// Номер страницы (начиная с 1).
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Размер страницы (максимум 100).
    /// </summary>
    public int PageSize { get; set; } = 20;

    /// <summary>
    /// Поисковая строка.
    /// </summary>
    public string? Search { get; set; }
}

/// <summary>
/// Краткая карточка резюме в общем списке.
/// </summary>
public record ResumeListItemDto(
    long UserId,
    string Username,
    string DisplayName,
    string? AvatarUrl,
    string? Headline,
    string? DesiredPosition,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    bool OpenToWork,
    DateTimeOffset ResumeUpdatedAt);

/// <summary>
/// Подробная карточка опубликованного резюме.
/// </summary>
public record ResumeDetailDto(
    long UserId,
    string Username,
    string FirstName,
    string LastName,
    string? MiddleName,
    DateOnly? BirthDate,
    CandidateGender Gender,
    string? Phone,
    string? About,
    string? AvatarUrl,
    string? Headline,
    string? DesiredPosition,
    string? Summary,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    bool OpenToWork,
    IReadOnlyCollection<ResumeSkillDto> Skills,
    IReadOnlyCollection<ResumeProjectDto> Projects,
    IReadOnlyCollection<ResumeEducationDto> Education,
    IReadOnlyCollection<ResumeLinkDto> Links);

/// <summary>
/// Элемент навыка в резюме.
/// </summary>
public record ResumeSkillDto(
    long TagId,
    string TagName,
    int? Level,
    decimal? YearsExperience);

/// <summary>
/// Элемент проекта в резюме.
/// </summary>
public record ResumeProjectDto(
    long Id,
    string Title,
    string? Role,
    string? Description,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? RepoUrl,
    string? DemoUrl);

/// <summary>
/// Элемент образования в резюме.
/// </summary>
public record ResumeEducationDto(
    long Id,
    string University,
    string? Faculty,
    string? Specialty,
    int? Course,
    int? GraduationYear);

/// <summary>
/// Элемент внешней ссылки в резюме.
/// </summary>
public record ResumeLinkDto(
    long Id,
    string Kind,
    string Url,
    string? Label);
