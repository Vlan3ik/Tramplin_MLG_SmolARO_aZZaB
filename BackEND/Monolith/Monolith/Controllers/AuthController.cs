using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Models.Auth;
using Monolith.Models.Common;
using Monolith.Services.Auth;
using Monolith.Services.Common;
using Monolith.Entities;
using Monolith.Contexts;

namespace Monolith.Controllers;

[ApiController]
[Route("auth")]
[Produces("application/json")]
public class AuthController(
    AppDbContext dbContext,
    IPasswordHasher passwordHasher,
    ITokenService tokenService,
    IRefreshTokenService refreshTokenService) : ControllerBase
{
    /// <summary>
    /// Регистрирует нового пользователя платформы.
    /// </summary>
    /// <remarks>
    /// Доступные публичные роли: seeker и employer.
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

        var user = new User
        {
            Email = request.Email.Trim().ToLowerInvariant(),
            PasswordHash = passwordHasher.HashPassword(request.Password),
            DisplayName = request.DisplayName.Trim(),
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
                LastName = "LastName",
                FirstName = "FirstName"
            });
            dbContext.CandidatePrivacySettings.Add(new CandidatePrivacySettings { UserId = user.Id });
            dbContext.CandidateResumeProfiles.Add(new CandidateResumeProfile { UserId = user.Id });
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(await BuildAuthResponse(user, [request.Role], cancellationToken));
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
            new AuthUserDto(user.Id, user.Email, user.DisplayName, user.AvatarUrl, roles.Select(x => x.ToString().ToLowerInvariant()).ToArray())));
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
            new AuthUserDto(user.Id, user.Email, user.DisplayName, user.AvatarUrl, roles.Select(x => x.ToString().ToLowerInvariant()).ToArray()));
    }
}
