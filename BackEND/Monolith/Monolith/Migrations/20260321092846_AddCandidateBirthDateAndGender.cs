using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateBirthDateAndGender : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "birth_date",
                table: "candidate_profiles",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "gender",
                table: "candidate_profiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "birth_date",
                table: "candidate_profiles");

            migrationBuilder.DropColumn(
                name: "gender",
                table: "candidate_profiles");
        }
    }
}
