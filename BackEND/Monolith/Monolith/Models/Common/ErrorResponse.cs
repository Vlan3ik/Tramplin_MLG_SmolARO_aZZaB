namespace Monolith.Models.Common;

public record ErrorResponse(string Code, string Message, object? Details = null);
