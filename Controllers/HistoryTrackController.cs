using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SeaWay.Services;

namespace SeaWay.Controllers;

[Authorize]
[Route("api/history-tracks")]
public class HistoryTrackController(HistoryTrackService historyTrackService) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var historyData = await historyTrackService.GetHistoryForLast48HoursAsync();
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
