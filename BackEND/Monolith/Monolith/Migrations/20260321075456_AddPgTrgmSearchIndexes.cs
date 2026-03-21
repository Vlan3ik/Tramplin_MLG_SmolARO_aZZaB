using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Monolith.Migrations
{
    /// <inheritdoc />
    public partial class AddPgTrgmSearchIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:citext", ",,")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:postgis", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:citext", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_vacancies_title_trgm ON vacancies USING gin (lower(title) gin_trgm_ops);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_vacancies_short_description_trgm ON vacancies USING gin (lower(short_description) gin_trgm_ops);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_vacancies_full_description_trgm ON vacancies USING gin (lower(full_description) gin_trgm_ops);");

            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_opportunities_title_trgm ON opportunities USING gin (lower(title) gin_trgm_ops);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_opportunities_short_description_trgm ON opportunities USING gin (lower(short_description) gin_trgm_ops);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_opportunities_full_description_trgm ON opportunities USING gin (lower(full_description) gin_trgm_ops);");

            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_companies_legal_name_trgm ON companies USING gin (lower(legal_name) gin_trgm_ops);");
            migrationBuilder.Sql("CREATE INDEX IF NOT EXISTS ix_companies_brand_name_trgm ON companies USING gin (lower(brand_name) gin_trgm_ops);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_companies_brand_name_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_companies_legal_name_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_opportunities_full_description_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_opportunities_short_description_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_opportunities_title_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_vacancies_full_description_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_vacancies_short_description_trgm;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_vacancies_title_trgm;");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:citext", ",,")
                .Annotation("Npgsql:PostgresExtension:postgis", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:citext", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:postgis", ",,");
        }
    }
}
