using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Monolith.Models.Auth;
using Monolith.Models.Common;
using Monolith.Services.Auth;
using Monolith.Services.Common;
using Monolith.Entities;
using Monolith.Contexts;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Monolith.Controllers;

[ApiController]
[Route("auth")]
[Produces("application/json")]
public class AuthController(
    AppDbContext dbContext,
    IPasswordHasher passwordHasher,
    ITokenService tokenService,
    IRefreshTokenService refreshTokenService,
    IHttpClientFactory httpClientFactory,
    IOptions<VkAuthOptions> vkOptionsAccessor) : ControllerBase
{
    private readonly VkAuthOptions vkOptions = vkOptionsAccessor.Value;

    /// <summary>
    /// Регистрирует нового пользователя платформы.
    /// </summary>
    /// <remarks>
    /// Доступные публичные роли: seeker (1) и employer (2).
    /// Роль curator для публичной регистрации запрещена.
    /// </remarks>
    /// <param name="request">Данные регистрации: email, пароль, отображаемое имя, роль.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>JWT access token, refresh token и профиль авторизованного пользователя.</returns>
    [HttpPost("register")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        if (request.Role is PlatformRole.Curator)
        {
            return this.ToBadRequestError("auth.registration.role_forbidden", "Публичная регистрация роли куратора запрещена.");
        }

        var exists = await dbContext.Users.AnyAsync(x => x.Email == request.Email, cancellationToken);
        if (exists)
        {
            return this.ToConflictError("auth.registration.email_exists", "Пользователь с таким email уже зарегистрирован.");
        }

        var firstName = request.FirstName.Trim();
        var lastName = request.LastName.Trim();
        var fullName = $"{firstName} {lastName}".Trim();

        var user = new User
        {
            Email = request.Email.Trim().ToLowerInvariant(),
            Username = await UsernameGenerator.GenerateUniqueAsync(dbContext, fullName, cancellationToken),
            PasswordHash = passwordHasher.HashPassword(request.Password),
            DisplayName = fullName,
            Status = AccountStatus.Active
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        dbContext.UserRoles.Add(new UserRole
        {
            UserId = user.Id,
            Role = request.Role,
            AssignedAt = DateTimeOffset.UtcNow
        });

        if (request.Role == PlatformRole.Seeker)
        {
            dbContext.CandidateProfiles.Add(new CandidateProfile
            {
                UserId = user.Id,
                LastName = lastName,
                FirstName = firstName
            });
            dbContext.CandidatePrivacySettings.Add(new CandidatePrivacySettings { UserId = user.Id });
            dbContext.CandidateResumeProfiles.Add(new CandidateResumeProfile { UserId = user.Id });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(await BuildAuthResponse(user, [request.Role], cancellationToken));
    }

    /// <summary>
    /// Возвращает справочник платформенных ролей с их id.
    /// </summary>
    /// <returns>Список ролей с id/code/title.</returns>
    [AllowAnonymous]
    [HttpGet("roles")]
    [ProducesResponseType(typeof(IReadOnlyCollection<RoleDictionaryItemDto>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyCollection<RoleDictionaryItemDto>> GetRoles()
    {
        var roles = new List<RoleDictionaryItemDto>
        {
            new((int)PlatformRole.Seeker, "seeker", "Соискатель"),
            new((int)PlatformRole.Employer, "employer", "Работодатель"),
            new((int)PlatformRole.Curator, "curator", "Куратор")
        };
        return Ok(roles);
    }

    [AllowAnonymous]
    [HttpGet("vk/url")]
    [ProducesResponseType(typeof(VkLoginUrlResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public ActionResult<VkLoginUrlResponse> GetVkLoginUrl([FromQuery] string? state)
    {
        if (!IsVkConfigured())
        {
            return this.ToBadRequestError("auth.vk.not_configured", "VK authorization is not configured.");
        }

        var query = new List<string>
        {
            $"client_id={Uri.EscapeDataString(vkOptions.ClientId)}",
            $"redirect_uri={Uri.EscapeDataString(vkOptions.RedirectUri)}",
            "response_type=code",
            "scope=email",
            $"v={Uri.EscapeDataString(vkOptions.ApiVersion)}"
        };

        if (!string.IsNullOrWhiteSpace(state))
        {
            query.Add($"state={Uri.EscapeDataString(state.Trim())}");
        }

        var url = $"https://oauth.vk.com/authorize?{string.Join("&", query)}";
        return Ok(new VkLoginUrlResponse(url));
    }

    [AllowAnonymous]
    [HttpPost("vk/login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AuthResponse>> LoginViaVk(VkLoginRequest request, CancellationToken cancellationToken)
    {
        if (!IsVkConfigured())
        {
            return this.ToBadRequestError("auth.vk.not_configured", "VK authorization is not configured.");
        }

        if (string.IsNullOrWhiteSpace(request.Code))
        {
            return this.ToBadRequestError("auth.vk.code_required", "VK authorization code is required.");
        }

        var vkAuth = await ExchangeVkCodeAsync(request.Code.Trim(), cancellationToken);
        if (vkAuth is null || string.IsNullOrWhiteSpace(vkAuth.AccessToken) || vkAuth.UserId <= 0)
        {
            return this.ToUnauthorizedError("auth.vk.exchange_failed", "Unable to authenticate via VK.");
        }

        var vkProfile = await LoadVkProfileAsync(vkAuth.AccessToken, vkAuth.UserId, cancellationToken);
        if (vkProfile is null)
        {
            return this.ToUnauthorizedError("auth.vk.profile_failed", "Unable to read VK profile.");
        }

        var vkUserId = vkAuth.UserId.ToString();
        var normalizedEmail = NormalizeEmail(vkAuth.Email);
        var user = await dbContext.Users
            .Include(x => x.Roles)
            .FirstOrDefaultAsync(
                x => x.VkUserId == vkUserId
                     || (!string.IsNullOrWhiteSpace(normalizedEmail) && x.Email == normalizedEmail),
                cancellationToken);

        if (user is null)
        {
            var firstName = vkProfile.FirstName?.Trim() ?? string.Empty;
            var lastName = vkProfile.LastName?.Trim() ?? string.Empty;
            var displayName = string.Join(" ", new[] { firstName, lastName }.Where(x => !string.IsNullOrWhiteSpace(x)));
            if (string.IsNullOrWhiteSpace(displayName))
            {
                displayName = $"VK User {vkUserId}";
            }

            user = new User
            {
                VkUserId = vkUserId,
                Email = normalizedEmail ?? $"vk_{vkUserId}@vk.local",
                Username = await UsernameGenerator.GenerateUniqueAsync(dbContext, displayName, cancellationToken),
                PasswordHash = passwordHasher.HashPassword(Guid.NewGuid().ToString("N")),
                DisplayName = displayName,
                AvatarUrl = vkProfile.Photo200,
                Status = AccountStatus.Active
            };

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);

            dbContext.UserRoles.Add(new UserRole
            {
                UserId = user.Id,
                Role = PlatformRole.Seeker,
                AssignedAt = DateTimeOffset.UtcNow
            });
            dbContext.CandidateProfiles.Add(new CandidateProfile
            {
                UserId = user.Id,
                LastName = lastName,
                FirstName = firstName
            });
            dbContext.CandidatePrivacySettings.Add(new CandidatePrivacySettings { UserId = user.Id });
            dbContext.CandidateResumeProfiles.Add(new CandidateResumeProfile { UserId = user.Id });

            await dbContext.SaveChangesAsync(cancellationToken);
        }
        else
        {
            if (user.Status != AccountStatus.Active)
            {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(user.VkUserId))
            {
                user.VkUserId = vkUserId;
            }

            if (!string.IsNullOrWhiteSpace(normalizedEmail))
            {
                user.Email = normalizedEmail;
            }

            if (!string.IsNullOrWhiteSpace(vkProfile.Photo200))
            {
                user.AvatarUrl = vkProfile.Photo200;
            }
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        var roles = user.Roles.Select(x => x.Role).Distinct().ToArray();
        if (roles.Length == 0)
        {
            roles = await dbContext.UserRoles
                .Where(x => x.UserId == user.Id)
                .Select(x => x.Role)
                .Distinct()
                .ToArrayAsync(cancellationToken);
        }
        return Ok(await BuildAuthResponse(user, roles, cancellationToken));
    }

    /// <summary>
    /// Выполняет вход пользователя по email и паролю.
    /// </summary>
    /// <param name="request">Учетные данные пользователя.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>JWT access token, refresh token и данные пользователя.</returns>
    [HttpPost("login")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users
            .Include(x => x.Roles)
            .FirstOrDefaultAsync(x => x.Email == request.Email.Trim().ToLowerInvariant(), cancellationToken);

        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return this.ToUnauthorizedError("auth.login.invalid_credentials", "Неверный логин или пароль.");
        }

        if (user.Status != AccountStatus.Active)
        {
            return Forbid();
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        var roles = user.Roles.Select(x => x.Role).ToArray();
        return Ok(await BuildAuthResponse(user, roles, cancellationToken));
    }

    /// <summary>
    /// Обновляет пару access/refresh токенов по действующему refresh токену.
    /// </summary>
    /// <param name="request">Refresh токен пользователя.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Новая пара токенов.</returns>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request, CancellationToken cancellationToken)
    {
        var result = await refreshTokenService.RotateAsync(
            request.RefreshToken,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString(),
            cancellationToken);

        if (result is null)
        {
            return this.ToUnauthorizedError("auth.refresh.invalid_token", "Недействительный refresh токен.");
        }

        var user = result.Value.User;
        var roles = await dbContext.UserRoles
            .Where(x => x.UserId == user.Id)
            .Select(x => x.Role)
            .ToArrayAsync(cancellationToken);

        var access = tokenService.GenerateAccessToken(user, roles);
        return Ok(new AuthResponse(
            access.AccessToken,
            access.ExpiresAt,
            result.Value.NewToken.RefreshToken,
            result.Value.NewToken.ExpiresAt,
            new AuthUserDto(user.Id, user.Email, user.Username, user.AvatarUrl, roles.Select(x => x.ToString().ToLowerInvariant()).ToArray())));
    }

    /// <summary>
    /// Инвалидирует refresh токен текущей сессии.
    /// </summary>
    /// <param name="request">Refresh токен для отзыва.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    [Authorize]
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Logout(LogoutRequest request, CancellationToken cancellationToken)
    {
        await refreshTokenService.RevokeAsync(request.RefreshToken, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Изменяет пароль текущего авторизованного пользователя.
    /// </summary>
    /// <param name="request">Текущий пароль и новый пароль.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    [Authorize]
    [HttpPost("change-password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return this.ToUnauthorizedError("auth.user.unauthorized", "Пользователь не авторизован.");
        }

        if (!passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return this.ToBadRequestError("auth.password.invalid_current", "Текущий пароль указан неверно.");
        }

        user.PasswordHash = passwordHasher.HashPassword(request.NewPassword);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private bool IsVkConfigured()
    {
        return !string.IsNullOrWhiteSpace(vkOptions.ClientId)
               && !string.IsNullOrWhiteSpace(vkOptions.ClientSecret)
               && !string.IsNullOrWhiteSpace(vkOptions.RedirectUri);
    }

    private async Task<VkTokenResponse?> ExchangeVkCodeAsync(string code, CancellationToken cancellationToken)
    {
        var url =
            $"https://oauth.vk.com/access_token?client_id={Uri.EscapeDataString(vkOptions.ClientId)}" +
            $"&client_secret={Uri.EscapeDataString(vkOptions.ClientSecret)}" +
            $"&redirect_uri={Uri.EscapeDataString(vkOptions.RedirectUri)}" +
            $"&code={Uri.EscapeDataString(code)}";

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        using var response = await httpClientFactory.CreateClient().SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        var payload = await response.Content.ReadFromJsonAsync<VkTokenResponse>(cancellationToken);
        return payload;
    }

    private async Task<VkUserProfile?> LoadVkProfileAsync(string accessToken, long vkUserId, CancellationToken cancellationToken)
    {
        var url =
            $"https://api.vk.com/method/users.get?user_ids={vkUserId}" +
            "&fields=photo_200" +
            $"&access_token={Uri.EscapeDataString(accessToken)}" +
            $"&v={Uri.EscapeDataString(vkOptions.ApiVersion)}";

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        using var response = await httpClientFactory.CreateClient().SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        var payload = await response.Content.ReadFromJsonAsync<VkUserResponse>(cancellationToken);
        return payload?.Response?.FirstOrDefault();
    }

    private static string? NormalizeEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        return email.Trim().ToLowerInvariant();
    }

    private async Task<AuthResponse> BuildAuthResponse(User user, IReadOnlyCollection<PlatformRole> roles, CancellationToken cancellationToken)
    {
        var access = tokenService.GenerateAccessToken(user, roles);
        var refresh = await refreshTokenService.CreateAsync(
            user,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString(),
            cancellationToken);

        return new AuthResponse(
            access.AccessToken,
            access.ExpiresAt,
            refresh.RefreshToken,
            refresh.ExpiresAt,
            new AuthUserDto(user.Id, user.Email, user.Username, user.AvatarUrl, roles.Select(x => x.ToString().ToLowerInvariant()).ToArray()));
    }

    private sealed record VkTokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("user_id")] long UserId,
        [property: JsonPropertyName("email")] string? Email);

    private sealed record VkUserResponse([property: JsonPropertyName("response")] List<VkUserProfile>? Response);

    private sealed record VkUserProfile(
        [property: JsonPropertyName("id")] long Id,
        [property: JsonPropertyName("first_name")] string? FirstName,
        [property: JsonPropertyName("last_name")] string? LastName,
        [property: JsonPropertyName("photo_200")] string? Photo200);
}
