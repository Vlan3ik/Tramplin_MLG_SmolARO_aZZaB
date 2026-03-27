using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Hubs;
using Monolith.Models.Chat;
using Monolith.Models.Common;
using Monolith.Models.Employer;
using Monolith.Models.Opportunities;
using Monolith.Services.Chats;
using Monolith.Services.Common;
using Monolith.Services.Geo;

namespace Monolith.Controllers;

[ApiController]
[Authorize(Roles = "employer")]
[Route("employer/vacancies")]
[Produces("application/json")]
public class EmployerVacanciesController(
    AppDbContext dbContext,
    IEmployerLocationService employerLocationService,
    IHubContext<ChatHub> hubContext,
    IChatCacheService chatCache,
    IConfiguration configuration) : ControllerBase
{
    /// <summary>
    /// Возвращает вакансии компании работодателя с фильтрами и пагинацией.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<EmployerVacancyListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PagedResponse<EmployerVacancyListItemDto>>> GetList([FromQuery] EmployerVacancyListQuery query, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var page = query.Page <= 0 ? 1 : query.Page;
        var pageSize = query.PageSize <= 0 ? 20 : Math.Min(query.PageSize, 100);
        var last24 = DateTimeOffset.UtcNow.AddHours(-24);

        var vacancies = dbContext.Vacancies
            .AsNoTracking()
            .Include(x => x.VacancyTags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.Applications)
            .Where(x => x.CompanyId == membership.CompanyId);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            vacancies = vacancies.Where(x =>
                x.Title.ToLower().Contains(term) ||
                x.ShortDescription.ToLower().Contains(term) ||
                x.FullDescription.ToLower().Contains(term));
        }

        if (query.Statuses is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.Statuses.Contains(x.Status));
        }

        if (query.Kinds is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.Kinds.Contains(x.Kind));
        }

        if (query.Formats is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.Formats.Contains(x.Format));
        }

        if (query.SalaryTaxModes is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => query.SalaryTaxModes.Contains(x.SalaryTaxMode));
        }

        if (query.SalaryFrom is not null)
        {
            vacancies = vacancies.Where(x => x.SalaryTo == null || x.SalaryTo >= query.SalaryFrom);
        }

        if (query.SalaryTo is not null)
        {
            vacancies = vacancies.Where(x => x.SalaryFrom == null || x.SalaryFrom <= query.SalaryTo);
        }

        if (query.TagIds is { Length: > 0 })
        {
            vacancies = vacancies.Where(x => x.VacancyTags.Any(t => query.TagIds.Contains(t.TagId)));
        }

        var total = await vacancies.CountAsync(cancellationToken);
        var rows = await vacancies
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new EmployerVacancyListItemDto(
                x.Id,
                x.Title,
                x.Kind,
                x.Format,
                x.Status,
                x.SalaryFrom,
                x.SalaryTo,
                x.CurrencyCode,
                x.SalaryTaxMode,
                x.PublishAt,
                x.ApplicationDeadline,
                x.Applications.Count,
                x.Applications.Count(a => a.CreatedAt >= last24),
                x.VacancyTags.Select(t => t.Tag.Name).ToArray()))
            .ToListAsync(cancellationToken);

        return Ok(new PagedResponse<EmployerVacancyListItemDto>(rows, total, page, pageSize));
    }

    /// <summary>
    /// Возвращает детальную карточку вакансии с агрегированной статистикой по откликам.
    /// </summary>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(EmployerVacancyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployerVacancyDetailDto>> GetById(long id, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var vacancy = await dbContext.Vacancies
            .AsNoTracking()
            .Include(x => x.City)
            .Include(x => x.Location)
                .ThenInclude(x => x!.City)
            .Include(x => x.VacancyTags)
                .ThenInclude(x => x.Tag)
            .Include(x => x.Applications)
                .ThenInclude(x => x.CandidateUser)
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);

        if (vacancy is null)
        {
            return this.ToNotFoundError("employer.vacancies.not_found", "Vacancy not found.");
        }

        var last24 = DateTimeOffset.UtcNow.AddHours(-24);
        var stats = new EmployerVacancyStatsDto(
            vacancy.Applications.Count,
            vacancy.Applications.Count(a => a.CreatedAt >= last24),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.New),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.InReview),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.Interview),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.Offer),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.Hired),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.Rejected),
            vacancy.Applications.Count(a => a.Status == ApplicationStatus.Canceled));

        var locationCity = vacancy.City ?? vacancy.Location?.City;
        var locationLatitude = vacancy.Location is not null ? (decimal?)vacancy.Location.GeoPoint.Y : locationCity?.Latitude;
        var locationLongitude = vacancy.Location is not null ? (decimal?)vacancy.Location.GeoPoint.X : locationCity?.Longitude;
        var location = locationCity is null
            ? null
            : new LocationDto(
                locationCity.Id,
                locationCity.CityName,
                locationLatitude,
                locationLongitude,
                vacancy.Location?.StreetName,
                vacancy.Location?.HouseNumber);

        var recent = vacancy.Applications
            .OrderByDescending(x => x.CreatedAt)
            .Take(10)
            .Select(x => new EmployerVacancyRecentApplicationDto(
                x.Id,
                x.CandidateUserId,
                x.CandidateUser.Fio,
                x.CandidateUser.AvatarUrl,
                x.Status,
                x.CreatedAt))
            .ToArray();

        var dto = new EmployerVacancyDetailDto(
            vacancy.Id,
            vacancy.Title,
            vacancy.ShortDescription,
            vacancy.FullDescription,
            vacancy.Kind,
            vacancy.Format,
            vacancy.Status,
            vacancy.PublishAt,
            vacancy.ApplicationDeadline,
            vacancy.SalaryFrom,
            vacancy.SalaryTo,
            vacancy.CurrencyCode,
            vacancy.SalaryTaxMode,
            location,
            stats,
            recent,
            vacancy.VacancyTags.Select(t => t.Tag.Name).ToArray());

        return Ok(dto);
    }

    /// <summary>
    /// Создает вакансию компании работодателя.
    /// </summary>
    /// <remarks>
    /// При передаче mapPoint сервер выполняет reverse geocode и сам заполняет CityId/LocationId.
    /// </remarks>
    [HttpPost]
    [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<object>> Create(EmployerVacancyUpsertRequest request, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var validationError = ValidateVacancy(request);
        if (validationError is not null)
        {
            return this.ToBadRequestError("employer.vacancies.invalid", validationError);
        }

        var resolvedLocation = await ResolveLocationAsync(request, cancellationToken);
        if (resolvedLocation is null)
        {
            return this.ToBadRequestError("employer.vacancies.location_unresolved", "Unable to resolve location from mapPoint/address.");
        }

        var resolvedStatus = await ResolvePublicationStatusAsync(membership.CompanyId, request.Status, cancellationToken);
        var vacancy = new Vacancy
        {
            CompanyId = membership.CompanyId,
            CreatedByUserId = membership.UserId,
            Title = request.Title.Trim(),
            ShortDescription = request.ShortDescription.Trim(),
            FullDescription = request.FullDescription.Trim(),
            Kind = request.Kind,
            Format = request.Format,
            Status = resolvedStatus,
            CityId = resolvedLocation.CityId,
            LocationId = resolvedLocation.LocationId,
            SalaryFrom = request.SalaryFrom,
            SalaryTo = request.SalaryTo,
            CurrencyCode = request.CurrencyCode?.Trim().ToUpperInvariant(),
            SalaryTaxMode = request.SalaryTaxMode,
            PublishAt = request.PublishAt,
            ApplicationDeadline = request.ApplicationDeadline
        };

        dbContext.Vacancies.Add(vacancy);
        await dbContext.SaveChangesAsync(cancellationToken);
        await ReplaceVacancyTags(vacancy.Id, request.TagIds, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = vacancy.Id }, new { vacancyId = vacancy.Id });
    }

    /// <summary>
    /// Обновляет вакансию компании работодателя.
    /// </summary>
    /// <remarks>
    /// При передаче mapPoint сервер выполняет reverse geocode и сам заполняет CityId/LocationId.
    /// </remarks>
    [HttpPatch("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(long id, EmployerVacancyUpsertRequest request, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var validationError = ValidateVacancy(request);
        if (validationError is not null)
        {
            return this.ToBadRequestError("employer.vacancies.invalid", validationError);
        }

        var vacancy = await dbContext.Vacancies.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("employer.vacancies.not_found", "Vacancy not found.");
        }

        var resolvedLocation = await ResolveLocationAsync(request, cancellationToken);
        if (resolvedLocation is null)
        {
            return this.ToBadRequestError("employer.vacancies.location_unresolved", "Unable to resolve location from mapPoint/address.");
        }

        var resolvedStatus = await ResolvePublicationStatusAsync(membership.CompanyId, request.Status, cancellationToken);

        vacancy.Title = request.Title.Trim();
        vacancy.ShortDescription = request.ShortDescription.Trim();
        vacancy.FullDescription = request.FullDescription.Trim();
        vacancy.Kind = request.Kind;
        vacancy.Format = request.Format;
        vacancy.Status = resolvedStatus;
        vacancy.CityId = resolvedLocation.CityId;
        vacancy.LocationId = resolvedLocation.LocationId;
        vacancy.SalaryFrom = request.SalaryFrom;
        vacancy.SalaryTo = request.SalaryTo;
        vacancy.CurrencyCode = request.CurrencyCode?.Trim().ToUpperInvariant();
        vacancy.SalaryTaxMode = request.SalaryTaxMode;
        vacancy.PublishAt = request.PublishAt;
        vacancy.ApplicationDeadline = request.ApplicationDeadline;

        await dbContext.SaveChangesAsync(cancellationToken);
        await ReplaceVacancyTags(vacancy.Id, request.TagIds, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Отправляет кандидату приглашение на вакансию в личный чат.
    /// </summary>
    /// <remarks>
    /// Метод не создает отклик (application), а только создает/переиспользует direct-чат и отправляет системное сообщение.
    /// </remarks>
    [HttpPost("{id:long}/invite")]
    [ProducesResponseType(typeof(EmployerVacancyInviteResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployerVacancyInviteResponse>> Invite(
        long id,
        EmployerVacancyInviteRequest request,
        CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        if (request.CandidateUserId == membership.UserId)
        {
            return this.ToBadRequestError("employer.vacancies.invite.self", "Нельзя отправить приглашение самому себе.");
        }

        var vacancy = await dbContext.Vacancies
            .AsNoTracking()
            .Include(x => x.Company)
            .FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("employer.vacancies.not_found", "Vacancy not found.");
        }

        var candidateExists = await dbContext.Users.AnyAsync(x => x.Id == request.CandidateUserId, cancellationToken);
        if (!candidateExists)
        {
            return this.ToNotFoundError("employer.vacancies.invite.candidate_not_found", "Кандидат не найден.");
        }

        var directChatId = await dbContext.Chats
            .Where(x => x.Type == ChatType.Direct)
            .Where(x => x.Participants.Any(p => p.UserId == membership.UserId) &&
                        x.Participants.Any(p => p.UserId == request.CandidateUserId))
            .Select(x => (long?)x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (directChatId is null)
        {
            var chat = new Chat { Type = ChatType.Direct };
            dbContext.Chats.Add(chat);
            await dbContext.SaveChangesAsync(cancellationToken);

            dbContext.ChatParticipants.AddRange(
                new ChatParticipant { ChatId = chat.Id, UserId = membership.UserId },
                new ChatParticipant { ChatId = chat.Id, UserId = request.CandidateUserId });

            await dbContext.SaveChangesAsync(cancellationToken);
            directChatId = chat.Id;
        }

        var vacancyUrl = BuildVacancyUrl(vacancy.Id);
        var companyName = vacancy.Company.BrandName ?? vacancy.Company.LegalName;
        var message = new ChatMessage
        {
            ChatId = directChatId.Value,
            SenderUserId = membership.UserId,
            Text = $"Компания {companyName} пригласила вас на вакансию \"{vacancy.Title}\". Если интересно, перейдите в вакансию: {vacancyUrl} и откликнитесь.",
            IsSystem = true
        };
        dbContext.ChatMessages.Add(message);
        await dbContext.SaveChangesAsync(cancellationToken);

        dbContext.ChatMessageAttachments.Add(new ChatMessageAttachment
        {
            MessageId = message.Id,
            Type = ChatMessageAttachmentType.VacancyCard,
            VacancyId = vacancy.Id
        });
        await dbContext.SaveChangesAsync(cancellationToken);

        await chatCache.InvalidateUserListAsync(membership.UserId, cancellationToken);
        await chatCache.InvalidateUserListAsync(request.CandidateUserId, cancellationToken);
        await chatCache.InvalidateChatHistoryAsync(directChatId.Value, cancellationToken);

        var sender = await dbContext.Users
            .AsNoTracking()
            .Where(x => x.Id == membership.UserId)
            .Select(x => new { x.Fio, x.Username, x.AvatarUrl })
            .FirstAsync(cancellationToken);

        await hubContext.Clients.Group(ChatHub.GroupName(directChatId.Value)).SendAsync(
            "new",
            new ChatMessageDto(
                message.Id,
                message.ChatId,
                message.SenderUserId,
                sender.Fio,
                sender.Username,
                sender.AvatarUrl,
                message.Text,
                message.IsSystem,
                message.CreatedAt,
                [new ChatMessageAttachmentDto(
                    0,
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
                    null)]),
            cancellationToken);

        return Created(string.Empty, new EmployerVacancyInviteResponse(directChatId.Value, message.Id));
    }

    /// <summary>
    /// Архивирует вакансию (мягкое удаление).
    /// </summary>
    [HttpDelete("{id:long}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(long id, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var vacancy = await dbContext.Vacancies.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("employer.vacancies.not_found", "Vacancy not found.");
        }

        vacancy.Status = OpportunityStatus.Archived;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Обновляет статус вакансии.
    /// </summary>
    [HttpPatch("{id:long}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateStatus(long id, EmployerVacancyStatusUpdateRequest request, CancellationToken cancellationToken)
    {
        var membership = await GetManagementMembership(cancellationToken);
        if (membership is null)
        {
            return this.ToNotFoundError("employer.company.not_found", "Employer company not found.");
        }

        var vacancy = await dbContext.Vacancies.FirstOrDefaultAsync(x => x.Id == id && x.CompanyId == membership.CompanyId, cancellationToken);
        if (vacancy is null)
        {
            return this.ToNotFoundError("employer.vacancies.not_found", "Vacancy not found.");
        }

        vacancy.Status = await ResolvePublicationStatusAsync(membership.CompanyId, request.Status, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<OpportunityStatus> ResolvePublicationStatusAsync(
        long companyId,
        OpportunityStatus requestedStatus,
        CancellationToken cancellationToken)
    {
        if (requestedStatus is not OpportunityStatus.Active and not OpportunityStatus.PendingModeration)
        {
            return requestedStatus;
        }

        var isVerified = await dbContext.Companies
            .AsNoTracking()
            .Where(x => x.Id == companyId)
            .Select(x => x.Status == CompanyStatus.Verified)
            .FirstAsync(cancellationToken);

        return isVerified ? OpportunityStatus.Active : OpportunityStatus.PendingModeration;
    }

    private async Task ReplaceVacancyTags(long vacancyId, IReadOnlyCollection<long>? tagIds, CancellationToken cancellationToken)
    {
        var normalizedTagIds = (tagIds ?? Array.Empty<long>())
            .Where(x => x > 0)
            .Distinct()
            .ToArray();

        var existing = await dbContext.VacancyTags.Where(x => x.VacancyId == vacancyId).ToListAsync(cancellationToken);
        dbContext.VacancyTags.RemoveRange(existing);

        if (normalizedTagIds.Length > 0)
        {
            var existingTagIds = await dbContext.Tags
                .Where(x => normalizedTagIds.Contains(x.Id))
                .Select(x => x.Id)
                .ToArrayAsync(cancellationToken);

            dbContext.VacancyTags.AddRange(existingTagIds.Select(tagId => new VacancyTag
            {
                VacancyId = vacancyId,
                TagId = tagId
            }));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<CompanyMember?> GetManagementMembership(CancellationToken cancellationToken)
        => await dbContext.CompanyMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.UserId == User.GetUserId() &&
                     (x.Role == CompanyMemberRole.Owner || x.Role == CompanyMemberRole.Admin || x.Role == CompanyMemberRole.Staff),
                cancellationToken);

    private static string? ValidateVacancy(EmployerVacancyUpsertRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) ||
            string.IsNullOrWhiteSpace(request.ShortDescription) ||
            string.IsNullOrWhiteSpace(request.FullDescription))
        {
            return "Title and descriptions are required.";
        }

        if (request.SalaryFrom is not null && request.SalaryTo is not null && request.SalaryTo < request.SalaryFrom)
        {
            return "salaryTo must be >= salaryFrom.";
        }

        if (request.MapPoint is null && request.CityId is null && request.LocationId is null)
        {
            return "Either mapPoint or cityId/locationId must be provided.";
        }

        if (request.MapPoint is not null)
        {
            if (request.MapPoint.Latitude is < -90 or > 90)
            {
                return "mapPoint.latitude must be between -90 and 90.";
            }

            if (request.MapPoint.Longitude is < -180 or > 180)
            {
                return "mapPoint.longitude must be between -180 and 180.";
            }
        }

        return null;
    }

    private async Task<ResolvedLocationResult?> ResolveMapPointAsync(MapPointDto? mapPoint, CancellationToken cancellationToken)
    {
        if (mapPoint is null)
        {
            return null;
        }

        return await employerLocationService.ResolveOrCreateAsync(mapPoint.Latitude, mapPoint.Longitude, cancellationToken);
    }

    private async Task<ResolvedLocationResult?> ResolveLocationAsync(EmployerVacancyUpsertRequest request, CancellationToken cancellationToken)
    {
        if (request.MapPoint is not null)
        {
            return await ResolveMapPointAsync(request.MapPoint, cancellationToken);
        }

        if (request.LocationId is > 0)
        {
            var location = await dbContext.Locations
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == request.LocationId.Value &&
                         (!request.CityId.HasValue || x.CityId == request.CityId.Value),
                    cancellationToken);
            if (location is not null)
            {
                return new ResolvedLocationResult(location.CityId, location.Id);
            }
        }

        if (request.CityId is > 0)
        {
            return await employerLocationService.ResolveOrCreateByAddressAsync(
                request.CityId.Value,
                request.StreetName,
                request.HouseNumber,
                cancellationToken);
        }

        return null;
    }

    private string BuildVacancyUrl(long vacancyId)
    {
        var path = $"/vacancies/{vacancyId}";
        var baseUrl = configuration["PublicWebBaseUrl"]?.Trim();
        return string.IsNullOrWhiteSpace(baseUrl)
            ? path
            : $"{baseUrl.TrimEnd('/')}{path}";
    }
}
