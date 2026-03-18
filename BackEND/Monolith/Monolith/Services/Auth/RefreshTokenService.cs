using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Monolith.Services.Auth;
using Monolith.Entities;
using Monolith.Contexts;

namespace Monolith.Services.Auth;

public class RefreshTokenService(AppDbContext dbContext, IOptions<JwtOptions> jwtOptions) : IRefreshTokenService
{
    private readonly JwtOptions _jwtOptions = jwtOptions.Value;

    public async Task<RefreshTokenResult> CreateAsync(
        User user,
        string? ipAddress,
        string? userAgent,
        CancellationToken cancellationToken)
    {
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.AddDays(_jwtOptions.RefreshTokenDays);

        var refreshToken = new RefreshToken
        {
            UserId = user.Id,
            TokenHash = ComputeHash(rawToken),
            ExpiresAt = expiresAt,
            CreatedAt = now,
            CreatedByIp = ipAddress,
            UserAgent = userAgent
        };

        dbContext.RefreshTokens.Add(refreshToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new RefreshTokenResult(rawToken, expiresAt);
    }

    public async Task<(User User, RefreshTokenResult NewToken)?> RotateAsync(
        string refreshToken,
        string? ipAddress,
        string? userAgent,
        CancellationToken cancellationToken)
    {
        var tokenHash = ComputeHash(refreshToken);
        var token = await dbContext.RefreshTokens
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);

        if (token is null || token.RevokedAt is not null || token.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            return null;
        }

        token.RevokedAt = DateTimeOffset.UtcNow;
        var newToken = await CreateAsync(token.User, ipAddress, userAgent, cancellationToken);
        var insertedToken = await dbContext.RefreshTokens
            .OrderByDescending(x => x.Id)
            .FirstAsync(x => x.UserId == token.UserId, cancellationToken);
        token.ReplacedByTokenId = insertedToken.Id;

        await dbContext.SaveChangesAsync(cancellationToken);

        return (token.User, newToken);
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var tokenHash = ComputeHash(refreshToken);
        var token = await dbContext.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);
        if (token is null || token.RevokedAt is not null)
        {
            return;
        }

        token.RevokedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string ComputeHash(string raw)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes);
    }
}
