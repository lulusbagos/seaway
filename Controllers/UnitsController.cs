using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SeaWay.Data.Entities;
using SeaWay.Models.ViewModels;
using SeaWay.Services;

namespace SeaWay.Controllers;

[Authorize]
public class UnitsController(UnitMasterService unitMasterService, IWebHostEnvironment webHostEnvironment) : Controller
{
    public async Task<IActionResult> Index(int? unitId = null)
    {
        var units = await unitMasterService.GetAllAsync();
        var selected = unitId.HasValue
            ? units.FirstOrDefault(x => x.UnitId == unitId.Value)
            : units.FirstOrDefault(x => x.IsDefault) ?? units.FirstOrDefault();

        ViewData["Title"] = "Unit Settings";
        ViewData["Subtitle"] = "Kelola master unit GPS, session, icon, dan detail integrasi kamera.";

        return View(new UnitSettingsViewModel
        {
            Units = units,
            EditUnit = Map(selected)
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Save(UnitEditViewModel model)
    {
        var units = await unitMasterService.GetAllAsync();
        if (!ModelState.IsValid)
        {
            ViewData["Title"] = "Unit Settings";
            ViewData["Subtitle"] = "Kelola master unit GPS, session, icon, dan detail integrasi kamera.";
            return View("Index", new UnitSettingsViewModel
            {
                Units = units,
                EditUnit = model
            });
        }

        var entity = model.UnitId == 0
            ? new UnitMaster()
            : await unitMasterService.GetByIdAsync(model.UnitId) ?? new UnitMaster();

        entity.UnitCode = model.UnitCode.Trim();
        entity.UnitName = model.UnitName.Trim();
        entity.DeviceIdNo = model.DeviceIdNo.Trim();
        entity.SessionToken = model.SessionToken.Trim();
        entity.GpsStatusUrl = string.IsNullOrWhiteSpace(model.GpsStatusUrl) ? null : model.GpsStatusUrl.Trim();
        entity.CameraUrl = string.IsNullOrWhiteSpace(model.CameraUrl) ? null : model.CameraUrl.Trim();
        entity.IconKey = string.IsNullOrWhiteSpace(model.IconKey) ? "ship" : model.IconKey.Trim();
        entity.UnitType = string.IsNullOrWhiteSpace(model.UnitType) ? null : model.UnitType.Trim();
        entity.UnitDetail = string.IsNullOrWhiteSpace(model.UnitDetail) ? null : model.UnitDetail.Trim();
        entity.IsActive = model.IsActive;
        entity.IsDefault = model.IsDefault;
        var uploadedImageUrl = await SaveUnitImageAsync(model.ImageFile, entity.UnitCode);
        if (!string.IsNullOrWhiteSpace(uploadedImageUrl))
        {
            entity.UnitImageUrl = uploadedImageUrl;
        }

        await unitMasterService.SaveAsync(entity);
        TempData["UnitMessage"] = "Master unit berhasil disimpan.";
        return RedirectToAction(nameof(Index), new { unitId = entity.UnitId });
    }

    private static UnitEditViewModel Map(UnitMaster? unit)
    {
        if (unit is null)
        {
            return new UnitEditViewModel
            {
                IsActive = true,
                IconKey = "ship"
            };
        }

        return new UnitEditViewModel
        {
            UnitId = unit.UnitId,
            UnitCode = unit.UnitCode,
            UnitName = unit.UnitName,
            DeviceIdNo = unit.DeviceIdNo,
            SessionToken = unit.SessionToken,
            GpsStatusUrl = unit.GpsStatusUrl,
            CameraUrl = unit.CameraUrl,
            UnitImageUrl = unit.UnitImageUrl,
            IconKey = unit.IconKey,
            UnitType = unit.UnitType,
            UnitDetail = unit.UnitDetail,
            IsActive = unit.IsActive,
            IsDefault = unit.IsDefault
        };
    }

    private async Task<string?> SaveUnitImageAsync(IFormFile? imageFile, string unitCode)
    {
        if (imageFile is null || imageFile.Length == 0)
        {
            return null;
        }

        var uploadsRoot = Path.Combine(webHostEnvironment.WebRootPath, "uploads", "units");
        Directory.CreateDirectory(uploadsRoot);

        var extension = Path.GetExtension(imageFile.FileName);
        var safeUnitCode = string.Concat(unitCode.Where(char.IsLetterOrDigit));
        var fileName = $"{safeUnitCode}_{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
        var filePath = Path.Combine(uploadsRoot, fileName);

        await using var stream = System.IO.File.Create(filePath);
        await imageFile.CopyToAsync(stream);

        return $"/uploads/units/{fileName}";
    }
}
