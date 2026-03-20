namespace Monolith.Entities;

/// <summary>
/// Подтип карьерного мероприятия, представленный системными тегами группы <c>event_kind</c>.
/// </summary>
public enum CareerEventKind
{
    /// <summary>
    /// Хакатон.
    /// </summary>
    Hackathon = 1,

    /// <summary>
    /// День открытых дверей.
    /// </summary>
    OpenDay = 2,

    /// <summary>
    /// Лекция/доклад.
    /// </summary>
    Lecture = 3
}

public static class CareerEventKindExtensions
{
    public static string ToTagSlug(this CareerEventKind kind) => kind switch
    {
        CareerEventKind.Hackathon => "event_kind-hackathon",
        CareerEventKind.OpenDay => "event_kind-open-day",
        CareerEventKind.Lecture => "event_kind-lecture",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unsupported career event kind.")
    };
}
