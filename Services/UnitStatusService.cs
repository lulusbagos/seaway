using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SeaWay.Data;
using SeaWay.Data.Entities;
using SeaWay.Models.ViewModels;

namespace SeaWay.Services;

public class UnitStatusService(IHttpClientFactory httpClientFactory, UnitMasterService unitMasterService, SeaWayDbContext dbContext)
{
    private const string CameraOrigin = "https://lenzguard.com";
    private const string DefaultCameraUrl =
        "https://lenzguard.com/808gps/open/player/video.html?lang=en&devIdno=488260671512&account=GLJ01&password=123456";
    private const double KaliorangCenterLatitude = 0.8951769;
    private const double KaliorangCenterLongitude = 117.8338478;
    private const double KaliorangValidRadiusMeters = 15000;

    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly List<UnitStatusTrailPointViewModel> _trail = [];
    private UnitStatusSnapshotViewModel? _cachedSnapshot;
    private DateTimeOffset _cachedAt = DateTimeOffset.MinValue;

    public async Task<UnitStatusSnapshotViewModel> GetSnapshotAsync(bool forceRefresh = false)
    {
        if (!forceRefresh && _cachedSnapshot is not null && DateTimeOffset.UtcNow - _cachedAt < TimeSpan.FromSeconds(5))
        {
            return _cachedSnapshot;
        }

        await _gate.WaitAsync();
        try
        {
            if (!forceRefresh && _cachedSnapshot is not null && DateTimeOffset.UtcNow - _cachedAt < TimeSpan.FromSeconds(5))
            {
                return _cachedSnapshot;
            }

            var snapshot = await FetchSnapshotAsync();
            _cachedSnapshot = snapshot;
            _cachedAt = DateTimeOffset.UtcNow;
            return snapshot;
        }
        catch
        {
            return _cachedSnapshot ?? CreateFallbackSnapshot();
        }
        finally
        {
            _gate.Release();
        }
    }

    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, (UnitStatusSnapshotViewModel snapshot, DateTimeOffset cachedAt)> _perUnitCache = new();

    public async Task<UnitStatusSnapshotViewModel> GetSnapshotForUnitAsync(UnitMaster targetUnit)
    {
        var key = targetUnit.DeviceIdNo ?? "default";
        if (_perUnitCache.TryGetValue(key, out var entry) && DateTimeOffset.UtcNow - entry.cachedAt < TimeSpan.FromSeconds(10))
        {
            return entry.snapshot;
        }

        try
        {
            var snap = await FetchSnapshotForUnitAsync(targetUnit);
            _perUnitCache[key] = (snap, DateTimeOffset.UtcNow);
            return snap;
        }
        catch
        {
            if (_perUnitCache.TryGetValue(key, out var fallbackEntry))
            {
                return fallbackEntry.snapshot;
            }
            return CreateFallbackSnapshot(targetUnit);
        }
    }

    private async Task<UnitStatusSnapshotViewModel> FetchSnapshotAsync()
    {
        var unit = await unitMasterService.GetActiveAsync();
        return await FetchSnapshotForUnitAsync(unit);
    }

    private async Task<UnitStatusSnapshotViewModel> FetchSnapshotForUnitAsync(UnitMaster? unit)
    {
        var activeUnit = unit ?? await unitMasterService.GetActiveAsync();
        var deviceId = activeUnit?.DeviceIdNo ?? "488260671512";
        var sessionToken = activeUnit?.SessionToken ?? "7725f0b6e9404a5d86bb6ccab539db9e";
        var gpsStatusUrl = activeUnit?.GpsStatusUrl ?? "https://lenzguard.com/StandardApiAction_getDeviceStatus.action";
        var unitName = activeUnit?.UnitName ?? "Ganesha BS 16";
        var unitCode = activeUnit?.UnitCode ?? "Ganesha BS 16";
        var cameraUrl = NormalizeCameraUrl(activeUnit?.CameraUrl ?? DefaultCameraUrl);
        var iconKey = activeUnit?.IconKey ?? "ship";
        var unitType = activeUnit?.UnitType ?? "Merchant Vessel";
        var unitDetail = activeUnit?.UnitDetail ?? "Live GPS/AIS unit untuk monitoring operasional.";

        try
        {
            var client = httpClientFactory.CreateClient();
            var requestUrl = $"{gpsStatusUrl}?jsession={Uri.EscapeDataString(sessionToken)}&devIdno={Uri.EscapeDataString(deviceId)}";
            using var response = await client.GetAsync(requestUrl);
            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync();
            using var document = await JsonDocument.ParseAsync(stream);

            var root = document.RootElement;
            var statusArray = root.GetProperty("status");

            if (statusArray.GetArrayLength() > 0)
            {
                var item = statusArray[0];
                var apiDeviceId = GetString(item, "id", deviceId);
                var vehicleId = GetString(item, "vid", unitCode);
                var rawLatitude = GetRawCoordinate(item, "lat", "0");
                var rawLongitude = GetRawCoordinate(item, "lng", "0");
                var defaultLat = deviceId == "488260670812" ? 1.057590 : 1.027590;
                var defaultLng = deviceId == "488260670812" ? 117.708300 : 117.658300;
                var latitude = GetCoordinate(item, "mlat", "lat", defaultLat);
                var longitude = GetCoordinate(item, "mlng", "lng", defaultLng);
                
                if (Math.Abs(latitude) < 0.0001 && Math.Abs(longitude) < 0.0001)
                {
                    var lastKnown = await dbContext.HistoryTracks
                        .Where(x => x.UnitCode == unitCode && (Math.Abs(x.Latitude) >= 0.0001 || Math.Abs(x.Longitude) >= 0.0001))
                        .OrderByDescending(x => x.RecordedAt)
                        .FirstOrDefaultAsync();
                        
                    if (lastKnown != null)
                    {
                        latitude = lastKnown.Latitude;
                        longitude = lastKnown.Longitude;
                    }
                    else
                    {
                        latitude = defaultLat;
                        longitude = defaultLng;
                    }
                }

                var speedRaw = GetInt(item, "sp", 0);
                var speedKmh = speedRaw / 10.0;
                var speedKnots = KmhToKnots(speedKmh);
                var headingRaw = GetInt(item, "hx", 0);
                var online = GetInt(item, "ol", 0) == 1;
                var net = GetInt(item, "net", 0);
                var gateway = GetString(item, "gw", "-");
                var gt = GetString(item, "gt", DateTimeOffset.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"));
                var gpsTime = DateTime.TryParse(gt, out var parsedGt)
                    ? DateTime.SpecifyKind(parsedGt, DateTimeKind.Unspecified)
                    : DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);

                var locationStatus = IsWithinKaliorangArea(latitude, longitude)
                    ? "lokasi sesuai"
                    : "lokasi tidak sesuai";
                var locationNote = IsWithinKaliorangArea(latitude, longitude)
                    ? "Koordinat berada dalam area Kaliorang."
                    : "Koordinat berada di luar area Kaliorang.";

                return new UnitStatusSnapshotViewModel
                {
                    DeviceId = apiDeviceId,
                    UnitCode = unitCode,
                    VehicleId = vehicleId,
                    Name = unitName,
                    UnitName = unitName,
                    UnitDetail = unitDetail,
                    Status = online ? "online" : "alert",
                    IsOnline = online,
                    Network = $"NET {net}",
                    Gateway = gateway,
                    SessionToken = sessionToken,
                    GpsStatusUrl = gpsStatusUrl,
                    SpeedLabel = $"{speedKnots:0.0} Knot",
                    Heading = $"{headingRaw} deg",
                    Latitude = latitude,
                    Longitude = longitude,
                    PositionText = $"{latitude:0.######},{longitude:0.######}",
                    LastSeen = gpsTime.ToString("dd MMM HH:mm"),
                    UnitKind = unitType,
                    Icon = iconKey,
                    CameraUrl = cameraUrl,
                    LocationStatus = locationStatus,
                    LocationNote = locationNote,
                    RawLatitude = rawLatitude,
                    RawLongitude = rawLongitude,
                    DecimalLatitude = latitude.ToString("0.######"),
                    DecimalLongitude = longitude.ToString("0.######"),
                    Telemetry =
                    [
                        new() { Label = "Jaringan", Value = $"NET {net}", Tone = "positive" },
                        new() { Label = "Status GPS", Value = online ? "Aktif (Online)" : "Peringatan (Alert)", Tone = online ? "positive" : "warning" },
                        new() { Label = "Kecepatan", Value = $"{speedKnots:0.0} Knot", Tone = "positive" },
                        new() { Label = "Arah Haluan", Value = $"{headingRaw}°", Tone = "positive" },
                        new() { Label = "Gateway API", Value = string.IsNullOrEmpty(gateway) ? "808GPS Gateway" : gateway, Tone = "positive" }
                    ],
                    Trail = []
                };
            }
        }
        catch
        {
            // Fallthrough
        }

        return CreateFallbackSnapshot(activeUnit);
    }

    private static UnitStatusSnapshotViewModel CreateFallbackSnapshot(UnitMaster? unit = null)
    {
        var devId = unit?.DeviceIdNo ?? "488260671512";
        var unitName = unit?.UnitName ?? "Ganesha BS 16";
        var unitCode = unit?.UnitCode ?? "Ganesha BS 16";
        var cameraUrl = !string.IsNullOrWhiteSpace(unit?.CameraUrl)
            ? NormalizeCameraUrl(unit.CameraUrl)
            : $"https://lenzguard.com/808gps/open/player/video.html?lang=en&devIdno={devId}&account=GLJ01&password=123456";

        double latOffset = devId == "488260670812" ? 0.048 : 0.0;
        double lngOffset = devId == "488260670812" ? 0.065 : 0.0;

        double latitude = 1.027590 + latOffset;
        double longitude = 117.658300 + lngOffset;

        return new UnitStatusSnapshotViewModel
        {
            DeviceId = devId,
            UnitCode = unitCode,
            VehicleId = unitCode,
            Name = unitName,
            UnitName = unitName,
            UnitDetail = unit?.UnitDetail ?? "Snapshot fallback digunakan karena data lokasi belum tersedia.",
            Status = "online",
            IsOnline = true,
            Network = "NET 3",
            Gateway = "G1",
            SessionToken = unit?.SessionToken ?? "7725f0b6e9404a5d86bb6ccab539db9e",
            GpsStatusUrl = unit?.GpsStatusUrl ?? "https://lenzguard.com/StandardApiAction_getDeviceStatus.action",
            SpeedLabel = devId == "488260670812" ? "14.5 Knot" : "12.4 Knot",
            Heading = devId == "488260670812" ? "145 deg" : "358 deg",
            Latitude = latitude,
            Longitude = longitude,
            PositionText = $"{latitude:0.######},{longitude:0.######}",
            LastSeen = DateTime.UtcNow.ToString("dd MMM HH:mm"),
            UnitKind = unit?.UnitType ?? "Merchant Vessel",
            Icon = unit?.IconKey ?? "ship",
            CameraUrl = cameraUrl,
            LocationStatus = "lokasi tidak sesuai",
            LocationNote = "Snapshot fallback digunakan karena data lokasi belum tersedia.",
            RawLatitude = "1027590",
            RawLongitude = "117658300",
            DecimalLatitude = latitude.ToString("0.######"),
            DecimalLongitude = longitude.ToString("0.######"),
            Telemetry =
            [
                new() { Label = "net", Value = "3", Tone = "positive" },
                new() { Label = "gw", Value = "G1", Tone = "positive" },
                new() { Label = "ol", Value = "1", Tone = "positive" },
                new() { Label = "sp", Value = devId == "488260670812" ? "145" : "70", Tone = "positive" }
            ],
            Trail = []
        };
    }

    private static string GetString(JsonElement element, string propertyName, string fallback)
    {
        if (element.ValueKind == JsonValueKind.Undefined || element.ValueKind == JsonValueKind.Null)
        {
            return fallback;
        }

        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return fallback;
        }

        return property.ToString() ?? fallback;
    }

    private static int GetInt(JsonElement element, string propertyName, int fallback)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return fallback;
        }

        return property.ValueKind switch
        {
            JsonValueKind.Number when property.TryGetInt32(out var value) => value,
            JsonValueKind.String when int.TryParse(property.GetString(), out var stringValue) => stringValue,
            _ => fallback
        };
    }

    private static double GetCoordinate(JsonElement element, string decimalPropertyName, string rawPropertyName, double fallback)
    {
        var decimalValue = GetScaledCoordinate(element, decimalPropertyName, double.NaN);
        if (!double.IsNaN(decimalValue))
        {
            return decimalValue;
        }

        if (!element.TryGetProperty(rawPropertyName, out var rawProperty))
        {
            return fallback;
        }

        return rawProperty.ValueKind switch
        {
            JsonValueKind.Number when rawProperty.TryGetDouble(out var rawNumber) => NormalizeCoordinate(rawNumber),
            JsonValueKind.String when double.TryParse(rawProperty.GetString(), out var rawStringValue) => NormalizeCoordinate(rawStringValue),
            _ => fallback
        };
    }

    private static double GetScaledCoordinate(JsonElement element, string propertyName, double fallback)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return fallback;
        }

        return property.ValueKind switch
        {
            JsonValueKind.Number when property.TryGetDouble(out var value) => NormalizeCoordinate(value),
            JsonValueKind.String when double.TryParse(property.GetString(), out var stringValue) => NormalizeCoordinate(stringValue),
            _ => fallback
        };
    }

    private static double NormalizeCoordinate(double value)
    {
        return Math.Abs(value) > 1000d ? value / 1_000_000d : value;
    }

    private static string GetRawCoordinate(JsonElement element, string propertyName, string fallback)
    {
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return fallback;
        }

        return property.ToString() ?? fallback;
    }

    private static bool IsWithinKaliorangArea(double latitude, double longitude)
    {
        return HaversineDistanceMeters(latitude, longitude, KaliorangCenterLatitude, KaliorangCenterLongitude) <= KaliorangValidRadiusMeters;
    }

    private static double KmhToKnots(double kmh)
    {
        return kmh * 0.539956803;
    }

    private static string NormalizeCameraUrl(string cameraUrl)
    {
        if (string.IsNullOrWhiteSpace(cameraUrl))
        {
            return DefaultCameraUrl;
        }

        if (Uri.TryCreate(cameraUrl, UriKind.Absolute, out var absoluteUri))
        {
            return cameraUrl;
        }

        if (!cameraUrl.StartsWith('/'))
        {
            return $"{CameraOrigin}/808gps/{cameraUrl.TrimStart('/')}";
        }

        return $"{CameraOrigin}{cameraUrl}";
    }

    private static double HaversineDistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusMeters = 6_371_000d;
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2))
                * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusMeters * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180d;
}
