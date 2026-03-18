namespace Monolith.Services.Storage;

public interface IObjectStorageService
{
    Task<string> UploadImageAsync(Stream stream, long size, string contentType, string objectPrefix, string fileExtension, CancellationToken cancellationToken);
    Task<StoredObjectResult?> GetObjectAsync(string objectKey, CancellationToken cancellationToken);
}

public sealed record StoredObjectResult(Stream Data, string ContentType);
