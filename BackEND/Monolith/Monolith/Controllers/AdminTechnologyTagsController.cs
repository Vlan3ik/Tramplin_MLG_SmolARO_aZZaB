using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Monolith.Models.Common;
using Monolith.Models.Tags;
using Monolith.Services.Common;
using Monolith.Services.Tags;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "curator,admin")]
[Route("admin/tags/technology")]
[Produces("application/json")]
public class AdminTechnologyTagsController(ITechnologyTagService technologyTagService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<TechnologyTagListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<TechnologyTagListItemDto>>> GetList(CancellationToken cancellationToken)
    {
        var rows = await technologyTagService.GetList(cancellationToken);
        return Ok(rows);
    }

    [HttpPost]
    [ProducesResponseType(typeof(TechnologyTagListItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TechnologyTagListItemDto>> Create(TechnologyTagUpsertRequest request, CancellationToken cancellationToken)
    {
        var result = await technologyTagService.Create(request, cancellationToken);
        if (result.Item is not null)
        {
            return StatusCode(StatusCodes.Status201Created, result.Item);
        }

        return ToErrorResponse(result.Error, result.ErrorCode, result.ErrorMessage);
    }

    [HttpPatch("{id:long}")]
    [ProducesResponseType(typeof(TechnologyTagListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<TechnologyTagListItemDto>> Update(long id, TechnologyTagUpsertRequest request, CancellationToken cancellationToken)
    {
        var result = await technologyTagService.Update(id, request, cancellationToken);
        if (result.Item is not null)
        {
            return Ok(result.Item);
        }

        return ToErrorResponse(result.Error, result.ErrorCode, result.ErrorMessage);
    }

    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var result = await technologyTagService.Delete(id, cancellationToken);
        if (result.Succeeded)
        {
            return NoContent();
        }

        return this.ToNotFoundError(result.ErrorCode ?? "technology_tags.not_found", result.ErrorMessage ?? "Tag not found.");
    }

    private ActionResult ToErrorResponse(TechnologyTagMutationError error, string? code, string? message)
    {
        return error switch
        {
            TechnologyTagMutationError.Validation => this.ToBadRequestError(code ?? "technology_tags.validation", message ?? "Validation error."),
            TechnologyTagMutationError.Conflict => this.ToConflictError(code ?? "technology_tags.conflict", message ?? "Conflict."),
            TechnologyTagMutationError.GroupNotFound => this.ToNotFoundError(code ?? "technology_tags.group_not_found", message ?? "Technology tag group not found."),
            _ => this.ToNotFoundError(code ?? "technology_tags.not_found", message ?? "Tag not found.")
        };
    }
}
