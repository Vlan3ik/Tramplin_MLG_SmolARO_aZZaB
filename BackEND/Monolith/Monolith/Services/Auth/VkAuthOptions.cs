namespace Monolith.Services.Auth;

public class VkAuthOptions
{
    public const string SectionName = "VkAuth";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
    public string ApiVersion { get; set; } = "5.199";
}
