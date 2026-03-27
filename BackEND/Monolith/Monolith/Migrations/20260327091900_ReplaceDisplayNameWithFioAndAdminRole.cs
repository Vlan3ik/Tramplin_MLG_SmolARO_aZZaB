using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceDisplayNameWithFioAndAdminRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "first_name",
                table: "candidate_profiles");

            migrationBuilder.DropColumn(
                name: "last_name",
                table: "candidate_profiles");

            migrationBuilder.DropColumn(
                name: "middle_name",
                table: "candidate_profiles");

            migrationBuilder.AddColumn<string>(
                name: "fio",
                table: "candidate_profiles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "fio",
                table: "candidate_profiles");

            migrationBuilder.AddColumn<string>(
                name: "first_name",
                table: "candidate_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "last_name",
                table: "candidate_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "middle_name",
                table: "candidate_profiles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }
    }
}
