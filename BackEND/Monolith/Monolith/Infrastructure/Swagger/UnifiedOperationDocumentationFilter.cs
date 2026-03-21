using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Monolith.Infrastructure.Swagger;

public class UnifiedOperationDocumentationFilter : IOperationFilter
{
    private static readonly IReadOnlyDictionary<string, string> ParameterHints = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["cityId"] = "Идентификатор города из GET /catalog/cities.",
        ["locationId"] = "Идентификатор локации из GET /catalog/locations.",
        ["groupId"] = "Идентификатор группы тегов из GET /catalog/tag-groups.",
        ["tagIds"] = "Идентификаторы тегов из GET /catalog/tags.",
        ["companyId"] = "Идентификатор компании из GET /companies.",
        ["opportunityId"] = "Идентификатор возможности из GET /opportunities.",
        ["vacancyId"] = "Идентификатор вакансии из GET /vacancies.",
        ["userId"] = "Идентификатор пользователя.",
        ["newOwnerUserId"] = "Идентификатор пользователя для передачи владения.",
        ["candidateUserId"] = "Идентификатор кандидата.",
        ["linkId"] = "Идентификатор ссылки компании.",
        ["chatId"] = "Идентификатор чата из GET /chats.",
        ["messageId"] = "Идентификатор сообщения из GET /chats/{chatId}/messages.",
        ["q"] = "Текст поискового запроса.",
        ["types"] = "Повторяющийся query-параметр: types=vacancy&types=opportunity.",
        ["limit"] = "Максимальный размер ответа (1..20)."
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

            var enumHint = $"Допустимые коды: {string.Join(", ", enumValues)}.";
            parameter.Description = string.IsNullOrWhiteSpace(parameter.Description)
                ? enumHint
                : $"{parameter.Description} {enumHint}";
        }
    }
}
