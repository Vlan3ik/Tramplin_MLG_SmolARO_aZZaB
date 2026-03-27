using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Favorites;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize]
[Route("favorites")]
[Produces("application/json")]
public class FavoritesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает текущие избранные вакансии и возможности пользователя.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    [HttpGet("me")]
    [ProducesResponseType(typeof(MyFavoritesDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<MyFavoritesDto>> GetMyFavorites(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        return Ok(await BuildMyFavoritesDto(userId, cancellationToken));
    }

    /// <summary>
    /// Синхронизирует избранное пользователя со списками id из клиента.
    /// </summary>
    /// <param name="request">Набор id вакансий и возможностей, которые нужно добавить в избранное.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    [HttpPost("sync")]
    [ProducesResponseType(typeof(MyFavoritesDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<MyFavoritesDto>> SyncMyFavorites(
        SyncFavoritesRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var vacancyIds = (request.VacancyIds ?? [])
            .Where(x => x > 0)
            .Distinct()
            .ToArray();
        var opportunityIds = (request.OpportunityIds ?? [])
            .Where(x => x > 0)
            .Distinct()
            .ToArray();

        if (vacancyIds.Length > 0 || opportunityIds.Length > 0)
        {
            var validVacancyIds = vacancyIds.Length == 0
                ? []
                : await dbContext.Vacancies
                    .AsNoTracking()
                    .Where(x => vacancyIds.Contains(x.Id))
                    .Select(x => x.Id)
                    .ToArrayAsync(cancellationToken);
            var validOpportunityIds = opportunityIds.Length == 0
                ? []
                : await dbContext.Opportunities
                    .AsNoTracking()
                    .Where(x => opportunityIds.Contains(x.Id))
                    .Select(x => x.Id)
                    .ToArrayAsync(cancellationToken);

            var existingRows = await dbContext.UserOpportunityFavorites
                .AsNoTracking()
                .Where(x => x.UserId == userId)
                .Select(x => new { x.VacancyId, x.OpportunityId })
                .ToListAsync(cancellationToken);

            var existingVacancyIds = existingRows
                .Where(x => x.VacancyId is not null)
                .Select(x => x.VacancyId!.Value)
                .ToHashSet();
            var existingOpportunityIds = existingRows
                .Where(x => x.OpportunityId is not null)
                .Select(x => x.OpportunityId!.Value)
                .ToHashSet();

            foreach (var vacancyId in validVacancyIds)
            {
                if (!existingVacancyIds.Add(vacancyId))
                {
                    continue;
                }

                dbContext.UserOpportunityFavorites.Add(new UserOpportunityFavorite
                {
                    UserId = userId,
                    VacancyId = vacancyId
                });
            }

            foreach (var opportunityId in validOpportunityIds)
            {
                if (!existingOpportunityIds.Add(opportunityId))
                {
                    continue;
                }

                dbContext.UserOpportunityFavorites.Add(new UserOpportunityFavorite
                {
                    UserId = userId,
                    OpportunityId = opportunityId
                });
            }

            if (dbContext.ChangeTracker.HasChanges())
            {
                await dbContext.SaveChangesAsync(cancellationToken);
            }
        }

        return Ok(await BuildMyFavoritesDto(userId, cancellationToken));
    }

    private async Task<MyFavoritesDto> BuildMyFavoritesDto(long userId, CancellationToken cancellationToken)
    {
        var rows = await dbContext.UserOpportunityFavorites
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => new { x.VacancyId, x.OpportunityId })
            .ToListAsync(cancellationToken);

        var vacancyIds = rows
            .Where(x => x.VacancyId is not null)
            .Select(x => x.VacancyId!.Value)
            .OrderBy(x => x)
            .ToArray();
        var opportunityIds = rows
            .Where(x => x.OpportunityId is not null)
            .Select(x => x.OpportunityId!.Value)
            .OrderBy(x => x)
            .ToArray();

        return new MyFavoritesDto(vacancyIds, opportunityIds);
    }

    /// <summary>
    /// Добавляет вакансию в избранное текущего пользователя.
    /// </summary>
    /// <param name="id">Идентификатор вакансии.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    [HttpPost("vacancies/{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddVacancy(long id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (!await dbContext.Vacancies.AsNoTracking().AnyAsync(x => x.Id == id, cancellationToken))
        {
            return this.ToNotFoundError("favorites.vacancy.not_found", "Vacancy not found.");
        }

        var exists = await dbContext.UserOpportunityFavorites
            .AnyAsync(x => x.UserId == userId && x.VacancyId == id, cancellationToken);
        if (!exists)
        {
            dbContext.UserOpportunityFavorites.Add(new UserOpportunityFavorite
            {
                UserId = userId,
                VacancyId = id
            });
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return NoContent();
    }

    /// <summary>
    /// Удаляет вакансию из избранного текущего пользователя.
    /// </summary>
    /// <param name="id">Идентификатор вакансии.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    [HttpDelete("vacancies/{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoveVacancy(long id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        await dbContext.UserOpportunityFavorites
            .Where(x => x.UserId == userId && x.VacancyId == id)
            .ExecuteDeleteAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Добавляет возможность в избранное текущего пользователя.
    /// </summary>
    /// <param name="id">Идентификатор возможности.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    [HttpPost("opportunities/{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddOpportunity(long id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        if (!await dbContext.Opportunities.AsNoTracking().AnyAsync(x => x.Id == id, cancellationToken))
        {
            return this.ToNotFoundError("favorites.opportunity.not_found", "Opportunity not found.");
        }

        var exists = await dbContext.UserOpportunityFavorites
            .AnyAsync(x => x.UserId == userId && x.OpportunityId == id, cancellationToken);
        if (!exists)
        {
            dbContext.UserOpportunityFavorites.Add(new UserOpportunityFavorite
            {
                UserId = userId,
                OpportunityId = id
            });
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return NoContent();
    }

    /// <summary>
    /// Удаляет возможность из избранного текущего пользователя.
    /// </summary>
    /// <param name="id">Идентификатор возможности.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    [HttpDelete("opportunities/{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoveOpportunity(long id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        await dbContext.UserOpportunityFavorites
            .Where(x => x.UserId == userId && x.OpportunityId == id)
            .ExecuteDeleteAsync(cancellationToken);
        return NoContent();
    }
}
