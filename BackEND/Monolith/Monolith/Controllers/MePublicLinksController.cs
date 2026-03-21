using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Me;
using Monolith.Services.Common;

namespace Monolith.Controllers;

/// <summary>
/// Управление публичными ссылками текущего пользователя.
/// </summary>
[ApiController]
[Authorize]
[Route("me/public-links")]
[Produces("application/json")]
public class MePublicLinksController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает публичные ссылки текущего пользователя.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции чтения.</param>
    /// <returns>Список публичных ссылок пользователя.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<MePublicLinkDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyCollection<MePublicLinkDto>>> Get(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var links = await dbContext.UserPublicLinks
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => new MePublicLinkDto(x.Id, x.Kind, x.Url, x.Label, x.SortOrder))
            .ToListAsync(cancellationToken);

        return Ok(links);
    }

    /// <summary>
    /// Полностью обновляет публичные ссылки текущего пользователя.
    /// </summary>
    /// <param name="request">Новый набор публичных ссылок.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Актуальный список публичных ссылок после сохранения.</returns>
    [HttpPut]
    [ProducesResponseType(typeof(IReadOnlyCollection<MePublicLinkDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Monolith.Models.Common.ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyCollection<MePublicLinkDto>>> Put(
        UpdateMePublicLinksRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Links.Any(x => string.IsNullOrWhiteSpace(x.Kind) || string.IsNullOrWhiteSpace(x.Url)))
        {
            return this.ToBadRequestError("me.public_links.invalid_item", "Поля kind и url обязательны для каждой ссылки.");
        }

        var userId = User.GetUserId();
        var oldLinks = await dbContext.UserPublicLinks.Where(x => x.UserId == userId).ToListAsync(cancellationToken);
        dbContext.UserPublicLinks.RemoveRange(oldLinks);

        dbContext.UserPublicLinks.AddRange(request.Links.Select(x => new UserPublicLink
        {
            UserId = userId,
            Kind = x.Kind.Trim().ToLowerInvariant(),
            Url = x.Url.Trim(),
            Label = x.Label?.Trim(),
            SortOrder = x.SortOrder
        }));

        await dbContext.SaveChangesAsync(cancellationToken);

        var links = await dbContext.UserPublicLinks
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => new MePublicLinkDto(x.Id, x.Kind, x.Url, x.Label, x.SortOrder))
            .ToListAsync(cancellationToken);

        return Ok(links);
    }
}
