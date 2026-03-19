using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Monolith.Services.Common;

namespace Monolith.Hubs;

[Authorize]
public class ChatHub : Hub
{
    public Task JoinChat(long chatId) => Groups.AddToGroupAsync(Context.ConnectionId, GroupName(chatId));

    public Task LeaveChat(long chatId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(chatId));

    public async Task Typing(long chatId)
    {
        var userId = Context.User?.GetUserId() ?? 0;
        await Clients.OthersInGroup(GroupName(chatId)).SendAsync("typing", new { chatId, userId });
    }

    public static string GroupName(long chatId) => $"chat:{chatId}";
}
