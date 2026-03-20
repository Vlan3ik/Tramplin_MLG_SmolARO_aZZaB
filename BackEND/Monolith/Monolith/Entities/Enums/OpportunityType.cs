namespace Monolith.Entities;

/// <summary>
/// Тип возможности для каталога, карты и фильтрации.
/// </summary>
public enum OpportunityType
{
    /// <summary>
    /// Стажировка.
    /// </summary>
    Internship = 1,

    /// <summary>
    /// Вакансия.
    /// </summary>
    Vacancy = 2,

    /// <summary>
    /// Менторская программа.
    /// </summary>
    MentorshipProgram = 3,

    /// <summary>
    /// Карьерное мероприятие (например, хакатон, день открытых дверей, лекция).
    /// </summary>
    CareerEvent = 4
}
