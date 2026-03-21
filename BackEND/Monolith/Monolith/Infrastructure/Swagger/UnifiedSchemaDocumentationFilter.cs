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
}
