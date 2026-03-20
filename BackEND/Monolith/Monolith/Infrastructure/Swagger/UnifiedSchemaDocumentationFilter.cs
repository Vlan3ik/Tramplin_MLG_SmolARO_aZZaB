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
        ["userId"] = "User id.",
        ["candidateUserId"] = "Candidate user id.",
        ["createdByUserId"] = "Creator user id.",
        ["newOwnerUserId"] = "Target user id for ownership transfer.",
        ["companyId"] = "Company id.",
        ["baseCityId"] = "City id from GET /catalog/cities.",
        ["cityId"] = "City id from GET /catalog/cities.",
        ["locationId"] = "Location id from GET /catalog/locations.",
        ["groupId"] = "Tag group id from GET /catalog/tag-groups.",
        ["tagId"] = "Tag id from GET /catalog/tags.",
        ["tagIds"] = "Tag ids from GET /catalog/tags.",
        ["opportunityId"] = "Opportunity id from GET /opportunities.",
        ["vacancyId"] = "Vacancy id from GET /vacancies.",
        ["vacancyIds"] = "Vacancy ids from GET /vacancies.",
        ["chatId"] = "Chat id from GET /chats.",
        ["messageId"] = "Message id from GET /chats/{chatId}/messages."
    };

    private static readonly IReadOnlyDictionary<Type, IReadOnlyDictionary<string, string>> EnumLabels =
        new Dictionary<Type, IReadOnlyDictionary<string, string>>
        {
            [typeof(VacancyKind)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Internship"] = "Internship",
                ["Job"] = "Job"
            },
            [typeof(SalaryTaxMode)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["BeforeTax"] = "Before tax",
                ["AfterTax"] = "After tax",
                ["Unknown"] = "Unknown"
            },
            [typeof(OpportunityStatus)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Draft"] = "Draft",
                ["PendingModeration"] = "Pending moderation",
                ["Active"] = "Active",
                ["Finished"] = "Finished",
                ["Canceled"] = "Canceled",
                ["Rejected"] = "Rejected",
                ["Archived"] = "Archived"
            },
            [typeof(ApplicationStatus)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["New"] = "New",
                ["InReview"] = "In review",
                ["Interview"] = "Interview",
                ["Offer"] = "Offer",
                ["Hired"] = "Hired",
                ["Rejected"] = "Rejected",
                ["Canceled"] = "Canceled"
            },
            [typeof(OpportunityKind)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Hackathon"] = "Hackathon",
                ["OpenDay"] = "Open day",
                ["Lecture"] = "Lecture",
                ["Other"] = "Other"
            },
            [typeof(PriceType)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Free"] = "Free",
                ["Paid"] = "Paid",
                ["Prize"] = "Prize"
            },
            [typeof(MapEntityType)] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["Vacancy"] = "Vacancy",
                ["Opportunity"] = "Opportunity"
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

        var enumDescription = $"Codes: {string.Join("; ", lines)}.";
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
            description = "Array of numeric ids.";
            return true;
        }

        if (propertyName.EndsWith("Id", StringComparison.OrdinalIgnoreCase))
        {
            description = "Numeric id.";
            return true;
        }

        description = string.Empty;
        return false;
    }
}
