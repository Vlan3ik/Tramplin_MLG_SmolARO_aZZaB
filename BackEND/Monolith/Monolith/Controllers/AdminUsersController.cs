using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Admin;
using Monolith.Models.Common;
using Monolith.Models.Media;
using Monolith.Services.Auth;
using Monolith.Services.Common;
using Monolith.Services.Storage;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "curator,admin")]
[Route("admin/users")]
[Produces("application/json")]
public class AdminUsersController(
    AppDbContext dbContext,
    IPasswordHasher passwordHasher,
    IObjectStorageService storageService) : ControllerBase
{
    private const long MaxImageSizeBytes = 10 * 1024 * 1024;
    private static readonly HashSet<string> AllowedImageTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml"
    ];

    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminUserListItemDto>), StatusCodes.Status200OK)]
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
            query = query.Where(x =>
                x.Email.ToLower().Contains(term) ||
                x.Username.ToLower().Contains(term) ||
                x.Fio.ToLower().Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync(cancellationToken);
        var userIds = rows.Select(x => x.Id).ToArray();
        var roleMap = await BuildRoleMap(userIds, cancellationToken);

        var result = rows.Select(x => ToListDto(x, roleMap.GetValueOrDefault(x.Id, Array.Empty<string>()))).ToList();
        return Ok(new PagedResponse<AdminUserListItemDto>(result, total, safePage, safePageSize));
    }

    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(AdminUserListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminUserListItemDto>> GetById(long id, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return this.ToNotFoundError("admin.users.not_found", "Пользователь не найден.");
        }

        var roles = await dbContext.UserRoles
            .AsNoTracking()
            .Where(x => x.UserId == id)
            .Select(x => x.Role.ToString().ToLowerInvariant())
            .ToArrayAsync(cancellationToken);

        return Ok(ToListDto(user, roles));
    }

    [HttpPost]
    [ProducesResponseType(typeof(AdminUserListItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AdminUserListItemDto>> Create(AdminUserUpsertRequest request, CancellationToken cancellationToken)
    {
        var validationError = await ValidateUpsertRequest(request, null, cancellationToken);
        if (validationError is not null)
        {
            return validationError;
        }

        var roles = request.Roles.Distinct().ToArray();
        var privilegedError = ValidateRoleAssignment(roles);
        if (privilegedError is not null)
        {
            return privilegedError;
        }

        var user = new User
        {
            Email = request.Email.Trim().ToLowerInvariant(),
            Username = UsernameGenerator.Normalize(request.Username) ?? request.Username.Trim(),
            Fio = request.Fio.Trim(),
            PasswordHash = passwordHasher.HashPassword(GeneratePassword()),
            Status = request.Status
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var role in roles)
        {
            dbContext.UserRoles.Add(new UserRole { UserId = user.Id, Role = role, AssignedAt = DateTimeOffset.UtcNow });
        }

        if (roles.Contains(PlatformRole.Seeker))
        {
            await EnsureCandidateProfile(user.Id, user.Fio, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, ToListDto(user, roles.Select(x => x.ToString().ToLowerInvariant()).ToArray()));
    }

    [HttpPut("{id:long}")]
    [ProducesResponseType(typeof(AdminUserListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AdminUserListItemDto>> Update(long id, AdminUserUpsertRequest request, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return this.ToNotFoundError("admin.users.not_found", "Пользователь не найден.");
        }

        var validationError = await ValidateUpsertRequest(request, id, cancellationToken);
        if (validationError is not null)
        {
            return validationError;
        }

        var roles = request.Roles.Distinct().ToArray();
        var privilegedError = ValidateRoleAssignment(roles);
        if (privilegedError is not null)
        {
            return privilegedError;
        }

        user.Email = request.Email.Trim().ToLowerInvariant();
        user.Username = UsernameGenerator.Normalize(request.Username) ?? request.Username.Trim();
        user.Fio = request.Fio.Trim();
        user.Status = request.Status;

        var existingRoles = await dbContext.UserRoles.Where(x => x.UserId == id).ToListAsync(cancellationToken);
        dbContext.UserRoles.RemoveRange(existingRoles);
        foreach (var role in roles)
        {
            dbContext.UserRoles.Add(new UserRole { UserId = id, Role = role, AssignedAt = DateTimeOffset.UtcNow });
        }

        if (roles.Contains(PlatformRole.Seeker))
        {
            await EnsureCandidateProfile(user.Id, user.Fio, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToListDto(user, roles.Select(x => x.ToString().ToLowerInvariant()).ToArray()));
    }

    [HttpPost("{id:long}/reset-password")]
    [ProducesResponseType(typeof(AdminUserResetPasswordResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminUserResetPasswordResponse>> ResetPassword(long id, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return this.ToNotFoundError("admin.users.not_found", "Пользователь не найден.");
        }

        var tempPassword = GeneratePassword();
        user.PasswordHash = passwordHasher.HashPassword(tempPassword);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new AdminUserResetPasswordResponse(tempPassword));
    }

    [HttpPost("{id:long}/avatar")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(UploadMediaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UploadMediaResponse>> UploadAvatar(long id, IFormFile file, CancellationToken cancellationToken)
    {
        var validation = ValidateImage(file);
        if (validation is not null)
        {
            return validation;
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null)
        {
            return this.ToNotFoundError("admin.users.not_found", "Пользователь не найден.");
        }

        await using var stream = file.OpenReadStream();
        var key = await storageService.UploadImageAsync(
            stream,
            file.Length,
            file.ContentType,
            $"user-avatars/{id}",
            ResolveExtension(file),
            cancellationToken);

        var avatarUrl = $"/api/media/{key}";
        user.AvatarUrl = avatarUrl;

        var profile = await dbContext.CandidateProfiles.FirstOrDefaultAsync(x => x.UserId == id, cancellationToken);
        if (profile is not null)
        {
            profile.AvatarUrl = avatarUrl;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new UploadMediaResponse(avatarUrl));
    }

    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
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

    private async Task<Dictionary<long, IReadOnlyCollection<string>>> BuildRoleMap(long[] userIds, CancellationToken cancellationToken)
    {
        return await dbContext.UserRoles
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId))
            .GroupBy(x => x.UserId)
            .ToDictionaryAsync(
                g => g.Key,
                g => (IReadOnlyCollection<string>)g.Select(x => x.Role.ToString().ToLowerInvariant()).ToArray(),
                cancellationToken);
    }

    private AdminUserListItemDto ToListDto(User user, IReadOnlyCollection<string> roles)
    {
        return new AdminUserListItemDto(
            user.Id,
            user.Email,
            user.Username,
            user.Fio,
            user.AvatarUrl,
            user.Status,
            roles,
            user.CreatedAt);
    }

    private async Task<ActionResult?> ValidateUpsertRequest(AdminUserUpsertRequest request, long? userId, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
        {
            return this.ToBadRequestError("admin.users.email_required", "Email обязателен.");
        }

        var username = UsernameGenerator.Normalize(request.Username);
        if (string.IsNullOrWhiteSpace(username) || username.Length < 3)
        {
            return this.ToBadRequestError("admin.users.username_invalid", "Username должен содержать минимум 3 символа.");
        }

        if (string.IsNullOrWhiteSpace(request.Fio?.Trim()))
        {
            return this.ToBadRequestError("admin.users.fio_required", "Поле fio обязательно.");
        }

        if (request.Roles is null || request.Roles.Count == 0)
        {
            return this.ToBadRequestError("admin.users.roles_required", "Нужно назначить хотя бы одну роль.");
        }

        var emailExists = await dbContext.Users.AnyAsync(x => x.Email == email && (!userId.HasValue || x.Id != userId.Value), cancellationToken);
        if (emailExists)
        {
            return this.ToConflictError("admin.users.email_exists", "Пользователь с таким email уже существует.");
        }

        var usernameExists = await dbContext.Users.AnyAsync(x => x.Username == username && (!userId.HasValue || x.Id != userId.Value), cancellationToken);
        if (usernameExists)
        {
            return this.ToConflictError("admin.users.username_exists", "Пользователь с таким username уже существует.");
        }

        return null;
    }

    private ActionResult? ValidateRoleAssignment(IEnumerable<PlatformRole> roles)
    {
        var wantsPrivileged = roles.Any(x => x is PlatformRole.Curator or PlatformRole.Admin);
        if (!wantsPrivileged)
        {
            return null;
        }

        if (User.IsInRole("curator"))
        {
            return null;
        }

        return StatusCode(
            StatusCodes.Status403Forbidden,
            new ErrorResponse("admin.users.roles.forbidden", "Назначение ролей admin/curator доступно только curator."));
    }

    private async Task EnsureCandidateProfile(long userId, string fio, CancellationToken cancellationToken)
    {
        var profile = await dbContext.CandidateProfiles.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (profile is null)
        {
            dbContext.CandidateProfiles.Add(new CandidateProfile { UserId = userId, Fio = fio });
            dbContext.CandidatePrivacySettings.Add(new CandidatePrivacySettings { UserId = userId });
            dbContext.CandidateResumeProfiles.Add(new CandidateResumeProfile { UserId = userId });
            return;
        }

        profile.Fio = fio;
    }

    private static string GeneratePassword()
    {
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghijkmnopqrstuvwxyz";
        const string digits = "23456789";
        const string symbols = "!@#$%&*";
        var random = Random.Shared;
        var chars = new List<char>
        {
            upper[random.Next(upper.Length)],
            lower[random.Next(lower.Length)],
            digits[random.Next(digits.Length)],
            symbols[random.Next(symbols.Length)]
        };

        var all = $"{upper}{lower}{digits}{symbols}";
        while (chars.Count < 14)
        {
            chars.Add(all[random.Next(all.Length)]);
        }

        for (var i = chars.Count - 1; i > 0; i--)
        {
            var j = random.Next(i + 1);
            (chars[i], chars[j]) = (chars[j], chars[i]);
        }

        return new string(chars.ToArray());
    }

    private ActionResult? ValidateImage(IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return this.ToBadRequestError("media.file.empty", "Файл не передан.");
        }

        if (file.Length > MaxImageSizeBytes)
        {
            return this.ToBadRequestError("media.file.too_large", "Размер файла превышает 10 МБ.");
        }

        if (string.IsNullOrWhiteSpace(file.ContentType) || !AllowedImageTypes.Contains(file.ContentType.ToLowerInvariant()))
        {
            return this.ToBadRequestError("media.file.content_type_invalid", "Допустимы только изображения: jpg, png, webp, gif, svg.");
        }

        return null;
    }

    private static string ResolveExtension(IFormFile file)
    {
        var ext = Path.GetExtension(file.FileName)?.Trim('.').ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(ext))
        {
            return ext;
        }

        return file.ContentType.ToLowerInvariant() switch
        {
            "image/jpeg" => "jpg",
            "image/png" => "png",
            "image/webp" => "webp",
            "image/gif" => "gif",
            "image/svg+xml" => "svg",
            _ => "bin"
        };
    }
}
