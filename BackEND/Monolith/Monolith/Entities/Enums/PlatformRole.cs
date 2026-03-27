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
    Curator = 3,
    /// <summary>
    /// Р Р°Р±РѕС‡Р°СЏ Р°РґРјРёРЅ-СЂРѕР»СЊ РґР»СЏ РєСѓСЂР°С‚РѕСЂСЃРєРѕРіРѕ РєР°Р±РёРЅРµС‚Р° (role_id = 4).
    /// </summary>
    Admin = 4
}
