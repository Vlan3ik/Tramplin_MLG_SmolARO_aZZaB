namespace Monolith.Services.Chats;

public interface IChatCacheService
{
    Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken) where T : class;
    Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken cancellationToken) where T : class;

    Task<string> GetUserListTokenAsync(long userId, CancellationToken cancellationToken);
    Task InvalidateUserListAsync(long userId, CancellationToken cancellationToken);

    Task<string> GetChatHistoryTokenAsync(long chatId, CancellationToken cancellationToken);
    Task InvalidateChatHistoryAsync(long chatId, CancellationToken cancellationToken);
}
