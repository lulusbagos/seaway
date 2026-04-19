namespace SeaWay.Data.Entities;

public class UserLogin
{
    public int UserId { get; set; }

    public string Username { get; set; } = string.Empty;

    public string PasswordText { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public ICollection<UserRoleRelation> UserRoles { get; set; } = new List<UserRoleRelation>();
}
