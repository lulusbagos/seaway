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
        const liveUnitSeed = mapData.liveUnit ?? null;
        const liveUnitApi = mapData.liveUnitApi || "/api/unit-status";
        const historyTracksApi = mapData.historyTracksApi || "/api/history-tracks";
        const assetBase = window.assetBaseUrl || "icon"; // Use relative or injected base
        const seedLat = liveUnitSeed && typeof liveUnitSeed.latitude === "number" ? liveUnitSeed.latitude : Number(center.lat);
        const seedLng = liveUnitSeed && typeof liveUnitSeed.longitude === "number" ? liveUnitSeed.longitude : Number(center.lng);
        const lat = Number.isFinite(seedLat) ? seedLat : -2.55;
        const lng = Number.isFinite(seedLng) ? seedLng : 118.65;
        const zoom = liveUnitSeed ? 13 : (Number(center.zoom) || 6);

        // Smooth polyline using Catmull-Rom spline
        const getCurvePoints = (pts, tension = 0.5, numOfSegments = 12) => {
            if (pts.length < 3) return pts;
            let result = [], x, y, t1x, t2x, t1y, t2y, c1, c2, c3, c4, st, t, i;
            const p = pts.slice();
            p.unshift(pts[0]);
            p.push(pts[pts.length - 1]);
            for (i = 1; i < p.length - 2; i++) {
                for (t = 0; t <= numOfSegments; t++) {
                    t1x = (p[i+1][0] - p[i-1][0]) * tension;
                    t2x = (p[i+2][0] - p[i][0]) * tension;
                    t1y = (p[i+1][1] - p[i-1][1]) * tension;
                    t2y = (p[i+2][1] - p[i][1]) * tension;
                    st = t / numOfSegments;
                    c1 =   2 * Math.pow(st, 3) - 3 * Math.pow(st, 2) + 1; 
                    c2 = -(2 * Math.pow(st, 3)) + 3 * Math.pow(st, 2); 
                    c3 =       Math.pow(st, 3) - 2 * Math.pow(st, 2) + st; 
                    c4 =       Math.pow(st, 3) -     Math.pow(st, 2);
                    x = c1 * p[i][0] + c2 * p[i+1][0] + c3 * t1x + c4 * t2x;
                    y = c1 * p[i][1] + c2 * p[i+1][1] + c3 * t1y + c4 * t2y;
                    result.push([x, y]);
                }
            }
            return result;
        };

        const map = L.map(containerId, {
            attributionControl: false,
            zoomControl: false,
            preferCanvas: true
        }).setView([lat, lng], zoom);

        window.seaWayMapInstance = map;

        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

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
            opacity: 1,
            zIndex: 10,
            attribution: "Sea map overlay &copy; OpenSeaMap contributors"
        });

        const bathymetryLayer = L.tileLayer.wms("https://ows.emodnet-bathymetry.eu/wms", {
            layers: 'emodnet:mean',
            format: 'image/png',
            transparent: true,
            opacity: 0.6,
            zIndex: 5,
            attribution: "EMODnet Bathymetry"
        });

        let heatmapPoints = [];
        if (signals) {
            signals.forEach(sig => {
                if (Array.isArray(sig.trail)) {
                    sig.trail.forEach(t => {
                        if (typeof t.latitude === 'number' && typeof t.longitude === 'number') {
                            heatmapPoints.push([t.latitude, t.longitude, 1]);
                        }
                    });
                }
            });
        }
        if (heatmapPoints.length === 0 && liveUnitSeed && Array.isArray(liveUnitSeed.trail)) {
            liveUnitSeed.trail.forEach(t => {
                if (typeof t.latitude === 'number' && typeof t.longitude === 'number') {
                    heatmapPoints.push([t.latitude, t.longitude, 1]);
                }
            });
        }
        const heatmapLayer = typeof L.heatLayer === "function" ? L.heatLayer(heatmapPoints, { radius: 25, blur: 15, maxZoom: 14 }) : L.layerGroup();

        let currentTheme = localStorage.getItem("seaway_map_theme") || "standard";
        if (!baseLayers[currentTheme]) {
            currentTheme = "standard";
        }

        baseLayers[currentTheme].addTo(map);
        seamapLayer.addTo(map);
        document.body.setAttribute("data-map-theme", currentTheme);

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

        const getUnitIconFile = (signal) => {
            const status = String(signal?.status || "online").toLowerCase();
            if (status === "alert") return "3.png";
            if (status === "warning") return "2.png";
            if (status === "offline") return "4.png";

            const speedText = String(signal?.speedLabel || signal?.speed || "");
            const speedValue = Number.parseFloat(speedText);
            if (Number.isFinite(speedValue) && speedValue <= 0.1) {
                return "4.png";
            }

            return "1.png";
        };

        let showCloudOverlay = false;
        let fleetWeatherMap = {};
        
        let showMarineOverlay = false;
        let fleetMarineMap = {};
        
        const aisTrailLayer = L.layerGroup();
        const historyTrackLayer = L.layerGroup().addTo(map);
        const historyPlaybackLayer = L.layerGroup().addTo(map);
        const lighthouseLayer = L.layerGroup().addTo(map);
        const graticuleLayer = L.layerGroup().addTo(map);
        const fetchedLighthouses = new Set();
        let lastLighthouseFetchPos = null;
        let isFetchingLighthouses = false;
        window.loadedHistoryTracks = [];

        if (!document.getElementById("seaway-lighthouse-style")) {
            const style = document.createElement("style");
            style.id = "seaway-lighthouse-style";
            style.textContent = `
                @keyframes lighthousePulse {
                    0% { opacity: 0.6; filter: drop-shadow(0 0 2px #ffeb3b); }
                    50% { opacity: 1; filter: drop-shadow(0 0 12px #ffeb3b) drop-shadow(0 0 20px #ff9800); }
                    100% { opacity: 0.6; filter: drop-shadow(0 0 2px #ffeb3b); }
                }
                .graticule-label {
                    color: rgba(79, 195, 247, 0.9);
                    font-family: monospace;
                    font-size: 10px;
                    font-weight: 600;
                    text-shadow: 0 0 2px #0f172a, 0 0 4px #0f172a;
                    white-space: nowrap;
                    background: transparent;
                    border: none;
                    box-shadow: none;
                }
            `;
            document.head.appendChild(style);
        }
        let isPlayingHistory = false;
        let historyAnimFrame = null;
        const historyAnimatedMarkers = [];
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
        const mapPanel = document.querySelector(".map-panel");

        const vesselCameraModal = vesselCameraModalEl && window.bootstrap?.Modal
            ? new window.bootstrap.Modal(vesselCameraModalEl)
            : null;
        const vesselCameraFields = {
            title: document.getElementById("vesselCameraTitle"),
            meta: document.getElementById("vesselCameraMeta"),
            portrait: document.getElementById("vesselCameraPortrait"),
            unitKind: document.getElementById("vesselCameraUnitKind"),
            frame: document.getElementById("vesselCameraFrame"),
            state: document.getElementById("vesselCameraState"),
            openExternal: document.getElementById("vesselCameraOpenExternal"),
            openExternalInline: document.getElementById("vesselCameraOpenExternalInline"),
            talkbackButton: document.getElementById("vesselCameraTalkbackButton"),
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
        let cameraStateTimer = 0;
        let weatherWeatherLoading = false;
        let weatherWeatherKey = "";

        const openMeteoApi = "/api/weather-proxy";
        const weatherFields = {
            wind: document.getElementById("weatherWind"),
            windDirection: document.getElementById("weatherWindDirection"),
            windDirectionArrow: document.getElementById("weatherWindDirectionArrow"),
            windDirectionDetail: document.getElementById("weatherWindDirectionDetail"),
            mapWind: document.getElementById("mapWeatherWind"),
            mapWindDirection: document.getElementById("mapWeatherWindDirection"),
            mapWindDirectionArrow: document.getElementById("mapWeatherWindDirectionArrow"),
            mapWindDirectionDetail: document.getElementById("mapWeatherWindDirectionDetail"),
            mapSource: document.getElementById("mapWeatherSource"),
            mapRain: document.getElementById("mapWeatherRain"),
            rain: document.getElementById("weatherRain"),
            cloud: document.getElementById("weatherCloud"),
            cloudDot: document.getElementById("weatherCloudDot"),
            cloudDetail: document.getElementById("weatherCloudDetail"),
            mapCloud: document.getElementById("mapWeatherCloud"),
            mapCloudDot: document.getElementById("mapWeatherCloudDot"),
            mapCloudDetail: document.getElementById("mapWeatherCloudDetail"),
            mapWave: document.getElementById("mapWeatherWave"),
            visibility: document.getElementById("weatherVisibility"),
            source: document.getElementById("weatherSource")
        };

        const degreesToCompass = (degrees) => {
            if (!Number.isFinite(degrees)) {
                return "-";
            }

            const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
            const index = Math.round(((degrees % 360) / 45)) % 8;
            return directions[index];
        };

        const loadCurrentWeather = async (latitude, longitude, force = false) => {
            if (!weatherFields.mapWind && !weatherFields.wind) {
                return;
            }

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return;
            }

            const weatherKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
            if (!force && weatherKey === weatherWeatherKey) {
                return;
            }

            if (weatherWeatherLoading) {
                return;
            }

            weatherWeatherLoading = true;
            weatherWeatherKey = weatherKey;

            try {
                const params = new URLSearchParams({
                    latitude: latitude.toFixed(6),
                    longitude: longitude.toFixed(6),
                    current: "wind_speed_10m,wind_direction_10m,precipitation,visibility,cloud_cover",
                    timezone: "auto"
                });
                const response = await fetch(`${openMeteoApi}?${params.toString()}`, { cache: "no-store" });
                if (!response.ok) {
                    throw new Error("Weather API failed");
                }

                const payload = await response.json();
                const current = payload?.current;
                const windSpeed = Number.parseFloat(current?.wind_speed_10m);
                const windDirection = Number.parseFloat(current?.wind_direction_10m);
                const precipitation = Number.parseFloat(current?.precipitation);
                const visibility = Number.parseFloat(current?.visibility);
                const cloudCover = Number.parseFloat(current?.cloud_cover);
                const windCompass = degreesToCompass(windDirection);
                const windDirectionText = Number.isFinite(windDirection)
                    ? `${windDirection.toFixed(0)}\u00B0`
                    : "-";
                const rotation = Number.isFinite(windDirection) ? windDirection : 0;

                try {
                    const marineParams = new URLSearchParams({
                        latitude: latitude.toFixed(6),
                        longitude: longitude.toFixed(6),
                        current: "wave_height",
                        timezone: "auto"
                    });
                    const marineRes = await fetch(`https://marine-api.open-meteo.com/v1/marine?${marineParams.toString()}`, { cache: "no-store" });
                    if (marineRes.ok) {
                        const marineData = await marineRes.json();
                        const waveHeight = marineData?.current?.wave_height;
                        if (weatherFields.mapWave) {
                            weatherFields.mapWave.textContent = Number.isFinite(waveHeight) ? `${waveHeight.toFixed(1)} m` : "Tenang";
                        }
                    }
                } catch {
                    if (weatherFields.mapWave) weatherFields.mapWave.textContent = "-";
                }

                if (weatherFields.wind) {
                    weatherFields.wind.textContent = Number.isFinite(windSpeed)
                        ? `${windSpeed.toFixed(1)} km/h`
                        : "-";
                }
                if (weatherFields.mapWind) {
                    weatherFields.mapWind.textContent = Number.isFinite(windSpeed)
                        ? `${windSpeed.toFixed(1)} km/h`
                        : "-";
                }

                if (weatherFields.windDirection) {
                    weatherFields.windDirection.textContent = Number.isFinite(windDirection)
                        ? windCompass
                        : "-";
                }
                if (weatherFields.mapWindDirection) {
                    weatherFields.mapWindDirection.textContent = Number.isFinite(windDirection)
                        ? windCompass
                        : "-";
                }

                if (weatherFields.windDirectionDetail) {
                    weatherFields.windDirectionDetail.textContent = windDirectionText;
                }
                if (weatherFields.mapWindDirectionDetail) {
                    weatherFields.mapWindDirectionDetail.textContent = windDirectionText;
                }

                if (weatherFields.windDirectionArrow) {
                    const arrow = weatherFields.windDirectionArrow.querySelector("i");
                    if (arrow) {
                        arrow.style.transform = `rotate(${rotation}deg)`;
                    }
                }
                if (weatherFields.mapWindDirectionArrow) {
                    const arrow = weatherFields.mapWindDirectionArrow.querySelector("i");
                    if (arrow) {
                        arrow.style.transform = `rotate(${rotation}deg)`;
                    }
                }

                if (weatherFields.rain) {
                    weatherFields.rain.textContent = Number.isFinite(precipitation)
                        ? `${precipitation.toFixed(1)} mm`
                        : "-";
                }
                if (weatherFields.mapRain) {
                    weatherFields.mapRain.textContent = Number.isFinite(precipitation)
                        ? `${precipitation.toFixed(1)} mm`
                        : "-";
                }
                if (weatherFields.visibility) {
                    weatherFields.visibility.textContent = Number.isFinite(visibility)
                        ? `${(visibility / 1000).toFixed(1)} km`
                        : "-";
                }
                if (weatherFields.cloud) {
                    weatherFields.cloud.textContent = Number.isFinite(cloudCover)
                        ? `${cloudCover.toFixed(0)}%`
                        : "-";
                }
                const cloudPercent = Number.isFinite(cloudCover) ? Math.max(0, Math.min(100, cloudCover)) : null;
                const cloudTone = cloudPercent === null
                    ? { label: "-", color: "rgba(239, 248, 251, 0.5)", text: "Unknown" }
                    : cloudPercent <= 15
                        ? { label: "Clear", color: "#8ef7ff", text: "Langit cerah" }
                        : cloudPercent <= 35
                            ? { label: "Few", color: "#6be4ff", text: "Awan tipis" }
                            : cloudPercent <= 60
                                ? { label: "Broken", color: "#9fb9c7", text: "Awan tersebar" }
                                : cloudPercent <= 85
                                    ? { label: "Heavy", color: "#8f9daa", text: "Awan tebal" }
                                    : { label: "Overcast", color: "#dce3ea", text: "Tertutup awan" };
                if (weatherFields.cloudDot) {
                    weatherFields.cloudDot.style.background = cloudTone.color;
                    weatherFields.cloudDot.style.boxShadow = `0 0 0 6px color-mix(in srgb, ${cloudTone.color} 18%, transparent), 0 0 18px color-mix(in srgb, ${cloudTone.color} 42%, transparent)`;
                }
                if (weatherFields.cloudDetail) {
                    weatherFields.cloudDetail.textContent = cloudTone.text;
                }
                if (weatherFields.mapCloud) {
                    weatherFields.mapCloud.textContent = Number.isFinite(cloudCover)
                        ? `${cloudCover.toFixed(0)}%`
                        : "-";
                }
                if (weatherFields.mapCloudDot) {
                    weatherFields.mapCloudDot.style.background = cloudTone.color;
                    weatherFields.mapCloudDot.style.boxShadow = `0 0 0 6px color-mix(in srgb, ${cloudTone.color} 18%, transparent), 0 0 18px color-mix(in srgb, ${cloudTone.color} 42%, transparent)`;
                }
                if (weatherFields.mapCloudDetail) {
                    weatherFields.mapCloudDetail.textContent = cloudTone.text;
                }

                if (weatherFields.mapSource) {
                    weatherFields.mapSource.textContent = "Open-Meteo";
                }
                if (weatherFields.source) {
                    weatherFields.source.textContent = "Source: Open-Meteo current weather + LibreWXR radar";
                }
            } catch {
                if (weatherFields.source) {
                    weatherFields.source.textContent = "Source: LibreWXR radar";
                }
            } finally {
                weatherWeatherLoading = false;
            }
        };

        const setCameraState = (message, tone = "normal") => {
            if (!vesselCameraFields.state) {
                return;
            }

            vesselCameraFields.state.classList.toggle("is-error", tone === "error");
            const text = vesselCameraFields.state.querySelector(".camera-console-state-text");
            if (text) {
                text.textContent = message;
            } else {
                vesselCameraFields.state.textContent = message;
            }
        };

        const fetchLocationName = async (lat, lng) => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`, {
                    headers: { "Accept-Language": "id-ID" }
                });
                if (res.ok) {
                    const data = await res.json();
                    return data.display_name || data.name;
                }
            } catch { }
            return null;
        };

        const inspectCameraFrame = () => {
            if (!vesselCameraFields.frame) {
                return;
            }

            try {
                const doc = vesselCameraFields.frame.contentDocument;
                const bodyHtml = doc?.documentElement?.innerHTML || "";
                const legacyFlash = /player\.swf|ttxVideoAll|swfobject/i.test(bodyHtml);
                if (legacyFlash) {
                    setCameraState("Legacy Flash player detected. Stream needs HTML5 endpoint.", "error");
                } else {
                    setCameraState("Camera console ready", "normal");
                }
            } catch {
                setCameraState("Camera console loaded", "normal");
            }
        };

        if (vesselCameraFields.frame) {
            vesselCameraFields.frame.addEventListener("load", () => {
                clearTimeout(cameraStateTimer);
                cameraStateTimer = window.setTimeout(inspectCameraFrame, 250);
            });
        }

        if (vesselCameraFields.talkbackButton) {
            vesselCameraFields.talkbackButton.addEventListener("click", () => {
                vesselCameraFields.talkbackButton.classList.toggle("is-active");
                const active = vesselCameraFields.talkbackButton.classList.contains("is-active");
                vesselCameraFields.talkbackButton.setAttribute("aria-pressed", active ? "true" : "false");
                vesselCameraFields.talkbackButton.innerHTML = active
                    ? '<i class="bi bi-mic-fill"></i> Mic On'
                    : '<i class="bi bi-mic"></i> Mic';
                setCameraState(active ? "Talk-back ready" : "Camera console ready", active ? "normal" : "normal");
            });
        }

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
                const smoothVisibleTrail = getCurvePoints(visibleTrail);
                L.polyline(smoothVisibleTrail, {
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

            const rawTelemetry = Array.isArray(signal?.telemetry) ? signal.telemetry : [];
            const teleMap = {};
            rawTelemetry.forEach(item => {
                if (item.label) teleMap[item.label.toLowerCase()] = item.value;
            });

            const netVal = teleMap["jaringan"] || (teleMap["net"] ? `NET ${teleMap["net"]}` : "NET 3 (Live)");
            const gpsVal = teleMap["status gps"] || (signal.status === "online" ? "Fix 3D (Live)" : "Peringatan (Alert)");
            const spdVal = teleMap["kecepatan"] || signal.speedLabel || "0.0 Knot";
            const hdgVal = teleMap["arah haluan"] || signal.heading || "0°";

            let extraHtml = '';
            const standardKeys = ['jaringan', 'status gps', 'kecepatan', 'arah haluan', 'gateway api', 'net', 'gw', 'ol', 'sp'];
            rawTelemetry.forEach(item => {
                if (item.label && !standardKeys.includes(item.label.toLowerCase())) {
                    extraHtml += `
                        <div class="telemetry-card">
                            <span class="telemetry-card-label">${escapeHtml(item.label.toUpperCase())}</span>
                            <strong class="telemetry-card-value" style="font-size: 0.75rem; word-break: break-word;">${escapeHtml(item.value)}</strong>
                        </div>
                    `;
                }
            });

            vesselCameraFields.telemetry.innerHTML = `
                <div class="telemetry-group">
                    <div class="telemetry-group-title">
                        <i class="bi bi-broadcast"></i> Konektivitas & Navigasi
                    </div>
                    <div class="telemetry-grid-compact">
                        <div class="telemetry-card">
                            <span class="telemetry-card-label">Jaringan Telemetri</span>
                            <strong class="telemetry-card-value text-success"><span class="brand-pulse"></span> ${escapeHtml(netVal)}</strong>
                        </div>
                        <div class="telemetry-card">
                            <span class="telemetry-card-label">Sinyal GPS</span>
                            <strong class="telemetry-card-value">${escapeHtml(gpsVal)}</strong>
                        </div>
                        <div class="telemetry-card">
                            <span class="telemetry-card-label">Kecepatan & Haluan</span>
                            <strong class="telemetry-card-value">${escapeHtml(spdVal)} &middot; ${escapeHtml(hdgVal)}</strong>
                        </div>
                        ${extraHtml}
                    </div>
                </div>
            `;
        };

        const openVesselCameraModal = (signal) => {
            if (!signal) {
                return;
            }

            currentSignal = signal;
            const statusLabel = (signal.status || "-").toString().toUpperCase();
            const imageName = getUnitIconFile(signal);
            const unitKind = signal.icon === "tugboat" ? "Tugboat Unit" : "Merchant Vessel";

            const unitTitleName = signal.unitName || signal.name || "";
            const devId = signal.deviceId || (unitTitleName.includes("17") ? "488260670812" : "488260671512");
            let cameraUrl = signal.cameraUrl;
            if (!cameraUrl || !cameraUrl.includes("devIdno=")) {
                cameraUrl = `https://lenzguard.com/808gps/open/player/video.html?lang=en&devIdno=${devId}&account=GLJ01&password=123456`;
            }
            if (vesselCameraFields.title) {
                vesselCameraFields.title.textContent = `Kamera Live & Telemetri — ${signal.unitCode || signal.name || "Unit Armada"}`;
            }
            if (vesselCameraFields.meta) {
                vesselCameraFields.meta.textContent = `Konsol pemantauan kamera & telemetri real-time unit ${signal.name || "armada"} · PT Pelayaran Ganesha Lautjaya`;
            }
            if (vesselCameraFields.portrait) {
                vesselCameraFields.portrait.src = `/icon/${imageName}`;
                vesselCameraFields.portrait.alt = signal.name || "Vessel unit";
            }
            if (vesselCameraFields.unitKind) {
                vesselCameraFields.unitKind.textContent = unitKind;
            }
            if (vesselCameraFields.locationStatus) {
                vesselCameraFields.locationStatus.textContent = signal.locationStatus || "-";
            }
            if (vesselCameraFields.locationNote) {
                vesselCameraFields.locationNote.textContent = "Mencari lokasi perairan...";
                const fetchLat = signal.rawLatitude || signal.decimalLatitude || signal.latitude;
                const fetchLng = signal.rawLongitude || signal.decimalLongitude || signal.longitude;
                
                if (typeof fetchLat === "number" || !isNaN(parseFloat(fetchLat))) {
                    fetchLocationName(parseFloat(fetchLat), parseFloat(fetchLng)).then(name => {
                        if (name && currentSignal === signal) {
                            vesselCameraFields.locationNote.textContent = name;
                        } else if (currentSignal === signal) {
                            vesselCameraFields.locationNote.textContent = signal.locationNote || "Sistem geocoding gagal memuat.";
                        }
                    });
                } else {
                    vesselCameraFields.locationNote.textContent = signal.locationNote || "-";
                }
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
            setCameraState("Loading camera console...", "normal");
            renderTelemetry(signal);
            if (vesselCameraFields.playbackSlider) {
                const trailLength = Array.isArray(signal.trail) ? Math.max(signal.trail.length, 1) : 1;
                vesselCameraFields.playbackSlider.min = "1";
                vesselCameraFields.playbackSlider.max = String(trailLength);
                vesselCameraFields.playbackSlider.value = String(trailLength);
                vesselCameraFields.playbackSlider.disabled = trailLength < 2;
            }
            if (vesselCameraFields.frame) {
                vesselCameraFields.frame.src = "about:blank";
                if (cameraUrl) {
                    window.setTimeout(() => {
                        if (vesselCameraFields.frame) {
                            vesselCameraFields.frame.src = cameraUrl;
                        }
                    }, 50);
                }
            }
            if (vesselCameraFields.openExternal) {
                vesselCameraFields.openExternal.href = cameraUrl || "#";
                vesselCameraFields.openExternal.style.pointerEvents = cameraUrl ? "auto" : "none";
                vesselCameraFields.openExternal.style.opacity = cameraUrl ? "1" : "0.5";
            }
            if (vesselCameraFields.openExternalInline) {
                vesselCameraFields.openExternalInline.href = cameraUrl || "#";
                vesselCameraFields.openExternalInline.style.pointerEvents = cameraUrl ? "auto" : "none";
                vesselCameraFields.openExternalInline.style.opacity = cameraUrl ? "1" : "0.5";
            }

            renderPlaybackTrail(signal, Array.isArray(signal.trail) ? signal.trail.length : 1);
            
            const fetchLat = signal.rawLatitude || signal.decimalLatitude || signal.latitude;
            const fetchLng = signal.rawLongitude || signal.decimalLongitude || signal.longitude;
            
            const localWeatherEl = document.getElementById("vesselCameraWeather");
            const localWaveEl = document.getElementById("vesselCameraWave");
            
            if (localWeatherEl && fetchLat !== undefined && fetchLng !== undefined) {
                localWeatherEl.innerHTML = "<span class='spinner-border spinner-border-sm' role='status' aria-hidden='true'></span> Mengambil data cuaca satelit...";
                localWaveEl.textContent = "Mengukur gelombang...";
                
                Promise.allSettled([
                    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${parseFloat(fetchLat).toFixed(6)}&longitude=${parseFloat(fetchLng).toFixed(6)}&current=wind_speed_10m,wind_direction_10m,precipitation,cloud_cover&timezone=auto`),
                    fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${parseFloat(fetchLat).toFixed(6)}&longitude=${parseFloat(fetchLng).toFixed(6)}&current=wave_height,wave_direction,ocean_current_velocity,ocean_current_direction&timezone=auto`)
                ]).then(([weatherRes, marineRes]) => {
                    if (currentSignal !== signal) return; 
                    
                    if (weatherRes.status === "fulfilled" && weatherRes.value.ok) {
                        weatherRes.value.json().then(data => {
                            const w = data.current;
                            localWeatherEl.innerHTML = `Angin: <b>${w.wind_speed_10m} km/h</b> <i class="bi bi-arrow-up" style="transform: rotate(${w.wind_direction_10m}deg); display: inline-block;"></i><br/>` +
                                                       `Awan: <b>${w.cloud_cover}%</b> &middot; Hujan: <b>${w.precipitation} mm</b>`;
                        });
                    } else {
                        localWeatherEl.textContent = "Gagal memuat data cuaca (Satelit tidak merespon).";
                    }
                    
                    if (marineRes.status === "fulfilled" && marineRes.value.ok) {
                        marineRes.value.json().then(data => {
                            const wh = data?.current?.wave_height;
                            const cur = data?.current?.ocean_current_velocity;
                            const curDir = data?.current?.ocean_current_direction || 0;
                            
                            let waveText = typeof wh === "number" ? `<i class="bi bi-water"></i> Tinggi Ombak: ${wh.toFixed(1)} Meter` : "Ombak: Tenang (Perairan Dangkal)";
                            let currentText = typeof cur === "number" ? `&middot; Arus Laut: <b>${cur.toFixed(1)} km/h</b> <i class="bi bi-arrow-up" style="transform: rotate(${curDir}deg); display: inline-block;"></i>` : "";
                            
                            localWaveEl.innerHTML = waveText + " " + currentText;
                        });
                    } else {
                        localWaveEl.textContent = "Data oseanografi tidak tersedia.";
                    }
                });
            }

            if (vesselCameraModal) {
                vesselCameraModal.show();
            }
        };

        const fetchLighthouses = async (lat, lng) => {
            isFetchingLighthouses = true;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                // Hapus marker lama yang terlalu jauh (> 100km) dari kapal untuk menghemat memori
                const maxDistance = 100000;
                lighthouseLayer.eachLayer(layer => {
                    if (layer.getLatLng) {
                        const markerLatLng = layer.getLatLng();
                        const distance = map.distance([lat, lng], markerLatLng);
                        if (distance > maxDistance) {
                            lighthouseLayer.removeLayer(layer);
                            if (layer.options && layer.options.lighthouseId) {
                                fetchedLighthouses.delete(layer.options.lighthouseId);
                            }
                        }
                    }
                });

                const radius = 30000;
                const query = `[out:json][timeout:10];node["man_made"="lighthouse"](around:${radius},${lat},${lng});out;`;
                const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
                const response = await fetch(url, { signal: controller.signal });
                if (!response.ok) throw new Error("Overpass API failed");
                const data = await response.json();
                
                if (data && data.elements) {
                    data.elements.forEach(node => {
                        if (!fetchedLighthouses.has(node.id)) {
                            fetchedLighthouses.add(node.id);
                            const name = node.tags && node.tags.name ? node.tags.name : "Mercusuar";
                            const height = node.tags && node.tags.height ? `<br/>Tinggi: ${node.tags.height}m` : "";
                            
                            const icon = L.divIcon({
                                className: "lighthouse-marker",
                                html: `
                                    <div style="font-size: 24px; color: #ffeb3b; text-shadow: 0 0 4px #000, 0 0 8px #ff9800; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">
                                        <i class="bi bi-lightbulb-fill" style="animation: lighthousePulse 2.5s infinite;"></i>
                                    </div>
                                `,
                                iconSize: [30, 30],
                                iconAnchor: [15, 15]
                            });

                            L.marker([node.lat, node.lon], { icon, lighthouseId: node.id })
                                .addTo(lighthouseLayer)
                                .bindTooltip(`<b>${escapeHtml(name)}</b>${height}`, { direction: "top" });
                        }
                    });
                }
                lastLighthouseFetchPos = [lat, lng];
            } catch (err) {
                if (err.name === 'AbortError') {
                    console.warn("Pencarian mercusuar timeout (terlalu lama)");
                } else {
                    console.warn("Gagal memuat mercusuar", err);
                }
            } finally {
                clearTimeout(timeoutId);
                isFetchingLighthouses = false;
            }
        };

        const updateLiveUnitMarker = (unit) => {
            if (!unit || typeof unit.latitude !== "number" || typeof unit.longitude !== "number") {
                return;
            }

            if (!isFetchingLighthouses) {
                const distance = lastLighthouseFetchPos 
                    ? map.distance([unit.latitude, unit.longitude], lastLighthouseFetchPos) 
                    : Infinity;
                if (distance > 20000) {
                    fetchLighthouses(unit.latitude, unit.longitude);
                }
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
                latitude: unit.latitude,
                longitude: unit.longitude,
                telemetry: unit.telemetry || [],
                trail: unit.trail || []
            }));
            marker.addTo(liveUnitLayer);

            const trailPoints = liveUnitHistory.map((point) => [point.latitude, point.longitude]);

            if (trailPoints.length > 1) {
                const smoothTrailPoints = getCurvePoints(trailPoints);
                L.polyline(smoothTrailPoints, {
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
                if (typeof data.latitude === "number" && typeof data.longitude === "number") {
                    loadCurrentWeather(data.latitude, data.longitude);
                }
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

        const parseHeadingDegrees = (heading) => {
            if (typeof heading === "number" && Number.isFinite(heading)) {
                return heading;
            }
            if (typeof heading === "string") {
                const match = heading.match(/(-?\d+(\.\d+)?)/);
                if (match) {
                    const parsed = Number.parseFloat(match[1]);
                    if (Number.isFinite(parsed)) {
                        return parsed;
                    }
                }
            }
            return 0;
        };

        const vesselMarkers = []; // Hoist declaration so buildIcon can see it if needed, but it's fine here.

        const buildIcon = (signal) => {
            const status = (signal.status || "online").toLowerCase();
            const toneClass = status === "alert" ? "alert" : status === "warning" ? "warning" : "online";
            const imageName = getUnitIconFile(signal);
            const headingDegrees = parseHeadingDegrees(signal.heading);
            const unitNameText = escapeHtml(signal.unitName || signal.unitCode || signal.name || "");
            const speedText = escapeHtml(signal.speedLabel || "");
            
            const shipId = signal.deviceId || signal.name;
            const weather = fleetWeatherMap[shipId];
            let cloudHtml = "";

            if (showCloudOverlay && weather) {
                let iconClass = "bi-cloud-sun";
                let weatherText = "Cerah Berawan";
                let iconColor = "#f59e0b"; // yellow-ish
                
                if (typeof weather.precipitation === "number" && weather.precipitation > 0.1) {
                    iconClass = "bi-cloud-rain-fill";
                    weatherText = `Hujan (${weather.precipitation} mm)`;
                    iconColor = "#3b82f6"; // blue
                } else if (typeof weather.cloud_cover === "number" && weather.cloud_cover > 50) {
                    iconClass = "bi-cloud-fill";
                    weatherText = `Berawan (${weather.cloud_cover}%)`;
                    iconColor = "#64748b"; // slate
                } else if (typeof weather.wind_speed_10m === "number" && weather.wind_speed_10m > 20) {
                    iconClass = "bi-wind";
                    weatherText = `Angin Kencang (${weather.wind_speed_10m} km/h)`;
                    iconColor = "#0ea5e9"; // light blue
                } else if (typeof weather.cloud_cover === "number" && weather.cloud_cover <= 30) {
                    iconClass = "bi-sun-fill";
                    weatherText = "Cerah";
                    iconColor = "#eab308"; // yellow
                }
                
                cloudHtml = '<div class="weather-cloud-overlay" style="color: ' + iconColor + '" title="' + weatherText + '"><i class="bi ' + iconClass + '"></i></div>';
            }
            
            const marine = fleetMarineMap[shipId];
            let marineHtml = "";
            if (showMarineOverlay && marine) {
                if (typeof marine.wave_height === "number" && typeof marine.wave_direction === "number") {
                    marineHtml = `
                    <div style="background: rgba(14, 165, 233, 0.95); color: #ffffff; font-family: monospace; font-size: 0.65rem; font-weight: 800; padding: 1px 6px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 2px 8px rgba(0,0,0,0.5); white-space: nowrap; margin-top: 2px;">
                        <i class="bi bi-water"></i> ${marine.wave_height}m <i class="bi bi-arrow-up" style="transform: rotate(${marine.wave_direction}deg); display: inline-block;"></i>
                    </div>`;
                }
            }

            return L.divIcon({
                className: "seaway-marker-wrap",
                html: `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto;">
                        <div style="background: rgba(15, 23, 42, 0.92); color: #00f0ff; font-family: monospace; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 99px; border: 1px solid rgba(0, 240, 255, 0.5); box-shadow: 0 4px 12px rgba(0,0,0,0.6); white-space: nowrap; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.04em; backdrop-filter: blur(8px);">
                            ${unitNameText}
                        </div>
                        <div class="MainGuard-marker ${toneClass}" style="position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
                            <img class="MainGuard-marker-image" src="${assetBase}/${imageName}" alt="${unitNameText}" style="width: 60px; height: 60px; transform: rotate(${headingDegrees}deg); transition: transform 0.3s ease; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));" />
                            <span class="MainGuard-marker-ring"></span>
                            ${cloudHtml}
                        </div>
                        <div style="background: rgba(229, 57, 53, 0.95); color: #ffffff; font-family: monospace; font-size: 0.68rem; font-weight: 800; padding: 1px 6px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 2px 8px rgba(0,0,0,0.5); white-space: nowrap; margin-top: 2px;">
                            ${speedText}
                        </div>
                        ${marineHtml}
                    </div>
                `,
                iconSize: [140, 120],
                iconAnchor: [70, 60]
            });
        };


        signals.forEach((signal) => {
            if (typeof signal.latitude !== "number" || typeof signal.longitude !== "number") {
                return;
            }

            if (liveUnitSeed && (signal.unitCode === liveUnitSeed.unitCode || signal.name === liveUnitSeed.name)) {
                return;
            }

            const devId = signal.deviceId || "";
            const cameraUrl = signal.cameraUrl || (devId ? `https://lenzguard.com/808gps/open/player/video.html?lang=en&devIdno=${devId}&account=GLJ01&password=123456` : "");

            const signalObject = {
                name: signal.unitName || signal.name || "Vessel Unit",
                status: signal.status || "online",
                speedLabel: signal.speedLabel || "-",
                heading: signal.heading || "-",
                icon: signal.icon || "ship",
                cameraUrl: cameraUrl,
                deviceId: devId,
                unitCode: signal.unitCode || signal.name || "",
                unitName: signal.unitName || signal.name || "",
                unitDetail: signal.unitDetail || "",
                locationStatus: signal.locationStatus || "lokasi sesuai",
                locationNote: signal.locationNote || "Koordinat GPS aktif.",
                rawLatitude: signal.rawLatitude || "",
                rawLongitude: signal.rawLongitude || "",
                decimalLatitude: signal.decimalLatitude || "",
                decimalLongitude: signal.decimalLongitude || "",
                latitude: signal.latitude,
                longitude: signal.longitude,
                telemetry: signal.telemetry || [],
                trail: signal.trail || []
            };

            const marker = L.marker([signal.latitude, signal.longitude], { icon: buildIcon(signalObject) });
            marker.on("click", () => openVesselCameraModal(signalObject));

            if (Array.isArray(signal.trail) && signal.trail.length > 1) {
                const trailPoints = signal.trail
                    .filter((point) => typeof point.lat === "number" && typeof point.lng === "number")
                    .map((point) => [point.lat, point.lng]);

                if (trailPoints.length > 1) {
                    const smoothTrailPoints = getCurvePoints(trailPoints);
                    L.polyline(smoothTrailPoints, {
                        color: signal.status === "alert" ? "#ff6f5e" : signal.status === "warning" ? "#ffb84d" : "#2ecf86",
                        weight: 3,
                        opacity: 0.78,
                        dashArray: "8 10",
                        lineCap: "round",
                        lineJoin: "round"
                    }).addTo(aisTrailLayer);
                }
            }

            vesselMarkers.push({ marker, status: (signal.status || "online").toLowerCase(), signalObject: signalObject });
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

        aisTrailLayer.addTo(map);
        vesselLayer.addTo(map);

        const overlays = {
            ais: aisTrailLayer,
            history: historyTrackLayer,
            bathymetry: bathymetryLayer,
            heatmap: heatmapLayer,
            lighthouse: lighthouseLayer
        };

        const loadHistoryTracks = async () => {
            try {
                const startDateInput = document.getElementById("historyStartDate");
                const endDateInput = document.getElementById("historyEndDate");

                const now = new Date();
                const past = new Date();
                past.setDate(now.getDate() - 2);

                if (startDateInput && !startDateInput.value) {
                    startDateInput.value = past.toISOString().split('T')[0];
                }
                if (endDateInput && !endDateInput.value) {
                    endDateInput.value = now.toISOString().split('T')[0];
                }

                let query = "";
                if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
                    query = `?start=${startDateInput.value}&end=${endDateInput.value}`;
                }

                const response = await fetch(`${historyTracksApi}${query}`, { headers: { Accept: "application/json" } });
                if (!response.ok) return;

                const tracksData = await response.json();
                historyTrackLayer.clearLayers();
                window.loadedHistoryTracks = [];

                if (!Array.isArray(tracksData)) return;
                
                const newHeatPts = [];
                const trackColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef", "#f43f5e", "#14b8a6", "#3f6212", "#0369a1", "#4f46e5", "#be123c"];
                const getTrackColor = (name) => {
                    let hash = 0;
                    for (let i = 0; i < name.length; i++) {
                        hash = (hash << 5) - hash + name.charCodeAt(i);
                        hash = hash & hash;
                    }
                    hash = Math.abs(hash ^ name.length);
                    return trackColors[hash % trackColors.length];
                };

                tracksData.forEach((unitTrack) => {
                    if (!unitTrack.points || unitTrack.points.length === 0) return;

                    const unitName = escapeHtml(unitTrack.unitName || unitTrack.unitCode || "Unit");
                    const trackColor = getTrackColor(unitName);

                    // Find live signal ship position on the map
                    const liveSignal = signals.find(s => (s.unitCode && s.unitCode === unitTrack.unitCode) || (s.unitName && s.unitName === unitTrack.unitName) || (s.name && s.name === unitTrack.unitName));

                    const latLngs = [];

                    // 1. Add historical points recorded in the past
                    unitTrack.points.forEach((pt) => {
                        const ptLat = parseFloat(pt.latitude || pt.lat);
                        const ptLng = parseFloat(pt.longitude || pt.lng);
                        
                        if (!isNaN(ptLat) && !isNaN(ptLng)) {
                            newHeatPts.push([ptLat, ptLng, 1]);
                            
                            if (liveSignal && typeof liveSignal.latitude === "number" && typeof liveSignal.longitude === "number") {
                                const dLat = Math.abs(ptLat - liveSignal.latitude);
                                const dLng = Math.abs(ptLng - liveSignal.longitude);
                                if (dLat < 0.0005 && dLng < 0.0005) {
                                    return;
                                }
                            }
                            latLngs.push([ptLat, ptLng]);
                        }
                    });

                    // 2. Head of track line is ALWAYS the current live ship position
                    if (liveSignal && typeof liveSignal.latitude === "number" && typeof liveSignal.longitude === "number") {
                        latLngs.push([liveSignal.latitude, liveSignal.longitude]);
                    }

                    if (latLngs.length < 2) return;

                    const smoothLatLngs = getCurvePoints(latLngs);
                    if (smoothLatLngs.length < 2) return;

                    // 3. Sleek contrast outline (6px width)
                    L.polyline(smoothLatLngs, {
                        className: 'history-track-outline',
                        color: "#ffffff",
                        weight: 6,
                        opacity: 0.9,
                        lineCap: "round",
                        lineJoin: "round"
                    }).addTo(historyTrackLayer);

                    // 4. Main track line (3.2px width) - SMOOTH LINE WITHOUT OVERLAPPING CIRCLES!
                    const mainPolyline = L.polyline(smoothLatLngs, {
                        className: 'history-track-main',
                        color: trackColor,
                        weight: 3.2,
                        opacity: 1,
                        lineCap: "round",
                        lineJoin: "round"
                    }).addTo(historyTrackLayer);

                    const pointCount = unitTrack.points.length;
                    mainPolyline.bindTooltip(
                        `<div style="background:#0f172a; color:#ffffff; font-family: monospace; font-size: 0.8rem; padding: 4px 8px; border-radius: 6px; border: 1px solid #00f0ff; box-shadow: 0 4px 12px rgba(0,0,0,0.6);">` +
                        `<strong style="color: #00f0ff;">${unitName}</strong><br/>` +
                        `<span style="opacity:0.9;">Lintasan Histori Real-Time - ${pointCount} Titik (15-Min)</span></div>`,
                        { sticky: true }
                    );

                    // 5. Render ONLY 1 marker at the start of 24h trajectory (NO dense overlapping circles along line!)
                    if (unitTrack.points.length > 0) {
                        const startPt = unitTrack.points[0];
                        const startMarker = L.circleMarker([startPt.latitude, startPt.longitude], {
                            radius: 5,
                            color: "#ffffff",
                            weight: 2,
                            fillColor: trackColor,
                            fillOpacity: 1
                        }).addTo(historyTrackLayer);

                        const timeText = startPt.timeLabel || (startPt.recordedAt ? startPt.recordedAt.substring(11, 16) : "");
                        startMarker.bindTooltip(
                            `<div style="font-size:0.8rem; line-height: 1.4; background:#0f172a; color:#ffffff; padding:4px 8px; border-radius:6px; border:1px solid #00f0ff; box-shadow:0 4px 12px rgba(0,0,0,0.6);">` +
                            `<strong style="color:#00f0ff;">${unitName}</strong> (🚩 Titik Awal 48 Jam)<br/>` +
                            `🕒 <b>${timeText}</b> &middot; ⚓ <b>${startPt.speedKnots} Knot</b> (${startPt.headingDeg}°)</div>`,
                            { direction: "top", opacity: 0.95 }
                        );
                    }

                    window.loadedHistoryTracks.push({
                        path: smoothLatLngs,
                        rawPointCount: latLngs.length,
                        signalObject: liveSignal || {
                            name: unitName,
                            status: "online",
                            speedLabel: "Playback",
                            heading: 0,
                            icon: "ship",
                            unitName: unitName
                        }
                    });
                });
                
                if (typeof heatmapLayer.setLatLngs === "function" && newHeatPts.length > 0) {
                    heatmapLayer.setLatLngs(newHeatPts);
                }
            } catch (e) {
                console.warn("Failed to fetch history tracks", e);
            }
        };

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
                const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
                return `${deg}&deg; ${min.toString().padStart(2, '0')}' ${dir}`;
            };

            const lineStyle = {
                color: 'rgba(79, 195, 247, 0.4)',
                weight: 1,
                dashArray: '4 6',
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
                        className: 'graticule-label',
                        html: `<div style="padding-left: 12px; margin-top: -8px;">${formatCoord(lat, true)}</div>`,
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
                        className: 'graticule-label',
                        html: `<div style="padding-bottom: 8px;">${formatCoord(wrappedLng, false)}</div>`,
                        iconSize: [80, 30],
                        iconAnchor: [40, 30]
                    }),
                    interactive: false
                }).addTo(graticuleLayer);
            }
        };

        map.on('moveend', drawGraticule);
        map.on('overlayadd', (e) => {
            if (e.layer === graticuleLayer) drawGraticule();
        });
        drawGraticule();

        loadHistoryTracks();

        L.control.layers(null, {
            "AIS Trails": aisTrailLayer,
            "Mercusuar (Lighthouses)": lighthouseLayer,
            "Grid Koordinat (Graticule)": graticuleLayer
        }, { collapsed: false, position: "topright" }).addTo(map);

        const toggleButtons = document.querySelectorAll(`[data-map-layer]`);
        toggleButtons.forEach((button) => {
            button.addEventListener("click", async () => {
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

        const btnFilterHistory = document.getElementById("btnFilterHistory");
        if (btnFilterHistory) {
            btnFilterHistory.addEventListener("click", () => {
                const btnIcon = btnFilterHistory.querySelector("i");
                if (btnIcon) {
                    btnIcon.className = "spinner-border spinner-border-sm";
                }
                loadHistoryTracks().finally(() => {
                    if (btnIcon) {
                        btnIcon.className = "bi bi-search";
                    }
                });
            });
        }

        const btnPlayHistory = document.getElementById("btnPlayHistory");
        if (btnPlayHistory) {
            btnPlayHistory.addEventListener("click", () => {
                if (isPlayingHistory) {
                    isPlayingHistory = false;
                    cancelAnimationFrame(historyAnimFrame);
                    historyPlaybackLayer.clearLayers();
                    btnPlayHistory.innerHTML = '<i class="bi bi-play-fill" style="font-size: 1rem;"></i>';
                    btnPlayHistory.classList.replace("btn-danger", "btn-success");
                    vesselLayer.addTo(map);
                    liveUnitLayer.addTo(map);
                    return;
                }
                
                if (!window.loadedHistoryTracks || window.loadedHistoryTracks.length === 0) {
                    return;
                }

                isPlayingHistory = true;
                btnPlayHistory.innerHTML = '<i class="bi bi-stop-fill" style="font-size: 1rem;"></i>';
                btnPlayHistory.classList.replace("btn-success", "btn-danger");
                
                map.removeLayer(vesselLayer);
                map.removeLayer(liveUnitLayer);
                historyPlaybackLayer.clearLayers();
                historyAnimatedMarkers.length = 0;

                window.loadedHistoryTracks.forEach(trackObj => {
                    const latLngs = trackObj.path;
                    if (!latLngs || latLngs.length < 2) return;
                    
                    const marker = L.marker(latLngs[0], {
                        icon: buildIcon(trackObj.signalObject),
                        zIndexOffset: 1000
                    }).addTo(historyPlaybackLayer);
                    
                    historyAnimatedMarkers.push({
                        marker: marker,
                        path: latLngs,
                        totalPoints: latLngs.length,
                        duration: Math.max(1, (trackObj.rawPointCount || 2)) * 500
                    });
                });

                const startTime = performance.now();
                let maxDuration = 0;
                historyAnimatedMarkers.forEach(anim => {
                    if (anim.duration > maxDuration) maxDuration = anim.duration;
                });
                
                if (maxDuration === 0) maxDuration = 10000;

                const animate = (time) => {
                    if (!isPlayingHistory) return;
                    
                    let elapsed = performance.now() - startTime;
                    let allFinished = true;
                    
                    historyAnimatedMarkers.forEach(anim => {
                        let progress = Math.min(elapsed / anim.duration, 1);
                        if (progress < 1) allFinished = false;
                        
                        const targetIndexFloat = progress * (anim.totalPoints - 1);
                        const idx1 = Math.floor(targetIndexFloat);
                        const idx2 = Math.ceil(targetIndexFloat);
                        const ratio = targetIndexFloat - idx1;
                        
                        const p1 = anim.path[idx1];
                        const p2 = anim.path[idx2] || p1;
                        
                        const lat = p1[0] + (p2[0] - p1[0]) * ratio;
                        const lng = p1[1] + (p2[1] - p1[1]) * ratio;
                        
                        anim.marker.setLatLng([lat, lng]);
                        
                        if (p2[0] !== p1[0] || p2[1] !== p1[1]) {
                            const dy = p2[0] - p1[0];
                            const dx = Math.cos(Math.PI/180*p1[0])*(p2[1] - p1[1]);
                            const angle = Math.atan2(dx, dy) * 180 / Math.PI;
                            const iconEl = anim.marker.getElement();
                            if (iconEl) {
                                const img = iconEl.querySelector('.MainGuard-marker-image');
                                if (img) {
                                    img.style.transition = 'none'; // Disable CSS transition for smooth JS animation
                                    img.style.transform = `rotate(${angle}deg)`;
                                }
                            }
                        }
                    });

                    if (!allFinished) {
                        historyAnimFrame = requestAnimationFrame(animate);
                    } else {
                        isPlayingHistory = false;
                        btnPlayHistory.innerHTML = '<i class="bi bi-play-fill" style="font-size: 1rem;"></i>';
                        btnPlayHistory.classList.replace("btn-danger", "btn-success");
                        setTimeout(() => {
                            if (!isPlayingHistory) {
                                historyPlaybackLayer.clearLayers();
                                vesselLayer.addTo(map);
                                liveUnitLayer.addTo(map);
                            }
                        }, 2000);
                    }
                };
                
                historyAnimFrame = requestAnimationFrame(animate);
            });
        }

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

        vesselCameraModalEl?.addEventListener("shown.bs.modal", () => {
            const isMapFs = document.fullscreenElement === mapPanel || document.webkitFullscreenElement === mapPanel;
            if (isMapFs) {
                const backdrop = document.querySelector(".modal-backdrop");
                if (backdrop && mapPanel) {
                    mapPanel.appendChild(backdrop);
                }
            }
        });

        const btnToggleWeatherCloud = document.getElementById("btnToggleWeatherCloud");
        let fleetWeatherTimer = null;

        const fetchFleetWeather = async () => {
            if (!showCloudOverlay || vesselMarkers.length === 0) return;
            
            const coords = vesselMarkers.filter(m => typeof m.signalObject.latitude === "number" && typeof m.signalObject.longitude === "number");
            if (coords.length === 0) return;
            
            const lats = coords.map(m => m.signalObject.latitude.toFixed(4)).join(",");
            const lngs = coords.map(m => m.signalObject.longitude.toFixed(4)).join(",");
            
            try {
                const res = await fetch(`${openMeteoApi}?latitude=${lats}&longitude=${lngs}&current=cloud_cover,precipitation,wind_speed_10m`);
                if (res.ok) {
                    const data = await res.json();
                    const results = Array.isArray(data) ? data : [data];
                    results.forEach((r, idx) => {
                        if (r && r.current) {
                            const m = coords[idx];
                            fleetWeatherMap[m.signalObject.deviceId || m.signalObject.name] = r.current;
                        }
                    });
                    
                    vesselMarkers.forEach(m => {
                        if (m.signalObject) m.marker.setIcon(buildIcon(m.signalObject));
                    });
                    
                    if (liveUnitSeed) updateLiveUnitMarker(liveUnitSeed);
                }
            } catch (e) {
                console.warn("Failed to fetch fleet weather", e);
            }
        };

        const fetchFleetMarine = async () => {
            if (!showMarineOverlay || vesselMarkers.length === 0) return;
            
            const coords = vesselMarkers.filter(m => typeof m.signalObject.latitude === "number" && typeof m.signalObject.longitude === "number");
            if (coords.length === 0) return;
            
            const lats = coords.map(m => m.signalObject.latitude.toFixed(4)).join(",");
            const lngs = coords.map(m => m.signalObject.longitude.toFixed(4)).join(",");
            
            try {
                const res = await fetch(`/api/weather-proxy/marine?latitude=${lats}&longitude=${lngs}&current=wave_height,wave_direction`);
                if (res.ok) {
                    const data = await res.json();
                    const results = Array.isArray(data) ? data : [data];
                    results.forEach((r, idx) => {
                        if (r && r.current) {
                            const m = coords[idx];
                            fleetMarineMap[m.signalObject.deviceId || m.signalObject.name] = r.current;
                        }
                    });
                    
                    vesselMarkers.forEach(m => {
                        if (m.signalObject) m.marker.setIcon(buildIcon(m.signalObject));
                    });
                    
                    if (liveUnitSeed) updateLiveUnitMarker(liveUnitSeed);
                }
            } catch (e) {
                console.warn("Failed to fetch fleet marine", e);
            }
        };

        if (btnToggleWeatherCloud) {
            btnToggleWeatherCloud.addEventListener("click", () => {
                showCloudOverlay = !showCloudOverlay;
                btnToggleWeatherCloud.classList.toggle("active", showCloudOverlay);
                
                if (showCloudOverlay) {
                    btnToggleWeatherCloud.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memuat...';
                    fetchFleetWeather().then(() => {
                        btnToggleWeatherCloud.innerHTML = '<i class="bi bi-cloud-sun-fill"></i> Cuaca (Awan)';
                    });
                    fleetWeatherTimer = setInterval(fetchFleetWeather, 5 * 60 * 1000); // 5 mins
                } else {
                    btnToggleWeatherCloud.innerHTML = '<i class="bi bi-cloud-sun"></i> Cuaca (Awan)';
                    if (fleetWeatherTimer) clearInterval(fleetWeatherTimer);
                    fleetWeatherMap = {}; 
                    
                    vesselMarkers.forEach(m => {
                        if (m.signalObject) m.marker.setIcon(buildIcon(m.signalObject));
                    });
                    
                    if (liveUnitSeed) updateLiveUnitMarker(liveUnitSeed);
                }
            });
        }

        const btnToggleMarineWave = document.getElementById("btnToggleMarineWave");
        if (btnToggleMarineWave) {
            btnToggleMarineWave.addEventListener("click", () => {
                showMarineOverlay = !showMarineOverlay;
                btnToggleMarineWave.classList.toggle("active", showMarineOverlay);
                
                if (showMarineOverlay) {
                    btnToggleMarineWave.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memuat...';
                    fetchFleetMarine().then(() => {
                        btnToggleMarineWave.innerHTML = '<i class="bi bi-water"></i> Gelombang';
                    });
                    fleetMarineTimer = setInterval(fetchFleetMarine, 5 * 60 * 1000);
                } else {
                    btnToggleMarineWave.innerHTML = '<i class="bi bi-water"></i> Gelombang';
                    if (fleetMarineTimer) clearInterval(fleetMarineTimer);
                    fleetMarineMap = {}; 
                    
                    vesselMarkers.forEach(m => {
                        if (m.signalObject) m.marker.setIcon(buildIcon(m.signalObject));
                    });
                    
                    if (liveUnitSeed) updateLiveUnitMarker(liveUnitSeed);
                }
            });
        }

        // Fullscreen Toggle Handlers
        const btnMapFullscreen = document.getElementById("btnToggleMapFullscreen");

        if (btnMapFullscreen && mapPanel) {
            const toggleMapFullscreen = () => {
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    if (mapPanel.requestFullscreen) {
                        mapPanel.requestFullscreen();
                    } else if (mapPanel.webkitRequestFullscreen) {
                        mapPanel.webkitRequestFullscreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    }
                }
            };

            btnMapFullscreen.addEventListener("click", toggleMapFullscreen);

            const handleFullscreenChange = () => {
                const isMapFs = document.fullscreenElement === mapPanel || document.webkitFullscreenElement === mapPanel;
                if (isMapFs) {
                    btnMapFullscreen.classList.add("active");
                    btnMapFullscreen.innerHTML = '<i class="bi bi-fullscreen-exit"></i> Keluar Fullscreen';
                    mapPanel.classList.add("is-fullscreen");
                    
                    if (vesselCameraModalEl && document.body.contains(vesselCameraModalEl)) {
                        mapPanel.appendChild(vesselCameraModalEl);
                    }

                    const backdrop = document.querySelector(".modal-backdrop");
                    if (backdrop && document.body.contains(backdrop)) {
                        mapPanel.appendChild(backdrop);
                    }
                } else {
                    btnMapFullscreen.classList.remove("active");
                    btnMapFullscreen.innerHTML = '<i class="bi bi-arrows-fullscreen"></i> Fullscreen';
                    mapPanel.classList.remove("is-fullscreen");
                    
                    if (vesselCameraModalEl && mapPanel.contains(vesselCameraModalEl)) {
                        document.body.appendChild(vesselCameraModalEl);
                    }
                    
                    const backdrop = document.querySelector(".modal-backdrop");
                    if (backdrop && mapPanel.contains(backdrop)) {
                        document.body.appendChild(backdrop);
                    }
                }
                setTimeout(() => {
                    if (window.seaWayMapInstance) {
                        window.seaWayMapInstance.invalidateSize();
                    }
                }, 200);
            };

            document.addEventListener("fullscreenchange", handleFullscreenChange);
            document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
        }

        const btnAppFullscreen = document.getElementById("btnToggleAppFullscreen");
        if (btnAppFullscreen) {
            btnAppFullscreen.addEventListener("click", () => {
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen();
                    } else if (document.documentElement.webkitRequestFullscreen) {
                        document.documentElement.webkitRequestFullscreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    }
                }
            });
        }

        const runSmartAlertScanner = () => {
            let alertCount = 0;
            const alertList = document.getElementById("smartAlertList");
            const alertBadge = document.getElementById("smartAlertBadge");
            const alertEmpty = document.getElementById("smartAlertEmpty");
            const toastContainer = document.getElementById("smartAlertToastContainer");
            if (!alertList || !toastContainer) return;
            
            const items = alertList.querySelectorAll("li:not(.dropdown-header):not(:has(#smartAlertEmpty))");
            items.forEach(item => item.remove());

            signals.forEach(signal => {
                let isAlert = false;
                let alertMessage = "";
                const speed = parseFloat(signal.speedLabel || "0");
                const status = (signal.status || "online").toLowerCase();
                const shipName = signal.unitName || signal.unitCode || signal.name || "Unknown";

                if (status === "offline") {
                    isAlert = true;
                    alertMessage = `Kapal kehilangan sinyal komunikasi.`;
                } else if (speed > 15) {
                    isAlert = true;
                    alertMessage = `Kecepatan melebihi batas (Overspeed: ${speed} knots).`;
                } else if (status === "alert") {
                    isAlert = true;
                    alertMessage = `Terdapat peringatan sistem navigasi.`;
                }

                if (isAlert) {
                    alertCount++;
                    const li = document.createElement("li");
                    li.innerHTML = `<a class="dropdown-item py-2 border-bottom border-secondary border-opacity-25" href="#" style="white-space: normal;">
                                        <div class="fw-bold text-danger mb-1" style="font-size: 0.8rem;"><i class="bi bi-exclamation-triangle-fill me-1"></i> ${escapeHtml(shipName)}</div>
                                        <div class="small text-muted" style="font-size: 0.75rem; line-height: 1.2;">${alertMessage}</div>
                                    </a>`;
                    alertList.appendChild(li);

                    if (alertCount === 1 && !window._smartAlertToastShown) {
                        window._smartAlertToastShown = true;
                        const toastId = "toast_" + Date.now();
                        const toastHtml = `
                            <div id="${toastId}" class="toast bg-danger text-white border-0 shadow-lg" role="alert" aria-live="assertive" aria-atomic="true">
                                <div class="toast-header bg-danger text-white border-white border-opacity-25">
                                    <i class="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
                                    <strong class="me-auto" style="letter-spacing: 0.5px;">SMART ALERT</strong>
                                    <small>Baru saja</small>
                                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                                </div>
                                <div class="toast-body">
                                    <div class="fw-bold mb-1">${escapeHtml(shipName)}</div>
                                    <div style="font-size: 0.85rem;">${alertMessage}</div>
                                </div>
                            </div>
                        `;
                        toastContainer.insertAdjacentHTML("beforeend", toastHtml);
                        const toastEl = document.getElementById(toastId);
                        const toast = new window.bootstrap.Toast(toastEl, { delay: 15000 });
                        toast.show();
                        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
                    }
                }
            });

            if (alertCount > 0) {
                if (alertEmpty) alertEmpty.parentElement.style.display = 'none';
                if (alertBadge) {
                    alertBadge.style.display = 'block';
                    alertBadge.innerText = alertCount;
                }
            } else {
                if (alertEmpty) alertEmpty.parentElement.style.display = 'block';
                if (alertBadge) alertBadge.style.display = 'none';
            }
        };

        setTimeout(runSmartAlertScanner, 1500);
        setInterval(runSmartAlertScanner, 30000);

        renderVessels();
        loadCurrentWeather(lat, lng);
        fetchLiveUnit();
        window.setInterval(fetchLiveUnit, 5000);
    };
})();



