using Monolith.Entities;

namespace Monolith.Models.Opportunities;

/// <summary>
/// Параметры фильтрации и пагинации списка возможностей.
/// </summary>
public class OpportunityListQuery
{
    /// <summary>
    /// Номер страницы, начиная с 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Размер страницы.
    /// </summary>
    public int PageSize { get; set; } = 20;

    /// <summary>
    /// Полнотекстовый поиск по названию/описанию/компании.
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// ID города из GET /catalog/cities.
    /// </summary>
    public long? CityId { get; set; }

    /// <summary>
    /// ID компании из GET /companies.
    /// </summary>
    public long? CompanyId { get; set; }

    /// <summary>
    /// Фильтр по типам возможностей.
    /// </summary>
    public OpportunityType[]? Types { get; set; }

    /// <summary>
    /// Фильтр по подтипам карьерных мероприятий (применяется только к CareerEvent).
    /// </summary>
    public CareerEventKind[]? EventKinds { get; set; }

    /// <summary>
    /// Фильтр по формату работы.
    /// </summary>
    public WorkFormat[]? Formats { get; set; }

    /// <summary>
    /// ID тегов из GET /catalog/tags.
    /// </summary>
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

    /// <summary>
    /// ID города из GET /catalog/cities.
    /// </summary>
    public long? CityId { get; set; }

    /// <summary>
    /// Фильтр по типам возможностей.
    /// </summary>
    public OpportunityType[]? Types { get; set; }

    /// <summary>
    /// Фильтр по подтипам карьерных мероприятий (применяется только к CareerEvent).
    /// </summary>
    public CareerEventKind[]? EventKinds { get; set; }

    /// <summary>
    /// Фильтр по формату работы.
    /// </summary>
    public WorkFormat[]? Formats { get; set; }

    /// <summary>
    /// ID тегов из GET /catalog/tags.
    /// </summary>
    public long[]? TagIds { get; set; }
    public decimal? SalaryFrom { get; set; }
    public decimal? SalaryTo { get; set; }
    public bool? VerifiedOnly { get; set; }
    public string? Search { get; set; }
}
