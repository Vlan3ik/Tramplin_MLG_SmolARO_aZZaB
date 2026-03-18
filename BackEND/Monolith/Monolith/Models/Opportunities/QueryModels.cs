using Monolith.Entities;

namespace Monolith.Models.Opportunities;

public class OpportunityListQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public long? CityId { get; set; }
    public long? CompanyId { get; set; }
    public OpportunityType[]? Types { get; set; }
    public WorkFormat[]? Formats { get; set; }
    public long[]? TagIds { get; set; }
    public decimal? SalaryFrom { get; set; }
    public decimal? SalaryTo { get; set; }
    public bool? VerifiedOnly { get; set; }
}

public class CompanyListQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
    public long? CityId { get; set; }
    public string? Industry { get; set; }
    public bool? VerifiedOnly { get; set; }
}

public class MapQuery
{
    public decimal? MinLat { get; set; }
    public decimal? MaxLat { get; set; }
    public decimal? MinLng { get; set; }
    public decimal? MaxLng { get; set; }
    public long? CityId { get; set; }
    public OpportunityType[]? Types { get; set; }
    public WorkFormat[]? Formats { get; set; }
    public long[]? TagIds { get; set; }
    public decimal? SalaryFrom { get; set; }
    public decimal? SalaryTo { get; set; }
    public bool? VerifiedOnly { get; set; }
    public string? Search { get; set; }
}
