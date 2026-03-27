using Monolith.Entities;

namespace Monolith.Models.Auth;

public record RegisterRequest(string Email, string Password, string Fio, PlatformRole Role);

public record LoginRequest(string Email, string Password);

public record VkLoginUrlResponse(string Url);

public record VkLoginRequest(string Code);

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

public record AuthUserDto(long Id, string Email, string Username, string? AvatarUrl, IReadOnlyCollection<string> Roles);

/// <summary>
/// Элемент справочника ролей платформы.
/// </summary>
/// <param name="Id">Числовой идентификатор роли (role_id claim).</param>
/// <param name="Code">Строковый код роли в JWT claim role.</param>
/// <param name="Title">Человекочитаемое название роли.</param>
public record RoleDictionaryItemDto(int Id, string Code, string Title);
