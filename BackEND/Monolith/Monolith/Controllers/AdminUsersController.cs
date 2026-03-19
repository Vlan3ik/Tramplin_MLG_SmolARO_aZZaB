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
/// РђРґРјРёРЅРёСЃС‚СЂР°С‚РёРІРЅС‹Рµ РѕРїРµСЂР°С†РёРё РЅР°Рґ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏРјРё РїР»Р°С‚С„РѕСЂРјС‹.
/// Р”РѕСЃС‚СѓРї С‚РѕР»СЊРєРѕ РґР»СЏ СЂРѕР»Рё curator.
/// </summary>
[ApiController]
[Authorize(Roles = "curator")]
[Route("admin/users")]
[Produces("application/json")]
public class AdminUsersController(AppDbContext dbContext, IPasswordHasher passwordHasher) : ControllerBase
{
    /// <summary>
    /// Р’РѕР·РІСЂР°С‰Р°РµС‚ СЃРїРёСЃРѕРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ СЃ РїР°РіРёРЅР°С†РёРµР№ Рё РїРѕРёСЃРєРѕРј РїРѕ email/РёРјРµРЅРё.
    /// </summary>
    /// <param name="page">РќРѕРјРµСЂ СЃС‚СЂР°РЅРёС†С‹ (РЅР°С‡РёРЅР°СЏ СЃ 1).</param>
    /// <param name="pageSize">Р Р°Р·РјРµСЂ СЃС‚СЂР°РЅРёС†С‹ (РјР°РєСЃРёРјСѓРј 100).</param>
    /// <param name="search">РџРѕРёСЃРєРѕРІР°СЏ СЃС‚СЂРѕРєР° РїРѕ email РёР»Рё username.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё.</param>
    /// <returns>РџР°РіРёРЅРёСЂРѕРІР°РЅРЅС‹Р№ СЃРїРёСЃРѕРє РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ СЃ СЂРѕР»СЏРјРё.</returns>
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
            query = query.Where(x => x.Email.ToLower().Contains(term) || x.Username.ToLower().Contains(term));
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
            x.Username,
            x.Status,
            roleMap.GetValueOrDefault(x.Id, Array.Empty<string>()),
            x.CreatedAt)).ToList();
        return Ok(new PagedResponse<AdminUserListItemDto>(result, total, safePage, safePageSize));
    }

    /// <summary>
    /// РЎРѕР·РґР°РµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РЅР°Р·РЅР°С‡Р°РµС‚ РµРјСѓ РЅР°Р±РѕСЂ РїР»Р°С‚С„РѕСЂРјРµРЅРЅС‹С… СЂРѕР»РµР№.
    /// </summary>
    /// <remarks>
    /// РџР°СЂРѕР»СЊ РіРµРЅРµСЂРёСЂСѓРµС‚СЃСЏ СЃРёСЃС‚РµРјРѕР№ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё (СЃР»СѓР¶РµР±РЅС‹Р№ Р°РєРєР°СѓРЅС‚).
    /// Р”СѓР±Р»РёРєР°С‚С‹ СЂРѕР»РµР№ РІ Р·Р°РїСЂРѕСЃРµ РёРіРЅРѕСЂРёСЂСѓСЋС‚СЃСЏ.
    /// </remarks>
    /// <param name="request">Р”Р°РЅРЅС‹Рµ СЃРѕР·РґР°РІР°РµРјРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё СЃРїРёСЃРѕРє СЂРѕР»РµР№.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё.</param>
    /// <returns>РЎРѕР·РґР°РЅРЅС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ.</returns>
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
            return this.ToConflictError("admin.users.email_exists", "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј email СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚.");
        }

        var firstName = request.FirstName.Trim();
        var lastName = request.LastName.Trim();
        var fullName = $"{firstName} {lastName}".Trim();

        var user = new User
        {
            Email = normalizedEmail,
            Username = await UsernameGenerator.GenerateUniqueAsync(dbContext, fullName, cancellationToken),
            DisplayName = fullName,
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

        var dto = new AdminUserListItemDto(user.Id, user.Email, user.Username, user.Status, uniqueRoles.Select(x => x.ToString().ToLowerInvariant()).ToArray(), user.CreatedAt);
        return CreatedAtAction(nameof(GetList), new { id = user.Id }, dto);
    }

    /// <summary>
    /// РћР±РЅРѕРІР»СЏРµС‚ РґР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РїРѕР»РЅРѕСЃС‚СЊСЋ Р·Р°РјРµРЅСЏРµС‚ РЅР°Р±РѕСЂ РµРіРѕ СЂРѕР»РµР№.
    /// </summary>
    /// <remarks>
    /// РўРµРєСѓС‰РёРµ СЂРѕР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СѓРґР°Р»СЏСЋС‚СЃСЏ Рё СЃРѕР·РґР°СЋС‚СЃСЏ Р·Р°РЅРѕРІРѕ РёР· Р·Р°РїСЂРѕСЃР°.
    /// </remarks>
    /// <param name="id">РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.</param>
    /// <param name="request">РќРѕРІС‹Рµ Р·РЅР°С‡РµРЅРёСЏ РїРѕР»РµР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё СЂРѕР»РµР№.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё.</param>
    /// <returns>РћР±РЅРѕРІР»РµРЅРЅС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ.</returns>
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
            return this.ToNotFoundError("admin.users.not_found", "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ.");
        }

        user.Email = request.Email.Trim().ToLowerInvariant();
        user.DisplayName = $"{request.FirstName.Trim()} {request.LastName.Trim()}".Trim();
        user.Status = request.Status;

        var existingRoles = await dbContext.UserRoles.Where(x => x.UserId == id).ToListAsync(cancellationToken);
        dbContext.UserRoles.RemoveRange(existingRoles);
        foreach (var role in request.Roles.Distinct())
        {
            dbContext.UserRoles.Add(new UserRole { UserId = id, Role = role, AssignedAt = DateTimeOffset.UtcNow });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminUserListItemDto(user.Id, user.Email, user.Username, user.Status, request.Roles.Select(x => x.ToString().ToLowerInvariant()).ToArray(), user.CreatedAt);
        return Ok(dto);
    }

    /// <summary>
    /// РЈРґР°Р»СЏРµС‚ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
    /// </summary>
    /// <remarks>
    /// РЈРґР°Р»РµРЅРёРµ С„РёР·РёС‡РµСЃРєРѕРµ (hard delete). РЎРІСЏР·Р°РЅРЅС‹Рµ РґР°РЅРЅС‹Рµ СѓРґР°Р»СЏСЋС‚СЃСЏ РєР°СЃРєР°РґРЅРѕ РІ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёРё СЃ FK.
    /// </remarks>
    /// <param name="id">РРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.</param>
    /// <param name="cancellationToken">РўРѕРєРµРЅ РѕС‚РјРµРЅС‹ РѕРїРµСЂР°С†РёРё.</param>
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
            return this.ToNotFoundError("admin.users.not_found", "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ.");
        }

        dbContext.Users.Remove(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
