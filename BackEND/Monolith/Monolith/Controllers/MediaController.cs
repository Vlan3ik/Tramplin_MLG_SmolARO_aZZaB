using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Media;
using Monolith.Models.Portfolio;
using Monolith.Services.Common;
using Monolith.Services.Storage;

namespace Monolith.Controllers;

[ApiController]
[Route("media")]
[Produces("application/json")]
public class MediaController(AppDbContext dbContext, IObjectStorageService storageService) : ControllerBase
{
    private const long MaxImageSizeBytes = 10 * 1024 * 1024;
    private const long MaxVideoSizeBytes = 200 * 1024 * 1024;
    private static readonly HashSet<string> AllowedImageTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml"
    ];
    private static readonly HashSet<string> AllowedVideoTypes =
    [
        "video/mp4",
        "video/webm",
        "video/quicktime"
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
    /// Загружает баннер профиля текущего пользователя в S3-совместимое хранилище.
    /// </summary>
    /// <param name="file">Файл изображения (multipart/form-data).</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>URL изображения, доступный через API.</returns>
    [Authorize]
    [HttpPost("me/profile-banner")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(UploadMediaResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UploadMediaResponse>> UploadMyProfileBanner(IFormFile file, CancellationToken cancellationToken)
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
            $"user-profile-banners/{userId}",
            ResolveExtension(file),
            cancellationToken);

        var url = BuildApiMediaUrl(key);
        user.ProfileBannerUrl = url;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new UploadMediaResponse(url));
    }

    /// <summary>
    /// Загружает фото проекта портфолио текущего пользователя в S3-совместимое хранилище.
    /// </summary>
    /// <param name="projectId">Идентификатор проекта портфолио.</param>
    /// <param name="file">Файл изображения (multipart/form-data).</param>
    /// <param name="isMain">Флаг главного фото проекта.</param>
    /// <param name="sortOrder">Порядок сортировки фото в проекте.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Данные загруженного фото проекта.</returns>
    [Authorize]
    [HttpPost("me/portfolio-projects/{projectId:long}/photos")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(UploadPortfolioProjectPhotoResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UploadPortfolioProjectPhotoResponse>> UploadMyPortfolioProjectPhoto(
        long projectId,
        IFormFile file,
        [FromQuery] bool isMain,
        [FromQuery] int? sortOrder,
        CancellationToken cancellationToken)
    {
        var validation = ValidateImage(file);
        if (validation is not null)
        {
            return validation;
        }

        var userId = User.GetUserId();
        var project = await dbContext.CandidateResumeProjects
            .FirstOrDefaultAsync(x => x.Id == projectId, cancellationToken);
        if (project is null || project.UserId != userId)
        {
            return this.ToNotFoundError("media.portfolio.project.not_found", "Проект портфолио не найден.");
        }

        await using var stream = file.OpenReadStream();
        var key = await storageService.UploadImageAsync(
            stream,
            file.Length,
            file.ContentType,
            $"portfolio-projects/{projectId}",
            ResolveExtension(file),
            cancellationToken);

        var maxSortOrder = await dbContext.CandidateResumeProjectPhotos
            .Where(x => x.ProjectId == projectId)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(cancellationToken);
        var nextSortOrder = sortOrder ?? ((maxSortOrder ?? -1) + 1);

        if (isMain)
        {
            var oldMainPhotos = await dbContext.CandidateResumeProjectPhotos
                .Where(x => x.ProjectId == projectId && x.IsMain)
                .ToListAsync(cancellationToken);
            foreach (var oldMainPhoto in oldMainPhotos)
            {
                oldMainPhoto.IsMain = false;
            }
        }

        var photo = new CandidateResumeProjectPhoto
        {
            ProjectId = projectId,
            Url = BuildApiMediaUrl(key),
            IsMain = isMain,
            SortOrder = nextSortOrder
        };

        dbContext.CandidateResumeProjectPhotos.Add(photo);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new UploadPortfolioProjectPhotoResponse(photo.Id, photo.Url, photo.SortOrder, photo.IsMain));
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
    /// Загружает фото или видео в галерею компании.
    /// </summary>
    /// <param name="companyId">Идентификатор компании.</param>
    /// <param name="file">Файл медиа (multipart/form-data).</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Элемент галереи компании.</returns>
    [Authorize(Roles = "employer")]
    [HttpPost("companies/{companyId:long}/gallery")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(CompanyMediaItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CompanyMediaItemDto>> UploadCompanyGalleryMedia(long companyId, IFormFile file, CancellationToken cancellationToken)
    {
        var validation = ValidateCompanyMedia(file);
        if (validation is not null)
        {
            return validation;
        }

        var companyExists = await dbContext.Companies.AnyAsync(x => x.Id == companyId, cancellationToken);
        if (!companyExists)
        {
            return this.ToNotFoundError("media.company.not_found", "Компания не найдена.");
        }

        var userId = User.GetUserId();
        var hasMembership = await dbContext.CompanyMembers.AnyAsync(x => x.CompanyId == companyId && x.UserId == userId, cancellationToken);
        if (!hasMembership)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ErrorResponse("media.company.forbidden", "Недостаточно прав для загрузки медиа компании."));
        }

        var mediaType = ResolveMediaType(file.ContentType);
        var normalizedContentType = file.ContentType.ToLowerInvariant();

        await using var stream = file.OpenReadStream();
        var key = await storageService.UploadObjectAsync(
            stream,
            file.Length,
            normalizedContentType,
            $"company-gallery/{companyId}/{mediaType.ToString().ToLowerInvariant()}",
            ResolveExtension(file),
            cancellationToken);

        var maxSortOrder = await dbContext.CompanyMedia
            .Where(x => x.CompanyId == companyId)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(cancellationToken);

        var galleryItem = new CompanyMedia
        {
            CompanyId = companyId,
            MediaType = mediaType,
            Url = BuildApiMediaUrl(key),
            MimeType = normalizedContentType,
            SortOrder = (maxSortOrder ?? -1) + 1
        };

        dbContext.CompanyMedia.Add(galleryItem);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new CompanyMediaItemDto(
            galleryItem.Id,
            galleryItem.MediaType == CompanyMediaType.Video ? "video" : "image",
            galleryItem.Url,
            galleryItem.MimeType,
            galleryItem.SortOrder));
    }

    /// <summary>
    /// Удаляет элемент из галереи компании.
    /// </summary>
    /// <param name="companyId">Идентификатор компании.</param>
    /// <param name="mediaId">Идентификатор элемента галереи.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Пустой ответ при успешном удалении.</returns>
    [Authorize(Roles = "employer")]
    [HttpDelete("companies/{companyId:long}/gallery/{mediaId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> DeleteCompanyGalleryMedia(long companyId, long mediaId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var hasMembership = await dbContext.CompanyMembers.AnyAsync(x => x.CompanyId == companyId && x.UserId == userId, cancellationToken);
        if (!hasMembership)
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                new ErrorResponse("media.company.forbidden", "Недостаточно прав для удаления медиа компании."));
        }

        var media = await dbContext.CompanyMedia.FirstOrDefaultAsync(x => x.Id == mediaId && x.CompanyId == companyId, cancellationToken);
        if (media is null)
        {
            return this.ToNotFoundError("media.company.gallery_item.not_found", "Элемент галереи не найден.");
        }

        dbContext.CompanyMedia.Remove(media);
        await dbContext.SaveChangesAsync(cancellationToken);

        var objectKey = ExtractObjectKey(media.Url);
        if (!string.IsNullOrWhiteSpace(objectKey))
        {
            try
            {
                await storageService.DeleteObjectAsync(objectKey, cancellationToken);
            }
            catch
            {
                // Игнорируем ошибку удаления объекта из хранилища,
                // так как запись в базе уже удалена.
            }
        }

        return NoContent();
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

    private ActionResult? ValidateCompanyMedia(IFormFile? file)
    {
        if (file is null || file.Length == 0)
        {
            return this.ToBadRequestError("media.file.empty", "Файл не передан.");
        }

        if (string.IsNullOrWhiteSpace(file.ContentType))
        {
            return this.ToBadRequestError("media.file.content_type_invalid", "Неподдерживаемый тип файла.");
        }

        var normalizedContentType = file.ContentType.ToLowerInvariant();
        if (AllowedImageTypes.Contains(normalizedContentType))
        {
            if (file.Length > MaxImageSizeBytes)
            {
                return this.ToBadRequestError("media.file.too_large", "Размер изображения превышает 10 МБ.");
            }

            return null;
        }

        if (AllowedVideoTypes.Contains(normalizedContentType))
        {
            if (file.Length > MaxVideoSizeBytes)
            {
                return this.ToBadRequestError("media.file.too_large", "Размер видео превышает 200 МБ.");
            }

            return null;
        }

        return this.ToBadRequestError("media.file.content_type_invalid", "Допустимы только фото (jpg/png/webp/gif/svg) и видео (mp4/webm/mov).");
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
            "video/mp4" => "mp4",
            "video/webm" => "webm",
            "video/quicktime" => "mov",
            _ => "bin"
        };
    }

    private static string BuildApiMediaUrl(string objectKey)
    {
        return $"/api/media/{objectKey}";
    }

    private static string? ExtractObjectKey(string? mediaUrl)
    {
        if (string.IsNullOrWhiteSpace(mediaUrl))
        {
            return null;
        }

        const string prefix = "/api/media/";
        var index = mediaUrl.IndexOf(prefix, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return null;
        }

        var objectKey = mediaUrl[(index + prefix.Length)..].Trim('/');
        return string.IsNullOrWhiteSpace(objectKey) ? null : objectKey;
    }

    private static CompanyMediaType ResolveMediaType(string? contentType)
    {
        var normalizedContentType = contentType?.Trim().ToLowerInvariant() ?? string.Empty;
        return AllowedVideoTypes.Contains(normalizedContentType) ? CompanyMediaType.Video : CompanyMediaType.Image;
    }
}
