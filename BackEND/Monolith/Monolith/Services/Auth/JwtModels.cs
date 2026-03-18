namespace Monolith.Services.Auth;

public class JwtOptions
{
    public string Issuer { get; set; } = "Tramplin.Api";
    public string Audience { get; set; } = "Tramplin.Client";
    public string Secret { get; set; } = "CHANGE_THIS_SECRET_TO_A_LONG_RANDOM_KEY_32_BYTES_MIN";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 30;
}

public class MinioOptions
{
    public string Endpoint { get; set; } = "minio:9000";
    public string AccessKey { get; set; } = "minioadmin";
    public string SecretKey { get; set; } = "minioadmin";
    public string Bucket { get; set; } = "tramplin-media";
    public bool UseSsl { get; set; }
}

public record AccessTokenResult(string AccessToken, DateTimeOffset ExpiresAt);

public record RefreshTokenResult(string RefreshToken, DateTimeOffset ExpiresAt);
