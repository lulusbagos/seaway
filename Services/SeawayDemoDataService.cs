using SeaWay.Models.ViewModels;

namespace SeaWay.Services;

public class SeawayDemoDataService
{
    public DashboardViewModel GetDashboard()
    {
        return new DashboardViewModel
        {
            Kpis =
            [
                new() { Label = "Kapal Online", Value = "24", Change = "+3 sejak 06:00", ChangeTone = "positive", Icon = "bi-broadcast-pin" },
                new() { Label = "Alert Aktif", Value = "05", Change = "2 kritikal", ChangeTone = "warning", Icon = "bi-exclamation-triangle" },
                new() { Label = "Geofence Trigger", Value = "03", Change = "Selat Makassar", ChangeTone = "warning", Icon = "bi-bounding-box" },
                new() { Label = "Rata-rata Kecepatan", Value = "14.8 kn", Change = "bulk carrier mix", ChangeTone = "positive", Icon = "bi-speedometer2" }
            ],
            MapSignals =
            [
                new() { Name = "MV Ocean Crown", Status = "online", SpeedLabel = "16.2 kn", X = 28, Y = 29 },
                new() { Name = "MT Nusantara Star", Status = "warning", SpeedLabel = "12.5 kn", X = 59, Y = 48 },
                new() { Name = "KM Seaway Ranger", Status = "online", SpeedLabel = "15.9 kn", X = 76, Y = 31 },
                new() { Name = "MV Aruna Tide", Status = "alert", SpeedLabel = "0.8 kn", X = 67, Y = 68 }
            ],
            Alerts =
            [
                new() { Severity = "critical", Title = "Kapal berhenti di luar koridor", VesselName = "MV Aruna Tide", Description = "Last position dekat zona terlarang 4.2 nm dari rute normal.", OccurredAt = "08:42 WITA" },
                new() { Severity = "warning", Title = "AIS delay di atas 12 menit", VesselName = "MT Nusantara Star", Description = "Perlu validasi perangkat, sinyal terakhir masuk dari sektor timur.", OccurredAt = "08:28 WITA" },
                new() { Severity = "info", Title = "ETA berubah akibat angin samping", VesselName = "KM Seaway Ranger", Description = "Prediksi sandar mundur 18 menit dari baseline voyage plan.", OccurredAt = "07:56 WITA" }
            ],
            ActiveVessels =
            [
                new() { Name = "MV Ocean Crown", Imo = "IMO 9820341", Status = "Live", Destination = "Balikpapan Port", Speed = "16.2 kn", Heading = "124° SE", LastUpdate = "20 detik lalu" },
                new() { Name = "MT Nusantara Star", Imo = "IMO 9731194", Status = "Watch", Destination = "Samarinda Anchorage", Speed = "12.5 kn", Heading = "086° E", LastUpdate = "3 menit lalu" },
                new() { Name = "KM Seaway Ranger", Imo = "IMO 9682250", Status = "Live", Destination = "Makassar New Port", Speed = "15.9 kn", Heading = "204° SW", LastUpdate = "44 detik lalu" },
                new() { Name = "MV Aruna Tide", Imo = "IMO 9901128", Status = "Alert", Destination = "Holding Area Delta", Speed = "0.8 kn", Heading = "018° N", LastUpdate = "1 menit lalu" }
            ],
            Geofences =
            [
                new() { Name = "Makassar Pilot Zone", State = "Live", Description = "Zona approach kapal masuk pilot boarding.", VesselCount = "8 kapal" },
                new() { Name = "Coal Anchorage East", State = "Watch", Description = "Dipantau untuk dwell time dan antrian bongkar.", VesselCount = "5 kapal" },
                new() { Name = "Restricted Energy Corridor", State = "Alert", Description = "Tidak boleh ada slow drift tanpa izin supervisor.", VesselCount = "1 kapal" }
            ],
            Weather =
            [
                new() { Label = "Angin", Value = "18 kn NE" },
                new() { Label = "Gelombang", Value = "1.9 m" },
                new() { Label = "Visibilitas", Value = "9.6 nm" },
                new() { Label = "Pasang", Value = "Menuju tinggi" }
            ],
            Timeline =
            [
                new() { Time = "08:46", Title = "Playback tersimpan", Description = "Rute MV Ocean Crown 6 jam terakhir berhasil diarsipkan." },
                new() { Time = "08:30", Title = "Geofence breach", Description = "MV Aruna Tide memotong batas Restricted Energy Corridor." },
                new() { Time = "07:52", Title = "Voyage plan update", Description = "ETA KM Seaway Ranger di-refresh otomatis dari feed cuaca." }
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
                new() { Name = "MV Ocean Crown", Type = "Bulk Carrier", Status = "Live", Cargo = "Coal 68k MT", Speed = "16.2 kn", Eta = "18 Apr 14:20", LastPing = "20 detik lalu" },
                new() { Name = "MT Nusantara Star", Type = "Tanker", Status = "Watch", Cargo = "Fuel Transfer", Speed = "12.5 kn", Eta = "18 Apr 16:05", LastPing = "3 menit lalu" },
                new() { Name = "KM Seaway Ranger", Type = "Support Vessel", Status = "Live", Cargo = "Crew & Supply", Speed = "15.9 kn", Eta = "18 Apr 11:40", LastPing = "44 detik lalu" },
                new() { Name = "MV Aruna Tide", Type = "Cargo Vessel", Status = "Alert", Cargo = "Container Mixed", Speed = "0.8 kn", Eta = "On hold", LastPing = "1 menit lalu" }
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
