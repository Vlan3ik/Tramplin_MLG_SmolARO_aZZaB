using Monolith.Entities;
using Monolith.Models.Opportunities;

namespace Monolith.Models.Employer;

public class EmployerVacancyListQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public OpportunityStatus[]? Statuses { get; set; }
    public VacancyKind[]? Kinds { get; set; }
    public WorkFormat[]? Formats { get; set; }
    public SalaryTaxMode[]? SalaryTaxModes { get; set; }
    public decimal? SalaryFrom { get; set; }
    public decimal? SalaryTo { get; set; }
    public long[]? TagIds { get; set; }
}

public record EmployerVacancyListItemDto(
    long Id,
    string Title,
    VacancyKind Kind,
    WorkFormat Format,
    OpportunityStatus Status,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    SalaryTaxMode SalaryTaxMode,
    DateTimeOffset PublishAt,
    DateTimeOffset? ApplicationDeadline,
    int ApplicationsTotal,
    int ApplicationsLast24Hours,
    IReadOnlyCollection<string> Tags);

public record EmployerVacancyDetailDto(
    long Id,
    string Title,
    string ShortDescription,
    string FullDescription,
    VacancyKind Kind,
    WorkFormat Format,
    OpportunityStatus Status,
    DateTimeOffset PublishAt,
    DateTimeOffset? ApplicationDeadline,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    SalaryTaxMode SalaryTaxMode,
    LocationDto? Location,
    EmployerVacancyStatsDto Stats,
    IReadOnlyCollection<EmployerVacancyRecentApplicationDto> RecentApplications,
    IReadOnlyCollection<string> Tags);

public record EmployerVacancyStatsDto(
    int TotalApplications,
    int ApplicationsLast24Hours,
    int NewCount,
    int InReviewCount,
    int InterviewCount,
    int OfferCount,
    int HiredCount,
    int RejectedCount,
    int CanceledCount);

public record EmployerVacancyRecentApplicationDto(
    long ApplicationId,
    long CandidateUserId,
    string CandidateName,
    string? CandidateAvatarUrl,
    ApplicationStatus Status,
    DateTimeOffset CreatedAt);

public record EmployerVacancyUpsertRequest(
    string Title,
    string ShortDescription,
    string FullDescription,
    VacancyKind Kind,
    WorkFormat Format,
    OpportunityStatus Status,
    long? CityId,
    long? LocationId,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    SalaryTaxMode SalaryTaxMode,
    DateTimeOffset PublishAt,
    DateTimeOffset? ApplicationDeadline,
    IReadOnlyCollection<long>? TagIds,
    MapPointDto? MapPoint = null);

/// <summary>
/// Географическая точка для определения текстового адреса.
/// </summary>
/// <param name="Latitude">Широта WGS84.</param>
/// <param name="Longitude">Долгота WGS84.</param>
public record MapPointDto(decimal Latitude, decimal Longitude);

/// <summary>
/// Запрос приглашения пользователя на вакансию в личный чат.
/// </summary>
/// <param name="CandidateUserId">Идентификатор пользователя, которого нужно пригласить.</param>
public record EmployerVacancyInviteRequest(long CandidateUserId);

/// <summary>
/// Ответ при отправке приглашения в чат.
/// </summary>
/// <param name="ChatId">Идентификатор чата.</param>
/// <param name="MessageId">Идентификатор системного сообщения приглашения.</param>
public record EmployerVacancyInviteResponse(long ChatId, long MessageId);

public record EmployerVacancyStatusUpdateRequest(OpportunityStatus Status);
