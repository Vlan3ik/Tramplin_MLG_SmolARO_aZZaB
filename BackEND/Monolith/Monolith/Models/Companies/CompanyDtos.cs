using Monolith.Models.Media;

namespace Monolith.Models.Companies;

public record CompanyListItemDto(
    long Id,
    string Name,
    string Industry,
    bool Verified,
    string CityName,
    string? LogoUrl,
    string? WebsiteUrl,
    string? PublicEmail,
    int ActiveOpportunitiesCount);

public record CompanyDetailDto(
    long Id,
    string LegalName,
    string? BrandName,
    string Industry,
    string Description,
    bool Verified,
    string CityName,
    string? LogoUrl,
    string? WebsiteUrl,
    string? PublicEmail,
    string? PublicPhone,
    IReadOnlyCollection<CompanyMediaItemDto> Media,
    IReadOnlyCollection<CompanyLinkDto> Links,
    IReadOnlyCollection<CompanyOpportunityDto> ActiveOpportunities);

public record CompanyLinkDto(string Kind, string Url, string? Label);
public record CompanyOpportunityDto(long Id, string EntityType, string Title, string Type, string Format, DateTimeOffset PublishAt);
