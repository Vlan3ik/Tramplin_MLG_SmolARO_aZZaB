using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class EmployerVerificationRefactorV1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "employer_verification_industries",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employer_verification_industries", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "employer_verification_required_documents",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    employer_type = table.Column<int>(type: "integer", nullable: false),
                    document_type = table.Column<int>(type: "integer", nullable: false),
                    is_required = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employer_verification_required_documents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "employer_verification_profiles",
                columns: table => new
                {
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    employer_type = table.Column<int>(type: "integer", nullable: false),
                    ogrn_or_ogrnip = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    inn = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    kpp = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    legal_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    actual_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    representative_full_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    representative_position = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    main_industry_id = table.Column<long>(type: "bigint", nullable: false),
                    tax_office = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    work_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    work_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    site_or_public_links = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    review_status = table.Column<int>(type: "integer", nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    verified_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    verified_by_user_id = table.Column<long>(type: "bigint", nullable: true),
                    reject_reason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    missing_docs = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employer_verification_profiles", x => x.company_id);
                    table.ForeignKey(
                        name: "FK_employer_verification_profiles_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_employer_verification_profiles_employer_verification_indust~",
                        column: x => x.main_industry_id,
                        principalTable: "employer_verification_industries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_employer_verification_profiles_users_verified_by_user_id",
                        column: x => x.verified_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "employer_verification_documents",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    document_type = table.Column<int>(type: "integer", nullable: false),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    content_type = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    storage_key = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    access_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    moderator_comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    uploaded_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    reviewed_by_user_id = table.Column<long>(type: "bigint", nullable: true),
                    reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employer_verification_documents", x => x.id);
                    table.ForeignKey(
                        name: "FK_employer_verification_documents_employer_verification_profi~",
                        column: x => x.company_id,
                        principalTable: "employer_verification_profiles",
                        principalColumn: "company_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_employer_verification_documents_users_reviewed_by_user_id",
                        column: x => x.reviewed_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_employer_verification_documents_users_uploaded_by_user_id",
                        column: x => x.uploaded_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_employer_verification_documents_company_id_document_type",
                table: "employer_verification_documents",
                columns: new[] { "company_id", "document_type" });

            migrationBuilder.CreateIndex(
                name: "IX_employer_verification_documents_reviewed_by_user_id",
                table: "employer_verification_documents",
                column: "reviewed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_employer_verification_documents_uploaded_by_user_id",
                table: "employer_verification_documents",
                column: "uploaded_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_employer_verification_industries_slug",
                table: "employer_verification_industries",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_employer_verification_profiles_main_industry_id",
                table: "employer_verification_profiles",
                column: "main_industry_id");

            migrationBuilder.CreateIndex(
                name: "IX_employer_verification_profiles_verified_by_user_id",
                table: "employer_verification_profiles",
                column: "verified_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_employer_verification_required_documents_employer_type_docu~",
                table: "employer_verification_required_documents",
                columns: new[] { "employer_type", "document_type" },
                unique: true);

            migrationBuilder.Sql(
                """
                INSERT INTO employer_verification_industries (slug, name, sort_order, created_at, updated_at)
                VALUES
                    ('it-software','IT / Software',0,NOW(),NOW()),
                    ('design-creative','Design / Creative',1,NOW(),NOW()),
                    ('marketing-media','Marketing / Media',2,NOW(),NOW()),
                    ('education','Education',3,NOW(),NOW()),
                    ('hr-recruitment','HR / Recruitment',4,NOW(),NOW()),
                    ('finance-accounting','Finance / Accounting',5,NOW(),NOW()),
                    ('sales-support','Sales / Customer Support',6,NOW(),NOW()),
                    ('manufacturing-engineering','Manufacturing / Engineering',7,NOW(),NOW()),
                    ('logistics','Logistics',8,NOW(),NOW()),
                    ('healthcare','Healthcare',9,NOW(),NOW()),
                    ('construction-real-estate','Construction / Real Estate',10,NOW(),NOW()),
                    ('retail-horeca','Retail / HoReCa',11,NOW(),NOW()),
                    ('public-ngo','Public / NGO',12,NOW(),NOW()),
                    ('other','Other',13,NOW(),NOW());
                """);

            migrationBuilder.Sql(
                """
                INSERT INTO employer_verification_required_documents (employer_type, document_type, is_required, created_at)
                VALUES
                    (1,1,TRUE,NOW()), (1,3,TRUE,NOW()), (1,4,TRUE,NOW()), (1,5,TRUE,NOW()), (1,6,TRUE,NOW()),
                    (2,2,TRUE,NOW()), (2,7,TRUE,NOW()), (2,8,TRUE,NOW()), (2,6,TRUE,NOW()),
                    (3,9,TRUE,NOW()), (3,7,TRUE,NOW()), (3,10,TRUE,NOW()), (3,11,TRUE,NOW()),
                    (4,1,TRUE,NOW()), (4,3,TRUE,NOW()), (4,12,TRUE,NOW()), (4,13,TRUE,NOW()), (4,14,TRUE,NOW()),
                    (5,10,TRUE,NOW()), (5,7,TRUE,NOW()), (5,9,TRUE,NOW()), (5,15,TRUE,NOW()), (5,16,TRUE,NOW()),
                    (6,10,TRUE,NOW()), (6,17,TRUE,NOW());
                """);

            migrationBuilder.Sql(
                """
                INSERT INTO employer_verification_profiles (
                    company_id, employer_type, ogrn_or_ogrnip, inn, kpp, legal_address, actual_address,
                    representative_full_name, representative_position, main_industry_id, tax_office,
                    work_email, work_phone, site_or_public_links, review_status, submitted_at, verified_at,
                    verified_by_user_id, reject_reason, missing_docs, created_at, updated_at
                )
                SELECT
                    c.id,
                    CASE WHEN c.legal_type = 2 THEN 2 ELSE 1 END,
                    COALESCE(c.registration_number, ''),
                    COALESCE(c.tax_id, ''),
                    NULL,
                    '',
                    NULL,
                    '',
                    NULL,
                    (SELECT i.id FROM employer_verification_industries i WHERE i.slug = 'other'),
                    NULL,
                    COALESCE(c.public_email, ''),
                    COALESCE(c.public_phone, ''),
                    c.website_url,
                    CASE
                        WHEN c.status = 4 THEN 4
                        WHEN c.status IN (2,3) THEN 2
                        ELSE 1
                    END,
                    CASE
                        WHEN c.status IN (2,3,4) THEN NOW()
                        ELSE NULL
                    END,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NOW(),
                    NOW()
                FROM companies c;
                """);

            migrationBuilder.Sql("UPDATE companies SET status = 2 WHERE status = 3;");

            migrationBuilder.DropIndex(
                name: "IX_companies_registration_number",
                table: "companies");

            migrationBuilder.DropIndex(
                name: "IX_companies_tax_id",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "industry",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "legal_type",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "registration_number",
                table: "companies");

            migrationBuilder.DropColumn(
                name: "tax_id",
                table: "companies");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "employer_verification_documents");

            migrationBuilder.DropTable(
                name: "employer_verification_required_documents");

            migrationBuilder.DropTable(
                name: "employer_verification_profiles");

            migrationBuilder.DropTable(
                name: "employer_verification_industries");

            migrationBuilder.AddColumn<string>(
                name: "industry",
                table: "companies",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "legal_type",
                table: "companies",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "registration_number",
                table: "companies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "tax_id",
                table: "companies",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_companies_registration_number",
                table: "companies",
                column: "registration_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_companies_tax_id",
                table: "companies",
                column: "tax_id",
                unique: true);
        }
    }
}
