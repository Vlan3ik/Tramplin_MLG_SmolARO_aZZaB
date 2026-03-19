using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Hubs;
using Monolith.Models.Chat;
using Monolith.Models.Common;
using Monolith.Services.Common;

namespace Monolith.Controllers;

/// <summary>
/// Операции с откликами (application).
/// </summary>
[ApiController]
[Authorize]
[Route("applications")]
[Produces("application/json")]
public class ApplicationsController(AppDbContext dbContext, IHubContext<ChatHub> hubContext) : ControllerBase
{
    /// <summary>
    /// Создает отклик и связанный application-чат.
    /// </summary>
    /// <remarks>
    /// После создания:
    /// 1) формируется запись application;
    /// 2) создается чат типа application;
    /// 3) в чат добавляются кандидат и owner/admin компании;
    /// 4) при включенном авто-приветствии отправляется системное сообщение.
    /// </remarks>
    /// <param name="request">Параметры отклика: компания, кандидат, вакансия (опционально), роль инициатора.</param>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Идентификаторы созданных application и чата.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<object>> Create(CreateApplicationRequest request, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();
        if (request.InitiatorRole is not (PlatformRole.Seeker or PlatformRole.Employer))
        {
            return this.ToBadRequestError("applications.initiator.invalid", "Инициатор отклика должен быть seeker или employer.");
        }

        if (request.InitiatorRole == PlatformRole.Seeker && request.CandidateUserId != currentUserId)
        {
            return this.ToBadRequestError("applications.candidate.invalid", "Для роли seeker кандидат должен совпадать с текущим пользователем.");
        }

        var companyExists = await dbContext.Companies.AnyAsync(x => x.Id == request.CompanyId, cancellationToken);
        if (!companyExists)
        {
            return this.ToNotFoundError("applications.company.not_found", "Компания не найдена.");
        }

        if (request.InitiatorRole == PlatformRole.Employer)
        {
            var canCreateFromCompany = await dbContext.CompanyMembers.AnyAsync(
                x => x.CompanyId == request.CompanyId
                     && x.UserId == currentUserId
                     && (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin || x.Role == CompanyMemberRole.Staff),
                cancellationToken);
            if (!canCreateFromCompany)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("applications.forbidden", "Недостаточно прав для отправки отклика от компании."));
            }
        }

        if (!await dbContext.Users.AnyAsync(x => x.Id == request.CandidateUserId, cancellationToken))
        {
            return this.ToNotFoundError("applications.candidate.not_found", "Кандидат не найден.");
        }

        if (request.OpportunityId is not null &&
            !await dbContext.Opportunities.AnyAsync(x => x.Id == request.OpportunityId && x.CompanyId == request.CompanyId, cancellationToken))
        {
            return this.ToNotFoundError("applications.opportunity.not_found", "Вакансия не найдена.");
        }

        var app = new Application
        {
            CompanyId = request.CompanyId,
            CandidateUserId = request.CandidateUserId,
            OpportunityId = request.OpportunityId,
            InitiatorRole = request.InitiatorRole,
            Status = ApplicationStatus.Open
        };
        dbContext.Applications.Add(app);
        await dbContext.SaveChangesAsync(cancellationToken);

        var chat = new Chat
        {
            Type = ChatType.Application,
            ApplicationId = app.Id
        };
        dbContext.Chats.Add(chat);
        await dbContext.SaveChangesAsync(cancellationToken);

        var participants = new List<ChatParticipant>
        {
            new() { ChatId = chat.Id, UserId = request.CandidateUserId }
        };
        var companyMembers = await dbContext.CompanyMembers
            .Where(x => x.CompanyId == request.CompanyId && (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin))
            .Select(x => x.UserId)
            .ToListAsync(cancellationToken);

        foreach (var userId in companyMembers.Distinct())
        {
            if (participants.All(x => x.UserId != userId))
            {
                participants.Add(new ChatParticipant { ChatId = chat.Id, UserId = userId });
            }
        }
        dbContext.ChatParticipants.AddRange(participants);

        var settings = await dbContext.CompanyChatSettings.FirstOrDefaultAsync(x => x.CompanyId == request.CompanyId, cancellationToken);
        ChatMessage? greeting = null;
        if (settings?.AutoGreetingEnabled == true && !string.IsNullOrWhiteSpace(settings.AutoGreetingText))
        {
            var sender = participants.FirstOrDefault(x => x.UserId != request.CandidateUserId)?.UserId ?? request.CandidateUserId;
            greeting = new ChatMessage
            {
                ChatId = chat.Id,
                SenderUserId = sender,
                Text = settings.AutoGreetingText.Trim(),
                IsSystem = true
            };
            dbContext.ChatMessages.Add(greeting);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        if (greeting is not null)
        {
            await hubContext.Clients.Group(ChatHub.GroupName(chat.Id)).SendAsync("new", new ChatMessageDto(
                greeting.Id,
                greeting.ChatId,
                greeting.SenderUserId,
                greeting.Text,
                greeting.IsSystem,
                greeting.CreatedAt), cancellationToken);
        }

        return Created(string.Empty, new { applicationId = app.Id, chatId = chat.Id });
    }
}
