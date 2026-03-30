namespace Monolith.Models.Tags;

public record TechnologyTagListItemDto(
    long Id,
    long GroupId,
    string GroupCode,
    string Name,
    string Slug);

public record TechnologyTagUpsertRequest(string Name);
