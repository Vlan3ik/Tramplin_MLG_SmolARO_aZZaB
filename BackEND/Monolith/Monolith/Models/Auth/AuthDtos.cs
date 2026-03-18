using Monolith.Entities;

namespace Monolith.Models.Auth;

public record RegisterRequest(string Email, string Password, string DisplayName, PlatformRole Role);

public record LoginRequest(string Email, string Password);

public record RefreshRequest(string RefreshToken);

public record LogoutRequest(string RefreshToken);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record AuthResponse(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt,
    AuthUserDto User
);

public record AuthUserDto(long Id, string Email, string DisplayName, string? AvatarUrl, IReadOnlyCollection<string> Roles);
