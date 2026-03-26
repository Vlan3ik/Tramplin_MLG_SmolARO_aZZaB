namespace Monolith.Models.Favorites;

public record MyFavoritesDto(
    IReadOnlyCollection<long> VacancyIds,
    IReadOnlyCollection<long> OpportunityIds);
