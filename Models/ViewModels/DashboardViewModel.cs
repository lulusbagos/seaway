namespace SeaWay.Models.ViewModels;

public class DashboardViewModel
{
    public required IReadOnlyList<KpiCardViewModel> Kpis { get; init; }

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
