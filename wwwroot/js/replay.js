(() => {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const config = window.replayConfig || {};
        const mapCanvasId = "replayMapCanvas";
        const mapContainer = document.getElementById(mapCanvasId);

        if (!mapContainer || !window.L) {
            return;
        }

        // Initialize Map
        const centerLat = config.center?.lat || -2.55;
        const centerLng = config.center?.lng || 118.65;
        const defaultZoom = config.center?.zoom || 6;

        const map = L.map(mapCanvasId, {
            attributionControl: false,
            zoomControl: false,
            preferCanvas: true
        }).setView([centerLat, centerLng], defaultZoom);

        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

        // Tile Layers
        const baseLayers = {
            standard: L.tileLayer("/api/tiles/standard/{z}/{x}/{y}.png", {
                maxZoom: 19,
                zIndex: 1,
                attribution: "&copy; OpenStreetMap contributors"
            }),
            dark: L.tileLayer("/api/tiles/dark/{z}/{x}/{y}.png", {
                maxZoom: 19,
                zIndex: 1,
                attribution: "&copy; CARTO"
            }),
            satellite: L.tileLayer("/api/tiles/satellite/{z}/{x}/{y}.png", {
                maxZoom: 19,
                zIndex: 1,
                attribution: "Tiles &copy; Esri"
            })
        };

        const seamapLayer = L.tileLayer("/api/tiles/seamark/{z}/{x}/{y}.png", {
            maxZoom: 18,
            zIndex: 10,
            opacity: 1
        });

        const bathymetryLayer = L.tileLayer.wms("https://ows.emodnet-bathymetry.eu/wms", {
            layers: "emodnet:mean",
            format: "image/png",
            transparent: true,
            opacity: 0.6,
            zIndex: 5
        });

        let currentTheme = localStorage.getItem("seaway_map_theme") || "standard";
        if (!baseLayers[currentTheme]) currentTheme = "standard";
        baseLayers[currentTheme].addTo(map);
        seamapLayer.addTo(map);
        document.body.setAttribute("data-map-theme", currentTheme);

        // Theme Switchers
        document.querySelectorAll(".map-theme-opt").forEach(opt => {
            opt.addEventListener("click", (e) => {
                e.preventDefault();
                const newTheme = e.currentTarget.dataset.theme;
                if (newTheme === currentTheme || !baseLayers[newTheme]) return;
                map.removeLayer(baseLayers[currentTheme]);
                baseLayers[newTheme].addTo(map);
                currentTheme = newTheme;
                localStorage.setItem("seaway_map_theme", newTheme);
                document.body.setAttribute("data-map-theme", newTheme);
                seamapLayer.bringToFront();
            });
        });

        // Layer Groups
        const trackLayer = L.layerGroup().addTo(map);
        const arrowsLayer = L.layerGroup().addTo(map);
        const markersLayer = L.layerGroup().addTo(map);
        const playbackVesselLayer = L.layerGroup().addTo(map);
        const graticuleLayer = L.layerGroup().addTo(map);
        const lighthouseLayer = L.layerGroup().addTo(map);

        // UI DOM Elements
        const unitSelect = document.getElementById("replayUnitSelect");
        const startDateInput = document.getElementById("replayStartDate");
        const endDateInput = document.getElementById("replayEndDate");
        const btnLoadReplay = document.getElementById("btnLoadReplay");
        const loadReplayIcon = document.getElementById("loadReplayIcon");
        const btnResetReplay = document.getElementById("btnResetReplay");
        const presetPills = document.querySelectorAll(".preset-pill");

        // HUD Elements
        const hudVesselName = document.getElementById("hudVesselName");
        const hudVesselStatus = document.getElementById("hudVesselStatus");
        const hudSpeedValue = document.getElementById("hudSpeedValue");
        const hudSpeedKmh = document.getElementById("hudSpeedKmh");
        const hudCompassNeedle = document.getElementById("hudCompassNeedle");
        const hudHeadingValue = document.getElementById("hudHeadingValue");
        const hudHeadingCompass = document.getElementById("hudHeadingCompass");
        const hudHeadingDesc = document.getElementById("hudHeadingDesc");
        const hudCoordinates = document.getElementById("hudCoordinates");
        const hudTimestamp = document.getElementById("hudTimestamp");
        const hudTotalDistance = document.getElementById("hudTotalDistance");
        const hudMaxSpeed = document.getElementById("hudMaxSpeed");
        const hudPointCount = document.getElementById("hudPointCount");

        // Playback Controller Elements
        const replayTimeSlider = document.getElementById("replayTimeSlider");
        const scrubberProgressFill = document.getElementById("scrubberProgressFill");
        const playbackTimeCurrent = document.getElementById("playbackTimeCurrent");
        const playbackProgressPercent = document.getElementById("playbackProgressPercent");
        const playbackTimeTotal = document.getElementById("playbackTimeTotal");
        const btnPlaybackPlay = document.getElementById("btnPlaybackPlay");
        const deckPlayIcon = document.getElementById("deckPlayIcon");
        const btnPlaybackStop = document.getElementById("btnPlaybackStop");
        const btnPlaybackStepBack = document.getElementById("btnPlaybackStepBack");
        const btnPlaybackStepForward = document.getElementById("btnPlaybackStepForward");
        const btnToggleFollowShip = document.getElementById("btnToggleFollowShip");
        const btnToggleLoop = document.getElementById("btnToggleLoop");
        const speedPills = document.querySelectorAll(".speed-pill");

        // Drawer Elements
        const btnToggleWaypointDrawer = document.getElementById("btnToggleWaypointDrawer");
        const btnCloseWaypointDrawer = document.getElementById("btnCloseWaypointDrawer");
        const replayWaypointDrawer = document.getElementById("replayWaypointDrawer");
        const waypointListContainer = document.getElementById("waypointListContainer");
        const drawerCountBadge = document.getElementById("drawerCountBadge");
        const drawerEmptyNotice = document.getElementById("drawerEmptyNotice");

        // State variables
        let loadedTracks = [];
        let isPlaying = false;
        let playbackProgress = 0; // 0 to 1
        let playbackSpeed = 1; // 1x, 2x, 5x, 10x, 25x
        let followShip = true;
        let autoLoop = false;
        let animFrameId = null;
        let lastFrameTime = 0;
        const BASE_ANIM_DURATION_MS = 25000; // Base run duration at 1x speed for whole route

        // Utility: Haversine distance in Nautical Miles
        const haversineDistanceNm = (lat1, lon1, lat2, lon2) => {
            const R = 3440.065; // Nautical miles radius of Earth
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        const degreesToCompass = (deg) => {
            if (!Number.isFinite(deg)) return { dir: "N", desc: "Utara" };
            const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
            const descs = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"];
            const idx = Math.round(((deg % 360) / 45)) % 8;
            return { dir: directions[idx], desc: descs[idx] };
        };

        const formatDms = (lat, lng) => {
            const formatOne = (val, isLat) => {
                const abs = Math.abs(val);
                const d = Math.floor(abs);
                const m = Math.floor((abs - d) * 60);
                const s = Math.round(((abs - d) * 60 - m) * 60);
                const dir = isLat ? (val >= 0 ? "N" : "S") : (val >= 0 ? "E" : "W");
                return `${String(d).padStart(2, "0")}° ${String(m).padStart(2, "0")}' ${String(s).padStart(2, "0")}" ${dir}`;
            };
            return `${formatOne(lat, true)} &middot; ${formatOne(lng, false)}`;
        };

        const formatDateTime = (dateObj) => {
            if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return "-";
            const pad = (n) => String(n).padStart(2, "0");
            const d = pad(dateObj.getDate());
            const m = pad(dateObj.getMonth() + 1);
            const y = dateObj.getFullYear();
            const hh = pad(dateObj.getHours());
            const mm = pad(dateObj.getMinutes());
            const ss = pad(dateObj.getSeconds());
            return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
        };

        // Build Custom Ship Icon with dynamic heading
        const createReplayShipIcon = (name, heading = 0) => {
            return L.divIcon({
                className: "replay-vessel-marker-container",
                html: `
                    <div class="replay-vessel-marker-wrapper" style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
                        <div class="replay-vessel-pulse"></div>
                        <img src="/icon/1.png" class="replay-vessel-image" style="width: 32px; height: 32px; object-fit: contain; transform: rotate(${heading}deg); filter: drop-shadow(0 0 8px rgba(0,240,255,0.8)); pointer-events: none;" alt="Vessel" />
                        <div class="replay-vessel-label" style="position: absolute; top: 100%; left: 50%; transform: translateX(-50%); background: rgba(15,23,42,0.9); color: #00f0ff; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0,240,255,0.4); white-space: nowrap; pointer-events: none; margin-top: 2px;">
                            ${name}
                        </div>
                    </div>
                `,
                iconSize: [44, 44],
                iconAnchor: [22, 22]
            });
        };

        // Draw Graticule
        const drawGraticule = () => {
            if (!map.hasLayer(graticuleLayer)) return;
            graticuleLayer.clearLayers();
            const bounds = map.getBounds();
            const zoom = map.getZoom();

            let interval = 10;
            if (zoom >= 14) interval = 1/60;
            else if (zoom >= 12) interval = 5/60;
            else if (zoom >= 10) interval = 1/6;
            else if (zoom >= 8) interval = 0.5;
            else if (zoom >= 6) interval = 1;
            else if (zoom >= 4) interval = 5;

            const formatCoord = (val, isLat) => {
                const absVal = Math.abs(val);
                const deg = Math.floor(absVal);
                const min = Math.round((absVal - deg) * 60);
                const dir = isLat ? (val >= 0 ? "N" : "S") : (val >= 0 ? "E" : "W");
                return `${deg}° ${min.toString().padStart(2, "0")}' ${dir}`;
            };

            const lineStyle = {
                color: "rgba(79, 195, 247, 0.35)",
                weight: 1,
                dashArray: "4 6",
                interactive: false
            };

            const startLat = Math.floor(bounds.getSouth() / interval) * interval;
            const endLat = Math.ceil(bounds.getNorth() / interval) * interval;
            const startLng = Math.floor(bounds.getWest() / interval) * interval;
            const endLng = Math.ceil(bounds.getEast() / interval) * interval;

            for (let lat = startLat; lat <= endLat; lat += interval) {
                if (lat < -90 || lat > 90) continue;
                L.polyline([[lat, startLng], [lat, endLng]], lineStyle).addTo(graticuleLayer);
                L.marker([lat, bounds.getWest()], {
                    icon: L.divIcon({
                        className: "graticule-label",
                        html: `<div style="padding-left: 12px; margin-top: -8px; color: rgba(79,195,247,0.8); font-size: 10px; font-family: monospace;">${formatCoord(lat, true)}</div>`,
                        iconSize: [80, 20],
                        iconAnchor: [0, 0]
                    }),
                    interactive: false
                }).addTo(graticuleLayer);
            }

            for (let lng = startLng; lng <= endLng; lng += interval) {
                L.polyline([[startLat, lng], [endLat, lng]], lineStyle).addTo(graticuleLayer);
                let wrappedLng = ((lng + 180) % 360 + 360) % 360 - 180;
                L.marker([bounds.getSouth(), lng], {
                    icon: L.divIcon({
                        className: "graticule-label",
                        html: `<div style="padding-bottom: 8px; color: rgba(79,195,247,0.8); font-size: 10px; font-family: monospace;">${formatCoord(wrappedLng, false)}</div>`,
                        iconSize: [80, 30],
                        iconAnchor: [40, 30]
                    }),
                    interactive: false
                }).addTo(graticuleLayer);
            }
        };

        map.on("moveend", drawGraticule);
        drawGraticule();

        // Load History Tracks from API
        const loadHistoryTracks = async () => {
            const unitCode = unitSelect?.value || "all";
            const start = startDateInput?.value || "";
            const end = endDateInput?.value || "";

            if (loadReplayIcon) {
                loadReplayIcon.className = "spinner-border spinner-border-sm me-1";
            }
            if (btnLoadReplay) btnLoadReplay.disabled = true;

            // Stop any ongoing playback
            stopPlayback();

            // Clear layers
            trackLayer.clearLayers();
            arrowsLayer.clearLayers();
            markersLayer.clearLayers();
            playbackVesselLayer.clearLayers();
            loadedTracks = [];

            try {
                let url = `${config.historyApi || "/api/history-tracks"}?`;
                const params = new URLSearchParams();
                if (start) params.append("start", start);
                if (end) params.append("end", end);
                if (unitCode && unitCode !== "all") params.append("unitCode", unitCode);
                url += params.toString();

                const res = await fetch(url, { headers: { Accept: "application/json" } });
                if (!res.ok) throw new Error("Gagal mengambil data histori track");

                const trackData = await res.json();
                const list = Array.isArray(trackData) ? trackData : [];

                if (list.length === 0) {
                    if (waypointListContainer) {
                        waypointListContainer.innerHTML = `
                            <div class="text-center text-muted p-4 small">
                                <i class="bi bi-info-circle text-warning fs-4 d-block mb-2"></i>
                                Tidak ada data histori lintasan yang ditemukan untuk periode ini.
                            </div>
                        `;
                    }
                    if (drawerCountBadge) drawerCountBadge.textContent = "0";
                    resetHud();
                    return;
                }

                const allBounds = L.latLngBounds([]);
                let totalWaypointsCount = 0;

                list.forEach((trackItem, index) => {
                    const points = Array.isArray(trackItem.points) ? trackItem.points : [];
                    if (points.length === 0) return;

                    totalWaypointsCount += points.length;

                    // Parse point timestamps and cumulative distances
                    let cumDistNm = 0;
                    let maxSpeed = 0;
                    let speedSum = 0;

                    const enrichedPoints = points.map((p, pIdx) => {
                        const recDate = new Date(p.recordedAt);
                        const speed = Number(p.speedKnots) || 0;
                        const heading = Number(p.headingDeg) || 0;
                        if (speed > maxSpeed) maxSpeed = speed;
                        speedSum += speed;

                        if (pIdx > 0) {
                            const prev = points[pIdx - 1];
                            cumDistNm += haversineDistanceNm(prev.latitude, prev.longitude, p.latitude, p.longitude);
                        }

                        return {
                            lat: p.latitude,
                            lng: p.longitude,
                            speedKnots: speed,
                            headingDeg: heading,
                            recordedAt: recDate,
                            timeLabel: p.timeLabel || formatDateTime(recDate),
                            distanceNm: cumDistNm
                        };
                    });

                    const avgSpeed = points.length > 0 ? (speedSum / points.length) : 0;
                    const latLngs = enrichedPoints.map(p => [p.lat, p.lng]);
                    latLngs.forEach(ll => allBounds.extend(ll));

                    // Generate distinct glow color per vessel
                    const colors = ["#00f0ff", "#38bdf8", "#34d399", "#fbbf24", "#f43f5e", "#a855f7"];
                    const routeColor = colors[index % colors.length];

                    // Outer glowing shadow polyline
                    L.polyline(latLngs, {
                        color: routeColor,
                        weight: 7,
                        opacity: 0.35,
                        lineCap: "round",
                        lineJoin: "round",
                        interactive: false
                    }).addTo(trackLayer);

                    // Core sharp polyline
                    const mainPolyline = L.polyline(latLngs, {
                        color: routeColor,
                        weight: 3.5,
                        opacity: 0.95,
                        lineCap: "round",
                        lineJoin: "round"
                    }).addTo(trackLayer);

                    // Directional Arrows along path
                    for (let i = 0; i < latLngs.length - 1; i += Math.max(1, Math.floor(latLngs.length / 15))) {
                        const p1 = latLngs[i];
                        const p2 = latLngs[i + 1];
                        const dy = p2[0] - p1[0];
                        const dx = Math.cos(Math.PI / 180 * p1[0]) * (p2[1] - p1[1]);
                        const angle = Math.atan2(dx, dy) * 180 / Math.PI;

                        const midLat = (p1[0] + p2[0]) / 2;
                        const midLng = (p1[1] + p2[1]) / 2;

                        L.marker([midLat, midLng], {
                            icon: L.divIcon({
                                className: "route-arrow-icon",
                                html: `<i class="bi bi-chevron-right" style="color: ${routeColor}; font-size: 13px; font-weight: 900; display: inline-block; transform: rotate(${angle - 90}deg); text-shadow: 0 0 4px #0f172a;"></i>`,
                                iconSize: [16, 16],
                                iconAnchor: [8, 8]
                            }),
                            interactive: false
                        }).addTo(arrowsLayer);
                    }

                    // Start Waypoint Marker (🚩 Keberangkatan)
                    const startPoint = enrichedPoints[0];
                    const startMarker = L.marker([startPoint.lat, startPoint.lng], {
                        icon: L.divIcon({
                            className: "waypoint-pin-marker start",
                            html: `<div style="background: #10b981; color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 0 12px #10b981; font-size: 12px;"><i class="bi bi-flag-fill"></i></div>`,
                            iconSize: [26, 26],
                            iconAnchor: [13, 13]
                        })
                    }).addTo(markersLayer);

                    startMarker.bindPopup(`
                        <div class="p-1" style="font-size: 0.8rem; line-height: 1.4;">
                            <strong style="color: #10b981;"><i class="bi bi-flag-fill"></i> Titik Awal Keberangkatan</strong><br/>
                            <b>Kapal:</b> ${trackItem.unitName}<br/>
                            <b>Waktu:</b> ${formatDateTime(startPoint.recordedAt)}<br/>
                            <b>Kecepatan:</b> ${startPoint.speedKnots.toFixed(1)} Knot &middot; <b>Haluan:</b> ${startPoint.headingDeg}°
                        </div>
                    `);

                    // End Waypoint Marker (🏁 Posisi Terkini / Akhir)
                    const endPoint = enrichedPoints[enrichedPoints.length - 1];
                    const endMarker = L.marker([endPoint.lat, endPoint.lng], {
                        icon: L.divIcon({
                            className: "waypoint-pin-marker end",
                            html: `<div style="background: #ef4444; color: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 0 12px #ef4444; font-size: 12px;"><i class="bi bi-geo-alt-fill"></i></div>`,
                            iconSize: [26, 26],
                            iconAnchor: [13, 13]
                        })
                    }).addTo(markersLayer);

                    endMarker.bindPopup(`
                        <div class="p-1" style="font-size: 0.8rem; line-height: 1.4;">
                            <strong style="color: #ef4444;"><i class="bi bi-geo-alt-fill"></i> Titik Terkini / Akhir</strong><br/>
                            <b>Kapal:</b> ${trackItem.unitName}<br/>
                            <b>Waktu:</b> ${formatDateTime(endPoint.recordedAt)}<br/>
                            <b>Total Jarak:</b> ${cumDistNm.toFixed(1)} NM &middot; <b>Kecepatan:</b> ${endPoint.speedKnots.toFixed(1)} Knot
                        </div>
                    `);

                    // Animated Ship Marker for Playback
                    const animatedMarker = L.marker([startPoint.lat, startPoint.lng], {
                        icon: createReplayShipIcon(trackItem.unitName, startPoint.headingDeg),
                        zIndexOffset: 1500
                    }).addTo(playbackVesselLayer);

                    loadedTracks.push({
                        unitCode: trackItem.unitCode,
                        unitName: trackItem.unitName,
                        points: enrichedPoints,
                        totalDistanceNm: cumDistNm,
                        maxSpeedKnots: maxSpeed,
                        avgSpeedKnots: avgSpeed,
                        color: routeColor,
                        animatedMarker: animatedMarker,
                        polyline: mainPolyline
                    });
                });

                if (drawerCountBadge) drawerCountBadge.textContent = String(totalWaypointsCount);

                // Populate Waypoint Drawer List
                populateWaypointDrawer();

                // Fit Map Bounds
                if (allBounds.isValid()) {
                    map.fitBounds(allBounds, { padding: [60, 60], maxZoom: 14 });
                }

                // Initialize HUD to first track and first point
                playbackProgress = 0;
                updatePlaybackPosition(0);

            } catch (err) {
                console.error("Failed to load replay history tracks:", err);
                alert("Gagal memuat lintasan riwayat kapal. Pastikan server terhubung.");
            } finally {
                if (loadReplayIcon) loadReplayIcon.className = "bi bi-search me-1";
                if (btnLoadReplay) btnLoadReplay.disabled = false;
            }
        };

        // Reset HUD values
        const resetHud = () => {
            if (hudVesselName) hudVesselName.textContent = "-";
            if (hudSpeedValue) hudSpeedValue.textContent = "0.0";
            if (hudSpeedKmh) hudSpeedKmh.textContent = "0.0 km/h";
            if (hudHeadingValue) hudHeadingValue.textContent = "0°";
            if (hudHeadingCompass) hudHeadingCompass.textContent = "N";
            if (hudHeadingDesc) hudHeadingDesc.textContent = "Utara";
            if (hudCoordinates) hudCoordinates.textContent = "-";
            if (hudTimestamp) hudTimestamp.textContent = "-";
            if (hudTotalDistance) hudTotalDistance.textContent = "0.0 NM";
            if (hudMaxSpeed) hudMaxSpeed.textContent = "0.0 Knots";
            if (hudPointCount) hudPointCount.textContent = "0 / 0";
            if (playbackTimeCurrent) playbackTimeCurrent.textContent = "--:--:--";
            if (playbackProgressPercent) playbackProgressPercent.textContent = "0%";
            if (playbackTimeTotal) playbackTimeTotal.textContent = "Total: 0 jam";
            if (replayTimeSlider) replayTimeSlider.value = "0";
            if (scrubberProgressFill) scrubberProgressFill.style.width = "0%";
        };

        // Populate Drawer with Waypoint items
        const populateWaypointDrawer = () => {
            if (!waypointListContainer) return;
            if (loadedTracks.length === 0) {
                waypointListContainer.innerHTML = `
                    <div class="text-center text-muted p-4 small">
                        Belum ada data rute yang dimuat.
                    </div>
                `;
                return;
            }

            let html = "";
            loadedTracks.forEach((track) => {
                html += `
                    <div class="drawer-track-section mb-3">
                        <div class="d-flex align-items-center justify-content-between p-2 rounded mb-1" style="background: rgba(0,240,255,0.1); border: 1px solid rgba(0,240,255,0.2);">
                            <span class="fw-bold" style="color: #00f0ff; font-size: 0.85rem;"><i class="bi bi-ship me-1"></i> ${track.unitName}</span>
                            <span class="badge bg-dark text-info">${track.points.length} Titik</span>
                        </div>
                        <div class="waypoint-items-list" style="display: flex; flex-direction: column; gap: 4px;">
                `;

                track.points.forEach((pt, pIdx) => {
                    const ratio = track.points.length > 1 ? (pIdx / (track.points.length - 1)) : 0;
                    html += `
                        <div class="waypoint-item-row p-2 rounded text-white" data-ratio="${ratio.toFixed(4)}" style="background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.06); cursor: pointer; font-size: 0.75rem; transition: background 0.15s ease;">
                            <div class="d-flex justify-content-between">
                                <span class="fw-bold text-info"><i class="bi bi-geo-alt me-1"></i> #${pIdx + 1} &middot; ${pt.timeLabel}</span>
                                <span class="badge bg-secondary">${pt.speedKnots.toFixed(1)} Knots</span>
                            </div>
                            <div class="d-flex justify-content-between text-muted mt-1" style="font-size: 0.7rem;">
                                <span>${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}</span>
                                <span>Haluan: ${pt.headingDeg}° &middot; ${pt.distanceNm.toFixed(1)} NM</span>
                            </div>
                        </div>
                    `;
                });

                html += `</div></div>`;
            });

            waypointListContainer.innerHTML = html;

            // Add click listeners to rows
            waypointListContainer.querySelectorAll(".waypoint-item-row").forEach(row => {
                row.addEventListener("click", () => {
                    const ratio = parseFloat(row.dataset.ratio) || 0;
                    playbackProgress = ratio;
                    updatePlaybackPosition(ratio);
                });
            });
        };

        // Update animated position and HUD based on progress (0 to 1)
        const updatePlaybackPosition = (progress) => {
            if (loadedTracks.length === 0) return;

            const clampedProgress = Math.max(0, Math.min(1, progress));
            const percent = (clampedProgress * 100).toFixed(1);

            if (replayTimeSlider) replayTimeSlider.value = String(clampedProgress * 100);
            if (scrubberProgressFill) scrubberProgressFill.style.width = `${percent}%`;
            if (playbackProgressPercent) playbackProgressPercent.textContent = `${percent}%`;

            let leadVesselPos = null;

            loadedTracks.forEach((track, tIdx) => {
                const pts = track.points;
                if (pts.length === 0) return;

                const floatIdx = clampedProgress * (pts.length - 1);
                const idx1 = Math.floor(floatIdx);
                const idx2 = Math.min(pts.length - 1, Math.ceil(floatIdx));
                const ratio = floatIdx - idx1;

                const p1 = pts[idx1];
                const p2 = pts[idx2] || p1;

                // Interpolated position
                const currentLat = p1.lat + (p2.lat - p1.lat) * ratio;
                const currentLng = p1.lng + (p2.lng - p1.lng) * ratio;
                const currentSpeed = p1.speedKnots + (p2.speedKnots - p1.speedKnots) * ratio;
                const currentDist = p1.distanceNm + (p2.distanceNm - p1.distanceNm) * ratio;

                // Dynamic heading calculation
                let heading = p1.headingDeg;
                if (p2.lat !== p1.lat || p2.lng !== p1.lng) {
                    const dy = p2.lat - p1.lat;
                    const dx = Math.cos(Math.PI / 180 * p1.lat) * (p2.lng - p1.lng);
                    heading = Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360);
                }

                // Interpolated time
                const time1 = p1.recordedAt.getTime();
                const time2 = p2.recordedAt.getTime();
                const currentTimestamp = new Date(time1 + (time2 - time1) * ratio);

                // Update marker position & rotation
                if (track.animatedMarker) {
                    track.animatedMarker.setLatLng([currentLat, currentLng]);
                    const el = track.animatedMarker.getElement();
                    if (el) {
                        const img = el.querySelector(".replay-vessel-image");
                        if (img) img.style.transform = `rotate(${heading}deg)`;
                    }
                }

                if (tIdx === 0) {
                    leadVesselPos = [currentLat, currentLng];

                    // Update HUD with lead vessel
                    if (hudVesselName) hudVesselName.textContent = track.unitName;
                    if (hudSpeedValue) hudSpeedValue.textContent = currentSpeed.toFixed(1);
                    if (hudSpeedKmh) hudSpeedKmh.textContent = `${(currentSpeed * 1.852).toFixed(1)} km/h`;
                    if (hudHeadingValue) hudHeadingValue.textContent = `${heading}°`;

                    const compassInfo = degreesToCompass(heading);
                    if (hudHeadingCompass) hudHeadingCompass.textContent = compassInfo.dir;
                    if (hudHeadingDesc) hudHeadingDesc.textContent = compassInfo.desc;
                    if (hudCompassNeedle) hudCompassNeedle.style.transform = `rotate(${heading}deg)`;

                    if (hudCoordinates) hudCoordinates.innerHTML = formatDms(currentLat, currentLng);
                    if (hudTimestamp) hudTimestamp.textContent = formatDateTime(currentTimestamp);
                    if (hudTotalDistance) hudTotalDistance.textContent = `${currentDist.toFixed(1)} NM`;
                    if (hudMaxSpeed) hudMaxSpeed.textContent = `${track.maxSpeedKnots.toFixed(1)} Knots`;
                    if (hudPointCount) hudPointCount.textContent = `${idx1 + 1} / ${pts.length}`;

                    if (playbackTimeCurrent) playbackTimeCurrent.textContent = formatDateTime(currentTimestamp);

                    if (pts.length > 1) {
                        const totalHours = (pts[pts.length - 1].recordedAt.getTime() - pts[0].recordedAt.getTime()) / (1000 * 3600);
                        if (playbackTimeTotal) playbackTimeTotal.textContent = `Total: ${totalHours.toFixed(1)} jam`;
                    }
                }
            });

            // Follow ship panning
            if (followShip && leadVesselPos && isPlaying) {
                map.panTo(leadVesselPos, { animate: true, duration: 0.25 });
            }
        };

        // Animation Loop
        const animationStep = (time) => {
            if (!isPlaying) return;

            if (!lastFrameTime) lastFrameTime = time;
            const delta = time - lastFrameTime;
            lastFrameTime = time;

            // Increment progress based on speed
            const stepRatio = (delta / BASE_ANIM_DURATION_MS) * playbackSpeed;
            playbackProgress += stepRatio;

            if (playbackProgress >= 1) {
                if (autoLoop) {
                    playbackProgress = 0;
                    updatePlaybackPosition(0);
                    animFrameId = requestAnimationFrame(animationStep);
                } else {
                    playbackProgress = 1;
                    updatePlaybackPosition(1);
                    stopPlayback();
                }
                return;
            }

            updatePlaybackPosition(playbackProgress);
            animFrameId = requestAnimationFrame(animationStep);
        };

        const startPlayback = () => {
            if (loadedTracks.length === 0) return;
            if (playbackProgress >= 1) playbackProgress = 0;

            isPlaying = true;
            lastFrameTime = 0;
            if (deckPlayIcon) deckPlayIcon.className = "bi bi-pause-fill";
            if (btnPlaybackPlay) {
                btnPlaybackPlay.classList.add("is-playing");
                btnPlaybackPlay.title = "Jeda Simulasi (Spasi)";
            }
            animFrameId = requestAnimationFrame(animationStep);
        };

        const pausePlayback = () => {
            isPlaying = false;
            if (animFrameId) cancelAnimationFrame(animFrameId);
            if (deckPlayIcon) deckPlayIcon.className = "bi bi-play-fill";
            if (btnPlaybackPlay) {
                btnPlaybackPlay.classList.remove("is-playing");
                btnPlaybackPlay.title = "Putar Simulasi (Spasi)";
            }
        };

        const stopPlayback = () => {
            pausePlayback();
            playbackProgress = 0;
            updatePlaybackPosition(0);
        };

        // Scrubber Dragging
        if (replayTimeSlider) {
            replayTimeSlider.addEventListener("input", () => {
                const val = parseFloat(replayTimeSlider.value) || 0;
                playbackProgress = val / 100;
                updatePlaybackPosition(playbackProgress);
            });
        }

        // Transport Controls
        btnPlaybackPlay?.addEventListener("click", () => {
            if (isPlaying) pausePlayback();
            else startPlayback();
        });

        btnPlaybackStop?.addEventListener("click", stopPlayback);

        btnPlaybackStepBack?.addEventListener("click", () => {
            pausePlayback();
            playbackProgress = Math.max(0, playbackProgress - 0.05);
            updatePlaybackPosition(playbackProgress);
        });

        btnPlaybackStepForward?.addEventListener("click", () => {
            pausePlayback();
            playbackProgress = Math.min(1, playbackProgress + 0.05);
            updatePlaybackPosition(playbackProgress);
        });

        // Speed Multipliers
        speedPills.forEach(pill => {
            pill.addEventListener("click", () => {
                speedPills.forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                playbackSpeed = parseFloat(pill.dataset.speed) || 1;
            });
        });

        // Follow Ship & Loop Toggles
        btnToggleFollowShip?.addEventListener("click", () => {
            followShip = !followShip;
            btnToggleFollowShip.classList.toggle("active", followShip);
        });

        btnToggleLoop?.addEventListener("click", () => {
            autoLoop = !autoLoop;
            btnToggleLoop.classList.toggle("active", autoLoop);
        });

        // Presets (6h, 12h, 24h, 3d, 7d, 30d, all)
        presetPills.forEach(pill => {
            pill.addEventListener("click", () => {
                presetPills.forEach(p => p.classList.remove("active"));
                pill.classList.add("active");

                const hoursAttr = pill.dataset.hours;
                const now = new Date();

                const formatDate = (d) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    return `${y}-${m}-${day}`;
                };

                if (hoursAttr === "all") {
                    if (startDateInput) startDateInput.value = "2020-01-01";
                    if (endDateInput) endDateInput.value = formatDate(now);
                } else {
                    const hours = parseInt(hoursAttr, 10) || 24;
                    const past = new Date(now.getTime() - hours * 3600 * 1000);
                    if (startDateInput) startDateInput.value = formatDate(past);
                    if (endDateInput) endDateInput.value = formatDate(now);
                }

                loadHistoryTracks();
            });
        });

        // Layer Toggles
        document.querySelectorAll("[data-replay-layer]").forEach(button => {
            button.addEventListener("click", () => {
                const layerKey = button.getAttribute("data-replay-layer");
                let targetLayer = null;

                if (layerKey === "track") targetLayer = trackLayer;
                else if (layerKey === "arrows") targetLayer = arrowsLayer;
                else if (layerKey === "bathymetry") targetLayer = bathymetryLayer;
                else if (layerKey === "graticule") targetLayer = graticuleLayer;
                else if (layerKey === "lighthouse") targetLayer = lighthouseLayer;

                if (!targetLayer) return;

                if (map.hasLayer(targetLayer)) {
                    map.removeLayer(targetLayer);
                    button.classList.remove("active");
                } else {
                    map.addLayer(targetLayer);
                    button.classList.add("active");
                }
            });
        });

        // Search & Reset
        btnLoadReplay?.addEventListener("click", loadHistoryTracks);

        btnResetReplay?.addEventListener("click", () => {
            const now = new Date();
            const past = new Date(now.getTime() - 24 * 3600 * 1000);
            const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            if (startDateInput) startDateInput.value = formatDate(past);
            if (endDateInput) endDateInput.value = formatDate(now);
            if (unitSelect) unitSelect.value = "all";
            loadHistoryTracks();
        });

        unitSelect?.addEventListener("change", loadHistoryTracks);

        // Drawer Toggle
        btnToggleWaypointDrawer?.addEventListener("click", () => {
            replayWaypointDrawer?.classList.toggle("is-open");
        });

        btnCloseWaypointDrawer?.addEventListener("click", () => {
            replayWaypointDrawer?.classList.remove("is-open");
        });

        // Fullscreen Toggle
        const btnToggleReplayFullscreen = document.getElementById("btnToggleReplayFullscreen");
        const replayStagePanel = document.getElementById("replayStagePanel");
        btnToggleReplayFullscreen?.addEventListener("click", () => {
            if (!document.fullscreenElement) {
                replayStagePanel?.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
        });

        // Keyboard Shortcuts
        document.addEventListener("keydown", (e) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

            if (e.code === "Space") {
                e.preventDefault();
                if (isPlaying) pausePlayback();
                else startPlayback();
            } else if (e.code === "ArrowLeft") {
                e.preventDefault();
                pausePlayback();
                playbackProgress = Math.max(0, playbackProgress - 0.02);
                updatePlaybackPosition(playbackProgress);
            } else if (e.code === "ArrowRight") {
                e.preventDefault();
                pausePlayback();
                playbackProgress = Math.min(1, playbackProgress + 0.02);
                updatePlaybackPosition(playbackProgress);
            }
        });

        // Initial Load
        loadHistoryTracks();
    });
})();
