using System.Text;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Models.Tags;

namespace Monolith.Services.Tags;

public interface ITechnologyTagService
{
    Task<IReadOnlyCollection<TechnologyTagListItemDto>> GetList(CancellationToken cancellationToken);
    Task<TechnologyTagMutationResult> Create(TechnologyTagUpsertRequest request, CancellationToken cancellationToken);
    Task<TechnologyTagMutationResult> Update(long id, TechnologyTagUpsertRequest request, CancellationToken cancellationToken);
    Task<TechnologyTagDeleteResult> Delete(long id, CancellationToken cancellationToken);
}

public enum TechnologyTagMutationError
{
    None = 0,
    Validation = 1,
    NotFound = 2,
    Conflict = 3,
    GroupNotFound = 4
}

public sealed record TechnologyTagMutationResult(
    TechnologyTagListItemDto? Item,
    TechnologyTagMutationError Error = TechnologyTagMutationError.None,
    string? ErrorCode = null,
    string? ErrorMessage = null)
{
    public static TechnologyTagMutationResult Success(TechnologyTagListItemDto item) => new(item);
    public static TechnologyTagMutationResult Failed(TechnologyTagMutationError error, string code, string message)
        => new(null, error, code, message);
}

public sealed record TechnologyTagDeleteResult(
    bool Succeeded,
    string? ErrorCode = null,
    string? ErrorMessage = null)
{
    public static TechnologyTagDeleteResult Success() => new(true);
    public static TechnologyTagDeleteResult Failed(string code, string message) => new(false, code, message);
}

public class TechnologyTagService(AppDbContext dbContext) : ITechnologyTagService
{
    private const string TechnologyGroupCode = "technology";
    private const int TagNameMaxLength = 100;
    private const int TagSlugMaxLength = 120;
    private const string TechnologyGroupName = "Технологии";
    private const string TechnologyGroupDescription = "Технологические теги для вакансий и мероприятий";
    private static readonly string[] BaselineTechnologyTagNames =
    [
        "C#",
        ".NET",
        "Java",
        "Kotlin",
        "Python",
        "Go",
        "React",
        "Vue",
        "Angular",
        "PostgreSQL",
        "Kafka",
        "Docker",
        "DevOps",
        "QA",
        "Data Science"
    ];

    public async Task<IReadOnlyCollection<TechnologyTagListItemDto>> GetList(CancellationToken cancellationToken)
    {
        var (group, created) = await EnsureTechnologyGroup(cancellationToken);
        if (created)
        {
            await EnsureBaselineTechnologyTags(group, cancellationToken);
        }

        var rows = await dbContext.Tags
            .AsNoTracking()
            .Where(x => x.GroupId == group.Id)
            .OrderBy(x => x.Name)
            .Select(x => new TechnologyTagListItemDto(x.Id, x.GroupId, group.Code, x.Name, x.Slug))
            .ToListAsync(cancellationToken);

        return rows;
    }

    public async Task<TechnologyTagMutationResult> Create(TechnologyTagUpsertRequest request, CancellationToken cancellationToken)
    {
        var normalizedName = NormalizeName(request.Name);
        if (normalizedName is null)
        {
            return TechnologyTagMutationResult.Failed(
                TechnologyTagMutationError.Validation,
                "technology_tags.name_required",
                "Tag name is required.");
        }

        if (normalizedName.Length > TagNameMaxLength)
        {
            return TechnologyTagMutationResult.Failed(
                TechnologyTagMutationError.Validation,
                "technology_tags.name_too_long",
                "Tag name is too long.");
        }

        var (group, _) = await EnsureTechnologyGroup(cancellationToken);

        var hasDuplicateName = await dbContext.Tags
            .AnyAsync(x => x.GroupId == group.Id && x.Name.ToLower() == normalizedName.ToLower(), cancellationToken);
        if (hasDuplicateName)
        {
            return TechnologyTagMutationResult.Failed(
                TechnologyTagMutationError.Conflict,
                "technology_tags.name_exists",
                "Tag with this name already exists.");
        }

        var slug = await BuildUniqueSlug(normalizedName, null, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var tag = new Tag
        {
            GroupId = group.Id,
            Name = normalizedName,
            Slug = slug,
            Status = CatalogStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Tags.Add(tag);
        await dbContext.SaveChangesAsync(cancellationToken);

        return TechnologyTagMutationResult.Success(ToListItem(tag, group.Code));
    }

    public async Task<TechnologyTagMutationResult> Update(long id, TechnologyTagUpsertRequest request, CancellationToken cancellationToken)
    {
        var normalizedName = NormalizeName(request.Name);
        if (normalizedName is null)
        {
            return TechnologyTagMutationResult.Failed(
                TechnologyTagMutationError.Validation,
                "technology_tags.name_required",
                "Tag name is required.");
        }

        if (normalizedName.Length > TagNameMaxLength)
        {
            return TechnologyTagMutationResult.Failed(
                TechnologyTagMutationError.Validation,
                "technology_tags.name_too_long",
                "Tag name is too long.");
        }

        var (group, _) = await EnsureTechnologyGroup(cancellationToken);

        var tag = await dbContext.Tags
            .FirstOrDefaultAsync(x => x.Id == id && x.GroupId == group.Id, cancellationToken);
        if (tag is null)
        {
            return TechnologyTagMutationResult.Failed(
                TechnologyTagMutationError.NotFound,
                "technology_tags.not_found",
                "Tag not found.");
        }

        var hasDuplicateName = await dbContext.Tags
            .AnyAsync(
                x => x.GroupId == group.Id && x.Id != tag.Id && x.Name.ToLower() == normalizedName.ToLower(),
                cancellationToken);
        if (hasDuplicateName)
        {
            return TechnologyTagMutationResult.Failed(
                TechnologyTagMutationError.Conflict,
                "technology_tags.name_exists",
                "Tag with this name already exists.");
        }

        tag.Name = normalizedName;
        tag.Slug = await BuildUniqueSlug(normalizedName, tag.Id, cancellationToken);
        tag.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return TechnologyTagMutationResult.Success(ToListItem(tag, group.Code));
    }

    public async Task<TechnologyTagDeleteResult> Delete(long id, CancellationToken cancellationToken)
    {
        var (group, _) = await EnsureTechnologyGroup(cancellationToken);

        var tag = await dbContext.Tags
            .FirstOrDefaultAsync(x => x.Id == id && x.GroupId == group.Id, cancellationToken);
        if (tag is null)
        {
            return TechnologyTagDeleteResult.Failed("technology_tags.not_found", "Tag not found.");
        }

        var vacancyTags = await dbContext.VacancyTags.Where(x => x.TagId == tag.Id).ToListAsync(cancellationToken);
        if (vacancyTags.Count > 0)
        {
            dbContext.VacancyTags.RemoveRange(vacancyTags);
        }

        var opportunityTags = await dbContext.OpportunityTags.Where(x => x.TagId == tag.Id).ToListAsync(cancellationToken);
        if (opportunityTags.Count > 0)
        {
            dbContext.OpportunityTags.RemoveRange(opportunityTags);
        }

        var resumeSkills = await dbContext.CandidateResumeSkills.Where(x => x.TagId == tag.Id).ToListAsync(cancellationToken);
        if (resumeSkills.Count > 0)
        {
            dbContext.CandidateResumeSkills.RemoveRange(resumeSkills);
        }

        dbContext.Tags.Remove(tag);
        await dbContext.SaveChangesAsync(cancellationToken);

        return TechnologyTagDeleteResult.Success();
    }

    private static string? NormalizeName(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
    }

    private async Task<(TagGroup Group, bool Created)> EnsureTechnologyGroup(CancellationToken cancellationToken)
    {
        var group = await dbContext.TagGroups
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Code == TechnologyGroupCode, cancellationToken);

        if (group is not null)
        {
            return (group, false);
        }

        group = await dbContext.TagGroups
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => EF.Functions.ILike(x.Code, "technolog%") || x.Name == TechnologyGroupName,
                cancellationToken);

        if (group is not null)
        {
            return (group, false);
        }

        var now = DateTimeOffset.UtcNow;
        var createdGroup = new TagGroup
        {
            Code = TechnologyGroupCode,
            Name = TechnologyGroupName,
            Description = TechnologyGroupDescription,
            IsSystem = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.TagGroups.Add(createdGroup);
        await dbContext.SaveChangesAsync(cancellationToken);

        return (createdGroup, true);
    }

    private async Task EnsureBaselineTechnologyTags(TagGroup group, CancellationToken cancellationToken)
    {
        var existingNames = await dbContext.Tags
            .AsNoTracking()
            .Where(x => x.GroupId == group.Id)
            .Select(x => x.Name)
            .ToListAsync(cancellationToken);

        var existing = new HashSet<string>(existingNames, StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;

        foreach (var tagName in BaselineTechnologyTagNames)
        {
            if (existing.Contains(tagName))
            {
                continue;
            }

            var slug = await BuildUniqueSlug(tagName, null, cancellationToken);
            dbContext.Tags.Add(new Tag
            {
                GroupId = group.Id,
                Name = tagName,
                Slug = slug,
                Description = $"Тег {tagName}",
                Status = CatalogStatus.Active,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static TechnologyTagListItemDto ToListItem(Tag tag, string groupCode)
    {
        return new TechnologyTagListItemDto(tag.Id, tag.GroupId, groupCode, tag.Name, tag.Slug);
    }

    private async Task<string> BuildUniqueSlug(string name, long? currentTagId, CancellationToken cancellationToken)
    {
        var baseSlugCore = BuildSlugCore(name);
        var baseSlug = TrimSlugToMax($"technology-{baseSlugCore}", TagSlugMaxLength);
        if (string.IsNullOrWhiteSpace(baseSlug))
        {
            baseSlug = "technology-tag";
        }

        var candidate = baseSlug;
        var suffix = 2;

        while (await SlugExists(candidate, currentTagId, cancellationToken))
        {
            var suffixPart = $"-{suffix}";
            var maxBaseLength = Math.Max(1, TagSlugMaxLength - suffixPart.Length);
            var truncatedBase = TrimSlugToMax(baseSlug, maxBaseLength);
            candidate = $"{truncatedBase}{suffixPart}";
            suffix++;
        }

        return candidate;
    }

    private async Task<bool> SlugExists(string slug, long? currentTagId, CancellationToken cancellationToken)
    {
        return await dbContext.Tags.AnyAsync(
            x => x.Slug == slug && (!currentTagId.HasValue || x.Id != currentTagId.Value),
            cancellationToken);
    }

    private static string BuildSlugCore(string value)
    {
        var source = value.Trim().ToLowerInvariant();
        var sb = new StringBuilder(source.Length);
        var previousDash = false;

        foreach (var ch in source)
        {
            if (char.IsLetterOrDigit(ch))
            {
                sb.Append(ch);
                previousDash = false;
                continue;
            }

            if (!previousDash)
            {
                sb.Append('-');
                previousDash = true;
            }
        }

        var slug = sb.ToString().Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? "tag" : slug;
    }

    private static string TrimSlugToMax(string value, int maxLength)
    {
        if (value.Length <= maxLength)
        {
            return value;
        }

        var trimmed = value[..maxLength].Trim('-');
        return string.IsNullOrWhiteSpace(trimmed) ? "tag" : trimmed;
    }
}
