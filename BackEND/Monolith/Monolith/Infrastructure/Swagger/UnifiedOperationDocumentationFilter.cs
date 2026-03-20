using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Monolith.Infrastructure.Swagger;

public class UnifiedOperationDocumentationFilter : IOperationFilter
{
    private static readonly IReadOnlyDictionary<string, string> ParameterHints = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["cityId"] = "City id from GET /catalog/cities.",
        ["locationId"] = "Location id from GET /catalog/locations.",
        ["groupId"] = "Tag group id from GET /catalog/tag-groups.",
        ["tagIds"] = "Tag ids from GET /catalog/tags.",
        ["companyId"] = "Company id from GET /companies.",
        ["opportunityId"] = "Opportunity id from GET /opportunities.",
        ["vacancyId"] = "Vacancy id from GET /vacancies.",
        ["userId"] = "User id.",
        ["newOwnerUserId"] = "Target user id for ownership transfer.",
        ["chatId"] = "Chat id from GET /chats.",
        ["messageId"] = "Message id from GET /chats/{chatId}/messages."
    };

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        foreach (var parameter in operation.Parameters)
        {
            if (string.IsNullOrWhiteSpace(parameter.Description)
                && ParameterHints.TryGetValue(parameter.Name, out var hint))
            {
                parameter.Description = hint;
            }

            if (parameter.Schema?.Enum is not { Count: > 0 })
            {
                continue;
            }

            var enumValues = parameter.Schema.Enum
                .Select(x => x.ToString())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToArray();
            if (enumValues.Length == 0)
            {
                continue;
            }

            var enumHint = $"Allowed codes: {string.Join(", ", enumValues)}.";
            parameter.Description = string.IsNullOrWhiteSpace(parameter.Description)
                ? enumHint
                : $"{parameter.Description} {enumHint}";
        }
    }
}
