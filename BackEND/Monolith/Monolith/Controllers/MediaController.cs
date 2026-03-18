using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Models.Common;
using Monolith.Models.Media;
using Monolith.Services.Common;
using Monolith.Services.Storage;

namespace Monolith.Controllers;

[ApiController]
[Route("media")]
[Produces("application/json")]
public class MediaController(AppDbContext dbContext, IObjectStorageService storageService) : ControllerBase
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

    /// <summary>
    /// Загружает аватар текущего пользователя в S3-совместимое хранилище.
    /// </summary>
    /// <param name="file">Файл изображения (multipart/form-data).</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>URL изображения, доступный через API.</returns>
    [Authorize]
    [HttpPost("me/avatar")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(UploadMediaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UploadMediaResponse>> UploadMyAvatar(IFormFile file, CancellationToken cancellationToken)
    {
        var validation = ValidateImage(file);
        if (validation is not null)
        {
            return validation;
        }

        var userId = User.GetUserId();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return this.ToNotFoundError("media.user.not_found", "Пользователь не найден.");
        }

        await using var stream = file.OpenReadStream();
        var key = await storageService.UploadImageAsync(
            stream,
            file.Length,
            file.ContentType,
            $"user-avatars/{userId}",
            ResolveExtension(file),
            cancellationToken);

        var url = BuildApiMediaUrl(key);
        user.AvatarUrl = url;

        var profile = await dbContext.CandidateProfiles.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (profile is not null)
        {
            profile.AvatarUrl = url;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new UploadMediaResponse(url));
    }

    /// <summary>
    /// Загружает логотип компании в S3-совместимое хранилище.
    /// </summary>
    /// <param name="companyId">Идентификатор компании.</param>
    /// <param name="file">Файл изображения (multipart/form-data).</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>URL изображения, доступный через API.</returns>
    [Authorize]
    [HttpPost("companies/{companyId:long}/logo")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(UploadMediaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UploadMediaResponse>> UploadCompanyLogo(long companyId, IFormFile file, CancellationToken cancellationToken)
    {
        var validation = ValidateImage(file);
        if (validation is not null)
        {
            return validation;
        }

        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == companyId, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("media.company.not_found", "Компания не найдена.");
        }

        await using var stream = file.OpenReadStream();
        var key = await storageService.UploadImageAsync(
            stream,
            file.Length,
            file.ContentType,
            $"company-logos/{companyId}",
            ResolveExtension(file),
            cancellationToken);

        var url = BuildApiMediaUrl(key);
        company.LogoUrl = url;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new UploadMediaResponse(url));
    }

    /// <summary>
    /// Возвращает изображение из S3-совместимого хранилища через API.
    /// </summary>
    /// <param name="objectKey">Ключ объекта в хранилище.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Двоичное содержимое изображения.</returns>
    [AllowAnonymous]
    [HttpGet("{**objectKey}")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetObject(string objectKey, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(objectKey))
        {
            return this.ToNotFoundError("media.object.not_found", "Изображение не найдено.");
        }

        var stored = await storageService.GetObjectAsync(objectKey, cancellationToken);
        if (stored is null)
        {
            return this.ToNotFoundError("media.object.not_found", "Изображение не найдено.");
        }

        return File(stored.Data, stored.ContentType);
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

    private static string BuildApiMediaUrl(string objectKey)
    {
        return $"/api/media/{objectKey}";
    }
}
