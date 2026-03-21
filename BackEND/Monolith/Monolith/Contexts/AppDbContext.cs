using Microsoft.EntityFrameworkCore;
using Monolith.Entities;

namespace Monolith.Contexts;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<CandidateProfile> CandidateProfiles => Set<CandidateProfile>();
    public DbSet<CandidatePrivacySettings> CandidatePrivacySettings => Set<CandidatePrivacySettings>();
    public DbSet<CandidateResumeProfile> CandidateResumeProfiles => Set<CandidateResumeProfile>();
    public DbSet<CandidateResumeSkill> CandidateResumeSkills => Set<CandidateResumeSkill>();
    public DbSet<CandidateResumeProject> CandidateResumeProjects => Set<CandidateResumeProject>();
    public DbSet<CandidateResumeProjectPhoto> CandidateResumeProjectPhotos => Set<CandidateResumeProjectPhoto>();
    public DbSet<CandidateResumeProjectParticipant> CandidateResumeProjectParticipants => Set<CandidateResumeProjectParticipant>();
    public DbSet<CandidateResumeProjectCollaboration> CandidateResumeProjectCollaborations => Set<CandidateResumeProjectCollaboration>();
    public DbSet<CandidateResumeEducation> CandidateResumeEducation => Set<CandidateResumeEducation>();
    public DbSet<CandidateResumeLink> CandidateResumeLinks => Set<CandidateResumeLink>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<UserPublicLink> UserPublicLinks => Set<UserPublicLink>();
    public DbSet<ContactRequest> ContactRequests => Set<ContactRequest>();
    public DbSet<UserContact> UserContacts => Set<UserContact>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<TagGroup> TagGroups => Set<TagGroup>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<CompanyLink> CompanyLinks => Set<CompanyLink>();
    public DbSet<CompanyMember> CompanyMembers => Set<CompanyMember>();
    public DbSet<CompanyInvite> CompanyInvites => Set<CompanyInvite>();
    public DbSet<CompanyChatSettings> CompanyChatSettings => Set<CompanyChatSettings>();
    public DbSet<Vacancy> Vacancies => Set<Vacancy>();
    public DbSet<VacancyTag> VacancyTags => Set<VacancyTag>();
    public DbSet<Opportunity> Opportunities => Set<Opportunity>();
    public DbSet<OpportunityTag> OpportunityTags => Set<OpportunityTag>();
    public DbSet<OpportunityParticipant> OpportunityParticipants => Set<OpportunityParticipant>();
    public DbSet<Application> Applications => Set<Application>();
    public DbSet<Chat> Chats => Set<Chat>();
    public DbSet<ChatParticipant> ChatParticipants => Set<ChatParticipant>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<ChatMessageRead> ChatMessageReads => Set<ChatMessageRead>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("citext");
        modelBuilder.HasPostgresExtension("postgis");
        modelBuilder.HasPostgresExtension("pg_trgm");

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Email).HasColumnName("email").HasMaxLength(320);
            entity.Property(x => x.Username).HasColumnName("username").HasMaxLength(50);
            entity.Property(x => x.PasswordHash).HasColumnName("password_hash");
            entity.Property(x => x.DisplayName).HasColumnName("display_name").HasMaxLength(150);
            entity.Property(x => x.AvatarUrl).HasColumnName("avatar_url").HasMaxLength(500);
            entity.Property(x => x.ProfileBannerUrl).HasColumnName("profile_banner_url").HasMaxLength(500);
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.Email).IsUnique();
            entity.HasIndex(x => x.Username).IsUnique();
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.ToTable("user_roles");
            entity.HasKey(x => new { x.UserId, x.Role });
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Role).HasColumnName("role");
            entity.Property(x => x.AssignedAt).HasColumnName("assigned_at");
            entity.HasOne(x => x.User).WithMany(x => x.Roles).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<CandidateProfile>(entity =>
        {
            entity.ToTable("candidate_profiles");
            entity.HasKey(x => x.UserId);
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.LastName).HasColumnName("last_name").HasMaxLength(100);
            entity.Property(x => x.FirstName).HasColumnName("first_name").HasMaxLength(100);
            entity.Property(x => x.MiddleName).HasColumnName("middle_name").HasMaxLength(100);
            entity.Property(x => x.BirthDate).HasColumnName("birth_date");
            entity.Property(x => x.Gender).HasColumnName("gender");
            entity.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(30);
            entity.Property(x => x.About).HasColumnName("about");
            entity.Property(x => x.AvatarUrl).HasColumnName("avatar_url").HasMaxLength(500);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.User).WithOne(x => x.CandidateProfile).HasForeignKey<CandidateProfile>(x => x.UserId);
        });

        modelBuilder.Entity<CandidatePrivacySettings>(entity =>
        {
            entity.ToTable("candidate_privacy_settings");
            entity.HasKey(x => x.UserId);
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.ProfileVisibility).HasColumnName("profile_visibility");
            entity.Property(x => x.ResumeVisibility).HasColumnName("resume_visibility");
            entity.Property(x => x.OpenToWork).HasColumnName("open_to_work");
            entity.Property(x => x.ShowContactsInResume).HasColumnName("show_contacts_in_resume");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.CandidateProfile).WithOne(x => x.PrivacySettings).HasForeignKey<CandidatePrivacySettings>(x => x.UserId);
        });

        modelBuilder.Entity<CandidateResumeProfile>(entity =>
        {
            entity.ToTable("candidate_resume_profiles");
            entity.HasKey(x => x.UserId);
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Headline).HasColumnName("headline").HasMaxLength(200);
            entity.Property(x => x.DesiredPosition).HasColumnName("desired_position").HasMaxLength(200);
            entity.Property(x => x.Summary).HasColumnName("summary");
            entity.Property(x => x.SalaryFrom).HasColumnName("salary_from").HasColumnType("numeric(12,2)");
            entity.Property(x => x.SalaryTo).HasColumnName("salary_to").HasColumnType("numeric(12,2)");
            entity.Property(x => x.CurrencyCode).HasColumnName("currency_code").HasMaxLength(3);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.CandidateProfile).WithOne(x => x.ResumeProfile).HasForeignKey<CandidateResumeProfile>(x => x.UserId);
        });

        modelBuilder.Entity<CandidateResumeSkill>(entity =>
        {
            entity.ToTable("candidate_resume_skills");
            entity.HasKey(x => new { x.UserId, x.TagId });
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.TagId).HasColumnName("tag_id");
            entity.Property(x => x.Level).HasColumnName("level");
            entity.Property(x => x.YearsExperience).HasColumnName("years_experience").HasColumnType("numeric(5,2)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasOne(x => x.Resume).WithMany(x => x.Skills).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Tag).WithMany().HasForeignKey(x => x.TagId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CandidateResumeProject>(entity =>
        {
            entity.ToTable("candidate_resume_projects");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(300);
            entity.Property(x => x.Role).HasColumnName("role").HasMaxLength(150);
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.StartDate).HasColumnName("start_date");
            entity.Property(x => x.EndDate).HasColumnName("end_date");
            entity.Property(x => x.RepoUrl).HasColumnName("repo_url").HasMaxLength(500);
            entity.Property(x => x.DemoUrl).HasColumnName("demo_url").HasMaxLength(500);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Resume).WithMany(x => x.Projects).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CandidateResumeProjectPhoto>(entity =>
        {
            entity.ToTable("candidate_resume_project_photos");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
            entity.Property(x => x.Url).HasColumnName("url").HasMaxLength(500);
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.IsMain).HasColumnName("is_main");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.ProjectId);
            entity.HasOne(x => x.Project).WithMany(x => x.Photos).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CandidateResumeProjectParticipant>(entity =>
        {
            entity.ToTable("candidate_resume_project_participants");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Role).HasColumnName("role").HasMaxLength(150);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.ProjectId);
            entity.HasIndex(x => x.UserId);
            entity.HasIndex(x => new { x.ProjectId, x.UserId }).IsUnique();
            entity.HasOne(x => x.Project).WithMany(x => x.Participants).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CandidateResumeProjectCollaboration>(entity =>
        {
            entity.ToTable(
                "candidate_resume_project_collaborations",
                table => table.HasCheckConstraint(
                    "ck_candidate_resume_project_collaborations_type_ref",
                    @"(type = 1 AND user_id IS NOT NULL AND vacancy_id IS NULL AND opportunity_id IS NULL)
                  OR (type = 2 AND user_id IS NULL AND vacancy_id IS NOT NULL AND opportunity_id IS NULL)
                  OR (type = 3 AND user_id IS NULL AND vacancy_id IS NULL AND opportunity_id IS NOT NULL)
                  OR (type = 4 AND user_id IS NULL AND vacancy_id IS NULL AND opportunity_id IS NULL)"));
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
            entity.Property(x => x.Type).HasColumnName("type");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.VacancyId).HasColumnName("vacancy_id");
            entity.Property(x => x.OpportunityId).HasColumnName("opportunity_id");
            entity.Property(x => x.Label).HasColumnName("label").HasMaxLength(300);
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.ProjectId);
            entity.HasIndex(x => x.Type);
            entity.HasIndex(x => x.UserId);
            entity.HasIndex(x => x.VacancyId);
            entity.HasIndex(x => x.OpportunityId);
            entity.HasOne(x => x.Project).WithMany(x => x.Collaborations).HasForeignKey(x => x.ProjectId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Vacancy).WithMany().HasForeignKey(x => x.VacancyId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Opportunity).WithMany().HasForeignKey(x => x.OpportunityId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CandidateResumeEducation>(entity =>
        {
            entity.ToTable("candidate_resume_education");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.University).HasColumnName("university").HasMaxLength(300);
            entity.Property(x => x.Faculty).HasColumnName("faculty").HasMaxLength(200);
            entity.Property(x => x.Specialty).HasColumnName("specialty").HasMaxLength(200);
            entity.Property(x => x.Course).HasColumnName("course");
            entity.Property(x => x.GraduationYear).HasColumnName("graduation_year");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Resume).WithMany(x => x.EducationEntries).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CandidateResumeLink>(entity =>
        {
            entity.ToTable("candidate_resume_links");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(50);
            entity.Property(x => x.Url).HasColumnName("url").HasMaxLength(500);
            entity.Property(x => x.Label).HasColumnName("label").HasMaxLength(150);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasOne(x => x.Resume).WithMany(x => x.Links).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.TokenHash).HasColumnName("token_hash").HasMaxLength(128);
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.RevokedAt).HasColumnName("revoked_at");
            entity.Property(x => x.ReplacedByTokenId).HasColumnName("replaced_by_token_id");
            entity.Property(x => x.CreatedByIp).HasColumnName("created_by_ip").HasMaxLength(100);
            entity.Property(x => x.UserAgent).HasColumnName("user_agent").HasMaxLength(300);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.TokenHash).IsUnique();
            entity.HasOne(x => x.User).WithMany(x => x.RefreshTokens).HasForeignKey(x => x.UserId);
        });

        modelBuilder.Entity<UserPublicLink>(entity =>
        {
            entity.ToTable("user_public_links");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Kind).HasColumnName("kind").HasMaxLength(50);
            entity.Property(x => x.Url).HasColumnName("url").HasMaxLength(500);
            entity.Property(x => x.Label).HasColumnName("label").HasMaxLength(150);
            entity.Property(x => x.SortOrder).HasColumnName("sort_order");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.UserId);
            entity.HasOne(x => x.User).WithMany(x => x.PublicLinks).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ContactRequest>(entity =>
        {
            entity.ToTable("contact_requests");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.FromUserId).HasColumnName("from_user_id");
            entity.Property(x => x.ToUserId).HasColumnName("to_user_id");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.FromUserId, x.ToUserId }).IsUnique();
            entity.HasOne(x => x.FromUser).WithMany(x => x.OutgoingContactRequests).HasForeignKey(x => x.FromUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ToUser).WithMany(x => x.IncomingContactRequests).HasForeignKey(x => x.ToUserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserContact>(entity =>
        {
            entity.ToTable("user_contacts");
            entity.HasKey(x => new { x.UserId, x.ContactUserId });
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.ContactUserId).HasColumnName("contact_user_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasOne(x => x.User).WithMany(x => x.Contacts).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.ContactUser).WithMany(x => x.ContactOfUsers).HasForeignKey(x => x.ContactUserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<City>(entity =>
        {
            entity.ToTable("cities");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CountryCode).HasColumnName("country_code").HasMaxLength(2);
            entity.Property(x => x.RegionName).HasColumnName("region_name").HasMaxLength(200);
            entity.Property(x => x.CityName).HasColumnName("city_name").HasMaxLength(200);
            entity.Property(x => x.Latitude).HasColumnName("latitude").HasColumnType("numeric(9,6)");
            entity.Property(x => x.Longitude).HasColumnName("longitude").HasColumnType("numeric(9,6)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.CountryCode, x.RegionName, x.CityName }).IsUnique();
        });

        modelBuilder.Entity<Location>(entity =>
        {
            entity.ToTable("locations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CityId).HasColumnName("city_id");
            entity.Property(x => x.GeoPoint).HasColumnName("geo_point").HasColumnType("geometry(Point,4326)");
            entity.Property(x => x.StreetName).HasColumnName("street_name").HasMaxLength(200);
            entity.Property(x => x.HouseNumber).HasColumnName("house_number").HasMaxLength(50);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.City).WithMany(x => x.Locations).HasForeignKey(x => x.CityId);
        });

        modelBuilder.Entity<TagGroup>(entity =>
        {
            entity.ToTable("tag_groups");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Code).HasColumnName("code").HasMaxLength(50);
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.IsSystem).HasColumnName("is_system");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.Code).IsUnique();
            entity.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<Tag>(entity =>
        {
            entity.ToTable("tags");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.GroupId).HasColumnName("group_id");
            entity.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
            entity.Property(x => x.Slug).HasColumnName("slug").HasMaxLength(120);
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.HasIndex(x => new { x.GroupId, x.Name }).IsUnique();
            entity.HasOne(x => x.Group).WithMany(x => x.Tags).HasForeignKey(x => x.GroupId);
        });

        modelBuilder.Entity<Company>(entity =>
        {
            entity.ToTable("companies");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.LegalName).HasColumnName("legal_name").HasMaxLength(300);
            entity.Property(x => x.BrandName).HasColumnName("brand_name").HasMaxLength(300);
            entity.Property(x => x.LegalType).HasColumnName("legal_type");
            entity.Property(x => x.TaxId).HasColumnName("tax_id").HasMaxLength(20);
            entity.Property(x => x.RegistrationNumber).HasColumnName("registration_number").HasMaxLength(20);
            entity.Property(x => x.Industry).HasColumnName("industry").HasMaxLength(200);
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.LogoUrl).HasColumnName("logo_url").HasMaxLength(500);
            entity.Property(x => x.WebsiteUrl).HasColumnName("website_url").HasMaxLength(500);
            entity.Property(x => x.PublicEmail).HasColumnName("public_email").HasMaxLength(320);
            entity.Property(x => x.PublicPhone).HasColumnName("public_phone").HasMaxLength(30);
            entity.Property(x => x.BaseCityId).HasColumnName("base_city_id");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.TaxId).IsUnique();
            entity.HasIndex(x => x.RegistrationNumber).IsUnique();
            entity.HasOne(x => x.BaseCity).WithMany().HasForeignKey(x => x.BaseCityId);
        });

        modelBuilder.Entity<CompanyLink>(entity =>
        {
            entity.ToTable("company_links");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CompanyId).HasColumnName("company_id");
            entity.Property(x => x.LinkKind).HasColumnName("link_kind");
            entity.Property(x => x.Label).HasColumnName("label").HasMaxLength(150);
            entity.Property(x => x.Url).HasColumnName("url").HasMaxLength(500);
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasOne(x => x.Company).WithMany(x => x.Links).HasForeignKey(x => x.CompanyId);
        });

        modelBuilder.Entity<CompanyMember>(entity =>
        {
            entity.ToTable("company_members");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CompanyId).HasColumnName("company_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Role).HasColumnName("role");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.UserId).IsUnique();
            entity.HasIndex(x => new { x.CompanyId, x.UserId }).IsUnique();
            entity.HasOne(x => x.Company).WithMany(x => x.Members).HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.User).WithMany(x => x.CompanyMemberships).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CompanyInvite>(entity =>
        {
            entity.ToTable("company_invites");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CompanyId).HasColumnName("company_id");
            entity.Property(x => x.InvitedByUserId).HasColumnName("invited_by_user_id");
            entity.Property(x => x.Role).HasColumnName("role");
            entity.Property(x => x.Token).HasColumnName("token").HasMaxLength(120);
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.AcceptedAt).HasColumnName("accepted_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.Token).IsUnique();
            entity.HasOne(x => x.Company).WithMany(x => x.Invites).HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.InvitedByUser).WithMany(x => x.SentCompanyInvites).HasForeignKey(x => x.InvitedByUserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CompanyChatSettings>(entity =>
        {
            entity.ToTable("company_chat_settings");
            entity.HasKey(x => x.CompanyId);
            entity.Property(x => x.CompanyId).HasColumnName("company_id");
            entity.Property(x => x.AutoGreetingEnabled).HasColumnName("auto_greeting_enabled");
            entity.Property(x => x.AutoGreetingText).HasColumnName("auto_greeting_text").HasMaxLength(2000);
            entity.Property(x => x.OutsideHoursEnabled).HasColumnName("outside_hours_enabled");
            entity.Property(x => x.OutsideHoursText).HasColumnName("outside_hours_text").HasMaxLength(2000);
            entity.Property(x => x.WorkingHoursTimezone).HasColumnName("working_hours_timezone").HasMaxLength(100);
            entity.Property(x => x.WorkingHoursFrom).HasColumnName("working_hours_from");
            entity.Property(x => x.WorkingHoursTo).HasColumnName("working_hours_to");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Company).WithOne(x => x.ChatSettings).HasForeignKey<CompanyChatSettings>(x => x.CompanyId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Vacancy>(entity =>
        {
            entity.ToTable("vacancies");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CompanyId).HasColumnName("company_id");
            entity.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(300);
            entity.Property(x => x.ShortDescription).HasColumnName("short_description").HasMaxLength(500);
            entity.Property(x => x.FullDescription).HasColumnName("full_description");
            entity.Property(x => x.Kind).HasColumnName("kind");
            entity.Property(x => x.Format).HasColumnName("format");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.CityId).HasColumnName("city_id");
            entity.Property(x => x.LocationId).HasColumnName("location_id");
            entity.Property(x => x.SalaryFrom).HasColumnName("salary_from").HasColumnType("numeric(12,2)");
            entity.Property(x => x.SalaryTo).HasColumnName("salary_to").HasColumnType("numeric(12,2)");
            entity.Property(x => x.CurrencyCode).HasColumnName("currency_code").HasMaxLength(3);
            entity.Property(x => x.SalaryTaxMode).HasColumnName("salary_tax_mode");
            entity.Property(x => x.PublishAt).HasColumnName("publish_at");
            entity.Property(x => x.ApplicationDeadline).HasColumnName("application_deadline");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Company).WithMany(x => x.Vacancies).HasForeignKey(x => x.CompanyId);
            entity.HasOne(x => x.City).WithMany().HasForeignKey(x => x.CityId);
            entity.HasOne(x => x.Location).WithMany().HasForeignKey(x => x.LocationId);
        });

        modelBuilder.Entity<VacancyTag>(entity =>
        {
            entity.ToTable("vacancy_tags");
            entity.HasKey(x => new { x.VacancyId, x.TagId });
            entity.Property(x => x.VacancyId).HasColumnName("vacancy_id");
            entity.Property(x => x.TagId).HasColumnName("tag_id");
            entity.HasOne(x => x.Vacancy).WithMany(x => x.VacancyTags).HasForeignKey(x => x.VacancyId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Tag).WithMany(x => x.VacancyTags).HasForeignKey(x => x.TagId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Opportunity>(entity =>
        {
            entity.ToTable("opportunities");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CompanyId).HasColumnName("company_id");
            entity.Property(x => x.CreatedByUserId).HasColumnName("created_by_user_id");
            entity.Property(x => x.Title).HasColumnName("title").HasMaxLength(300);
            entity.Property(x => x.ShortDescription).HasColumnName("short_description").HasMaxLength(500);
            entity.Property(x => x.FullDescription).HasColumnName("full_description");
            entity.Property(x => x.Kind).HasColumnName("kind");
            entity.Property(x => x.Format).HasColumnName("format");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.CityId).HasColumnName("city_id");
            entity.Property(x => x.LocationId).HasColumnName("location_id");
            entity.Property(x => x.PriceType).HasColumnName("price_type");
            entity.Property(x => x.PriceAmount).HasColumnName("price_amount").HasColumnType("numeric(12,2)");
            entity.Property(x => x.PriceCurrencyCode).HasColumnName("price_currency_code").HasMaxLength(3);
            entity.Property(x => x.ParticipantsCanWrite).HasColumnName("participants_can_write");
            entity.Property(x => x.PublishAt).HasColumnName("publish_at");
            entity.Property(x => x.EventDate).HasColumnName("event_date");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Company).WithMany(x => x.Opportunities).HasForeignKey(x => x.CompanyId);
            entity.HasOne(x => x.City).WithMany().HasForeignKey(x => x.CityId);
            entity.HasOne(x => x.Location).WithMany().HasForeignKey(x => x.LocationId);
        });

        modelBuilder.Entity<OpportunityTag>(entity =>
        {
            entity.ToTable("opportunity_tags");
            entity.HasKey(x => new { x.OpportunityId, x.TagId });
            entity.Property(x => x.OpportunityId).HasColumnName("opportunity_id");
            entity.Property(x => x.TagId).HasColumnName("tag_id");
            entity.HasOne(x => x.Opportunity).WithMany(x => x.OpportunityTags).HasForeignKey(x => x.OpportunityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Tag).WithMany(x => x.OpportunityTags).HasForeignKey(x => x.TagId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OpportunityParticipant>(entity =>
        {
            entity.ToTable("opportunity_participants");
            entity.HasKey(x => new { x.OpportunityId, x.UserId });
            entity.Property(x => x.OpportunityId).HasColumnName("opportunity_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.JoinedAt).HasColumnName("joined_at");
            entity.HasOne(x => x.Opportunity).WithMany(x => x.Participants).HasForeignKey(x => x.OpportunityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.User).WithMany(x => x.OpportunityParticipations).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Application>(entity =>
        {
            entity.ToTable("applications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.CompanyId).HasColumnName("company_id");
            entity.Property(x => x.CandidateUserId).HasColumnName("candidate_user_id");
            entity.Property(x => x.VacancyId).HasColumnName("vacancy_id");
            entity.Property(x => x.InitiatorRole).HasColumnName("initiator_role");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.CompanyId);
            entity.HasIndex(x => x.CandidateUserId);
            entity.HasIndex(x => x.VacancyId);
            entity.HasOne(x => x.Company).WithMany(x => x.Applications).HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.CandidateUser).WithMany(x => x.CandidateApplications).HasForeignKey(x => x.CandidateUserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Vacancy).WithMany(x => x.Applications).HasForeignKey(x => x.VacancyId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Chat>(entity =>
        {
            entity.ToTable("chats");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.Type).HasColumnName("type");
            entity.Property(x => x.ApplicationId).HasColumnName("application_id");
            entity.Property(x => x.OpportunityId).HasColumnName("opportunity_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => x.ApplicationId).IsUnique().HasFilter("application_id IS NOT NULL");
            entity.HasIndex(x => x.OpportunityId).IsUnique().HasFilter("opportunity_id IS NOT NULL");
            entity.HasOne(x => x.Application).WithOne(x => x.Chat).HasForeignKey<Chat>(x => x.ApplicationId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Opportunity).WithOne(x => x.Chat).HasForeignKey<Chat>(x => x.OpportunityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatParticipant>(entity =>
        {
            entity.ToTable("chat_participants");
            entity.HasKey(x => new { x.ChatId, x.UserId });
            entity.Property(x => x.ChatId).HasColumnName("chat_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasOne(x => x.Chat).WithMany(x => x.Participants).HasForeignKey(x => x.ChatId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.User).WithMany(x => x.ChatParticipants).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatMessage>(entity =>
        {
            entity.ToTable("chat_messages");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ChatId).HasColumnName("chat_id");
            entity.Property(x => x.SenderUserId).HasColumnName("sender_user_id");
            entity.Property(x => x.Text).HasColumnName("text");
            entity.Property(x => x.IsSystem).HasColumnName("is_system");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(x => new { x.ChatId, x.CreatedAt });
            entity.HasOne(x => x.Chat).WithMany(x => x.Messages).HasForeignKey(x => x.ChatId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.SenderUser).WithMany(x => x.ChatMessages).HasForeignKey(x => x.SenderUserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatMessageRead>(entity =>
        {
            entity.ToTable("chat_message_reads");
            entity.HasKey(x => new { x.MessageId, x.UserId });
            entity.Property(x => x.MessageId).HasColumnName("message_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.ReadAt).HasColumnName("read_at");
            entity.HasOne(x => x.Message).WithMany(x => x.Reads).HasForeignKey(x => x.MessageId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.User).WithMany(x => x.ChatReads).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added)
            {
                SetTimestamp(entry, "CreatedAt", now);
                SetTimestamp(entry, "UpdatedAt", now);
            }
            else if (entry.State == EntityState.Modified)
            {
                SetTimestamp(entry, "UpdatedAt", now);
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }

    private static void SetTimestamp(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry, string propertyName, DateTimeOffset value)
    {
        if (entry.Properties.Any(p => p.Metadata.Name == propertyName))
        {
            entry.Property(propertyName).CurrentValue = value;
        }
    }
}
