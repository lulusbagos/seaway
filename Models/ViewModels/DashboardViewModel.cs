namespace SeaWay.Models.ViewModels;

public class DashboardViewModel
{
    public required IReadOnlyList<KpiCardViewModel> Kpis { get; init; }

    public required UnitStatusSnapshotViewModel LiveUnit { get; init; }

    public required double MapCenterLatitude { get; init; }

    public required double MapCenterLongitude { get; init; }

    public required int MapZoom { get; init; }

    public required IReadOnlyList<MapSignalViewModel> MapSignals { get; init; }

    public required IReadOnlyList<MarineAlertViewModel> Alerts { get; init; }

    public required IReadOnlyList<VesselViewModel> ActiveVessels { get; init; }

    public required IReadOnlyList<GeofenceViewModel> Geofences { get; init; }

    public required IReadOnlyList<WeatherMetricViewModel> Weather { get; init; }

    public required IReadOnlyList<TimelineEventViewModel> Timeline { get; init; }
}

public class KpiCardViewModel
{
    public required string Label { get; init; }

    public required string Value { get; init; }

    public required string Change { get; init; }

    public required string ChangeTone { get; init; }

    public required string Icon { get; init; }
}

public class MapSignalViewModel
{
    public required string Name { get; init; }

    public required string Status { get; init; }

    public required string SpeedLabel { get; init; }

    public required double X { get; init; }

    public required double Y { get; init; }

    public required double Latitude { get; init; }

    public required double Longitude { get; init; }

    public string? Heading { get; init; }

    public string? CameraUrl { get; init; }

    public string? DeviceId { get; init; }

    public string? UnitCode { get; init; }

    public string? UnitName { get; init; }

    public string? UnitDetail { get; init; }

    public string? LocationStatus { get; init; }

    public string? LocationNote { get; init; }

    public string? RawLatitude { get; init; }

    public string? RawLongitude { get; init; }

    public string? DecimalLatitude { get; init; }

    public string? DecimalLongitude { get; init; }

    public string? LastSeen { get; init; }

    public IReadOnlyList<UnitTelemetryFieldViewModel>? Telemetry { get; init; }

    public IReadOnlyList<UnitStatusTrailPointViewModel>? Trail { get; init; }
}

public class UnitStatusSnapshotViewModel
{
    public required string DeviceId { get; init; }

    public required string UnitCode { get; init; }

    public required string VehicleId { get; init; }

    public required string Name { get; init; }

    public required string UnitName { get; init; }

    public required string UnitDetail { get; init; }

    public required string Status { get; init; }

    public required bool IsOnline { get; init; }

    public required string Network { get; init; }

    public required string Gateway { get; init; }

    public required string SessionToken { get; init; }

    public required string GpsStatusUrl { get; init; }

    public required string SpeedLabel { get; init; }

    public required string Heading { get; init; }

    public required double Latitude { get; init; }

    public required double Longitude { get; init; }

    public required string PositionText { get; init; }

    public required string LastSeen { get; init; }

    public required string UnitKind { get; init; }

    public required string Icon { get; init; }

    public required string CameraUrl { get; init; }

    public required string LocationStatus { get; init; }

    public required string LocationNote { get; init; }

    public required string RawLatitude { get; init; }

    public required string RawLongitude { get; init; }

    public required string DecimalLatitude { get; init; }

    public required string DecimalLongitude { get; init; }

    public required IReadOnlyList<UnitTelemetryFieldViewModel> Telemetry { get; init; }

    public required IReadOnlyList<UnitStatusTrailPointViewModel> Trail { get; init; }
}

public class UnitStatusTrailPointViewModel
{
    public required double Latitude { get; init; }

    public required double Longitude { get; init; }

    public required string Label { get; init; }
}

public class UnitTelemetryFieldViewModel
{
    public required string Label { get; init; }

    public required string Value { get; init; }

    public required string Tone { get; init; }
}

public class MarineAlertViewModel
{
    public required string Severity { get; init; }

    public required string Title { get; init; }

    public required string VesselName { get; init; }

    public required string Description { get; init; }

    public required string OccurredAt { get; init; }
}

public class VesselViewModel
{
    public required string Name { get; init; }

    public required string Imo { get; init; }

    public required string Status { get; init; }

    public required string Destination { get; init; }

    public required string Speed { get; init; }

    public required string Heading { get; init; }

    public required string LastUpdate { get; init; }
}

public class GeofenceViewModel
{
    public required string Name { get; init; }

    public required string State { get; init; }

    public required string Description { get; init; }

    public required string VesselCount { get; init; }
}

public class WeatherMetricViewModel
{
    public required string Label { get; init; }

    public required string Value { get; init; }
}

public class TimelineEventViewModel
{
    public required string Time { get; init; }

    public required string Title { get; init; }

    public required string Description { get; init; }
}
