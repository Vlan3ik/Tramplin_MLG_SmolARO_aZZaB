namespace Monolith.Entities;

public class VacancyTag
{
    public long VacancyId { get; set; }
    public long TagId { get; set; }

    public Vacancy Vacancy { get; set; } = null!;
    public Tag Tag { get; set; } = null!;
}
