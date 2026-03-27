using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Admin;
using Monolith.Models.Common;
using Monolith.Services.Common;

namespace Monolith.Controllers;

/// <summary>
/// Административные операции над компаниями.
/// Доступ только для ролей curator и admin.
/// </summary>
[ApiController]
[Authorize(Roles = "curator,admin")]
[Route("admin/companies")]
[Produces("application/json")]
public class AdminCompaniesController(AppDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Возвращает список компаний для модерации с пагинацией и поиском.
    /// </summary>
    /// <param name="page">Номер страницы, начиная с 1.</param>
    /// <param name="pageSize">Размер страницы, максимум 100.</param>
    /// <param name="search">Поисковая строка по legalName, brandName и industry.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    /// <returns>Постраничный список компаний.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminCompanyListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResponse<AdminCompanyListItemDto>>> GetList(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = page <= 0 ? 1 : page;
        var safePageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);
        var query = dbContext.Companies.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.LegalName.ToLower().Contains(term) ||
                (x.BrandName != null && x.BrandName.ToLower().Contains(term)) ||
                x.Industry.ToLower().Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new AdminCompanyListItemDto(x.Id, x.LegalName, x.BrandName, x.Status, x.BaseCityId, x.Industry, x.CreatedAt))
            .ToListAsync(cancellationToken);
        return Ok(new PagedResponse<AdminCompanyListItemDto>(rows, total, safePage, safePageSize));
    }

    /// <summary>
    /// Создаёт компанию в административном контуре.
    /// </summary>
    /// <param name="request">Полный набор полей компании.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    /// <returns>Созданная компания.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(AdminCompanyListItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminCompanyListItemDto>> Create(AdminCompanyUpsertRequest request, CancellationToken cancellationToken)
    {
        var company = new Company();
        Apply(company, request);
        dbContext.Companies.Add(company);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminCompanyListItemDto(company.Id, company.LegalName, company.BrandName, company.Status, company.BaseCityId, company.Industry, company.CreatedAt);
        return CreatedAtAction(nameof(GetList), new { id = company.Id }, dto);
    }

    /// <summary>
    /// Обновляет данные компании.
    /// </summary>
    /// <param name="id">Идентификатор компании.</param>
    /// <param name="request">Новые значения полей компании.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    /// <returns>Обновлённая компания.</returns>
    [HttpPut("{id:long}")]
    [ProducesResponseType(typeof(AdminCompanyListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminCompanyListItemDto>> Update(long id, AdminCompanyUpsertRequest request, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "Компания не найдена.");
        }

        Apply(company, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        var dto = new AdminCompanyListItemDto(company.Id, company.LegalName, company.BrandName, company.Status, company.BaseCityId, company.Industry, company.CreatedAt);
        return Ok(dto);
    }

    /// <summary>
    /// Удаляет компанию.
    /// </summary>
    /// <remarks>
    /// Удаление физическое, включая зависимые записи по каскадным внешним ключам.
    /// </remarks>
    /// <param name="id">Идентификатор компании.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "Компания не найдена.");
        }

        dbContext.Companies.Remove(company);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Подтверждает верификацию компании.
    /// </summary>
    /// <param name="id">Идентификатор компании.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    [HttpPost("{id:long}/verify")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Verify(long id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "Компания не найдена.");
        }

        company.Status = CompanyStatus.Verified;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Отклоняет верификацию компании.
    /// </summary>
    /// <param name="id">Идентификатор компании.</param>
    /// <param name="cancellationToken">Токен отмены запроса.</param>
    [HttpPost("{id:long}/reject")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Reject(long id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "Компания не найдена.");
        }

        company.Status = CompanyStatus.Rejected;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPatch("{id:long}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateStatus(long id, AdminCompanyStatusUpdateRequest request, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "Компания не найдена.");
        }

        company.Status = request.Status;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void Apply(Company company, AdminCompanyUpsertRequest request)
    {
        company.LegalName = request.LegalName.Trim();
        company.BrandName = string.IsNullOrWhiteSpace(request.BrandName) ? null : request.BrandName.Trim();
        company.LegalType = request.LegalType;
        company.TaxId = request.TaxId.Trim();
        company.RegistrationNumber = request.RegistrationNumber.Trim();
        company.Industry = request.Industry.Trim();
        company.Description = request.Description.Trim();
        company.BaseCityId = request.BaseCityId;
        company.WebsiteUrl = string.IsNullOrWhiteSpace(request.WebsiteUrl) ? null : request.WebsiteUrl.Trim();
        company.PublicEmail = string.IsNullOrWhiteSpace(request.PublicEmail) ? null : request.PublicEmail.Trim();
        company.PublicPhone = string.IsNullOrWhiteSpace(request.PublicPhone) ? null : request.PublicPhone.Trim();
        company.Status = request.Status;
    }
}

