using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

namespace Monolith.Services.Chats;

public class ChatCacheService(IDistributedCache cache) : IChatCacheService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan TokenTtl = TimeSpan.FromDays(30);

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken) where T : class
    {
        var payload = await cache.GetStringAsync(key, cancellationToken);
        if (string.IsNullOrWhiteSpace(payload))
        {
            return null;
        }

        return JsonSerializer.Deserialize<T>(payload, JsonOptions);
    }

    public Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken cancellationToken) where T : class
    {
        var payload = JsonSerializer.Serialize(value, JsonOptions);
        return cache.SetStringAsync(key, payload, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = ttl
        }, cancellationToken);
    }

    public Task<string> GetUserListTokenAsync(long userId, CancellationToken cancellationToken)
        => GetTokenAsync(GetUserListTokenKey(userId), cancellationToken);

    public Task InvalidateUserListAsync(long userId, CancellationToken cancellationToken)
        => RotateTokenAsync(GetUserListTokenKey(userId), cancellationToken);

    public Task<string> GetChatHistoryTokenAsync(long chatId, CancellationToken cancellationToken)
        => GetTokenAsync(GetChatHistoryTokenKey(chatId), cancellationToken);

    public Task InvalidateChatHistoryAsync(long chatId, CancellationToken cancellationToken)
        => RotateTokenAsync(GetChatHistoryTokenKey(chatId), cancellationToken);

    private async Task<string> GetTokenAsync(string key, CancellationToken cancellationToken)
    {
        var token = await cache.GetStringAsync(key, cancellationToken);
        if (!string.IsNullOrWhiteSpace(token))
        {
            return token;
        }

        token = "0";
        await cache.SetStringAsync(key, token, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TokenTtl
        }, cancellationToken);
        return token;
    }

    private Task RotateTokenAsync(string key, CancellationToken cancellationToken)
        => cache.SetStringAsync(key, Guid.NewGuid().ToString("N"), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TokenTtl
        }, cancellationToken);

    private static string GetUserListTokenKey(long userId)
        => $"chats:list:token:user:{userId}";

    private static string GetChatHistoryTokenKey(long chatId)
        => $"chats:history:token:chat:{chatId}";
}
