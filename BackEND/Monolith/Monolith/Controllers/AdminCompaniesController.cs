using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Admin;
using Monolith.Models.Common;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "curator,admin")]
[Route("admin/companies")]
[Produces("application/json")]
public class AdminCompaniesController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<AdminCompanyListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<AdminCompanyListItemDto>>> GetList(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var safePage = page <= 0 ? 1 : page;
        var safePageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

        var query = dbContext.Companies
            .AsNoTracking()
            .Include(x => x.VerificationProfile)
                .ThenInclude(x => x!.MainIndustry)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.LegalName.ToLower().Contains(term) ||
                (x.BrandName != null && x.BrandName.ToLower().Contains(term)) ||
                (x.VerificationProfile != null && x.VerificationProfile.MainIndustry.Name.ToLower().Contains(term)));
        }

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(x => new AdminCompanyListItemDto(
                x.Id,
                x.LegalName,
                x.BrandName,
                x.Status,
                x.BaseCityId,
                x.VerificationProfile != null ? x.VerificationProfile.MainIndustry.Name : null,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<AdminCompanyListItemDto>(rows, total, safePage, safePageSize));
    }

    [HttpPost]
    [ProducesResponseType(typeof(AdminCompanyListItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AdminCompanyListItemDto>> Create(AdminCompanyUpsertRequest request, CancellationToken cancellationToken)
    {
        var industryId = await dbContext.EmployerVerificationIndustries
            .OrderBy(x => x.SortOrder)
            .Select(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (industryId == 0)
        {
            return this.ToBadRequestError("admin.companies.industry.not_found", "Verification industries dictionary is empty.");
        }

        var company = new Company
        {
            LegalName = request.LegalName.Trim(),
            BrandName = NormalizeNullable(request.BrandName),
            Description = request.Description.Trim(),
            BaseCityId = request.BaseCityId,
            WebsiteUrl = NormalizeNullable(request.WebsiteUrl),
            PublicEmail = NormalizeNullable(request.PublicEmail),
            PublicPhone = NormalizeNullable(request.PublicPhone),
            Status = request.Status
        };
        dbContext.Companies.Add(company);
        await dbContext.SaveChangesAsync(cancellationToken);

        dbContext.EmployerVerificationProfiles.Add(new EmployerVerificationProfile
        {
            CompanyId = company.Id,
            EmployerType = EmployerType.LegalEntity,
            OgrnOrOgrnip = string.Empty,
            Inn = string.Empty,
            LegalAddress = string.Empty,
            RepresentativeFullName = string.Empty,
            MainIndustryId = industryId,
            WorkEmail = string.Empty,
            WorkPhone = string.Empty,
            ReviewStatus = MapStatusToReview(company.Status)
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(
            nameof(GetList),
            new { id = company.Id },
            new AdminCompanyListItemDto(company.Id, company.LegalName, company.BrandName, company.Status, company.BaseCityId, null, company.CreatedAt));
    }

    [HttpPut("{id:long}")]
    [ProducesResponseType(typeof(AdminCompanyListItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminCompanyListItemDto>> Update(long id, AdminCompanyUpsertRequest request, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies
            .Include(x => x.VerificationProfile)
                .ThenInclude(x => x!.MainIndustry)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "Компания не найдена.");
        }

        company.LegalName = request.LegalName.Trim();
        company.BrandName = NormalizeNullable(request.BrandName);
        company.Description = request.Description.Trim();
        company.BaseCityId = request.BaseCityId;
        company.WebsiteUrl = NormalizeNullable(request.WebsiteUrl);
        company.PublicEmail = NormalizeNullable(request.PublicEmail);
        company.PublicPhone = NormalizeNullable(request.PublicPhone);
        company.Status = request.Status;

        if (company.VerificationProfile is not null)
        {
            company.VerificationProfile.ReviewStatus = MapStatusToReview(request.Status);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new AdminCompanyListItemDto(
            company.Id,
            company.LegalName,
            company.BrandName,
            company.Status,
            company.BaseCityId,
            company.VerificationProfile?.MainIndustry.Name,
            company.CreatedAt));
    }

    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
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

    [HttpPatch("{id:long}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(long id, AdminCompanyStatusUpdateRequest request, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies
            .Include(x => x.VerificationProfile)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("admin.companies.not_found", "Компания не найдена.");
        }

        company.Status = request.Status;
        if (company.VerificationProfile is not null)
        {
            company.VerificationProfile.ReviewStatus = MapStatusToReview(request.Status);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:long}/verification")]
    [ProducesResponseType(typeof(AdminCompanyVerificationDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminCompanyVerificationDetailDto>> GetVerification(long id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies
            .AsNoTracking()
            .Include(x => x.VerificationProfile)
                .ThenInclude(x => x!.MainIndustry)
            .Include(x => x.VerificationProfile)
                .ThenInclude(x => x!.Documents)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company?.VerificationProfile is null)
        {
            return this.ToNotFoundError("admin.companies.verification.not_found", "Verification profile not found.");
        }

        var profile = company.VerificationProfile;
        var missingDocs = string.IsNullOrWhiteSpace(profile.MissingDocs)
            ? Array.Empty<string>()
            : profile.MissingDocs.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var dto = new AdminCompanyVerificationDetailDto(
            company.Id,
            company.LegalName,
            company.BrandName,
            company.Status,
            profile.EmployerType,
            profile.ReviewStatus,
            profile.OgrnOrOgrnip,
            profile.Inn,
            profile.Kpp,
            profile.LegalAddress,
            profile.ActualAddress,
            profile.RepresentativeFullName,
            profile.RepresentativePosition,
            profile.MainIndustryId,
            profile.MainIndustry.Name,
            profile.TaxOffice,
            profile.WorkEmail,
            profile.WorkPhone,
            profile.SiteOrPublicLinks,
            profile.SubmittedAt,
            profile.VerifiedAt,
            profile.VerifiedByUserId,
            profile.RejectReason,
            missingDocs,
            profile.Documents
                .OrderBy(x => x.DocumentType)
                .ThenByDescending(x => x.CreatedAt)
                .Select(x => new AdminCompanyVerificationDocumentDto(
                    x.Id,
                    x.DocumentType,
                    x.FileName,
                    x.ContentType,
                    x.SizeBytes,
                    x.Status,
                    x.ModeratorComment,
                    x.UploadedByUserId,
                    x.ReviewedByUserId,
                    x.ReviewedAt,
                    x.CreatedAt))
                .ToArray());

        return Ok(dto);
    }

    [HttpPost("{id:long}/verification/approve")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ApproveVerification(long id, CancellationToken cancellationToken)
    {
        var company = await dbContext.Companies
            .Include(x => x.VerificationProfile)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company?.VerificationProfile is null)
        {
            return this.ToNotFoundError("admin.companies.verification.not_found", "Verification profile not found.");
        }

        company.Status = CompanyStatus.Verified;
        company.VerificationProfile.ReviewStatus = VerificationReviewStatus.Approved;
        company.VerificationProfile.VerifiedAt = DateTimeOffset.UtcNow;
        company.VerificationProfile.VerifiedByUserId = User.GetUserId();
        company.VerificationProfile.RejectReason = null;
        company.VerificationProfile.MissingDocs = null;

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:long}/verification/reject")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RejectVerification(long id, AdminRejectVerificationRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RejectReason))
        {
            return this.ToBadRequestError("admin.companies.verification.reject_reason_required", "Reject reason is required.");
        }

        var company = await dbContext.Companies
            .Include(x => x.VerificationProfile)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (company?.VerificationProfile is null)
        {
            return this.ToNotFoundError("admin.companies.verification.not_found", "Verification profile not found.");
        }

        company.Status = CompanyStatus.Rejected;
        company.VerificationProfile.ReviewStatus = VerificationReviewStatus.Rejected;
        company.VerificationProfile.VerifiedAt = null;
        company.VerificationProfile.VerifiedByUserId = null;
        company.VerificationProfile.RejectReason = request.RejectReason.Trim();
        company.VerificationProfile.MissingDocs = string.Join(",",
            (request.MissingDocuments ?? Array.Empty<VerificationDocumentType>())
            .Distinct()
            .Select(x => x.ToString()));

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:long}/verification/documents/{docId:long}/accept")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AcceptVerificationDocument(long id, long docId, AdminReviewDocumentRequest request, CancellationToken cancellationToken)
    {
        var doc = await dbContext.EmployerVerificationDocuments
            .FirstOrDefaultAsync(x => x.Id == docId && x.CompanyId == id, cancellationToken);
        if (doc is null)
        {
            return this.ToNotFoundError("admin.companies.verification.document_not_found", "Verification document not found.");
        }

        doc.Status = VerificationDocumentStatus.Accepted;
        doc.ModeratorComment = NormalizeNullable(request.ModeratorComment);
        doc.ReviewedByUserId = User.GetUserId();
        doc.ReviewedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:long}/verification/documents/{docId:long}/reject")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RejectVerificationDocument(long id, long docId, AdminReviewDocumentRequest request, CancellationToken cancellationToken)
    {
        var doc = await dbContext.EmployerVerificationDocuments
            .FirstOrDefaultAsync(x => x.Id == docId && x.CompanyId == id, cancellationToken);
        if (doc is null)
        {
            return this.ToNotFoundError("admin.companies.verification.document_not_found", "Verification document not found.");
        }

        doc.Status = VerificationDocumentStatus.Rejected;
        doc.ModeratorComment = NormalizeNullable(request.ModeratorComment);
        doc.ReviewedByUserId = User.GetUserId();
        doc.ReviewedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static VerificationReviewStatus MapStatusToReview(CompanyStatus status)
    {
        return status switch
        {
            CompanyStatus.Verified => VerificationReviewStatus.Approved,
            CompanyStatus.PendingVerification => VerificationReviewStatus.PendingReview,
            CompanyStatus.Rejected => VerificationReviewStatus.Rejected,
            _ => VerificationReviewStatus.Draft
        };
    }

    private static string? NormalizeNullable(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
