using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivacySocialProofFlagsAndResumeLinksVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_user_opportunity_favorites_ref",
                table: "user_opportunity_favorites");

            migrationBuilder.AddColumn<bool>(
                name: "show_in_friends_applications",
                table: "candidate_privacy_settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "show_in_friends_favorites",
                table: "candidate_privacy_settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_user_opportunity_favorites_ref",
                table: "user_opportunity_favorites",
                sql: "(vacancy_id IS NOT NULL AND opportunity_id IS NULL)\r\n                  OR (vacancy_id IS NULL AND opportunity_id IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_user_opportunity_favorites_ref",
                table: "user_opportunity_favorites");

            migrationBuilder.DropColumn(
                name: "show_in_friends_applications",
                table: "candidate_privacy_settings");

            migrationBuilder.DropColumn(
                name: "show_in_friends_favorites",
                table: "candidate_privacy_settings");

            migrationBuilder.AddCheckConstraint(
                name: "ck_user_opportunity_favorites_ref",
                table: "user_opportunity_favorites",
                sql: "(vacancy_id IS NOT NULL AND opportunity_id IS NULL)\n                  OR (vacancy_id IS NULL AND opportunity_id IS NOT NULL)");
        }
    }
}
