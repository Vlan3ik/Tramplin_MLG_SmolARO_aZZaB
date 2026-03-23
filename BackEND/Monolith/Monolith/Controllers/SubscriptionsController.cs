using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Subscriptions;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize]
[Route("subscriptions")]
[Produces("application/json")]
public class SubscriptionsController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("me/following")]
    [ProducesResponseType(typeof(IReadOnlyCollection<SubscriptionUserDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<SubscriptionUserDto>>> GetFollowing(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var items = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => x.FollowerUserId == userId)
            .Include(x => x.FollowingUser)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new SubscriptionUserDto(
                x.FollowingUserId,
                x.FollowingUser.Username,
                x.FollowingUser.DisplayName,
                x.FollowingUser.AvatarUrl,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(items);
    }

    [HttpGet("me/followers")]
    [ProducesResponseType(typeof(IReadOnlyCollection<SubscriptionUserDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<SubscriptionUserDto>>> GetFollowers(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var items = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => x.FollowingUserId == userId)
            .Include(x => x.FollowerUser)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new SubscriptionUserDto(
                x.FollowerUserId,
                x.FollowerUser.Username,
                x.FollowerUser.DisplayName,
                x.FollowerUser.AvatarUrl,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(items);
    }

    [HttpGet("me/stats")]
    [ProducesResponseType(typeof(SubscriptionStatsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<SubscriptionStatsDto>> GetMyStats(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var followingCount = await dbContext.UserSubscriptions
            .AsNoTracking()
            .CountAsync(x => x.FollowerUserId == userId, cancellationToken);
        var followersCount = await dbContext.UserSubscriptions
            .AsNoTracking()
            .CountAsync(x => x.FollowingUserId == userId, cancellationToken);

        return Ok(new SubscriptionStatsDto(followingCount, followersCount));
    }

    [HttpPost("{targetUserId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Follow(long targetUserId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (userId == targetUserId)
        {
            return this.ToBadRequestError("subscriptions.follow.self", "Нельзя подписаться на самого себя.");
        }

        if (!await dbContext.Users.AnyAsync(x => x.Id == targetUserId, cancellationToken))
        {
            return this.ToNotFoundError("subscriptions.target.not_found", "Пользователь не найден.");
        }

        var isAdminTarget = await dbContext.UserRoles.AnyAsync(
            x => x.UserId == targetUserId && x.Role == PlatformRole.Curator,
            cancellationToken);
        if (isAdminTarget)
        {
            return this.ToBadRequestError("subscriptions.follow.admin_forbidden", "Нельзя подписаться на администратора.");
        }

        if (await dbContext.UserSubscriptions.AnyAsync(
                x => x.FollowerUserId == userId && x.FollowingUserId == targetUserId,
                cancellationToken))
        {
            return this.ToConflictError("subscriptions.already_exists", "Подписка уже существует.");
        }

        dbContext.UserSubscriptions.Add(new UserSubscription
        {
            FollowerUserId = userId,
            FollowingUserId = targetUserId
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{targetUserId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Unfollow(long targetUserId, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var entity = await dbContext.UserSubscriptions
            .FirstOrDefaultAsync(
                x => x.FollowerUserId == userId && x.FollowingUserId == targetUserId,
                cancellationToken);

        if (entity is null)
        {
            return this.ToNotFoundError("subscriptions.not_found", "Подписка не найдена.");
        }

        dbContext.UserSubscriptions.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
