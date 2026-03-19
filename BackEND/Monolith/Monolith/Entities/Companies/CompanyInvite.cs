namespace Monolith.Entities;

public class CompanyInvite
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public long InvitedByUserId { get; set; }
    public CompanyMemberRole Role { get; set; } = CompanyMemberRole.Staff;
    public string Token { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Company Company { get; set; } = null!;
    public User InvitedByUser { get; set; } = null!;
}
