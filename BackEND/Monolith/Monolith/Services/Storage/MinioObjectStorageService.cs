using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using Monolith.Services.Auth;

namespace Monolith.Services.Storage;

public class MinioObjectStorageService(IOptions<MinioOptions> options) : IObjectStorageService
{
    private readonly MinioOptions _options = options.Value;
    private readonly IMinioClient _client = new MinioClient()
        .WithEndpoint(options.Value.Endpoint)
        .WithCredentials(options.Value.AccessKey, options.Value.SecretKey)
        .WithSSL(options.Value.UseSsl)
        .Build();

    public Task<string> UploadImageAsync(
        Stream stream,
        long size,
        string contentType,
        string objectPrefix,
        string fileExtension,
        CancellationToken cancellationToken)
    {
        return UploadObjectAsync(stream, size, contentType, objectPrefix, fileExtension, cancellationToken);
    }

    public async Task<string> UploadObjectAsync(
        Stream stream,
        long size,
        string contentType,
        string objectPrefix,
        string fileExtension,
        CancellationToken cancellationToken)
    {
        await EnsureBucketAsync(cancellationToken);

        var safePrefix = objectPrefix.Trim('/').ToLowerInvariant();
        var extension = fileExtension.Trim().TrimStart('.').ToLowerInvariant();
        var objectKey = $"{safePrefix}/{Guid.NewGuid():N}.{extension}";

        var putArgs = new PutObjectArgs()
            .WithBucket(_options.Bucket)
            .WithObject(objectKey)
            .WithStreamData(stream)
            .WithObjectSize(size)
            .WithContentType(contentType);

        await _client.PutObjectAsync(putArgs, cancellationToken).ConfigureAwait(false);
        return objectKey;
    }

    public async Task<StoredObjectResult?> GetObjectAsync(string objectKey, CancellationToken cancellationToken)
    {
        await EnsureBucketAsync(cancellationToken);

        var safeKey = objectKey.Trim('/');
        try
        {
            var stat = await _client.StatObjectAsync(
                new StatObjectArgs().WithBucket(_options.Bucket).WithObject(safeKey),
                cancellationToken).ConfigureAwait(false);

            var ms = new MemoryStream();
            await _client.GetObjectAsync(
                new GetObjectArgs()
                    .WithBucket(_options.Bucket)
                    .WithObject(safeKey)
                    .WithCallbackStream(s => s.CopyTo(ms)),
                cancellationToken).ConfigureAwait(false);

            ms.Position = 0;
            var contentType = string.IsNullOrWhiteSpace(stat.ContentType) ? "application/octet-stream" : stat.ContentType;
            return new StoredObjectResult(ms, contentType);
        }
        catch
        {
            return null;
        }
    }

    public async Task DeleteObjectAsync(string objectKey, CancellationToken cancellationToken)
    {
        await EnsureBucketAsync(cancellationToken);
        var safeKey = objectKey.Trim('/');
        if (string.IsNullOrWhiteSpace(safeKey))
        {
            return;
        }

        await _client.RemoveObjectAsync(
            new RemoveObjectArgs()
                .WithBucket(_options.Bucket)
                .WithObject(safeKey),
            cancellationToken).ConfigureAwait(false);
    }

    private async Task EnsureBucketAsync(CancellationToken cancellationToken)
    {
        var exists = await _client.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_options.Bucket),
            cancellationToken).ConfigureAwait(false);

        if (!exists)
        {
            await _client.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(_options.Bucket),
                cancellationToken).ConfigureAwait(false);
        }
    }
}
