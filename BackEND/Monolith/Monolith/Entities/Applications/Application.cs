namespace Monolith.Entities;

public class Application
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public long CandidateUserId { get; set; }
    public long VacancyId { get; set; }
    public PlatformRole InitiatorRole { get; set; }
    public ApplicationStatus Status { get; set; } = ApplicationStatus.New;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Company Company { get; set; } = null!;
    public User CandidateUser { get; set; } = null!;
    public Vacancy Vacancy { get; set; } = null!;
    public Chat? Chat { get; set; }
}
