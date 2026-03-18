using Microsoft.AspNetCore.Mvc;
using Monolith.Models.Common;

namespace Monolith.Services.Common;

public static class ControllerErrorExtensions
{
    public static ActionResult ToBadRequestError(this ControllerBase controller, string code, string message, object? details = null)
        => controller.BadRequest(new ErrorResponse(code, message, details));

    public static ActionResult ToUnauthorizedError(this ControllerBase controller, string code, string message, object? details = null)
        => controller.Unauthorized(new ErrorResponse(code, message, details));

    public static ActionResult ToNotFoundError(this ControllerBase controller, string code, string message, object? details = null)
        => controller.NotFound(new ErrorResponse(code, message, details));

    public static ActionResult ToConflictError(this ControllerBase controller, string code, string message, object? details = null)
        => controller.Conflict(new ErrorResponse(code, message, details));
}
