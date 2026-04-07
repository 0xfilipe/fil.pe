(() => {
  const TZ = "Europe/Lisbon";
  const LAT = 41.1579;
  const LON = -8.6291;
  /** One budget for fast + optional fallback request (same AbortSignal). */
  const FETCH_TIMEOUT_MS = 12000;
  const RETRY_DELAY_MS = 300;

  const RAIN_CODES = new Set([
    51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
  ]);
  const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
  const SUN_CODES = new Set([0, 1]);
  const FOG_CODES = new Set([45, 48]);

  /** WorldWeatherOnline codes (wttr.in) → WMO-like codes for phrases / easter eggs */
  const WTTR_TO_WMO = {
    113: 0,
    111: 0,
    112: 1,
    116: 2,
    119: 3,
    122: 3,
    143: 45,
    248: 45,
    260: 45,
    263: 51,
    266: 53,
    281: 48,
    284: 48,
    293: 61,
    296: 61,
    299: 63,
    302: 65,
    305: 65,
    308: 65,
    311: 56,
    314: 57,
    317: 66,
    320: 66,
    323: 71,
    326: 71,
    329: 73,
    332: 75,
    335: 75,
    338: 75,
    350: 67,
    353: 80,
    356: 82,
    359: 82,
    362: 80,
    365: 82,
    368: 85,
    371: 86,
    374: 67,
    377: 67,
    386: 95,
    389: 96,
    392: 96,
    395: 99,
    176: 61,
    179: 71,
    182: 66,
    185: 48,
    200: 95,
    227: 86,
    230: 75,
  };

  const elTrigger = document.getElementById("porto-live-trigger");
  const elLine = document.getElementById("porto-line");
  if (!elTrigger || !elLine) return;

  function scriptPathPrefix() {
    const s = document.querySelector('script[src*="weather.js"]');
    if (!s || !s.src) return "";
    try {
      const u = new URL(s.src);
      const base = u.pathname.replace(/\/weather\.js$/i, "");
      if (!base || base === "/") return "";
      return base.replace(/\/$/, "");
    } catch {
      return "";
    }
  }

  let lastCode = null;
  let lastTemp = null;
  let lastPrecipMm = 0;
  let fxLock = false;
  /** Cada clique no trigger (chuva/tempestade ou neve) acrescenta gotas/flocos até ao teto. */
  let rainFxBoost = 0;
  let snowFxBoost = 0;
  let loadState = "loading";
  let hasEverLoaded = false;

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
    if (loadState === "loading") {
      elLine.textContent = `${timeStr()} // …`;
      elTrigger.setAttribute("aria-label", "Loading weather and time in Porto");
      return;
    }
    if (loadState === "error") {
      const line = `${timeStr()} // Weather unavailable`;
      elLine.textContent = line;
      elTrigger.setAttribute("aria-label", line);
      return;
    }
    if (lastCode == null) {
      elLine.textContent = `${timeStr()} // …`;
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

    // WMO 95–99: UI says "Storming" — must match (97/98 were missing from RAIN_CODES)
    if (code >= 95 && code <= 99) return "storm";

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

  /** Visible phase before fade-out (all FX). */
  const FX_ANIM_MS = 4000;
  const FX_LAYER_FADE_MS = 520;
  /** Nevoeiro: backdrop-filter + opacity em browsers costuma “saltar” com fade curto só em opacity. */
  const FOG_LAYER_FADE_MS = 1050;
  const FX_REMOVE_PAD_MS = 80;

  const WX_AUDIO = {
    rain: "wx-rain.mp3",
    thunder: "wx-thunder.mp3",
    wind: "wx-wind.mp3",
    day: "wx-day.mp3",
  };

  function wxAudioHref(filename) {
    const pre = scriptPathPrefix();
    const path = pre
      ? `${pre}/assets/audio/${filename}`
      : `/assets/audio/${filename}`;
    try {
      return new URL(path, location.href).href;
    } catch {
      return path;
    }
  }

  function wxSkipSoundForA11y() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  let wxAudioRegistry = [];

  function registerWxAudio(a, baseVol) {
    a._wxBaseVol = baseVol;
    wxAudioRegistry.push(a);
  }

  function stopAllWxAudio() {
    wxAudioRegistry.forEach((a) => {
      try {
        a.pause();
        a.removeAttribute("src");
        a.load();
      } catch {
        /* ignore */
      }
    });
    wxAudioRegistry = [];
  }

  function fadeOutWxAudio(ms) {
    const list = wxAudioRegistry.slice();
    if (!list.length) return;
    const steps = Math.max(10, Math.min(48, Math.round(ms / 42)));
    const stepMs = ms / steps;
    let frame = 0;
    const step = () => {
      frame += 1;
      const t = Math.min(1, frame / steps);
      list.forEach((a) => {
        const b = a._wxBaseVol;
        if (typeof b !== "number") return;
        a.volume = Math.max(0, b * (1 - t));
      });
      if (frame >= steps) {
        list.forEach((a) => {
          try {
            a.pause();
            a.removeAttribute("src");
            a.load();
          } catch {
            /* ignore */
          }
        });
        wxAudioRegistry = wxAudioRegistry.filter((x) => !list.includes(x));
        return;
      }
      setTimeout(step, stepMs);
    };
    step();
  }

  async function playWxAmbient(key, volume, loop) {
    const file = WX_AUDIO[key];
    if (!file || wxSkipSoundForA11y()) return;
    const a = new Audio();
    a.preload = "auto";
    a.loop = Boolean(loop);
    a.volume = volume;
    a.src = wxAudioHref(file);
    registerWxAudio(a, volume);
    try {
      await a.play();
    } catch {
      wxAudioRegistry = wxAudioRegistry.filter((x) => x !== a);
    }
  }

  function scheduleWxOneShot(href, volume, delayMs) {
    window.setTimeout(() => {
      void playWxOneShot(href, volume);
    }, delayMs);
  }

  async function playWxOneShot(href, volume) {
    if (wxSkipSoundForA11y()) return;
    const a = new Audio();
    a.preload = "auto";
    a.loop = false;
    a.volume = volume;
    a.src = href;
    registerWxAudio(a, volume);
    a.addEventListener(
      "ended",
      () => {
        wxAudioRegistry = wxAudioRegistry.filter((x) => x !== a);
      },
      { once: true }
    );
    try {
      await a.play();
    } catch {
      wxAudioRegistry = wxAudioRegistry.filter((x) => x !== a);
    }
  }

  function beginWxAudioForKind(kind) {
    stopAllWxAudio();
    if (wxSkipSoundForA11y()) return;
    const fadeTail = kind === "fog" ? FOG_LAYER_FADE_MS : FX_LAYER_FADE_MS;
    const thunderHref = wxAudioHref(WX_AUDIO.thunder);
    void (async () => {
      if (kind === "rain") {
        await playWxAmbient("rain", 0.38, true);
      } else if (kind === "storm") {
        await playWxAmbient("rain", 0.24, true);
        const bolts = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < bolts; i += 1) {
          scheduleWxOneShot(
            thunderHref,
            0.16 + Math.random() * 0.1,
            Math.floor(1100 + Math.random() * 2400)
          );
        }
      } else if (kind === "sun") {
        await playWxAmbient("day", 0.2, true);
      } else if (kind === "fog") {
        await playWxAmbient("wind", 0.17, true);
      }
    })();
    setTimeout(() => fadeOutWxAudio(fadeTail), FX_ANIM_MS);
  }

  function fadeOutLayer(el, totalMs) {
    const fadeMs = Math.min(FX_LAYER_FADE_MS, Math.max(280, totalMs - 200));
    const startFade = Math.max(0, totalMs - fadeMs);
    setTimeout(() => {
      el.style.transition = `opacity ${fadeMs / 1000}s ease`;
      requestAnimationFrame(() => {
        el.style.opacity = "0";
      });
    }, startFade);
    setTimeout(() => el.remove(), totalMs + fadeMs + FX_REMOVE_PAD_MS);
  }

  function fadeOutLightning(el, totalMs) {
    const fadeMs = FX_LAYER_FADE_MS;
    const startFade = Math.max(0, totalMs - fadeMs);
    setTimeout(() => {
      el.style.animation = "none";
      el.style.transition = `opacity ${fadeMs / 1000}s ease`;
      requestAnimationFrame(() => {
        el.style.opacity = "0";
      });
    }, startFade);
    setTimeout(() => el.remove(), totalMs + fadeMs + FX_REMOVE_PAD_MS);
  }

  function fadeOutOverlay(el, holdMs) {
    const fadeMs = FX_LAYER_FADE_MS;
    setTimeout(() => {
      el.style.opacity = window.getComputedStyle(el).opacity;
      el.style.animation = "none";
      el.style.transition = `opacity ${fadeMs / 1000}s ease`;
      requestAnimationFrame(() => {
        el.style.opacity = "0";
      });
    }, holdMs);
    setTimeout(() => el.remove(), holdMs + fadeMs + FX_REMOVE_PAD_MS);
  }

  function fadeOutFog(el, holdMs) {
    const fadeMs = FOG_LAYER_FADE_MS;
    const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
    setTimeout(() => {
      const cs = window.getComputedStyle(el);
      el.style.opacity = cs.opacity || "1";
      const bf =
        cs.backdropFilter && cs.backdropFilter !== "none"
          ? cs.backdropFilter
          : "blur(5px)";
      const wbf = cs.getPropertyValue("-webkit-backdrop-filter");
      const wbfUse =
        wbf && wbf !== "none" && wbf.trim() !== "" ? wbf : bf;
      el.style.backdropFilter = bf;
      el.style.setProperty("-webkit-backdrop-filter", wbfUse);
      el.style.animation = "none";
      el.style.willChange = "opacity, backdrop-filter";
      el.style.transition = `opacity ${fadeMs / 1000}s ${ease}, backdrop-filter ${fadeMs / 1000}s ${ease}, -webkit-backdrop-filter ${fadeMs / 1000}s ${ease}`;
      void el.offsetHeight;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.opacity = "0";
          el.style.backdropFilter = "blur(0px)";
          el.style.setProperty("-webkit-backdrop-filter", "blur(0px)");
        });
      });
    }, holdMs);
    setTimeout(() => {
      el.style.willChange = "";
      el.remove();
    }, holdMs + fadeMs + FX_REMOVE_PAD_MS);
  }

  function runRain(opts) {
    const storm = Boolean(opts && opts.storm);
    const layer = document.createElement("div");
    layer.className = storm
      ? "weather-fx-layer weather-fx-rain weather-fx-rain--storm"
      : "weather-fx-layer weather-fx-rain";
    layer.setAttribute("aria-hidden", "true");
    const tier = Math.max(0, rainFxBoost - 1);
    const baseN = storm ? 72 : 42;
    const stepN = storm ? 16 : 11;
    const maxN = storm ? 260 : 175;
    const n = Math.min(maxN, baseN + tier * stepN);
    const durLo = storm ? 0.32 : 0.55;
    const durHi = storm ? 0.22 : 0.35;
    const removeMs = FX_ANIM_MS;
    for (let i = 0; i < n; i += 1) {
      const d = document.createElement("div");
      d.className = "weather-fx-drop";
      d.style.left = `${(i / n) * 100 + Math.random() * 2.5}%`;
      d.style.animationDuration = `${durLo + Math.random() * durHi}s`;
      d.style.animationDelay = `${Math.random() * 0.7}s`;
      d.style.opacity = String(
        storm
          ? 0.8 * (0.88 + Math.random() * 0.12)
          : 0.8 * (0.82 + Math.random() * 0.18)
      );
      layer.appendChild(d);
    }
    document.body.appendChild(layer);
    fadeOutLayer(layer, removeMs);
  }

  function runStorm() {
    runRain({ storm: true });
    const flash = document.createElement("div");
    flash.className = "weather-fx-lightning";
    flash.setAttribute("aria-hidden", "true");
    document.body.appendChild(flash);
    fadeOutLightning(flash, FX_ANIM_MS);
  }

  function runSnow() {
    const layer = document.createElement("div");
    layer.className = "weather-fx-layer weather-fx-snow";
    layer.setAttribute("aria-hidden", "true");
    const tier = Math.max(0, snowFxBoost - 1);
    const baseN = 96;
    const stepN = 24;
    const maxN = 280;
    const n = Math.min(maxN, baseN + tier * stepN);
    const removeMs = FX_ANIM_MS;
    for (let i = 0; i < n; i += 1) {
      const f = document.createElement("div");
      f.className = "weather-fx-flake";
      f.style.left = `${Math.random() * 100}%`;
      f.style.animationDuration = `${2.4 + Math.random() * 2.2}s`;
      f.style.animationDelay = `${Math.random() * 0.85}s`;
      f.style.setProperty("--drift", `${-6 + Math.random() * 18}px`);
      f.style.opacity = String(0.55 + Math.random() * 0.4);
      layer.appendChild(f);
    }
    document.body.appendChild(layer);
    fadeOutLayer(layer, removeMs);
  }

  function runWarm() {
    const el = document.createElement("div");
    el.className = "weather-fx-warmlay";
    el.setAttribute("aria-hidden", "true");
    el.style.opacity = "0";
    el.style.transition = `opacity ${FX_LAYER_FADE_MS / 1000}s ease`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = "1";
      });
    });
    fadeOutOverlay(el, FX_ANIM_MS);
  }

  function runFog() {
    const el = document.createElement("div");
    el.className = "weather-fx-foglay";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    fadeOutFog(el, FX_ANIM_MS);
  }

  function playFxKind(kind) {
    if (fxLock) return false;
    const k = kind || "fog";
    fxLock = true;
    const fadeTail =
      k === "fog" ? FOG_LAYER_FADE_MS : FX_LAYER_FADE_MS;
    const unlockMs = FX_ANIM_MS + fadeTail + FX_REMOVE_PAD_MS + 40;
    if (k !== "snow") beginWxAudioForKind(k);
    if (k === "rain") {
      rainFxBoost += 1;
      runRain();
    } else if (k === "storm") {
      rainFxBoost += 1;
      runStorm();
    } else if (k === "snow") {
      snowFxBoost += 1;
      runSnow();
    }
    else if (k === "sun") runWarm();
    else if (k === "fog") runFog();
    setTimeout(() => {
      fxLock = false;
    }, unlockMs);
    return true;
  }

  function onTrigger() {
    let kind = eggKind(lastCode, lastTemp, lastPrecipMm);
    if (!kind) kind = "fog";
    return playFxKind(kind);
  }

  elTrigger.addEventListener("click", () => {
    onTrigger();
  });

  function canTrySameOriginProxy() {
    if (typeof location === "undefined") return false;
    if (location.protocol !== "http:" && location.protocol !== "https:")
      return false;
    return true;
  }

  function buildProxyUrlFast() {
    const pre = scriptPathPrefix();
    const path = pre ? `${pre}/api/weather` : "/api/weather";
    const url = new URL(path, location.origin);
    url.searchParams.set("latitude", String(LAT));
    url.searchParams.set("longitude", String(LON));
    url.searchParams.set("timezone", TZ);
    return url.toString();
  }

  function buildProxyUrlFull() {
    const pre = scriptPathPrefix();
    const path = pre ? `${pre}/api/weather` : "/api/weather";
    const url = new URL(path, location.origin);
    url.searchParams.set("latitude", String(LAT));
    url.searchParams.set("longitude", String(LON));
    url.searchParams.set("timezone", TZ);
    url.searchParams.set("mode", "full");
    return url.toString();
  }

  function buildForecastUrlFast() {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(LAT));
    url.searchParams.set("longitude", String(LON));
    url.searchParams.set("current_weather", "true");
    url.searchParams.set("timezone", TZ);
    return url.toString();
  }

  function buildForecastUrlFull() {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(LAT));
    url.searchParams.set("longitude", String(LON));
    url.searchParams.set(
      "current",
      "temperature_2m,weather_code,precipitation,rain,showers"
    );
    url.searchParams.set("timezone", TZ);
    return url.toString();
  }

  function buildWttrUrl() {
    const loc = encodeURIComponent(`${LAT},${LON}`);
    return `https://wttr.in/${loc}?format=j1`;
  }

  function wttrCodeToWmo(wttrCode) {
    const w = Number(wttrCode);
    if (!Number.isFinite(w)) return 3;
    const mapped = WTTR_TO_WMO[w];
    return mapped !== undefined ? mapped : 3;
  }

  function applyWttrPayload(d) {
    const row = d && d.current_condition && d.current_condition[0];
    if (!row) return false;
    const wttrCode = normalizeCode(row.weatherCode);
    if (wttrCode == null) return false;
    const temp = Math.round(Number(row.temp_C));
    if (!Number.isFinite(temp)) return false;
    const p = Number(row.precipMM);
    const precipMm = Number.isFinite(p) && p > 0.001 ? p : 0;
    lastCode = wttrCodeToWmo(wttrCode);
    lastTemp = temp;
    lastPrecipMm = precipMm;
    hasEverLoaded = true;
    loadState = "ok";
    renderLine();
    return true;
  }

  function applyPayload(d) {
    const cw = d && d.current_weather;
    if (cw && Number.isFinite(Number(cw.temperature))) {
      const code = normalizeCode(cw.weathercode);
      const temp = Math.round(Number(cw.temperature));
      if (code == null || !Number.isFinite(temp)) return false;
      lastCode = code;
      lastTemp = temp;
      lastPrecipMm = 0;
      hasEverLoaded = true;
      loadState = "ok";
      renderLine();
      return true;
    }

    const c = d && d.current;
    if (!c) return false;

    const code = normalizeCode(c.weather_code);
    const temp = Math.round(Number(c.temperature_2m));
    const precip = Number(c.precipitation);
    const rainMm = Number(c.rain);
    const showersMm = Number(c.showers);
    const mmCandidates = [precip, rainMm, showersMm].filter(Number.isFinite);
    const precipMm =
      mmCandidates.length > 0 ? Math.max(0, ...mmCandidates) : 0;

    if (code == null || !Number.isFinite(temp)) return false;

    lastCode = code;
    lastTemp = temp;
    lastPrecipMm = precipMm;
    hasEverLoaded = true;
    loadState = "ok";
    renderLine();
    return true;
  }

  function applyAnyWeatherJson(d) {
    if (!d) return false;
    if (applyPayload(d)) return true;
    if (applyWttrPayload(d)) return true;
    return false;
  }

  async function fetchJsonFromResponse(r) {
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const raw = await r.text();
    if (!raw || raw.trimStart().startsWith("<")) return null;
    if (!ct.includes("json") && !raw.trimStart().startsWith("{")) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function fetchWeatherOnce(signal) {
    const urls = [];
    urls.push(buildWttrUrl());
    if (canTrySameOriginProxy()) {
      urls.push(buildProxyUrlFast(), buildProxyUrlFull());
    }
    urls.push(buildForecastUrlFast(), buildForecastUrlFull());
    let lastErr = null;
    for (let i = 0; i < urls.length; i += 1) {
      if (signal.aborted) {
        const err = new Error("Aborted");
        err.name = "AbortError";
        throw err;
      }
      try {
        const r = await fetch(urls[i], { signal });
        if (!r.ok) {
          lastErr = new Error("weather");
          continue;
        }
        const d = await fetchJsonFromResponse(r);
        if (applyAnyWeatherJson(d)) return;
        lastErr = new Error("weather");
      } catch (e) {
        lastErr = e;
        if (e && e.name === "AbortError") throw e;
      }
    }
    throw lastErr || new Error("weather");
  }

  async function updateWeather() {
    if (!hasEverLoaded) {
      loadState = "loading";
      renderLine();
    }

    async function attempt(signal) {
      await fetchWeatherOnce(signal);
    }

    const withTimeout = async () => {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
      try {
        await attempt(ac.signal);
      } finally {
        clearTimeout(tid);
      }
    };

    try {
      await withTimeout();
    } catch {
      if (!hasEverLoaded) {
        try {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          await withTimeout();
        } catch {
          lastCode = null;
          lastTemp = null;
          lastPrecipMm = 0;
          loadState = "error";
          renderLine();
        }
      }
    }
  }

  renderLine();
  setInterval(renderLine, 1000);
  updateWeather();
  setInterval(updateWeather, 5 * 60 * 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && loadState === "error") {
      updateWeather();
    }
  });
})();
