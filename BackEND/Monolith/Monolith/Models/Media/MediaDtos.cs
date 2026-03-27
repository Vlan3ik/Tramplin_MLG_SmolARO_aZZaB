namespace Monolith.Models.Media;

public record UploadMediaResponse(string Url);
public record CompanyMediaItemDto(long Id, string Type, string Url, string MimeType, int SortOrder);
