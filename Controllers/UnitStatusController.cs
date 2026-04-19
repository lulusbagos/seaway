using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SeaWay.Services;

namespace SeaWay.Controllers;

[Authorize]
[Route("api/unit-status")]
public class UnitStatusController(UnitStatusService unitStatusService) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var snapshot = await unitStatusService.GetSnapshotAsync(forceRefresh: true);
        return Json(snapshot);
    }
}
