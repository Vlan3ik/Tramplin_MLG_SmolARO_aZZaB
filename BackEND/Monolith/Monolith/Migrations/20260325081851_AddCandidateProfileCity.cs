using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateProfileCity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "city_id",
                table: "candidate_profiles",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_candidate_profiles_city_id",
                table: "candidate_profiles",
                column: "city_id");

            migrationBuilder.AddForeignKey(
                name: "FK_candidate_profiles_cities_city_id",
                table: "candidate_profiles",
                column: "city_id",
                principalTable: "cities",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_candidate_profiles_cities_city_id",
                table: "candidate_profiles");

            migrationBuilder.DropIndex(
                name: "IX_candidate_profiles_city_id",
                table: "candidate_profiles");

            migrationBuilder.DropColumn(
                name: "city_id",
                table: "candidate_profiles");
        }
    }
}
