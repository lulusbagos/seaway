namespace SeaWay.Data.Entities;

public class UserRoleRelation
{
    public int UserRoleId { get; set; }

    public int UserId { get; set; }

    public int RoleId { get; set; }

    public bool IsDefault { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public UserLogin User { get; set; } = null!;

    public RoleMaster Role { get; set; } = null!;
}
