using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class AddUserOpportunityFavorites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "user_opportunity_favorites",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    vacancy_id = table.Column<long>(type: "bigint", nullable: true),
                    opportunity_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_opportunity_favorites", x => x.id);
                    table.CheckConstraint("ck_user_opportunity_favorites_ref", "(vacancy_id IS NOT NULL AND opportunity_id IS NULL)\n                  OR (vacancy_id IS NULL AND opportunity_id IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_user_opportunity_favorites_opportunities_opportunity_id",
                        column: x => x.opportunity_id,
                        principalTable: "opportunities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_opportunity_favorites_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_opportunity_favorites_vacancies_vacancy_id",
                        column: x => x.vacancy_id,
                        principalTable: "vacancies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_user_opportunity_favorites_opportunity_id",
                table: "user_opportunity_favorites",
                column: "opportunity_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_opportunity_favorites_user_id_opportunity_id",
                table: "user_opportunity_favorites",
                columns: new[] { "user_id", "opportunity_id" },
                unique: true,
                filter: "opportunity_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_user_opportunity_favorites_user_id_vacancy_id",
                table: "user_opportunity_favorites",
                columns: new[] { "user_id", "vacancy_id" },
                unique: true,
                filter: "vacancy_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_user_opportunity_favorites_vacancy_id",
                table: "user_opportunity_favorites",
                column: "vacancy_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_opportunity_favorites");
        }
    }
}
