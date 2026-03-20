namespace Monolith.Entities;

/// <summary>
/// Статус модерации и публикации карточки возможности.
/// </summary>
public enum OpportunityStatus
{
    Draft = 1,
    PendingModeration = 2,
    Active = 3,
    Finished = 4,
    Canceled = 5,
    Rejected = 6,
    Archived = 7
}
