using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SeaWay.Services;

namespace SeaWay.Controllers;

[Authorize]
public class DashboardController(SeawayDemoDataService demoDataService) : Controller
{
    public IActionResult Index()
    {
        ViewData["Title"] = "Command Center";
        ViewData["Subtitle"] = "Ringkasan realtime untuk armada, alert, cuaca, dan geofence.";
        return View(demoDataService.GetDashboard());
    }
}
