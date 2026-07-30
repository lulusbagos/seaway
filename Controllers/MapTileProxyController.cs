using Microsoft.AspNetCore.Mvc;

namespace SeaWay.Controllers;

[Route("api/tiles")]
[ApiController]
public class MapTileProxyController(IHttpClientFactory httpClientFactory, IWebHostEnvironment env, ILogger<MapTileProxyController> logger) : ControllerBase
{
    private static readonly Dictionary<string, string> TileProviders = new(StringComparer.OrdinalIgnoreCase)
    {
        { "standard", "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png" },
        { "dark", "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" },
        { "satellite", "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" },
        { "seamark", "https://t1.openseamap.org/seamark/{z}/{x}/{y}.png" }
    };

    [HttpGet("{layer}/{z:int}/{x:int}/{y}")]
    public async Task<IActionResult> GetTile(string layer, int z, int x, string y)
    {
        var cleanY = y.Replace(".png", "").Replace(".jpg", "").Replace(".jpeg", "");

        if (!TileProviders.TryGetValue(layer, out var urlTemplate))
        {
            return NotFound("Layer not supported");
        }

        var targetUrl = urlTemplate
            .Replace("{z}", z.ToString())
            .Replace("{x}", x.ToString())
            .Replace("{y}", cleanY);

        var cacheDir = Path.Combine(env.WebRootPath, "cache", "tiles", layer, z.ToString(), x.ToString());
        var cacheFilePath = Path.Combine(cacheDir, $"{cleanY}.png");

        if (System.IO.File.Exists(cacheFilePath))
        {
            var mimeType = "image/png";
            if (layer == "satellite") mimeType = "image/jpeg";
            return PhysicalFile(cacheFilePath, mimeType);
        }

        try
        {
            var client = httpClientFactory.CreateClient("TileClient");
            client.DefaultRequestHeaders.Add("User-Agent", "SeaWay-Application/1.0");

            using var response = await client.GetAsync(targetUrl);
            response.EnsureSuccessStatusCode();

            var imageBytes = await response.Content.ReadAsByteArrayAsync();

            Directory.CreateDirectory(cacheDir);
            await System.IO.File.WriteAllBytesAsync(cacheFilePath, imageBytes);

            var mimeType = response.Content.Headers.ContentType?.MediaType ?? "image/png";
            return File(imageBytes, mimeType);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to proxy map tile for layer {Layer} z:{Z} x:{X} y:{Y}", layer, z, x, cleanY);
            // Return empty 1x1 transparent PNG as fallback to prevent console errors
            return File(Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="), "image/png");
        }
    }
}
