using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class AddChatMessageAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "chat_message_attachments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    message_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    mime_type = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    size_bytes = table.Column<long>(type: "bigint", nullable: true),
                    vacancy_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chat_message_attachments", x => x.id);
                    table.ForeignKey(
                        name: "FK_chat_message_attachments_chat_messages_message_id",
                        column: x => x.message_id,
                        principalTable: "chat_messages",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_chat_message_attachments_vacancies_vacancy_id",
                        column: x => x.vacancy_id,
                        principalTable: "vacancies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_chat_message_attachments_message_id",
                table: "chat_message_attachments",
                column: "message_id");

            migrationBuilder.CreateIndex(
                name: "IX_chat_message_attachments_vacancy_id",
                table: "chat_message_attachments",
                column: "vacancy_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "chat_message_attachments");
        }
    }
}
