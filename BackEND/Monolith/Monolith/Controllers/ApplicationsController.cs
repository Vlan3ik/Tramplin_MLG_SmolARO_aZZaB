using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Hubs;
using Monolith.Models.Applications;
using Monolith.Models.Chat;
using Monolith.Models.Common;
using Monolith.Services.Chats;
using Monolith.Services.Common;

namespace Monolith.Controllers;

[ApiController]
[Authorize]
[Route("applications")]
[Produces("application/json")]
public class ApplicationsController(AppDbContext dbContext, IHubContext<ChatHub> hubContext, IChatCacheService chatCache) : ControllerBase
{
    [HttpGet("me")]
    [ProducesResponseType(typeof(IReadOnlyCollection<ApplicationListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<ApplicationListItemDto>>> GetMine(CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();

        var applications = await dbContext.Applications
            .AsNoTracking()
            .Include(x => x.Vacancy)
                .ThenInclude(x => x.Company)
            .Include(x => x.Vacancy)
                .ThenInclude(x => x.City)
            .Include(x => x.Vacancy)
                .ThenInclude(x => x.Location)
                    .ThenInclude(x => x!.City)
            .Where(x => x.CandidateUserId == currentUserId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var rows = applications
            .Select(x => new ApplicationListItemDto(
                x.Id,
                x.VacancyId,
                x.Vacancy.Title,
                x.Vacancy.Company.BrandName ?? x.Vacancy.Company.LegalName,
                BuildLocationLabel(x.Vacancy.City, x.Vacancy.Location),
                x.Status,
                x.CreatedAt,
                x.UpdatedAt))
            .ToArray();

        return Ok(rows);
    }

    /// <summary>
    /// Создает отклик на вакансию и связанный чат по отклику.
    /// </summary>
    /// <remarks>
    /// Инициатор может быть соискателем или работодателем.
    /// При создании отклика в чат добавляются кандидат и владельцы/администраторы компании.
    /// </remarks>
    /// <param name="request">Данные отклика: компания, вакансия, кандидат и роль инициатора.</param>
    /// <param name="cancellationToken">Токен отмены операции записи.</param>
    /// <returns>Идентификаторы созданных отклика и чата.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<object>> Create(CreateApplicationRequest request, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetUserId();
        if (request.InitiatorRole is not (PlatformRole.Seeker or PlatformRole.Employer))
        {
            return this.ToBadRequestError("applications.initiator.invalid", "Initiator must be seeker or employer.");
        }

        if (request.InitiatorRole == PlatformRole.Seeker && request.CandidateUserId != currentUserId)
        {
            return this.ToBadRequestError("applications.candidate.invalid", "Candidate must match current user.");
        }

        var companyExists = await dbContext.Companies.AnyAsync(x => x.Id == request.CompanyId, cancellationToken);
        if (!companyExists)
        {
            return this.ToNotFoundError("applications.company.not_found", "Company not found.");
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
                return StatusCode(StatusCodes.Status403Forbidden, new ErrorResponse("applications.forbidden", "Insufficient permissions for company."));
            }
        }

        if (!await dbContext.Users.AnyAsync(x => x.Id == request.CandidateUserId, cancellationToken))
        {
            return this.ToNotFoundError("applications.candidate.not_found", "Candidate not found.");
        }

        var vacancy = await dbContext.Vacancies
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.VacancyId && x.CompanyId == request.CompanyId, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("applications.vacancy.not_found", "Vacancy not found.");
        }

        var app = new Application
        {
            CompanyId = request.CompanyId,
            CandidateUserId = request.CandidateUserId,
            VacancyId = request.VacancyId,
            InitiatorRole = request.InitiatorRole,
            Status = ApplicationStatus.New
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
        if (request.InitiatorRole == PlatformRole.Employer)
        {
            var sender = participants.FirstOrDefault(x => x.UserId != request.CandidateUserId)?.UserId ?? request.CandidateUserId;
            greeting = new ChatMessage
            {
                ChatId = chat.Id,
                SenderUserId = sender,
                Text = $"Компания приглашает вас на вакансию \"{vacancy.Title}\".",
                IsSystem = true
            };
            dbContext.ChatMessages.Add(greeting);
        }
        else if (settings?.AutoGreetingEnabled == true && !string.IsNullOrWhiteSpace(settings.AutoGreetingText))
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

        ChatMessageAttachment? inviteCardAttachment = null;
        if (greeting is not null && request.InitiatorRole == PlatformRole.Employer)
        {
            inviteCardAttachment = new ChatMessageAttachment
            {
                MessageId = greeting.Id,
                Type = ChatMessageAttachmentType.VacancyCard,
                VacancyId = vacancy.Id
            };
            dbContext.ChatMessageAttachments.Add(inviteCardAttachment);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        foreach (var participantId in participants.Select(x => x.UserId).Distinct())
        {
            await chatCache.InvalidateUserListAsync(participantId, cancellationToken);
        }

        await chatCache.InvalidateChatHistoryAsync(chat.Id, cancellationToken);

        if (greeting is not null)
        {
            var sender = await dbContext.Users
                .AsNoTracking()
                .Where(x => x.Id == greeting.SenderUserId)
                .Select(x => new { x.DisplayName, x.Username, x.AvatarUrl })
                .FirstOrDefaultAsync(cancellationToken);

            await hubContext.Clients.Group(ChatHub.GroupName(chat.Id)).SendAsync("new", new ChatMessageDto(
                greeting.Id,
                greeting.ChatId,
                greeting.SenderUserId,
                sender?.DisplayName ?? "System",
                sender?.Username,
                sender?.AvatarUrl,
                greeting.Text,
                greeting.IsSystem,
                greeting.CreatedAt,
                inviteCardAttachment is null
                    ? []
                    : [new ChatMessageAttachmentDto(
                        inviteCardAttachment.Id,
                        ChatMessageAttachmentType.VacancyCard,
                        null,
                        null,
                        null,
                        null,
                        new VacancyLinkedCardDto(
                            vacancy.Id,
                            vacancy.Title,
                            vacancy.Kind,
                            vacancy.Format,
                            vacancy.Status,
                            vacancy.SalaryTaxMode,
                            vacancy.SalaryFrom,
                            vacancy.SalaryTo,
                            vacancy.CurrencyCode),
                        null)]), cancellationToken);
        }

        return Created(string.Empty, new { applicationId = app.Id, chatId = chat.Id });
    }

    private static string BuildLocationLabel(City? city, Location? location)
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(city?.CityName))
        {
            parts.Add(city!.CityName);
        }

        if (location is not null)
        {
            var streetParts = new List<string>();

            if (!string.IsNullOrWhiteSpace(location.StreetName))
            {
                streetParts.Add(location.StreetName!);
            }

            if (!string.IsNullOrWhiteSpace(location.HouseNumber))
            {
                streetParts.Add(location.HouseNumber!);
            }

            if (streetParts.Count > 0)
            {
                parts.Add(string.Join(" ", streetParts));
            }
        }

        return string.Join(", ", parts);
    }
}
