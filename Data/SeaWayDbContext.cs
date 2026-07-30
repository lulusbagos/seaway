using Microsoft.EntityFrameworkCore;
using SeaWay.Data.Entities;

namespace SeaWay.Data;

public class SeaWayDbContext(DbContextOptions<SeaWayDbContext> options) : DbContext(options)
{
    public DbSet<UserLogin> UserLogins => Set<UserLogin>();

    public DbSet<RoleMaster> Roles => Set<RoleMaster>();

    public DbSet<UserRoleRelation> UserRoles => Set<UserRoleRelation>();

    public DbSet<LoginAudit> LoginAudits => Set<LoginAudit>();

    public DbSet<UnitMaster> UnitMasters => Set<UnitMaster>();

    public DbSet<HistoryTrack> HistoryTracks => Set<HistoryTrack>();

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

        modelBuilder.Entity<UnitMaster>(entity =>
        {
            entity.ToTable("tbl_m_unit");
            entity.HasKey(x => x.UnitId);
            entity.Property(x => x.UnitId).HasColumnName("unit_id");
            entity.Property(x => x.UnitCode).HasColumnName("unit_code");
            entity.Property(x => x.UnitName).HasColumnName("unit_name");
            entity.Property(x => x.DeviceIdNo).HasColumnName("device_idno");
            entity.Property(x => x.SessionToken).HasColumnName("session_token");
            entity.Property(x => x.GpsStatusUrl).HasColumnName("gps_status_url");
            entity.Property(x => x.CameraUrl).HasColumnName("camera_url");
            entity.Property(x => x.UnitImageUrl).HasColumnName("unit_image_url");
            entity.Property(x => x.IconKey).HasColumnName("icon_key");
            entity.Property(x => x.UnitType).HasColumnName("unit_type");
            entity.Property(x => x.UnitDetail).HasColumnName("unit_detail");
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.IsDefault).HasColumnName("is_default");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("timestamp without time zone");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("timestamp without time zone");
            entity.HasIndex(x => x.UnitCode).IsUnique();
            entity.HasIndex(x => x.DeviceIdNo).IsUnique();
        });

        modelBuilder.Entity<HistoryTrack>(entity =>
        {
            entity.ToTable("tbl_m_history_track");
            entity.HasKey(x => x.TrackId);
            entity.Property(x => x.TrackId).HasColumnName("track_id");
            entity.Property(x => x.UnitId).HasColumnName("unit_id");
            entity.Property(x => x.UnitCode).HasColumnName("unit_code");
            entity.Property(x => x.Latitude).HasColumnName("latitude");
            entity.Property(x => x.Longitude).HasColumnName("longitude");
            entity.Property(x => x.SpeedKnots).HasColumnName("speed_knots");
            entity.Property(x => x.HeadingDeg).HasColumnName("heading_deg");
            entity.Property(x => x.RecordedAt).HasColumnName("recorded_at").HasColumnType("timestamp without time zone");
            entity.HasIndex(x => new { x.UnitId, x.RecordedAt });
        });
    }
}
