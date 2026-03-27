using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Monolith.Infrastructure.Swagger;

public class UnifiedOperationDocumentationFilter : IOperationFilter
{
    private static readonly IReadOnlyDictionary<string, (string Summary, string Description)> OperationDocs =
        new Dictionary<string, (string Summary, string Description)>(StringComparer.OrdinalIgnoreCase)
        {
            ["GET applications/me"] = ("Получить мои отклики", "Возвращает список откликов текущего пользователя с привязкой к вакансии или возможности."),
            ["GET resumes"] = ("Получить список резюме", "Возвращает опубликованные резюме с учётом фильтров, пагинации и ограничений приватности."),
            ["GET resumes/{id}"] = ("Получить резюме по id", "Возвращает полную карточку резюме пользователя, если оно доступно текущему пользователю."),
            ["DELETE admin/opportunities/{id}"] = ("Удалить возможность", "Удаляет возможность из административного раздела по идентификатору."),
            ["DELETE admin/vacancies/{id}"] = ("Удалить вакансию", "Удаляет вакансию из административного раздела по идентификатору."),
            ["GET subscriptions/me/followers"] = ("Получить моих подписчиков", "Возвращает пользователей, которые подписаны на текущий аккаунт."),
            ["GET subscriptions/me/following"] = ("Получить мои подписки", "Возвращает пользователей, на которых подписан текущий аккаунт."),
            ["GET subscriptions/me/stats"] = ("Получить статистику подписок", "Возвращает количество подписок и подписчиков текущего пользователя."),
            ["POST subscriptions/{targetUserId}"] = ("Подписаться на пользователя", "Создаёт подписку текущего пользователя на выбранный аккаунт."),
            ["DELETE subscriptions/{targetUserId}"] = ("Отписаться от пользователя", "Удаляет подписку текущего пользователя на выбранный аккаунт.")
        };

    private static readonly IReadOnlyDictionary<string, string> ParameterHints = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["id"] = "Числовой идентификатор сущности из адреса запроса.",
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
        ["page"] = "Номер страницы, начиная с 1.",
        ["pageSize"] = "Размер страницы ответа.",
        ["search"] = "Подстрока для полнотекстового поиска.",
        ["q"] = "Текст поискового запроса.",
        ["openToWork"] = "Фильтр по статусу открытости к предложениям.",
        ["salaryFrom"] = "Минимальная граница зарплаты или бюджета.",
        ["salaryTo"] = "Максимальная граница зарплаты или бюджета.",
        ["onlyFollowed"] = "Если true, возвращаются только пользователи, на которых оформлена подписка.",
        ["targetUserId"] = "Идентификатор пользователя, на которого оформляется или отменяется подписка.",
        ["types"] = "Повторяющийся query-параметр: types=vacancy&types=opportunity.",
        ["limit"] = "Максимальный размер ответа (1..20)."
    };

    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var operationKey = BuildOperationKey(context);
        if (OperationDocs.TryGetValue(operationKey, out var documentation))
        {
            if (string.IsNullOrWhiteSpace(operation.Summary))
            {
                operation.Summary = documentation.Summary;
            }

            if (string.IsNullOrWhiteSpace(operation.Description))
            {
                operation.Description = documentation.Description;
            }
        }

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

    private static string BuildOperationKey(OperationFilterContext context)
    {
        var method = context.ApiDescription.HttpMethod?.ToUpperInvariant() ?? "GET";
        var path = context.ApiDescription.RelativePath?.Trim('/') ?? string.Empty;
        return $"{method} {path}";
    }
}
