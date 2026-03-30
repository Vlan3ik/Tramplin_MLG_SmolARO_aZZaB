using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Common;
using Monolith.Models.Employer;
using Monolith.Models.Media;
using Monolith.Services.Common;
using Monolith.Services.Storage;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "employer")]
[Route("employer/company")]
[Produces("application/json")]
public class EmployerCompaniesController(AppDbContext dbContext, IObjectStorageService storageService) : ControllerBase
{
    private const long MaxVerificationDocumentBytes = 50 * 1024 * 1024;

    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<object>> Create(CreateEmployerCompanyRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var alreadyMember = await dbContext.CompanyMembers.AnyAsync(x => x.UserId == userId, cancellationToken);
        if (alreadyMember)
        {
            return this.ToConflictError("companies.membership.exists", "User already belongs to a company.");
        }

        var industryId = await dbContext.EmployerVerificationIndustries
            .OrderBy(x => x.SortOrder)
            .Select(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var company = new Company
        {
            LegalName = request.LegalName.Trim(),
            BrandName = string.IsNullOrWhiteSpace(request.BrandName) ? null : request.BrandName.Trim(),
            LogoUrl = string.IsNullOrWhiteSpace(request.LogoUrl) ? null : request.LogoUrl.Trim(),
            Description = "Company draft",
            BaseCityId = 1,
            Status = CompanyStatus.Draft
        };
        dbContext.Companies.Add(company);
        await dbContext.SaveChangesAsync(cancellationToken);

        dbContext.CompanyMembers.Add(new CompanyMember
        {
            CompanyId = company.Id,
            UserId = userId,
            Role = CompanyMemberRole.Owner
        });

        dbContext.CompanyChatSettings.Add(new CompanyChatSettings
        {
            CompanyId = company.Id,
            AutoGreetingEnabled = false,
            WorkingHoursTimezone = "Europe/Moscow"
        });

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
            ReviewStatus = VerificationReviewStatus.Draft
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetMine), new { }, new { companyId = company.Id, status = company.Status.ToString().ToLowerInvariant() });
    }

    [HttpGet]
    [ProducesResponseType(typeof(EmployerCompanyResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployerCompanyResponse>> GetMine(CancellationToken cancellationToken)
    {
        var membership = await GetMembershipWithCompany(User.GetUserId(), cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company not found for current user.");
        }

        return Ok(ToEmployerCompanyResponse(membership));
    }

    [HttpGet("verification-profile")]
    [ProducesResponseType(typeof(EmployerVerificationProfileDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployerVerificationProfileDetailDto>> GetVerificationProfile(CancellationToken cancellationToken)
    {
        var company = await GetCompanyForManagement(cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company membership not found.");
        }

        var profile = await dbContext.EmployerVerificationProfiles
            .AsNoTracking()
            .Include(x => x.MainIndustry)
            .FirstOrDefaultAsync(x => x.CompanyId == company.Id, cancellationToken);

        if (profile is null)
        {
            return this.ToNotFoundError("companies.verification.not_found", "Verification profile not found.");
        }

        return Ok(ToProfileDetailDto(company, profile));
    }

    [HttpPatch("verification-profile")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateVerificationProfile(UpdateCompanyVerificationProfileRequest request, CancellationToken cancellationToken)
    {
        var company = await GetOwnedCompany(cancellationToken);
        if (company is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.verification.forbidden", "Only company owner can edit verification profile."));
        }

        var industryExists = await dbContext.EmployerVerificationIndustries
            .AnyAsync(x => x.Id == request.MainIndustryId, cancellationToken);
        if (!industryExists)
        {
            return this.ToBadRequestError("companies.verification.invalid_industry", "Industry not found.");
        }

        var cityExists = await dbContext.Cities
            .AnyAsync(x => x.Id == request.BaseCityId, cancellationToken);
        if (!cityExists)
        {
            return this.ToBadRequestError("companies.verification.invalid_city", "City not found.");
        }

        var profile = await dbContext.EmployerVerificationProfiles
            .FirstOrDefaultAsync(x => x.CompanyId == company.Id, cancellationToken);
        if (profile is null)
        {
            return this.ToBadRequestError("companies.verification.not_found", "Verification profile not found.");
        }

        company.LegalName = request.LegalName.Trim();
        company.BrandName = NormalizeNullable(request.BrandName);
        company.BaseCityId = request.BaseCityId;
        company.Description = string.IsNullOrWhiteSpace(request.Description) ? string.Empty : request.Description.Trim();
        company.WebsiteUrl = NormalizeNullable(request.WebsiteUrl);
        company.PublicEmail = NormalizeNullable(request.PublicEmail);
        company.PublicPhone = NormalizeNullable(request.PublicPhone);

        profile.EmployerType = request.EmployerType;
        profile.OgrnOrOgrnip = request.OgrnOrOgrnip.Trim();
        profile.Inn = request.Inn.Trim();
        profile.Kpp = NormalizeNullable(request.Kpp);
        profile.LegalAddress = request.LegalAddress.Trim();
        profile.ActualAddress = NormalizeNullable(request.ActualAddress);
        profile.RepresentativeFullName = request.RepresentativeFullName.Trim();
        profile.RepresentativePosition = NormalizeNullable(request.RepresentativePosition);
        profile.MainIndustryId = request.MainIndustryId;
        profile.TaxOffice = NormalizeNullable(request.TaxOffice);
        profile.WorkEmail = request.WorkEmail.Trim();
        profile.WorkPhone = request.WorkPhone.Trim();
        profile.SiteOrPublicLinks = NormalizeNullable(request.SiteOrPublicLinks);

        if (profile.ReviewStatus == VerificationReviewStatus.Rejected)
        {
            profile.ReviewStatus = VerificationReviewStatus.Draft;
            profile.RejectReason = null;
            profile.MissingDocs = null;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("verification-requirements")]
    [ProducesResponseType(typeof(IReadOnlyCollection<EmployerVerificationRequirementDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyCollection<EmployerVerificationRequirementDto>>> GetVerificationRequirements(
        [FromQuery] EmployerType? employerType,
        CancellationToken cancellationToken)
    {
        var company = await GetCompanyForManagement(cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company membership not found.");
        }

        var profileType = employerType;
        if (profileType is null)
        {
            profileType = await dbContext.EmployerVerificationProfiles
                .Where(x => x.CompanyId == company.Id)
                .Select(x => (EmployerType?)x.EmployerType)
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (profileType is null)
        {
            return this.ToNotFoundError("companies.verification.not_found", "Verification profile not found.");
        }

        var requirements = await dbContext.EmployerVerificationRequiredDocuments
            .AsNoTracking()
            .Where(x => x.EmployerType == profileType)
            .OrderBy(x => x.DocumentType)
            .Select(x => new EmployerVerificationRequirementDto(x.DocumentType, x.IsRequired))
            .ToListAsync(cancellationToken);

        if (requirements.Count == 0 && profileType.HasValue)
        {
            requirements = GetDefaultVerificationRequirements(profileType.Value)
                .Select(x => new EmployerVerificationRequirementDto(x, true))
                .ToList();
        }

        return Ok(requirements);
    }

    [HttpGet("verification-industries")]
    [ProducesResponseType(typeof(IReadOnlyCollection<EmployerVerificationIndustryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyCollection<EmployerVerificationIndustryDto>>> GetVerificationIndustries(CancellationToken cancellationToken)
    {
        var company = await GetCompanyForManagement(cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company membership not found.");
        }

        var industries = await dbContext.EmployerVerificationIndustries
            .AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => new EmployerVerificationIndustryDto(x.Id, x.Slug, x.Name, x.SortOrder))
            .ToListAsync(cancellationToken);

        return Ok(industries);
    }

    [HttpPost("verification-documents")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(EmployerVerificationDocumentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<EmployerVerificationDocumentDto>> UploadVerificationDocument(
        [FromForm] VerificationDocumentType documentType,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        var company = await GetCompanyForManagement(cancellationToken);
        if (company is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.verification.forbidden", "Company membership not found."));
        }

        if (file.Length <= 0)
        {
            return this.ToBadRequestError("companies.verification.file_empty", "File is empty.");
        }

        if (file.Length > MaxVerificationDocumentBytes)
        {
            return this.ToBadRequestError("companies.verification.file_too_large", "File is too large.");
        }

        var normalizedType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType.Trim().ToLowerInvariant();

        await using var stream = file.OpenReadStream();
        var key = await storageService.UploadObjectAsync(
            stream,
            file.Length,
            normalizedType,
            $"verification-docs/{company.Id}/{documentType.ToString().ToLowerInvariant()}",
            ResolveExtension(file.FileName, normalizedType),
            cancellationToken);

        var url = $"/api/employer/company/verification-documents/{key}";
        var userId = User.GetUserId();

        var doc = new EmployerVerificationDocument
        {
            CompanyId = company.Id,
            DocumentType = documentType,
            FileName = Path.GetFileName(file.FileName),
            ContentType = normalizedType,
            SizeBytes = file.Length,
            StorageKey = key,
            AccessUrl = url,
            Status = VerificationDocumentStatus.Uploaded,
            UploadedByUserId = userId
        };

        dbContext.EmployerVerificationDocuments.Add(doc);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToDocumentDto(doc));
    }

    [HttpGet("verification-documents")]
    [ProducesResponseType(typeof(IReadOnlyCollection<EmployerVerificationDocumentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyCollection<EmployerVerificationDocumentDto>>> GetVerificationDocuments(CancellationToken cancellationToken)
    {
        var company = await GetCompanyForManagement(cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company membership not found.");
        }

        var docs = await dbContext.EmployerVerificationDocuments
            .AsNoTracking()
            .Where(x => x.CompanyId == company.Id)
            .OrderBy(x => x.DocumentType)
            .ThenByDescending(x => x.CreatedAt)
            .Select(x => ToDocumentDto(x))
            .ToListAsync(cancellationToken);

        return Ok(docs);
    }

    [HttpDelete("verification-documents/{documentId:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteVerificationDocument(long documentId, CancellationToken cancellationToken)
    {
        var company = await GetOwnedCompany(cancellationToken);
        if (company is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.verification.forbidden", "Only owner can delete verification documents."));
        }

        var doc = await dbContext.EmployerVerificationDocuments
            .FirstOrDefaultAsync(x => x.Id == documentId && x.CompanyId == company.Id, cancellationToken);
        if (doc is null)
        {
            return this.ToNotFoundError("companies.verification.document_not_found", "Verification document not found.");
        }

        dbContext.EmployerVerificationDocuments.Remove(doc);
        await dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            await storageService.DeleteObjectAsync(doc.StorageKey, cancellationToken);
        }
        catch
        {
            // no-op: DB state is source of truth
        }

        return NoContent();
    }

    [Authorize(Roles = "employer,curator,admin")]
    [HttpGet("verification-documents/{**objectKey}")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetVerificationDocumentObject(string objectKey, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(objectKey))
        {
            return this.ToNotFoundError("companies.verification.document_not_found", "Document not found.");
        }

        var key = objectKey.Trim('/');
        var roleNames = User.Claims.Where(c => c.Type == System.Security.Claims.ClaimTypes.Role).Select(c => c.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!roleNames.Contains("curator") && !roleNames.Contains("admin"))
        {
            var userId = User.GetUserId();
            var hasCompanyAccess = await dbContext.CompanyMembers.AnyAsync(
                x => x.UserId == userId && dbContext.EmployerVerificationDocuments.Any(d => d.StorageKey == key && d.CompanyId == x.CompanyId),
                cancellationToken);
            if (!hasCompanyAccess)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.verification.forbidden", "No access to this document."));
            }
        }

        var stored = await storageService.GetObjectAsync(key, cancellationToken);
        if (stored is null)
        {
            return this.ToNotFoundError("companies.verification.document_not_found", "Document not found.");
        }

        return File(stored.Data, stored.ContentType);
    }

    [HttpPost("submit-verification")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SubmitVerification(CancellationToken cancellationToken)
    {
        var company = await GetOwnedCompany(cancellationToken);
        if (company is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.verification.forbidden", "Only company owner can submit verification."));
        }

        var profile = await dbContext.EmployerVerificationProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.CompanyId == company.Id, cancellationToken);
        if (profile is null)
        {
            return this.ToBadRequestError("companies.verification.profile_missing", "Verification profile is missing.");
        }

        var missingFields = GetMissingProfileFields(company, profile);
        if (missingFields.Count > 0)
        {
            return this.ToBadRequestError("companies.verification.required_fields", $"Missing profile fields: {string.Join(", ", missingFields)}.");
        }

        var requiredDocs = await dbContext.EmployerVerificationRequiredDocuments
            .AsNoTracking()
            .Where(x => x.EmployerType == profile.EmployerType && x.IsRequired)
            .Select(x => x.DocumentType)
            .ToArrayAsync(cancellationToken);
        var uploadedDocs = await dbContext.EmployerVerificationDocuments
            .AsNoTracking()
            .Where(x => x.CompanyId == company.Id)
            .Select(x => x.DocumentType)
            .Distinct()
            .ToArrayAsync(cancellationToken);

        var missingDocs = requiredDocs.Except(uploadedDocs).Select(x => x.ToString()).ToArray();
        if (missingDocs.Length > 0)
        {
            return this.ToBadRequestError("companies.verification.required_documents", $"Missing documents: {string.Join(", ", missingDocs)}.");
        }

        var mutableProfile = await dbContext.EmployerVerificationProfiles.FirstAsync(x => x.CompanyId == company.Id, cancellationToken);
        mutableProfile.ReviewStatus = VerificationReviewStatus.PendingReview;
        mutableProfile.SubmittedAt = DateTimeOffset.UtcNow;
        mutableProfile.RejectReason = null;
        mutableProfile.MissingDocs = null;
        mutableProfile.VerifiedAt = null;
        mutableProfile.VerifiedByUserId = null;
        company.Status = CompanyStatus.PendingVerification;

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPatch("chat-settings")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateChatSettings(UpdateCompanyChatSettingsRequest request, CancellationToken cancellationToken)
    {
        var company = await GetCompanyForManagement(cancellationToken);
        if (company is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company membership not found.");
        }

        var settings = await dbContext.CompanyChatSettings.FirstOrDefaultAsync(x => x.CompanyId == company.Id, cancellationToken)
            ?? new CompanyChatSettings { CompanyId = company.Id };

        settings.AutoGreetingEnabled = request.AutoGreetingEnabled;
        settings.AutoGreetingText = NormalizeNullable(request.AutoGreetingText);
        settings.OutsideHoursEnabled = request.OutsideHoursEnabled;
        settings.OutsideHoursText = NormalizeNullable(request.OutsideHoursText);
        settings.WorkingHoursTimezone = string.IsNullOrWhiteSpace(request.WorkingHoursTimezone) ? "Europe/Moscow" : request.WorkingHoursTimezone.Trim();
        settings.WorkingHoursFrom = request.WorkingHoursFrom;
        settings.WorkingHoursTo = request.WorkingHoursTo;

        if (dbContext.Entry(settings).State == EntityState.Detached)
        {
            dbContext.CompanyChatSettings.Add(settings);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("members")]
    [ProducesResponseType(typeof(IReadOnlyCollection<EmployerCompanyMemberDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyCollection<EmployerCompanyMemberDto>>> GetMembers(CancellationToken cancellationToken)
    {
        var membership = await GetMembership(User.GetUserId(), cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("companies.membership.not_found", "Company membership not found.");
        }

        var members = await dbContext.CompanyMembers
            .AsNoTracking()
            .Where(x => x.CompanyId == membership.CompanyId)
            .OrderBy(x => x.Role)
            .ThenBy(x => x.CreatedAt)
            .Select(x => new EmployerCompanyMemberDto(
                x.UserId,
                x.User.Email,
                x.User.Username,
                x.User.Fio,
                x.User.AvatarUrl,
                x.Role,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(members);
    }

    [HttpPost("owner/transfer")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TransferOwner(TransferCompanyOwnerRequest request, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();
        var currentOwnerMembership = await dbContext.CompanyMembers
            .FirstOrDefaultAsync(x => x.UserId == currentUserId && x.Role == CompanyMemberRole.Owner, cancellationToken);
        if (currentOwnerMembership is null)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("companies.owner_transfer.forbidden", "Only current owner can transfer ownership."));
        }

        if (request.NewOwnerUserId == currentUserId)
        {
            return this.ToBadRequestError("companies.owner_transfer.same_user", "New owner must be another user.");
        }

        var newOwnerMembership = await dbContext.CompanyMembers
            .FirstOrDefaultAsync(x => x.CompanyId == currentOwnerMembership.CompanyId && x.UserId == request.NewOwnerUserId, cancellationToken);
        if (newOwnerMembership is null)
        {
            return this.ToNotFoundError("companies.owner_transfer.target_not_found", "Target user is not a company member.");
        }

        if (newOwnerMembership.Role == CompanyMemberRole.Owner)
        {
            return NoContent();
        }

        var owners = await dbContext.CompanyMembers
            .Where(x => x.CompanyId == currentOwnerMembership.CompanyId && x.Role == CompanyMemberRole.Owner)
            .ToListAsync(cancellationToken);
        foreach (var owner in owners)
        {
            owner.Role = CompanyMemberRole.Admin;
        }

        newOwnerMembership.Role = CompanyMemberRole.Owner;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static string? NormalizeNullable(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private static string ResolveExtension(string fileName, string contentType)
    {
        var ext = Path.GetExtension(fileName).Trim('.').ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(ext))
        {
            return ext;
        }

        return contentType switch
        {
            "application/pdf" => "pdf",
            "image/jpeg" => "jpg",
            "image/png" => "png",
            "image/webp" => "webp",
            _ => "bin"
        };
    }

    private static List<string> GetMissingProfileFields(Company company, EmployerVerificationProfile profile)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(company.LegalName)) missing.Add(nameof(company.LegalName));
        if (company.BaseCityId <= 0) missing.Add(nameof(company.BaseCityId));
        if (string.IsNullOrWhiteSpace(company.PublicEmail) && string.IsNullOrWhiteSpace(company.PublicPhone))
        {
            missing.Add($"{nameof(company.PublicEmail)}|{nameof(company.PublicPhone)}");
        }
        if (string.IsNullOrWhiteSpace(profile.OgrnOrOgrnip)) missing.Add(nameof(profile.OgrnOrOgrnip));
        if (string.IsNullOrWhiteSpace(profile.Inn)) missing.Add(nameof(profile.Inn));
        if (string.IsNullOrWhiteSpace(profile.LegalAddress)) missing.Add(nameof(profile.LegalAddress));
        if (string.IsNullOrWhiteSpace(profile.RepresentativeFullName)) missing.Add(nameof(profile.RepresentativeFullName));
        if (profile.MainIndustryId <= 0) missing.Add(nameof(profile.MainIndustryId));
        if (string.IsNullOrWhiteSpace(profile.WorkEmail)) missing.Add(nameof(profile.WorkEmail));
        if (string.IsNullOrWhiteSpace(profile.WorkPhone)) missing.Add(nameof(profile.WorkPhone));
        return missing;
    }

    private async Task<Company?> GetOwnedCompany(CancellationToken cancellationToken)
    {
        var membership = await dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == User.GetUserId() && x.Role == CompanyMemberRole.Owner, cancellationToken);
        if (membership is null)
        {
            return null;
        }

        return await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == membership.CompanyId, cancellationToken);
    }

    private async Task<Company?> GetCompanyForManagement(CancellationToken cancellationToken)
    {
        var membership = await dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.UserId == User.GetUserId() &&
                     (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin || x.Role == CompanyMemberRole.Staff),
                cancellationToken);
        if (membership is null)
        {
            return null;
        }

        return await dbContext.Companies.FirstOrDefaultAsync(x => x.Id == membership.CompanyId, cancellationToken);
    }

    private Task<CompanyMember?> GetMembership(long userId, CancellationToken cancellationToken)
        => dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

    private Task<CompanyMember?> GetMembershipWithCompany(long userId, CancellationToken cancellationToken)
        => dbContext.CompanyMembers
            .AsNoTracking()
            .Include(x => x.Company)
                .ThenInclude(x => x.ChatSettings)
            .Include(x => x.Company)
                .ThenInclude(x => x.Media)
            .Include(x => x.Company)
                .ThenInclude(x => x.VerificationProfile)
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

    private static EmployerVerificationProfileSummaryDto ToSummary(EmployerVerificationProfile? profile)
    {
        if (profile is null)
        {
            return new EmployerVerificationProfileSummaryDto(
                EmployerType.LegalEntity,
                VerificationReviewStatus.Draft,
                null,
                null,
                null);
        }

        return new EmployerVerificationProfileSummaryDto(
            profile.EmployerType,
            profile.ReviewStatus,
            profile.SubmittedAt,
            profile.VerifiedAt,
            profile.RejectReason);
    }

    private static EmployerVerificationProfileDetailDto ToProfileDetailDto(Company company, EmployerVerificationProfile profile)
    {
        var missingDocs = string.IsNullOrWhiteSpace(profile.MissingDocs)
            ? Array.Empty<string>()
            : profile.MissingDocs.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return new EmployerVerificationProfileDetailDto(
            company.LegalName,
            company.BrandName,
            company.BaseCityId,
            company.Description,
            company.WebsiteUrl,
            company.PublicEmail,
            company.PublicPhone,
            profile.EmployerType,
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
            profile.ReviewStatus,
            profile.SubmittedAt,
            profile.VerifiedAt,
            profile.RejectReason,
            missingDocs);
    }

    private static EmployerVerificationDocumentDto ToDocumentDto(EmployerVerificationDocument doc)
        => new(
            doc.Id,
            doc.DocumentType,
            doc.FileName,
            doc.ContentType,
            doc.SizeBytes,
            doc.Status,
            doc.ModeratorComment,
            doc.UploadedByUserId,
            doc.ReviewedByUserId,
            doc.ReviewedAt,
            doc.CreatedAt);

    private static EmployerCompanyResponse ToEmployerCompanyResponse(CompanyMember membership)
    {
        var c = membership.Company;
        var chatSettings = c.ChatSettings;
        return new EmployerCompanyResponse(
            c.Id,
            c.LegalName,
            c.BrandName,
            c.Description,
            c.LogoUrl,
            c.WebsiteUrl,
            c.PublicEmail,
            c.PublicPhone,
            c.Media
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.Id)
                .Select(x => new CompanyMediaItemDto(
                    x.Id,
                    x.MediaType == CompanyMediaType.Video ? "video" : "image",
                    x.Url,
                    x.MimeType,
                    x.SortOrder))
                .ToArray(),
            c.BaseCityId,
            c.Status,
            membership.Role,
            new EmployerCompanyChatSettingsDto(
                chatSettings?.AutoGreetingEnabled == true,
                chatSettings?.AutoGreetingText,
                chatSettings?.OutsideHoursEnabled == true,
                chatSettings?.OutsideHoursText,
                chatSettings?.WorkingHoursTimezone ?? "Europe/Moscow",
                chatSettings?.WorkingHoursFrom,
                chatSettings?.WorkingHoursTo),
            ToSummary(c.VerificationProfile));
    }

    private static IReadOnlyList<VerificationDocumentType> GetDefaultVerificationRequirements(EmployerType employerType)
    {
        return employerType switch
        {
            EmployerType.LegalEntity => new[]
            {
                VerificationDocumentType.EgrulExtract,
                VerificationDocumentType.CompanyBankDetailsCard,
                VerificationDocumentType.RepresentativeAuthorization,
                VerificationDocumentType.OfficePhoto,
                VerificationDocumentType.DomainEmailProof
            },
            EmployerType.IndividualEntrepreneur => new[]
            {
                VerificationDocumentType.EgripExtract,
                VerificationDocumentType.InnRegistrationProof,
                VerificationDocumentType.WorkplacePhoto,
                VerificationDocumentType.DomainEmailProof
            },
            EmployerType.SelfEmployed => new[]
            {
                VerificationDocumentType.NpdRegistrationProof,
                VerificationDocumentType.InnRegistrationProof,
                VerificationDocumentType.IdentityDocument,
                VerificationDocumentType.PortfolioOrWebsiteProof
            },
            EmployerType.RecruitmentAgency => new[]
            {
                VerificationDocumentType.EgrulExtract,
                VerificationDocumentType.CompanyBankDetailsCard,
                VerificationDocumentType.HrActivityProof,
                VerificationDocumentType.ServiceOfferOrContract,
                VerificationDocumentType.BrandMaterials
            },
            EmployerType.PrivateRecruiter => new[]
            {
                VerificationDocumentType.IdentityDocument,
                VerificationDocumentType.InnRegistrationProof,
                VerificationDocumentType.NpdRegistrationProof,
                VerificationDocumentType.RecruitingActivityProof,
                VerificationDocumentType.CustomerAuthorizationProof
            },
            EmployerType.PrivatePerson => new[]
            {
                VerificationDocumentType.IdentityDocument,
                VerificationDocumentType.PersonalHiringConfirmation
            },
            _ => Array.Empty<VerificationDocumentType>()
        };
    }
}
