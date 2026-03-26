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
    [HttpGet("me")]
    [ProducesResponseType(typeof(MyFavoritesDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<MyFavoritesDto>> GetMyFavorites(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
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

        return Ok(new MyFavoritesDto(vacancyIds, opportunityIds));
    }

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
