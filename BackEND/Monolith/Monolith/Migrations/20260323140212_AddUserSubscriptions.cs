using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class AddUserSubscriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_candidate_resume_project_collaborations_type_ref",
                table: "candidate_resume_project_collaborations");

            migrationBuilder.CreateTable(
                name: "user_subscriptions",
                columns: table => new
                {
                    follower_user_id = table.Column<long>(type: "bigint", nullable: false),
                    following_user_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_subscriptions", x => new { x.follower_user_id, x.following_user_id });
                    table.ForeignKey(
                        name: "FK_user_subscriptions_users_follower_user_id",
                        column: x => x.follower_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_subscriptions_users_following_user_id",
                        column: x => x.following_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_candidate_resume_project_collaborations_type_ref",
                table: "candidate_resume_project_collaborations",
                sql: "(type = 1 AND user_id IS NOT NULL AND vacancy_id IS NULL AND opportunity_id IS NULL)\r\n                  OR (type = 2 AND user_id IS NULL AND vacancy_id IS NOT NULL AND opportunity_id IS NULL)\r\n                  OR (type = 3 AND user_id IS NULL AND vacancy_id IS NULL AND opportunity_id IS NOT NULL)\r\n                  OR (type = 4 AND user_id IS NULL AND vacancy_id IS NULL AND opportunity_id IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_user_subscriptions_following_user_id",
                table: "user_subscriptions",
                column: "following_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_subscriptions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_candidate_resume_project_collaborations_type_ref",
                table: "candidate_resume_project_collaborations");

            migrationBuilder.AddCheckConstraint(
                name: "ck_candidate_resume_project_collaborations_type_ref",
                table: "candidate_resume_project_collaborations",
                sql: "(type = 1 AND user_id IS NOT NULL AND vacancy_id IS NULL AND opportunity_id IS NULL)\n                  OR (type = 2 AND user_id IS NULL AND vacancy_id IS NOT NULL AND opportunity_id IS NULL)\n                  OR (type = 3 AND user_id IS NULL AND vacancy_id IS NULL AND opportunity_id IS NOT NULL)\n                  OR (type = 4 AND user_id IS NULL AND vacancy_id IS NULL AND opportunity_id IS NULL)");
        }
    }
}
