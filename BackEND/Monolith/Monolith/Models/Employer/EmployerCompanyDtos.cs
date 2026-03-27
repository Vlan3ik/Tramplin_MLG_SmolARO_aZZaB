using Monolith.Models.Media;
using Monolith.Entities;

namespace Monolith.Models.Employer;

public record CreateEmployerCompanyRequest(string LegalName, string? BrandName, string? LogoUrl);

public record UpdateCompanyVerificationRequest(
    string LegalName,
    string? BrandName,
    CompanyLegalType LegalType,
    string TaxId,
    string RegistrationNumber,
    string Industry,
    string Description,
    long BaseCityId,
    string? WebsiteUrl,
    string? PublicEmail,
    string? PublicPhone);

public record CreateCompanyInviteRequest(int ExpiresInDays = 7);

public record CompanyInviteCreatedResponse(string Token, string InviteLink, DateTimeOffset ExpiresAt, CompanyMemberRole Role);

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
    CompanyLegalType LegalType,
    string TaxId,
    string RegistrationNumber,
    string Industry,
    string Description,
    string? LogoUrl,
    string? WebsiteUrl,
    string? PublicEmail,
    string? PublicPhone,
    IReadOnlyCollection<CompanyMediaItemDto> Media,
    long BaseCityId,
    CompanyStatus Status,
    CompanyMemberRole MembershipRole,
    EmployerCompanyChatSettingsDto ChatSettings);

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
    string DisplayName,
    string? AvatarUrl,
    CompanyMemberRole Role,
    DateTimeOffset JoinedAt);

public record TransferCompanyOwnerRequest(long NewOwnerUserId);
