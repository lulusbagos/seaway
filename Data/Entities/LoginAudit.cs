namespace SeaWay.Data.Entities;

public class LoginAudit
{
    public int LoginAuditId { get; set; }

    public int? UserId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string? RoleName { get; set; }

    public string? IpAddress { get; set; }

    public string? UserAgent { get; set; }

    public DateTime LoginAt { get; set; }

    public string LoginStatus { get; set; } = string.Empty;
}
