(() => {
  const TZ = "Europe/Lisbon";
  const LAT = 41.1579;
  const LON = -8.6291;

  const RAIN_CODES = new Set([
    51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
  ]);
  const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
  const SUN_CODES = new Set([0, 1]);
  const FOG_CODES = new Set([45, 48]);

  const elTrigger = document.getElementById("porto-live-trigger");
  const elLine = document.getElementById("porto-line");
  if (!elTrigger || !elLine) return;

  let lastCode = null;
  let lastTemp = null;
  let lastPrecipMm = 0;
  let fxLock = false;

  function normalizeCode(raw) {
    const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : null;
  }

  function phraseInPorto(code) {
    if (code === 0) return "Sunny";
    if (code === 1) return "Mostly sunny";
    if (code === 2) return "Partly cloudy";
    if (code === 3) return "Overcast";
    if (code === 45 || code === 48) return "Foggy";
    if (code >= 51 && code <= 55) return "Drizzling";
    if (code === 56 || code === 57) return "Freezing drizzle";
    if (code >= 61 && code <= 65) return "Raining";
    if (code === 66 || code === 67) return "Freezing rain";
    if (code >= 71 && code <= 77) return "Snowing";
    if (code >= 80 && code <= 82) return "Showers";
    if (code === 85 || code === 86) return "Snow showers";
    if (code === 95) return "Storming";
    if (code >= 96 && code <= 99) return "Storming";
    return "Cloudy";
  }

  function timeStr() {
    return new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: TZ,
    });
  }

  function renderLine() {
    if (lastCode == null) {
      elLine.textContent = "— // —";
      elTrigger.setAttribute("aria-label", "Weather and time in Porto");
      return;
    }
    const line = `${timeStr()} // ${phraseInPorto(lastCode)} in Porto`;
    elLine.textContent = line;
    elTrigger.setAttribute("aria-label", line);
  }

  function eggKind(code, temp, precipMm) {
    if (code == null || !Number.isFinite(temp)) return null;
    const p = Number(precipMm);
    const precipNow = Number.isFinite(p) && p > 0.001;

    if (RAIN_CODES.has(code)) return "rain";
    if (precipNow) return "rain";
    if (FOG_CODES.has(code)) return "fog";
    if (SUN_CODES.has(code)) return "sun";
    if (SNOW_CODES.has(code)) return "snow";
    if (temp <= 5 && !RAIN_CODES.has(code) && !precipNow) return "snow";
    // Open-Meteo: 2 = partly cloudy, 3 = overcast — common in Porto but not in the sets above
    if (code === 2) return "sun";
    if (code === 3) return "fog";
    return "fog";
  }

  function runRain() {
    const layer = document.createElement("div");
    layer.className = "weather-fx-layer weather-fx-rain";
    layer.setAttribute("aria-hidden", "true");
    const n = 42;
    for (let i = 0; i < n; i += 1) {
      const d = document.createElement("div");
      d.className = "weather-fx-drop";
      d.style.left = `${(i / n) * 100 + Math.random() * 2.5}%`;
      d.style.animationDuration = `${0.55 + Math.random() * 0.35}s`;
      d.style.animationDelay = `${Math.random() * 0.7}s`;
      d.style.opacity = String(0.22 + Math.random() * 0.14);
      layer.appendChild(d);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 3000);
  }

  function runSnow() {
    const layer = document.createElement("div");
    layer.className = "weather-fx-layer weather-fx-snow";
    layer.setAttribute("aria-hidden", "true");
    const n = 36;
    for (let i = 0; i < n; i += 1) {
      const f = document.createElement("div");
      f.className = "weather-fx-flake";
      f.style.left = `${Math.random() * 100}%`;
      f.style.animationDuration = `${1.7 + Math.random() * 0.45}s`;
      f.style.animationDelay = `${Math.random() * 0.4}s`;
      f.style.setProperty("--drift", `${-6 + Math.random() * 18}px`);
      f.style.opacity = String(0.18 + Math.random() * 0.12);
      layer.appendChild(f);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 2000);
  }

  function runWarm() {
    const el = document.createElement("div");
    el.className = "weather-fx-warmlay";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
    });
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 480);
    }, 2000);
  }

  function runFog() {
    const el = document.createElement("div");
    el.className = "weather-fx-foglay";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 0.4s ease";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 420);
    }, 2000);
  }

  function onTrigger() {
    if (fxLock) return false;
    const kind = eggKind(lastCode, lastTemp, lastPrecipMm);
    if (!kind) return false;
    fxLock = true;
    const unlockMs = kind === "rain" ? 3000 : 2100;
    if (kind === "rain") runRain();
    else if (kind === "snow") runSnow();
    else if (kind === "sun") runWarm();
    else if (kind === "fog") runFog();
    setTimeout(() => {
      fxLock = false;
    }, unlockMs);
    return true;
  }

  if (window.PointerEvent) {
    elTrigger.addEventListener("pointerup", (e) => {
      if (!e.isPrimary) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      onTrigger();
    });
  } else {
    elTrigger.addEventListener("click", () => onTrigger());
  }

  elTrigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTrigger();
    }
  });

  async function updateWeather() {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(LAT));
      url.searchParams.set("longitude", String(LON));
      url.searchParams.set(
        "current",
        "temperature_2m,weather_code,precipitation,rain,showers"
      );
      url.searchParams.set("timezone", TZ);

      const r = await fetch(url.toString());
      if (!r.ok) throw new Error("weather");
      const d = await r.json();
      const c = d.current;
      if (!c) throw new Error("weather");

      const code = normalizeCode(c.weather_code);
      const temp = Math.round(Number(c.temperature_2m));
      const precip = Number(c.precipitation);
      const rainMm = Number(c.rain);
      const showersMm = Number(c.showers);
      const mmCandidates = [precip, rainMm, showersMm].filter(Number.isFinite);
      const precipMm =
        mmCandidates.length > 0 ? Math.max(0, ...mmCandidates) : 0;

      lastCode = code;
      lastTemp = Number.isFinite(temp) ? temp : null;
      lastPrecipMm = precipMm;

      if (lastCode == null || lastTemp == null) {
        throw new Error("weather");
      }

      renderLine();
    } catch {
      lastCode = null;
      lastTemp = null;
      lastPrecipMm = 0;
      elLine.textContent = "— // Weather unavailable";
      elTrigger.setAttribute("aria-label", "Weather unavailable");
    }
  }

  renderLine();
  setInterval(renderLine, 1000);
  updateWeather();
  setInterval(updateWeather, 5 * 60 * 1000);
})();
