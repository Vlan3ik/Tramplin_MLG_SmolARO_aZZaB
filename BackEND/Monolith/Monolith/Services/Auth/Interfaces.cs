using Monolith.Entities;

namespace Monolith.Services.Auth;

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool Verify(string password, string passwordHash);
}

public interface ITokenService
{
    AccessTokenResult GenerateAccessToken(User user, IReadOnlyCollection<PlatformRole> roles);
}

public interface IRefreshTokenService
{
    Task<RefreshTokenResult> CreateAsync(User user, string? ipAddress, string? userAgent, CancellationToken cancellationToken);
    Task<(User User, RefreshTokenResult NewToken)?> RotateAsync(string refreshToken, string? ipAddress, string? userAgent, CancellationToken cancellationToken);
    Task RevokeAsync(string refreshToken, CancellationToken cancellationToken);
}
