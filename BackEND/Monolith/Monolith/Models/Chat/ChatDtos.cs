using Monolith.Entities;

namespace Monolith.Models.Chat;

/// <summary>
/// Карточка чата в списке.
/// </summary>
/// <param name="Id">Идентификатор чата.</param>
/// <param name="Type">Тип чата (direct/application).</param>
/// <param name="ParticipantIds">Идентификаторы участников чата.</param>
/// <param name="CreatedAt">Дата создания чата.</param>
/// <param name="LastMessage">Последнее сообщение (если есть).</param>
public record ChatListItemDto(long Id, ChatType Type, long[] ParticipantIds, DateTimeOffset CreatedAt, ChatMessageDto? LastMessage);

/// <summary>
/// Сообщение чата.
/// </summary>
/// <param name="Id">Идентификатор сообщения.</param>
/// <param name="ChatId">Идентификатор чата.</param>
/// <param name="SenderUserId">Идентификатор отправителя.</param>
/// <param name="Text">Текст сообщения.</param>
/// <param name="IsSystem">Признак системного сообщения.</param>
/// <param name="CreatedAt">Дата отправки.</param>
public record ChatMessageDto(long Id, long ChatId, long SenderUserId, string Text, bool IsSystem, DateTimeOffset CreatedAt);

/// <summary>
/// Запрос на создание direct-чата.
/// </summary>
/// <param name="UserId">Идентификатор второго участника.</param>
public record CreateDirectChatRequest(long UserId);

/// <summary>
/// Запрос на создание отклика (application).
/// </summary>
/// <param name="CompanyId">Идентификатор компании.</param>
/// <param name="CandidateUserId">Идентификатор кандидата.</param>
/// <param name="OpportunityId">Идентификатор вакансии (опционально).</param>
/// <param name="InitiatorRole">Роль инициатора отклика (seeker/employer).</param>
public record CreateApplicationRequest(long CompanyId, long CandidateUserId, long? OpportunityId, PlatformRole InitiatorRole);

/// <summary>
/// Запрос на отправку сообщения в чат.
/// </summary>
/// <param name="Text">Текст сообщения.</param>
public record SendChatMessageRequest(string Text);

/// <summary>
/// Запрос на отметку сообщения как прочитанного.
/// </summary>
/// <param name="MessageId">Идентификатор сообщения.</param>
public record MarkChatReadRequest(long MessageId);
