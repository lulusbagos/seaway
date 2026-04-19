using Microsoft.AspNetCore.Http;
using SeaWay.Data.Entities;

namespace SeaWay.Models.ViewModels;

public class UnitSettingsViewModel
{
    public required IReadOnlyList<UnitMaster> Units { get; init; }

    public required UnitEditViewModel EditUnit { get; init; }
}

public class UnitEditViewModel
{
    public int UnitId { get; set; }

    public string UnitCode { get; set; } = string.Empty;

    public string UnitName { get; set; } = string.Empty;

    public string DeviceIdNo { get; set; } = string.Empty;

    public string SessionToken { get; set; } = string.Empty;

    public string? GpsStatusUrl { get; set; }

    public string? CameraUrl { get; set; }

    public string? UnitImageUrl { get; set; }

    public string IconKey { get; set; } = "ship";

    public string? UnitType { get; set; }

    public string? UnitDetail { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsDefault { get; set; }

    public IFormFile? ImageFile { get; set; }
}
