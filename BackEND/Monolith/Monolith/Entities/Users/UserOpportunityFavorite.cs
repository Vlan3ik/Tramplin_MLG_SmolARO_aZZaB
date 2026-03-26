namespace Monolith.Entities;

public class UserOpportunityFavorite
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public long? VacancyId { get; set; }
    public long? OpportunityId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Vacancy? Vacancy { get; set; }
    public Opportunity? Opportunity { get; set; }
}
