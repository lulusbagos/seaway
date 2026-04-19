using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SeaWay.Services;

namespace SeaWay.Controllers;

[Authorize]
public class DashboardController(SeawayDemoDataService demoDataService, UnitStatusService unitStatusService) : Controller
{
    public async Task<IActionResult> Index()
    {
        ViewData["Title"] = "Command Center";
        ViewData["Subtitle"] = "Ringkasan realtime untuk armada, alert, cuaca, dan geofence.";
        var liveUnit = await unitStatusService.GetSnapshotAsync();
        return View(demoDataService.GetDashboard(liveUnit));
    }
}
