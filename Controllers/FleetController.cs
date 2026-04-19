using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SeaWay.Services;

namespace SeaWay.Controllers;

[Authorize]
public class FleetController(SeawayDemoDataService demoDataService) : Controller
{
    public IActionResult Index()
    {
        ViewData["Title"] = "Fleet Board";
        ViewData["Subtitle"] = "Halaman kerja operator untuk melihat status kapal, playback, dan geofence.";
        return View(demoDataService.GetFleet());
    }
}
