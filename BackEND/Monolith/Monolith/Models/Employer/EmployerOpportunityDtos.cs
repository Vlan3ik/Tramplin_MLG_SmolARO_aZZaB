using Monolith.Entities;
using Monolith.Models.Opportunities;

namespace Monolith.Models.Employer;

public class EmployerOpportunityListQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public OpportunityStatus[]? Statuses { get; set; }
    public OpportunityKind[]? Kinds { get; set; }
    public WorkFormat[]? Formats { get; set; }
    public PriceType[]? PriceTypes { get; set; }
    public decimal? PriceFrom { get; set; }
    public decimal? PriceTo { get; set; }
    public long[]? TagIds { get; set; }
}

public record EmployerOpportunityListItemDto(
    long Id,
    string Title,
    OpportunityKind Kind,
    WorkFormat Format,
    OpportunityStatus Status,
    PriceType PriceType,
    decimal? PriceAmount,
    string? PriceCurrencyCode,
    bool ParticipantsCanWrite,
    DateTimeOffset PublishAt,
    DateTimeOffset? EventDate,
    int ParticipantsCount,
    int ParticipantsLast24Hours,
    IReadOnlyCollection<string> Tags);

public record EmployerOpportunityDetailDto(
    long Id,
    string Title,
    string ShortDescription,
    string FullDescription,
    OpportunityKind Kind,
    WorkFormat Format,
    OpportunityStatus Status,
    DateTimeOffset PublishAt,
    DateTimeOffset? EventDate,
    PriceType PriceType,
    decimal? PriceAmount,
    string? PriceCurrencyCode,
    bool ParticipantsCanWrite,
    LocationDto? Location,
    EmployerOpportunityStatsDto Stats,
    IReadOnlyCollection<EmployerOpportunityRecentParticipantDto> RecentParticipants,
    IReadOnlyCollection<string> Tags);

public record EmployerOpportunityStatsDto(
    int TotalParticipants,
    int ParticipantsLast24Hours);

public record EmployerOpportunityRecentParticipantDto(
    long UserId,
    string DisplayName,
    string? AvatarUrl,
    DateTimeOffset JoinedAt);

public record EmployerOpportunityUpsertRequest(
    string Title,
    string ShortDescription,
    string FullDescription,
    OpportunityKind Kind,
    WorkFormat Format,
    OpportunityStatus Status,
    long? CityId,
    long? LocationId,
    PriceType PriceType,
    decimal? PriceAmount,
    string? PriceCurrencyCode,
    bool ParticipantsCanWrite,
    DateTimeOffset PublishAt,
    DateTimeOffset? EventDate,
    IReadOnlyCollection<long>? TagIds,
    MapPointDto? MapPoint = null);

public record EmployerOpportunityStatusUpdateRequest(OpportunityStatus Status);
