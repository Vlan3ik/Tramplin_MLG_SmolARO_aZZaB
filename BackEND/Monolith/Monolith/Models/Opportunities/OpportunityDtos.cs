using Monolith.Entities;

namespace Monolith.Models.Opportunities;

public record OpportunityListItemDto(
    long Id,
    string Title,
    OpportunityType Type,
    WorkFormat Format,
    string CompanyName,
    string LocationName,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    DateTimeOffset PublishAt,
    bool VerifiedCompany,
    IReadOnlyCollection<string> Tags);

public record OpportunityDetailDto(
    long Id,
    string Title,
    string ShortDescription,
    string FullDescription,
    OpportunityType Type,
    WorkFormat Format,
    OpportunityStatus Status,
    DateTimeOffset PublishAt,
    DateTimeOffset? ApplicationDeadline,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    CompanyShortDto Company,
    LocationDto? Location,
    IReadOnlyCollection<string> Tags);

public record CompanyShortDto(long Id, string Name, bool Verified, string? WebsiteUrl, string? PublicEmail);

public record LocationDto(long? CityId, string CityName, decimal? Latitude, decimal? Longitude, string? StreetName, string? HouseNumber);
