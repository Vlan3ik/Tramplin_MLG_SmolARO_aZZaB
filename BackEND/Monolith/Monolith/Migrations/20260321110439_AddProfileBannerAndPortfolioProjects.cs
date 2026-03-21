using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileBannerAndPortfolioProjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "profile_banner_url",
                table: "users",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "candidate_resume_project_collaborations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    project_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: true),
                    vacancy_id = table.Column<long>(type: "bigint", nullable: true),
                    opportunity_id = table.Column<long>(type: "bigint", nullable: true),
                    label = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidate_resume_project_collaborations", x => x.id);
                    table.CheckConstraint("ck_candidate_resume_project_collaborations_type_ref", "(type = 1 AND user_id IS NOT NULL AND vacancy_id IS NULL AND opportunity_id IS NULL)\n                  OR (type = 2 AND user_id IS NULL AND vacancy_id IS NOT NULL AND opportunity_id IS NULL)\n                  OR (type = 3 AND user_id IS NULL AND vacancy_id IS NULL AND opportunity_id IS NOT NULL)\n                  OR (type = 4 AND user_id IS NULL AND vacancy_id IS NULL AND opportunity_id IS NULL)");
                    table.ForeignKey(
                        name: "FK_candidate_resume_project_collaborations_candidate_resume_pr~",
                        column: x => x.project_id,
                        principalTable: "candidate_resume_projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_candidate_resume_project_collaborations_opportunities_oppor~",
                        column: x => x.opportunity_id,
                        principalTable: "opportunities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_candidate_resume_project_collaborations_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_candidate_resume_project_collaborations_vacancies_vacancy_id",
                        column: x => x.vacancy_id,
                        principalTable: "vacancies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "candidate_resume_project_participants",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    project_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    role = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidate_resume_project_participants", x => x.id);
                    table.ForeignKey(
                        name: "FK_candidate_resume_project_participants_candidate_resume_proj~",
                        column: x => x.project_id,
                        principalTable: "candidate_resume_projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_candidate_resume_project_participants_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "candidate_resume_project_photos",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    project_id = table.Column<long>(type: "bigint", nullable: false),
                    url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_main = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_candidate_resume_project_photos", x => x.id);
                    table.ForeignKey(
                        name: "FK_candidate_resume_project_photos_candidate_resume_projects_p~",
                        column: x => x.project_id,
                        principalTable: "candidate_resume_projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_project_collaborations_opportunity_id",
                table: "candidate_resume_project_collaborations",
                column: "opportunity_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_project_collaborations_project_id",
                table: "candidate_resume_project_collaborations",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_project_collaborations_type",
                table: "candidate_resume_project_collaborations",
                column: "type");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_project_collaborations_user_id",
                table: "candidate_resume_project_collaborations",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_project_collaborations_vacancy_id",
                table: "candidate_resume_project_collaborations",
                column: "vacancy_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_project_participants_project_id",
                table: "candidate_resume_project_participants",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_project_participants_project_id_user_id",
                table: "candidate_resume_project_participants",
                columns: new[] { "project_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_project_participants_user_id",
                table: "candidate_resume_project_participants",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_resume_project_photos_project_id",
                table: "candidate_resume_project_photos",
                column: "project_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "candidate_resume_project_collaborations");

            migrationBuilder.DropTable(
                name: "candidate_resume_project_participants");

            migrationBuilder.DropTable(
                name: "candidate_resume_project_photos");

            migrationBuilder.DropColumn(
                name: "profile_banner_url",
                table: "users");
        }
    }
}
