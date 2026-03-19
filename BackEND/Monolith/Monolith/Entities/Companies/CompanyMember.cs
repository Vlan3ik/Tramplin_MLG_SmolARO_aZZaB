namespace Monolith.Entities;

public class CompanyMember
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public long UserId { get; set; }
    public CompanyMemberRole Role { get; set; } = CompanyMemberRole.Staff;
    public DateTimeOffset CreatedAt { get; set; }

    public Company Company { get; set; } = null!;
    public User User { get; set; } = null!;
}
