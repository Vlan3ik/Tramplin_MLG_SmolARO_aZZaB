using Monolith.Entities;

namespace Monolith.Models.Applications;

public record ApplicationListItemDto(
    long Id,
    long VacancyId,
    string VacancyTitle,
    string CompanyName,
    string LocationName,
    ApplicationStatus Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
