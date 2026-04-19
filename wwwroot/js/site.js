(() => {
    const shell = document.getElementById("layoutShell");
    const openButton = document.querySelector("[data-sidebar-open]");
    const closeButtons = document.querySelectorAll("[data-sidebar-close]");

    openButton?.addEventListener("click", () => shell?.classList.add("is-sidebar-open"));
    closeButtons.forEach((button) =>
        button.addEventListener("click", () => shell?.classList.remove("is-sidebar-open")));

    const authHero = document.querySelector(".auth-hero");
    if (authHero) {
        let rafId = 0;

        const resetHeroTilt = () => {
            authHero.style.setProperty("--hero-tilt-x", "0px");
            authHero.style.setProperty("--hero-tilt-y", "0px");
        };

        authHero.addEventListener("pointermove", (event) => {
            const rect = authHero.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width - 0.5) * 18;
            const y = ((event.clientY - rect.top) / rect.height - 0.5) * 18;

            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                authHero.style.setProperty("--hero-tilt-x", `${x.toFixed(2)}px`);
                authHero.style.setProperty("--hero-tilt-y", `${y.toFixed(2)}px`);
            });
        });

        authHero.addEventListener("pointerleave", resetHeroTilt);
        authHero.addEventListener("blur", resetHeroTilt, true);
    }

    const authLoginForm = document.querySelector(".auth-login-form");
    if (authLoginForm instanceof HTMLFormElement) {
        let isLoading = false;

        authLoginForm.addEventListener("submit", (event) => {
            if (isLoading) {
                return;
            }

            if (!authLoginForm.reportValidity()) {
                return;
            }

            event.preventDefault();
            isLoading = true;
            authLoginForm.classList.add("is-loading");
            authLoginForm.closest(".auth-panel")?.classList.add("is-loading");

            const submitButton = authLoginForm.querySelector(".submit-button");
            if (submitButton instanceof HTMLButtonElement) {
                submitButton.disabled = true;
            }

            window.setTimeout(() => {
                HTMLFormElement.prototype.submit.call(authLoginForm);
            }, 650);
        });
    }

    const transitionOverlay = document.getElementById("pageTransitionOverlay");
    if (transitionOverlay?.classList.contains("is-visible")) {
        window.setTimeout(() => {
            transitionOverlay.classList.remove("is-visible");
            const url = new URL(window.location.href);
            if (url.searchParams.has("boot")) {
                url.searchParams.delete("boot");
                window.history.replaceState({}, "", url.toString());
            }
        }, 1400);
    }

    window.initializeSeaWayMap = (containerId, mapData) => {
        if (!window.L || !containerId || !mapData) {
            return;
        }

        const container = document.getElementById(containerId);
        if (!container || container._leaflet_id) {
            return;
        }

        const center = mapData.center ?? {};
        const signals = Array.isArray(mapData.signals) ? mapData.signals : [];
        const zones = Array.isArray(mapData.zones) ? mapData.zones : [];
        const depthBands = Array.isArray(mapData.depthBands) ? mapData.depthBands : [];
        const harbours = Array.isArray(mapData.harbours) ? mapData.harbours : [];
        const weatherVectors = Array.isArray(mapData.weatherVectors) ? mapData.weatherVectors : [];
        const liveUnitSeed = mapData.liveUnit ?? null;
        const liveUnitApi = mapData.liveUnitApi || "/api/unit-status";
        const assetBase = "/image";
        const seedLat = liveUnitSeed && typeof liveUnitSeed.latitude === "number" ? liveUnitSeed.latitude : Number(center.lat);
        const seedLng = liveUnitSeed && typeof liveUnitSeed.longitude === "number" ? liveUnitSeed.longitude : Number(center.lng);
        const lat = Number.isFinite(seedLat) ? seedLat : -2.55;
        const lng = Number.isFinite(seedLng) ? seedLng : 118.65;
        const zoom = liveUnitSeed ? 13 : (Number(center.zoom) || 6);

        const map = L.map(containerId, {
            zoomControl: false,
            preferCanvas: true
        }).setView([lat, lng], zoom);

        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }).addTo(map);

        L.tileLayer("https://t1.openseamap.org/seamark/{z}/{x}/{y}.png", {
            maxZoom: 18,
            opacity: 0.85,
            attribution: "Sea map overlay &copy; OpenSeaMap contributors"
        }).addTo(map);

        const depthLayer = L.layerGroup();
        const harbourLayer = L.layerGroup();
        const weatherLayer = L.layerGroup();
        const aisTrailLayer = L.layerGroup();
        const vesselLayer = typeof L.markerClusterGroup === "function"
            ? L.markerClusterGroup({
                showCoverageOnHover: false,
                spiderfyOnMaxZoom: true,
                disableClusteringAtZoom: 12
            })
            : L.layerGroup();
        const liveUnitLayer = L.layerGroup().addTo(map);
        const liveTrailLayer = L.layerGroup().addTo(map);
        const vesselCameraModalEl = document.getElementById("vesselCameraModal");
        const vesselCameraModal = vesselCameraModalEl && window.bootstrap?.Modal
            ? new window.bootstrap.Modal(vesselCameraModalEl)
            : null;
        const vesselCameraFields = {
            title: document.getElementById("vesselCameraTitle"),
            meta: document.getElementById("vesselCameraMeta"),
            portrait: document.getElementById("vesselCameraPortrait"),
            unitKind: document.getElementById("vesselCameraUnitKind"),
            frame: document.getElementById("vesselCameraFrame"),
            locationStatus: document.getElementById("vesselCameraLocationStatus"),
            locationNote: document.getElementById("vesselCameraLocationNote"),
            rawCoordinates: document.getElementById("vesselCameraRawCoordinates"),
            decimalCoordinates: document.getElementById("vesselCameraDecimalCoordinates"),
            telemetry: document.getElementById("vesselCameraTelemetry"),
            unitCode: document.getElementById("vesselCameraUnitCode"),
            deviceId: document.getElementById("vesselCameraDeviceId"),
            unitDetail: document.getElementById("vesselCameraUnitDetail"),
            playbackSlider: document.getElementById("vesselPlaybackSlider"),
            playbackPoint: document.getElementById("vesselPlaybackPoint"),
            playbackTime: document.getElementById("vesselPlaybackTime"),
            name: document.getElementById("vesselCameraName"),
            status: document.getElementById("vesselCameraStatus"),
            speed: document.getElementById("vesselCameraSpeed"),
            heading: document.getElementById("vesselCameraHeading")
        };
        const selectedTrailLayer = L.layerGroup().addTo(map);
        let liveUnitHistory = [];
        let liveUnitFocused = false;
        let liveUnitUserMoved = false;
        let currentSignal = null;

        map.on("dragstart zoomstart", () => {
            liveUnitUserMoved = true;
        });

        const renderPlaybackTrail = (signal, pointIndex) => {
            selectedTrailLayer.clearLayers();

            const trail = Array.isArray(signal?.trail)
                ? signal.trail
                    .map((point) => ({
                        lat: typeof point.lat === "number" ? point.lat : point.latitude,
                        lng: typeof point.lng === "number" ? point.lng : point.longitude,
                        label: point.label || point.time || ""
                    }))
                    .filter((point) => typeof point.lat === "number" && typeof point.lng === "number")
                : [];
            if (trail.length === 0) {
                return;
            }

            const clampedIndex = Math.max(1, Math.min(pointIndex, trail.length));
            const visibleTrail = trail.slice(0, clampedIndex).map((point) => [point.lat, point.lng]);
            if (visibleTrail.length > 1) {
                L.polyline(visibleTrail, {
                    color: signal.status === "alert" ? "#ff6f5e" : signal.status === "warning" ? "#ffb84d" : "#2ecf86",
                    weight: 4,
                    opacity: 0.9,
                    dashArray: "1 0",
                    lineCap: "round",
                    lineJoin: "round"
                }).addTo(selectedTrailLayer);
            }

            const activePoint = trail[clampedIndex - 1];
            if (activePoint) {
                L.circleMarker([activePoint.lat, activePoint.lng], {
                    radius: 8,
                    color: "#ffffff",
                    weight: 2,
                    fillColor: signal.status === "alert" ? "#ff6f5e" : signal.status === "warning" ? "#ffb84d" : "#2ecf86",
                    fillOpacity: 1
                }).addTo(selectedTrailLayer);
            }

            if (vesselCameraFields.playbackPoint) {
                vesselCameraFields.playbackPoint.textContent = `${clampedIndex} / ${trail.length}`;
            }
            if (vesselCameraFields.playbackTime) {
                const minutesBack = (trail.length - clampedIndex) * 10;
                vesselCameraFields.playbackTime.textContent = clampedIndex === trail.length ? "Latest" : `${minutesBack} min back`;
            }
        };

        const renderTelemetry = (signal) => {
            if (!vesselCameraFields.telemetry) {
                return;
            }

            const telemetry = Array.isArray(signal?.telemetry) ? signal.telemetry : [];
            vesselCameraFields.telemetry.innerHTML = telemetry.length > 0
                ? telemetry.map((item) => {
                    const tone = (item.tone || "neutral").toLowerCase();
                    return `
                        <div class="telemetry-pill telemetry-${tone}">
                            <span class="telemetry-label">${escapeHtml(item.label || "-")}</span>
                            <strong class="telemetry-value">${escapeHtml(item.value || "-")}</strong>
                        </div>
                    `;
                }).join("")
                : '<div class="telemetry-empty">No telemetry</div>';
        };

        const openVesselCameraModal = (signal) => {
            if (!signal) {
                return;
            }

            currentSignal = signal;
            const statusLabel = (signal.status || "-").toString().toUpperCase();
            const imageName = signal.icon === "tugboat" ? "tugboat.png" : "ship.png";
            const unitKind = signal.icon === "tugboat" ? "Tugboat Unit" : "Merchant Vessel";
            const cameraUrl = signal.cameraUrl || liveUnitSeed?.cameraUrl || "";
            if (vesselCameraFields.title) {
                vesselCameraFields.title.textContent = `${signal.name || "Vessel"} Live Camera`;
            }
            if (vesselCameraFields.meta) {
                vesselCameraFields.meta.textContent = `4 channel camera console untuk ${signal.name || "vessel"} dengan feed langsung dari API unit.`;
            }
            if (vesselCameraFields.portrait) {
                vesselCameraFields.portrait.src = `/image/${imageName}`;
                vesselCameraFields.portrait.alt = signal.name || "Vessel unit";
            }
            if (vesselCameraFields.unitKind) {
                vesselCameraFields.unitKind.textContent = unitKind;
            }
            if (vesselCameraFields.locationStatus) {
                vesselCameraFields.locationStatus.textContent = signal.locationStatus || "-";
            }
            if (vesselCameraFields.locationNote) {
                vesselCameraFields.locationNote.textContent = signal.locationNote || "-";
            }
            if (vesselCameraFields.rawCoordinates) {
                vesselCameraFields.rawCoordinates.textContent = signal.rawLatitude && signal.rawLongitude
                    ? `${signal.rawLatitude}, ${signal.rawLongitude}`
                    : "-";
            }
            if (vesselCameraFields.decimalCoordinates) {
                vesselCameraFields.decimalCoordinates.textContent = signal.decimalLatitude && signal.decimalLongitude
                    ? `${signal.decimalLatitude}, ${signal.decimalLongitude}`
                    : "-";
            }
            if (vesselCameraFields.name) {
                vesselCameraFields.name.textContent = signal.name || "-";
            }
            if (vesselCameraFields.unitCode) {
                vesselCameraFields.unitCode.textContent = signal.unitCode || "-";
            }
            if (vesselCameraFields.deviceId) {
                vesselCameraFields.deviceId.textContent = signal.deviceId || "-";
            }
            if (vesselCameraFields.unitDetail) {
                vesselCameraFields.unitDetail.textContent = signal.unitDetail || "-";
            }
            if (vesselCameraFields.status) {
                vesselCameraFields.status.textContent = statusLabel;
                vesselCameraFields.status.classList.remove("status-online", "status-warning", "status-alert");
                if (statusLabel === "ONLINE") {
                    vesselCameraFields.status.classList.add("status-online");
                } else if (statusLabel === "WARNING") {
                    vesselCameraFields.status.classList.add("status-warning");
                } else if (statusLabel === "ALERT") {
                    vesselCameraFields.status.classList.add("status-alert");
                }
            }
            if (vesselCameraFields.speed) {
                vesselCameraFields.speed.textContent = signal.speedLabel || "-";
            }
            if (vesselCameraFields.heading) {
                vesselCameraFields.heading.textContent = signal.heading || "-";
            }
            renderTelemetry(signal);
            if (vesselCameraFields.playbackSlider) {
                const trailLength = Array.isArray(signal.trail) ? Math.max(signal.trail.length, 1) : 1;
                vesselCameraFields.playbackSlider.min = "1";
                vesselCameraFields.playbackSlider.max = String(trailLength);
                vesselCameraFields.playbackSlider.value = String(trailLength);
                vesselCameraFields.playbackSlider.disabled = trailLength < 2;
            }
            if (vesselCameraFields.frame) {
                if (cameraUrl) {
                    vesselCameraFields.frame.src = cameraUrl;
                } else {
                    vesselCameraFields.frame.src = "about:blank";
                }
            }

            renderPlaybackTrail(signal, Array.isArray(signal.trail) ? signal.trail.length : 1);

            if (vesselCameraModal) {
                vesselCameraModal.show();
            }
        };

        const updateLiveUnitMarker = (unit) => {
            if (!unit || typeof unit.latitude !== "number" || typeof unit.longitude !== "number") {
                return;
            }

            liveUnitLayer.clearLayers();
            liveTrailLayer.clearLayers();

            if (liveUnitHistory.length === 0 && Array.isArray(unit.trail)) {
                liveUnitHistory = unit.trail
                    .filter((point) => typeof point.latitude === "number" && typeof point.longitude === "number")
                    .map((point) => ({
                        latitude: point.latitude,
                        longitude: point.longitude,
                        label: point.label || ""
                    }));
            }

            const lastHistory = liveUnitHistory[liveUnitHistory.length - 1];
            const currentPoint = {
                latitude: unit.latitude,
                longitude: unit.longitude,
                label: unit.lastSeen || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            };

            if (!lastHistory
                || Math.abs(lastHistory.latitude - currentPoint.latitude) > 0.000001
                || Math.abs(lastHistory.longitude - currentPoint.longitude) > 0.000001) {
                liveUnitHistory.push(currentPoint);
            }

            while (liveUnitHistory.length > 24) {
                liveUnitHistory.shift();
            }

            const liveSignal = {
                name: unit.name || unit.vehicleId || "Live Unit",
                status: unit.status || "online",
                speedLabel: unit.speedLabel || "-",
                heading: unit.heading || "-",
                icon: unit.icon || "ship",
                cameraUrl: unit.cameraUrl || liveUnitSeed?.cameraUrl || "",
                deviceId: unit.deviceId || "",
                unitCode: unit.unitCode || "",
                unitName: unit.unitName || unit.name || "",
                unitDetail: unit.unitDetail || "",
                locationStatus: unit.locationStatus || "lokasi tidak sesuai",
                locationNote: unit.locationNote || "Koordinat belum divalidasi.",
                rawLatitude: unit.rawLatitude || "",
                rawLongitude: unit.rawLongitude || "",
                decimalLatitude: unit.decimalLatitude || "",
                decimalLongitude: unit.decimalLongitude || "",
                telemetry: unit.telemetry || [],
                trail: unit.trail || []
            };

            const marker = L.marker([unit.latitude, unit.longitude], { icon: buildIcon(liveSignal) });
            marker.on("click", () => openVesselCameraModal({
                name: liveSignal.name,
                status: liveSignal.status,
                speedLabel: liveSignal.speedLabel,
                heading: liveSignal.heading,
                icon: liveSignal.icon,
                cameraUrl: liveSignal.cameraUrl,
                deviceId: unit.deviceId || "",
                unitCode: unit.unitCode || "",
                unitName: unit.unitName || liveSignal.name,
                unitDetail: unit.unitDetail || "",
                locationStatus: liveSignal.locationStatus,
                locationNote: liveSignal.locationNote,
                rawLatitude: unit.rawLatitude || "",
                rawLongitude: unit.rawLongitude || "",
                decimalLatitude: unit.decimalLatitude || "",
                decimalLongitude: unit.decimalLongitude || "",
                telemetry: unit.telemetry || [],
                trail: unit.trail || []
            }));
            marker.addTo(liveUnitLayer);

            const trailPoints = liveUnitHistory.map((point) => [point.latitude, point.longitude]);

            if (trailPoints.length > 1) {
                L.polyline(trailPoints, {
                    color: unit.status === "alert" ? "#ff6f5e" : "#2ecf86",
                    weight: 4,
                    opacity: 0.95,
                    lineCap: "round",
                    lineJoin: "round"
                }).addTo(liveTrailLayer);
            }

            if (trailPoints.length > 0) {
                const last = trailPoints[trailPoints.length - 1];
                L.circleMarker(last, {
                    radius: 8,
                    color: "#ffffff",
                    weight: 2,
                    fillColor: unit.status === "alert" ? "#ff6f5e" : "#2ecf86",
                    fillOpacity: 1
                }).addTo(liveTrailLayer);
            }

            if (!liveUnitUserMoved) {
                const livePoint = L.latLng(unit.latitude, unit.longitude);
                const centerPoint = map.getCenter();
                const shouldRefocus = !liveUnitFocused || centerPoint.distanceTo(livePoint) > 1000;

                if (shouldRefocus) {
                    map.setView(livePoint, Math.max(map.getZoom(), 13), { animate: false });
                    liveUnitFocused = true;
                }
            }

            if (!liveUnitFocused && !liveUnitUserMoved) {
                if (trailPoints.length > 1) {
                    const bounds = L.latLngBounds(trailPoints);
                    if (bounds.isValid()) {
                        map.fitBounds(bounds, { padding: [60, 60], animate: true });
                    } else {
                        map.setView([unit.latitude, unit.longitude], 13, { animate: true });
                    }
                } else {
                    map.setView([unit.latitude, unit.longitude], 13, { animate: true });
                }
                liveUnitFocused = true;
            }
        };

        const fetchLiveUnit = async () => {
            try {
                const response = await fetch(liveUnitApi, { headers: { Accept: "application/json" } });
                if (!response.ok) {
                    return;
                }

                const data = await response.json();
                updateLiveUnitMarker(data);
            } catch {
                // Keep last live marker if polling fails.
            }
        };

        const escapeHtml = (value) =>
            String(value ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll("\"", "&quot;")
                .replaceAll("'", "&#39;");

        depthBands.forEach((band) => {
            if (typeof band.lat !== "number" || typeof band.lng !== "number" || typeof band.radius !== "number") {
                return;
            }

            const tone = (band.tone || "deep").toLowerCase();
            const style = tone === "shallow"
                ? { fill: "#6fd3ff", border: "#a7e7ff", alpha: 0.17, dash: "2 8" }
                : tone === "mid"
                    ? { fill: "#2b8fc7", border: "#7cc8f2", alpha: 0.15, dash: "4 8" }
                    : { fill: "#0b4f8a", border: "#5fa8ea", alpha: 0.14, dash: "6 8" };

            const circle = L.circle([band.lat, band.lng], {
                radius: band.radius,
                color: style.border,
                weight: 1.6,
                opacity: 0.6,
                fillColor: style.fill,
                fillOpacity: style.alpha,
                dashArray: style.dash
            }).bindTooltip(`${band.name} • ${band.label || ""}`, {
                permanent: false,
                direction: "center",
                opacity: 0.9
            });

            circle.addTo(depthLayer);
        });

        harbours.forEach((harbour) => {
            if (typeof harbour.lat !== "number" || typeof harbour.lng !== "number") {
                return;
            }

            const icon = L.divIcon({
                className: "seaway-harbour-icon-wrap",
                html: `
                    <div class="seaway-harbour-icon">
                        <i class="bi bi-geo-alt-fill"></i>
                    </div>
                `,
                iconSize: [34, 34],
                iconAnchor: [17, 31]
            });

            L.marker([harbour.lat, harbour.lng], { icon })
                .bindPopup(`
                    <div class="map-popup">
                        <div class="map-popup-title">${escapeHtml(harbour.name || "Harbour")}</div>
                        <div class="map-popup-row">Type: <strong>${escapeHtml(harbour.type || "-")}</strong></div>
                    </div>
                `, { closeButton: false, offset: [0, -8] })
                .addTo(harbourLayer);
        });

        weatherVectors.forEach((item) => {
            if (typeof item.lat !== "number" || typeof item.lng !== "number") {
                return;
            }

            const base = L.latLng(item.lat, item.lng);
            const end = L.latLng(
                item.lat + 0.18 * Math.cos(((Number(item.angle) || 0) - 90) * Math.PI / 180),
                item.lng + 0.18 * Math.sin(((Number(item.angle) || 0) - 90) * Math.PI / 180)
            );

            L.polyline([base, end], {
                color: "#ffb84d",
                weight: 2.2,
                opacity: 0.72,
                dashArray: "6 7"
            }).addTo(weatherLayer);

            L.marker(base, {
                icon: L.divIcon({
                    className: "seaway-weather-icon-wrap",
                    html: `<div class="seaway-weather-icon"><i class="bi bi-wind"></i></div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                })
            }).bindPopup(`
                <div class="map-popup">
                    <div class="map-popup-title">${escapeHtml(item.name || "Weather")}</div>
                </div>
            `, { closeButton: false }).addTo(weatherLayer);
        });

        const buildIcon = (signal) => {
            const status = (signal.status || "online").toLowerCase();
            const toneClass = status === "alert" ? "alert" : status === "warning" ? "warning" : "online";
            const imageName = signal.icon === "tugboat" ? "tugboat.png" : "ship.png";

            return L.divIcon({
                className: "seaway-marker-wrap",
                html: `
                    <div class="seaway-marker ${toneClass}">
                        <img class="seaway-marker-image" src="${assetBase}/${imageName}" alt="" />
                        <span class="seaway-marker-ring"></span>
                        <span class="seaway-marker-heading">${signal.heading || ""}</span>
                    </div>
                `,
                iconSize: [84, 84],
                iconAnchor: [42, 42]
            });
        };

        const vesselMarkers = [];

        signals.forEach((signal) => {
            if (typeof signal.latitude !== "number" || typeof signal.longitude !== "number") {
                return;
            }

            const marker = L.marker([signal.latitude, signal.longitude], { icon: buildIcon(signal) })
            marker.on("click", () => openVesselCameraModal(signal));

            if (Array.isArray(signal.trail) && signal.trail.length > 1) {
                const trailPoints = signal.trail
                    .filter((point) => typeof point.lat === "number" && typeof point.lng === "number")
                    .map((point) => [point.lat, point.lng]);

                if (trailPoints.length > 1) {
                    L.polyline(trailPoints, {
                        color: signal.status === "alert" ? "#ff6f5e" : signal.status === "warning" ? "#ffb84d" : "#2ecf86",
                        weight: 3,
                        opacity: 0.78,
                        dashArray: "8 10",
                        lineCap: "round",
                        lineJoin: "round"
                    }).addTo(aisTrailLayer);
                }
            }

            vesselMarkers.push({ marker, status: (signal.status || "online").toLowerCase() });
        });

        if (liveUnitSeed) {
            updateLiveUnitMarker({
                name: liveUnitSeed.name,
                status: liveUnitSeed.status,
                speedLabel: liveUnitSeed.speedLabel,
                heading: liveUnitSeed.heading,
                latitude: liveUnitSeed.latitude,
                longitude: liveUnitSeed.longitude,
                icon: liveUnitSeed.icon,
                cameraUrl: liveUnitSeed.cameraUrl,
                deviceId: liveUnitSeed.deviceId || "",
                unitCode: liveUnitSeed.unitCode || "",
                unitName: liveUnitSeed.unitName || liveUnitSeed.name,
                unitDetail: liveUnitSeed.unitDetail || "",
                locationStatus: liveUnitSeed.locationStatus,
                locationNote: liveUnitSeed.locationNote,
                rawLatitude: liveUnitSeed.rawLatitude || "",
                rawLongitude: liveUnitSeed.rawLongitude || "",
                decimalLatitude: liveUnitSeed.decimalLatitude || "",
                decimalLongitude: liveUnitSeed.decimalLongitude || "",
                telemetry: liveUnitSeed.telemetry || [],
                trail: Array.isArray(liveUnitSeed.trail) ? liveUnitSeed.trail : []
            });
        }

        zones.forEach((zone) => {
            if (typeof zone.lat !== "number" || typeof zone.lng !== "number" || typeof zone.radius !== "number") {
                return;
            }

            const tone = zone.tone || "live";
            const stroke = tone === "alert" ? "#ff6b6b" : tone === "warn" ? "#f5b75d" : "#2ecf86";
            const fill = tone === "alert" ? "rgba(255, 107, 107, 0.16)" : tone === "warn" ? "rgba(245, 183, 93, 0.14)" : "rgba(46, 207, 134, 0.12)";

            L.circle([zone.lat, zone.lng], {
                radius: zone.radius,
                color: stroke,
                weight: 1.5,
                opacity: 0.7,
                fillColor: fill,
                fillOpacity: 0.2,
                dashArray: tone === "alert" ? "6 8" : "3 6"
            }).addTo(map).bindTooltip(zone.name || "Zone", {
                sticky: true,
                direction: "top",
                opacity: 0.9
            });
        });

        const vesselFilterButtons = Array.from(document.querySelectorAll("[data-ship-filter]"));
        const fleetRows = Array.from(document.querySelectorAll("[data-fleet-status]"));
        let activeShipFilter = "all";

        const renderVessels = () => {
            if (typeof vesselLayer.clearLayers === "function") {
                vesselLayer.clearLayers();
            }

            vesselMarkers.forEach(({ marker, status }) => {
                if (activeShipFilter !== "all" && activeShipFilter !== status) {
                    return;
                }

                vesselLayer.addLayer(marker);
            });

            fleetRows.forEach((row) => {
                const status = (row.getAttribute("data-fleet-status") || "").toLowerCase();
                const visible = activeShipFilter === "all" || activeShipFilter === status;
                row.classList.toggle("is-hidden", !visible);
            });
        };

        if (vesselMarkers.length > 0) {
            const group = L.featureGroup(vesselMarkers.map((item) => item.marker));
            map.fitBounds(group.getBounds().pad(0.25));
        }

        depthLayer.addTo(map);
        harbourLayer.addTo(map);
        aisTrailLayer.addTo(map);
        vesselLayer.addTo(map);

        const overlays = {
            bathymetry: depthLayer,
            harbours: harbourLayer,
            ais: aisTrailLayer,
            weather: weatherLayer
        };

        L.control.layers(null, {
            "Bathymetry": depthLayer,
            "Harbours": harbourLayer,
            "AIS Trails": aisTrailLayer,
            "Weather": weatherLayer
        }, { collapsed: false, position: "topright" }).addTo(map);

        const toggleButtons = document.querySelectorAll(`[data-map-layer]`);
        toggleButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const layerKey = button.getAttribute("data-map-layer");
                if (!layerKey || !overlays[layerKey]) {
                    return;
                }

                const isVisible = map.hasLayer(overlays[layerKey]);
                if (isVisible) {
                    map.removeLayer(overlays[layerKey]);
                    button.classList.remove("active");
                } else {
                    map.addLayer(overlays[layerKey]);
                    button.classList.add("active");
                }
            });
        });

        vesselFilterButtons.forEach((button) => {
            button.addEventListener("click", () => {
                activeShipFilter = button.getAttribute("data-ship-filter") || "all";
                vesselFilterButtons.forEach((item) => {
                    item.classList.toggle("active", item === button);
                });
                renderVessels();
            });
        });

        vesselCameraFields.playbackSlider?.addEventListener("input", () => {
            if (!currentSignal) {
                return;
            }

            const pointIndex = Number(vesselCameraFields.playbackSlider.value) || 1;
            renderPlaybackTrail(currentSignal, pointIndex);
        });

        vesselCameraModalEl?.addEventListener("hidden.bs.modal", () => {
            if (vesselCameraFields.frame) {
                vesselCameraFields.frame.src = "about:blank";
            }
            currentSignal = null;
        });

        renderVessels();
        fetchLiveUnit();
        window.setInterval(fetchLiveUnit, 5000);
    };
})();
