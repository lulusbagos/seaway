const fs = require('fs');
let code = fs.readFileSync('wwwroot/js/site.js', 'utf8');

const t1 = `        const btnToggleWeatherCloud = document.getElementById("btnToggleWeatherCloud");
        let fleetWeatherTimer = null;

        const fetchFleetWeather = async () => {`;

const r1 = `        const btnToggleWeatherCloud = document.getElementById("btnToggleWeatherCloud");
        let fleetWeatherTimer = null;

        const rebuildVesselMarkers = () => {
            vesselLayer.clearLayers();
            aisTrailLayer.clearLayers();
            vesselMarkers.length = 0;

            signals.forEach((signal) => {
                if (typeof signal.latitude !== "number" || typeof signal.longitude !== "number") return;
                if (liveUnitSeed && (signal.unitCode === liveUnitSeed.unitCode || signal.name === liveUnitSeed.name)) return;

                const devId = signal.deviceId || "";
                const cameraUrl = signal.cameraUrl || (devId ? \`https://lenzguard.com/808gps/open/player/video.html?lang=en&devIdno=\${devId}&account=GLJ01&password=123456\` : "");

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
                vesselMarkers.push({ marker, status: (signal.status || "online").toLowerCase() });

                // Restore Trail
                if (signalObject.trail && Array.isArray(signalObject.trail) && signalObject.trail.length > 1) {
                    const trailCoords = signalObject.trail.map(t => [t.latitude, t.longitude]);
                    L.polyline(trailCoords, {
                        color: "rgba(0, 240, 255, 0.4)",
                        weight: 2,
                        dashArray: "4, 8"
                    }).addTo(aisTrailLayer);
                }
            });

            if (typeof vesselLayer.addLayers === 'function') {
                vesselLayer.addLayers(vesselMarkers.map(m => m.marker));
            } else {
                vesselMarkers.forEach(m => m.marker.addTo(vesselLayer));
            }

            if (liveUnitSeed) updateLiveUnitMarker(liveUnitSeed);
        };

        const fetchFleetWeather = async () => {`;

code = code.replace(t1, r1);

const t2 = `                    // Refresh marker UI without recreating the map
                    vesselLayer.clearLayers();
                    aisTrailLayer.clearLayers();
                    vesselMarkers.length = 0;
                    
                    signals.forEach((signal) => {
                        if (typeof signal.latitude !== "number" || typeof signal.longitude !== "number") return;
                        if (liveUnitSeed && (signal.unitCode === liveUnitSeed.unitCode || signal.name === liveUnitSeed.name)) return;

                        const devId = signal.deviceId || "";
                        const cameraUrl = signal.cameraUrl || (devId ? \`https://lenzguard.com/808gps/open/player/video.html?lang=en&devIdno=\${devId}&account=GLJ01&password=123456\` : "");

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
                    
                    const updateVessels = () => {
                        vesselMarkers.forEach(m => m.marker.addTo(vesselLayer));
                    };
                    updateVessels();
                    
                    if (liveUnitSeed) updateLiveUnitMarker(liveUnitSeed);`;

const r2 = `                    // Refresh marker UI without recreating the map
                    rebuildVesselMarkers();`;

code = code.replace(t2, r2);

const t3 = `                    vesselLayer.clearLayers();
                    aisTrailLayer.clearLayers();
                    vesselMarkers.length = 0;
                    
                    signals.forEach((signal) => {
                        if (typeof signal.latitude !== "number" || typeof signal.longitude !== "number") return;
                        if (liveUnitSeed && (signal.unitCode === liveUnitSeed.unitCode || signal.name === liveUnitSeed.name)) return;
                        const devId = signal.deviceId || "";
                        const cameraUrl = signal.cameraUrl || (devId ? \`https://lenzguard.com/808gps/open/player/video.html?lang=en&devIdno=\${devId}&account=GLJ01&password=123456\` : "");

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
                        vesselMarkers.push({ marker, status: (signal.status || "online").toLowerCase() });
                    });
                    
                    const updateVessels = () => vesselMarkers.forEach(m => m.marker.addTo(vesselLayer));
                    updateVessels();
                    if (liveUnitSeed) updateLiveUnitMarker(liveUnitSeed);`;

const r3 = `                    rebuildVesselMarkers();`;

code = code.replace(t3, r3);


const t4 = `                    vesselLayer.clearLayers();
                    aisTrailLayer.clearLayers();
                    vesselMarkers.length = 0;
                    signals.forEach((signal) => {
                        if (typeof signal.latitude !== "number" || typeof signal.longitude !== "number") return;
                        if (liveUnitSeed && (signal.unitCode === liveUnitSeed.unitCode || signal.name === liveUnitSeed.name)) return;
                        const devId = signal.deviceId || "";
                        const cameraUrl = signal.cameraUrl || (devId ? \`https://lenzguard.com/808gps/open/player/video.html?lang=en&devIdno=\${devId}&account=GLJ01&password=123456\` : "");

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
                        vesselMarkers.push({ marker, status: (signal.status || "online").toLowerCase() });
                    });
                    vesselMarkers.forEach(m => m.marker.addTo(vesselLayer));
                    if (liveUnitSeed) updateLiveUnitMarker(liveUnitSeed);`;

// There are TWO of these (btnToggleWeatherCloud else block, btnToggleMarineWave else block)
code = code.replaceAll(t4, r3);

fs.writeFileSync('wwwroot/js/site.js', code);
console.log('Success!');
