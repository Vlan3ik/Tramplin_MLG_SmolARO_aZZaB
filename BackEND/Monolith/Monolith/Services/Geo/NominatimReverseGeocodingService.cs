using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Monolith.Services.Geo;

public class NominatimReverseGeocodingService(
    HttpClient httpClient,
    IMemoryCache memoryCache,
    IOptions<NominatimOptions> optionsAccessor) : IReverseGeocodingService
{
    private readonly NominatimOptions options = optionsAccessor.Value;

    public async Task<ReverseGeocodingAddress?> ReverseAsync(decimal latitude, decimal longitude, CancellationToken cancellationToken)
    {
        var roundedLat = Math.Round(latitude, options.CoordinateRoundingDigits);
        var roundedLng = Math.Round(longitude, options.CoordinateRoundingDigits);
        var cacheKey = $"nominatim:reverse:{roundedLat}:{roundedLng}";
        if (memoryCache.TryGetValue<ReverseGeocodingAddress?>(cacheKey, out var cached))
        {
            return cached;
        }

        ReverseGeocodingAddress? result;
        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"/reverse?format=jsonv2&addressdetails=1&lat={latitude.ToString(CultureInfo.InvariantCulture)}&lon={longitude.ToString(CultureInfo.InvariantCulture)}&zoom=18");
            request.Headers.TryAddWithoutValidation("User-Agent", options.UserAgent);

            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                result = null;
            }
            else
            {
                var dto = await response.Content.ReadFromJsonAsync<NominatimReverseResponse>(cancellationToken: cancellationToken);
                result = Map(dto);
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            result = null;
        }
        catch (HttpRequestException)
        {
            result = null;
        }

        memoryCache.Set(cacheKey, result, TimeSpan.FromSeconds(Math.Max(options.CacheSeconds, 15)));
        return result;
    }

    private static ReverseGeocodingAddress? Map(NominatimReverseResponse? response)
    {
        if (response?.Address is null)
        {
            return null;
        }

        var cityName = FirstNonEmpty(
            response.Address.City,
            response.Address.Town,
            response.Address.Village,
            response.Address.Hamlet,
            response.Address.Municipality,
            response.Address.County);

        var street = FirstNonEmpty(response.Address.Road, response.Address.Pedestrian, response.Address.Footway);
        var house = FirstNonEmpty(response.Address.HouseNumber);
        var region = FirstNonEmpty(response.Address.State, response.Address.Region);
        var countryCode = string.IsNullOrWhiteSpace(response.Address.CountryCode)
            ? null
            : response.Address.CountryCode.Trim().ToUpperInvariant();

        return new ReverseGeocodingAddress(
            countryCode,
            region,
            cityName,
            street,
            house,
            TryParseDecimal(response.Lat),
            TryParseDecimal(response.Lon));
    }

    private static decimal? TryParseDecimal(string? value)
        => decimal.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;

    private static string? FirstNonEmpty(params string?[] values)
        => values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim();

    private sealed class NominatimReverseResponse
    {
        [JsonPropertyName("lat")]
        public string? Lat { get; set; }

        [JsonPropertyName("lon")]
        public string? Lon { get; set; }

        [JsonPropertyName("address")]
        public NominatimAddress? Address { get; set; }
    }

    private sealed class NominatimAddress
    {
        [JsonPropertyName("country_code")]
        public string? CountryCode { get; set; }

        [JsonPropertyName("state")]
        public string? State { get; set; }

        [JsonPropertyName("region")]
        public string? Region { get; set; }

        [JsonPropertyName("city")]
        public string? City { get; set; }

        [JsonPropertyName("town")]
        public string? Town { get; set; }

        [JsonPropertyName("village")]
        public string? Village { get; set; }

        [JsonPropertyName("hamlet")]
        public string? Hamlet { get; set; }

        [JsonPropertyName("municipality")]
        public string? Municipality { get; set; }

        [JsonPropertyName("county")]
        public string? County { get; set; }

        [JsonPropertyName("road")]
        public string? Road { get; set; }

        [JsonPropertyName("pedestrian")]
        public string? Pedestrian { get; set; }

        [JsonPropertyName("footway")]
        public string? Footway { get; set; }

        [JsonPropertyName("house_number")]
        public string? HouseNumber { get; set; }
    }
}
