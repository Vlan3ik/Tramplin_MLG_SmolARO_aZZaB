using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Monolith.Contexts;
using Monolith.Entities;
using Monolith.Services.Auth;
using Monolith.Services.Common;
using NetTopologySuite.Geometries;
using LocationEntity = Monolith.Entities.Location;

namespace Monolith.Services.Seeding;

public class SeedDataService(AppDbContext dbContext, IPasswordHasher passwordHasher) : ISeedDataService
{
    public async Task SeedAsync()
    {
        var now = DateTimeOffset.UtcNow;

        var curator = await EnsureUserAsync(
            "admin@tramplin.local",
            "Администратор платформы",
            "Admin123!",
            AccountStatus.Active,
            "/api/media/user-avatars/system/admin.svg");

        await EnsureRoleAsync(curator.Id, PlatformRole.Curator, now);
        await EnsureSingleSuperCuratorAsync(curator.Id);

        if (await HasDomainDataAsync())
        {
            return;
        }

        var seedDataRoot = ResolveSeedDataRoot();
        var companySeeds = LoadCompanySeeds(seedDataRoot);
        var vacancySeeds = LoadVacancySeeds(seedDataRoot);
        var mapPointSeeds = LoadGeoPointSeeds(seedDataRoot);
        var fioSeeds = LoadFioSeeds(seedDataRoot);
        var eventSeeds = LoadEventSeeds(seedDataRoot);
        var seekerAvatarUrls = LoadSeekerAvatarUrls(seedDataRoot);
        var portfolioPhotoUrls = LoadPortfolioPhotoUrls(seedDataRoot);

        if (companySeeds.Count != 10)
        {
            throw new InvalidOperationException($"Ожидалось 10 компаний в тестовых данных, но найдено {companySeeds.Count}.");
        }

        if (vacancySeeds.Count < companySeeds.Count)
        {
            throw new InvalidOperationException("Недостаточно вакансий в тестовых данных: требуется минимум по одной вакансии на компанию.");
        }

        if (mapPointSeeds.Count < vacancySeeds.Count)
        {
            throw new InvalidOperationException("Недостаточно гео-точек для уникального размещения вакансий.");
        }

        var cities = await EnsureCitiesAsync();
        var tags = await EnsureTagsAsync();
        var locations = await EnsureLocationsFromGeoPointsAsync(cities, mapPointSeeds);
        var employers = await EnsureCompanyEmployersAsync(companySeeds.Count, now);

        var companies = BuildCompaniesFromSeeds(companySeeds, cities);
        dbContext.Companies.AddRange(companies);
        await dbContext.SaveChangesAsync();

        await SeedVerificationDictionariesAsync();
        await SeedCompanyVerificationProfilesAsync(companies, curator.Id);

        var companyMembers = BuildCompanyMembers(companies, employers);
        dbContext.CompanyMembers.AddRange(companyMembers);
        dbContext.CompanyChatSettings.AddRange(BuildCompanyChatSettings(companies));
        dbContext.CompanyLinks.AddRange(BuildCompanyLinksFromSeeds(companies, companySeeds));
        dbContext.CompanyInvites.AddRange(BuildCompanyInvites(companies, companyMembers, now));
        await dbContext.SaveChangesAsync();

        var vacancies = BuildVacanciesFromSeeds(companies, companyMembers, locations, vacancySeeds, now);
        dbContext.Vacancies.AddRange(vacancies);
        await dbContext.SaveChangesAsync();

        var opportunities = BuildOpportunitiesFromSeeds(companies, companyMembers, locations, eventSeeds, now);
        dbContext.Opportunities.AddRange(opportunities);
        await dbContext.SaveChangesAsync();

        dbContext.VacancyTags.AddRange(BuildVacancyTags(vacancies, tags));
        dbContext.OpportunityTags.AddRange(BuildOpportunityTags(opportunities, tags));
        await dbContext.SaveChangesAsync();

        var seekers = await EnsureSeekersWithProfilesAsync(
            targetCount: 30,
            fioSeeds,
            seekerAvatarUrls,
            cities,
            tags,
            companies,
            now);

        var participations = BuildOpportunityParticipationsForAllSeekers(opportunities, seekers, now);
        dbContext.OpportunityParticipants.AddRange(participations);
        await dbContext.SaveChangesAsync();

        await SeedPortfolioProjectsForAllSeekersAsync(seekers, vacancies, opportunities, portfolioPhotoUrls, now);

        var applications = BuildApplicationsForAllSeekers(vacancies, seekers, now);
        dbContext.Applications.AddRange(applications);
        await dbContext.SaveChangesAsync();

        await SeedSocialGraphAsync(seekers, vacancies, opportunities, applications, participations, now);
        await SeedOpportunityChatsAsync(opportunities, participations, companyMembers, now);
        await SeedApplicationChatsAsync(applications, companyMembers);
        await SeedDirectChatsAsync(seekers);
    }

    private async Task<bool> HasDomainDataAsync()
    {
        return await dbContext.Companies.AnyAsync()
            || await dbContext.Vacancies.AnyAsync()
            || await dbContext.Opportunities.AnyAsync()
            || await dbContext.CandidateProfiles.AnyAsync()
            || await dbContext.Applications.AnyAsync();
    }

    private static string ResolveSeedDataRoot()
    {
        var fromEnv = Environment.GetEnvironmentVariable("SEED_TEST_DATA_DIR");
        if (!string.IsNullOrWhiteSpace(fromEnv) && Directory.Exists(fromEnv))
        {
            return fromEnv;
        }

        var directCandidates = new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), "seed-data"),
            Path.Combine(Directory.GetCurrentDirectory(), "Design", "Тестовые данные"),
            Path.Combine(AppContext.BaseDirectory, "seed-data"),
            Path.Combine(AppContext.BaseDirectory, "Design", "Тестовые данные")
        };

        foreach (var candidate in directCandidates)
        {
            if (Directory.Exists(candidate))
            {
                return candidate;
            }
        }

        var searchRoots = new[]
        {
            new DirectoryInfo(Directory.GetCurrentDirectory()),
            new DirectoryInfo(AppContext.BaseDirectory)
        };

        foreach (var root in searchRoots)
        {
            for (var current = root; current is not null; current = current.Parent)
            {
                var candidate = Path.Combine(current.FullName, "Design", "Тестовые данные");
                if (Directory.Exists(candidate))
                {
                    return candidate;
                }
            }
        }

        throw new InvalidOperationException(
            "Не удалось найти директорию тестовых данных. Укажите путь через переменную окружения SEED_TEST_DATA_DIR.");
    }

    private static List<CompanySeed> LoadCompanySeeds(string seedDataRoot)
    {
        var companiesDir = Path.Combine(seedDataRoot, "Компании");
        if (!Directory.Exists(companiesDir))
        {
            throw new InvalidOperationException($"Папка компаний не найдена: {companiesDir}");
        }

        var directories = new DirectoryInfo(companiesDir)
            .GetDirectories()
            .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var result = new List<CompanySeed>(directories.Length);
        for (var i = 0; i < directories.Length; i++)
        {
            var directory = directories[i];
            var textFile = directory.GetFiles("*.txt").OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase).FirstOrDefault();
            var text = textFile is null ? string.Empty : ReadAllTextWithFallback(textFile.FullName);
            var lines = text
                .Split('\n')
                .Select(x => x.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToArray();

            var phone = Regex.Match(text, @"\+?\d[\d\s\-\(\)]{8,}\d").Value.Trim();
            var emailMatch = Regex.Match(text, @"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}");
            var email = emailMatch.Success ? emailMatch.Value : null;
            var links = Regex.Matches(text, @"https?://[^\s""<>]+")
                .Select(x => x.Value.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            var website = links.FirstOrDefault()
                ?? lines.FirstOrDefault(x => LooksLikeDomain(x));

            var normalizedWebsite = NormalizeUrl(website);

            var description = string.IsNullOrWhiteSpace(text)
                ? $"Профиль компании {directory.Name} из тестового набора."
                : text.Trim();

            var logoFile = directory.GetFiles("*.*")
                .Where(x =>
                    x.Extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) ||
                    x.Extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase) ||
                    x.Extension.Equals(".png", StringComparison.OrdinalIgnoreCase) ||
                    x.Extension.Equals(".svg", StringComparison.OrdinalIgnoreCase) ||
                    x.Extension.Equals(".webp", StringComparison.OrdinalIgnoreCase))
                .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();

            var ext = logoFile?.Extension?.ToLowerInvariant() ?? ".svg";
            var objectKey = $"company-logos/test-data/company-{i + 1:00}{ext}";

            result.Add(new CompanySeed(
                Name: directory.Name,
                Description: description,
                WebsiteUrl: normalizedWebsite,
                PublicEmail: email,
                PublicPhone: string.IsNullOrWhiteSpace(phone) ? null : phone,
                AdditionalLinks: links,
                LogoFilePath: logoFile?.FullName,
                LogoObjectKey: objectKey));
        }

        return result;
    }

    private static List<VacancySeed> LoadVacancySeeds(string seedDataRoot)
    {
        var vacanciesDir = Path.Combine(seedDataRoot, "Вакансии");
        if (!Directory.Exists(vacanciesDir))
        {
            throw new InvalidOperationException($"Папка вакансий не найдена: {vacanciesDir}");
        }

        var files = new DirectoryInfo(vacanciesDir)
            .GetFiles("*.txt")
            .OrderBy(file =>
            {
                var name = Path.GetFileNameWithoutExtension(file.Name);
                return int.TryParse(name, out var numeric) ? numeric : int.MaxValue;
            })
            .ThenBy(file => file.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<VacancySeed>(files.Length);

        foreach (var file in files)
        {
            var text = ReadAllTextWithFallback(file.FullName);
            var lines = text
                .Split('\n')
                .Select(x => x.Trim())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToArray();

            if (lines.Length == 0)
            {
                continue;
            }

            var title = NormalizeVacancyTitle(lines[0]);
            var shortDescription = BuildShortDescription(text, maxLength: 240);
            var fullDescription = text.Trim();
            var format = ParseWorkFormat(text);
            var (salaryFrom, salaryTo) = ParseSalaryRange(text);
            var kind = title.Contains("стаж", StringComparison.OrdinalIgnoreCase)
                || title.Contains("младш", StringComparison.OrdinalIgnoreCase)
                || title.Contains("junior", StringComparison.OrdinalIgnoreCase)
                ? VacancyKind.Internship
                : VacancyKind.Job;

            var dedupKey = $"{NormalizeForDedup(title)}|{NormalizeForDedup(shortDescription)}";
            if (!seen.Add(dedupKey))
            {
                continue;
            }

            result.Add(new VacancySeed(
                Title: title,
                ShortDescription: shortDescription,
                FullDescription: fullDescription,
                Kind: kind,
                Format: format,
                SalaryFrom: salaryFrom,
                SalaryTo: salaryTo));
        }

        return result;
    }

    private static List<GeoPointSeed> LoadGeoPointSeeds(string seedDataRoot)
    {
        var filePath = Path.Combine(seedDataRoot, "Точки на карте.txt");
        if (!File.Exists(filePath))
        {
            throw new InvalidOperationException($"GeoJSON с точками на карте не найден: {filePath}");
        }

        using var document = JsonDocument.Parse(ReadAllTextWithFallback(filePath));
        if (!document.RootElement.TryGetProperty("features", out var features) || features.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("Некорректный формат GeoJSON: отсутствует массив features.");
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<GeoPointSeed>();
        foreach (var feature in features.EnumerateArray())
        {
            if (!feature.TryGetProperty("geometry", out var geometry))
            {
                continue;
            }

            if (!geometry.TryGetProperty("coordinates", out var coordinates) || coordinates.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            if (coordinates.GetArrayLength() < 2)
            {
                continue;
            }

            var lon = coordinates[0].GetDouble();
            var lat = coordinates[1].GetDouble();
            var key = $"{Math.Round(lat, 6):F6}:{Math.Round(lon, 6):F6}";
            if (!seen.Add(key))
            {
                continue;
            }

            result.Add(new GeoPointSeed(lat, lon));
        }

        return result;
    }

    private static FioSeed LoadFioSeeds(string seedDataRoot)
    {
        var filePath = Path.Combine(seedDataRoot, "Соискатели", "ФИО_массивы.txt");
        if (!File.Exists(filePath))
        {
            throw new InvalidOperationException($"Файл ФИО не найден: {filePath}");
        }

        var text = ReadAllTextWithFallback(filePath);
        var lastNames = ParseQuotedArray(text, "ФАМИЛИИ");
        var firstNames = ParseQuotedArray(text, "ИМЕНА");
        var middleNames = ParseQuotedArray(text, "ОТЧЕСТВА");

        if (lastNames.Count == 0 || firstNames.Count == 0 || middleNames.Count == 0)
        {
            throw new InvalidOperationException("Файл ФИО не содержит обязательные массивы фамилий, имён и отчеств.");
        }

        return new FioSeed(lastNames, firstNames, middleNames);
    }

    private static List<EventSeed> LoadEventSeeds(string seedDataRoot)
    {
        var filePath = Path.Combine(seedDataRoot, "мероприятия", "мероприятия.json");
        if (!File.Exists(filePath))
        {
            throw new InvalidOperationException($"Файл мероприятий не найден: {filePath}");
        }

        using var document = JsonDocument.Parse(ReadAllTextWithFallback(filePath));
        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("Некорректный формат мероприятий: ожидается JSON-массив.");
        }

        var result = new List<EventSeed>();
        foreach (var item in document.RootElement.EnumerateArray())
        {
            var title = TryGetJsonString(item, "название") ?? "Мероприятие";
            var description = TryGetJsonString(item, "описание") ?? string.Empty;
            var formatText = TryGetJsonString(item, "формат") ?? string.Empty;
            var dateText = TryGetJsonString(item, "дата");
            var tags = item.TryGetProperty("теги", out var tagsNode) && tagsNode.ValueKind == JsonValueKind.Array
                ? tagsNode.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString() ?? string.Empty).Where(x => !string.IsNullOrWhiteSpace(x)).ToArray()
                : [];

            var shortDescription = BuildShortDescription(description, maxLength: 220);
            var fullDescription = string.IsNullOrWhiteSpace(description)
                ? $"Событие «{title}» из тестовых данных."
                : description.Trim();
            var kind = ParseOpportunityKind(title, description, tags);
            var format = ParseWorkFormat(formatText);
            var eventDate = DateOnly.TryParse(dateText, out var parsedDate)
                ? new DateTimeOffset(parsedDate.ToDateTime(TimeOnly.FromTimeSpan(TimeSpan.FromHours(18))), TimeSpan.FromHours(3))
                : DateTimeOffset.UtcNow.AddDays(14);

            result.Add(new EventSeed(
                Title: title,
                ShortDescription: shortDescription,
                FullDescription: fullDescription,
                Kind: kind,
                Format: format,
                EventDate: eventDate));
        }

        return result;
    }

    private static List<string> LoadSeekerAvatarUrls(string seedDataRoot)
    {
        var avatarsDir = Path.Combine(seedDataRoot, "Соискатели", "Аватарки");
        if (!Directory.Exists(avatarsDir))
        {
            return ["/api/media/user-avatars/system/seeker.svg"];
        }

        var files = new DirectoryInfo(avatarsDir)
            .GetFiles("*.*")
            .Where(x =>
                x.Extension.Equals(".svg", StringComparison.OrdinalIgnoreCase) ||
                x.Extension.Equals(".png", StringComparison.OrdinalIgnoreCase) ||
                x.Extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) ||
                x.Extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase) ||
                x.Extension.Equals(".webp", StringComparison.OrdinalIgnoreCase))
            .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (files.Length == 0)
        {
            return ["/api/media/user-avatars/system/seeker.svg"];
        }

        return files.Select(x => $"/api/media/user-avatars/seekers/{x.Name}").ToList();
    }

    private static List<string> LoadPortfolioPhotoUrls(string seedDataRoot)
    {
        var photosDir = Path.Combine(seedDataRoot, "Соискатели", "Проекты");
        if (!Directory.Exists(photosDir))
        {
            return [];
        }

        var files = new DirectoryInfo(photosDir)
            .GetFiles("*.*")
            .Where(x =>
                x.Extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) ||
                x.Extension.Equals(".jpeg", StringComparison.OrdinalIgnoreCase) ||
                x.Extension.Equals(".png", StringComparison.OrdinalIgnoreCase) ||
                x.Extension.Equals(".webp", StringComparison.OrdinalIgnoreCase))
            .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return files.Select(x => $"/api/media/portfolio-projects/test-data/{x.Name}").ToList();
    }

    private async Task<List<User>> EnsureCompanyEmployersAsync(int companyCount, DateTimeOffset assignedAt)
    {
        var employers = new List<User>(companyCount * 2);
        for (var i = 1; i <= companyCount * 2; i++)
        {
            var employer = await EnsureUserAsync(
                $"employer{i:00}@tramplin.local",
                $"Работодатель {i}",
                "Employer123!",
                AccountStatus.Active,
                "/api/media/user-avatars/system/employer.svg");
            await EnsureRoleAsync(employer.Id, PlatformRole.Employer, assignedAt);
            employers.Add(employer);
        }

        return employers;
    }

    private static List<Company> BuildCompaniesFromSeeds(IReadOnlyList<CompanySeed> seeds, IReadOnlyDictionary<string, City> cities)
    {
        var cityCodes = cities.Keys.OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToArray();
        var companies = new List<Company>(seeds.Count);
        for (var i = 0; i < seeds.Count; i++)
        {
            var seed = seeds[i];
            var cityCode = seed.Description.Contains("смолен", StringComparison.OrdinalIgnoreCase)
                ? "SMO"
                : cityCodes[i % cityCodes.Length];
            if (!cities.ContainsKey(cityCode))
            {
                cityCode = cityCodes[i % cityCodes.Length];
            }

            companies.Add(new Company
            {
                LegalName = seed.Name,
                BrandName = seed.Name,
                Description = seed.Description,
                LogoUrl = $"/api/media/{seed.LogoObjectKey}",
                WebsiteUrl = seed.WebsiteUrl,
                PublicEmail = seed.PublicEmail ?? $"hr{i + 1:00}@tramplin.local",
                PublicPhone = seed.PublicPhone ?? $"+7 (900) 000-{(10 + i):00}-{(20 + i):00}",
                BaseCityId = cities[cityCode].Id,
                Status = CompanyStatus.Verified
            });
        }

        return companies;
    }

    private static List<CompanyChatSettings> BuildCompanyChatSettings(IReadOnlyList<Company> companies)
    {
        return companies.Select((company, index) => new CompanyChatSettings
        {
            CompanyId = company.Id,
            AutoGreetingEnabled = true,
            AutoGreetingText = $"Здравствуйте! Спасибо за интерес к компании «{company.BrandName ?? company.LegalName}».",
            OutsideHoursEnabled = index % 2 == 0,
            OutsideHoursText = "Мы получили ваше сообщение и ответим в ближайшее рабочее время.",
            WorkingHoursTimezone = "Europe/Moscow",
            WorkingHoursFrom = TimeSpan.FromHours(9),
            WorkingHoursTo = TimeSpan.FromHours(18)
        }).ToList();
    }

    private static List<CompanyLink> BuildCompanyLinksFromSeeds(IReadOnlyList<Company> companies, IReadOnlyList<CompanySeed> seeds)
    {
        var links = new List<CompanyLink>(companies.Count * 2);
        for (var i = 0; i < companies.Count; i++)
        {
            var company = companies[i];
            var seed = seeds[i];
            if (!string.IsNullOrWhiteSpace(seed.WebsiteUrl))
            {
                links.Add(new CompanyLink
                {
                    CompanyId = company.Id,
                    LinkKind = LinkType.Website,
                    Label = "Сайт",
                    Url = seed.WebsiteUrl
                });
            }

            foreach (var extraLink in seed.AdditionalLinks.Take(3))
            {
                links.Add(new CompanyLink
                {
                    CompanyId = company.Id,
                    LinkKind = extraLink.Contains("vk.com", StringComparison.OrdinalIgnoreCase) ? LinkType.Vk : LinkType.Other,
                    Label = extraLink.Contains("vk.com", StringComparison.OrdinalIgnoreCase) ? "VK" : "Ссылка",
                    Url = extraLink
                });
            }
        }

        return links;
    }

    private static List<CompanyInvite> BuildCompanyInvites(
        IReadOnlyList<Company> companies,
        IReadOnlyCollection<CompanyMember> companyMembers,
        DateTimeOffset now)
    {
        return companies.Select((company, index) => new CompanyInvite
        {
            CompanyId = company.Id,
            InvitedByUserId = companyMembers.First(x => x.CompanyId == company.Id && x.Role == CompanyMemberRole.Owner).UserId,
            Role = CompanyMemberRole.Admin,
            Token = $"seed-invite-company-{company.Id}-{index + 1}",
            ExpiresAt = now.AddDays(14 + (index % 5)),
            AcceptedAt = now.AddDays(-Math.Max(1, index % 6))
        }).ToList();
    }

    private async Task<List<LocationEntity>> EnsureLocationsFromGeoPointsAsync(
        IReadOnlyDictionary<string, City> cities,
        IReadOnlyList<GeoPointSeed> geoPointSeeds)
    {
        var geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
        var cityValues = cities.Values.ToArray();
        var locations = new List<LocationEntity>(geoPointSeeds.Count);

        for (var i = 0; i < geoPointSeeds.Count; i++)
        {
            var point = geoPointSeeds[i];
            var city = cityValues
                .OrderBy(x => SquaredDistance(
                    (double)(x.Latitude ?? 0m),
                    (double)(x.Longitude ?? 0m),
                    point.Latitude,
                    point.Longitude))
                .First();

            locations.Add(new LocationEntity
            {
                CityId = city.Id,
                GeoPoint = geometryFactory.CreatePoint(new Coordinate(point.Longitude, point.Latitude)),
                StreetName = $"Тестовая точка {i + 1}",
                HouseNumber = "1"
            });
        }

        dbContext.Locations.AddRange(locations);
        await dbContext.SaveChangesAsync();
        return locations;
    }

    private static List<Vacancy> BuildVacanciesFromSeeds(
        IReadOnlyList<Company> companies,
        IReadOnlyCollection<CompanyMember> members,
        IReadOnlyList<LocationEntity> locations,
        IReadOnlyList<VacancySeed> vacancySeeds,
        DateTimeOffset now)
    {
        var ownerByCompany = members
            .Where(x => x.Role == CompanyMemberRole.Owner)
            .ToDictionary(x => x.CompanyId, x => x.UserId);

        var vacancies = new List<Vacancy>(vacancySeeds.Count);
        for (var i = 0; i < vacancySeeds.Count; i++)
        {
            var seed = vacancySeeds[i];
            var company = companies[i % companies.Count];
            var location = locations[i];

            vacancies.Add(new Vacancy
            {
                CompanyId = company.Id,
                CreatedByUserId = ownerByCompany[company.Id],
                Title = seed.Title,
                ShortDescription = seed.ShortDescription,
                FullDescription = seed.FullDescription,
                Kind = seed.Kind,
                Format = seed.Format,
                Status = OpportunityStatus.Active,
                CityId = location.CityId,
                LocationId = location.Id,
                SalaryFrom = seed.SalaryFrom,
                SalaryTo = seed.SalaryTo,
                CurrencyCode = "RUB",
                SalaryTaxMode = SalaryTaxMode.Unknown,
                PublishAt = now.AddDays(-20 + i),
                ApplicationDeadline = now.AddDays(15 + (i % 20))
            });
        }

        return vacancies;
    }

    private static List<Opportunity> BuildOpportunitiesFromSeeds(
        IReadOnlyList<Company> companies,
        IReadOnlyCollection<CompanyMember> members,
        IReadOnlyList<LocationEntity> locations,
        IReadOnlyList<EventSeed> eventSeeds,
        DateTimeOffset now)
    {
        var ownerByCompany = members
            .Where(x => x.Role == CompanyMemberRole.Owner)
            .ToDictionary(x => x.CompanyId, x => x.UserId);

        var opportunities = new List<Opportunity>(eventSeeds.Count);
        for (var i = 0; i < eventSeeds.Count; i++)
        {
            var seed = eventSeeds[i];
            var company = companies[i % companies.Count];
            var location = locations[(i + 5) % locations.Count];

            opportunities.Add(new Opportunity
            {
                CompanyId = company.Id,
                CreatedByUserId = ownerByCompany[company.Id],
                Title = seed.Title,
                ShortDescription = seed.ShortDescription,
                FullDescription = seed.FullDescription,
                Kind = seed.Kind,
                Format = seed.Format,
                Status = OpportunityStatus.Active,
                CityId = location.CityId,
                LocationId = location.Id,
                PriceType = PriceType.Free,
                PriceAmount = null,
                PriceCurrencyCode = null,
                ParticipantsCanWrite = i % 3 != 0,
                PublishAt = now.AddDays(-10 + i),
                EventDate = seed.EventDate
            });
        }

        return opportunities;
    }

    private async Task SeedPortfolioProjectsAsync(
        IReadOnlyList<User> seekers,
        IReadOnlyList<Vacancy> vacancies,
        IReadOnlyList<Opportunity> opportunities)
    {
        if (seekers.Count < 6 || vacancies.Count == 0 || opportunities.Count == 0)
        {
            return;
        }

        var projects = new List<CandidateResumeProject>
        {
            new()
            {
                UserId = seekers[0].Id,
                Title = "Campus Navigator",
                Role = "Backend Developer",
                Description = "Web service for campus navigation and event aggregation.",
                StartDate = new DateOnly(2025, 2, 1),
                EndDate = new DateOnly(2025, 5, 28),
                RepoUrl = "https://github.com/tramplin-demo/campus-navigator",
                DemoUrl = "https://demo.tramplin.local/campus-navigator"
            },
            new()
            {
                UserId = seekers[1].Id,
                Title = "Retail Demand Predictor",
                Role = "Data Engineer",
                Description = "ML pipeline for weekly demand forecasting with dashboard export.",
                StartDate = new DateOnly(2025, 3, 10),
                EndDate = new DateOnly(2025, 7, 20),
                RepoUrl = "https://github.com/tramplin-demo/retail-demand",
                DemoUrl = "https://demo.tramplin.local/retail-demand"
            },
            new()
            {
                UserId = seekers[2].Id,
                Title = "Junior Jobs Aggregator",
                Role = "Frontend Developer",
                Description = "Aggregator of internships and entry-level opportunities.",
                StartDate = new DateOnly(2024, 11, 5),
                EndDate = new DateOnly(2025, 2, 15),
                RepoUrl = "https://github.com/tramplin-demo/junior-jobs",
                DemoUrl = "https://demo.tramplin.local/junior-jobs"
            },
            new()
            {
                UserId = seekers[3].Id,
                Title = "Hackday Team Board",
                Role = "Product Manager",
                Description = "Team board and matching service for hackathon participants.",
                StartDate = new DateOnly(2025, 1, 12),
                EndDate = new DateOnly(2025, 1, 29),
                RepoUrl = "https://github.com/tramplin-demo/hackday-board",
                DemoUrl = "https://demo.tramplin.local/hackday-board"
            },
            new()
            {
                UserId = seekers[4].Id,
                Title = "Interview Simulator Bot",
                Role = "NLP Engineer",
                Description = "Chatbot for interview practice with answer scoring.",
                StartDate = new DateOnly(2025, 4, 1),
                EndDate = null,
                RepoUrl = "https://github.com/tramplin-demo/interview-bot",
                DemoUrl = null
            }
        };

        dbContext.CandidateResumeProjects.AddRange(projects);
        await dbContext.SaveChangesAsync();

        var firstVacancy = vacancies[0];
        var secondVacancy = vacancies[Math.Min(1, vacancies.Count - 1)];
        var firstOpportunity = opportunities[0];
        var secondOpportunity = opportunities[Math.Min(1, opportunities.Count - 1)];

        dbContext.CandidateResumeProjectPhotos.AddRange(
        [
            new CandidateResumeProjectPhoto { ProjectId = projects[0].Id, Url = "/api/media/portfolio-projects/campus/cover.jpg", SortOrder = 0, IsMain = true },
            new CandidateResumeProjectPhoto { ProjectId = projects[0].Id, Url = "/api/media/portfolio-projects/campus/screen-1.jpg", SortOrder = 1, IsMain = false },
            new CandidateResumeProjectPhoto { ProjectId = projects[1].Id, Url = "/api/media/portfolio-projects/retail/cover.jpg", SortOrder = 0, IsMain = true },
            new CandidateResumeProjectPhoto { ProjectId = projects[1].Id, Url = "/api/media/portfolio-projects/retail/screen-1.jpg", SortOrder = 1, IsMain = false },
            new CandidateResumeProjectPhoto { ProjectId = projects[2].Id, Url = "/api/media/portfolio-projects/jobs/cover.jpg", SortOrder = 0, IsMain = true },
            new CandidateResumeProjectPhoto { ProjectId = projects[3].Id, Url = "/api/media/portfolio-projects/hackday/cover.jpg", SortOrder = 0, IsMain = true },
            new CandidateResumeProjectPhoto { ProjectId = projects[4].Id, Url = "/api/media/portfolio-projects/bot/cover.jpg", SortOrder = 0, IsMain = true }
        ]);

        dbContext.CandidateResumeProjectParticipants.AddRange(
        [
            new CandidateResumeProjectParticipant { ProjectId = projects[0].Id, UserId = seekers[0].Id, Role = "Backend Developer" },
            new CandidateResumeProjectParticipant { ProjectId = projects[0].Id, UserId = seekers[2].Id, Role = "Frontend Developer" },
            new CandidateResumeProjectParticipant { ProjectId = projects[0].Id, UserId = seekers[5].Id, Role = "QA Engineer" },

            new CandidateResumeProjectParticipant { ProjectId = projects[1].Id, UserId = seekers[1].Id, Role = "Data Engineer" },
            new CandidateResumeProjectParticipant { ProjectId = projects[1].Id, UserId = seekers[0].Id, Role = "API Developer" },
            new CandidateResumeProjectParticipant { ProjectId = projects[1].Id, UserId = seekers[3].Id, Role = "Analyst" },

            new CandidateResumeProjectParticipant { ProjectId = projects[2].Id, UserId = seekers[2].Id, Role = "Frontend Developer" },
            new CandidateResumeProjectParticipant { ProjectId = projects[2].Id, UserId = seekers[4].Id, Role = "Designer" },

            new CandidateResumeProjectParticipant { ProjectId = projects[3].Id, UserId = seekers[3].Id, Role = "Product Manager" },
            new CandidateResumeProjectParticipant { ProjectId = projects[3].Id, UserId = seekers[0].Id, Role = "Mentor" },

            new CandidateResumeProjectParticipant { ProjectId = projects[4].Id, UserId = seekers[4].Id, Role = "NLP Engineer" },
            new CandidateResumeProjectParticipant { ProjectId = projects[4].Id, UserId = seekers[1].Id, Role = "Data Engineer" }
        ]);

        dbContext.CandidateResumeProjectCollaborations.AddRange(
        [
            new CandidateResumeProjectCollaboration
            {
                ProjectId = projects[0].Id,
                Type = PortfolioCollaborationType.User,
                UserId = seekers[2].Id,
                Label = "UI collaboration",
                SortOrder = 0
            },
            new CandidateResumeProjectCollaboration
            {
                ProjectId = projects[0].Id,
                Type = PortfolioCollaborationType.Opportunity,
                OpportunityId = firstOpportunity.Id,
                Label = "Built during open challenge",
                SortOrder = 1
            },
            new CandidateResumeProjectCollaboration
            {
                ProjectId = projects[1].Id,
                Type = PortfolioCollaborationType.Vacancy,
                VacancyId = firstVacancy.Id,
                Label = "Result of internship assignment",
                SortOrder = 0
            },
            new CandidateResumeProjectCollaboration
            {
                ProjectId = projects[1].Id,
                Type = PortfolioCollaborationType.Custom,
                Label = "Regional AI Bootcamp 2025",
                SortOrder = 1
            },
            new CandidateResumeProjectCollaboration
            {
                ProjectId = projects[2].Id,
                Type = PortfolioCollaborationType.User,
                UserId = seekers[4].Id,
                Label = "Design support",
                SortOrder = 0
            },
            new CandidateResumeProjectCollaboration
            {
                ProjectId = projects[3].Id,
                Type = PortfolioCollaborationType.Opportunity,
                OpportunityId = secondOpportunity.Id,
                Label = "Hackday internal event",
                SortOrder = 0
            },
            new CandidateResumeProjectCollaboration
            {
                ProjectId = projects[4].Id,
                Type = PortfolioCollaborationType.Vacancy,
                VacancyId = secondVacancy.Id,
                Label = "Prototype for internship program",
                SortOrder = 0
            }
        ]);

        await dbContext.SaveChangesAsync();
    }

    private async Task SeedSeekerProfilesAsync(IReadOnlyList<User> seekers, IReadOnlyDictionary<string, City> cities)
    {
        var lastNames = new[]
        {
            "Иванов", "Петрова", "Смирнов", "Козлова", "Соколов",
            "Новикова", "Попов", "Васильева", "Зайцев", "Кузнецова",
            "Орлов", "Титова", "Борисов", "Егорова", "Лебедев",
            "Громова", "Виноградов", "Данилова", "Сергеев", "Тарасова",
            "Мельников", "Жукова", "Морозов", "Беляева", "Андреев"
        };

        var firstNames = new[]
        {
            "Артем", "Ольга", "Максим", "Елена", "Денис",
            "Мария", "Илья", "Наталья", "Андрей", "Дарья",
            "Павел", "Алина", "Никита", "Светлана", "Егор",
            "Ксения", "Роман", "Виктория", "Сергей", "Анастасия",
            "Дмитрий", "Екатерина", "Алексей", "Юлия", "Михаил"
        };

        var middleNames = new[]
        {
            "Игоревич", "Сергеевна", "Андреевич", "Викторовна", "Олегович",
            "Павловна", "Дмитриевич", "Алексеевна", "Романович", "Евгеньевна",
            "Николаевич", "Ильинична", "Петрович", "Аркадьевна", "Владимирович",
            "Максимовна", "Геннадьевич", "Анатольевна", "Григорьевич", "Михайловна",
            "Валерьевич", "Константиновна", "Федорович", "Юрьевна", "Степанович"
        };
        var cityCodes = new[]
        {
            "MOW", "LED", "SMO", "KZN", "EKB", "NVS"
        };

        for (var i = 0; i < seekers.Count; i++)
        {
            var seeker = seekers[i];
            await EnsureSeekerProfileAsync(
                seeker.Id,
                lastNames[i % lastNames.Length],
                firstNames[i % firstNames.Length],
                middleNames[i % middleNames.Length],
                $"+7-900-200-{i / 10:00}-{i % 10:00}",
                cities[cityCodes[i % cityCodes.Length]].Id);
        }
    }

    private static List<Company> BuildCompanies(IReadOnlyDictionary<string, City> cities)
    {
        var templates = new[]
        {
            (
                "ООО Веб-Канапе",
                "WebCanape",
                "Digital-агентство",
                "WebCanape — одно из крупнейших Digital-агентств Смоленского региона. Команда 16+ лет разрабатывает сайты, развивает интернет-маркетинг и автоматизирует бизнес-процессы клиентов. Компания развивает систему грейдов, обучение и карьерный рост в направлениях backend/frontend, аналитики, маркетинга, дизайна и проектного менеджмента.",
                "https://web-canape.ru",
                "/api/media/company-logos/webcanape/logo.jpg",
                "gavrilenkova.n@web-canape.ru",
                "+7 (906) 517-94-70"
            ),
            (
                "ООО Агентство Coalla",
                "Агентство Coalla",
                "Веб-студия",
                "Coalla Agency — веб-студия с 15-летним опытом. Команда реализовала более 300 проектов: брендинг, сложные интерфейсы, сайты и приложения, а также арт-проекты. Фокус — удобство, функциональность и измеримый результат для бизнеса.",
                "https://coalla.ru/",
                "/api/media/company-logos/coalla/logo.jpg",
                "hr@coalla.ru",
                "+7 (345) 345-34-53"
            ),
            (
                "ООО Простые решения",
                "Простые решения",
                "1С-интегратор",
                "ИТ-компания «Простые решения» — аккредитованный разработчик российского ПО и один из крупнейших 1С:франчайзи. Команда автоматизирует работу более 3500 клиентов по всей России, развивает сотрудников через наставничество, систему грейдов и внутреннее обучение.",
                "https://rabota.1eska.ru/",
                "/api/media/company-logos/prostyeresheniya/logo.jpg",
                "info@1eska.ru",
                "+7 (910) 786-99-06"
            ),
            ("АО ФинПоток", "ФинПоток", "FinTech", "Цифровые платежные сервисы и B2B-банкинг.", "https://finpotok.ru", null, null, null),
            ("ООО Доставка Плюс Тех", "Доставка Плюс", "E-commerce", "Технологии для маркетплейсов и службы доставки.", "https://dostavkaplus.ru", null, null, null),
            ("ООО Городские Сервисы", "ГорСерв", "GovTech", "Платформа цифровых городских сервисов и порталов.", "https://gorserv.ru", null, null, null),
            ("ООО МедТех Решения", "МедТех Решения", "HealthTech", "Продукты для клиник и телемедицины.", "https://medtech-solutions.ru", null, null, null),
            ("ООО ЗаводАвто Софт", "ЗаводАвто Софт", "Industrial IT", "Автоматизация производственных линий и MES.", "https://zavodauto.tech", null, null, null),
            ("ООО ЭдТрек", "ЭдТрек", "EdTech", "Онлайн-обучение и платформы развития сотрудников.", "https://edtrack.ru", null, null, null),
            ("ООО Спектр Безопасности", "Спектр Безопасности", "Cybersecurity", "Сервисы защиты инфраструктуры и SOC.", "https://spectr-sec.ru", null, null, null),
            ("ООО Облако 360", "Облако 360", "Cloud", "Миграция в облако и эксплуатация highload-систем.", "https://oblako360.ru", null, null, null),
            ("ООО Пиксель Маркетинг", "Пиксель", "MarTech", "Платформа маркетинговой аналитики и автоматизации.", "https://pixel-m.ru", null, null, null),
            ("ООО АгроСистема", "АгроСистема", "AgroTech", "Цифровизация агропредприятий и IoT-мониторинг.", "https://agrosistema.ru", null, null, null),
            ("ООО Транспорт Онлайн", "Транспорт Онлайн", "Mobility", "Сервисы управления транспортом и маршрутами.", "https://transport-online.ru", null, null, null),
            ("ООО ЭнергоКонтур", "ЭнергоКонтур", "EnergyTech", "ИТ-решения для энергетики и мониторинга сетей.", "https://energokontur.ru", null, null, null)
        };

        var cityCodes = new[] { "MOW", "LED", "SMO", "KZN", "EKB", "NVS" };
        var companies = new List<Company>(templates.Length);

        for (var i = 0; i < templates.Length; i++)
        {
            var template = templates[i];
            var cityCode = i < 3 ? "SMO" : cityCodes[i % cityCodes.Length];

            companies.Add(new Company
            {
                LegalName = template.Item1,
                BrandName = template.Item2,
                Description = template.Item4,
                LogoUrl = template is { Item6: not null } ? template.Item6 : $"/api/media/company-logos/seed/company-{i + 1:00}.svg",
                WebsiteUrl = template.Item5,
                PublicEmail = template is { Item7: not null } ? template.Item7 : $"hr{i + 1:00}@tramplin.local",
                PublicPhone = template is { Item8: not null } ? template.Item8 : $"+7 (495) 700-{10 + i:00}-{20 + i:00}",
                BaseCityId = cities[cityCode].Id,
                Status = ResolveCompanyStatus(i)
            });
        }

        return companies;
    }

    private static List<CompanyMember> BuildCompanyMembers(IReadOnlyList<Company> companies, IReadOnlyList<User> employers)
    {
        var members = new List<CompanyMember>(companies.Count * 2);
        for (var i = 0; i < companies.Count; i++)
        {
            members.Add(new CompanyMember
            {
                CompanyId = companies[i].Id,
                UserId = employers[i * 2].Id,
                Role = CompanyMemberRole.Owner
            });

            members.Add(new CompanyMember
            {
                CompanyId = companies[i].Id,
                UserId = employers[i * 2 + 1].Id,
                Role = CompanyMemberRole.Admin
            });
        }

        return members;
    }

    private static List<Vacancy> BuildVacancies(
        IReadOnlyList<Company> companies,
        IReadOnlyCollection<CompanyMember> members,
        IReadOnlyDictionary<string, LocationEntity> locations,
        DateTimeOffset now)
    {
        var templates = GetVacancyTemplates();
        var statuses = new[]
        {
            OpportunityStatus.Active,
            OpportunityStatus.PendingModeration,
            OpportunityStatus.Draft,
            OpportunityStatus.Finished,
            OpportunityStatus.Canceled,
            OpportunityStatus.Rejected,
            OpportunityStatus.Archived
        };

        var ownerByCompany = members
            .Where(x => x.Role == CompanyMemberRole.Owner)
            .ToDictionary(x => x.CompanyId, x => x.UserId);

        var cityLocationByPrefix = locations
            .GroupBy(x => x.Key.Split('_')[0], StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.Select(y => y.Value).ToArray(), StringComparer.OrdinalIgnoreCase);

        var cityCodes = new[] { "MOW", "LED", "SMO", "KZN", "EKB", "NVS" };
        var cityCodeByCompany = companies
            .Select((company, index) => new { company.Id, Code = cityCodes[index % cityCodes.Length] })
            .ToDictionary(x => x.Id, x => x.Code);

        var vacancies = new List<Vacancy>(templates.Count);
        for (var i = 0; i < templates.Count; i++)
        {
            var template = templates[i];
            var company = i < 2 ? companies[0] : companies[i % companies.Count];
            var cityCode = cityCodeByCompany[company.Id];
            var cityLocations = cityLocationByPrefix[cityCode];
            var locationId = template.Format == WorkFormat.Remote ? null : (long?)cityLocations[i % cityLocations.Length].Id;
            var status = statuses[i % statuses.Length];

            vacancies.Add(new Vacancy
            {
                CompanyId = company.Id,
                CreatedByUserId = ownerByCompany[company.Id],
                Title = template.Title,
                ShortDescription = template.ShortDescription,
                FullDescription = template.FullDescription,
                Kind = template.Kind,
                Format = template.Format,
                Status = status,
                CityId = company.BaseCityId,
                LocationId = locationId,
                SalaryFrom = template.SalaryFrom,
                SalaryTo = template.SalaryTo,
                CurrencyCode = "RUB",
                SalaryTaxMode = template.SalaryTaxMode,
                PublishAt = now.AddDays(-45 + i),
                ApplicationDeadline = status is OpportunityStatus.Finished or OpportunityStatus.Canceled or OpportunityStatus.Archived
                    ? now.AddDays(-2 + (i % 2))
                    : now.AddDays(10 + (i % 18))
            });
        }

        return vacancies;
    }

    private static List<Opportunity> BuildOpportunities(
        IReadOnlyList<Company> companies,
        IReadOnlyCollection<CompanyMember> members,
        IReadOnlyDictionary<string, LocationEntity> locations,
        DateTimeOffset now)
    {
        var templates = GetOpportunityTemplates();
        var statuses = new[]
        {
            OpportunityStatus.Active,
            OpportunityStatus.PendingModeration,
            OpportunityStatus.Draft,
            OpportunityStatus.Finished,
            OpportunityStatus.Canceled,
            OpportunityStatus.Rejected,
            OpportunityStatus.Archived
        };

        var ownerByCompany = members
            .Where(x => x.Role == CompanyMemberRole.Owner)
            .ToDictionary(x => x.CompanyId, x => x.UserId);

        var cityLocationByPrefix = locations
            .GroupBy(x => x.Key.Split('_')[0], StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.Select(y => y.Value).ToArray(), StringComparer.OrdinalIgnoreCase);

        var cityCodes = new[] { "MOW", "LED", "SMO", "KZN", "EKB", "NVS" };
        var cityCodeByCompany = companies
            .Select((company, index) => new { company.Id, Code = cityCodes[index % cityCodes.Length] })
            .ToDictionary(x => x.Id, x => x.Code);

        var opportunities = new List<Opportunity>(templates.Count);
        for (var i = 0; i < templates.Count; i++)
        {
            var template = templates[i];
            var company = companies[i % companies.Count];
            var cityCode = cityCodeByCompany[company.Id];
            var cityLocations = cityLocationByPrefix[cityCode];
            var locationId = template.Format == WorkFormat.Remote ? null : (long?)cityLocations[i % cityLocations.Length].Id;
            var status = statuses[i % statuses.Length];

            opportunities.Add(new Opportunity
            {
                CompanyId = company.Id,
                CreatedByUserId = ownerByCompany[company.Id],
                Title = template.Title,
                ShortDescription = template.ShortDescription,
                FullDescription = template.FullDescription,
                Kind = template.Kind,
                Format = template.Format,
                Status = status,
                CityId = company.BaseCityId,
                LocationId = locationId,
                PriceType = template.PriceType,
                PriceAmount = template.PriceType == PriceType.Free ? null : template.PriceAmount,
                PriceCurrencyCode = template.PriceType == PriceType.Free ? null : "RUB",
                ParticipantsCanWrite = template.ParticipantsCanWrite,
                PublishAt = now.AddDays(-30 + i),
                EventDate = now.AddDays(5 + i)
            });
        }

        return opportunities;
    }

    private static List<VacancyTag> BuildVacancyTags(IReadOnlyList<Vacancy> vacancies, IReadOnlyDictionary<string, Tag> tags)
    {
        var technologyTagKeys = new[]
        {
            "technology::C#", "technology::.NET", "technology::Java", "technology::Kotlin", "technology::Python",
            "technology::Go", "technology::React", "technology::Vue", "technology::Angular", "technology::PostgreSQL",
            "technology::Kafka", "technology::Docker", "technology::DevOps", "technology::QA", "technology::Data Science"
        };

        var rows = new List<VacancyTag>(vacancies.Count * 3);
        for (var i = 0; i < vacancies.Count; i++)
        {
            var vacancy = vacancies[i];
            var kindTag = vacancy.Kind == VacancyKind.Internship ? "vacancy_kind::Internship" : "vacancy_kind::Job";
            rows.Add(new VacancyTag { VacancyId = vacancy.Id, TagId = tags[kindTag].Id });
            rows.Add(new VacancyTag { VacancyId = vacancy.Id, TagId = tags[technologyTagKeys[i % technologyTagKeys.Length]].Id });
            rows.Add(new VacancyTag
            {
                VacancyId = vacancy.Id,
                TagId = tags[technologyTagKeys[(i + 3) % technologyTagKeys.Length]].Id
            });
        }

        return rows;
    }

    private static List<OpportunityTag> BuildOpportunityTags(IReadOnlyList<Opportunity> opportunities, IReadOnlyDictionary<string, Tag> tags)
    {
        var technologyTagKeys = new[]
        {
            "technology::C#", "technology::Python", "technology::React", "technology::Kafka",
            "technology::DevOps", "technology::Data Science", "technology::PostgreSQL"
        };

        var rows = new List<OpportunityTag>(opportunities.Count * 2);
        for (var i = 0; i < opportunities.Count; i++)
        {
            var opportunity = opportunities[i];
            var kindTag = opportunity.Kind switch
            {
                OpportunityKind.Hackathon => "event_kind::Hackathon",
                OpportunityKind.OpenDay => "event_kind::Open Day",
                OpportunityKind.Lecture => "event_kind::Lecture",
                _ => "event_kind::Other"
            };

            rows.Add(new OpportunityTag { OpportunityId = opportunity.Id, TagId = tags[kindTag].Id });
            rows.Add(new OpportunityTag
            {
                OpportunityId = opportunity.Id,
                TagId = tags[technologyTagKeys[i % technologyTagKeys.Length]].Id
            });
        }

        return rows;
    }

    private static List<OpportunityParticipant> BuildOpportunityParticipations(
        IReadOnlyList<Opportunity> opportunities,
        IReadOnlyList<User> seekers,
        DateTimeOffset now)
    {
        var rows = new List<OpportunityParticipant>();
        var seen = new HashSet<(long OpportunityId, long UserId)>();

        for (var i = 0; i < opportunities.Count; i++)
        {
            var participantsCount = (i % 4) + 1;
            for (var j = 0; j < participantsCount; j++)
            {
                var seeker = seekers[(i + j) % seekers.Count];
                var key = (opportunities[i].Id, seeker.Id);
                if (!seen.Add(key))
                {
                    continue;
                }

                rows.Add(new OpportunityParticipant
                {
                    OpportunityId = opportunities[i].Id,
                    UserId = seeker.Id,
                    JoinedAt = now.AddDays(-(i % 12)).AddHours(-j * 3)
                });
            }
        }

        return rows;
    }

    private async Task SeedOpportunityChatsAsync(
        IReadOnlyList<Opportunity> opportunities,
        IReadOnlyCollection<OpportunityParticipant> participations,
        IReadOnlyCollection<CompanyMember> companyMembers,
        DateTimeOffset now)
    {
        var chats = opportunities.Select(x => new Chat
        {
            Type = ChatType.Opportunity,
            OpportunityId = x.Id
        }).ToArray();

        dbContext.Chats.AddRange(chats);
        await dbContext.SaveChangesAsync();

        var ownerByCompany = companyMembers
            .Where(x => x.Role == CompanyMemberRole.Owner)
            .ToDictionary(x => x.CompanyId, x => x.UserId);
        var adminByCompany = companyMembers
            .Where(x => x.Role == CompanyMemberRole.Admin)
            .ToDictionary(x => x.CompanyId, x => x.UserId);
        var chatByOpportunityId = chats.ToDictionary(x => x.OpportunityId!.Value, x => x.Id);

        var chatParticipants = new List<ChatParticipant>();
        foreach (var opportunity in opportunities)
        {
            var chatId = chatByOpportunityId[opportunity.Id];
            chatParticipants.Add(new ChatParticipant { ChatId = chatId, UserId = ownerByCompany[opportunity.CompanyId], CreatedAt = now });
            chatParticipants.Add(new ChatParticipant { ChatId = chatId, UserId = adminByCompany[opportunity.CompanyId], CreatedAt = now });

            foreach (var participant in participations.Where(x => x.OpportunityId == opportunity.Id))
            {
                chatParticipants.Add(new ChatParticipant { ChatId = chatId, UserId = participant.UserId, CreatedAt = participant.JoinedAt });
            }
        }

        dbContext.ChatParticipants.AddRange(chatParticipants
            .GroupBy(x => new { x.ChatId, x.UserId })
            .Select(x => x.First()));

        var messages = new List<ChatMessage>();
        foreach (var opportunity in opportunities)
        {
            var chatId = chatByOpportunityId[opportunity.Id];
            var ownerId = ownerByCompany[opportunity.CompanyId];
            var seekerId = participations.FirstOrDefault(x => x.OpportunityId == opportunity.Id)?.UserId;

            messages.Add(new ChatMessage
            {
                ChatId = chatId,
                SenderUserId = ownerId,
                Text = $"Добро пожаловать в чат мероприятия «{opportunity.Title}».",
                IsSystem = false,
                CreatedAt = now.AddHours(-(opportunity.Id % 48))
            });

            if (opportunity.ParticipantsCanWrite && seekerId is not null)
            {
                messages.Add(new ChatMessage
                {
                    ChatId = chatId,
                    SenderUserId = seekerId.Value,
                    Text = "Спасибо! Подскажите, пожалуйста, расписание и требования к участию.",
                    IsSystem = false,
                    CreatedAt = now.AddHours(-(opportunity.Id % 24))
                });
            }
            else
            {
                messages.Add(new ChatMessage
                {
                    ChatId = chatId,
                    SenderUserId = ownerId,
                    Text = "В этом чате включен режим только чтения для участников.",
                    IsSystem = false,
                    CreatedAt = now.AddHours(-(opportunity.Id % 24))
                });
            }
        }

        dbContext.ChatMessages.AddRange(messages);
        await dbContext.SaveChangesAsync();
    }

    private static List<Application> BuildApplications(IReadOnlyList<Vacancy> vacancies, IReadOnlyList<User> seekers)
    {
        var statuses = new[]
        {
            ApplicationStatus.New,
            ApplicationStatus.InReview,
            ApplicationStatus.Interview,
            ApplicationStatus.Offer,
            ApplicationStatus.Hired,
            ApplicationStatus.Rejected,
            ApplicationStatus.Canceled
        };

        var targetVacancies = vacancies
            .Where(x => x.Status != OpportunityStatus.Archived)
            .ToArray();

        var applications = new List<Application>(45);
        for (var i = 0; i < 45; i++)
        {
            var vacancy = targetVacancies[i % targetVacancies.Length];
            var seeker = seekers[i % seekers.Count];
            applications.Add(new Application
            {
                CompanyId = vacancy.CompanyId,
                CandidateUserId = seeker.Id,
                VacancyId = vacancy.Id,
                InitiatorRole = i % 4 == 0 ? PlatformRole.Employer : PlatformRole.Seeker,
                Status = statuses[i % statuses.Length]
            });
        }

        return applications;
    }

    private async Task SeedApplicationChatsAsync(IReadOnlyList<Application> applications, IReadOnlyCollection<CompanyMember> companyMembers)
    {
        var chats = applications.Select(application => new Chat
        {
            Type = ChatType.Application,
            ApplicationId = application.Id
        }).ToArray();
        dbContext.Chats.AddRange(chats);
        await dbContext.SaveChangesAsync();

        var ownerByCompany = companyMembers
            .Where(x => x.Role == CompanyMemberRole.Owner)
            .ToDictionary(x => x.CompanyId, x => x.UserId);
        var adminByCompany = companyMembers
            .Where(x => x.Role == CompanyMemberRole.Admin)
            .ToDictionary(x => x.CompanyId, x => x.UserId);

        var participants = new List<ChatParticipant>(applications.Count * 3);
        var messages = new List<ChatMessage>(applications.Count * 2);

        for (var i = 0; i < applications.Count; i++)
        {
            var application = applications[i];
            var chatId = chats[i].Id;
            var ownerId = ownerByCompany[application.CompanyId];
            var adminId = adminByCompany[application.CompanyId];

            participants.Add(new ChatParticipant { ChatId = chatId, UserId = application.CandidateUserId });
            participants.Add(new ChatParticipant { ChatId = chatId, UserId = ownerId });
            participants.Add(new ChatParticipant { ChatId = chatId, UserId = adminId });

            messages.Add(new ChatMessage
            {
                ChatId = chatId,
                SenderUserId = ownerId,
                Text = "Спасибо за отклик! Мы изучаем ваше резюме и вернемся с обратной связью.",
                IsSystem = true
            });

            if (i % 2 == 0)
            {
                messages.Add(new ChatMessage
                {
                    ChatId = chatId,
                    SenderUserId = application.CandidateUserId,
                    Text = "Добрый день! Готов ответить на дополнительные вопросы по опыту.",
                    IsSystem = false
                });
            }
        }

        dbContext.ChatParticipants.AddRange(participants
            .GroupBy(x => new { x.ChatId, x.UserId })
            .Select(x => x.First()));
        dbContext.ChatMessages.AddRange(messages);

        await dbContext.SaveChangesAsync();
    }

    private async Task SeedDirectChatsAsync(IReadOnlyList<User> seekers)
    {
        var directChats = new List<Chat>();
        for (var i = 0; i < 8; i++)
        {
            directChats.Add(new Chat { Type = ChatType.Direct });
        }

        dbContext.Chats.AddRange(directChats);
        await dbContext.SaveChangesAsync();

        var directParticipants = new List<ChatParticipant>();
        var directMessages = new List<ChatMessage>();

        for (var i = 0; i < directChats.Count; i++)
        {
            var first = seekers[i % seekers.Count];
            var second = seekers[(i + 1) % seekers.Count];

            directParticipants.Add(new ChatParticipant { ChatId = directChats[i].Id, UserId = first.Id });
            directParticipants.Add(new ChatParticipant { ChatId = directChats[i].Id, UserId = second.Id });

            directMessages.Add(new ChatMessage
            {
                ChatId = directChats[i].Id,
                SenderUserId = first.Id,
                Text = "Привет! Давай обменяемся опытом по собеседованиям в ИТ.",
                IsSystem = false
            });
        }

        dbContext.ChatParticipants.AddRange(directParticipants);
        dbContext.ChatMessages.AddRange(directMessages);
        await dbContext.SaveChangesAsync();
    }

    private async Task<List<User>> EnsureSeekersWithProfilesAsync(
        int targetCount,
        FioSeed fioSeeds,
        IReadOnlyList<string> avatarUrls,
        IReadOnlyDictionary<string, City> cities,
        IReadOnlyDictionary<string, Tag> tags,
        IReadOnlyList<Company> companies,
        DateTimeOffset assignedAt)
    {
        var random = new Random(20260330);
        var seekers = new List<User>(targetCount);
        var cityIds = cities.Values.Select(x => x.Id).ToArray();
        var technologyTags = tags
            .Where(x => x.Key.StartsWith("technology::", StringComparison.OrdinalIgnoreCase))
            .Select(x => x.Value)
            .DistinctBy(x => x.Id)
            .ToArray();

        if (cityIds.Length == 0)
        {
            throw new InvalidOperationException("Не найдено ни одного города для заполнения профилей соискателей.");
        }

        for (var i = 0; i < targetCount; i++)
        {
            var lastName = fioSeeds.LastNames[random.Next(fioSeeds.LastNames.Count)];
            var firstName = fioSeeds.FirstNames[random.Next(fioSeeds.FirstNames.Count)];
            var middleName = fioSeeds.MiddleNames[random.Next(fioSeeds.MiddleNames.Count)];
            var fio = $"{lastName} {firstName} {middleName}".Trim();
            var avatarUrl = avatarUrls.Count == 0
                ? "/api/media/user-avatars/system/seeker.svg"
                : avatarUrls[random.Next(avatarUrls.Count)];
            var cityId = cityIds[random.Next(cityIds.Length)];

            var seeker = await EnsureUserAsync(
                $"seeker{i + 1:00}@tramplin.local",
                fio,
                "Seeker123!",
                AccountStatus.Active,
                avatarUrl);
            seeker.Fio = fio;
            seeker.AvatarUrl = avatarUrl;
            await EnsureRoleAsync(seeker.Id, PlatformRole.Seeker, assignedAt);
            seekers.Add(seeker);

            var profile = await dbContext.CandidateProfiles.FirstOrDefaultAsync(x => x.UserId == seeker.Id);
            if (profile is null)
            {
                profile = new CandidateProfile
                {
                    UserId = seeker.Id,
                    Fio = fio,
                    BirthDate = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddYears(-22 - random.Next(12)).AddDays(random.Next(365))),
                    Gender = random.Next(2) == 0 ? CandidateGender.Male : CandidateGender.Female,
                    Phone = $"+7 (9{random.Next(10)}) {random.Next(100):000}-{random.Next(100):00}-{random.Next(100):00}",
                    CityId = cityId,
                    About = BuildSeekerAbout(firstName),
                    AvatarUrl = avatarUrl
                };
                dbContext.CandidateProfiles.Add(profile);
            }
            else
            {
                profile.Fio = fio;
                profile.CityId = cityId;
                profile.Phone ??= $"+7 (900) 100-{i / 10:00}-{i % 10:00}";
                profile.AvatarUrl = avatarUrl;
                profile.About ??= BuildSeekerAbout(firstName);
            }

            var privacy = await dbContext.CandidatePrivacySettings.FirstOrDefaultAsync(x => x.UserId == seeker.Id);
            if (privacy is null)
            {
                dbContext.CandidatePrivacySettings.Add(new CandidatePrivacySettings
                {
                    UserId = seeker.Id,
                    ProfileVisibility = PrivacyScope.AuthorizedUsers,
                    ResumeVisibility = PrivacyScope.AuthorizedUsers,
                    OpenToWork = true,
                    ShowContactsInResume = true,
                    ShowInFriendsFavorites = true,
                    ShowInFriendsApplications = true
                });
            }
            else
            {
                privacy.OpenToWork = true;
                privacy.ShowContactsInResume = true;
                privacy.ShowInFriendsFavorites = true;
                privacy.ShowInFriendsApplications = true;
            }

            var resume = await dbContext.CandidateResumeProfiles.FirstOrDefaultAsync(x => x.UserId == seeker.Id);
            if (resume is null)
            {
                resume = new CandidateResumeProfile
                {
                    UserId = seeker.Id
                };
                dbContext.CandidateResumeProfiles.Add(resume);
            }

            resume.Headline = BuildResumeHeadline(firstName);
            resume.DesiredPosition = BuildDesiredPosition(firstName);
            resume.Summary = BuildResumeSummary(firstName);
            resume.SalaryFrom = 70000 + random.Next(12) * 10000;
            resume.SalaryTo = resume.SalaryFrom + 60000 + random.Next(9) * 10000;
            resume.CurrencyCode = "RUB";

            var skillRows = await dbContext.CandidateResumeSkills.Where(x => x.UserId == seeker.Id).ToListAsync();
            var experienceRows = await dbContext.CandidateResumeExperiences.Where(x => x.UserId == seeker.Id).ToListAsync();
            var educationRows = await dbContext.CandidateResumeEducation.Where(x => x.UserId == seeker.Id).ToListAsync();
            var resumeLinkRows = await dbContext.CandidateResumeLinks.Where(x => x.UserId == seeker.Id).ToListAsync();
            var publicLinkRows = await dbContext.UserPublicLinks.Where(x => x.UserId == seeker.Id).ToListAsync();

            if (skillRows.Count > 0) dbContext.CandidateResumeSkills.RemoveRange(skillRows);
            if (experienceRows.Count > 0) dbContext.CandidateResumeExperiences.RemoveRange(experienceRows);
            if (educationRows.Count > 0) dbContext.CandidateResumeEducation.RemoveRange(educationRows);
            if (resumeLinkRows.Count > 0) dbContext.CandidateResumeLinks.RemoveRange(resumeLinkRows);
            if (publicLinkRows.Count > 0) dbContext.UserPublicLinks.RemoveRange(publicLinkRows);

            var selectedSkills = technologyTags
                .OrderBy(_ => random.Next())
                .Take(Math.Min(4, technologyTags.Length))
                .ToArray();
            foreach (var selectedSkill in selectedSkills)
            {
                dbContext.CandidateResumeSkills.Add(new CandidateResumeSkill
                {
                    UserId = seeker.Id,
                    TagId = selectedSkill.Id,
                    Level = random.Next(2, 6),
                    YearsExperience = Math.Round((decimal)(0.5 + random.NextDouble() * 6), 1)
                });
            }

            var primaryCompany = companies[(i + random.Next(companies.Count)) % companies.Count];
            dbContext.CandidateResumeExperiences.Add(new CandidateResumeExperience
            {
                UserId = seeker.Id,
                CompanyId = primaryCompany.Id,
                CompanyName = primaryCompany.BrandName ?? primaryCompany.LegalName,
                Position = resume.DesiredPosition ?? "Специалист",
                Description = "Разработка и улучшение продуктовых функций, командное взаимодействие, работа с обратной связью пользователей.",
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddYears(-1 - random.Next(4)).AddMonths(-random.Next(11))),
                EndDate = random.Next(4) == 0 ? null : DateOnly.FromDateTime(DateTime.UtcNow.Date.AddMonths(-random.Next(1, 7))),
                IsCurrent = random.Next(4) == 0
            });

            dbContext.CandidateResumeEducation.Add(new CandidateResumeEducation
            {
                UserId = seeker.Id,
                University = random.Next(2) == 0 ? "НИУ ВШЭ" : "СмолГУ",
                Faculty = random.Next(2) == 0 ? "Информационные технологии" : "Прикладная математика",
                Specialty = random.Next(2) == 0 ? "Разработка ПО" : "Аналитика и цифровые продукты",
                Course = random.Next(2, 5),
                GraduationYear = DateTime.UtcNow.Year + random.Next(-2, 2)
            });

            dbContext.CandidateResumeLinks.Add(new CandidateResumeLink
            {
                UserId = seeker.Id,
                Kind = "github",
                Url = $"https://github.com/{TransliterateToAscii(firstName.ToLowerInvariant())}{i + 1:00}",
                Label = "GitHub"
            });
            dbContext.CandidateResumeLinks.Add(new CandidateResumeLink
            {
                UserId = seeker.Id,
                Kind = "portfolio",
                Url = $"https://portfolio.tramplin.local/{seeker.Id}",
                Label = "Портфолио"
            });

            dbContext.UserPublicLinks.Add(new UserPublicLink
            {
                UserId = seeker.Id,
                Kind = "telegram",
                Url = $"https://t.me/{TransliterateToAscii(firstName.ToLowerInvariant())}_{i + 10}",
                Label = "Telegram",
                SortOrder = 0
            });
            dbContext.UserPublicLinks.Add(new UserPublicLink
            {
                UserId = seeker.Id,
                Kind = "website",
                Url = $"https://tramplin.local/u/{seeker.Id}",
                Label = "Публичный профиль",
                SortOrder = 1
            });
        }

        await dbContext.SaveChangesAsync();
        return seekers;
    }

    private static List<OpportunityParticipant> BuildOpportunityParticipationsForAllSeekers(
        IReadOnlyList<Opportunity> opportunities,
        IReadOnlyList<User> seekers,
        DateTimeOffset now)
    {
        var result = new List<OpportunityParticipant>(seekers.Count * 2);
        var seen = new HashSet<(long OpportunityId, long UserId)>();

        for (var i = 0; i < seekers.Count; i++)
        {
            var primaryOpportunity = opportunities[i % opportunities.Count];
            if (seen.Add((primaryOpportunity.Id, seekers[i].Id)))
            {
                result.Add(new OpportunityParticipant
                {
                    OpportunityId = primaryOpportunity.Id,
                    UserId = seekers[i].Id,
                    JoinedAt = now.AddDays(-(i % 14)).AddHours(-(i % 5))
                });
            }

            if (i % 2 == 0)
            {
                var secondaryOpportunity = opportunities[(i + 3) % opportunities.Count];
                if (seen.Add((secondaryOpportunity.Id, seekers[i].Id)))
                {
                    result.Add(new OpportunityParticipant
                    {
                        OpportunityId = secondaryOpportunity.Id,
                        UserId = seekers[i].Id,
                        JoinedAt = now.AddDays(-(i % 8)).AddHours(-2)
                    });
                }
            }
        }

        return result;
    }

    private async Task SeedPortfolioProjectsForAllSeekersAsync(
        IReadOnlyList<User> seekers,
        IReadOnlyList<Vacancy> vacancies,
        IReadOnlyList<Opportunity> opportunities,
        IReadOnlyList<string> portfolioPhotoUrls,
        DateTimeOffset now)
    {
        var projectTitles = new[]
        {
            "CRM-модуль для отдела продаж",
            "Сервис аналитики рекламных кампаний",
            "Панель мониторинга инцидентов",
            "Витрина данных для маркетинга",
            "Платформа внутреннего обучения",
            "Конструктор отчётов для бизнеса"
        };
        var projectRoles = new[]
        {
            "Backend-разработчик",
            "Frontend-разработчик",
            "QA-инженер",
            "Аналитик",
            "Продакт-менеджер",
            "Data Engineer"
        };

        var projects = new List<CandidateResumeProject>(seekers.Count);
        for (var i = 0; i < seekers.Count; i++)
        {
            projects.Add(new CandidateResumeProject
            {
                UserId = seekers[i].Id,
                Title = $"{projectTitles[i % projectTitles.Length]} #{i + 1}",
                Role = projectRoles[i % projectRoles.Length],
                Description = "Реальный учебно-производственный проект: планирование, реализация, тестирование и выпуск результата в команде.",
                StartDate = DateOnly.FromDateTime(now.AddMonths(-8 - (i % 6)).Date),
                EndDate = i % 5 == 0 ? null : DateOnly.FromDateTime(now.AddMonths(-(i % 3)).Date),
                RepoUrl = $"https://github.com/tramplin-demo/project-{i + 1:00}",
                DemoUrl = $"https://demo.tramplin.local/projects/{i + 1:00}"
            });
        }

        dbContext.CandidateResumeProjects.AddRange(projects);
        await dbContext.SaveChangesAsync();

        var photos = new List<CandidateResumeProjectPhoto>(projects.Count * 2);
        var participants = new List<CandidateResumeProjectParticipant>(projects.Count * 2);
        var collaborations = new List<CandidateResumeProjectCollaboration>(projects.Count * 3);

        for (var i = 0; i < projects.Count; i++)
        {
            var project = projects[i];
            var owner = seekers[i];
            var collaborator = seekers[(i + 1) % seekers.Count];
            var mainPhoto = portfolioPhotoUrls.Count == 0
                ? "/api/media/user-avatars/system/seeker.svg"
                : portfolioPhotoUrls[i % portfolioPhotoUrls.Count];

            photos.Add(new CandidateResumeProjectPhoto
            {
                ProjectId = project.Id,
                Url = mainPhoto,
                SortOrder = 0,
                IsMain = true
            });

            if (portfolioPhotoUrls.Count > 1)
            {
                photos.Add(new CandidateResumeProjectPhoto
                {
                    ProjectId = project.Id,
                    Url = portfolioPhotoUrls[(i + 1) % portfolioPhotoUrls.Count],
                    SortOrder = 1,
                    IsMain = false
                });
            }

            participants.Add(new CandidateResumeProjectParticipant
            {
                ProjectId = project.Id,
                UserId = owner.Id,
                Role = project.Role ?? "Участник"
            });
            participants.Add(new CandidateResumeProjectParticipant
            {
                ProjectId = project.Id,
                UserId = collaborator.Id,
                Role = "Коллаборатор"
            });

            collaborations.Add(new CandidateResumeProjectCollaboration
            {
                ProjectId = project.Id,
                Type = PortfolioCollaborationType.User,
                UserId = collaborator.Id,
                Label = "Совместная работа по фиче",
                SortOrder = 0
            });
            collaborations.Add(new CandidateResumeProjectCollaboration
            {
                ProjectId = project.Id,
                Type = PortfolioCollaborationType.Vacancy,
                VacancyId = vacancies[i % vacancies.Count].Id,
                Label = "Связано с откликом на вакансию",
                SortOrder = 1
            });
            collaborations.Add(new CandidateResumeProjectCollaboration
            {
                ProjectId = project.Id,
                Type = PortfolioCollaborationType.Opportunity,
                OpportunityId = opportunities[i % opportunities.Count].Id,
                Label = "Результат участия в мероприятии",
                SortOrder = 2
            });
        }

        dbContext.CandidateResumeProjectPhotos.AddRange(photos);
        dbContext.CandidateResumeProjectParticipants.AddRange(participants);
        dbContext.CandidateResumeProjectCollaborations.AddRange(collaborations);
        await dbContext.SaveChangesAsync();
    }

    private static List<Application> BuildApplicationsForAllSeekers(
        IReadOnlyList<Vacancy> vacancies,
        IReadOnlyList<User> seekers,
        DateTimeOffset now)
    {
        var statuses = new[]
        {
            ApplicationStatus.New,
            ApplicationStatus.InReview,
            ApplicationStatus.Interview,
            ApplicationStatus.Offer
        };

        var applications = new List<Application>(seekers.Count * 2);
        var seen = new HashSet<(long UserId, long VacancyId)>();

        for (var i = 0; i < seekers.Count; i++)
        {
            for (var j = 0; j < 2; j++)
            {
                var vacancy = vacancies[(i + j * 7) % vacancies.Count];
                if (!seen.Add((seekers[i].Id, vacancy.Id)))
                {
                    continue;
                }

                applications.Add(new Application
                {
                    CompanyId = vacancy.CompanyId,
                    CandidateUserId = seekers[i].Id,
                    VacancyId = vacancy.Id,
                    InitiatorRole = PlatformRole.Seeker,
                    Status = statuses[(i + j) % statuses.Length],
                    CreatedAt = now.AddDays(-(i % 15)).AddHours(-j),
                    UpdatedAt = now.AddDays(-(i % 15))
                });
            }
        }

        return applications;
    }

    private async Task SeedSocialGraphAsync(
        IReadOnlyList<User> seekers,
        IReadOnlyList<Vacancy> vacancies,
        IReadOnlyList<Opportunity> opportunities,
        IReadOnlyList<Application> applications,
        IReadOnlyList<OpportunityParticipant> participations,
        DateTimeOffset now)
    {
        var subscriptions = new List<UserSubscription>(seekers.Count * 3);
        var subscriptionSeen = new HashSet<(long Follower, long Following)>();

        for (var i = 0; i < seekers.Count; i++)
        {
            var follower = seekers[i].Id;
            var firstFollowing = seekers[(i + 1) % seekers.Count].Id;
            var secondFollowing = seekers[(i + 2) % seekers.Count].Id;

            if (subscriptionSeen.Add((follower, firstFollowing)))
            {
                subscriptions.Add(new UserSubscription
                {
                    FollowerUserId = follower,
                    FollowingUserId = firstFollowing,
                    CreatedAt = now.AddDays(-(i % 7))
                });
            }

            if (subscriptionSeen.Add((firstFollowing, follower)))
            {
                subscriptions.Add(new UserSubscription
                {
                    FollowerUserId = firstFollowing,
                    FollowingUserId = follower,
                    CreatedAt = now.AddDays(-(i % 7)).AddMinutes(-10)
                });
            }

            if (subscriptionSeen.Add((follower, secondFollowing)))
            {
                subscriptions.Add(new UserSubscription
                {
                    FollowerUserId = follower,
                    FollowingUserId = secondFollowing,
                    CreatedAt = now.AddDays(-(i % 5)).AddMinutes(-20)
                });
            }
        }

        var contacts = new List<UserContact>(seekers.Count);
        var contactSeen = new HashSet<(long User, long Contact)>();
        for (var i = 0; i < seekers.Count; i += 2)
        {
            var first = seekers[i].Id;
            var second = seekers[(i + 1) % seekers.Count].Id;

            if (contactSeen.Add((first, second)))
            {
                contacts.Add(new UserContact
                {
                    UserId = first,
                    ContactUserId = second,
                    CreatedAt = now.AddDays(-(i % 6))
                });
            }

            if (contactSeen.Add((second, first)))
            {
                contacts.Add(new UserContact
                {
                    UserId = second,
                    ContactUserId = first,
                    CreatedAt = now.AddDays(-(i % 6)).AddMinutes(-5)
                });
            }
        }

        var contactRequests = new List<ContactRequest>(seekers.Count / 2);
        for (var i = 0; i < seekers.Count; i += 3)
        {
            contactRequests.Add(new ContactRequest
            {
                FromUserId = seekers[i].Id,
                ToUserId = seekers[(i + 2) % seekers.Count].Id,
                Status = i % 2 == 0 ? ContactRequestStatus.Pending : ContactRequestStatus.Accepted,
                CreatedAt = now.AddDays(-(i % 4)),
                UpdatedAt = now.AddDays(-(i % 3))
            });
        }

        var favorites = new List<UserOpportunityFavorite>(seekers.Count * 2);
        for (var i = 0; i < seekers.Count; i++)
        {
            favorites.Add(new UserOpportunityFavorite
            {
                UserId = seekers[i].Id,
                VacancyId = vacancies[i % vacancies.Count].Id,
                OpportunityId = null,
                CreatedAt = now.AddDays(-(i % 8))
            });
            favorites.Add(new UserOpportunityFavorite
            {
                UserId = seekers[i].Id,
                VacancyId = null,
                OpportunityId = opportunities[(i + 3) % opportunities.Count].Id,
                CreatedAt = now.AddDays(-(i % 6)).AddMinutes(-15)
            });
        }

        dbContext.UserSubscriptions.AddRange(subscriptions);
        dbContext.UserContacts.AddRange(contacts);
        dbContext.ContactRequests.AddRange(contactRequests);
        dbContext.UserOpportunityFavorites.AddRange(favorites);

        await dbContext.SaveChangesAsync();
    }

    private async Task<User> EnsureUserAsync(string email, string fullName, string password, AccountStatus status, string? avatarUrl = null)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail);
        if (user is not null)
        {
            if (string.IsNullOrWhiteSpace(user.Username))
            {
                user.Username = await UsernameGenerator.GenerateUniqueAsync(dbContext, fullName, CancellationToken.None);
            }

            if (!string.IsNullOrWhiteSpace(avatarUrl) && string.IsNullOrWhiteSpace(user.AvatarUrl))
            {
                user.AvatarUrl = avatarUrl;
            }

            await dbContext.SaveChangesAsync();
            return user;
        }

        user = new User
        {
            Email = normalizedEmail,
            Username = await UsernameGenerator.GenerateUniqueAsync(dbContext, fullName, CancellationToken.None),
            Fio = fullName,
            AvatarUrl = avatarUrl,
            PasswordHash = passwordHasher.HashPassword(password),
            Status = status
        };

        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();
        return user;
    }

    private async Task EnsureRoleAsync(long userId, PlatformRole role, DateTimeOffset assignedAt)
    {
        if (await dbContext.UserRoles.AnyAsync(x => x.UserId == userId && x.Role == role))
        {
            return;
        }

        dbContext.UserRoles.Add(new UserRole
        {
            UserId = userId,
            Role = role,
            AssignedAt = assignedAt
        });

        await dbContext.SaveChangesAsync();
    }

    private async Task EnsureSingleSuperCuratorAsync(long superCuratorUserId)
    {
        var extraCuratorRoles = await dbContext.UserRoles
            .Where(x => x.Role == PlatformRole.Curator && x.UserId != superCuratorUserId)
            .ToListAsync();

        if (extraCuratorRoles.Count == 0)
        {
            return;
        }

        dbContext.UserRoles.RemoveRange(extraCuratorRoles);
        await dbContext.SaveChangesAsync();
    }

    private async Task EnsureSeekerProfileAsync(long userId, string lastName, string firstName, string middleName, string phone, long cityId)
    {
        var profile = await dbContext.CandidateProfiles.FirstOrDefaultAsync(x => x.UserId == userId);
        if (profile is null)
        {
            dbContext.CandidateProfiles.Add(new CandidateProfile
            {
                UserId = userId,
                Fio = $"{lastName} {firstName} {middleName}".Trim(),
                Phone = phone,
                CityId = cityId,
                About = "Соискатель в IT-сфере",
                AvatarUrl = "/api/media/user-avatars/system/seeker.svg"
            });
            await dbContext.SaveChangesAsync();
        }
        else if (profile.CityId is null)
        {
            profile.CityId = cityId;
            await dbContext.SaveChangesAsync();
        }

        if (!await dbContext.CandidatePrivacySettings.AnyAsync(x => x.UserId == userId))
        {
            dbContext.CandidatePrivacySettings.Add(new CandidatePrivacySettings
            {
                UserId = userId,
                ProfileVisibility = PrivacyScope.AuthorizedUsers,
                ResumeVisibility = PrivacyScope.AuthorizedUsers,
                OpenToWork = true,
                ShowContactsInResume = true
            });
            await dbContext.SaveChangesAsync();
        }

        if (!await dbContext.CandidateResumeProfiles.AnyAsync(x => x.UserId == userId))
        {
            dbContext.CandidateResumeProfiles.Add(new CandidateResumeProfile
            {
                UserId = userId,
                Headline = "Junior/Middle IT-специалист",
                DesiredPosition = "Разработчик или аналитик",
                Summary = "Ищу проекты с сильной командой и понятным треком развития.",
                SalaryFrom = 80000,
                SalaryTo = 180000,
                CurrencyCode = "RUB"
            });
            await dbContext.SaveChangesAsync();
        }
    }

    private async Task<Dictionary<string, City>> EnsureCitiesAsync()
    {
        var seeds = new[]
        {
            new { Code = "MOW", CountryCode = "RU", RegionName = "Москва", CityName = "Москва", Latitude = 55.7558m, Longitude = 37.6176m },
            new { Code = "LED", CountryCode = "RU", RegionName = "Санкт-Петербург", CityName = "Санкт-Петербург", Latitude = 59.9343m, Longitude = 30.3351m },
            new { Code = "SMO", CountryCode = "RU", RegionName = "Смоленская область", CityName = "Смоленск", Latitude = 54.7826m, Longitude = 32.0453m },
            new { Code = "KZN", CountryCode = "RU", RegionName = "Республика Татарстан", CityName = "Казань", Latitude = 55.7961m, Longitude = 49.1064m },
            new { Code = "EKB", CountryCode = "RU", RegionName = "Свердловская область", CityName = "Екатеринбург", Latitude = 56.8389m, Longitude = 60.6057m },
            new { Code = "NVS", CountryCode = "RU", RegionName = "Новосибирская область", CityName = "Новосибирск", Latitude = 55.0084m, Longitude = 82.9357m }
        };

        foreach (var city in seeds)
        {
            var exists = await dbContext.Cities.AnyAsync(x =>
                x.CountryCode == city.CountryCode &&
                x.RegionName == city.RegionName &&
                x.CityName == city.CityName);
            if (!exists)
            {
                dbContext.Cities.Add(new City
                {
                    CountryCode = city.CountryCode,
                    RegionName = city.RegionName,
                    CityName = city.CityName,
                    Latitude = city.Latitude,
                    Longitude = city.Longitude
                });
            }
        }

        await dbContext.SaveChangesAsync();

        var cities = await dbContext.Cities
            .AsNoTracking()
            .Where(x =>
                x.CityName == "Москва" ||
                x.CityName == "Санкт-Петербург" ||
                x.CityName == "Смоленск" ||
                x.CityName == "Казань" ||
                x.CityName == "Екатеринбург" ||
                x.CityName == "Новосибирск")
            .ToListAsync();

        return new Dictionary<string, City>(StringComparer.OrdinalIgnoreCase)
        {
            ["MOW"] = cities.First(x => x.CityName == "Москва"),
            ["LED"] = cities.First(x => x.CityName == "Санкт-Петербург"),
            ["SMO"] = cities.First(x => x.CityName == "Смоленск"),
            ["KZN"] = cities.First(x => x.CityName == "Казань"),
            ["EKB"] = cities.First(x => x.CityName == "Екатеринбург"),
            ["NVS"] = cities.First(x => x.CityName == "Новосибирск")
        };
    }

    private async Task<Dictionary<string, LocationEntity>> EnsureLocationsAsync(IReadOnlyDictionary<string, City> cities)
    {
        var geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);
        var seeds = new[]
        {
            new { Key = "MOW_OFFICE_1", CityCode = "MOW", Street = "Льва Толстого", House = "16", Lat = 55.7339, Lng = 37.5872 },
            new { Key = "MOW_OFFICE_2", CityCode = "MOW", Street = "Ленинградский проспект", House = "39", Lat = 55.7900, Lng = 37.5420 },
            new { Key = "LED_OFFICE_1", CityCode = "LED", Street = "Невский проспект", House = "1", Lat = 59.9343, Lng = 30.3351 },
            new { Key = "LED_OFFICE_2", CityCode = "LED", Street = "Большая Морская", House = "18", Lat = 59.9327, Lng = 30.3128 },
            new { Key = "SMO_OFFICE_1", CityCode = "SMO", Street = "Тенишевой", House = "22", Lat = 54.7826, Lng = 32.0453 },
            new { Key = "SMO_OFFICE_2", CityCode = "SMO", Street = "Николаева", House = "12", Lat = 54.7801, Lng = 32.0411 },
            new { Key = "KZN_OFFICE_1", CityCode = "KZN", Street = "Пушкина", House = "52", Lat = 55.7961, Lng = 49.1064 },
            new { Key = "KZN_OFFICE_2", CityCode = "KZN", Street = "Петербургская", House = "50", Lat = 55.7840, Lng = 49.1242 },
            new { Key = "EKB_OFFICE_1", CityCode = "EKB", Street = "Малышева", House = "51", Lat = 56.8389, Lng = 60.6057 },
            new { Key = "EKB_OFFICE_2", CityCode = "EKB", Street = "8 Марта", House = "10", Lat = 56.8312, Lng = 60.6046 },
            new { Key = "NVS_OFFICE_1", CityCode = "NVS", Street = "Красный проспект", House = "17", Lat = 55.0084, Lng = 82.9357 },
            new { Key = "NVS_OFFICE_2", CityCode = "NVS", Street = "Фрунзе", House = "5", Lat = 55.0325, Lng = 82.9203 }
        };

        var result = new Dictionary<string, LocationEntity>(StringComparer.OrdinalIgnoreCase);
        foreach (var seed in seeds)
        {
            var cityId = cities[seed.CityCode].Id;
            var location = await dbContext.Locations.FirstOrDefaultAsync(x =>
                x.CityId == cityId &&
                x.StreetName == seed.Street &&
                x.HouseNumber == seed.House);

            if (location is null)
            {
                location = new LocationEntity
                {
                    CityId = cityId,
                    GeoPoint = geometryFactory.CreatePoint(new Coordinate(seed.Lng, seed.Lat)),
                    StreetName = seed.Street,
                    HouseNumber = seed.House
                };

                dbContext.Locations.Add(location);
                await dbContext.SaveChangesAsync();
            }

            result[seed.Key] = location;
        }

        return result;
    }

    private async Task<Dictionary<string, Tag>> EnsureTagsAsync()
    {
        var groups = new[]
        {
            new TagGroup
            {
                Code = "technology",
                Name = "Технологии",
                Description = "Технологические теги для вакансий и мероприятий",
                IsSystem = true
            },
            new TagGroup
            {
                Code = "vacancy_kind",
                Name = "Тип вакансии",
                Description = "Стажировка или работа",
                IsSystem = true
            },
            new TagGroup
            {
                Code = "event_kind",
                Name = "Тип мероприятия",
                Description = "Хакатон, день открытых дверей, лекция и другое",
                IsSystem = true
            }
        };

        foreach (var group in groups)
        {
            if (!await dbContext.TagGroups.AnyAsync(x => x.Code == group.Code))
            {
                dbContext.TagGroups.Add(group);
            }
        }

        await dbContext.SaveChangesAsync();

        var groupByCode = await dbContext.TagGroups.AsNoTracking().ToDictionaryAsync(x => x.Code, StringComparer.OrdinalIgnoreCase);

        var tagSeeds = new Dictionary<string, string[]>
        {
            ["technology"] =
            [
                "C#", ".NET", "Java", "Kotlin", "Python", "Go", "React", "Vue", "Angular",
                "PostgreSQL", "Kafka", "Docker", "DevOps", "QA", "Data Science"
            ],
            ["vacancy_kind"] = ["Internship", "Job"],
            ["event_kind"] = ["Hackathon", "Open Day", "Lecture", "Other"]
        };

        foreach (var (groupCode, names) in tagSeeds)
        {
            var group = groupByCode[groupCode];
            foreach (var name in names)
            {
                var exists = await dbContext.Tags.AnyAsync(x => x.GroupId == group.Id && x.Name == name);
                if (exists)
                {
                    continue;
                }

                dbContext.Tags.Add(new Tag
                {
                    GroupId = group.Id,
                    Name = name,
                    Slug = $"{groupCode}-{BuildSlug(name)}",
                    Description = $"Тег {name}",
                    Status = CatalogStatus.Active
                });
            }
        }

        await dbContext.SaveChangesAsync();
        var tags = await dbContext.Tags.AsNoTracking().Include(x => x.Group).ToListAsync();
        return tags.ToDictionary(x => $"{x.Group.Code}::{x.Name}", StringComparer.OrdinalIgnoreCase);
    }

    private async Task ClearDomainDataAsync()
    {
        dbContext.ChatMessageReads.RemoveRange(await dbContext.ChatMessageReads.ToListAsync());
        dbContext.ChatMessages.RemoveRange(await dbContext.ChatMessages.ToListAsync());
        dbContext.ChatParticipants.RemoveRange(await dbContext.ChatParticipants.ToListAsync());
        dbContext.Chats.RemoveRange(await dbContext.Chats.ToListAsync());
        dbContext.Applications.RemoveRange(await dbContext.Applications.ToListAsync());
        dbContext.CandidateResumeProjectCollaborations.RemoveRange(await dbContext.CandidateResumeProjectCollaborations.ToListAsync());
        dbContext.CandidateResumeProjectParticipants.RemoveRange(await dbContext.CandidateResumeProjectParticipants.ToListAsync());
        dbContext.CandidateResumeProjectPhotos.RemoveRange(await dbContext.CandidateResumeProjectPhotos.ToListAsync());
        dbContext.CandidateResumeProjects.RemoveRange(await dbContext.CandidateResumeProjects.ToListAsync());
        dbContext.OpportunityParticipants.RemoveRange(await dbContext.OpportunityParticipants.ToListAsync());
        dbContext.OpportunityTags.RemoveRange(await dbContext.OpportunityTags.ToListAsync());
        dbContext.VacancyTags.RemoveRange(await dbContext.VacancyTags.ToListAsync());
        dbContext.Opportunities.RemoveRange(await dbContext.Opportunities.ToListAsync());
        dbContext.Vacancies.RemoveRange(await dbContext.Vacancies.ToListAsync());
        dbContext.CompanyInvites.RemoveRange(await dbContext.CompanyInvites.ToListAsync());
        dbContext.CompanyChatSettings.RemoveRange(await dbContext.CompanyChatSettings.ToListAsync());
        dbContext.CompanyLinks.RemoveRange(await dbContext.CompanyLinks.ToListAsync());
        dbContext.CompanyMembers.RemoveRange(await dbContext.CompanyMembers.ToListAsync());
        dbContext.Companies.RemoveRange(await dbContext.Companies.ToListAsync());
        await dbContext.SaveChangesAsync();
    }

    private async Task SeedVerificationDictionariesAsync()
    {
        if (!await dbContext.EmployerVerificationIndustries.AnyAsync())
        {
            var names = new[]
            {
                ("it-software", "IT / Software"),
                ("design-creative", "Design / Creative"),
                ("marketing-media", "Marketing / Media"),
                ("education", "Education"),
                ("hr-recruitment", "HR / Recruitment"),
                ("finance-accounting", "Finance / Accounting"),
                ("sales-support", "Sales / Customer Support"),
                ("manufacturing-engineering", "Manufacturing / Engineering"),
                ("logistics", "Logistics"),
                ("healthcare", "Healthcare"),
                ("construction-real-estate", "Construction / Real Estate"),
                ("retail-horeca", "Retail / HoReCa"),
                ("public-ngo", "Public / NGO"),
                ("other", "Other")
            };

            dbContext.EmployerVerificationIndustries.AddRange(
                names.Select((x, index) => new EmployerVerificationIndustry
                {
                    Slug = x.Item1,
                    Name = x.Item2,
                    SortOrder = index
                }));
            await dbContext.SaveChangesAsync();
        }

        if (!await dbContext.EmployerVerificationRequiredDocuments.AnyAsync())
        {
            var requirements = new Dictionary<EmployerType, VerificationDocumentType[]>
            {
                [EmployerType.LegalEntity] =
                [
                    VerificationDocumentType.EgrulExtract,
                    VerificationDocumentType.CompanyBankDetailsCard,
                    VerificationDocumentType.RepresentativeAuthorization,
                    VerificationDocumentType.OfficePhoto,
                    VerificationDocumentType.DomainEmailProof
                ],
                [EmployerType.IndividualEntrepreneur] =
                [
                    VerificationDocumentType.EgripExtract,
                    VerificationDocumentType.InnRegistrationProof,
                    VerificationDocumentType.WorkplacePhoto,
                    VerificationDocumentType.DomainEmailProof
                ],
                [EmployerType.SelfEmployed] =
                [
                    VerificationDocumentType.NpdRegistrationProof,
                    VerificationDocumentType.InnRegistrationProof,
                    VerificationDocumentType.IdentityDocument,
                    VerificationDocumentType.PortfolioOrWebsiteProof
                ],
                [EmployerType.RecruitmentAgency] =
                [
                    VerificationDocumentType.EgrulExtract,
                    VerificationDocumentType.CompanyBankDetailsCard,
                    VerificationDocumentType.HrActivityProof,
                    VerificationDocumentType.ServiceOfferOrContract,
                    VerificationDocumentType.BrandMaterials
                ],
                [EmployerType.PrivateRecruiter] =
                [
                    VerificationDocumentType.IdentityDocument,
                    VerificationDocumentType.InnRegistrationProof,
                    VerificationDocumentType.NpdRegistrationProof,
                    VerificationDocumentType.RecruitingActivityProof,
                    VerificationDocumentType.CustomerAuthorizationProof
                ],
                [EmployerType.PrivatePerson] =
                [
                    VerificationDocumentType.IdentityDocument,
                    VerificationDocumentType.PersonalHiringConfirmation
                ]
            };

            dbContext.EmployerVerificationRequiredDocuments.AddRange(
                requirements.SelectMany(
                    x => x.Value.Select(doc => new EmployerVerificationRequiredDocument
                    {
                        EmployerType = x.Key,
                        DocumentType = doc,
                        IsRequired = true
                    })));
            await dbContext.SaveChangesAsync();
        }
    }

    private async Task SeedCompanyVerificationProfilesAsync(IReadOnlyList<Company> companies, long curatorUserId)
    {
        var firstIndustryId = await dbContext.EmployerVerificationIndustries
            .OrderBy(x => x.SortOrder)
            .Select(x => x.Id)
            .FirstAsync();

        dbContext.EmployerVerificationProfiles.AddRange(companies.Select((company, index) =>
        {
            var companyStatus = company.Status == CompanyStatus.Verified
                ? CompanyStatus.PendingVerification
                : company.Status;
            company.Status = companyStatus;

            return new EmployerVerificationProfile
            {
                CompanyId = company.Id,
                EmployerType = index % 4 == 0 ? EmployerType.IndividualEntrepreneur : EmployerType.LegalEntity,
                OgrnOrOgrnip = $"1027700{index + 1:000000}",
                Inn = $"7701{index + 1:000000}",
                Kpp = index % 4 == 0 ? null : $"77010{index % 10}001",
                LegalAddress = "г. Москва, ул. Тверская, д. 1",
                ActualAddress = "г. Москва, ул. Тверская, д. 1",
                RepresentativeFullName = $"Представитель {index + 1}",
                RepresentativePosition = "HR Manager",
                MainIndustryId = firstIndustryId,
                TaxOffice = "ИФНС России №1",
                WorkEmail = company.PublicEmail ?? $"hr{index + 1}@tramplin.local",
                WorkPhone = company.PublicPhone ?? $"+7 (495) 700-{10 + index:00}-{20 + index:00}",
                SiteOrPublicLinks = company.WebsiteUrl,
                ReviewStatus = companyStatus == CompanyStatus.PendingVerification ? VerificationReviewStatus.PendingReview : VerificationReviewStatus.Draft,
                SubmittedAt = companyStatus == CompanyStatus.PendingVerification ? DateTimeOffset.UtcNow.AddDays(-(index % 7)) : null,
                VerifiedByUserId = companyStatus == CompanyStatus.Verified ? curatorUserId : null,
                VerifiedAt = companyStatus == CompanyStatus.Verified ? DateTimeOffset.UtcNow.AddDays(-(index % 14 + 1)) : null
            };
        }));

        await dbContext.SaveChangesAsync();
    }

    private static CompanyStatus ResolveCompanyStatus(int index)
    {
        return (index % 3) switch
        {
            0 => CompanyStatus.Verified,
            1 => CompanyStatus.PendingVerification,
            _ => CompanyStatus.Draft
        };
    }

    private static IReadOnlyList<VacancySeedTemplate> GetVacancyTemplates()
    {
        return
        [
            new(
                "Менеджер по продажам",
                "Общение с квалифицированными B2B-клиентами и проведение онлайн-встреч с топ-менеджментом компаний.",
                "Работа с действующей клиентской базой и новыми лидами: выявление потребностей, демонстрация решений, подготовка коммерческих предложений, договоров и счетов. Формат работы удаленный или в офисе Смоленска. Важны опыт B2B-продаж, дисциплина, грамотная речь и ориентация на результат.",
                VacancyKind.Job,
                WorkFormat.Remote,
                SalaryTaxMode.Unknown,
                80000,
                80000,
                ["technology::QA", "technology::Data Science"]),
            new(
                "Junior интернет-маркетолог / начинающий специалист",
                "Подготовка и ведение рекламных кампаний в performance-маркетинге.",
                "Помощь в планировании и запуске рекламных кампаний в Яндекс.Директ, ВКонтакте, Авито, Telegram, ПромоСтраницах и Картах. Регулярный мониторинг и оптимизация, подготовка отчетов, развитие в интернет-маркетинге под наставничеством. Рассматриваются кандидаты без большого опыта.",
                VacancyKind.Job,
                WorkFormat.Onsite,
                SalaryTaxMode.Unknown,
                40000,
                40000,
                ["technology::React", "technology::QA"]),
            new("Инженер по автоматизации тестирования", "Автоматизация E2E и API-тестов.", "Построение пайплайнов качества, интеграция автотестов в CI/CD.", VacancyKind.Job, WorkFormat.Hybrid, SalaryTaxMode.BeforeTax, 170000, 250000, ["technology::QA", "technology::Python", "technology::DevOps"]),
            new("Data Engineer", "Развитие корпоративной платформы данных.", "Построение ETL, оптимизация витрин и потоковой обработки.", VacancyKind.Job, WorkFormat.Onsite, SalaryTaxMode.BeforeTax, 230000, 340000, ["technology::Data Science", "technology::Kafka", "technology::PostgreSQL"]),
            new("Стажер аналитик данных", "Поддержка отчетности и визуализаций.", "Подготовка датасетов, SQL-скриптов и презентаций для команд.", VacancyKind.Internship, WorkFormat.Hybrid, SalaryTaxMode.AfterTax, 60000, 90000, ["technology::Data Science", "technology::PostgreSQL"]),
            new("Go-разработчик", "Разработка микросервисов для платежного ядра.", "Проектирование доменной модели, контрактов и observability.", VacancyKind.Job, WorkFormat.Remote, SalaryTaxMode.BeforeTax, 240000, 360000, ["technology::Go", "technology::Kafka", "technology::Docker"]),
            new("Java-разработчик", "Поддержка продуктового каталога.", "Разработка модулей на Java и интеграция с внешними системами.", VacancyKind.Job, WorkFormat.Hybrid, SalaryTaxMode.BeforeTax, 210000, 300000, ["technology::Java", "technology::PostgreSQL"]),
            new("Kotlin-разработчик", "Микросервисы для мобильных сценариев.", "Разработка backend-модулей и интеграций на Kotlin.", VacancyKind.Job, WorkFormat.Onsite, SalaryTaxMode.AfterTax, 200000, 290000, ["technology::Kotlin", "technology::Docker"]),
            new("DevOps инженер", "Сопровождение инфраструктуры разработки.", "Автоматизация CI/CD, контейнеризация и мониторинг сервисов.", VacancyKind.Job, WorkFormat.Hybrid, SalaryTaxMode.AfterTax, 230000, 330000, ["technology::DevOps", "technology::Docker", "technology::Kafka"]),
            new("Стажер DevOps", "Помощь в сопровождении тестовых контуров.", "Настройка окружений, обновление деплой-скриптов и мониторинг.", VacancyKind.Internship, WorkFormat.Onsite, SalaryTaxMode.Unknown, 70000, 100000, ["technology::DevOps", "technology::Docker"]),
            new("Системный аналитик", "Формализация требований и интеграций.", "Описание бизнес-процессов и постановка задач разработчикам.", VacancyKind.Job, WorkFormat.Hybrid, SalaryTaxMode.BeforeTax, 160000, 230000, ["technology::PostgreSQL", "technology::QA"]),
            new("Продуктовый аналитик", "Анализ пользовательского поведения.", "Построение метрик, проведение экспериментов и A/B-тестов.", VacancyKind.Job, WorkFormat.Remote, SalaryTaxMode.AfterTax, 180000, 250000, ["technology::Data Science", "technology::Python"]),
            new("QA инженер (ручное тестирование)", "Тестирование web и mobile релизов.", "Подготовка тест-кейсов, smoke/regression и контроль качества.", VacancyKind.Job, WorkFormat.Onsite, SalaryTaxMode.BeforeTax, 130000, 180000, ["technology::QA", "technology::PostgreSQL"]),
            new("Стажер QA", "Старт карьеры в контроле качества.", "Ведение баг-репортов и проверка пользовательских сценариев.", VacancyKind.Internship, WorkFormat.Hybrid, SalaryTaxMode.Unknown, 55000, 85000, ["technology::QA"]),
            new("ML инженер", "Разработка и внедрение моделей машинного обучения.", "Подготовка признаков, обучение моделей и анализ качества.", VacancyKind.Job, WorkFormat.Hybrid, SalaryTaxMode.BeforeTax, 240000, 360000, ["technology::Data Science", "technology::Python"]),
            new("Инженер данных (streaming)", "Развитие потоковой платформы данных.", "Работа с Kafka, обработкой событий и мониторингом задержек.", VacancyKind.Job, WorkFormat.Onsite, SalaryTaxMode.BeforeTax, 220000, 320000, ["technology::Kafka", "technology::PostgreSQL"]),
            new("Python-разработчик", "Разработка сервисов интеграции.", "Создание API, фоновых задач и ETL-компонентов.", VacancyKind.Job, WorkFormat.Remote, SalaryTaxMode.AfterTax, 190000, 280000, ["technology::Python", "technology::Docker"]),
            new("Архитектор решений", "Проектирование архитектуры сервисов.", "Формирование технических стандартов и ревью архитектурных решений.", VacancyKind.Job, WorkFormat.Hybrid, SalaryTaxMode.BeforeTax, 320000, 450000, ["technology::.NET", "technology::Kafka", "technology::DevOps"]),
            new("Технический писатель", "Подготовка технической документации.", "Документация API, пользовательских сценариев и процессов релиза.", VacancyKind.Job, WorkFormat.Remote, SalaryTaxMode.Unknown, 110000, 160000, ["technology::QA", "technology::PostgreSQL"]),
            new("Стажер бизнес-аналитик", "Поддержка аналитической команды.", "Сбор требований и подготовка схем процессов.", VacancyKind.Internship, WorkFormat.Onsite, SalaryTaxMode.AfterTax, 60000, 90000, ["technology::QA", "technology::Data Science"]),
            new("Руководитель команды разработки", "Управление инженерной командой.", "Планирование спринтов, развитие инженеров и контроль delivery.", VacancyKind.Job, WorkFormat.Hybrid, SalaryTaxMode.BeforeTax, 300000, 430000, ["technology::.NET", "technology::DevOps"]),
            new("Инженер сопровождения L2", "Поддержка продакшн-сервисов 24/7.", "Разбор инцидентов, анализ логов и взаимодействие с разработкой.", VacancyKind.Job, WorkFormat.Onsite, SalaryTaxMode.AfterTax, 140000, 210000, ["technology::PostgreSQL", "technology::Docker"]),
            new("Мобильный разработчик Android", "Развитие Android-приложения.", "Реализация новых фич, оптимизация производительности и UX.", VacancyKind.Job, WorkFormat.Hybrid, SalaryTaxMode.BeforeTax, 200000, 300000, ["technology::Kotlin", "technology::QA"]),
            new("Разработчик интеграций", "Интеграция с внешними B2B API.", "Реализация адаптеров, очередей и обработчиков ошибок.", VacancyKind.Job, WorkFormat.Remote, SalaryTaxMode.BeforeTax, 180000, 270000, ["technology::Java", "technology::Kafka"]),
            new("Стажер frontend-разработчик", "Практика в команде клиентской разработки.", "Верстка интерфейсов и работа с компонентами дизайн-системы.", VacancyKind.Internship, WorkFormat.Hybrid, SalaryTaxMode.Unknown, 65000, 95000, ["technology::React", "technology::Vue"]),
            new("Инженер по информационной безопасности", "Обеспечение безопасности платформы.", "Пентесты, контроль уязвимостей и аудит доступов.", VacancyKind.Job, WorkFormat.Onsite, SalaryTaxMode.AfterTax, 220000, 320000, ["technology::DevOps", "technology::Docker"]),
            new("Администратор баз данных PostgreSQL", "Сопровождение и тюнинг БД.", "Оптимизация запросов, резервное копирование и миграции.", VacancyKind.Job, WorkFormat.Hybrid, SalaryTaxMode.BeforeTax, 210000, 310000, ["technology::PostgreSQL", "technology::DevOps"]),
            new("Инженер платформы контейнеризации", "Развитие Kubernetes/контейнерной платформы.", "Автоматизация окружений и эксплуатация кластеров.", VacancyKind.Job, WorkFormat.Remote, SalaryTaxMode.BeforeTax, 240000, 350000, ["technology::Docker", "technology::DevOps"]),
            new("Стажер support-инженер", "Поддержка пользователей внутренних сервисов.", "Диагностика инцидентов и эскалация в профильные команды.", VacancyKind.Internship, WorkFormat.Onsite, SalaryTaxMode.AfterTax, 50000, 80000, ["technology::QA", "technology::PostgreSQL"]),
            new("Product Owner (IT)", "Развитие продукта и управление бэклогом.", "Приоритизация задач, работа с метриками и пользовательской ценностью.", VacancyKind.Job, WorkFormat.Hybrid, SalaryTaxMode.Unknown, 220000, 310000, ["technology::Data Science", "technology::QA"])
        ];
    }

    private static IReadOnlyList<OpportunitySeedTemplate> GetOpportunityTemplates()
    {
        return
        [
            new("Хакатон по цифровой логистике", "Командный хакатон на 48 часов.", "Участники решают реальные задачи маршрутизации и прогнозирования.", OpportunityKind.Hackathon, WorkFormat.Onsite, PriceType.Prize, 500000, true, ["technology::Python", "technology::Data Science"]),
            new("День открытых дверей: Backend-направление", "Экскурсия и встречи с командой backend.", "Покажем архитектуру сервисов и расскажем о карьерных треках.", OpportunityKind.OpenDay, WorkFormat.Onsite, PriceType.Free, null, false, ["technology::C#", "technology::.NET"]),
            new("Лекция: Высоконагруженные системы", "Открытая лекция от архитекторов платформы.", "Разберем сценарии scaling, failover и очереди событий.", OpportunityKind.Lecture, WorkFormat.Hybrid, PriceType.Paid, 1500, true, ["technology::Kafka", "technology::PostgreSQL"]),
            new("Карьерный митап для стажеров", "Нетворкинг с тимлидами и HR.", "Обсудим стажировки, резюме и подготовку к собеседованию.", OpportunityKind.Other, WorkFormat.Remote, PriceType.Free, null, true, ["technology::QA"]),
            new("Хакатон по финтех-аналитике", "Практические кейсы по антифроду.", "Команды строят модели выявления подозрительных операций.", OpportunityKind.Hackathon, WorkFormat.Hybrid, PriceType.Prize, 350000, true, ["technology::Data Science", "technology::Python"]),
            new("Open Day в продуктовой команде", "Знакомство с процессами разработки продукта.", "Покажем, как устроены discovery и delivery внутри команды.", OpportunityKind.OpenDay, WorkFormat.Onsite, PriceType.Free, null, false, ["technology::React"]),
            new("Лекция: Карьера DevOps инженера", "Путь роста и востребованные компетенции.", "Практические кейсы автоматизации CI/CD и мониторинга.", OpportunityKind.Lecture, WorkFormat.Remote, PriceType.Paid, 900, true, ["technology::DevOps", "technology::Docker"]),
            new("Практикум по тестированию API", "Интенсив для начинающих QA.", "Учимся писать тест-кейсы и проверять контракты API.", OpportunityKind.Other, WorkFormat.Hybrid, PriceType.Paid, 1200, true, ["technology::QA"]),
            new("Хакатон «Умный город»", "Соревнование по урбанистическим решениям.", "Собираем MVP сервисов для городских сценариев.", OpportunityKind.Hackathon, WorkFormat.Onsite, PriceType.Prize, 420000, true, ["technology::Data Science"]),
            new("День открытых дверей в Data-команде", "Встреча с аналитиками и инженерами данных.", "Расскажем о стекe, пайплайнах и карьерных возможностях.", OpportunityKind.OpenDay, WorkFormat.Onsite, PriceType.Free, null, false, ["technology::PostgreSQL"]),
            new("Лекция: Архитектура микросервисов", "Инженерный разбор практик проектирования.", "Domain boundaries, контракты, наблюдаемость и надежность.", OpportunityKind.Lecture, WorkFormat.Hybrid, PriceType.Paid, 1700, true, ["technology::.NET", "technology::Kafka"]),
            new("Митап по мобильной разработке", "Встреча Android-разработчиков.", "Обсуждение архитектуры приложений и performance-подходов.", OpportunityKind.Other, WorkFormat.Remote, PriceType.Free, null, true, ["technology::Kotlin"]),
            new("Хакатон «Рекомендательные системы»", "Задачи персонализации и ранжирования.", "Работа с историей поведения и ML-оценкой качества.", OpportunityKind.Hackathon, WorkFormat.Hybrid, PriceType.Prize, 600000, true, ["technology::Data Science", "technology::Python"]),
            new("Open Day для инженерных менеджеров", "Обмен практиками руководства командами.", "Roadmap, growth plan, управление delivery в ИТ-команде.", OpportunityKind.OpenDay, WorkFormat.Onsite, PriceType.Free, null, false, ["technology::DevOps"]),
            new("Лекция: PostgreSQL для backend-инженеров", "Практика проектирования схем и запросов.", "Индексы, транзакции, профилирование и оптимизация SQL.", OpportunityKind.Lecture, WorkFormat.Onsite, PriceType.Paid, 1100, true, ["technology::PostgreSQL"]),
            new("Карьерная сессия по резюме", "Разбор резюме и профилей соискателей.", "Персональные рекомендации от hiring-команды.", OpportunityKind.Other, WorkFormat.Remote, PriceType.Free, null, true, ["technology::QA"]),
            new("Хакатон «Облачная инфраструктура»", "Соревнование DevOps-команд.", "Построение отказоустойчивой платформы в ограниченное время.", OpportunityKind.Hackathon, WorkFormat.Onsite, PriceType.Prize, 480000, true, ["technology::DevOps", "technology::Docker"]),
            new("День открытых дверей Security-команды", "Знакомство с практиками защиты сервисов.", "Threat modeling, аудит доступа и security monitoring.", OpportunityKind.OpenDay, WorkFormat.Hybrid, PriceType.Free, null, false, ["technology::DevOps"]),
            new("Лекция: Data-driven продукт", "Метрики и продуктовые эксперименты.", "Как строить гипотезы и принимать решения на данных.", OpportunityKind.Lecture, WorkFormat.Remote, PriceType.Paid, 1300, true, ["technology::Data Science"]),
            new("Митап «Backend для начинающих»", "Вводный митап по backend-направлению.", "Разбор типовых задач junior-разработчика и roadmap развития.", OpportunityKind.Other, WorkFormat.Hybrid, PriceType.Free, null, true, ["technology::Java", "technology::C#"]),
            new("Хакатон по промышленной автоматизации", "Практические кейсы для промышленности.", "Собираем прототипы мониторинга линий и предупреждения сбоев.", OpportunityKind.Hackathon, WorkFormat.Onsite, PriceType.Prize, 300000, true, ["technology::Go", "technology::Kafka"]),
            new("Open Day в команде SRE", "Обзор ролей и процессов эксплуатации.", "Инциденты, SLO/SLA, мониторинг и культура reliability.", OpportunityKind.OpenDay, WorkFormat.Remote, PriceType.Free, null, false, ["technology::DevOps"]),
            new("Лекция: Архитектура фронтенд-приложений", "Подходы к модульности и производительности.", "State management, code splitting и инженерные практики.", OpportunityKind.Lecture, WorkFormat.Hybrid, PriceType.Paid, 1400, true, ["technology::React", "technology::Vue"]),
            new("Митап по карьере аналитика", "Обсуждаем путь в аналитику данных.", "Рассмотрим набор навыков для junior/middle уровня.", OpportunityKind.Other, WorkFormat.Remote, PriceType.Free, null, true, ["technology::Data Science"]),
            new("Хакатон по обработке событий", "Event-driven задачи для команд.", "Строим надежную обработку событий и очередей.", OpportunityKind.Hackathon, WorkFormat.Hybrid, PriceType.Prize, 380000, true, ["technology::Kafka", "technology::Go"]),
            new("Open Day в команде QA", "Практики обеспечения качества продукта.", "От ручного тестирования к автоматизации и процессам.", OpportunityKind.OpenDay, WorkFormat.Onsite, PriceType.Free, null, false, ["technology::QA"]),
            new("Лекция: Контейнеризация без боли", "Практика docker-окружений и best practices.", "Обсуждаем образы, безопасность и процессы релиза.", OpportunityKind.Lecture, WorkFormat.Remote, PriceType.Paid, 1000, true, ["technology::Docker"]),
            new("Карьерный форум IT-профессий", "Открытые дискуссии и Q&A с экспертами.", "Секция по backend, frontend, QA, DevOps и аналитике.", OpportunityKind.Other, WorkFormat.Onsite, PriceType.Paid, 700, true, ["technology::C#", "technology::React"]),
            new("Хакатон «Роботизация процессов»", "Создание прототипов автоматизации процессов.", "Команды работают над RPA-кейсами в корпоративной среде.", OpportunityKind.Hackathon, WorkFormat.Onsite, PriceType.Prize, 450000, true, ["technology::Python", "technology::Data Science"]),
            new("Open Day: знакомство с компанией", "Экскурсия по офису и встреча с командами.", "Рассказываем о культуре, проектах и условиях работы.", OpportunityKind.OpenDay, WorkFormat.Onsite, PriceType.Free, null, false, ["technology::QA"])
        ];
    }

    private static string ReadAllTextWithFallback(string filePath)
    {
        var bytes = File.ReadAllBytes(filePath);

        try
        {
            return new UTF8Encoding(false, true).GetString(bytes);
        }
        catch (DecoderFallbackException)
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(1251).GetString(bytes);
        }
    }

    private static bool LooksLikeDomain(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var candidate = value.Trim();
        if (candidate.Contains(' ') || candidate.Contains('@') || candidate.Length > 120)
        {
            return false;
        }

        return candidate.Contains('.');
    }

    private static string? NormalizeUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var candidate = value.Trim().TrimEnd('.', ',', ';');
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return null;
        }

        if (candidate.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || candidate.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return candidate;
        }

        if (!candidate.Contains('.') || candidate.Contains(' '))
        {
            return null;
        }

        return $"https://{candidate}";
    }

    private static string BuildShortDescription(string text, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return "Подробности доступны в описании.";
        }

        var paragraph = text
            .Split('\n')
            .Select(x => x.Trim())
            .FirstOrDefault(x => x.Length >= 40 && !x.Contains('₽') && !x.Contains("зарплат", StringComparison.OrdinalIgnoreCase))
            ?? text.Split('\n').Select(x => x.Trim()).FirstOrDefault(x => x.Length >= 10)
            ?? text.Trim();

        if (paragraph.Length <= maxLength)
        {
            return paragraph;
        }

        var cut = paragraph[..maxLength];
        var lastSpace = cut.LastIndexOf(' ');
        return (lastSpace > 0 ? cut[..lastSpace] : cut).TrimEnd() + "...";
    }

    private static List<string> ParseQuotedArray(string text, string label)
    {
        var match = Regex.Match(
            text,
            $@"{Regex.Escape(label)}\s*=\s*\[(?<items>[\s\S]*?)\]",
            RegexOptions.CultureInvariant);

        if (!match.Success)
        {
            return [];
        }

        return Regex.Matches(match.Groups["items"].Value, "\"([^\"]+)\"")
            .Select(x => x.Groups[1].Value.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string? TryGetJsonString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        return property.ValueKind == JsonValueKind.String ? property.GetString() : null;
    }

    private static WorkFormat ParseWorkFormat(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return WorkFormat.Onsite;
        }

        var value = text.ToLowerInvariant();
        if (value.Contains("удален") || value.Contains("онлайн"))
        {
            return WorkFormat.Remote;
        }

        if (value.Contains("гибрид"))
        {
            return WorkFormat.Hybrid;
        }

        return WorkFormat.Onsite;
    }

    private static OpportunityKind ParseOpportunityKind(string title, string description, IReadOnlyCollection<string> tags)
    {
        var text = $"{title} {description} {string.Join(' ', tags)}".ToLowerInvariant();
        if (text.Contains("хакатон"))
        {
            return OpportunityKind.Hackathon;
        }

        if (text.Contains("open day") || text.Contains("день открытых двер"))
        {
            return OpportunityKind.OpenDay;
        }

        if (text.Contains("лекц") || text.Contains("вебинар") || text.Contains("семинар") || text.Contains("интенсив"))
        {
            return OpportunityKind.Lecture;
        }

        return OpportunityKind.Other;
    }

    private static (decimal? SalaryFrom, decimal? SalaryTo) ParseSalaryRange(string text)
    {
        var salaryLine = text
            .Split('\n')
            .Select(x => x.Trim())
            .FirstOrDefault(x => x.Contains('₽'));

        if (salaryLine is null)
        {
            return (null, null);
        }

        var values = Regex.Matches(salaryLine, @"\d[\d\s]{1,}")
            .Select(x => x.Value.Replace(" ", string.Empty))
            .Select(x => decimal.TryParse(x, NumberStyles.Number, CultureInfo.InvariantCulture, out var value) ? value : (decimal?)null)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .ToArray();

        if (values.Length == 0)
        {
            return (null, null);
        }

        if (values.Length == 1)
        {
            if (salaryLine.Contains("до", StringComparison.OrdinalIgnoreCase))
            {
                return (Math.Round(values[0] * 0.75m), values[0]);
            }

            if (salaryLine.Contains("от", StringComparison.OrdinalIgnoreCase))
            {
                return (values[0], Math.Round(values[0] * 1.35m));
            }

            return (values[0], values[0]);
        }

        var min = Math.Min(values[0], values[1]);
        var max = Math.Max(values[0], values[1]);
        return (min, max);
    }

    private static string NormalizeVacancyTitle(string rawTitle)
    {
        if (string.IsNullOrWhiteSpace(rawTitle))
        {
            return "IT-специалист";
        }

        var normalized = Regex.Replace(rawTitle.Trim(), @"\s+", " ");
        var lower = normalized.ToLowerInvariant();

        if (lower == "devops")
        {
            return "Инженер DevOps";
        }

        normalized = normalized
            .Replace("Junior Product Manager", "Младший продакт-менеджер", StringComparison.OrdinalIgnoreCase)
            .Replace("Manual QA Engineer", "QA-инженер", StringComparison.OrdinalIgnoreCase)
            .Replace("Frontend developer", "фронтенд-разработчик", StringComparison.OrdinalIgnoreCase)
            .Replace("Front-end developer", "фронтенд-разработчик", StringComparison.OrdinalIgnoreCase)
            .Replace("Front-end", "фронтенд", StringComparison.OrdinalIgnoreCase)
            .Replace("Frontend", "фронтенд", StringComparison.OrdinalIgnoreCase)
            .Replace("Developer", "разработчик", StringComparison.OrdinalIgnoreCase)
            .Replace("Junior", "Младший", StringComparison.OrdinalIgnoreCase);

        if (!Regex.IsMatch(normalized, "[А-Яа-яЁё]"))
        {
            normalized = $"IT-специалист ({normalized})";
        }

        return normalized;
    }

    private static string NormalizeForDedup(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(value.Length);
        foreach (var character in value.ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
            }
        }

        return builder.ToString();
    }

    private static string BuildSeekerAbout(string firstName)
    {
        var variants = new[]
        {
            "Развиваюсь в продуктовом IT, люблю системный подход и понятные процессы.",
            "Сфокусирован(а) на практических задачах, командной коммуникации и аккуратной реализации.",
            "Ищу проекты с сильной командой, прозрачной обратной связью и ростом компетенций.",
            "Работаю на результат: анализирую метрики, предлагаю улучшения и довожу задачи до релиза."
        };

        return variants[StableIndex(firstName, variants.Length)];
    }

    private static string BuildResumeHeadline(string firstName)
    {
        var variants = new[]
        {
            "Junior/Middle IT-специалист",
            "Инженер продукта",
            "Разработчик и аналитик цифровых сервисов",
            "Специалист по разработке и качеству ПО"
        };

        return variants[StableIndex(firstName + "_headline", variants.Length)];
    }

    private static string BuildDesiredPosition(string firstName)
    {
        var variants = new[]
        {
            "Backend-разработчик",
            "Frontend-разработчик",
            "QA-инженер",
            "Product Analyst",
            "Data Engineer"
        };

        return variants[StableIndex(firstName + "_position", variants.Length)];
    }

    private static string BuildResumeSummary(string firstName)
    {
        var variants = new[]
        {
            "Опыт участия в коммерческих и учебных проектах, уверенная работа в кросс-функциональной команде.",
            "Практикую аккуратный инженерный подход: декомпозиция задач, контроль качества, измеримый результат.",
            "Есть опыт работы с требованиями, интеграциями и пользовательскими сценариями в web-продуктах.",
            "Веду проекты от постановки до релиза, умею договариваться о приоритетах и сроках."
        };

        return variants[StableIndex(firstName + "_summary", variants.Length)];
    }

    private static int StableIndex(string seed, int modulo)
    {
        if (modulo <= 0)
        {
            return 0;
        }

        var hash = seed.GetHashCode(StringComparison.Ordinal);
        var normalized = unchecked((int)(uint)hash);
        return normalized % modulo;
    }

    private static string TransliterateToAscii(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "user";
        }

        var map = new Dictionary<char, string>
        {
            ['а'] = "a", ['б'] = "b", ['в'] = "v", ['г'] = "g", ['д'] = "d", ['е'] = "e", ['ё'] = "e",
            ['ж'] = "zh", ['з'] = "z", ['и'] = "i", ['й'] = "y", ['к'] = "k", ['л'] = "l", ['м'] = "m",
            ['н'] = "n", ['о'] = "o", ['п'] = "p", ['р'] = "r", ['с'] = "s", ['т'] = "t", ['у'] = "u",
            ['ф'] = "f", ['х'] = "h", ['ц'] = "c", ['ч'] = "ch", ['ш'] = "sh", ['щ'] = "sch", ['ъ'] = "",
            ['ы'] = "y", ['ь'] = "", ['э'] = "e", ['ю'] = "yu", ['я'] = "ya"
        };

        var builder = new StringBuilder(value.Length);
        foreach (var character in value.ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                if (map.TryGetValue(character, out var mapped))
                {
                    builder.Append(mapped);
                }
                else
                {
                    builder.Append(character);
                }
            }
            else if (builder.Length == 0 || builder[^1] != '-')
            {
                builder.Append('-');
            }
        }

        var result = builder.ToString().Trim('-');
        return string.IsNullOrWhiteSpace(result) ? "user" : result;
    }

    private static double SquaredDistance(double latA, double lonA, double latB, double lonB)
    {
        var lat = latA - latB;
        var lon = lonA - lonB;
        return lat * lat + lon * lon;
    }

    private static string BuildSlug(string value)
    {
        return value
            .Trim()
            .ToLowerInvariant()
            .Replace(" ", "-")
            .Replace(".", string.Empty)
            .Replace(":", string.Empty)
            .Replace("(", string.Empty)
            .Replace(")", string.Empty);
    }

    private sealed record CompanySeed(
        string Name,
        string Description,
        string? WebsiteUrl,
        string? PublicEmail,
        string? PublicPhone,
        IReadOnlyList<string> AdditionalLinks,
        string? LogoFilePath,
        string LogoObjectKey);

    private sealed record VacancySeed(
        string Title,
        string ShortDescription,
        string FullDescription,
        VacancyKind Kind,
        WorkFormat Format,
        decimal? SalaryFrom,
        decimal? SalaryTo);

    private sealed record GeoPointSeed(double Latitude, double Longitude);

    private sealed record FioSeed(
        IReadOnlyList<string> LastNames,
        IReadOnlyList<string> FirstNames,
        IReadOnlyList<string> MiddleNames);

    private sealed record EventSeed(
        string Title,
        string ShortDescription,
        string FullDescription,
        OpportunityKind Kind,
        WorkFormat Format,
        DateTimeOffset EventDate);

    private sealed record VacancySeedTemplate(
        string Title,
        string ShortDescription,
        string FullDescription,
        VacancyKind Kind,
        WorkFormat Format,
        SalaryTaxMode SalaryTaxMode,
        decimal SalaryFrom,
        decimal SalaryTo,
        string[] TagKeys);

    private sealed record OpportunitySeedTemplate(
        string Title,
        string ShortDescription,
        string FullDescription,
        OpportunityKind Kind,
        WorkFormat Format,
        PriceType PriceType,
        decimal? PriceAmount,
        bool ParticipantsCanWrite,
        string[] TagKeys);
}

