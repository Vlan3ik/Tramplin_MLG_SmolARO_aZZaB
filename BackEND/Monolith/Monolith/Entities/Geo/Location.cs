using NetTopologySuite.Geometries;

namespace Monolith.Entities;

public class Location
{
    public long Id { get; set; }
    public long CityId { get; set; }
    public Point GeoPoint { get; set; } = null!;
    public string? StreetName { get; set; }
    public string? HouseNumber { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public City City { get; set; } = null!;
}
