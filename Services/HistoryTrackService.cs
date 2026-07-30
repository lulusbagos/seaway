using Microsoft.EntityFrameworkCore;
using SeaWay.Data;

namespace SeaWay.Services;

public class HistoryTrackService(SeaWayDbContext dbContext, UnitStatusService unitStatusService)
{
    public async Task<List<UnitHistoryTrackViewModel>> GetHistoryForLast24HoursAsync()
    {
        var cutoff = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-24), DateTimeKind.Unspecified);
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
                points.AddRange(historyPoints.Select(p => new HistoryTrackPointViewModel
                {
                    Latitude = p.Latitude,
                    Longitude = p.Longitude,
                    SpeedKnots = p.SpeedKnots ?? 0,
                    HeadingDeg = p.HeadingDeg ?? 0,
                    RecordedAt = p.RecordedAt,
                    TimeLabel = p.RecordedAt.ToString("HH:mm")
                }));
            }

            try
            {
                var currentStatus = await unitStatusService.GetSnapshotForUnitAsync(unitMaster);
                if (currentStatus != null && currentStatus.Latitude != 0 && currentStatus.Longitude != 0)
                {
                    double.TryParse(currentStatus.SpeedLabel?.Replace(" Knot", "").Trim(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var spd);
                    int.TryParse(currentStatus.Heading?.Replace(" deg", "").Trim(), out var hdg);

                    points.Add(new HistoryTrackPointViewModel
                    {
                        Latitude = currentStatus.Latitude,
                        Longitude = currentStatus.Longitude,
                        SpeedKnots = spd,
                        HeadingDeg = hdg,
                        RecordedAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified),
                        TimeLabel = "Sekarang"
                    });
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
