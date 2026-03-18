namespace Monolith.Models.Common;

public record PagedResponse<T>(IReadOnlyCollection<T> Items, int TotalCount, int Page, int PageSize);
