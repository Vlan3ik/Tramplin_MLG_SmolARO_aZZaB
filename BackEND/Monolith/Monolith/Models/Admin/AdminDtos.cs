using Monolith.Entities;

namespace Monolith.Models.Admin;

public record AdminUserListItemDto(
    long Id,
    string Email,
    string Username,
    AccountStatus Status,
    IReadOnlyCollection<string> Roles,
    DateTimeOffset CreatedAt);

public record AdminUserUpsertRequest(
    string Email,
    string FirstName,
    string LastName,
    AccountStatus Status,
    IReadOnlyCollection<PlatformRole> Roles);

public record AdminCompanyListItemDto(
    long Id,
    string LegalName,
    string? BrandName,
    CompanyStatus Status,
    long BaseCityId,
    string Industry,
    DateTimeOffset CreatedAt);

public record AdminCompanyUpsertRequest(
    string LegalName,
    string? BrandName,
    CompanyLegalType LegalType,
    string TaxId,
    string RegistrationNumber,
    string Industry,
    string Description,
    long BaseCityId,
    string? WebsiteUrl,
    string? PublicEmail,
    string? PublicPhone,
    CompanyStatus Status);

public record AdminOpportunityListItemDto(
    long Id,
    long CompanyId,
    string Title,
    OpportunityStatus Status,
    OpportunityKind Kind,
    WorkFormat Format,
    DateTimeOffset PublishAt);

public record AdminOpportunityUpsertRequest(
    long CompanyId,
    long CreatedByUserId,
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
    DateTimeOffset? EventDate);

public record AdminVacancyListItemDto(
    long Id,
    long CompanyId,
    string Title,
    OpportunityStatus Status,
    VacancyKind Kind,
    WorkFormat Format,
    DateTimeOffset PublishAt);

public record AdminVacancyUpsertRequest(
    long CompanyId,
    long CreatedByUserId,
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
    DateTimeOffset? ApplicationDeadline);
