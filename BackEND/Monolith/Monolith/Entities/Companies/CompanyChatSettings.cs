namespace Monolith.Entities;

public class CompanyChatSettings
{
    public long CompanyId { get; set; }
    public bool AutoGreetingEnabled { get; set; }
    public string? AutoGreetingText { get; set; }
    public bool OutsideHoursEnabled { get; set; }
    public string? OutsideHoursText { get; set; }
    public string WorkingHoursTimezone { get; set; } = "Europe/Moscow";
    public TimeSpan? WorkingHoursFrom { get; set; }
    public TimeSpan? WorkingHoursTo { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Company Company { get; set; } = null!;
}
