namespace Monolith.Entities;

public class EmployerVerificationDocument
{
    public long Id { get; set; }
    public long CompanyId { get; set; }
    public VerificationDocumentType DocumentType { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string AccessUrl { get; set; } = string.Empty;
    public VerificationDocumentStatus Status { get; set; } = VerificationDocumentStatus.Uploaded;
    public string? ModeratorComment { get; set; }
    public long UploadedByUserId { get; set; }
    public long? ReviewedByUserId { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public EmployerVerificationProfile Profile { get; set; } = null!;
    public User UploadedByUser { get; set; } = null!;
    public User? ReviewedByUser { get; set; }
}
