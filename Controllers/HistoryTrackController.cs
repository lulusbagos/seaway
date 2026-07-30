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
        var historyData = await historyTrackService.GetHistoryForLast24HoursAsync();
        return Json(historyData);
    }
}
