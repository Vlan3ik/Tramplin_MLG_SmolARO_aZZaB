namespace Monolith.Entities;

/// <summary>
/// Статус модерации и публикации карточки возможности.
/// </summary>
public enum OpportunityStatus
{
    Draft = 1,
    PendingModeration = 2,
    Planned = 3,
    Published = 4,
    Closed = 5,
    Rejected = 6,
    Archived = 7
}
