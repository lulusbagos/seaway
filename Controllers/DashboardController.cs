using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SeaWay.Models.ViewModels;
using SeaWay.Services;

namespace SeaWay.Controllers;

[Authorize]
public class DashboardController(SeawayDemoDataService demoDataService, UnitStatusService unitStatusService, UnitMasterService unitMasterService) : Controller
{
    public async Task<IActionResult> Index()
    {
        ViewData["Title"] = "Command Center - PT Pelayaran Ganesha Lautjaya";
        ViewData["Subtitle"] = "Pusat pemantauan real-time posisi kapal, telemetri navigasi, dan pengawasan koridor pelayaran.";
        var allUnits = await unitMasterService.GetAllAsync();
        UnitStatusSnapshotViewModel? liveUnit = null;

        var signalsList = new List<MapSignalViewModel>();
        foreach (var u in allUnits)
        {
            var snap = await unitStatusService.GetSnapshotForUnitAsync(u);
            
            // Set liveUnit to the first active/live ship found
            if (liveUnit == null && 
               (snap.Status.Equals("Live", StringComparison.OrdinalIgnoreCase) || 
                snap.Status.Equals("Watch", StringComparison.OrdinalIgnoreCase) || 
                snap.Status.Equals("Online", StringComparison.OrdinalIgnoreCase)))
            {
                liveUnit = snap;
            }

            signalsList.Add(new MapSignalViewModel
            {
                Name = u.UnitName,
                Status = snap.Status,
                SpeedLabel = snap.SpeedLabel,
                Heading = snap.Heading,
                Latitude = snap.Latitude,
                Longitude = snap.Longitude,
                X = 0,
                Y = 0,
                CameraUrl = snap.CameraUrl,
                DeviceId = u.DeviceIdNo,
                UnitCode = u.UnitCode,
                UnitName = u.UnitName,
                UnitDetail = u.UnitDetail ?? "",
                LocationStatus = snap.LocationStatus,
                LocationNote = snap.LocationNote,
                RawLatitude = snap.RawLatitude,
                RawLongitude = snap.RawLongitude,
                DecimalLatitude = snap.DecimalLatitude,
                DecimalLongitude = snap.DecimalLongitude,
                Telemetry = snap.Telemetry,
                Trail = snap.Trail
            });
        }

        // Fallback to first unit if none are active
        if (liveUnit == null && allUnits.Any())
        {
            liveUnit = await unitStatusService.GetSnapshotForUnitAsync(allUnits.First());
        }

        var vm = demoDataService.GetDashboard(liveUnit, allUnits);
        return View(new DashboardViewModel
        {
            Kpis = vm.Kpis,
            LiveUnit = vm.LiveUnit,
            MapCenterLatitude = vm.MapCenterLatitude,
            MapCenterLongitude = vm.MapCenterLongitude,
            MapZoom = vm.MapZoom,
            MapSignals = signalsList,
            Alerts = vm.Alerts,
            ActiveVessels = vm.ActiveVessels,
            Geofences = vm.Geofences,
            Weather = vm.Weather,
            Timeline = vm.Timeline
        });
    }
}
