using Monolith.Entities;

namespace Monolith.Models.Contacts;

public record ContactUserDto(long UserId, string Username, string? AvatarUrl);

public record ContactRequestDto(long Id, ContactUserDto FromUser, ContactUserDto ToUser, ContactRequestStatus Status, DateTimeOffset CreatedAt);
