namespace Monolith.Entities;

public class EmployerVerificationRequiredDocument
{
    public long Id { get; set; }
    public EmployerType EmployerType { get; set; }
    public VerificationDocumentType DocumentType { get; set; }
    public bool IsRequired { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
}
