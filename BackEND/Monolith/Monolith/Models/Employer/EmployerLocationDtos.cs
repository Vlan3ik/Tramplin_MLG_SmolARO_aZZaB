namespace Monolith.Models.Employer;

public record EmployerAddressCitySuggestionDto(long CityId, string CityName, string RegionName, string CountryCode);
public record EmployerAddressStreetSuggestionDto(string StreetName);
public record EmployerAddressHouseSuggestionDto(string HouseNumber);
