using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SeaWay.Models.ViewModels;
using SeaWay.Services;

namespace SeaWay.Controllers;

[Authorize]
public class ReplayController(UnitMasterService unitMasterService) : Controller
{
    public async Task<IActionResult> Index([FromQuery] string? unitCode, [FromQuery] string? start, [FromQuery] string? end)
    {
        ViewData["Title"] = "Histori & Replay Armada";
        ViewData["Subtitle"] = "Analisis rute, log lintasan pelayaran, dan simulasi pemutaran visual pergerakan kapal.";

        var units = await unitMasterService.GetAllAsync();
        var activeUnits = units.Where(u => u.IsActive).OrderBy(u => u.UnitName).ToList();

        var initialStart = !string.IsNullOrEmpty(start) 
            ? start 
            : DateTime.UtcNow.AddDays(-2).ToString("yyyy-MM-dd");
        
        var initialEnd = !string.IsNullOrEmpty(end) 
            ? end 
            : DateTime.UtcNow.ToString("yyyy-MM-dd");

        var vm = new ReplayViewModel
        {
            Units = activeUnits,
            SelectedUnitCode = unitCode ?? (activeUnits.FirstOrDefault()?.UnitCode ?? ""),
            MapCenterLatitude = -2.55,
            MapCenterLongitude = 118.65,
            MapZoom = 6,
            InitialStartDate = initialStart,
            InitialEndDate = initialEnd
        };

        return View(vm);
    }
}
