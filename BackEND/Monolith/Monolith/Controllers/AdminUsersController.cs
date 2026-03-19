using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Admin;
using Monolith.Models.Common;
using Monolith.Services.Auth;
using Monolith.Services.Common;

namespace Monolith.Controllers;

/// <summary>
/// Административные операции над пользователями платформы.
/// Доступ только для роли curator.
/// </summary>
[ApiController]
[Authorize(Roles = "curator")]
[Route("admin/users")]
[Produces("application/json")]
public class AdminUsersController(AppDbContext dbContext, IPasswordHasher passwordHasher) : ControllerBase
{
    /// <summary>
    /// Возвращает список пользователей с пагинацией и поиском по email/имени.
    /// </summary>
    /// <param name="page">Номер страницы (начиная с 1).</param>
    /// <param name="pageSize">Размер страницы (максимум 100).</param>
    /// <param name="search">Поисковая строка по email или displayName.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Пагинированный список пользователей с ролями.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminUserListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResponse<AdminUserListItemDto>>> GetList(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = page <= 0 ? 1 : page;
        var safePageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);
        var query = dbContext.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x => x.Email.ToLower().Contains(term) || x.DisplayName.ToLower().Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query.OrderByDescending(x => x.CreatedAt).Skip((safePage - 1) * safePageSize).Take(safePageSize).ToListAsync(cancellationToken);
        var userIds = rows.Select(x => x.Id).ToArray();
        var roleMap = await dbContext.UserRoles
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId))
            .GroupBy(x => x.UserId)
            .ToDictionaryAsync(
                g => g.Key,
                g => (IReadOnlyCollection<string>)g.Select(x => x.Role.ToString().ToLowerInvariant()).ToArray(),
                cancellationToken);

        var result = rows.Select(x => new AdminUserListItemDto(
            x.Id,
            x.Email,
            x.DisplayName,
            x.Status,
            roleMap.GetValueOrDefault(x.Id, Array.Empty<string>()),
            x.CreatedAt)).ToList();
        return Ok(new PagedResponse<AdminUserListItemDto>(result, total, safePage, safePageSize));
    }

    /// <summary>
    /// Создает пользователя и назначает ему набор платформенных ролей.
    /// </summary>
    /// <remarks>
    /// Пароль генерируется системой автоматически (служебный аккаунт).
    /// Дубликаты ролей в запросе игнорируются.
    /// </remarks>
    /// <param name="request">Данные создаваемого пользователя и список ролей.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Созданный пользователь.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(AdminUserListItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminUserListItemDto>> Create(AdminUserUpsertRequest request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await dbContext.Users.AnyAsync(x => x.Email == normalizedEmail, cancellationToken))
        {
            return this.ToConflictError("admin.users.email_exists", "Пользователь с таким email уже существует.");
        }

        var user = new User
        {
            Email = normalizedEmail,
            Username = await UsernameGenerator.GenerateUniqueAsync(dbContext, request.DisplayName, cancellationToken),
            DisplayName = request.DisplayName.Trim(),
            PasswordHash = passwordHasher.HashPassword(Guid.NewGuid().ToString("N")),
            Status = request.Status
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        var uniqueRoles = request.Roles.Distinct().ToArray();
        foreach (var role in uniqueRoles)
        {
            dbContext.UserRoles.Add(new UserRole { UserId = user.Id, Role = role, AssignedAt = DateTimeOffset.UtcNow });
        }
        await dbContext.SaveChangesAsync(cancellationToken);

        var dto = new AdminUserListItemDto(user.Id, user.Email, user.DisplayName, user.Status, uniqueRoles.Select(x => x.ToString().ToLowerInvariant()).ToArray(), user.CreatedAt);
        return CreatedAtAction(nameof(GetList), new { id = user.Id }, dto);
    }

    /// <summary>
    /// Обновляет данные пользователя и полностью заменяет набор его ролей.
    /// </summary>
    /// <remarks>
    /// Текущие роли пользователя удаляются и создаются заново из запроса.
    /// </remarks>
    /// <param name="id">Идентификатор пользователя.</param>
    /// <param name="request">Новые значения полей пользователя и ролей.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Обновленный пользователь.</returns>
    [HttpPut("{id:long}")]
    [ProducesResponseType(typeof(AdminUserListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminUserListItemDto>> Update(long id, AdminUserUpsertRequest request, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return this.ToNotFoundError("admin.users.not_found", "Пользователь не найден.");
        }

        user.Email = request.Email.Trim().ToLowerInvariant();
        user.DisplayName = request.DisplayName.Trim();
        user.Status = request.Status;

        var existingRoles = await dbContext.UserRoles.Where(x => x.UserId == id).ToListAsync(cancellationToken);
        dbContext.UserRoles.RemoveRange(existingRoles);
        foreach (var role in request.Roles.Distinct())
        {
            dbContext.UserRoles.Add(new UserRole { UserId = id, Role = role, AssignedAt = DateTimeOffset.UtcNow });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminUserListItemDto(user.Id, user.Email, user.DisplayName, user.Status, request.Roles.Select(x => x.ToString().ToLowerInvariant()).ToArray(), user.CreatedAt);
        return Ok(dto);
    }

    /// <summary>
    /// Удаляет пользователя.
    /// </summary>
    /// <remarks>
    /// Удаление физическое (hard delete). Связанные данные удаляются каскадно в соответствии с FK.
    /// </remarks>
    /// <param name="id">Идентификатор пользователя.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return this.ToNotFoundError("admin.users.not_found", "Пользователь не найден.");
        }

        dbContext.Users.Remove(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
