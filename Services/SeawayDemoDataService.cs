using SeaWay.Data.Entities;
using SeaWay.Models.ViewModels;

namespace SeaWay.Services;

public class SeawayDemoDataService
{
    public DashboardViewModel GetDashboard(UnitStatusSnapshotViewModel? liveUnit = null, List<UnitMaster>? allUnits = null)
    {
        liveUnit ??= new UnitStatusSnapshotViewModel
        {
            DeviceId = "488260671512",
            UnitCode = "Ganesha BS 16",
            VehicleId = "Ganesha BS 16",
            Name = "Ganesha BS 16",
            UnitName = "Ganesha BS 16",
            UnitDetail = "Live GPS/AIS unit untuk monitoring operasional SeaWay.",
            Status = "online",
            IsOnline = true,
            Network = "NET 3",
            Gateway = "G1",
            SessionToken = "7725f0b6e9404a5d86bb6ccab539db9e",
            GpsStatusUrl = "https://lenzguard.com/StandardApiAction_getDeviceStatus.action",
            SpeedLabel = "28.0 Knot",
            Heading = "358 deg",
            Latitude = 1.009485,
            Longitude = 117.657333,
            PositionText = "1.009485,117.657333",
            LastSeen = DateTime.UtcNow.ToString("dd MMM HH:mm"),
            UnitKind = "Merchant Vessel",
            Icon = "ship",
            CameraUrl = "https://lenzguard.com/808gps/open/player/video.html?lang=en&devIdno=488260671512&account=GLJ01&password=123456",
            LocationStatus = "lokasi tidak sesuai",
            LocationNote = "Snapshot fallback digunakan karena data lokasi belum tersedia.",
            RawLatitude = "1027590",
            RawLongitude = "117658300",
            DecimalLatitude = "1.027590",
            DecimalLongitude = "117.658300",
            Telemetry =
            [
                new() { Label = "net", Value = "3", Tone = "positive" },
                new() { Label = "gw", Value = "G1", Tone = "positive" },
                new() { Label = "ol", Value = "1", Tone = "positive" },
                new() { Label = "sp", Value = "70", Tone = "positive" },
                new() { Label = "hx", Value = "348", Tone = "positive" },
                new() { Label = "pk", Value = "0", Tone = "warning" },
                new() { Label = "lc", Value = "35666300", Tone = "neutral" },
                new() { Label = "gd", Value = "169", Tone = "neutral" },
                new() { Label = "s1", Value = "-2147481213", Tone = "neutral" },
                new() { Label = "s2", Value = "528385", Tone = "neutral" },
                new() { Label = "s3", Value = "202375168", Tone = "neutral" },
                new() { Label = "s4", Value = "8", Tone = "neutral" },
                new() { Label = "bsd1", Value = "758", Tone = "neutral" },
                new() { Label = "t1", Value = "0", Tone = "neutral" },
                new() { Label = "t2", Value = "0", Tone = "neutral" },
                new() { Label = "t3", Value = "0", Tone = "neutral" },
                new() { Label = "t4", Value = "0", Tone = "neutral" }
            ],
            Trail = []
        };

        var isKaliorangMatch = string.Equals(liveUnit.LocationStatus, "lokasi sesuai", StringComparison.OrdinalIgnoreCase);
        var kaliorangDesc = isKaliorangMatch
            ? $"Unit {liveUnit.UnitCode} terverifikasi aktif di dalam koridor operasional Kaliorang ({liveUnit.PositionText})."
            : $"Unit {liveUnit.UnitCode} terdeteksi di luar zona Kaliorang ({liveUnit.LocationNote}).";

        var networkDesc = $"Device ID {liveUnit.DeviceId} terhubung via {liveUnit.Network}. Ping terakhir: {liveUnit.LastSeen}.";
        var navDesc = $"Kecepatan saat ini: {liveUnit.SpeedLabel} | Arah: {liveUnit.Heading}. Status: {liveUnit.Status.ToUpperInvariant()}.";

        var activeVesselsList = new List<VesselViewModel>();
        if (allUnits is { Count: > 0 })
        {
            foreach (var u in allUnits)
            {
                var isLiveDevice = string.Equals(u.DeviceIdNo, liveUnit.DeviceId, StringComparison.OrdinalIgnoreCase);
                activeVesselsList.Add(new VesselViewModel
                {
                    Name = u.UnitName,
                    Imo = u.DeviceIdNo,
                    Status = isLiveDevice ? (liveUnit.IsOnline ? "Live" : "Alert") : (u.IsActive ? "Live" : "Inactive"),
                    Destination = isLiveDevice ? liveUnit.PositionText : (u.UnitDetail ?? "Standby"),
                    Speed = isLiveDevice ? liveUnit.SpeedLabel : "0.0 Knot",
                    Heading = isLiveDevice ? liveUnit.Heading : "0 deg",
                    LastUpdate = isLiveDevice ? liveUnit.LastSeen : "Realtime"
                });
            }
        }
        else
        {
            activeVesselsList.Add(new VesselViewModel
            {
                Name = liveUnit.Name,
                Imo = liveUnit.DeviceId,
                Status = liveUnit.Status.Equals("online", StringComparison.OrdinalIgnoreCase) ? "Live" : "Alert",
                Destination = liveUnit.PositionText,
                Speed = liveUnit.SpeedLabel,
                Heading = liveUnit.Heading,
                LastUpdate = liveUnit.LastSeen
            });
        }

        return new DashboardViewModel
        {
            LiveUnit = liveUnit,
            MapCenterLatitude = liveUnit.Latitude != 0 ? liveUnit.Latitude : -2.55,
            MapCenterLongitude = liveUnit.Longitude != 0 ? liveUnit.Longitude : 118.65,
            MapZoom = 6,
            Kpis =
            [
                new() { Label = "Unit Online", Value = liveUnit.IsOnline ? "1" : "0", Change = liveUnit.DeviceId, ChangeTone = "positive", Icon = "bi-broadcast-pin" },
                new() { Label = "Status", Value = liveUnit.Status.ToUpperInvariant(), Change = liveUnit.Network, ChangeTone = liveUnit.IsOnline ? "positive" : "warning", Icon = "bi-exclamation-triangle" },
                new() { Label = "Gateway", Value = liveUnit.Gateway, Change = liveUnit.PositionText, ChangeTone = "positive", Icon = "bi-bounding-box" },
                new() { Label = "Speed", Value = liveUnit.SpeedLabel, Change = liveUnit.Heading, ChangeTone = "positive", Icon = "bi-speedometer2" }
            ],
            MapSignals = [],
            Alerts =
            [
                new() { Severity = "info", Title = "Live unit synced", VesselName = liveUnit.VehicleId, Description = $"Position {liveUnit.PositionText} from API snapshot.", OccurredAt = liveUnit.LastSeen },
                new() { Severity = "warning", Title = "Track history active", VesselName = liveUnit.VehicleId, Description = "Playback trail ready for monitoring and replay.", OccurredAt = "Realtime" }
            ],
            ActiveVessels = activeVesselsList,
            Geofences =
            [
                new()
                {
                    Name = "Zona Operasional Kaliorang",
                    State = isKaliorangMatch ? "Live" : "Watch",
                    Description = kaliorangDesc,
                    VesselCount = isKaliorangMatch ? "1 unit di lokasi" : "Di luar area"
                },
                new()
                {
                    Name = "Status Telemetri Jaringan GPS",
                    State = liveUnit.IsOnline ? "Live" : "Alert",
                    Description = networkDesc,
                    VesselCount = liveUnit.Network
                },
                new()
                {
                    Name = "Pengawasan Navigasi & Kecepatan",
                    State = string.Equals(liveUnit.Status, "online", StringComparison.OrdinalIgnoreCase) ? "Live" : "Watch",
                    Description = navDesc,
                    VesselCount = liveUnit.SpeedLabel
                }
            ],
            Weather =
            [
                new() { Label = "Angin", Value = "18 Knot NE" },
                new() { Label = "Gelombang", Value = "1.9 m" },
                new() { Label = "Visibilitas", Value = "9.6 nm" },
                new() { Label = "Pasang", Value = "Menuju tinggi" }
            ],
            Timeline =
            [
                new() { Time = DateTime.UtcNow.ToString("HH:mm"), Title = "Snapshot synced", Description = $"Koordinat {liveUnit.PositionText} diperbarui dari device {liveUnit.DeviceId}." },
                new() { Time = "08:30", Title = "Track playback ready", Description = "Histori rute pergerakan unit siap di-replay." },
                new() { Time = "07:52", Title = "Realtime poll active", Description = "Monitoring otomatis memperbarui status setiap 5 detik." }
            ]
        };
    }

    public FleetViewModel GetFleet()
    {
        return new FleetViewModel
        {
            HeroTitle = "Fleet board untuk operator harian",
            HeroDescription = "Menampilkan status armada, playback histori, dan antrian perhatian yang perlu ditindaklanjuti sebelum dispatch berikutnya.",
            HeroMetrics =
            [
                new() { Label = "Armada dipantau", Value = "31 vessel" },
                new() { Label = "Voyage aktif", Value = "18 route" },
                new() { Label = "Playback lengkap", Value = "96%" },
                new() { Label = "Downtime AIS", Value = "1.8%" }
            ],
            Vessels =
            [
                new() { Name = "MV Ocean Crown", Type = "Bulk Carrier", Status = "Live", Cargo = "Coal 68k MT", Speed = "16.2 Knot", Eta = "18 Apr 14:20", LastPing = "20 detik lalu" },
                new() { Name = "MT Nusantara Star", Type = "Tanker", Status = "Watch", Cargo = "Fuel Transfer", Speed = "12.5 Knot", Eta = "18 Apr 16:05", LastPing = "3 menit lalu" },
                new() { Name = "KM Seaway Ranger", Type = "Support Vessel", Status = "Live", Cargo = "Crew & Supply", Speed = "15.9 Knot", Eta = "18 Apr 11:40", LastPing = "44 detik lalu" },
                new() { Name = "MV Aruna Tide", Type = "Cargo Vessel", Status = "Alert", Cargo = "Container Mixed", Speed = "0.8 Knot", Eta = "On hold", LastPing = "1 menit lalu" }
            ],
            PlaybackEvents =
            [
                new() { Time = "06:10", Title = "Departure playback", Description = "MT Nusantara Star keluar dari anchorage dengan heading stabil." },
                new() { Time = "07:05", Title = "Slow steaming segment", Description = "MV Ocean Crown menurunkan kecepatan untuk crossing traffic." },
                new() { Time = "08:22", Title = "Unexpected stop", Description = "MV Aruna Tide berhenti mendadak 4 menit sebelum zona restricted." }
            ],
            Zones =
            [
                new() { Name = "Approach Corridor Alpha", State = "Live", Description = "Koridor masuk utama ke pelabuhan tujuan.", VesselCount = "11 track" },
                new() { Name = "Anchorage Delta Queue", State = "Watch", Description = "Antrian sandar dan verifikasi dwell time.", VesselCount = "6 track" },
                new() { Name = "No Drift Zone East", State = "Alert", Description = "Butuh acknowledgement supervisor jika kapal slow drift.", VesselCount = "2 track" }
            ]
        };
    }

    public RolesViewModel GetRoles()
    {
        return new RolesViewModel
        {
            Roles =
            [
                new() { Name = "Fleet Admin", Scope = "Semua kapal dan konfigurasi", Description = "Mengelola master vessel, user, geofence, playback retention, dan integrasi GPS.", MemberCount = "3 user", AccentColor = "#0c8f9d" },
                new() { Name = "Fleet Operator", Scope = "Operasional monitoring harian", Description = "Melihat live map, acknowledgement alert, update incident log, dan monitoring voyage.", MemberCount = "8 user", AccentColor = "#ffb84d" },
                new() { Name = "Port Captain", Scope = "Approval area terminal", Description = "Menyetujui deviasi rute, geofence override, dan audit kedatangan kapal.", MemberCount = "4 user", AccentColor = "#2ecf86" },
                new() { Name = "Viewer", Scope = "Read only dashboard", Description = "Akses monitoring tanpa hak ubah untuk owner, manajemen, atau stakeholder eksternal.", MemberCount = "12 user", AccentColor = "#ff6f5e" }
            ],
            Permissions =
            [
                new() { Title = "Live Vessel Tracking", Description = "Akses peta realtime, detail kapal, heading, dan histori posisi terbaru.", CaptainState = "full", OperatorState = "full", AdminState = "full" },
                new() { Title = "Acknowledge Alert", Description = "Menandai alert sebagai ditinjau, memberi catatan, dan eskalasi incident.", CaptainState = "limited", OperatorState = "full", AdminState = "full" },
                new() { Title = "Edit Geofence", Description = "Membuat dan mengubah zona restricted, anchor, dan pilot boarding area.", CaptainState = "blocked", OperatorState = "blocked", AdminState = "full" },
                new() { Title = "Playback Export", Description = "Ekspor histori rute 24 jam sampai 30 hari untuk audit atau investigasi.", CaptainState = "full", OperatorState = "limited", AdminState = "full" }
            ]
        };
    }

    public IReadOnlyList<DemoAccountViewModel> GetDemoAccounts()
    {
        return
        [
            new() { UserName = "admin", Password = "admin123", Role = "Fleet Admin", Description = "Akses penuh untuk konfigurasi dan seluruh dashboard." },
            new() { UserName = "operator", Password = "operator123", Role = "Fleet Operator", Description = "Akses operasional monitoring dan acknowledgement alert." },
            new() { UserName = "captain", Password = "captain123", Role = "Port Captain", Description = "Approval deviasi dan kontrol area pelabuhan." },
            new() { UserName = "viewer", Password = "viewer123", Role = "Viewer", Description = "Mode read only untuk stakeholder." }
        ];
    }
}

