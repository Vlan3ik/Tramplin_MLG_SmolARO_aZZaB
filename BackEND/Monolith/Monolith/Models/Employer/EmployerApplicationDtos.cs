using Monolith.Entities;

namespace Monolith.Models.Employer;

public class EmployerApplicationListQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public long? VacancyId { get; set; }
    public ApplicationStatus[]? Statuses { get; set; }
    public DateTimeOffset? CreatedFrom { get; set; }
    public DateTimeOffset? CreatedTo { get; set; }
}

public record EmployerApplicationListItemDto(
    long Id,
    long VacancyId,
    string VacancyTitle,
    long CandidateUserId,
    string CandidateName,
    string? CandidateAvatarUrl,
    ApplicationStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    long? ChatId);

public record EmployerApplicationDetailDto(
    long Id,
    long CompanyId,
    long VacancyId,
    string VacancyTitle,
    long CandidateUserId,
    string CandidateName,
    string? CandidateAvatarUrl,
    string? CandidateHeadline,
    string? CandidateDesiredPosition,
    decimal? CandidateSalaryFrom,
    decimal? CandidateSalaryTo,
    string? CandidateCurrencyCode,
    ApplicationStatus Status,
    PlatformRole InitiatorRole,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    long? ChatId);

public record EmployerApplicationStatusUpdateRequest(ApplicationStatus Status);
