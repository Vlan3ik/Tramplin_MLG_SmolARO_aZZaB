using Monolith.Entities;

namespace Monolith.Models.Opportunities;

public record OpportunityListItemDto(
    long Id,
    string Title,
    OpportunityKind Kind,
    WorkFormat Format,
    string CompanyName,
    string LocationName,
    PriceType PriceType,
    decimal? PriceAmount,
    string? PriceCurrencyCode,
    DateTimeOffset PublishAt,
    DateTimeOffset? EventDate,
    bool VerifiedCompany,
    int ParticipantsCount,
    bool IsParticipating,
    bool ParticipantsCanWrite,
    IReadOnlyCollection<string> Tags)
{
    public long CompanyId { get; init; }
    public string? CompanyLogoUrl { get; init; }
    public int TagMatchCount { get; init; }
    public bool IsFavoriteByMe { get; init; }
    public int FriendFavoritesCount { get; init; }
    public int FriendApplicationsCount { get; init; }
}

public record OpportunityDetailDto(
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
    int ParticipantsCount,
    bool IsParticipating,
    CompanyShortDto Company,
    LocationDto? Location,
    IReadOnlyCollection<string> Tags)
{
    public int TagMatchCount { get; init; }
    public bool IsFavoriteByMe { get; init; }
    public int FriendFavoritesCount { get; init; }
    public int FriendApplicationsCount { get; init; }
}

public record CompanyShortDto(long Id, string Name, bool Verified, string? WebsiteUrl, string? PublicEmail);

public record LocationDto(long? CityId, string CityName, decimal? Latitude, decimal? Longitude, string? StreetName, string? HouseNumber);
