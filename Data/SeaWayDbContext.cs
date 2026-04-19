using Microsoft.EntityFrameworkCore;
using SeaWay.Data.Entities;

namespace SeaWay.Data;

public class SeaWayDbContext(DbContextOptions<SeaWayDbContext> options) : DbContext(options)
{
    public DbSet<UserLogin> UserLogins => Set<UserLogin>();

    public DbSet<RoleMaster> Roles => Set<RoleMaster>();

    public DbSet<UserRoleRelation> UserRoles => Set<UserRoleRelation>();

    public DbSet<LoginAudit> LoginAudits => Set<LoginAudit>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserLogin>(entity =>
        {
            entity.ToTable("tbl_m_user_login");
            entity.HasKey(x => x.UserId);
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Username).HasColumnName("username");
            entity.Property(x => x.PasswordText).HasColumnName("password_text");
            entity.Property(x => x.FullName).HasColumnName("full_name");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone");
            entity.HasIndex(x => x.Username).IsUnique();
        });

        modelBuilder.Entity<RoleMaster>(entity =>
        {
            entity.ToTable("tbl_m_role");
            entity.HasKey(x => x.RoleId);
            entity.Property(x => x.RoleId).HasColumnName("role_id");
            entity.Property(x => x.RoleCode).HasColumnName("role_code");
            entity.Property(x => x.RoleName).HasColumnName("role_name");
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone");
            entity.HasIndex(x => x.RoleCode).IsUnique();
        });

        modelBuilder.Entity<UserRoleRelation>(entity =>
        {
            entity.ToTable("tbl_r_user_role");
            entity.HasKey(x => x.UserRoleId);
            entity.Property(x => x.UserRoleId).HasColumnName("user_role_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.RoleId).HasColumnName("role_id");
            entity.Property(x => x.IsDefault).HasColumnName("is_default");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone");

            entity.HasOne(x => x.User)
                .WithMany(x => x.UserRoles)
                .HasForeignKey(x => x.UserId);

            entity.HasOne(x => x.Role)
                .WithMany(x => x.UserRoles)
                .HasForeignKey(x => x.RoleId);
        });

        modelBuilder.Entity<LoginAudit>(entity =>
        {
            entity.ToTable("tbl_t_login_audit");
            entity.HasKey(x => x.LoginAuditId);
            entity.Property(x => x.LoginAuditId).HasColumnName("login_audit_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Username).HasColumnName("username");
            entity.Property(x => x.RoleName).HasColumnName("role_name");
            entity.Property(x => x.IpAddress).HasColumnName("ip_address");
            entity.Property(x => x.UserAgent).HasColumnName("user_agent");
            entity.Property(x => x.LoginAt).HasColumnName("login_at").HasColumnType("timestamp without time zone");
            entity.Property(x => x.LoginStatus).HasColumnName("login_status");
        });
    }
}
