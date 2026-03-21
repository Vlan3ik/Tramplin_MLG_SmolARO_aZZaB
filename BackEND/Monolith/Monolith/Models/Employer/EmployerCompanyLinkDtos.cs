using Monolith.Entities;

namespace Monolith.Models.Employer;

/// <summary>
/// Данные ссылки компании.
/// </summary>
/// <param name="Id">Идентификатор ссылки.</param>
/// <param name="LinkKind">Тип ссылки компании.</param>
/// <param name="Url">Нормализованный URL ссылки.</param>
/// <param name="Label">Пользовательская подпись ссылки.</param>
/// <param name="CreatedAt">Дата создания ссылки.</param>
public record EmployerCompanyLinkDto(
    long Id,
    LinkType LinkKind,
    string Url,
    string? Label,
    DateTimeOffset CreatedAt);

/// <summary>
/// Запрос на создание ссылки компании.
/// </summary>
/// <param name="LinkKind">Тип ссылки компании.</param>
/// <param name="Url">URL ссылки.</param>
/// <param name="Label">Пользовательская подпись ссылки.</param>
public record CreateEmployerCompanyLinkRequest(
    LinkType LinkKind,
    string Url,
    string? Label);

/// <summary>
/// Запрос на изменение ссылки компании.
/// </summary>
/// <param name="LinkKind">Тип ссылки компании.</param>
/// <param name="Url">URL ссылки.</param>
/// <param name="Label">Пользовательская подпись ссылки.</param>
public record UpdateEmployerCompanyLinkRequest(
    LinkType LinkKind,
    string Url,
    string? Label);
