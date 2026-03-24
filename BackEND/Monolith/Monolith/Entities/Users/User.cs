namespace Monolith.Entities;

public class User
{
    public long Id { get; set; }
    public string? VkUserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? ProfileBannerUrl { get; set; }
    public AccountStatus Status { get; set; } = AccountStatus.Active;
    public DateTimeOffset? LastLoginAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public List<UserRole> Roles { get; set; } = new();
    public CandidateProfile? CandidateProfile { get; set; }
    public List<RefreshToken> RefreshTokens { get; set; } = new();
    public List<CompanyMember> CompanyMemberships { get; set; } = new();
    public List<CompanyInvite> SentCompanyInvites { get; set; } = new();
    public List<Application> CandidateApplications { get; set; } = new();
    public List<OpportunityParticipant> OpportunityParticipations { get; set; } = new();
    public List<ChatParticipant> ChatParticipants { get; set; } = new();
    public List<ChatMessage> ChatMessages { get; set; } = new();
    public List<ChatMessageRead> ChatReads { get; set; } = new();
    public List<ContactRequest> OutgoingContactRequests { get; set; } = new();
    public List<ContactRequest> IncomingContactRequests { get; set; } = new();
    public List<UserContact> Contacts { get; set; } = new();
    public List<UserContact> ContactOfUsers { get; set; } = new();
    public List<UserPublicLink> PublicLinks { get; set; } = new();
    public List<UserSubscription> FollowingSubscriptions { get; set; } = new();
    public List<UserSubscription> FollowerSubscriptions { get; set; } = new();
}
