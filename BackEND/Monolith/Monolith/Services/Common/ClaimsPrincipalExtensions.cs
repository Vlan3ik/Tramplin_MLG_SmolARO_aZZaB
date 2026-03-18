using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

namespace Monolith.Services.Common;

public static class ClaimsPrincipalExtensions
{
    public static long GetUserId(this ClaimsPrincipal user)
    {
        var sub = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return long.TryParse(sub, out var id)
            ? id
            : throw new UnauthorizedAccessException("Invalid user id in token.");
    }
}
