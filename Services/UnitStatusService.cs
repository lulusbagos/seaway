using System.Text.Json;
using SeaWay.Data.Entities;
using SeaWay.Models.ViewModels;

namespace SeaWay.Services;

public class UnitStatusService(IHttpClientFactory httpClientFactory, UnitMasterService unitMasterService)
{
    private const string DefaultCameraUrl =
        "/808gps/open/player/video.html?lang=en&devIdno=353075846831&account=LenzguardUnggul&password=UDULENZGUARD123";
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

    private async Task<UnitStatusSnapshotViewModel> FetchSnapshotAsync()
    {
        var unit = await unitMasterService.GetActiveAsync();
        var deviceId = unit?.DeviceIdNo ?? "221083241090";
        var sessionToken = unit?.SessionToken ?? "7725f0b6e9404a5d86bb6ccab539db9e";
        var gpsStatusUrl = unit?.GpsStatusUrl ?? "http://103.245.39.218:8080/StandardApiAction_getDeviceStatus.action";
        var unitName = unit?.UnitName ?? "RD4003 - SeaWay Live Unit";
        var unitCode = unit?.UnitCode ?? "RD4003";
        var cameraUrl = NormalizeCameraUrl(unit?.CameraUrl ?? DefaultCameraUrl);
        var iconKey = unit?.IconKey ?? "ship";
        var unitType = unit?.UnitType ?? "Merchant Vessel";
        var unitDetail = unit?.UnitDetail ?? "Live GPS/AIS unit untuk monitoring operasional SeaWay.";

        var client = httpClientFactory.CreateClient();
        var requestUrl = $"{gpsStatusUrl}?jsession={Uri.EscapeDataString(sessionToken)}&devIdno={Uri.EscapeDataString(deviceId)}";
        using var response = await client.GetAsync(requestUrl);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);

        var root = document.RootElement;
        var statusArray = root.GetProperty("status");
        var item = statusArray.GetArrayLength() > 0 ? statusArray[0] : default;

        if (statusArray.GetArrayLength() == 0)
        {
            return CreateFallbackSnapshot();
        }

        var apiDeviceId = GetString(item, "id", deviceId);
        var vehicleId = GetString(item, "vid", "RD4003");
        var rawLatitude = GetRawCoordinate(item, "lat", "0");
        var rawLongitude = GetRawCoordinate(item, "lng", "0");
        var latitude = GetCoordinate(item, "mlat", "lat", -2.55);
        var longitude = GetCoordinate(item, "mlng", "lng", 118.65);
        var speedRaw = GetInt(item, "sp", 0);
        var headingRaw = GetInt(item, "hx", 0);
        var online = GetInt(item, "ol", 0) == 1;
        var net = GetInt(item, "net", 0);
        var gateway = GetString(item, "gw", "-");
        var pk = GetRawField(item, "pk");
        var lc = GetRawField(item, "lc");
        var gd = GetRawField(item, "gd");
        var s1 = GetRawField(item, "s1");
        var s2 = GetRawField(item, "s2");
        var s3 = GetRawField(item, "s3");
        var s4 = GetRawField(item, "s4");
        var bsd1 = GetRawField(item, "bsd1");
        var t1 = GetRawField(item, "t1");
        var t2 = GetRawField(item, "t2");
        var t3 = GetRawField(item, "t3");
        var t4 = GetRawField(item, "t4");
        var gt = GetString(item, "gt", DateTimeOffset.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"));
        var gpsTime = DateTime.TryParse(gt, out var parsedGt)
            ? DateTime.SpecifyKind(parsedGt, DateTimeKind.Unspecified)
            : DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);

        var trailPoint = new UnitStatusTrailPointViewModel
        {
            Latitude = latitude,
            Longitude = longitude,
            Label = gpsTime.ToString("HH:mm:ss")
        };

        if (_trail.Count == 0 || IsDifferent(_trail[^1], trailPoint))
        {
            _trail.Add(trailPoint);
        }

        while (_trail.Count > 24)
        {
            _trail.RemoveAt(0);
        }

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
            SpeedLabel = $"{speedRaw / 10.0:0.0} Knot",
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
                new() { Label = "net", Value = net.ToString(), Tone = "positive" },
                new() { Label = "gw", Value = gateway, Tone = "positive" },
                new() { Label = "ol", Value = online ? "1" : "0", Tone = online ? "positive" : "warning" },
                new() { Label = "sp", Value = speedRaw.ToString(), Tone = "positive" },
                new() { Label = "hx", Value = headingRaw.ToString(), Tone = "positive" },
                new() { Label = "pk", Value = pk, Tone = "warning" },
                new() { Label = "lc", Value = lc, Tone = "neutral" },
                new() { Label = "gd", Value = gd, Tone = "neutral" },
                new() { Label = "s1", Value = s1, Tone = "neutral" },
                new() { Label = "s2", Value = s2, Tone = "neutral" },
                new() { Label = "s3", Value = s3, Tone = "neutral" },
                new() { Label = "s4", Value = s4, Tone = "neutral" },
                new() { Label = "bsd1", Value = bsd1, Tone = "neutral" },
                new() { Label = "t1", Value = t1, Tone = "neutral" },
                new() { Label = "t2", Value = t2, Tone = "neutral" },
                new() { Label = "t3", Value = t3, Tone = "neutral" },
                new() { Label = "t4", Value = t4, Tone = "neutral" }
            ],
            Trail = _trail.ToList()
        };
    }

    private static bool IsDifferent(UnitStatusTrailPointViewModel a, UnitStatusTrailPointViewModel b)
    {
        return Math.Abs(a.Latitude - b.Latitude) > 0.000001 || Math.Abs(a.Longitude - b.Longitude) > 0.000001;
    }

    private static UnitStatusSnapshotViewModel CreateFallbackSnapshot()
    {
        return new UnitStatusSnapshotViewModel
        {
            DeviceId = "221083241090",
            UnitCode = "RD4003",
            VehicleId = "RD4003",
            Name = "RD4003 - SeaWay Live Unit",
            UnitName = "RD4003 - SeaWay Live Unit",
            UnitDetail = "Snapshot fallback digunakan karena data lokasi belum tersedia.",
            Status = "online",
            IsOnline = true,
            Network = "NET 3",
            Gateway = "G1",
            SessionToken = "7725f0b6e9404a5d86bb6ccab539db9e",
            GpsStatusUrl = "http://103.245.39.218:8080/StandardApiAction_getDeviceStatus.action",
            SpeedLabel = "28.0 Knot",
            Heading = "358 deg",
            Latitude = 1.027590,
            Longitude = 117.658300,
            PositionText = "1.02759,117.6583",
            LastSeen = DateTime.UtcNow.ToString("dd MMM HH:mm"),
            UnitKind = "Merchant Vessel",
            Icon = "ship",
            CameraUrl = DefaultCameraUrl,
            LocationStatus = "lokasi tidak sesuai",
            LocationNote = "Snapshot fallback digunakan karena data lokasi belum tersedia.",
            RawLatitude = "1027590",
            RawLongitude = "117658300",
            DecimalLatitude = "1.027590",
            DecimalLongitude = "117.658300",
            Telemetry =
            [
                new() { Label = "net", Value = "3", Tone = "positive" },
                new() { Label = "gw", Value = "G1", Tone = "positive" },
                new() { Label = "ol", Value = "1", Tone = "positive" },
                new() { Label = "sp", Value = "70", Tone = "positive" },
                new() { Label = "hx", Value = "348", Tone = "positive" },
                new() { Label = "pk", Value = "0", Tone = "warning" },
                new() { Label = "lc", Value = "35666300", Tone = "neutral" },
                new() { Label = "gd", Value = "169", Tone = "neutral" },
                new() { Label = "s1", Value = "-2147481213", Tone = "neutral" },
                new() { Label = "s2", Value = "528385", Tone = "neutral" },
                new() { Label = "s3", Value = "202375168", Tone = "neutral" },
                new() { Label = "s4", Value = "8", Tone = "neutral" },
                new() { Label = "bsd1", Value = "758", Tone = "neutral" },
                new() { Label = "t1", Value = "0", Tone = "neutral" },
                new() { Label = "t2", Value = "0", Tone = "neutral" },
                new() { Label = "t3", Value = "0", Tone = "neutral" },
                new() { Label = "t4", Value = "0", Tone = "neutral" }
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

    private static double GetDouble(JsonElement element, string propertyName, double fallback)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return fallback;
        }

        return property.ValueKind switch
        {
            JsonValueKind.Number when property.TryGetDouble(out var value) => value,
            JsonValueKind.String when double.TryParse(property.GetString(), out var stringValue) => stringValue,
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

    private static string GetRawField(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return "-";
        }

        return property.ToString() ?? "-";
    }

    private static bool IsWithinKaliorangArea(double latitude, double longitude)
    {
        return HaversineDistanceMeters(latitude, longitude, KaliorangCenterLatitude, KaliorangCenterLongitude) <= KaliorangValidRadiusMeters;
    }

    private static string NormalizeCameraUrl(string cameraUrl)
    {
        if (string.IsNullOrWhiteSpace(cameraUrl))
        {
            return DefaultCameraUrl;
        }

        if (Uri.TryCreate(cameraUrl, UriKind.Absolute, out var absoluteUri))
        {
            if (absoluteUri.Host.Equals("103.245.39.218", StringComparison.OrdinalIgnoreCase) && absoluteUri.Port == 8080)
            {
                return $"{absoluteUri.AbsolutePath}{absoluteUri.Query}";
            }

            return cameraUrl;
        }

        if (!cameraUrl.StartsWith('/'))
        {
            return $"/808gps/{cameraUrl.TrimStart('/')}";
        }

        return cameraUrl;
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
