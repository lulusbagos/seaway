import re

with open('wwwroot/js/site.js', 'r', encoding='utf-8') as f:
    code = f.read()

rebuild_func = '''        const rebuildVesselMarkers = () => {
            vesselLayer.clearLayers();
            aisTrailLayer.clearLayers();
            vesselMarkers.length = 0;

            signals.forEach((signal) => {
                if (typeof signal.latitude !== "number" || typeof signal.longitude !== "number") return;
                if (liveUnitSeed && (signal.unitCode === liveUnitSeed.unitCode || signal.name === liveUnitSeed.name)) return;

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
                    unitCode: signal.unitCode || "",
                    unitName: signal.unitName || signal.name || "",
                    unitDetail: signal.unitDetail || "",
                    locationStatus: signal.locationStatus || "lokasi tidak sesuai",
                    locationNote: signal.locationNote || "Koordinat belum divalidasi.",
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

            if (typeof vesselLayer.addLayers === 'function') {
                vesselLayer.addLayers(vesselMarkers.map(m => m.marker));
            } else {
                vesselMarkers.forEach(m => m.marker.addTo(vesselLayer));
            }

            if (liveUnitSeed) updateLiveUnitMarker(liveUnitSeed);
        };'''

if 'const rebuildVesselMarkers = () => {' not in code:
    code = code.replace('        const fetchFleetWeather = async () => {', rebuild_func + '\n\n        const fetchFleetWeather = async () => {')

pattern1 = re.compile(r'vesselLayer\.clearLayers\(\);\s*aisTrailLayer\.clearLayers\(\);\s*vesselMarkers\.length = 0;[\s\S]*?updateVessels\(\);\s*(?:if\s*\(liveUnitSeed\)\s*updateLiveUnitMarker\(liveUnitSeed\);)?', re.DOTALL)
code = pattern1.sub('rebuildVesselMarkers();', code)

pattern2 = re.compile(r'vesselLayer\.clearLayers\(\);\s*aisTrailLayer\.clearLayers\(\);\s*vesselMarkers\.length = 0;[\s\S]*?if\s*\(liveUnitSeed\)\s*updateLiveUnitMarker\(liveUnitSeed\);', re.DOTALL)
code = pattern2.sub('rebuildVesselMarkers();', code)

pattern3 = re.compile(r'const\s+updateVessels\s*=\s*\(\)\s*=>\s*{\s*vesselMarkers\.forEach\(m\s*=>\s*m\.marker\.addTo\(vesselLayer\)\);\s*};\s*updateVessels\(\);\s*(?:if\s*\(liveUnitSeed\)\s*updateLiveUnitMarker\(liveUnitSeed\);)?', re.DOTALL)
code = pattern3.sub('', code)

pattern4 = re.compile(r'const\s+updateVessels\s*=\s*\(\)\s*=>\s*vesselMarkers\.forEach\(m\s*=>\s*m\.marker\.addTo\(vesselLayer\)\);\s*updateVessels\(\);\s*(?:if\s*\(liveUnitSeed\)\s*updateLiveUnitMarker\(liveUnitSeed\);)?', re.DOTALL)
code = pattern4.sub('', code)

with open('wwwroot/js/site.js', 'w', encoding='utf-8') as f:
    f.write(code)
