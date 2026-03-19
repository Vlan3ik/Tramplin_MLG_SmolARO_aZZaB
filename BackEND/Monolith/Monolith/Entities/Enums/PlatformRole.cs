namespace Monolith.Entities;

/// <summary>
/// Платформенные роли пользователя.
/// </summary>
public enum PlatformRole
{
    /// <summary>
    /// Соискатель (role_id = 1).
    /// </summary>
    Seeker = 1,
    /// <summary>
    /// Работодатель (role_id = 2).
    /// </summary>
    Employer = 2,
    /// <summary>
    /// Куратор/администратор платформы (role_id = 3).
    /// </summary>
    Curator = 3
}
