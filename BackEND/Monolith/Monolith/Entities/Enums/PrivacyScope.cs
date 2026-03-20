namespace Monolith.Entities;

/// <summary>
/// Область видимости профиля и резюме соискателя.
/// </summary>
public enum PrivacyScope
{
    /// <summary>
    /// Видно только владельцу профиля.
    /// </summary>
    Private = 1,

    /// <summary>
    /// Видно только подтвержденным контактам.
    /// </summary>
    ContactsOnly = 2,

    /// <summary>
    /// Видно любому авторизованному пользователю платформы.
    /// </summary>
    AuthorizedUsers = 3
}
