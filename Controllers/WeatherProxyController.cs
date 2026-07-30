using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace SeaWay.Controllers;

[Route("api/weather-proxy")]
[ApiController]
public class WeatherProxyController(IHttpClientFactory httpClientFactory, IMemoryCache memoryCache, ILogger<WeatherProxyController> logger) : ControllerBase
{
    private const string BaseUrl = "https://api.open-meteo.com/v1/forecast";

    [HttpGet]
    public async Task<IActionResult> GetForecast([FromQuery] string latitude, [FromQuery] string longitude, [FromQuery] string current, [FromQuery] string? timezone = "auto")
    {
        if (string.IsNullOrWhiteSpace(latitude) || string.IsNullOrWhiteSpace(longitude) || string.IsNullOrWhiteSpace(current))
        {
            return BadRequest("Missing required parameters.");
        }

        // Create a unique cache key based on the parameters
        var cacheKey = $"WeatherProxy_{latitude}_{longitude}_{current}_{timezone}";

        if (memoryCache.TryGetValue(cacheKey, out string? cachedResponse))
        {
            return Content(cachedResponse!, "application/json");
        }

        try
        {
            var client = httpClientFactory.CreateClient();
            var queryParams = $"?latitude={latitude}&longitude={longitude}&current={current}&timezone={timezone ?? "auto"}";
            var url = $"{BaseUrl}{queryParams}";

            using var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            
            // Validate it's actually valid JSON before caching
            using (JsonDocument.Parse(content))
            {
                // Cache for 15 minutes
                memoryCache.Set(cacheKey, content, TimeSpan.FromMinutes(15));
                return Content(content, "application/json");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch weather from Open-Meteo");
            return StatusCode(500, "Failed to fetch weather data.");
        }
    }

    [HttpGet("marine")]
    public async Task<IActionResult> GetMarine([FromQuery] string latitude, [FromQuery] string longitude, [FromQuery] string current, [FromQuery] string? timezone = "auto")
    {
        if (string.IsNullOrWhiteSpace(latitude) || string.IsNullOrWhiteSpace(longitude) || string.IsNullOrWhiteSpace(current))
        {
            return BadRequest("Missing required parameters.");
        }

        var cacheKey = $"MarineProxy_{latitude}_{longitude}_{current}_{timezone}";
        if (memoryCache.TryGetValue(cacheKey, out string? cachedResponse))
        {
            return Content(cachedResponse!, "application/json");
        }

        try
        {
            var client = httpClientFactory.CreateClient();
            var url = $"https://marine-api.open-meteo.com/v1/marine?latitude={latitude}&longitude={longitude}&current={current}&timezone={timezone ?? "auto"}";

            using var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            using (JsonDocument.Parse(content))
            {
                memoryCache.Set(cacheKey, content, TimeSpan.FromMinutes(15));
                return Content(content, "application/json");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch marine data from Open-Meteo");
            return StatusCode(500, "Failed to fetch marine data.");
        }
    }
}
