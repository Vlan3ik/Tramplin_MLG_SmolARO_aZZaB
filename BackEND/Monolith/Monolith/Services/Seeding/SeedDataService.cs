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

        var employers = new List<User>();
        for (var i = 1; i <= 40; i++)
        {
            var employer = await EnsureUserAsync(
                $"employer{i}@tramplin.local",
                $"Работодатель {i}",
                "Employer123!",
                AccountStatus.Active,
                "/api/media/user-avatars/system/employer.svg");
            employers.Add(employer);
        }

        var seekers = new List<User>();
        for (var i = 1; i <= 25; i++)
        {
            var seeker = await EnsureUserAsync(
                $"seeker{i}@tramplin.local",
                $"Соискатель {i}",
                "Seeker123!",
                AccountStatus.Active,
                "/api/media/user-avatars/system/seeker.svg");
            seekers.Add(seeker);
        }

        await EnsureRoleAsync(curator.Id, PlatformRole.Curator, now);
        foreach (var employer in employers)
        {
            await EnsureRoleAsync(employer.Id, PlatformRole.Employer, now);
        }

        foreach (var seeker in seekers)
        {
            await EnsureRoleAsync(seeker.Id, PlatformRole.Seeker, now);
        }

        await SeedSeekerProfilesAsync(seekers);

        var cities = await EnsureCitiesAsync();
        var locations = await EnsureLocationsAsync(cities);
        var tags = await EnsureTagsAsync();

        await ClearDomainDataAsync();

        var companies = BuildCompanies(cities);
        dbContext.Companies.AddRange(companies);
        await dbContext.SaveChangesAsync();

        var companyMembers = BuildCompanyMembers(companies, employers);
        dbContext.CompanyMembers.AddRange(companyMembers);

        dbContext.CompanyChatSettings.AddRange(companies.Select((company, index) => new CompanyChatSettings
        {
            CompanyId = company.Id,
            AutoGreetingEnabled = true,
            AutoGreetingText = $"Здравствуйте! Спасибо за интерес к компании «{company.BrandName ?? company.LegalName}».",
            OutsideHoursEnabled = index % 2 == 0,
            OutsideHoursText = "Мы получили сообщение вне рабочего времени и ответим в ближайший рабочий день.",
            WorkingHoursTimezone = "Europe/Moscow",
            WorkingHoursFrom = TimeSpan.FromHours(9),
            WorkingHoursTo = TimeSpan.FromHours(18)
        }));

        var companyLinks = companies.Select(company => new CompanyLink
        {
            CompanyId = company.Id,
            LinkKind = LinkType.Website,
            Label = "Сайт",
            Url = company.WebsiteUrl ?? string.Empty
        }).ToList();

        var webCanape = companies.FirstOrDefault(x => x.BrandName == "WebCanape");
        if (webCanape is not null)
        {
            companyLinks.Add(new CompanyLink
            {
                CompanyId = webCanape.Id,
                LinkKind = LinkType.Vk,
                Label = "VK",
                Url = "https://vk.com/webcanape"
            });
            companyLinks.Add(new CompanyLink
            {
                CompanyId = webCanape.Id,
                LinkKind = LinkType.Other,
                Label = "YouTube",
                Url = "https://www.youtube.com/channel/UCq6b89UtrJaQF6ixSYGf3aA"
            });
        }

        var coalla = companies.FirstOrDefault(x => x.BrandName == "Агентство Coalla");
        if (coalla is not null)
        {
            companyLinks.Add(new CompanyLink
            {
                CompanyId = coalla.Id,
                LinkKind = LinkType.Vk,
                Label = "VK",
                Url = "https://vk.com/coalla.agency"
            });
            companyLinks.Add(new CompanyLink
            {
                CompanyId = coalla.Id,
                LinkKind = LinkType.Other,
                Label = "YouTube",
                Url = "https://www.youtube.com/channel/UCywGrjdmRCT_i8YbIikJAJg"
            });
        }

        var prostyeResheniya = companies.FirstOrDefault(x => x.BrandName == "Простые решения");
        if (prostyeResheniya is not null)
        {
            companyLinks.Add(new CompanyLink
            {
                CompanyId = prostyeResheniya.Id,
                LinkKind = LinkType.Vk,
                Label = "VK",
                Url = "https://vk.com/odineska"
            });
            companyLinks.Add(new CompanyLink
            {
                CompanyId = prostyeResheniya.Id,
                LinkKind = LinkType.Other,
                Label = "YouTube",
                Url = "https://www.youtube.com/user/odineska/"
            });
        }

        dbContext.CompanyLinks.AddRange(companyLinks);

        dbContext.CompanyInvites.AddRange(companies.Select((company, index) => new CompanyInvite
        {
            CompanyId = company.Id,
            InvitedByUserId = companyMembers.First(x => x.CompanyId == company.Id && x.Role == CompanyMemberRole.Owner).UserId,
            Role = CompanyMemberRole.Admin,
            Token = $"seed-invite-company-{company.Id}-{index + 1}",
            ExpiresAt = now.AddDays(14 + (index % 7)),
            AcceptedAt = index % 3 == 0 ? now.AddDays(-index - 1) : null
        }));

        await dbContext.SaveChangesAsync();

        var vacancies = BuildVacancies(companies, companyMembers, locations, now);
        dbContext.Vacancies.AddRange(vacancies);
        await dbContext.SaveChangesAsync();

        var opportunities = BuildOpportunities(companies, companyMembers, locations, now);
        dbContext.Opportunities.AddRange(opportunities);
        await dbContext.SaveChangesAsync();

        await SeedPortfolioProjectsAsync(seekers, vacancies, opportunities);

        dbContext.VacancyTags.AddRange(BuildVacancyTags(vacancies, tags));
        dbContext.OpportunityTags.AddRange(BuildOpportunityTags(opportunities, tags));
        await dbContext.SaveChangesAsync();

        var participations = BuildOpportunityParticipations(opportunities, seekers, now);
        dbContext.OpportunityParticipants.AddRange(participations);
        await dbContext.SaveChangesAsync();

        await SeedOpportunityChatsAsync(opportunities, participations, companyMembers, now);

        var applications = BuildApplications(vacancies, seekers);
        dbContext.Applications.AddRange(applications);
        await dbContext.SaveChangesAsync();

        await SeedApplicationChatsAsync(applications, companyMembers);
        await SeedDirectChatsAsync(seekers);
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

    private async Task SeedSeekerProfilesAsync(IReadOnlyList<User> seekers)
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

        for (var i = 0; i < seekers.Count; i++)
        {
            var seeker = seekers[i];
            await EnsureSeekerProfileAsync(
                seeker.Id,
                lastNames[i % lastNames.Length],
                firstNames[i % firstNames.Length],
                middleNames[i % middleNames.Length],
                $"+7-900-200-{i / 10:00}-{i % 10:00}");
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
                LegalType = i % 4 == 0 ? CompanyLegalType.IndividualEntrepreneur : CompanyLegalType.LegalEntity,
                TaxId = $"7701{i + 1:000000}",
                RegistrationNumber = $"1027700{i + 1:000000}",
                Industry = template.Item3,
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

    private async Task EnsureSeekerProfileAsync(long userId, string lastName, string firstName, string middleName, string phone)
    {
        if (!await dbContext.CandidateProfiles.AnyAsync(x => x.UserId == userId))
        {
            dbContext.CandidateProfiles.Add(new CandidateProfile
            {
                UserId = userId,
                LastName = lastName,
                FirstName = firstName,
                MiddleName = middleName,
                Phone = phone,
                About = "Соискатель в IT-сфере",
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
