using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Employer;
using Monolith.Services.Common;

namespace Monolith.Controllers;

/// <summary>
/// Управление ссылками компании работодателя.
/// </summary>
[ApiController]
[Authorize(Roles = "employer")]
[Route("employer/company/links")]
[Produces("application/json")]
public class EmployerCompanyLinksController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список ссылок компании текущего работодателя.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<EmployerCompanyLinkDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyCollection<EmployerCompanyLinkDto>>> GetList(CancellationToken cancellationToken)
    {
        var companyId = await GetManagedCompanyId(cancellationToken);
        if (companyId is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("employer.company.links.forbidden", "Недостаточно прав на управление ссылками компании."));
        }

        var links = await dbContext.CompanyLinks
            .AsNoTracking()
            .Where(x => x.CompanyId == companyId.Value)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new EmployerCompanyLinkDto(x.Id, x.LinkKind, x.Url, x.Label, x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(links);
    }

    /// <summary>
    /// Создает новую ссылку компании.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(EmployerCompanyLinkDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<EmployerCompanyLinkDto>> Create(CreateEmployerCompanyLinkRequest request, CancellationToken cancellationToken)
    {
        var companyId = await GetManagedCompanyId(cancellationToken);
        if (companyId is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("employer.company.links.forbidden", "Недостаточно прав на управление ссылками компании."));
        }

        if (!TryNormalizeUrl(request.Url, out var normalizedUrl))
        {
            return this.ToBadRequestError("employer.company.links.url_invalid", "Допустимы только абсолютные URL со схемой http/https.");
        }

        var entity = new CompanyLink
        {
            CompanyId = companyId.Value,
            LinkKind = request.LinkKind,
            Url = normalizedUrl,
            Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim()
        };

        dbContext.CompanyLinks.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        var dto = new EmployerCompanyLinkDto(entity.Id, entity.LinkKind, entity.Url, entity.Label, entity.CreatedAt);
        return CreatedAtAction(nameof(GetList), new { }, dto);
    }

    /// <summary>
    /// Обновляет ссылку компании.
    /// </summary>
    [HttpPatch("{linkId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(long linkId, UpdateEmployerCompanyLinkRequest request, CancellationToken cancellationToken)
    {
        var companyId = await GetManagedCompanyId(cancellationToken);
        if (companyId is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("employer.company.links.forbidden", "Недостаточно прав на управление ссылками компании."));
        }

        if (!TryNormalizeUrl(request.Url, out var normalizedUrl))
        {
            return this.ToBadRequestError("employer.company.links.url_invalid", "Допустимы только абсолютные URL со схемой http/https.");
        }

        var link = await dbContext.CompanyLinks.FirstOrDefaultAsync(x => x.Id == linkId && x.CompanyId == companyId.Value, cancellationToken);
        if (link is null)
        {
            return this.ToNotFoundError("employer.company.links.not_found", "Ссылка компании не найдена.");
        }

        link.LinkKind = request.LinkKind;
        link.Url = normalizedUrl;
        link.Label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim();
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Удаляет ссылку компании.
    /// </summary>
    [HttpDelete("{linkId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(long linkId, CancellationToken cancellationToken)
    {
        var companyId = await GetManagedCompanyId(cancellationToken);
        if (companyId is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("employer.company.links.forbidden", "Недостаточно прав на управление ссылками компании."));
        }

        var link = await dbContext.CompanyLinks.FirstOrDefaultAsync(x => x.Id == linkId && x.CompanyId == companyId.Value, cancellationToken);
        if (link is null)
        {
            return this.ToNotFoundError("employer.company.links.not_found", "Ссылка компании не найдена.");
        }

        dbContext.CompanyLinks.Remove(link);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<long?> GetManagedCompanyId(CancellationToken cancellationToken)
    {
        var membership = await dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.UserId == User.GetUserId()
                     && (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin),
                cancellationToken);

        return membership?.CompanyId;
    }

    private static bool TryNormalizeUrl(string? rawUrl, out string normalizedUrl)
    {
        normalizedUrl = string.Empty;
        if (string.IsNullOrWhiteSpace(rawUrl))
        {
            return false;
        }

        if (!Uri.TryCreate(rawUrl.Trim(), UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (uri.Scheme is not ("http" or "https"))
        {
            return false;
        }

        normalizedUrl = uri.GetComponents(UriComponents.HttpRequestUrl, UriFormat.SafeUnescaped);
        return true;
    }
}
