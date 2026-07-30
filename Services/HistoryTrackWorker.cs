using Microsoft.EntityFrameworkCore;
using SeaWay.Data;
using SeaWay.Data.Entities;
using SeaWay.Services;

namespace SeaWay.Services;

/// <summary>
/// Background service that captures GPS position for every active unit every 15 minutes
/// and persists rows to tbl_m_history_track.
/// </summary>
public sealed class HistoryTrackWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<HistoryTrackWorker> logger)
    : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("HistoryTrackWorker started — recording GPS every {Interval} min.", Interval.TotalMinutes);

        await RecordSnapshotsAsync(stoppingToken);

        using var timer = new PeriodicTimer(Interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await RecordSnapshotsAsync(stoppingToken);
        }
    }

    private async Task RecordSnapshotsAsync(CancellationToken ct)
    {
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<SeaWayDbContext>();
            var unitMasterService = scope.ServiceProvider.GetRequiredService<UnitMasterService>();
            var unitStatusService = scope.ServiceProvider.GetRequiredService<UnitStatusService>();

            var activeUnits = await db.UnitMasters
                .Where(u => u.IsActive)
                .ToListAsync(ct);

            if (activeUnits.Count == 0)
            {
                logger.LogDebug("HistoryTrackWorker: no active units found, skipping.");
                return;
            }

            var now = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
            var rows = new List<HistoryTrack>(activeUnits.Count);

            foreach (var unit in activeUnits)
            {
                var snapshot = await unitStatusService.GetSnapshotForUnitAsync(unit);
                double latitude = snapshot.Latitude;
                double longitude = snapshot.Longitude;
                double? speedKnots = null;
                int? headingDeg = null;

                if (double.TryParse(
                        snapshot.SpeedLabel?.Replace(" Knot", "").Trim(),
                        System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture,
                        out var spd))
                {
                    speedKnots = spd;
                }

                if (int.TryParse(
                        snapshot.Heading?.Replace(" deg", "").Trim(),
                        out var hdg))
                {
                    headingDeg = hdg;
                }

                if (Math.Abs(latitude) < 0.0001 && Math.Abs(longitude) < 0.0001)
                {
                    logger.LogWarning("HistoryTrackWorker: skipped unit {UnitCode} — coordinates (0,0).", unit.UnitCode);
                    continue;
                }

                rows.Add(new HistoryTrack
                {
                    UnitId = unit.UnitId,
                    UnitCode = unit.UnitCode,
                    Latitude = latitude,
                    Longitude = longitude,
                    SpeedKnots = speedKnots,
                    HeadingDeg = headingDeg,
                    RecordedAt = now
                });
            }

            if (rows.Count > 0)
            {
                db.HistoryTracks.AddRange(rows);
                await db.SaveChangesAsync(ct);
                logger.LogInformation(
                    "HistoryTrackWorker: saved {Count} track point(s) at {Time}.",
                    rows.Count,
                    now.ToString("HH:mm:ss"));
            }

            var cutoff = now.AddDays(-30);
            var deleted = await db.HistoryTracks
                .Where(t => t.RecordedAt < cutoff)
                .ExecuteDeleteAsync(ct);

            if (deleted > 0)
            {
                logger.LogInformation("HistoryTrackWorker: pruned {Count} old track records.", deleted);
            }
        }
        catch (OperationCanceledException)
        {
            // Shutting down
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "HistoryTrackWorker: error recording GPS snapshot.");
        }
    }
}
