using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SeaWay.Services;

namespace SeaWay.Controllers;

[Authorize]
public class RolesController(SeawayDemoDataService demoDataService) : Controller
{
    public IActionResult Index()
    {
        ViewData["Title"] = "Role Access";
        ViewData["Subtitle"] = "Preview struktur hak akses sebelum autentikasi dan otorisasi diperluas.";
        return View(demoDataService.GetRoles());
    }
}
