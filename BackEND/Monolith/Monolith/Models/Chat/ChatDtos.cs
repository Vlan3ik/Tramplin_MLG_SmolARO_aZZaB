using Monolith.Entities;

namespace Monolith.Models.Chat;

public record ChatListItemDto(
    long Id,
    ChatType Type,
    string Title,
    long[]? ParticipantIds,
    int ParticipantsCount,
    DateTimeOffset CreatedAt,
    ChatMessageDto? LastMessage);

public record ChatMessageDto(
    long Id,
    long ChatId,
    long SenderUserId,
    string SenderFio,
    string? SenderUsername,
    string? SenderAvatarUrl,
    string Text,
    bool IsSystem,
    DateTimeOffset CreatedAt,
    IReadOnlyCollection<ChatMessageAttachmentDto> Attachments);

public record ChatMessageAttachmentDto(
    long Id,
    ChatMessageAttachmentType Type,
    string? Url,
    string? MimeType,
    string? FileName,
    long? SizeBytes,
    VacancyLinkedCardDto? Vacancy,
    OpportunityLinkedCardDto? Opportunity);

public record ChatHistoryPageDto(
    long ChatId,
    IReadOnlyCollection<ChatMessageDto> Messages,
    bool HasMore,
    long? NextBeforeMessageId);

public record CreateDirectChatRequest(long UserId);

public record CreateApplicationRequest(
    long CompanyId,
    long CandidateUserId,
    long VacancyId,
    PlatformRole InitiatorRole);

public record SendChatMessageRequest(string Text);

public record ShareVacancyToUserRequest(
    long TargetUserId,
    long VacancyId,
    string? Text);

public record ShareOpportunityToUserRequest(
    long TargetUserId,
    long OpportunityId,
    string? Text);

public record ShareVacancyToUserResponse(
    long ChatId,
    ChatMessageDto Message);

public record MarkChatReadRequest(long MessageId);

public record ChatDetailDto(
    long Id,
    ChatType Type,
    string Title,
    int ParticipantsCount,
    DateTimeOffset CreatedAt,
    ChatLinkedCardDto? LinkedCard,
    ChatHistoryPageDto History);

public record ChatLinkedCardDto(
    string Type,
    OpportunityLinkedCardDto? Opportunity,
    ApplicationEmployerLinkedCardDto? ApplicationEmployer,
    ApplicationSeekerLinkedCardDto? ApplicationSeeker);

public record OpportunityLinkedCardDto(
    long OpportunityId,
    string Title,
    OpportunityKind Kind,
    WorkFormat Format,
    OpportunityStatus Status,
    DateTimeOffset? EventDate,
    PriceType PriceType,
    decimal? PriceAmount,
    string? PriceCurrencyCode,
    bool IsFavoriteByMe = false,
    int FriendFavoritesCount = 0,
    int FriendApplicationsCount = 0);

public record ApplicationEmployerLinkedCardDto(
    long ApplicationId,
    ApplicationStatus Status,
    DateTimeOffset CreatedAt,
    VacancyLinkedCardDto Vacancy,
    CandidateLinkedCardDto Candidate);

public record ApplicationSeekerLinkedCardDto(
    long ApplicationId,
    ApplicationStatus Status,
    DateTimeOffset CreatedAt,
    VacancyLinkedCardDto Vacancy);

public record VacancyLinkedCardDto(
    long VacancyId,
    string Title,
    VacancyKind Kind,
    WorkFormat Format,
    OpportunityStatus Status,
    SalaryTaxMode SalaryTaxMode,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode,
    bool IsFavoriteByMe = false,
    int FriendFavoritesCount = 0,
    int FriendApplicationsCount = 0);

public record CandidateLinkedCardDto(
    long UserId,
    string Fio,
    string? AvatarUrl,
    string? Headline,
    string? DesiredPosition,
    decimal? SalaryFrom,
    decimal? SalaryTo,
    string? CurrencyCode);
