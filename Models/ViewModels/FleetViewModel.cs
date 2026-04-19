namespace SeaWay.Models.ViewModels;

public class FleetViewModel
{
    public required string HeroTitle { get; init; }

    public required string HeroDescription { get; init; }

    public required IReadOnlyList<HeroMetricViewModel> HeroMetrics { get; init; }

    public required IReadOnlyList<VesselBoardViewModel> Vessels { get; init; }

    public required IReadOnlyList<TimelineEventViewModel> PlaybackEvents { get; init; }

    public required IReadOnlyList<GeofenceViewModel> Zones { get; init; }
}

public class HeroMetricViewModel
{
    public required string Label { get; init; }

    public required string Value { get; init; }
}

public class VesselBoardViewModel
{
    public required string Name { get; init; }

    public required string Type { get; init; }

    public required string Status { get; init; }

    public required string Cargo { get; init; }

    public required string Speed { get; init; }

    public required string Eta { get; init; }

    public required string LastPing { get; init; }
}
