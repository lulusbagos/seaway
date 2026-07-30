namespace SeaWay.Data.Entities;

public class HistoryTrack
{
    public long TrackId { get; set; }

    public int UnitId { get; set; }

    public string UnitCode { get; set; } = string.Empty;

    public double Latitude { get; set; }

    public double Longitude { get; set; }

    public double? SpeedKnots { get; set; }

    public int? HeadingDeg { get; set; }

    public DateTime RecordedAt { get; set; }
}
