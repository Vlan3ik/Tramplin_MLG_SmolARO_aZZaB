﻿using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class InitialEmployerApi2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:citext", ",,")
                .Annotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.CreateTable(
                name: "cities",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    country_code = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    region_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    city_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    latitude = table.Column<decimal>(type: "numeric(9,6)", nullable: true),
                    longitude = table.Column<decimal>(type: "numeric(9,6)", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cities", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tag_groups",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    is_system = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tag_groups", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    username = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    password_hash = table.Column<string>(type: "text", nullable: false),
                    fio = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    avatar_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    last_login_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "companies",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    legal_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    brand_name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    legal_type = table.Column<int>(type: "integer", nullable: false),
                    tax_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    registration_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    industry = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    logo_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    website_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    public_email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    public_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    base_city_id = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_companies", x => x.id);
                    table.ForeignKey(
                        name: "FK_companies_cities_base_city_id",
                        column: x => x.base_city_id,
                        principalTable: "cities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "locations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    city_id = table.Column<long>(type: "bigint", nullable: false),
                    geo_point = table.Column<Point>(type: "geometry(Point,4326)", nullable: false),
                    street_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    house_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_locations", x => x.id);
                    table.ForeignKey(
                        name: "FK_locations_cities_city_id",
                        column: x => x.city_id,
                        principalTable: "cities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tags",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    group_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    slug = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tags", x => x.id);
                    table.ForeignKey(
                        name: "FK_tags_tag_groups_group_id",
                        column: x => x.group_id,
                        principalTable: "tag_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_profiles",
                columns: table => new
                {
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    last_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    first_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    middle_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    about = table.Column<string>(type: "text", nullable: true),
                    avatar_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidate_profiles", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_candidate_profiles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "contact_requests",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    from_user_id = table.Column<long>(type: "bigint", nullable: false),
                    to_user_id = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contact_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_contact_requests_users_from_user_id",
                        column: x => x.from_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_contact_requests_users_to_user_id",
                        column: x => x.to_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    replaced_by_token_id = table.Column<long>(type: "bigint", nullable: true),
                    created_by_ip = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.id);
                    table.ForeignKey(
                        name: "FK_refresh_tokens_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_contacts",
                columns: table => new
                {
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    contact_user_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_contacts", x => new { x.user_id, x.contact_user_id });
                    table.ForeignKey(
                        name: "FK_user_contacts_users_contact_user_id",
                        column: x => x.contact_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_contacts_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                columns: table => new
                {
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    role = table.Column<int>(type: "integer", nullable: false),
                    assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_roles", x => new { x.user_id, x.role });
                    table.ForeignKey(
                        name: "FK_user_roles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "company_chat_settings",
                columns: table => new
                {
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    auto_greeting_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    auto_greeting_text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    outside_hours_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    outside_hours_text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    working_hours_timezone = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    working_hours_from = table.Column<TimeSpan>(type: "interval", nullable: true),
                    working_hours_to = table.Column<TimeSpan>(type: "interval", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_company_chat_settings", x => x.company_id);
                    table.ForeignKey(
                        name: "FK_company_chat_settings_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "company_invites",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    invited_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    role = table.Column<int>(type: "integer", nullable: false),
                    token = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    accepted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_company_invites", x => x.id);
                    table.ForeignKey(
                        name: "FK_company_invites_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_company_invites_users_invited_by_user_id",
                        column: x => x.invited_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "company_links",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    link_kind = table.Column<int>(type: "integer", nullable: false),
                    label = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_company_links", x => x.id);
                    table.ForeignKey(
                        name: "FK_company_links_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "company_members",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    role = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_company_members", x => x.id);
                    table.ForeignKey(
                        name: "FK_company_members_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_company_members_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "opportunities",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    created_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    short_description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    full_description = table.Column<string>(type: "text", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    format = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    city_id = table.Column<long>(type: "bigint", nullable: true),
                    location_id = table.Column<long>(type: "bigint", nullable: true),
                    price_type = table.Column<int>(type: "integer", nullable: false),
                    price_amount = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    price_currency_code = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true),
                    participants_can_write = table.Column<bool>(type: "boolean", nullable: false),
                    publish_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    event_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_opportunities", x => x.id);
                    table.ForeignKey(
                        name: "FK_opportunities_cities_city_id",
                        column: x => x.city_id,
                        principalTable: "cities",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_opportunities_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_opportunities_locations_location_id",
                        column: x => x.location_id,
                        principalTable: "locations",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "vacancies",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    created_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    short_description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    full_description = table.Column<string>(type: "text", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    format = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    city_id = table.Column<long>(type: "bigint", nullable: true),
                    location_id = table.Column<long>(type: "bigint", nullable: true),
                    salary_from = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    salary_to = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    currency_code = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true),
                    salary_tax_mode = table.Column<int>(type: "integer", nullable: false),
                    publish_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    application_deadline = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vacancies", x => x.id);
                    table.ForeignKey(
                        name: "FK_vacancies_cities_city_id",
                        column: x => x.city_id,
                        principalTable: "cities",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_vacancies_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_vacancies_locations_location_id",
                        column: x => x.location_id,
                        principalTable: "locations",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "candidate_privacy_settings",
                columns: table => new
                {
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    profile_visibility = table.Column<int>(type: "integer", nullable: false),
                    resume_visibility = table.Column<int>(type: "integer", nullable: false),
                    open_to_work = table.Column<bool>(type: "boolean", nullable: false),
                    show_contacts_in_resume = table.Column<bool>(type: "boolean", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidate_privacy_settings", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_candidate_privacy_settings_candidate_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "candidate_profiles",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_resume_profiles",
                columns: table => new
                {
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    headline = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    desired_position = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    summary = table.Column<string>(type: "text", nullable: true),
                    salary_from = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    salary_to = table.Column<decimal>(type: "numeric(12,2)", nullable: true),
                    currency_code = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidate_resume_profiles", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_candidate_resume_profiles_candidate_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "candidate_profiles",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "opportunity_participants",
                columns: table => new
                {
                    opportunity_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    joined_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_opportunity_participants", x => new { x.opportunity_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_opportunity_participants_opportunities_opportunity_id",
                        column: x => x.opportunity_id,
                        principalTable: "opportunities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_opportunity_participants_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "opportunity_tags",
                columns: table => new
                {
                    opportunity_id = table.Column<long>(type: "bigint", nullable: false),
                    tag_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_opportunity_tags", x => new { x.opportunity_id, x.tag_id });
                    table.ForeignKey(
                        name: "FK_opportunity_tags_opportunities_opportunity_id",
                        column: x => x.opportunity_id,
                        principalTable: "opportunities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_opportunity_tags_tags_tag_id",
                        column: x => x.tag_id,
                        principalTable: "tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "applications",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    company_id = table.Column<long>(type: "bigint", nullable: false),
                    candidate_user_id = table.Column<long>(type: "bigint", nullable: false),
                    vacancy_id = table.Column<long>(type: "bigint", nullable: false),
                    initiator_role = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_applications", x => x.id);
                    table.ForeignKey(
                        name: "FK_applications_companies_company_id",
                        column: x => x.company_id,
                        principalTable: "companies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_applications_users_candidate_user_id",
                        column: x => x.candidate_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_applications_vacancies_vacancy_id",
                        column: x => x.vacancy_id,
                        principalTable: "vacancies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "vacancy_tags",
                columns: table => new
                {
                    vacancy_id = table.Column<long>(type: "bigint", nullable: false),
                    tag_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vacancy_tags", x => new { x.vacancy_id, x.tag_id });
                    table.ForeignKey(
                        name: "FK_vacancy_tags_tags_tag_id",
                        column: x => x.tag_id,
                        principalTable: "tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_vacancy_tags_vacancies_vacancy_id",
                        column: x => x.vacancy_id,
                        principalTable: "vacancies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_resume_education",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    university = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    faculty = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    specialty = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    course = table.Column<int>(type: "integer", nullable: true),
                    graduation_year = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidate_resume_education", x => x.id);
                    table.ForeignKey(
                        name: "FK_candidate_resume_education_candidate_resume_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "candidate_resume_profiles",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_resume_links",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    label = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidate_resume_links", x => x.id);
                    table.ForeignKey(
                        name: "FK_candidate_resume_links_candidate_resume_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "candidate_resume_profiles",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_resume_projects",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    role = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    description = table.Column<string>(type: "text", nullable: true),
                    start_date = table.Column<DateOnly>(type: "date", nullable: true),
                    end_date = table.Column<DateOnly>(type: "date", nullable: true),
                    repo_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    demo_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidate_resume_projects", x => x.id);
                    table.ForeignKey(
                        name: "FK_candidate_resume_projects_candidate_resume_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "candidate_resume_profiles",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_resume_skills",
                columns: table => new
                {
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    tag_id = table.Column<long>(type: "bigint", nullable: false),
                    level = table.Column<int>(type: "integer", nullable: true),
                    years_experience = table.Column<decimal>(type: "numeric(5,2)", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidate_resume_skills", x => new { x.user_id, x.tag_id });
                    table.ForeignKey(
                        name: "FK_candidate_resume_skills_candidate_resume_profiles_user_id",
                        column: x => x.user_id,
                        principalTable: "candidate_resume_profiles",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_candidate_resume_skills_tags_tag_id",
                        column: x => x.tag_id,
                        principalTable: "tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "chats",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    type = table.Column<int>(type: "integer", nullable: false),
                    application_id = table.Column<long>(type: "bigint", nullable: true),
                    opportunity_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chats", x => x.id);
                    table.ForeignKey(
                        name: "FK_chats_applications_application_id",
                        column: x => x.application_id,
                        principalTable: "applications",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_chats_opportunities_opportunity_id",
                        column: x => x.opportunity_id,
                        principalTable: "opportunities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "chat_messages",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    chat_id = table.Column<long>(type: "bigint", nullable: false),
                    sender_user_id = table.Column<long>(type: "bigint", nullable: false),
                    text = table.Column<string>(type: "text", nullable: false),
                    is_system = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chat_messages", x => x.id);
                    table.ForeignKey(
                        name: "FK_chat_messages_chats_chat_id",
                        column: x => x.chat_id,
                        principalTable: "chats",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_chat_messages_users_sender_user_id",
                        column: x => x.sender_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "chat_participants",
                columns: table => new
                {
                    chat_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chat_participants", x => new { x.chat_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_chat_participants_chats_chat_id",
                        column: x => x.chat_id,
                        principalTable: "chats",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_chat_participants_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "chat_message_reads",
                columns: table => new
                {
                    message_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    read_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chat_message_reads", x => new { x.message_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_chat_message_reads_chat_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "chat_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_chat_message_reads_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_applications_candidate_user_id",
                table: "applications",
                column: "candidate_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_applications_company_id",
                table: "applications",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "IX_applications_vacancy_id",
                table: "applications",
                column: "vacancy_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_education_user_id",
                table: "candidate_resume_education",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_links_user_id",
                table: "candidate_resume_links",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_projects_user_id",
                table: "candidate_resume_projects",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_skills_tag_id",
                table: "candidate_resume_skills",
                column: "tag_id");

            migrationBuilder.CreateIndex(
                name: "IX_chat_message_reads_user_id",
                table: "chat_message_reads",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_chat_messages_chat_id_created_at",
                table: "chat_messages",
                columns: new[] { "chat_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_chat_messages_sender_user_id",
                table: "chat_messages",
                column: "sender_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_chat_participants_user_id",
                table: "chat_participants",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_chats_application_id",
                table: "chats",
                column: "application_id",
                unique: true,
                filter: "application_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_chats_opportunity_id",
                table: "chats",
                column: "opportunity_id",
                unique: true,
                filter: "opportunity_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_cities_country_code_region_name_city_name",
                table: "cities",
                columns: new[] { "country_code", "region_name", "city_name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_companies_base_city_id",
                table: "companies",
                column: "base_city_id");

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

            migrationBuilder.CreateIndex(
                name: "IX_company_invites_company_id",
                table: "company_invites",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "IX_company_invites_invited_by_user_id",
                table: "company_invites",
                column: "invited_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_company_invites_token",
                table: "company_invites",
                column: "token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_company_links_company_id",
                table: "company_links",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "IX_company_members_company_id_user_id",
                table: "company_members",
                columns: new[] { "company_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_company_members_user_id",
                table: "company_members",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_contact_requests_from_user_id_to_user_id",
                table: "contact_requests",
                columns: new[] { "from_user_id", "to_user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_contact_requests_to_user_id",
                table: "contact_requests",
                column: "to_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_locations_city_id",
                table: "locations",
                column: "city_id");

            migrationBuilder.CreateIndex(
                name: "IX_opportunities_city_id",
                table: "opportunities",
                column: "city_id");

            migrationBuilder.CreateIndex(
                name: "IX_opportunities_company_id",
                table: "opportunities",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "IX_opportunities_location_id",
                table: "opportunities",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "IX_opportunity_participants_user_id",
                table: "opportunity_participants",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_opportunity_tags_tag_id",
                table: "opportunity_tags",
                column: "tag_id");

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_token_hash",
                table: "refresh_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_user_id",
                table: "refresh_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_tag_groups_code",
                table: "tag_groups",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tag_groups_name",
                table: "tag_groups",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tags_group_id_name",
                table: "tags",
                columns: new[] { "group_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tags_slug",
                table: "tags",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_contacts_contact_user_id",
                table: "user_contacts",
                column: "contact_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_username",
                table: "users",
                column: "username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vacancies_city_id",
                table: "vacancies",
                column: "city_id");

            migrationBuilder.CreateIndex(
                name: "IX_vacancies_company_id",
                table: "vacancies",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "IX_vacancies_location_id",
                table: "vacancies",
                column: "location_id");

            migrationBuilder.CreateIndex(
                name: "IX_vacancy_tags_tag_id",
                table: "vacancy_tags",
                column: "tag_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "candidate_privacy_settings");

            migrationBuilder.DropTable(
                name: "candidate_resume_education");

            migrationBuilder.DropTable(
                name: "candidate_resume_links");

            migrationBuilder.DropTable(
                name: "candidate_resume_projects");

            migrationBuilder.DropTable(
                name: "candidate_resume_skills");

            migrationBuilder.DropTable(
                name: "chat_message_reads");

            migrationBuilder.DropTable(
                name: "chat_participants");

            migrationBuilder.DropTable(
                name: "company_chat_settings");

            migrationBuilder.DropTable(
                name: "company_invites");

            migrationBuilder.DropTable(
                name: "company_links");

            migrationBuilder.DropTable(
                name: "company_members");

            migrationBuilder.DropTable(
                name: "contact_requests");

            migrationBuilder.DropTable(
                name: "opportunity_participants");

            migrationBuilder.DropTable(
                name: "opportunity_tags");

            migrationBuilder.DropTable(
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "user_contacts");

            migrationBuilder.DropTable(
                name: "user_roles");

            migrationBuilder.DropTable(
                name: "vacancy_tags");

            migrationBuilder.DropTable(
                name: "candidate_resume_profiles");

            migrationBuilder.DropTable(
                name: "chat_messages");

            migrationBuilder.DropTable(
                name: "tags");

            migrationBuilder.DropTable(
                name: "candidate_profiles");

            migrationBuilder.DropTable(
                name: "chats");

            migrationBuilder.DropTable(
                name: "tag_groups");

            migrationBuilder.DropTable(
                name: "applications");

            migrationBuilder.DropTable(
                name: "opportunities");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "vacancies");

            migrationBuilder.DropTable(
                name: "companies");

            migrationBuilder.DropTable(
                name: "locations");

            migrationBuilder.DropTable(
                name: "cities");
        }
    }
}
