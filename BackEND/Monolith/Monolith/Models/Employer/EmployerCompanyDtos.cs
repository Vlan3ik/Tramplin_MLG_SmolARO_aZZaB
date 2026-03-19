using Monolith.Entities;

namespace Monolith.Models.Employer;

/// <summary>
/// Запрос на создание черновика компании работодателя.
/// </summary>
/// <param name="LegalName">Юридическое наименование компании.</param>
/// <param name="BrandName">Брендовое наименование компании.</param>
/// <param name="LogoUrl">URL логотипа компании.</param>
public record CreateEmployerCompanyRequest(string LegalName, string? BrandName, string? LogoUrl);

/// <summary>
/// Запрос на обновление данных компании для верификации.
/// </summary>
/// <param name="LegalName">Юридическое наименование.</param>
/// <param name="BrandName">Брендовое наименование.</param>
/// <param name="LegalType">Форма организации.</param>
/// <param name="TaxId">ИНН.</param>
/// <param name="RegistrationNumber">Регистрационный номер.</param>
/// <param name="Industry">Отрасль компании.</param>
/// <param name="Description">Описание компании.</param>
/// <param name="BaseCityId">Идентификатор базового города.</param>
/// <param name="WebsiteUrl">URL сайта компании.</param>
/// <param name="PublicEmail">Публичный email.</param>
/// <param name="PublicPhone">Публичный телефон.</param>
public record UpdateCompanyVerificationRequest(
    string LegalName,
    string? BrandName,
    CompanyLegalType LegalType,
    string TaxId,
    string RegistrationNumber,
    string Industry,
    string Description,
    long BaseCityId,
    string? WebsiteUrl,
    string? PublicEmail,
    string? PublicPhone);

/// <summary>
/// Запрос на создание инвайта в компанию.
/// </summary>
/// <param name="Role">Роль приглашенного участника в компании.</param>
/// <param name="ExpiresInDays">Срок жизни инвайта в днях.</param>
public record CreateCompanyInviteRequest(CompanyMemberRole Role, int ExpiresInDays = 7);

/// <summary>
/// Ответ с данными созданного инвайта.
/// </summary>
/// <param name="Token">Уникальный токен инвайта.</param>
/// <param name="InviteLink">Относительная ссылка для принятия инвайта.</param>
/// <param name="ExpiresAt">Дата и время истечения срока действия.</param>
public record CompanyInviteCreatedResponse(string Token, string InviteLink, DateTimeOffset ExpiresAt);

/// <summary>
/// Запрос на обновление чат-настроек компании.
/// </summary>
/// <param name="AutoGreetingEnabled">Флаг включения авто-приветствия.</param>
/// <param name="AutoGreetingText">Текст авто-приветствия.</param>
/// <param name="OutsideHoursEnabled">Флаг включения ответа вне рабочих часов.</param>
/// <param name="OutsideHoursText">Текст сообщения вне рабочих часов.</param>
/// <param name="WorkingHoursTimezone">Таймзона рабочих часов.</param>
/// <param name="WorkingHoursFrom">Начало рабочего интервала.</param>
/// <param name="WorkingHoursTo">Окончание рабочего интервала.</param>
public record UpdateCompanyChatSettingsRequest(
    bool AutoGreetingEnabled,
    string? AutoGreetingText,
    bool OutsideHoursEnabled,
    string? OutsideHoursText,
    string WorkingHoursTimezone,
    TimeSpan? WorkingHoursFrom,
    TimeSpan? WorkingHoursTo);
