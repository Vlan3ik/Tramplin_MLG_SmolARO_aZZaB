using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Monolith.Contexts;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        var connectionString = "Host=localhost;Port=5432;Database=tramplin_db;Username=tramplin;Password=tramplin";
        optionsBuilder.UseNpgsql(connectionString, npgsql => npgsql.UseNetTopologySuite());
        return new AppDbContext(optionsBuilder.Options);
    }
}
