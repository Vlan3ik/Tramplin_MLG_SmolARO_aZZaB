using System.Globalization;
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

        var admin = await EnsureUserAsync("admin@trampolin.local", "Administrator", "Admin123!", AccountStatus.Active, "/api/media/user-avatars/system/admin.svg");
        var employer = await EnsureUserAsync("employer@tramplin.local", "Employer Demo", "Employer123!", AccountStatus.Active, "/api/media/user-avatars/system/employer.svg");
        var seeker = await EnsureUserAsync("seeker@tramplin.local", "Seeker Demo", "Seeker123!", AccountStatus.Active, "/api/media/user-avatars/system/seeker.svg");

        await EnsureRoleAsync(admin.Id, PlatformRole.Curator, now);
        await EnsureRoleAsync(employer.Id, PlatformRole.Employer, now);
        await EnsureRoleAsync(seeker.Id, PlatformRole.Seeker, now);

        await EnsureSeekerProfileAsync(seeker.Id);

        var cities = await EnsureCitiesAsync();
        var cityByName = cities.ToDictionary(x => x.CityName, StringComparer.OrdinalIgnoreCase);
        var locations = await EnsureLocationsAsync(cities);

        var tagGroups = await EnsureTagGroupsAsync();
        var tags = await EnsureTagsAsync(tagGroups);

        var hasLegacySynthetic = await dbContext.Companies.AnyAsync(x => (x.BrandName ?? x.LegalName) == "CloudLine");
        var hasTargetVacancy = await dbContext.Opportunities.AnyAsync(x => x.Title == "Менеджер по продажам");
        var hasCompanyWithoutLogo = await dbContext.Companies.AnyAsync(x => x.LogoUrl == null);

        if (hasLegacySynthetic || !hasTargetVacancy || hasCompanyWithoutLogo)
        {
            await RebuildCatalogAsync(employer.Id, cityByName, locations, tags, now);
        }
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
            DisplayName = fullName,
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
        var exists = await dbContext.UserRoles.AnyAsync(x => x.UserId == userId && x.Role == role);
        if (exists)
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

    private async Task EnsureSeekerProfileAsync(long userId)
    {
        if (!await dbContext.CandidateProfiles.AnyAsync(x => x.UserId == userId))
        {
            dbContext.CandidateProfiles.Add(new CandidateProfile
            {
                UserId = userId,
                LastName = "Смирнов",
                FirstName = "Артем",
                MiddleName = "Иванович",
                Phone = "+7-900-100-20-30",
                About = "Начинающий backend-разработчик, ищу стажировку и junior-позиции.",
                AvatarUrl = "/api/media/user-avatars/system/seeker.svg"
            });
            await dbContext.SaveChangesAsync();
        }

        if (!await dbContext.CandidatePrivacySettings.AnyAsync(x => x.UserId == userId))
        {
            dbContext.CandidatePrivacySettings.Add(new CandidatePrivacySettings
            {
                UserId = userId,
                ProfileVisibility = PrivacyScope.AuthorizedUsers,
                ResumeVisibility = PrivacyScope.AuthorizedUsers,
                ShowContactsInResume = true,
                OpenToWork = true
            });
            await dbContext.SaveChangesAsync();
        }

        if (!await dbContext.CandidateResumeProfiles.AnyAsync(x => x.UserId == userId))
        {
            dbContext.CandidateResumeProfiles.Add(new CandidateResumeProfile
            {
                UserId = userId,
                Headline = "Junior .NET разработчик",
                DesiredPosition = "Backend Developer",
                Summary = "Интересуют стажировки и junior-вакансии в продуктовых командах.",
                SalaryFrom = 70000,
                SalaryTo = 140000,
                CurrencyCode = "RUB"
            });
            await dbContext.SaveChangesAsync();
        }
    }

    private async Task<List<City>> EnsureCitiesAsync()
    {
        var citySeeds = new[]
        {
            ("RU", "Москва", "Москва", 55.7558m, 37.6176m),
            ("RU", "Санкт-Петербург", "Санкт-Петербург", 59.9343m, 30.3351m),
            ("RU", "Смоленская область", "Смоленск", 54.7826m, 32.0453m),
            ("RU", "Республика Татарстан", "Казань", 55.7903m, 49.1128m),
            ("RU", "Новосибирская область", "Новосибирск", 55.0084m, 82.9357m),
            ("RU", "Свердловская область", "Екатеринбург", 56.8389m, 60.6057m),
            ("RU", "Нижегородская область", "Нижний Новгород", 56.2965m, 43.9361m),
            ("RU", "Самарская область", "Самара", 53.1959m, 50.1008m),
            ("RU", "Ростовская область", "Ростов-на-Дону", 47.2357m, 39.7015m),
            ("RU", "Краснодарский край", "Краснодар", 45.0393m, 38.9872m),
            ("RU", "Воронежская область", "Воронеж", 51.6720m, 39.1843m),
            ("RU", "Пермский край", "Пермь", 58.0105m, 56.2502m)
        };

        foreach (var item in citySeeds)
        {
            var exists = await dbContext.Cities.AnyAsync(x =>
                x.CountryCode == item.Item1 &&
                x.RegionName == item.Item2 &&
                x.CityName == item.Item3);

            if (!exists)
            {
                dbContext.Cities.Add(new City
                {
                    CountryCode = item.Item1,
                    RegionName = item.Item2,
                    CityName = item.Item3,
                    Latitude = item.Item4,
                    Longitude = item.Item5
                });
            }
        }

        await dbContext.SaveChangesAsync();
        return await dbContext.Cities.AsNoTracking().ToListAsync();
    }

    private async Task<List<LocationEntity>> EnsureLocationsAsync(List<City> cities)
    {
        var pointFactory = new GeometryFactory(new PrecisionModel(), 4326);
        var locations = new List<LocationEntity>();
        var smolenskPoints = BuildSmolenskVacancyPoints().ToArray();

        foreach (var city in cities)
        {
            if (city.CityName == "Смоленск")
            {
                var existingSmolenskLocations = await dbContext.Locations
                    .Where(x => x.CityId == city.Id)
                    .ToListAsync();

                foreach (var point in smolenskPoints)
                {
                    var exists = existingSmolenskLocations.Any(x =>
                        x.StreetName == point.StreetName &&
                        x.HouseNumber == point.HouseNumber);

                    if (!exists)
                    {
                        dbContext.Locations.Add(new LocationEntity
                        {
                            CityId = city.Id,
                            GeoPoint = pointFactory.CreatePoint(new Coordinate(point.Longitude, point.Latitude)),
                            StreetName = point.StreetName,
                            HouseNumber = point.HouseNumber
                        });
                    }
                }

                await dbContext.SaveChangesAsync();
                var smolenskLocations = await dbContext.Locations
                    .Where(x => x.CityId == city.Id)
                    .OrderBy(x => x.Id)
                    .ToListAsync();
                locations.AddRange(smolenskLocations);
                continue;
            }

            var location = await dbContext.Locations.FirstOrDefaultAsync(x => x.CityId == city.Id);
            if (location is null)
            {
                location = new LocationEntity
                {
                    CityId = city.Id,
                    GeoPoint = pointFactory.CreatePoint(new Coordinate((double)(city.Longitude ?? 0), (double)(city.Latitude ?? 0))),
                    StreetName = "Центральная улица",
                    HouseNumber = "1"
                };
                dbContext.Locations.Add(location);
                await dbContext.SaveChangesAsync();
            }

            locations.Add(location);
        }

        return locations;
    }

    private async Task<List<TagGroup>> EnsureTagGroupsAsync()
    {
        var groups = new[]
        {
            new TagGroup { Code = "technology", Name = "Технологии", Description = "Языки и инструменты", IsSystem = true },
            new TagGroup { Code = "grade", Name = "Уровень", Description = "Уровень позиции", IsSystem = true },
            new TagGroup { Code = "employment", Name = "Занятость", Description = "Тип занятости", IsSystem = true },
            new TagGroup { Code = "specialization", Name = "Специализация", Description = "Направление", IsSystem = true }
        };

        foreach (var group in groups)
        {
            if (!await dbContext.TagGroups.AnyAsync(x => x.Code == group.Code))
            {
                dbContext.TagGroups.Add(group);
            }
        }

        await dbContext.SaveChangesAsync();
        return await dbContext.TagGroups.ToListAsync();
    }

    private async Task<List<Tag>> EnsureTagsAsync(List<TagGroup> groups)
    {
        var byCode = groups.ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);

        var tagMap = new Dictionary<string, string[]>
        {
            ["technology"] = new[]
            {
                "1С", "BPMN", "C#", "ASP.NET Core", "PostgreSQL", "Redis", "Python", "TypeScript", "React",
                "Node.js", "Docker", "Kubernetes", "Kafka", "RabbitMQ", "Git", "Linux", "Yandex Direct",
                "VK Ads", "Google Analytics", "Яндекс Метрика", "Power BI", "Figma", "QA", "Selenium"
            },
            ["grade"] = new[] { "Intern", "Junior", "Middle", "Senior" },
            ["employment"] = new[] { "Full-time", "Part-time", "Project", "Flexible" },
            ["specialization"] = new[]
            {
                "Backend", "Frontend", "Data Science", "QA", "DevOps", "Product", "Marketing", "Sales", "1C", "Support"
            }
        };

        foreach (var pair in tagMap)
        {
            var group = byCode[pair.Key];
            foreach (var name in pair.Value)
            {
                var exists = await dbContext.Tags.AnyAsync(x => x.GroupId == group.Id && x.Name == name);
                if (!exists)
                {
                    dbContext.Tags.Add(new Tag
                    {
                        GroupId = group.Id,
                        Name = name,
                        Slug = $"{group.Code}-{BuildSlug(name)}",
                        Description = $"{name} — системный тег каталога.",
                        Status = CatalogStatus.Active
                    });
                }
            }
        }

        await dbContext.SaveChangesAsync();
        return await dbContext.Tags.ToListAsync();
    }

    private async Task RebuildCatalogAsync(
        long employerUserId,
        IReadOnlyDictionary<string, City> cityByName,
        IReadOnlyCollection<LocationEntity> locations,
        IReadOnlyCollection<Tag> tags,
        DateTimeOffset now)
    {
        var existingCompanies = await dbContext.Companies
            .Include(x => x.Opportunities)
            .Include(x => x.Links)
            .ToListAsync();

        if (existingCompanies.Count > 0)
        {
            dbContext.Companies.RemoveRange(existingCompanies);
            await dbContext.SaveChangesAsync();
        }

        var companies = BuildCompanies(cityByName);
        dbContext.Companies.AddRange(companies);
        await dbContext.SaveChangesAsync();

        var links = BuildCompanyLinks(companies);
        dbContext.CompanyLinks.AddRange(links);
        await dbContext.SaveChangesAsync();

        var opportunities = BuildOpportunities(companies, cityByName, locations, employerUserId, now);
        dbContext.Opportunities.AddRange(opportunities);
        await dbContext.SaveChangesAsync();

        var opportunityTags = BuildOpportunityTags(opportunities, tags);
        dbContext.OpportunityTags.AddRange(opportunityTags);
        await dbContext.SaveChangesAsync();
    }

    private static List<Company> BuildCompanies(IReadOnlyDictionary<string, City> cityByName)
    {
        var data = new[]
        {
            new
            {
                Legal = "ООО ВебКанапе",
                Brand = "WebCanape",
                Tax = "6731054321",
                Reg = "1116732001023",
                Industry = "Веб-разработка и интернет-маркетинг",
                Description = "WebCanape — одно из крупнейших Digital-агентств в Смоленском регионе, работающее на рынке более 16 лет.",
                LogoUrl = "/api/media/company-logos/webcanape/logo.jpg",
                Site = "https://web-canape.ru",
                Email = "gavrilenkova.n@web-canape.ru",
                Phone = "+7 (906) 517-94-70",
                City = "Смоленск"
            },
            new
            {
                Legal = "ООО Коалла Эдженси",
                Brand = "Агентство Coalla",
                Tax = "6732012345",
                Reg = "1136733002211",
                Industry = "Дизайн и брендинг",
                Description = "Coalla Agency — веб-студия, разрабатывающая брендинг, сложные интерфейсы, сайты и приложения.",
                LogoUrl = "/api/media/company-logos/coalla/logo.jpg",
                Site = "https://coalla.ru",
                Email = "hr@coalla.ru",
                Phone = "+7 (345) 345-34-53",
                City = "Смоленск"
            },
            new
            {
                Legal = "ООО Простые решения",
                Brand = "Простые решения",
                Tax = "6732076543",
                Reg = "1146733005567",
                Industry = "Автоматизация на 1С",
                Description = "IT-компания «Простые решения» — аккредитованный разработчик ПО и интегратор 1С, обслуживающий 3500+ клиентов.",
                LogoUrl = "/api/media/company-logos/prostyeresheniya/logo.jpg",
                Site = "https://rabota.1eska.ru",
                Email = "info@1eska.ru",
                Phone = "+7 (910) 786-99-06",
                City = "Смоленск"
            },
            new
            {
                Legal = "ООО Яндекс",
                Brand = "Яндекс",
                Tax = "7736207543",
                Reg = "1027700229193",
                Industry = "Интернет-сервисы",
                Description = "Яндекс — российская технологическая компания, развивающая поисковые, облачные и B2B/B2C-сервисы.",
                LogoUrl = "/api/media/company-logos/yandex/logo.svg",
                Site = "https://yandex.ru/jobs",
                Email = "jobs@yandex-team.ru",
                Phone = "+7 (495) 739-70-00",
                City = "Москва"
            },
            new
            {
                Legal = "ООО ВК",
                Brand = "VK",
                Tax = "7743001840",
                Reg = "1027739850962",
                Industry = "Социальные и медиа-платформы",
                Description = "VK — экосистема цифровых сервисов, продуктов коммуникации и медиаплатформ.",
                LogoUrl = "/api/media/company-logos/vk/logo.svg",
                Site = "https://team.vk.company",
                Email = "hr@vk.company",
                Phone = "+7 (495) 725-63-57",
                City = "Москва"
            },
            new
            {
                Legal = "ООО Озон Технологии",
                Brand = "Ozon Tech",
                Tax = "7704217370",
                Reg = "1027700132190",
                Industry = "E-commerce и логистика",
                Description = "Ozon Tech развивает технологические решения для e-commerce, логистики и клиентских сервисов.",
                LogoUrl = "/api/media/company-logos/ozon-tech/logo.svg",
                Site = "https://job.ozon.ru",
                Email = "tech-hr@ozon.ru",
                Phone = "+7 (495) 232-10-00",
                City = "Москва"
            },
            new
            {
                Legal = "АО ТБанк",
                Brand = "T-Bank",
                Tax = "7710140679",
                Reg = "1027739642281",
                Industry = "FinTech",
                Description = "T-Bank развивает финтех-платформу и инженерные продукты для банковских и лайфстайл-сервисов.",
                LogoUrl = "/api/media/company-logos/t-bank/logo.svg",
                Site = "https://www.tbank.ru/career",
                Email = "itcareer@tbank.ru",
                Phone = "+7 (495) 648-10-00",
                City = "Москва"
            },
            new
            {
                Legal = "ООО ДубльГИС",
                Brand = "2GIS",
                Tax = "5406733832",
                Reg = "1115476132740",
                Industry = "Карты и геосервисы",
                Description = "2GIS — геосервис с картографическими и навигационными продуктами для пользователей и бизнеса.",
                LogoUrl = "/api/media/company-logos/2gis/logo.svg",
                Site = "https://2gis.ru/jobs",
                Email = "team@2gis.ru",
                Phone = "+7 (383) 363-05-55",
                City = "Новосибирск"
            },
            new
            {
                Legal = "АО Лаборатория Касперского",
                Brand = "Kaspersky",
                Tax = "7713140469",
                Reg = "1027700041113",
                Industry = "Кибербезопасность",
                Description = "Kaspersky — международная компания в области кибербезопасности и защиты цифровой инфраструктуры.",
                LogoUrl = "/api/media/company-logos/kaspersky/logo.svg",
                Site = "https://www.kaspersky.com/careers",
                Email = "careers@kaspersky.com",
                Phone = "+7 (495) 797-87-00",
                City = "Москва"
            },
            new
            {
                Legal = "ПАО Сбербанк",
                Brand = "Сбер",
                Tax = "7707083893",
                Reg = "1027700132195",
                Industry = "Финансовые и цифровые сервисы",
                Description = "Сбер развивает финансовые и технологические платформы, включая AI и cloud-направления.",
                LogoUrl = "/api/media/company-logos/sber/logo.svg",
                Site = "https://rabota.sber.ru",
                Email = "careers@sberbank.ru",
                Phone = "+7 (495) 500-55-50",
                City = "Москва"
            }
        };

        return data.Select(x => new Company
        {
            LegalName = x.Legal,
            BrandName = x.Brand,
            LegalType = CompanyLegalType.LegalEntity,
            TaxId = x.Tax,
            RegistrationNumber = x.Reg,
            Industry = x.Industry,
            Description = x.Description,
            LogoUrl = x.LogoUrl,
            WebsiteUrl = x.Site,
            PublicEmail = x.Email,
            PublicPhone = x.Phone,
            BaseCityId = cityByName[x.City].Id,
            Status = CompanyStatus.Verified
        }).ToList();
    }

    private static IEnumerable<CompanyLink> BuildCompanyLinks(IEnumerable<Company> companies)
    {
        var links = new List<CompanyLink>();
        foreach (var company in companies)
        {
            links.Add(new CompanyLink
            {
                CompanyId = company.Id,
                LinkKind = LinkType.Website,
                Label = "Сайт компании",
                Url = company.WebsiteUrl ?? string.Empty
            });

            if ((company.BrandName ?? company.LegalName) == "WebCanape")
            {
                links.Add(new CompanyLink
                {
                    CompanyId = company.Id,
                    LinkKind = LinkType.Vk,
                    Label = "VK",
                    Url = "https://vk.com/webcanape"
                });
            }

            if ((company.BrandName ?? company.LegalName) == "Агентство Coalla")
            {
                links.Add(new CompanyLink
                {
                    CompanyId = company.Id,
                    LinkKind = LinkType.Vk,
                    Label = "VK",
                    Url = "https://vk.com/coalla.agency"
                });
            }

            if ((company.BrandName ?? company.LegalName) == "Простые решения")
            {
                links.Add(new CompanyLink
                {
                    CompanyId = company.Id,
                    LinkKind = LinkType.Vk,
                    Label = "VK",
                    Url = "https://vk.com/odineska"
                });
            }
        }

        return links;
    }

    private static List<Opportunity> BuildOpportunities(
        IReadOnlyCollection<Company> companies,
        IReadOnlyDictionary<string, City> cityByName,
        IReadOnlyCollection<LocationEntity> locations,
        long employerUserId,
        DateTimeOffset now)
    {
        var companyByBrand = companies.ToDictionary(x => x.BrandName ?? x.LegalName, StringComparer.OrdinalIgnoreCase);
        var smolenskCityId = cityByName["Смоленск"].Id;
        var smolenskLocations = locations
            .Where(x => x.CityId == smolenskCityId)
            .OrderBy(x => x.Id)
            .ToArray();
        var smolenskLocationIndex = 0;

        long NextSmolenskLocationId()
        {
            if (smolenskLocations.Length == 0)
            {
                throw new InvalidOperationException("Для Смоленска не найдено ни одной локации.");
            }

            if (smolenskLocationIndex >= smolenskLocations.Length)
            {
                smolenskLocationIndex = 0;
            }

            return smolenskLocations[smolenskLocationIndex++].Id;
        }

        var opportunities = new List<Opportunity>
        {
            // Обязательные примеры из Design/Тестовые данные/Вакансии
            new()
            {
                CompanyId = companyByBrand["WebCanape"].Id,
                CreatedByUserId = employerUserId,
                Title = "Менеджер по продажам",
                ShortDescription = "B2B-продажи услуг digital-агентства, удаленный или офисный формат.",
                FullDescription = "Общение с квалифицированными клиентами, онлайн-встречи с топ-менеджментом, ведение коммерческих предложений и договоров, развитие клиентской базы. Требуются гибкость, дисциплина, грамотная речь и ориентация на результат. Условия: оклад + %, премии, обучение, официальное оформление.",
                OppType = OpportunityType.Vacancy,
                Format = WorkFormat.Remote,
                Status = OpportunityStatus.Published,
                CityId = null,
                LocationId = NextSmolenskLocationId(),
                SalaryFrom = 80000,
                SalaryTo = 140000,
                CurrencyCode = "RUB",
                PublishAt = now.AddDays(-5),
                ApplicationDeadline = now.AddDays(25)
            },
            new()
            {
                CompanyId = companyByBrand["WebCanape"].Id,
                CreatedByUserId = employerUserId,
                Title = "Junior интернет-маркетолог",
                ShortDescription = "Стартовая позиция в отделе performance marketing.",
                FullDescription = "Подготовка и ведение рекламных кампаний в Яндекс.Директ, ВК, Авито, Telegram, Яндекс Картах. Мониторинг, оптимизация, отчетность. Требуется базовое понимание рекламных каналов, высокая обучаемость и системность.",
                OppType = OpportunityType.Vacancy,
                Format = WorkFormat.Onsite,
                Status = OpportunityStatus.Published,
                CityId = null,
                LocationId = NextSmolenskLocationId(),
                SalaryFrom = 40000,
                SalaryTo = 70000,
                CurrencyCode = "RUB",
                PublishAt = now.AddDays(-7),
                ApplicationDeadline = now.AddDays(30)
            }
        };

        var templates = new[]
        {
            new { Title = "Junior Backend Developer", Type = OpportunityType.Vacancy, Format = WorkFormat.Hybrid, SalaryFrom = 90000m, SalaryTo = 150000m },
            new { Title = "Стажер QA Engineer", Type = OpportunityType.Internship, Format = WorkFormat.Onsite, SalaryFrom = 50000m, SalaryTo = 80000m },
            new { Title = "Frontend Developer (React)", Type = OpportunityType.Vacancy, Format = WorkFormat.Hybrid, SalaryFrom = 100000m, SalaryTo = 170000m },
            new { Title = "Data Analyst Internship", Type = OpportunityType.Internship, Format = WorkFormat.Remote, SalaryFrom = 60000m, SalaryTo = 90000m },
            new { Title = "DevOps Engineer", Type = OpportunityType.Vacancy, Format = WorkFormat.Hybrid, SalaryFrom = 140000m, SalaryTo = 220000m },
            new { Title = "Product Manager (Junior+)", Type = OpportunityType.Vacancy, Format = WorkFormat.Onsite, SalaryFrom = 110000m, SalaryTo = 180000m }
        };

        var companyOrder = new[]
        {
            "Агентство Coalla", "Простые решения", "Яндекс", "VK", "Ozon Tech",
            "T-Bank", "2GIS", "Kaspersky", "Сбер"
        };

        foreach (var companyName in companyOrder)
        {
            var company = companyByBrand[companyName];

            for (var i = 0; i < 4; i++)
            {
                var t = templates[(i + companyName.Length) % templates.Length];

                opportunities.Add(new Opportunity
                {
                    CompanyId = company.Id,
                    CreatedByUserId = employerUserId,
                    Title = $"{t.Title} — {companyName}",
                    ShortDescription = $"Позиция {t.Title} в компании {companyName}.",
                    FullDescription = $"Реальная вакансия/стажировка для развития карьеры в компании {companyName}. Обязанности, требования и условия соответствуют профилю роли {t.Title}.",
                    OppType = t.Type,
                    Format = t.Format,
                    Status = OpportunityStatus.Published,
                    CityId = null,
                    LocationId = NextSmolenskLocationId(),
                    SalaryFrom = t.Type == OpportunityType.CareerEvent ? null : t.SalaryFrom,
                    SalaryTo = t.Type == OpportunityType.CareerEvent ? null : t.SalaryTo,
                    CurrencyCode = t.Type == OpportunityType.CareerEvent ? null : "RUB",
                    PublishAt = now.AddDays(-(8 + i + companyName.Length % 5)),
                    ApplicationDeadline = now.AddDays(20 + i)
                });
            }
        }

        return opportunities;
    }

    private static IEnumerable<(string StreetName, string HouseNumber, double Latitude, double Longitude)> BuildSmolenskVacancyPoints()
    {
        const double baseLatitude = 54.7350;
        const double baseLongitude = 31.9650;

        for (var i = 0; i < 80; i++)
        {
            var row = i / 10;
            var col = i % 10;
            yield return (
                "Тестовая улица",
                (100 + i).ToString(CultureInfo.InvariantCulture),
                baseLatitude + (row * 0.0100) + (col * 0.0010),
                baseLongitude + (col * 0.0100) + (row * 0.0010));
        }
    }
    private static IEnumerable<OpportunityTag> BuildOpportunityTags(IReadOnlyCollection<Opportunity> opportunities, IReadOnlyCollection<Tag> tags)
    {
        static string GroupCodeFromSlug(string slug)
        {
            if (string.IsNullOrWhiteSpace(slug))
            {
                return string.Empty;
            }

            var dashIndex = slug.IndexOf('-');
            return dashIndex > 0 ? slug[..dashIndex] : string.Empty;
        }

        var tagByScopedName = tags
            .GroupBy(
                x => $"{GroupCodeFromSlug(x.Slug)}::{x.Name}",
                StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

        var fallbackTagByName = tags
            .GroupBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

        bool TryResolveTag(string name, string groupCode, out Tag tag)
        {
            if (!string.IsNullOrWhiteSpace(groupCode))
            {
                var scopedKey = $"{groupCode}::{name}";
                if (tagByScopedName.TryGetValue(scopedKey, out tag!))
                {
                    return true;
                }
            }

            return fallbackTagByName.TryGetValue(name, out tag!);
        }

        (string Name, string GroupCode)[] ResolveSelectors(string title)
        {
            if (title.Contains("продаж", StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    ("Sales", "specialization"),
                    ("Full-time", "employment"),
                    ("Junior", "grade"),
                    ("Product", "specialization")
                ];
            }

            if (title.Contains("интернет-маркетолог", StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    ("Marketing", "specialization"),
                    ("Yandex Direct", "technology"),
                    ("VK Ads", "technology"),
                    ("Junior", "grade")
                ];
            }

            if (title.StartsWith("Junior Backend Developer", StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    ("Backend", "specialization"),
                    ("C#", "technology"),
                    ("ASP.NET Core", "technology"),
                    ("PostgreSQL", "technology")
                ];
            }

            if (title.Contains("QA Engineer", StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    ("QA", "specialization"),
                    ("Intern", "grade"),
                    ("Selenium", "technology"),
                    ("Part-time", "employment")
                ];
            }

            if (title.StartsWith("Frontend Developer (React)", StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    ("Frontend", "specialization"),
                    ("React", "technology"),
                    ("TypeScript", "technology"),
                    ("Middle", "grade")
                ];
            }

            if (title.StartsWith("Data Analyst Internship", StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    ("Data Science", "specialization"),
                    ("Intern", "grade"),
                    ("Power BI", "technology"),
                    ("Python", "technology")
                ];
            }

            if (title.StartsWith("DevOps Engineer", StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    ("DevOps", "specialization"),
                    ("Docker", "technology"),
                    ("Kubernetes", "technology"),
                    ("Linux", "technology")
                ];
            }

            if (title.StartsWith("Product Manager (Junior+)", StringComparison.OrdinalIgnoreCase))
            {
                return
                [
                    ("Product", "specialization"),
                    ("Junior", "grade"),
                    ("Full-time", "employment"),
                    ("Google Analytics", "technology")
                ];
            }

            return [];
        }

        var result = new List<OpportunityTag>();
        foreach (var opportunity in opportunities)
        {
            foreach (var selector in ResolveSelectors(opportunity.Title))
            {
                if (TryResolveTag(selector.Name, selector.GroupCode, out var tag))
                {
                    result.Add(new OpportunityTag
                    {
                        OpportunityId = opportunity.Id,
                        TagId = tag.Id
                    });
                }
            }
        }

        return result;
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
}


