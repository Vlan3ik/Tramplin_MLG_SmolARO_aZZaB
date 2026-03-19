namespace Monolith.Entities;

public class ContactRequest
{
    public long Id { get; set; }
    public long FromUserId { get; set; }
    public long ToUserId { get; set; }
    public ContactRequestStatus Status { get; set; } = ContactRequestStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public User FromUser { get; set; } = null!;
    public User ToUser { get; set; } = null!;
}
