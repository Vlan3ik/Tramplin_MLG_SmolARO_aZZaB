using System.Globalization;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Monolith.Entities;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Monolith.Infrastructure.Swagger;

public class UnifiedSchemaDocumentationFilter : ISchemaFilter
{
    private static readonly IReadOnlyDictionary<string, string> IdHints = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["userId"] = "Идентификатор пользователя. Получить можно через профили пользователей или административные API пользователей.",
        ["candidateUserId"] = "Идентификатор пользователя-соискателя. Получить можно через профили пользователей или список откликов.",
        ["createdByUserId"] = "Идентификатор пользователя, создавшего сущность. Для работодателей обычно это текущий авторизованный пользователь.",
        ["companyId"] = "Идентификатор компании. Получить можно через GET /companies (публичный каталог) или API работодателя/администратора.",
        ["baseCityId"] = "Идентификатор города. Получить можно через GET /catalog/cities.",
        ["cityId"] = "Идентификатор города. Получить можно через GET /catalog/cities.",
        ["locationId"] = "Идентификатор локации. Получить можно через GET /catalog/locations.",
        ["tagId"] = "Идентификатор тега. Получить можно через GET /catalog/tags.",
        ["tagIds"] = "Массив идентификаторов тегов. Получить можно через GET /catalog/tags.",
        ["groupId"] = "Идентификатор группы тегов. Получить можно через GET /catalog/tag-groups.",
        ["opportunityId"] = "Идентификатор возможности. Получить можно через GET /opportunities.",
        ["chatId"] = "Идентификатор чата. Получить можно через GET /chats.",
        ["messageId"] = "Идентификатор сообщения чата. Получить можно через GET /chats/{chatId}/messages."
    };

    private static readonly IReadOnlyDictionary<Type, IReadOnlyDictionary<string, string>> EnumLabels =
        new Dictionary<Type, IReadOnlyDictionary<string, string>>
        {
            [typeof(AccountStatus)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Active"] = "Активен",
                ["Blocked"] = "Заблокирован",
                ["Deleted"] = "Удален"
            },
            [typeof(ApplicationStatus)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Open"] = "Открыт",
                ["Closed"] = "Закрыт",
                ["Rejected"] = "Отклонен"
            },
            [typeof(CatalogStatus)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Active"] = "Активен",
                ["Pending"] = "На проверке",
                ["Archived"] = "Архив"
            },
            [typeof(ChatType)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Direct"] = "Личный чат",
                ["Application"] = "Чат отклика"
            },
            [typeof(CompanyLegalType)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["LegalEntity"] = "Юридическое лицо",
                ["IndividualEntrepreneur"] = "ИП"
            },
            [typeof(CompanyMemberRole)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Owner"] = "Владелец",
                ["Admin"] = "Администратор",
                ["Staff"] = "Сотрудник"
            },
            [typeof(CompanyStatus)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Draft"] = "Черновик",
                ["PendingVerification"] = "Ожидает верификации",
                ["Verified"] = "Подтверждена",
                ["Rejected"] = "Отклонена",
                ["Blocked"] = "Заблокирована"
            },
            [typeof(ContactRequestStatus)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Pending"] = "Ожидает",
                ["Accepted"] = "Принята",
                ["Rejected"] = "Отклонена"
            },
            [typeof(LinkType)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Website"] = "Сайт",
                ["Telegram"] = "Telegram",
                ["Vk"] = "VK",
                ["Github"] = "GitHub",
                ["Linkedin"] = "LinkedIn",
                ["Hh"] = "hh.ru",
                ["Other"] = "Другое"
            },
            [typeof(OpportunityStatus)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Draft"] = "Черновик",
                ["PendingModeration"] = "Ожидает модерации",
                ["Planned"] = "Запланирована",
                ["Published"] = "Опубликована",
                ["Closed"] = "Закрыта",
                ["Rejected"] = "Отклонена",
                ["Archived"] = "Архив"
            },
            [typeof(OpportunityType)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Internship"] = "Стажировка",
                ["Vacancy"] = "Вакансия",
                ["MentorshipProgram"] = "Менторская программа",
                ["CareerEvent"] = "Карьерное мероприятие"
            },
            [typeof(PlatformRole)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Seeker"] = "Соискатель",
                ["Employer"] = "Работодатель",
                ["Curator"] = "Куратор"
            },
            [typeof(PrivacyScope)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Private"] = "Личное",
                ["ContactsOnly"] = "Только контакты",
                ["AuthorizedUsers"] = "Все авторизованные"
            },
            [typeof(WorkFormat)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Onsite"] = "Офис/очно",
                ["Hybrid"] = "Гибрид",
                ["Remote"] = "Удаленно"
            },
            [typeof(CareerEventKind)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Hackathon"] = "Хакатон",
                ["OpenDay"] = "День открытых дверей",
                ["Lecture"] = "Лекция"
            }
        };

    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (context.Type.IsEnum)
        {
            AppendEnumDescription(schema, context.Type);
            return;
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

        var lines = values
            .Select(value =>
            {
                var numeric = Convert.ToInt64(value, CultureInfo.InvariantCulture);
                var name = Enum.GetName(enumType, value) ?? value.ToString() ?? numeric.ToString(CultureInfo.InvariantCulture);
                if (EnumLabels.TryGetValue(enumType, out var labels) && labels.TryGetValue(name, out var label))
                {
                    return $"{numeric} = {name} ({label})";
                }

                return $"{numeric} = {name}";
            })
            .ToArray();

        var enumDescription = $"Коды значений: {string.Join("; ", lines)}.";
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
            description = "Массив числовых идентификаторов. Источник значений указан в описании конкретного API-метода.";
            return true;
        }

        if (propertyName.EndsWith("Id", StringComparison.OrdinalIgnoreCase))
        {
            description = "Числовой идентификатор сущности. Источник значения указан в описании конкретного API-метода.";
            return true;
        }

        description = string.Empty;
        return false;
    }
}
