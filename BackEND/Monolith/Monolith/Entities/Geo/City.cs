namespace Monolith.Entities;

public class City
{
    public long Id { get; set; }
    public string CountryCode { get; set; } = "RU";
    public string RegionName { get; set; } = string.Empty;
    public string CityName { get; set; } = string.Empty;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public List<Location> Locations { get; set; } = new();
}
