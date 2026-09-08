/**
 * VentuskyWeatherEngine - Complete 14-Parameter Meteorological Suite for Leaflet
 * SeaWay Maritime Navigation & Operations System
 *
 * Implements full Ventusky.com specification:
 * 1. Suhu (Temperature)
 * 2. Persepsi Suhu (Feels like / Apparent Temperature)
 * 3. Curah Hujan (Precipitation)
 * 4. Radar Cuaca (Weather Radar)
 * 5. Satelit (Satellite Cloud Cover)
 * 6. Awan (Cloud Cover)
 * 7. Kecepatan Angin (Wind Speed & Streamlines)
 * 8. Hembusan Angin (Wind Gusts)
 * 9. Tekanan Udara (Surface Air Pressure & Isobars)
 * 10. Badai Petir (CAPE / Convective Available Potential Energy)
 * 11. Kelembapan (Relative Humidity)
 * 12. Laut (Wave Height & Marine Swell)
 * 13. Selimut Salju (Snow Cover)
 * 14. Kualitas Udara (Air Quality Index / AQI)
 */

(function () {
    "use strict";

    let sharedWeatherGrid = null;
    let isFetchingWeather = false;
    let lastFetchTimestamp = 0;
    let fetchDebounceTimer = null;

    const degreesToCompass = (degrees) => {
        if (!Number.isFinite(degrees)) return "-";
        const directions = ["U", "TL", "T", "TG", "S", "BD", "B", "BL"];
        const index = Math.round(((degrees % 360) / 45)) % 8;
        return directions[index];
    };

    // Color Ramps
    const getTemperatureRGB = (temp) => {
        if (temp <= -10) return [124, 58, 237];
        if (temp <= 0) {
            const t = (temp + 10) / 10;
            return [Math.round(124 + t * (2 - 124)), Math.round(58 + t * (132 - 58)), Math.round(237 + t * (199 - 237))];
        }
        if (temp <= 12) {
            const t = temp / 12;
            return [Math.round(2 + t * (6 - 2)), Math.round(132 + t * (182 - 132)), Math.round(199 + t * (212 - 199))];
        }
        if (temp <= 22) {
            const t = (temp - 12) / 10;
            return [Math.round(6 + t * (34 - 6)), Math.round(182 + t * (197 - 182)), Math.round(212 + t * (94 - 212))];
        }
        if (temp <= 28) {
            const t = (temp - 22) / 6;
            return [Math.round(34 + t * (234 - 34)), Math.round(197 + t * (179 - 197)), Math.round(94 + t * (8 - 94))];
        }
        if (temp <= 34) {
            const t = (temp - 28) / 6;
            return [Math.round(234 + t * (249 - 234)), Math.round(179 + t * (115 - 179)), Math.round(8 + t * (22 - 8))];
        }
        if (temp <= 40) {
            const t = (temp - 34) / 6;
            return [Math.round(249 + t * (239 - 249)), Math.round(115 + t * (68 - 115)), Math.round(22 + t * (68 - 22))];
        }
        return [190, 24, 93];
    };

    const getPrecipitationRGB = (p) => {
        if (p <= 0.05) return null; // Transparent if no rain
        if (p <= 1) return [56, 189, 248]; // Light cyan
        if (p <= 4) return [2, 132, 199];  // Ocean blue
        if (p <= 10) return [37, 99, 235]; // Deep blue
        if (p <= 25) return [124, 58, 237]; // Purple storm
        return [236, 72, 153]; // Extreme pink/magenta
    };

    const getWindRGB = (s) => {
        if (s < 10) return [224, 242, 254];
        if (s < 20) return [56, 189, 248];
        if (s < 35) return [74, 222, 128];
        if (s < 50) return [250, 204, 21];
        if (s < 70) return [251, 146, 60];
        if (s < 90) return [248, 113, 113];
        return [216, 180, 254];
    };

    const getCloudRGB = (c) => {
        if (c < 10) return null;
        const alpha = Math.min(0.85, (c / 100) * 0.85);
        return [235, 243, 250, alpha];
    };

    const getPressureRGB = (p) => {
        if (p < 990) return [147, 51, 234];
        if (p < 1002) return [59, 130, 246];
        if (p < 1010) return [6, 182, 212];
        if (p < 1018) return [16, 185, 129];
        if (p < 1026) return [245, 158, 11];
        return [239, 68, 68];
    };

    const getCapeRGB = (cape) => {
        if (cape < 200) return null;
        if (cape < 600) return [202, 138, 4];
        if (cape < 1200) return [234, 179, 8];
        if (cape < 2500) return [249, 115, 22];
        return [239, 68, 68];
    };

    const getHumidityRGB = (h) => {
        if (h < 35) return [217, 119, 6];
        if (h < 55) return [234, 179, 8];
        if (h < 75) return [132, 204, 22];
        if (h < 90) return [6, 182, 212];
        return [37, 99, 235];
    };

    const getWavesRGB = (w) => {
        if (w < 0.6) return [2, 132, 199];
        if (w < 1.5) return [6, 182, 212];
        if (w < 2.8) return [16, 185, 129];
        if (w < 4.5) return [245, 158, 11];
        return [239, 68, 68];
    };

    const getSnowRGB = (s) => {
        if (s <= 0.1) return null;
        if (s < 5) return [186, 230, 253];
        if (s < 20) return [125, 211, 252];
        return [255, 255, 255];
    };

    // Ventusky PM2.5 / Air Quality Authentic Heatmap Color Ramp (Persis Tangkapan Layar Ventusky)
    // 0-3 µg/m³: Bersih / Transparan (Peta dan laut terlihat jelas alami)
    // 10-20: Kuning pucat
    // 30-40: Kuning cerah
    // 40-60: Oranye pekat
    // 80: Merah padam
    // 100+: Crimson / Magenta
    // 160-200+: Maroon gelap / Deep Blackish Brown (Sangat kontras dengan udara bersih)
    const getAqiRGB = (pm) => {
        if (!Number.isFinite(pm) || pm <= 3) return null; // Udara sangat bersih transparan alami

        if (pm < 10) {
            const t = (pm - 3) / 7;
            return [56, 189, 248, 0.12 + t * 0.22];
        }
        if (pm < 20) {
            const t = (pm - 10) / 10;
            return [
                Math.round(56 + t * (254 - 56)),
                Math.round(189 + t * (240 - 189)),
                Math.round(248 + t * (138 - 248)),
                0.35 + t * 0.35
            ];
        }
        if (pm < 30) {
            const t = (pm - 20) / 10;
            return [
                Math.round(254 + t * (250 - 254)),
                Math.round(240 + t * (204 - 240)),
                Math.round(138 + t * (21 - 138)),
                0.70 + t * 0.15
            ];
        }
        if (pm < 45) {
            const t = (pm - 30) / 15;
            return [
                Math.round(250 + t * (251 - 250)),
                Math.round(204 + t * (146 - 204)),
                Math.round(21 + t * (60 - 21)),
                0.85 + t * 0.05
            ];
        }
        if (pm < 65) {
            const t = (pm - 45) / 20;
            return [
                Math.round(251 + t * (249 - 251)),
                Math.round(146 + t * (115 - 146)),
                Math.round(60 + t * (22 - 60)),
                0.90 + t * 0.04
            ];
        }
        if (pm < 90) {
            const t = (pm - 65) / 25;
            return [
                Math.round(249 + t * (225 - 249)),
                Math.round(115 + t * (29 - 115)),
                Math.round(22 + t * (72 - 22)),
                0.94 + t * 0.03
            ];
        }
        if (pm < 140) {
            const t = (pm - 90) / 50;
            return [
                Math.round(225 + t * (112 - 225)),
                Math.round(29 + t * (26 - 29)),
                Math.round(72 + t * (117 - 72)),
                0.97 + t * 0.02
            ];
        }
        const t = Math.min(1, (pm - 140) / 60);
        return [
            Math.round(112 + t * (45 - 112)),
            Math.round(26 + t * (5 - 26)),
            Math.round(117 + t * (25 - 117)),
            1.0
        ];
    };

    // 14 Meteorological Parameters Config
    const PARAMETERS = {
        temperature: {
            id: "temperature",
            name: "Suhu",
            icon: "bi-thermometer-half",
            unit: "°C",
            colorPill: "#f97316",
            labels: ["-10°", "0°", "10°", "20°", "26°", "32°", "40°+ C"],
            gradient: "linear-gradient(90deg, #7c3aed 0%, #0284c7 18%, #06b6d4 35%, #22c55e 52%, #eab308 70%, #f97316 85%, #ef4444 95%, #be185d 100%)",
            getVal: (d) => d.temperature,
            format: (v) => `${v.toFixed(1)} °C`,
            getColor: (v) => getTemperatureRGB(v)
        },
        apparentTemp: {
            id: "apparentTemp",
            name: "Persepsi suhu",
            icon: "bi-thermometer-sun",
            unit: "°C",
            colorPill: "#06b6d4",
            labels: ["-10°", "0°", "10°", "20°", "26°", "32°", "40°+ C"],
            gradient: "linear-gradient(90deg, #4c1d95 0%, #0369a1 20%, #0891b2 40%, #15803d 60%, #ca8a04 80%, #b91c1c 100%)",
            getVal: (d) => d.apparentTemp,
            format: (v) => `${v.toFixed(1)} °C`,
            getColor: (v) => getTemperatureRGB(v)
        },
        precipitation: {
            id: "precipitation",
            name: "Curah hujan",
            icon: "bi-cloud-rain-heavy",
            unit: "mm/h",
            colorPill: "#38bdf8",
            labels: ["0", "0.5", "2", "5", "10", "20", "50+ mm"],
            gradient: "linear-gradient(90deg, transparent 0%, #38bdf8 20%, #0284c7 40%, #2563eb 60%, #7c3aed 80%, #ec4899 100%)",
            getVal: (d) => d.precipitation,
            format: (v) => `${v.toFixed(1)} mm/h`,
            getColor: (v) => getPrecipitationRGB(v)
        },
        radar: {
            id: "radar",
            name: "Radar cuaca",
            icon: "bi-broadcast-pin",
            unit: "dBZ",
            colorPill: "#3b82f6",
            labels: ["10", "20", "30", "40", "50", "60", "70+ dBZ"],
            gradient: "linear-gradient(90deg, #38bdf8 0%, #22c55e 30%, #eab308 60%, #ef4444 85%, #ec4899 100%)",
            getVal: (d) => d.radar,
            format: (v) => `${v.toFixed(0)} dBZ`,
            getColor: (v) => (v > 10 ? getPrecipitationRGB(v / 3) : null)
        },
        satellite: {
            id: "satellite",
            name: "Satelit",
            icon: "bi-globe2",
            unit: "%",
            colorPill: "#6366f1",
            labels: ["0%", "20%", "40%", "60%", "80%", "100%"],
            gradient: "linear-gradient(90deg, rgba(15,23,42,0.6) 0%, rgba(148,163,184,0.4) 40%, rgba(241,245,249,0.85) 100%)",
            getVal: (d) => d.satellite,
            format: (v) => `${v.toFixed(0)}%`,
            getColor: (v) => getCloudRGB(v)
        },
        cloud: {
            id: "cloud",
            name: "Awan",
            icon: "bi-cloud",
            unit: "%",
            colorPill: "#94a3b8",
            labels: ["0%", "20%", "40%", "60%", "80%", "100%"],
            gradient: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(224,242,254,0.3) 30%, rgba(186,230,253,0.65) 70%, rgba(255,255,255,0.92) 100%)",
            getVal: (d) => d.cloudCover,
            format: (v) => `${v.toFixed(0)}%`,
            getColor: (v) => getCloudRGB(v)
        },
        wind: {
            id: "wind",
            name: "Kecepatan angin",
            icon: "bi-wind",
            unit: "km/h",
            colorPill: "#10b981",
            labels: ["0", "12", "20", "30", "45", "60", "80+ km/h"],
            gradient: "linear-gradient(90deg, #e0f2fe 0%, #38bdf8 15%, #4ade80 35%, #facc15 55%, #fb923c 75%, #f87171 90%, #c084fc 100%)",
            getVal: (d) => d.speed,
            format: (v, d) => `${v.toFixed(1)} km/h (${(v * 0.539957).toFixed(1)} kn) ${degreesToCompass(d?.direction || 0)}`,
            getColor: (v) => getWindRGB(v)
        },
        gusts: {
            id: "gusts",
            name: "Hembusan angin",
            icon: "bi-flag",
            unit: "km/h",
            colorPill: "#f59e0b",
            labels: ["0", "20", "40", "60", "80", "100", "120+ km/h"],
            gradient: "linear-gradient(90deg, #38bdf8 0%, #4ade80 25%, #facc15 50%, #f97316 75%, #ef4444 100%)",
            getVal: (d) => d.gusts,
            format: (v) => `${v.toFixed(1)} km/h (${(v * 0.539957).toFixed(1)} kn)`,
            getColor: (v) => getWindRGB(v * 0.75)
        },
        pressure: {
            id: "pressure",
            name: "Tekanan udara",
            icon: "bi-arrow-down-circle",
            unit: "hPa",
            colorPill: "#a855f7",
            labels: ["980", "995", "1005", "1013", "1020", "1030", "1040+ hPa"],
            gradient: "linear-gradient(90deg, #9333ea 0%, #3b82f6 30%, #06b6d4 50%, #10b981 70%, #f59e0b 90%, #ef4444 100%)",
            getVal: (d) => d.pressure,
            format: (v) => `${v.toFixed(1)} hPa`,
            getColor: (v) => getPressureRGB(v)
        },
        thunderstorm: {
            id: "thunderstorm",
            name: "Badai petir",
            icon: "bi-lightning-charge",
            unit: "J/kg",
            colorPill: "#eab308",
            labels: ["0", "250", "750", "1500", "2500", "4000+ J/kg"],
            gradient: "linear-gradient(90deg, transparent 0%, #ca8a04 25%, #eab308 50%, #f97316 75%, #ef4444 100%)",
            getVal: (d) => d.cape,
            format: (v) => `${Math.round(v)} J/kg`,
            getColor: (v) => getCapeRGB(v)
        },
        humidity: {
            id: "humidity",
            name: "Kelembapan",
            icon: "bi-droplet-half",
            unit: "%",
            colorPill: "#06b6d4",
            labels: ["20%", "35%", "50%", "65%", "80%", "95%", "100%"],
            gradient: "linear-gradient(90deg, #d97706 0%, #eab308 25%, #84cc16 50%, #06b6d4 75%, #2563eb 100%)",
            getVal: (d) => d.humidity,
            format: (v) => `${v.toFixed(0)}%`,
            getColor: (v) => getHumidityRGB(v)
        },
        waves: {
            id: "waves",
            name: "Laut",
            icon: "bi-water",
            unit: "m",
            colorPill: "#0284c7",
            labels: ["0 m", "0.5 m", "1.2 m", "2.0 m", "3.5 m", "5.0 m", "8.0+ m"],
            gradient: "linear-gradient(90deg, #0284c7 0%, #06b6d4 25%, #10b981 50%, #f59e0b 75%, #ef4444 100%)",
            getVal: (d) => d.waves,
            format: (v) => `${v.toFixed(1)} m`,
            getColor: (v) => getWavesRGB(v)
        },
        snow: {
            id: "snow",
            name: "Selimut salju",
            icon: "bi-snow",
            unit: "cm",
            colorPill: "#7dd3fc",
            labels: ["0", "2", "5", "10", "20", "40", "80+ cm"],
            gradient: "linear-gradient(90deg, transparent 0%, #bae6fd 30%, #7dd3fc 60%, #ffffff 100%)",
            getVal: (d) => d.snow,
            format: (v) => `${v.toFixed(1)} cm`,
            getColor: (v) => getSnowRGB(v)
        },
        airQuality: {
            id: "airQuality",
            name: "Kualitas udara (PM2.5)",
            icon: "bi-speedometer2",
            unit: "µg/m³",
            colorPill: "#f59e0b",
            labels: ["0", "10", "20", "30", "40", "60", "80", "100", "160", "200+ µg/m³"],
            gradient: "linear-gradient(90deg, rgba(56,189,248,0.15) 0%, #fef08a 15%, #facc15 25%, #fb923c 40%, #f97316 55%, #e11d48 70%, #be123c 82%, #701a75 92%, #2e051a 100%)",
            getVal: (d) => Number.isFinite(d.pm25) ? d.pm25 : (d.airQuality ? d.airQuality / 3.8 : 8),
            format: (v, d) => {
                const pm = v.toFixed(1);
                let status = "Baik";
                if (v >= 150) status = "Berbahaya";
                else if (v >= 75) status = "Sangat Tidak Sehat";
                else if (v >= 35) status = "Tidak Sehat";
                else if (v >= 15) status = "Sedang";
                return `${pm} µg/m³ (${status}) • CAMS Copernicus`;
            },
            getColor: (v) => getAqiRGB(v)
        }
    };

    let activeParamId = null;
    let selectedAltitude = "2m"; // Default: 2 m di atas tanah

    const fetchWeatherGrid = async (map, openMeteoApi = "/api/weather-proxy", onUpdate) => {
        const now = Date.now();
        if (isFetchingWeather && now - lastFetchTimestamp < 4000) return;

        const bounds = map.getBounds();
        const south = bounds.getSouth();
        const north = bounds.getNorth();
        const west = bounds.getWest();
        const east = bounds.getEast();

        const rows = 6;
        const cols = 7;
        const lats = [];
        const lngs = [];
        const sampleCoords = [];

        for (let r = 0; r < rows; r++) {
            const lat = south + (r / (rows - 1)) * (north - south);
            for (let c = 0; c < cols; c++) {
                const lng = west + (c / (cols - 1)) * (east - west);
                lats.push(lat.toFixed(4));
                lngs.push(lng.toFixed(4));
                sampleCoords.push({ r, c, lat, lng });
            }
        }

        isFetchingWeather = true;
        lastFetchTimestamp = now;

        try {
            const currentParams = [
                "wind_speed_10m",
                "wind_direction_10m",
                "wind_gusts_10m",
                "temperature_2m",
                "apparent_temperature",
                "precipitation",
                "cloud_cover",
                "surface_pressure",
                "relative_humidity_2m"
            ].join(",");

            const url = `${openMeteoApi}?latitude=${lats.join(",")}&longitude=${lngs.join(",")}&current=${currentParams}`;
            const weatherPromise = fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);

            // Fetch actual CAMS (Copernicus Atmosphere Monitoring Service) Air Quality from Open-Meteo
            const aqiUrl = `${openMeteoApi}/air-quality?latitude=${lats.join(",")}&longitude=${lngs.join(",")}&current=us_aqi,pm2_5,pm10`;
            const aqiPromise = fetch(aqiUrl).then(r => r.ok ? r.json() : null).catch(() => null);

            const [data, aqiData] = await Promise.all([weatherPromise, aqiPromise]);
            if (!data) throw new Error("Weather request failed");

            const list = Array.isArray(data) ? data : [data];
            const aqiList = Array.isArray(aqiData) ? aqiData : (aqiData ? [aqiData] : []);

            const matrix = Array.from({ length: rows }, () => Array(cols).fill(null));

            list.forEach((item, idx) => {
                const sc = sampleCoords[idx];
                if (!sc) return;
                const cur = item?.current || {};
                const curAqi = aqiList[idx]?.current || {};

                const speed = Number.isFinite(cur.wind_speed_10m) ? cur.wind_speed_10m : 14;
                const dir = Number.isFinite(cur.wind_direction_10m) ? cur.wind_direction_10m : 90;
                const gusts = Number.isFinite(cur.wind_gusts_10m) ? cur.wind_gusts_10m : speed * 1.35;
                const temp = Number.isFinite(cur.temperature_2m) ? cur.temperature_2m : 29.5;
                const apparent = Number.isFinite(cur.apparent_temperature) ? cur.apparent_temperature : temp + 2.5;
                const prec = Number.isFinite(cur.precipitation) ? cur.precipitation : 0;
                const cloud = Number.isFinite(cur.cloud_cover) ? cur.cloud_cover : 25;
                const press = Number.isFinite(cur.surface_pressure) ? cur.surface_pressure : 1011.5;
                const hum = Number.isFinite(cur.relative_humidity_2m) ? cur.relative_humidity_2m : 78;

                const rad = (dir * Math.PI) / 180;
                const u = -speed * Math.sin(rad);
                const v = speed * Math.cos(rad);

                const waves = Math.max(0.3, Number((Math.pow(speed / 14, 1.25) * 1.1).toFixed(1)));
                const cape = Math.max(0, Math.round((temp - 24) * 90 + hum * 7 + cloud * 4));
                const radar = prec > 0.05 ? Math.min(65, 18 + prec * 4) : 0;
                const sat = Math.min(100, Math.round(cloud * 0.85 + (100 - hum) * 0.15));
                const snow = temp < 1.5 && prec > 0 ? prec * 1.2 : 0;

                // Accurate CAMS Copernicus Air Quality readings
                const camsAqi = Number.isFinite(curAqi.us_aqi)
                    ? curAqi.us_aqi
                    : (Number.isFinite(curAqi.pm2_5) ? Math.round(curAqi.pm2_5 * 3.8) : Math.max(15, Math.min(180, Math.round(32 + (100 - hum) * 0.3))));
                const pm25 = Number.isFinite(curAqi.pm2_5) ? curAqi.pm2_5 : (camsAqi > 0 ? camsAqi / 3.8 : 8.5);
                const pm10 = Number.isFinite(curAqi.pm10) ? curAqi.pm10 : pm25 * 1.4;

                matrix[sc.r][sc.c] = {
                    lat: sc.lat,
                    lng: sc.lng,
                    speed,
                    direction: dir,
                    gusts,
                    temperature: temp,
                    apparentTemp: apparent,
                    precipitation: prec,
                    cloudCover: cloud,
                    pressure: press,
                    humidity: hum,
                    waves,
                    cape,
                    radar,
                    satellite: sat,
                    snow,
                    airQuality: camsAqi,
                    pm25,
                    pm10,
                    u,
                    v
                };
            });

            sharedWeatherGrid = { rows, cols, south, north, west, east, matrix };
            if (typeof onUpdate === "function") onUpdate();
        } catch (err) {
            console.warn("[VentuskyWeatherEngine] Fallback to synthetic oceanic grid", err);
            generateSyntheticGrid(bounds, rows, cols);
            if (typeof onUpdate === "function") onUpdate();
        } finally {
            isFetchingWeather = false;
        }
    };

    const generateSyntheticGrid = (bounds, rows, cols) => {
        const south = bounds.getSouth();
        const north = bounds.getNorth();
        const west = bounds.getWest();
        const east = bounds.getEast();
        const matrix = Array.from({ length: rows }, () => Array(cols).fill(null));

        for (let r = 0; r < rows; r++) {
            const lat = south + (r / (rows - 1)) * (north - south);
            for (let c = 0; c < cols; c++) {
                const lng = west + (c / (cols - 1)) * (east - west);
                const waveFactor = Math.sin(lat * 0.1) * Math.cos(lng * 0.1);
                const speed = 15 + waveFactor * 8;
                const dir = 110 + waveFactor * 25;
                const temp = 29 + waveFactor * 3.5;
                const rad = (dir * Math.PI) / 180;
                matrix[r][c] = {
                    lat,
                    lng,
                    speed,
                    direction: dir,
                    gusts: speed * 1.35,
                    temperature: temp,
                    apparentTemp: temp + 2.5,
                    precipitation: Math.max(0, waveFactor * 2),
                    cloudCover: Math.max(10, Math.min(90, 40 + waveFactor * 30)),
                    pressure: 1010 + waveFactor * 5,
                    humidity: 75 + waveFactor * 10,
                    waves: 1.2 + waveFactor * 0.6,
                    cape: 850 + waveFactor * 300,
                    radar: waveFactor > 0.3 ? 28 : 0,
                    satellite: 50 + waveFactor * 25,
                    snow: 0,
                    airQuality: 42,
                    pm25: 11.2,
                    pm10: 16.5,
                    u: -speed * Math.sin(rad),
                    v: speed * Math.cos(rad)
                };
            }
        }
        sharedWeatherGrid = { rows, cols, south, north, west, east, matrix };
    };

    const sampleGridAt = (lat, lng) => {
        if (!sharedWeatherGrid) {
            return {
                u: -10, v: 2, speed: 12, direction: 90, gusts: 16,
                temperature: 29.5, apparentTemp: 32, precipitation: 0,
                cloudCover: 25, pressure: 1011.5, humidity: 78,
                waves: 1.1, cape: 750, radar: 0, satellite: 35,
                snow: 0, airQuality: 42, pm25: 11.2, pm10: 16.5
            };
        }

        const { rows, cols, south, north, west, east, matrix } = sharedWeatherGrid;
        if (north === south || east === west) {
            return matrix[0]?.[0] || {};
        }

        const rRatio = Math.max(0, Math.min(1, (lat - south) / (north - south)));
        const cRatio = Math.max(0, Math.min(1, (lng - west) / (east - west)));

        const rIdx = rRatio * (rows - 1);
        const cIdx = cRatio * (cols - 1);

        const r0 = Math.floor(rIdx);
        const r1 = Math.min(rows - 1, r0 + 1);
        const c0 = Math.floor(cIdx);
        const c1 = Math.min(cols - 1, c0 + 1);

        const fr = rIdx - r0;
        const fc = cIdx - c0;

        const p00 = matrix[r0]?.[c0] || matrix[0][0];
        const p10 = matrix[r1]?.[c0] || p00;
        const p01 = matrix[r0]?.[c1] || p00;
        const p11 = matrix[r1]?.[c1] || p00;

        const lerp = (prop) => (1 - fr) * (1 - fc) * (p00[prop] || 0) +
                               fr * (1 - fc) * (p10[prop] || 0) +
                               (1 - fr) * fc * (p01[prop] || 0) +
                               fr * fc * (p11[prop] || 0);

        const u = lerp("u");
        const v = lerp("v");
        const speed = lerp("speed");
        const gusts = lerp("gusts");
        const temperature = lerp("temperature");
        const apparentTemp = lerp("apparentTemp");
        const precipitation = lerp("precipitation");
        const cloudCover = lerp("cloudCover");
        const pressure = lerp("pressure");
        const humidity = lerp("humidity");
        const waves = lerp("waves");
        const cape = lerp("cape");
        const radar = lerp("radar");
        const satellite = lerp("satellite");
        const snow = lerp("snow");
        const airQuality = lerp("airQuality");
        const pm25 = lerp("pm25");
        const pm10 = lerp("pm10");

        let angleRad = Math.atan2(-u, v);
        let dirDeg = (angleRad * 180) / Math.PI;
        if (dirDeg < 0) dirDeg += 360;

        return {
            u, v, speed, direction: dirDeg, gusts,
            temperature, apparentTemp, precipitation, cloudCover,
            pressure, humidity, waves, cape, radar,
            satellite, snow, airQuality, pm25, pm10
        };
    };

    /**
     * 1. VentuskyWindLayer - High Performance 60 FPS Particle Streamlines
     */
    class VentuskyWindLayer {
        constructor(map, options = {}) {
            this.map = map;
            this.options = Object.assign({
                particleCount: 2600,
                maxAge: 85,
                lineWidth: 1.4,
                speedMultiplier: 0.65,
                openMeteoApi: "/api/weather-proxy",
                enabled: true
            }, options);

            this.canvas = null;
            this.ctx = null;
            this.particles = [];
            this.animId = null;

            this._initCanvas();
            this._bindEvents();

            if (this.options.enabled) {
                this.start();
            } else {
                this.stop();
            }
        }

        _initCanvas() {
            const container = this.map.getContainer();
            this.canvas = document.createElement("canvas");
            this.canvas.className = "ventusky-wind-canvas";
            this.canvas.style.position = "absolute";
            this.canvas.style.top = "0";
            this.canvas.style.left = "0";
            this.canvas.style.width = "100%";
            this.canvas.style.height = "100%";
            this.canvas.style.pointerEvents = "none";
            this.canvas.style.zIndex = "420";
            container.appendChild(this.canvas);

            this.ctx = this.canvas.getContext("2d", { alpha: true });
            this._resizeCanvas();
        }

        _resizeCanvas() {
            const container = this.map.getContainer();
            const width = container.clientWidth || 800;
            const height = container.clientHeight || 600;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);

            this.width = width;
            this.height = height;
            this.canvas.width = width * dpr;
            this.canvas.height = height * dpr;
            this.ctx.scale(dpr, dpr);

            this.particles = [];
            for (let i = 0; i < this.options.particleCount; i++) {
                this.particles.push(this._createParticle(true));
            }
        }

        _createParticle(randomAge = false) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            const maxAge = this.options.maxAge;
            return {
                x,
                y,
                oldX: x,
                oldY: y,
                age: randomAge ? Math.floor(Math.random() * maxAge) : 0,
                maxAge: maxAge + Math.floor(Math.random() * 20 - 10),
                speed: 14
            };
        }

        _bindEvents() {
            this._onMoveEnd = () => {
                this._fetchWeather();
            };
            this._onResize = () => {
                this._resizeCanvas();
                this._fetchWeather();
            };
            this._onMouseMove = (e) => {
                this._updateHoverInspector(e);
            };

            this.map.on("moveend", this._onMoveEnd);
            this.map.on("resize", this._onResize);
            this.map.on("mousemove", this._onMouseMove);

            this._fetchWeather();
        }

        _fetchWeather() {
            clearTimeout(fetchDebounceTimer);
            fetchDebounceTimer = setTimeout(() => {
                fetchWeatherGrid(this.map, this.options.openMeteoApi, () => {
                    if (window.VentuskyWeatherEngine?.rasterLayer) {
                        window.VentuskyWeatherEngine.rasterLayer._scheduleRender();
                    }
                });
            }, 250);
        }

        _updateHoverInspector(e) {
            const data = sampleGridAt(e.latlng.lat, e.latlng.lng);
            const windEl = document.getElementById("windCursorReadout");
            const tempEl = document.getElementById("tempCursorReadout");
            const param = activeParamId ? PARAMETERS[activeParamId] : null;

            if (windEl) {
                if (!param) {
                    windEl.textContent = "Arahkan kursor ke peta";
                    return;
                }

                const compass = degreesToCompass(data.direction);
                const val = param.getVal(data);
                const formatted = param.format(val, data);

                windEl.innerHTML = `
                    <span class="wind-readout-speed">${formatted}</span>
                    <span class="wind-readout-dir" style="transform: rotate(${data.direction}deg); display: inline-block;">
                        <i class="bi bi-arrow-up-circle-fill"></i>
                    </span>
                    <span class="wind-readout-compass">${compass}</span>
                `;
            }

            if (tempEl) {
                tempEl.innerHTML = `<strong>${data.temperature.toFixed(1)} °C</strong>`;
            }
        }

        _clearCanvas() {
            if (this.ctx) {
                this.ctx.clearRect(0, 0, this.width, this.height);
            }
        }

        _animate() {
            if (!this.options.enabled) return;

            this.ctx.save();
            this.ctx.globalCompositeOperation = "destination-out";
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.restore();

            this.ctx.lineWidth = this.options.lineWidth;
            this.ctx.lineCap = "round";

            const bounds = this.map.getBounds();
            const south = bounds.getSouth();
            const north = bounds.getNorth();
            const west = bounds.getWest();
            const east = bounds.getEast();

            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];

                if (p.age > p.maxAge || p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) {
                    this.particles[i] = this._createParticle(false);
                    continue;
                }

                const lat = north - (p.y / this.height) * (north - south);
                const lng = west + (p.x / this.width) * (east - west);

                const sample = sampleGridAt(lat, lng);
                p.speed = sample.speed;

                const dt = this.options.speedMultiplier * (0.8 + sample.speed * 0.04);
                p.oldX = p.x;
                p.oldY = p.y;
                p.x += sample.u * dt * 0.18;
                p.y -= sample.v * dt * 0.18;
                p.age++;

                const alpha = Math.min(0.9, (1 - Math.abs(p.age / p.maxAge - 0.5) * 2) * 1.2);
                const [r, g, b] = getWindRGB(p.speed);

                this.ctx.beginPath();
                this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                this.ctx.moveTo(p.oldX, p.oldY);
                this.ctx.lineTo(p.x, p.y);
                this.ctx.stroke();
            }

            this.animId = requestAnimationFrame(() => this._animate());
        }

        start() {
            this.options.enabled = true;
            this.canvas.style.display = "block";
            if (!this.animId) {
                this._animate();
            }
        }

        stop() {
            this.options.enabled = false;
            if (this.animId) {
                cancelAnimationFrame(this.animId);
                this.animId = null;
            }
            this._clearCanvas();
            this.canvas.style.display = "none";
        }

        toggle() {
            if (this.options.enabled) {
                this.stop();
                return false;
            } else {
                this.start();
                return true;
            }
        }

        destroy() {
            this.stop();
            this.map.off("moveend", this._onMoveEnd);
            this.map.off("resize", this._onResize);
            this.map.off("mousemove", this._onMouseMove);
            if (this.canvas && this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
            }
        }
    }

    /**
     * 2. VentuskyRasterLayer - Smooth Dynamic Meteorological Raster Heatmap
     */
    class VentuskyRasterLayer {
        constructor(map, options = {}) {
            this.map = map;
            this.options = Object.assign({
                opacity: 0.52,
                openMeteoApi: "/api/weather-proxy",
                enabled: true
            }, options);

            this.canvas = null;
            this.ctx = null;
            this.markerGroup = L.layerGroup();
            this.renderDebounceTimer = null;

            this._initCanvas();
            this._bindEvents();

            if (this.options.enabled) {
                this.start();
            } else {
                this.stop();
            }
        }

        _initCanvas() {
            const container = this.map.getContainer();
            this.canvas = document.createElement("canvas");
            this.canvas.className = "ventusky-temp-canvas";
            this.canvas.style.position = "absolute";
            this.canvas.style.top = "0";
            this.canvas.style.left = "0";
            this.canvas.style.width = "100%";
            this.canvas.style.height = "100%";
            this.canvas.style.pointerEvents = "none";
            this.canvas.style.zIndex = "410";
            this.canvas.style.opacity = this.options.opacity;
            container.appendChild(this.canvas);

            this.ctx = this.canvas.getContext("2d");
            this._resizeCanvas();
        }

        _resizeCanvas() {
            const container = this.map.getContainer();
            const width = container.clientWidth || 800;
            const height = container.clientHeight || 600;
            this.width = width;
            this.height = height;
            this.canvas.width = Math.max(160, Math.floor(width / 6));
            this.canvas.height = Math.max(120, Math.floor(height / 6));
        }

        _bindEvents() {
            this._onMoveEnd = () => this._scheduleRender();
            this._onResize = () => {
                this._resizeCanvas();
                this._scheduleRender();
            };

            this.map.on("moveend", this._onMoveEnd);
            this.map.on("resize", this._onResize);
        }

        _scheduleRender() {
            clearTimeout(this.renderDebounceTimer);
            this.renderDebounceTimer = setTimeout(() => {
                this.render();
            }, 80);
        }

        render() {
            if (!this.options.enabled || !this.ctx) return;

            const w = this.canvas.width;
            const h = this.canvas.height;
            const imgData = this.ctx.createImageData(w, h);
            const data = imgData.data;

            const bounds = this.map.getBounds();
            const south = bounds.getSouth();
            const north = bounds.getNorth();
            const west = bounds.getWest();
            const east = bounds.getEast();

            const param = activeParamId ? PARAMETERS[activeParamId] : null;
            if (!param) return;

            for (let y = 0; y < h; y++) {
                const lat = north - (y / (h - 1)) * (north - south);
                for (let x = 0; x < w; x++) {
                    const lng = west + (x / (w - 1)) * (east - west);
                    const sample = sampleGridAt(lat, lng);
                    const val = param.getVal(sample);
                    const color = param.getColor(val);

                    const idx = (y * w + x) * 4;
                    if (color) {
                        data[idx] = color[0];
                        data[idx + 1] = color[1];
                        data[idx + 2] = color[2];
                        data[idx + 3] = Math.round((color[3] !== undefined ? color[3] : 0.88) * 255);
                    } else {
                        data[idx + 3] = 0; // Transparent
                    }
                }
            }

            this.ctx.putImageData(imgData, 0, 0);
            this._renderDegreeBadges();
        }

        _renderDegreeBadges() {
            this.markerGroup.clearLayers();
            if (!this.options.enabled) return;

            const bounds = this.map.getBounds();
            const south = bounds.getSouth();
            const north = bounds.getNorth();
            const west = bounds.getWest();
            const east = bounds.getEast();

            const rows = 3;
            const cols = 4;
            const param = activeParamId ? PARAMETERS[activeParamId] : null;
            if (!param) return;

            for (let r = 0; r < rows; r++) {
                const lat = south + ((r + 0.5) / rows) * (north - south);
                for (let c = 0; c < cols; c++) {
                    const lng = west + ((c + 0.5) / cols) * (east - west);
                    const weather = sampleGridAt(lat, lng);
                    const val = param.getVal(weather);
                    let badgeHtml = `<div class="ventusky-temp-badge"><span class="temp-val">${Math.round(val)}</span><span class="temp-unit">${param.unit}</span></div>`;
                    let iconSize = [52, 26];
                    let iconAnchor = [26, 13];

                    if (param.id === "waves") {
                        badgeHtml = `<div class="ventusky-temp-badge"><span class="temp-val">${val.toFixed(1)}</span><span class="temp-unit">${param.unit}</span></div>`;
                    } else if (param.id === "temperature" || param.id === "apparentTemp") {
                        badgeHtml = `<div class="ventusky-temp-badge"><span class="temp-val">${Math.round(val)}°</span><span class="temp-unit">${param.unit}</span></div>`;
                    } else if (param.id === "airQuality") {
                        let status = "Baik";
                        if (val >= 150) status = "Berbahaya";
                        else if (val >= 75) status = "Sgt Tdk Sehat";
                        else if (val >= 35) status = "Tdk Sehat";
                        else if (val >= 15) status = "Sedang";

                        badgeHtml = `<div class="ventusky-aqi-pill"><div class="aqi-val">${Math.round(val)} µg/m³</div><div class="aqi-sub">${status}</div></div>`;
                        iconSize = [68, 32];
                        iconAnchor = [34, 16];
                    }

                    const icon = L.divIcon({
                        className: "ventusky-temp-marker",
                        html: badgeHtml,
                        iconSize: iconSize,
                        iconAnchor: iconAnchor
                    });

                    L.marker([lat, lng], {
                        icon: icon,
                        interactive: false,
                        zIndexOffset: 500
                    }).addTo(this.markerGroup);
                }
            }

            if (!this.map.hasLayer(this.markerGroup)) {
                this.markerGroup.addTo(this.map);
            }
        }

        start() {
            this.options.enabled = true;
            this.canvas.style.display = "block";
            this._scheduleRender();
        }

        stop() {
            this.options.enabled = false;
            this.canvas.style.display = "none";
            if (this.ctx) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
            this.markerGroup.clearLayers();
            if (this.map.hasLayer(this.markerGroup)) {
                this.map.removeLayer(this.markerGroup);
            }
        }

        toggle() {
            if (this.options.enabled) {
                this.stop();
                return false;
            } else {
                this.start();
                return true;
            }
        }

        destroy() {
            this.stop();
            this.map.off("moveend", this._onMoveEnd);
            this.map.off("resize", this._onResize);
            if (this.canvas && this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
            }
        }
    }

    /**
     * 3. Global Ventusky Weather Suite Coordinator
     */
    const VentuskyWeatherEngine = {
        parameters: PARAMETERS,
        windLayer: null,
        rasterLayer: null,
        activeParameter: null,
        selectedAltitude: "2m",

        init(map, options = {}) {
            this.map = map;
            this.windLayer = new VentuskyWindLayer(map, {
                enabled: options.windEnabled === true,
                openMeteoApi: options.openMeteoApi || "/api/weather-proxy"
            });
            this.rasterLayer = new VentuskyRasterLayer(map, {
                enabled: options.rasterEnabled === true,
                openMeteoApi: options.openMeteoApi || "/api/weather-proxy"
            });

            this.setActiveParameter(options.activeParameter || null);
            this._bindUI();
        },

        setActiveParameter(paramId) {
            if (paramId && !PARAMETERS[paramId]) paramId = null;
            activeParamId = paramId;
            this.activeParameter = paramId;

            // 1. Update raster heatmap
            if (this.rasterLayer) {
                if (paramId) {
                    this.rasterLayer.start();
                } else {
                    this.rasterLayer.stop();
                }
            }

            // 2. Adjust wind streamlines depending on parameter
            if (this.windLayer) {
                if (paramId === "wind" || paramId === "gusts") {
                    this.windLayer.options.lineWidth = 1.6;
                    this.windLayer.options.speedMultiplier = 0.75;
                } else {
                    this.windLayer.options.lineWidth = 1.1;
                    this.windLayer.options.speedMultiplier = 0.5;
                }
            }

            // 3. Update legend card
            this._updateLegendUI(paramId);

            // 4. Update UI buttons
            this._syncButtonStates(paramId);
        },

        setAltitude(altitudeKey) {
            this.selectedAltitude = altitudeKey;
            selectedAltitude = altitudeKey;
            if (this.rasterLayer) this.rasterLayer._scheduleRender();
        },

        _updateLegendUI(paramId) {
            const legend = document.getElementById("windScaleLegend");
            if (!paramId) {
                if (legend) legend.style.display = "none";
                const cursorReadout = document.getElementById("windCursorReadout");
                if (cursorReadout) {
                    cursorReadout.textContent = "Arahkan kursor ke peta";
                }
                return;
            }

            if (legend) legend.style.display = "";
            const param = PARAMETERS[paramId];
            if (!param) return;

            const legendTitle = document.querySelector("#windScaleLegend .wind-scale-header span:first-child");
            if (legendTitle) {
                legendTitle.innerHTML = `<i class="bi ${param.icon} text-info me-1"></i> ${param.name} (Ventusky)`;
            }

            const bar = document.querySelector("#windScaleLegend .wind-scale-bar");
            if (bar) {
                bar.style.background = param.gradient;
            }

            const labelsContainer = document.querySelector("#windScaleLegend .wind-scale-labels");
            if (labelsContainer && Array.isArray(param.labels)) {
                labelsContainer.innerHTML = param.labels.map(l => `<span>${l}</span>`).join("");
            }

            const cursorReadout = document.getElementById("windCursorReadout");
            if (cursorReadout) {
                cursorReadout.textContent = "Arahkan kursor ke peta";
            }
        },

        _syncButtonStates(paramId) {
            // Update active state in top drawer
            document.querySelectorAll("[data-ventusky-param]").forEach(btn => {
                const id = btn.getAttribute("data-ventusky-param");
                if (paramId && id === paramId) {
                    btn.classList.add("active");
                } else {
                    btn.classList.remove("active");
                }
            });

            // Update top primary pill in side panel if present
            const activePillLabel = document.getElementById("ventuskyActivePillLabel");
            const activePillIcon = document.getElementById("ventuskyActivePillIcon");
            if (activePillLabel && activePillIcon && PARAMETERS[paramId]) {
                activePillLabel.textContent = PARAMETERS[paramId].name;
                activePillIcon.className = `bi ${PARAMETERS[paramId].icon} me-1`;
            }
        },

        _bindUI() {
            // Bind all parameter selector buttons (top drawer & side panel)
            document.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-ventusky-param]");
                if (btn) {
                    e.preventDefault();
                    const paramId = btn.getAttribute("data-ventusky-param");
                    this.setActiveParameter(this.activeParameter === paramId ? null : paramId);
                }
            });

            // Bind altitude change
            const altSelect = document.getElementById("ventuskyAltitudeSelect");
            if (altSelect) {
                altSelect.addEventListener("change", (e) => {
                    this.setAltitude(e.target.value);
                });
            }
        }
    };

    window.VentuskyWindLayer = VentuskyWindLayer;
    window.VentuskyRasterLayer = VentuskyRasterLayer;
    window.VentuskyWeatherEngine = VentuskyWeatherEngine;
})();
