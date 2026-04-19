namespace SeaWay.Data.Entities;

public class UnitMaster
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

    public bool IsActive { get; set; }

    public bool IsDefault { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
