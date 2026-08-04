using Microsoft.EntityFrameworkCore;
using SeaWay.Data;

namespace SeaWay.Services;

public class HistoryTrackService(SeaWayDbContext dbContext, UnitStatusService unitStatusService)
{
    public async Task<List<UnitHistoryTrackViewModel>> GetHistoryForLast48HoursAsync()
    {
        var cutoff = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-48), DateTimeKind.Unspecified);
        var tracks = await dbContext.HistoryTracks
            .Where(t => t.RecordedAt >= cutoff)
            .OrderBy(t => t.RecordedAt)
            .ToListAsync();

        var activeUnits = await dbContext.UnitMasters.Where(u => u.IsActive).ToListAsync();
        var result = new List<UnitHistoryTrackViewModel>();
        var grouped = tracks.GroupBy(t => t.UnitCode).ToDictionary(g => g.Key, g => g.ToList());

        foreach (var unitMaster in activeUnits)
        {
            var unitCode = unitMaster.UnitCode;
            var points = new List<HistoryTrackPointViewModel>();

            if (grouped.TryGetValue(unitCode, out var historyPoints))
            {
                HistoryTrackPointViewModel? lastValidPoint = null;
                foreach (var p in historyPoints.OrderBy(x => x.RecordedAt))
                {
                    var pt = new HistoryTrackPointViewModel
                    {
                        Latitude = p.Latitude,
                        Longitude = p.Longitude,
                        SpeedKnots = p.SpeedKnots ?? 0,
                        HeadingDeg = p.HeadingDeg ?? 0,
                        RecordedAt = p.RecordedAt,
                        TimeLabel = p.RecordedAt.ToString("HH:mm")
                    };

                    if (lastValidPoint == null)
                    {
                        points.Add(pt);
                        lastValidPoint = pt;
                    }
                    else
                    {
                        double dist = HaversineDistanceMeters(lastValidPoint.Latitude, lastValidPoint.Longitude, pt.Latitude, pt.Longitude);
                        double hours = (pt.RecordedAt - lastValidPoint.RecordedAt).TotalHours;
                        if (hours <= 0) hours = 0.01;
                        double calcSpeedKnots = (dist / 1852.0) / hours;

                        // 100 knots is ~185 km/h. No ship goes this fast. If speed > 100, it's a spike!
                        if (calcSpeedKnots < 100)
                        {
                            points.Add(pt);
                            lastValidPoint = pt;
                        }
                    }
                }
            }

            try
            {
                var currentStatus = await unitStatusService.GetSnapshotForUnitAsync(unitMaster);
                if (currentStatus != null && currentStatus.Latitude != 0 && currentStatus.Longitude != 0)
                {
                    double.TryParse(currentStatus.SpeedLabel?.Replace(" Knot", "").Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var spd);
                    int.TryParse(currentStatus.Heading?.Replace(" deg", "").Trim(), out var hdg);

                    var nowUtc = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
                    bool isSpike = false;
                    if (points.Count > 0)
                    {
                        var lastPt = points.Last();
                        double dist = HaversineDistanceMeters(lastPt.Latitude, lastPt.Longitude, currentStatus.Latitude, currentStatus.Longitude);
                        double hours = (nowUtc - lastPt.RecordedAt).TotalHours;
                        if (hours <= 0) hours = 0.01;
                        double calcSpeedKnots = (dist / 1852.0) / hours;
                        if (calcSpeedKnots >= 100)
                        {
                            isSpike = true;
                        }
                    }

                    if (!isSpike)
                    {
                        points.Add(new HistoryTrackPointViewModel
                        {
                            Latitude = currentStatus.Latitude,
                            Longitude = currentStatus.Longitude,
                            SpeedKnots = spd,
                            HeadingDeg = hdg,
                            RecordedAt = nowUtc,
                            TimeLabel = "Sekarang"
                        });
                    }
                }
            }
            catch
            {
                // ignore
            }

            result.Add(new UnitHistoryTrackViewModel
            {
                UnitId = unitMaster.UnitId,
                UnitCode = unitCode,
                UnitName = unitMaster.UnitName,
                Color = "#000000",
                Points = points
            });
        }

        return result;
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

public class UnitHistoryTrackViewModel
{
    public int UnitId { get; set; }
    public string UnitCode { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public string Color { get; set; } = "#000000";
    public List<HistoryTrackPointViewModel> Points { get; set; } = [];
}

public class HistoryTrackPointViewModel
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double SpeedKnots { get; set; }
    public int HeadingDeg { get; set; }
    public DateTime RecordedAt { get; set; }
    public string TimeLabel { get; set; } = string.Empty;
}
