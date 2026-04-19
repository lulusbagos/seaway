namespace SeaWay.Data.Entities;

public class RoleMaster
{
    public int RoleId { get; set; }

    public string RoleCode { get; set; } = string.Empty;

    public string RoleName { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public ICollection<UserRoleRelation> UserRoles { get; set; } = new List<UserRoleRelation>();
}
