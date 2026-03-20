using Monolith.Entities;
using Monolith.Models.Opportunities;

namespace Monolith.Models.Vacancies;

public record VacancyListItemDto(
    long Id,
    string Title,
    VacancyKind Kind,
    WorkFormat Format,
    string CompanyName,
    string LocationName,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    SalaryTaxMode SalaryTaxMode,
    DateTimeOffset PublishAt,
    bool VerifiedCompany,
    IReadOnlyCollection<string> Tags);

public record VacancyDetailDto(
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
    CompanyShortDto Company,
    LocationDto? Location,
    IReadOnlyCollection<string> Tags);
