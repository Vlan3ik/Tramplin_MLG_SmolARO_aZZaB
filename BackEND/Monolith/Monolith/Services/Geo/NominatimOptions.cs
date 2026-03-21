namespace Monolith.Services.Geo;

public class NominatimOptions
{
    public const string SectionName = "Nominatim";

    public string BaseUrl { get; set; } = "https://nominatim.openstreetmap.org";
    public string UserAgent { get; set; } = "TramplinMonolith/1.0";
    public int TimeoutSeconds { get; set; } = 3;
    public int CacheSeconds { get; set; } = 90;
    public int CoordinateRoundingDigits { get; set; } = 4;
}
