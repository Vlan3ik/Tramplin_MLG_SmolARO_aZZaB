using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Monolith.Infrastructure.Swagger;

public class UnifiedOperationDocumentationFilter : IOperationFilter
{
    private static readonly IReadOnlyDictionary<string, string> ParameterHints = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["cityId"] = "ID города из GET /catalog/cities.",
        ["locationId"] = "ID локации из GET /catalog/locations.",
        ["groupId"] = "ID группы тегов из GET /catalog/tag-groups.",
        ["tagIds"] = "ID тегов из GET /catalog/tags (можно передавать несколько значений).",
        ["companyId"] = "ID компании из GET /companies или профильных API работодателя/администратора.",
        ["opportunityId"] = "ID возможности из GET /opportunities.",
        ["userId"] = "ID пользователя из API профилей или административных API пользователей.",
        ["chatId"] = "ID чата из GET /chats.",
        ["messageId"] = "ID сообщения из GET /chats/{chatId}/messages."
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

            if (parameter.Schema?.Enum is { Count: > 0 })
            {
                var enumPairs = parameter.Schema.Enum
                    .Select(x => x.ToString())
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .ToArray();

                if (enumPairs.Length > 0)
                {
                    var enumHint = $"Допустимые коды: {string.Join(", ", enumPairs)}.";
                    parameter.Description = string.IsNullOrWhiteSpace(parameter.Description)
                        ? enumHint
                        : $"{parameter.Description} {enumHint}";
                }
            }
        }
    }
}
