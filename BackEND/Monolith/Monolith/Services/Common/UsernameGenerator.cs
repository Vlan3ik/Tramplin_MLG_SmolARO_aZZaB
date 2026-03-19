using System.Text;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;

namespace Monolith.Services.Common;

public static class UsernameGenerator
{
    public static async Task<string> GenerateUniqueAsync(AppDbContext dbContext, string source, CancellationToken cancellationToken)
    {
        var baseUsername = Normalize(source);
        if (string.IsNullOrWhiteSpace(baseUsername))
        {
            baseUsername = "user";
        }

        var candidate = baseUsername;
        var suffix = 1;
        while (await dbContext.Users.AnyAsync(x => x.Username == candidate, cancellationToken))
        {
            suffix++;
            candidate = $"{baseUsername}-{suffix}";
        }

        return candidate;
    }

    public static string Normalize(string source)
    {
        var text = (source ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        var sb = new StringBuilder(text.Length);
        var dash = false;
        foreach (var ch in text)
        {
            if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '_')
            {
                sb.Append(ch);
                dash = false;
                continue;
            }

            if (!dash)
            {
                sb.Append('-');
                dash = true;
            }
        }

        var normalized = sb.ToString().Trim('-');
        if (normalized.Length > 50)
        {
            normalized = normalized[..50].Trim('-');
        }

        return normalized;
    }
}
