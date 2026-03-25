using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class AddOpportunityAttachmentCard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "opportunity_id",
                table: "chat_message_attachments",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_chat_message_attachments_opportunity_id",
                table: "chat_message_attachments",
                column: "opportunity_id");

            migrationBuilder.AddForeignKey(
                name: "FK_chat_message_attachments_opportunities_opportunity_id",
                table: "chat_message_attachments",
                column: "opportunity_id",
                principalTable: "opportunities",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_chat_message_attachments_opportunities_opportunity_id",
                table: "chat_message_attachments");

            migrationBuilder.DropIndex(
                name: "IX_chat_message_attachments_opportunity_id",
                table: "chat_message_attachments");

            migrationBuilder.DropColumn(
                name: "opportunity_id",
                table: "chat_message_attachments");
        }
    }
}
