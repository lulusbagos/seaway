using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SeaWay.Services;

namespace SeaWay.Controllers;

[Authorize]
[Route("api/history-tracks")]
public class HistoryTrackController(HistoryTrackService historyTrackService) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? start, [FromQuery] string? end, [FromQuery] string? unitCode, [FromQuery] string[]? unitCodes)
    {
        DateTime? startDate = null;
        DateTime? endDate = null;

        if (DateTime.TryParse(start, out var parsedStart))
        {
            startDate = DateTime.SpecifyKind(parsedStart, DateTimeKind.Unspecified);
        }
        if (DateTime.TryParse(end, out var parsedEnd))
        {
            if (parsedEnd.TimeOfDay == TimeSpan.Zero)
            {
                parsedEnd = parsedEnd.Date.AddDays(1).AddTicks(-1);
            }
            endDate = DateTime.SpecifyKind(parsedEnd, DateTimeKind.Unspecified);
        }

        var codes = new List<string>();
        if (!string.IsNullOrWhiteSpace(unitCode))
        {
            codes.AddRange(unitCode.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        }
        if (unitCodes != null && unitCodes.Length > 0)
        {
            codes.AddRange(unitCodes);
        }
        codes = codes.Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        var historyData = await historyTrackService.GetHistoryAsync(startDate, endDate, codes);
        return Json(historyData);
    }

    [AllowAnonymous]
    [HttpGet("dump")]
    public async Task<IActionResult> Dump([FromServices] SeaWay.Data.SeaWayDbContext db)
    {
        var count = db.HistoryTracks.Count();
        if (count == 0) return Ok("Empty");
        var min = db.HistoryTracks.Min(x => x.RecordedAt);
        var max = db.HistoryTracks.Max(x => x.RecordedAt);
        return Ok($"Count: {count}, Min: {min}, Max: {max}");
    }
}
