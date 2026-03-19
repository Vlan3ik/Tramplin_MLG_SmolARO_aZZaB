using Monolith.Entities;

namespace Monolith.Models.Admin;

/// <summary>
/// Краткая карточка пользователя для административного списка.
/// </summary>
/// <param name="Id">Идентификатор пользователя.</param>
/// <param name="Email">Email пользователя (уникальный).</param>
/// <param name="Username">Username пользователя.</param>
/// <param name="Status">Статус учетной записи.</param>
/// <param name="Roles">Набор платформенных ролей (string-коды).</param>
/// <param name="CreatedAt">Дата создания учетной записи.</param>
public record AdminUserListItemDto(long Id, string Email, string Username, AccountStatus Status, IReadOnlyCollection<string> Roles, DateTimeOffset CreatedAt);

/// <summary>
/// Данные для создания/обновления пользователя в админ-контуре.
/// </summary>
/// <param name="Email">Email пользователя.</param>
/// <param name="FirstName">Имя пользователя.</param>
/// <param name="LastName">Фамилия пользователя.</param>
/// <param name="Status">Статус учетной записи.</param>
/// <param name="Roles">Набор платформенных ролей.</param>
public record AdminUserUpsertRequest(string Email, string FirstName, string LastName, AccountStatus Status, IReadOnlyCollection<PlatformRole> Roles);

/// <summary>
/// Краткая карточка компании для административного списка.
/// </summary>
/// <param name="Id">Идентификатор компании.</param>
/// <param name="LegalName">Юридическое наименование.</param>
/// <param name="BrandName">Брендовое наименование.</param>
/// <param name="Status">Статус компании.</param>
/// <param name="BaseCityId">Идентификатор базового города.</param>
/// <param name="Industry">Отрасль компании.</param>
/// <param name="CreatedAt">Дата создания компании.</param>
public record AdminCompanyListItemDto(long Id, string LegalName, string? BrandName, CompanyStatus Status, long BaseCityId, string Industry, DateTimeOffset CreatedAt);

/// <summary>
/// Данные для создания/обновления компании в админ-контуре.
/// </summary>
/// <param name="LegalName">Юридическое наименование.</param>
/// <param name="BrandName">Брендовое наименование.</param>
/// <param name="LegalType">Форма организации (юрлицо/ИП).</param>
/// <param name="TaxId">ИНН.</param>
/// <param name="RegistrationNumber">ОГРН/регистрационный номер.</param>
/// <param name="Industry">Отрасль.</param>
/// <param name="Description">Описание компании.</param>
/// <param name="BaseCityId">Идентификатор базового города.</param>
/// <param name="WebsiteUrl">URL сайта компании.</param>
/// <param name="PublicEmail">Публичный email.</param>
/// <param name="PublicPhone">Публичный телефон.</param>
/// <param name="Status">Статус компании.</param>
public record AdminCompanyUpsertRequest(
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
    string? PublicPhone,
    CompanyStatus Status);

/// <summary>
/// Краткая карточка вакансии для административного списка.
/// </summary>
/// <param name="Id">Идентификатор вакансии.</param>
/// <param name="CompanyId">Идентификатор компании-владельца.</param>
/// <param name="Title">Заголовок вакансии.</param>
/// <param name="Status">Статус вакансии.</param>
/// <param name="Type">Тип вакансии.</param>
/// <param name="Format">Формат работы.</param>
/// <param name="PublishAt">Дата/время публикации.</param>
public record AdminOpportunityListItemDto(long Id, long CompanyId, string Title, OpportunityStatus Status, OpportunityType Type, WorkFormat Format, DateTimeOffset PublishAt);

/// <summary>
/// Данные для создания/обновления вакансии в админ-контуре.
/// </summary>
/// <param name="CompanyId">Идентификатор компании-владельца.</param>
/// <param name="CreatedByUserId">Идентификатор пользователя-создателя.</param>
/// <param name="Title">Заголовок вакансии.</param>
/// <param name="ShortDescription">Краткое описание.</param>
/// <param name="FullDescription">Полное описание.</param>
/// <param name="OppType">Тип вакансии.</param>
/// <param name="Format">Формат работы.</param>
/// <param name="Status">Статус вакансии.</param>
/// <param name="CityId">Идентификатор города (опционально).</param>
/// <param name="LocationId">Идентификатор локации (опционально).</param>
/// <param name="SalaryFrom">Нижняя граница зарплаты.</param>
/// <param name="SalaryTo">Верхняя граница зарплаты.</param>
/// <param name="CurrencyCode">Код валюты.</param>
/// <param name="PublishAt">Дата/время публикации.</param>
/// <param name="ApplicationDeadline">Крайний срок отклика.</param>
public record AdminOpportunityUpsertRequest(
    long CompanyId,
    long CreatedByUserId,
    string Title,
    string ShortDescription,
    string FullDescription,
    OpportunityType OppType,
    WorkFormat Format,
    OpportunityStatus Status,
    long? CityId,
    long? LocationId,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    DateTimeOffset PublishAt,
    DateTimeOffset? ApplicationDeadline);
