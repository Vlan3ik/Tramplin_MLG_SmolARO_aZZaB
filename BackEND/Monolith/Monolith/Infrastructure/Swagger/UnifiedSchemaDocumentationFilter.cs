using System.Globalization;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Monolith.Entities;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Monolith.Infrastructure.Swagger;

public class UnifiedSchemaDocumentationFilter : ISchemaFilter
{
    private static readonly IReadOnlyDictionary<Type, string> TypeDescriptions = new Dictionary<Type, string>
    {
        [typeof(Monolith.Models.Common.ErrorResponse)] = "Стандартизированная модель ошибки API.",
        [typeof(Monolith.Models.Auth.AuthResponse)] = "Ответ с access/refresh токенами и данными авторизованного пользователя.",
        [typeof(Monolith.Models.Auth.AuthUserDto)] = "Краткая информация о пользователе в контексте авторизации.",
        [typeof(Monolith.Models.Subscriptions.SubscriptionStatsDto)] = "Сводная статистика по подпискам пользователя."
    };

    private static readonly IReadOnlyDictionary<string, string> IdHints = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["id"] = "Числовой идентификатор сущности.",
        ["userId"] = "Идентификатор пользователя.",
        ["candidateUserId"] = "Идентификатор кандидата.",
        ["createdByUserId"] = "Идентификатор автора создания.",
        ["newOwnerUserId"] = "Идентификатор пользователя для передачи владения.",
        ["linkId"] = "Идентификатор ссылки компании.",
        ["companyId"] = "Идентификатор компании.",
        ["baseCityId"] = "Идентификатор города из GET /catalog/cities.",
        ["cityId"] = "Идентификатор города из GET /catalog/cities.",
        ["locationId"] = "Идентификатор локации из GET /catalog/locations.",
        ["groupId"] = "Идентификатор группы тегов из GET /catalog/tag-groups.",
        ["tagId"] = "Идентификатор тега из GET /catalog/tags.",
        ["tagIds"] = "Идентификаторы тегов из GET /catalog/tags.",
        ["opportunityId"] = "Идентификатор возможности из GET /opportunities.",
        ["vacancyId"] = "Идентификатор вакансии из GET /vacancies.",
        ["vacancyIds"] = "Идентификаторы вакансий из GET /vacancies.",
        ["chatId"] = "Идентификатор чата из GET /chats.",
        ["messageId"] = "Идентификатор сообщения из GET /chats/{chatId}/messages."
    };

    private static readonly IReadOnlyDictionary<string, string> PropertyHints = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["code"] = "Машиночитаемый код результата или ошибки.",
        ["message"] = "Текстовое описание результата или ошибки.",
        ["details"] = "Дополнительные сведения об ошибке или результате.",
        ["items"] = "Элементы текущей страницы ответа.",
        ["totalCount"] = "Общее количество элементов без учёта пагинации.",
        ["page"] = "Текущий номер страницы.",
        ["pageSize"] = "Размер страницы.",
        ["email"] = "Email-адрес пользователя.",
        ["password"] = "Пароль в открытом виде, передаваемый только в запросе.",
        ["currentPassword"] = "Текущий пароль пользователя.",
        ["newPassword"] = "Новый пароль пользователя.",
        ["accessToken"] = "JWT access token для авторизации запросов.",
        ["accessTokenExpiresAt"] = "Дата и время истечения access token.",
        ["refreshToken"] = "Refresh token для обновления access token.",
        ["refreshTokenExpiresAt"] = "Дата и время истечения refresh token.",
        ["user"] = "Данные пользователя, связанного с ответом.",
        ["username"] = "Уникальный username пользователя.",
        ["fio"] = "ФИО пользователя.",
        ["avatarUrl"] = "Относительный или абсолютный URL аватара.",
        ["roles"] = "Набор ролей, назначенных пользователю.",
        ["status"] = "Текущий статус сущности.",
        ["createdAt"] = "Дата и время создания записи.",
        ["updatedAt"] = "Дата и время последнего обновления записи.",
        ["title"] = "Название сущности.",
        ["headline"] = "Короткий заголовок или профессиональный слоган.",
        ["summary"] = "Развёрнутое текстовое описание.",
        ["description"] = "Развёрнутое текстовое описание.",
        ["shortDescription"] = "Короткое описание для карточек и списков.",
        ["fullDescription"] = "Полное описание сущности.",
        ["desiredPosition"] = "Желаемая должность или роль.",
        ["salaryFrom"] = "Нижняя граница зарплаты или бюджета.",
        ["salaryTo"] = "Верхняя граница зарплаты или бюджета.",
        ["currencyCode"] = "Код валюты по ISO 4217.",
        ["priceAmount"] = "Сумма стоимости или призового фонда.",
        ["priceCurrencyCode"] = "Код валюты стоимости по ISO 4217.",
        ["publishAt"] = "Дата и время публикации.",
        ["eventDate"] = "Дата и время проведения события.",
        ["applicationDeadline"] = "Крайний срок подачи отклика.",
        ["tagName"] = "Название тега.",
        ["tagNames"] = "Список названий тегов.",
        ["name"] = "Название сущности.",
        ["url"] = "URL-адрес ресурса.",
        ["phone"] = "Контактный номер телефона.",
        ["organizationName"] = "Название компании или организации.",
        ["companyName"] = "Название компании.",
        ["legalName"] = "Юридическое название компании.",
        ["brandName"] = "Публичное название или бренд компании.",
        ["industry"] = "Отрасль или направление деятельности.",
        ["taxId"] = "ИНН или аналогичный налоговый идентификатор.",
        ["registrationNumber"] = "Регистрационный номер организации.",
        ["websiteUrl"] = "Публичный URL сайта.",
        ["publicEmail"] = "Публичный контактный email.",
        ["publicPhone"] = "Публичный контактный телефон.",
        ["locationName"] = "Название локации.",
        ["cityName"] = "Название города.",
        ["birthDate"] = "Дата рождения.",
        ["gender"] = "Пол пользователя.",
        ["about"] = "Текстовое описание профиля или компании.",
        ["openToWork"] = "Признак готовности к новым предложениям.",
        ["skills"] = "Список навыков.",
        ["projects"] = "Список проектов.",
        ["education"] = "Список записей об образовании.",
        ["links"] = "Список внешних ссылок.",
        ["experiences"] = "Список опыта работы.",
        ["followersCount"] = "Количество подписчиков.",
        ["followingCount"] = "Количество оформленных подписок.",
        ["isFollowedByMe"] = "Признак, что текущий пользователь подписан на эту сущность.",
        ["subscribedAt"] = "Дата и время оформления подписки."
    };

    private static readonly IReadOnlyDictionary<Type, IReadOnlyDictionary<string, string>> EnumLabels =
        new Dictionary<Type, IReadOnlyDictionary<string, string>>
        {
            [typeof(VacancyKind)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Internship"] = "Стажировка",
                ["Job"] = "Работа"
            },
            [typeof(SalaryTaxMode)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["BeforeTax"] = "До вычета налогов",
                ["AfterTax"] = "После вычета налогов",
                ["Unknown"] = "Не указано"
            },
            [typeof(OpportunityStatus)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Draft"] = "Черновик",
                ["PendingModeration"] = "На модерации",
                ["Active"] = "Активна",
                ["Finished"] = "Завершена",
                ["Canceled"] = "Отменена",
                ["Rejected"] = "Отклонена",
                ["Archived"] = "Архив"
            },
            [typeof(ApplicationStatus)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["New"] = "Новый",
                ["InReview"] = "На рассмотрении",
                ["Interview"] = "Собеседование",
                ["Offer"] = "Оффер",
                ["Hired"] = "Нанят",
                ["Rejected"] = "Отклонен",
                ["Canceled"] = "Отменен"
            },
            [typeof(OpportunityKind)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Hackathon"] = "Хакатон",
                ["OpenDay"] = "День открытых дверей",
                ["Lecture"] = "Лекция",
                ["Other"] = "Другое"
            },
            [typeof(PriceType)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Free"] = "Бесплатно",
                ["Paid"] = "Платно",
                ["Prize"] = "Приз"
            },
            [typeof(MapEntityType)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Vacancy"] = "Вакансия",
                ["Opportunity"] = "Возможность"
            },
            [typeof(CandidateGender)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Unknown"] = "Не указан",
                ["Male"] = "Мужской",
                ["Female"] = "Женский"
            }
        };

    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (context.Type.IsEnum)
        {
            AppendEnumDescription(schema, context.Type);
            return;
        }

        if (string.IsNullOrWhiteSpace(schema.Description))
        {
            schema.Description = BuildTypeDescription(context.Type);
        }

        if (schema.Properties.Count == 0)
        {
            return;
        }

        foreach (var (name, propertySchema) in schema.Properties)
        {
            if (!string.IsNullOrWhiteSpace(propertySchema.Description))
            {
                continue;
            }

            if (TryGetIdDescription(name, out var idDescription))
            {
                propertySchema.Description = idDescription;
                continue;
            }

            if (PropertyHints.TryGetValue(name, out var propertyDescription))
            {
                propertySchema.Description = propertyDescription;
            }
        }
    }

    private static void AppendEnumDescription(OpenApiSchema schema, Type enumType)
    {
        var values = Enum.GetValues(enumType).Cast<object>().ToArray();
        if (values.Length == 0)
        {
            return;
        }

        var lines = values.Select(value =>
        {
            var numeric = Convert.ToInt64(value, CultureInfo.InvariantCulture);
            var name = Enum.GetName(enumType, value) ?? value.ToString() ?? numeric.ToString(CultureInfo.InvariantCulture);
            if (EnumLabels.TryGetValue(enumType, out var labels) && labels.TryGetValue(name, out var label))
            {
                return $"{numeric} = {name} ({label})";
            }

            return $"{numeric} = {name}";
        });

        var enumDescription = $"Коды: {string.Join("; ", lines)}.";
        schema.Description = string.IsNullOrWhiteSpace(schema.Description)
            ? enumDescription
            : $"{schema.Description} {enumDescription}";

        if (schema.Example is null && values.Length > 0)
        {
            var firstValue = Convert.ToInt64(values[0], CultureInfo.InvariantCulture);
            schema.Example = new OpenApiLong(firstValue);
        }
    }

    private static bool TryGetIdDescription(string propertyName, out string description)
    {
        if (IdHints.TryGetValue(propertyName, out description!))
        {
            return true;
        }

        if (propertyName.EndsWith("Ids", StringComparison.OrdinalIgnoreCase))
        {
            description = "Массив числовых идентификаторов.";
            return true;
        }

        if (propertyName.EndsWith("Id", StringComparison.OrdinalIgnoreCase))
        {
            description = "Числовой идентификатор.";
            return true;
        }

        description = string.Empty;
        return false;
    }

    private static string BuildTypeDescription(Type type)
    {
        if (TypeDescriptions.TryGetValue(type, out var explicitDescription))
        {
            return explicitDescription;
        }

        if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Monolith.Models.Common.PagedResponse<>))
        {
            var itemType = type.GetGenericArguments()[0];
            return $"Постраничный ответ со списком элементов типа «{ResolveEntityLabel(itemType)}».";
        }

        var name = type.Name;
        return name switch
        {
            var x when x.EndsWith("ListItemDto", StringComparison.Ordinal) =>
                $"Краткая карточка сущности «{ResolveEntityLabel(type)}» для отображения в списке.",
            var x when x.EndsWith("DetailDto", StringComparison.Ordinal) =>
                $"Подробная модель сущности «{ResolveEntityLabel(type)}».",
            var x when x.EndsWith("ShortDto", StringComparison.Ordinal) =>
                $"Сокращённая модель сущности «{ResolveEntityLabel(type)}».",
            var x when x.EndsWith("LinkedCardDto", StringComparison.Ordinal) =>
                $"Краткая связанная карточка сущности «{ResolveEntityLabel(type)}».",
            var x when x.EndsWith("StatsDto", StringComparison.Ordinal) =>
                $"Статистическая сводка по сущности «{ResolveEntityLabel(type)}».",
            var x when x.EndsWith("Response", StringComparison.Ordinal) =>
                $"Модель ответа «{ResolveEntityLabel(type)}».",
            var x when x.EndsWith("Request", StringComparison.Ordinal) =>
                $"Модель запроса «{ResolveEntityLabel(type)}».",
            var x when x.EndsWith("Query", StringComparison.Ordinal) =>
                $"Параметры запроса для сущности «{ResolveEntityLabel(type)}».",
            _ => $"Модель данных «{ResolveEntityLabel(type)}»."
        };
    }

    private static string ResolveEntityLabel(Type type)
    {
        var name = type.Name;
        var suffixes = new[]
        {
            "PagedResponse",
            "ListItemDto",
            "DetailDto",
            "ShortDto",
            "LinkedCardDto",
            "StatsDto",
            "UpsertRequest",
            "UpdateRequest",
            "CreateRequest",
            "StatusUpdateRequest",
            "Response",
            "Request",
            "Query",
            "Dto"
        };

        foreach (var suffix in suffixes)
        {
            if (name.EndsWith(suffix, StringComparison.Ordinal))
            {
                name = name[..^suffix.Length];
                break;
            }
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            name = type.Name;
        }

        return name switch
        {
            "AdminUser" => "административный пользователь",
            "AdminCompany" => "административная компания",
            "AdminOpportunity" => "административная возможность",
            "AdminVacancy" => "административная вакансия",
            "Application" => "отклик",
            "Auth" => "авторизация",
            "AuthUser" => "авторизованный пользователь",
            "Candidate" => "кандидат",
            "Chat" => "чат",
            "ChatMessage" => "сообщение чата",
            "City" => "город",
            "Company" => "компания",
            "Contact" => "контакт",
            "EmployerApplication" => "отклик работодателя",
            "EmployerCompany" => "компания работодателя",
            "EmployerLocation" => "локация работодателя",
            "EmployerOpportunity" => "возможность работодателя",
            "EmployerVacancy" => "вакансия работодателя",
            "Favorite" => "избранное",
            "Location" => "локация",
            "Me" => "текущий пользователь",
            "Opportunity" => "возможность",
            "PortfolioProject" => "портфолио-проект",
            "Profile" => "профиль",
            "PublicProfile" => "публичный профиль",
            "Refresh" => "обновление токена",
            "Register" => "регистрация",
            "Resume" => "резюме",
            "ResumeEducation" => "образование в резюме",
            "ResumeExperience" => "опыт работы в резюме",
            "ResumeLink" => "ссылка резюме",
            "ResumeProject" => "проект резюме",
            "ResumeSkill" => "навык резюме",
            "Search" => "поиск",
            "SendChatMessage" => "отправка сообщения",
            "Subscription" => "подписка",
            "TransferCompanyOwner" => "передача владения компанией",
            "UpdateCompanyChatSettings" => "настройки чата компании",
            "UpdateCompanyVerification" => "верификация компании",
            "UpdateProfile" => "обновление профиля",
            "UpdateResume" => "обновление резюме",
            "UpdateResumeDetails" => "обновление деталей резюме",
            "UpdateUsername" => "обновление username",
            "UploadMedia" => "загрузка медиа",
            "Username" => "username",
            "Vacancy" => "вакансия",
            "VkLogin" => "авторизация VK",
            _ => SplitPascalCase(name).ToLowerInvariant()
        };
    }

    private static string SplitPascalCase(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        return string.Concat(value.Select((ch, index) =>
            index > 0 && char.IsUpper(ch) && !char.IsUpper(value[index - 1])
                ? $" {ch}"
                : ch.ToString()));
    }
}
