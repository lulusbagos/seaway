using SeaWay.Data.Entities;

namespace SeaWay.Models.ViewModels;

public class ReplayViewModel
{
    public required IReadOnlyList<UnitMaster> Units { get; init; }

    public string? SelectedUnitCode { get; init; }

    public required double MapCenterLatitude { get; init; }

    public required double MapCenterLongitude { get; init; }

    public required int MapZoom { get; init; }

    public string? InitialStartDate { get; init; }

    public string? InitialEndDate { get; init; }
}
