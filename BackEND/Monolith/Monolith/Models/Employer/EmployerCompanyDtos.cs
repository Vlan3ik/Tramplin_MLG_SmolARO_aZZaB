using Monolith.Entities;
using Monolith.Models.Media;

namespace Monolith.Models.Employer;

public record CreateEmployerCompanyRequest(string LegalName, string? BrandName, string? LogoUrl);

public record UpdateCompanyVerificationProfileRequest(
    EmployerType EmployerType,
    string OgrnOrOgrnip,
    string Inn,
    string? Kpp,
    string LegalAddress,
    string? ActualAddress,
    string RepresentativeFullName,
    string? RepresentativePosition,
    long MainIndustryId,
    string? TaxOffice,
    string WorkEmail,
    string WorkPhone,
    string? SiteOrPublicLinks);

public record EmployerVerificationIndustryDto(long Id, string Slug, string Name, int SortOrder);

public record EmployerVerificationRequirementDto(VerificationDocumentType DocumentType, bool IsRequired);

public record EmployerVerificationProfileSummaryDto(
    EmployerType EmployerType,
    VerificationReviewStatus ReviewStatus,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? VerifiedAt,
    string? RejectReason);

public record EmployerVerificationProfileDetailDto(
    EmployerType EmployerType,
    string OgrnOrOgrnip,
    string Inn,
    string? Kpp,
    string LegalAddress,
    string? ActualAddress,
    string RepresentativeFullName,
    string? RepresentativePosition,
    long MainIndustryId,
    string MainIndustryName,
    string? TaxOffice,
    string WorkEmail,
    string WorkPhone,
    string? SiteOrPublicLinks,
    VerificationReviewStatus ReviewStatus,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? VerifiedAt,
    string? RejectReason,
    string[] MissingDocs);

public record EmployerVerificationDocumentDto(
    long Id,
    VerificationDocumentType DocumentType,
    string FileName,
    string ContentType,
    long SizeBytes,
    VerificationDocumentStatus Status,
    string? ModeratorComment,
    long UploadedByUserId,
    long? ReviewedByUserId,
    DateTimeOffset? ReviewedAt,
    DateTimeOffset CreatedAt);

public record CompanyInviteCreatedResponse(string Token, string InviteLink, DateTimeOffset ExpiresAt, CompanyMemberRole Role);
public record CreateCompanyInviteRequest(int ExpiresInDays = 7);

public record UpdateCompanyChatSettingsRequest(
    bool AutoGreetingEnabled,
    string? AutoGreetingText,
    bool OutsideHoursEnabled,
    string? OutsideHoursText,
    string WorkingHoursTimezone,
    TimeSpan? WorkingHoursFrom,
    TimeSpan? WorkingHoursTo);

public record EmployerCompanyResponse(
    long Id,
    string LegalName,
    string? BrandName,
    string Description,
    string? LogoUrl,
    string? WebsiteUrl,
    string? PublicEmail,
    string? PublicPhone,
    IReadOnlyCollection<CompanyMediaItemDto> Media,
    long BaseCityId,
    CompanyStatus Status,
    CompanyMemberRole MembershipRole,
    EmployerCompanyChatSettingsDto ChatSettings,
    EmployerVerificationProfileSummaryDto Verification);

public record EmployerCompanyChatSettingsDto(
    bool AutoGreetingEnabled,
    string? AutoGreetingText,
    bool OutsideHoursEnabled,
    string? OutsideHoursText,
    string WorkingHoursTimezone,
    TimeSpan? WorkingHoursFrom,
    TimeSpan? WorkingHoursTo);

public record EmployerCompanyMemberDto(
    long UserId,
    string Email,
    string Username,
    string Fio,
    string? AvatarUrl,
    CompanyMemberRole Role,
    DateTimeOffset JoinedAt);

public record TransferCompanyOwnerRequest(long NewOwnerUserId);

public record VerificationDocumentReviewRequest(string? ModeratorComment);
public record RejectVerificationRequest(string RejectReason, IReadOnlyCollection<VerificationDocumentType>? MissingDocuments);
