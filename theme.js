(() => {
  const STORAGE_KEY = "fil.pe-theme";
  const FORCED_DARK = "forced-dark";
  const THEME_COLOR_LIGHT = "#f7f7f4";
  const THEME_COLOR_DARK = "#09090b";
  const main = document.querySelector("main");
  const resetMs = 900;

  function isBackdropTarget(t) {
    return (
      t === document.body ||
      t === document.documentElement ||
      t === main
    );
  }

  function clearSelection() {
    const s = window.getSelection();
    if (s && s.rangeCount) s.removeAllRanges();
  }

  document.addEventListener(
    "selectstart",
    (e) => {
      if (isBackdropTarget(e.target)) e.preventDefault();
    },
    true
  );

  document.addEventListener(
    "mousedown",
    (e) => {
      const t = e.target;
      if (
        t &&
        t.nodeType === 1 &&
        typeof t.closest === "function" &&
        t.closest("button, a[href], input, textarea, select")
      ) {
        return;
      }
      if (isBackdropTarget(t)) e.preventDefault();
    },
    true
  );

  function readStored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function effectiveDark() {
    if (document.documentElement.dataset.theme === "dark") return true;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function syncThemeColor() {
    const meta = document.getElementById("meta-theme-color");
    if (!meta) return;
    meta.setAttribute(
      "content",
      effectiveDark() ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
    );
  }

  function setForcedDark(on) {
    if (on) {
      document.documentElement.dataset.theme = "dark";
      try {
        localStorage.setItem(STORAGE_KEY, FORCED_DARK);
      } catch (_) {}
    } else {
      delete document.documentElement.dataset.theme;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
    }
    syncThemeColor();
  }

  function init() {
    try {
      const v = readStored();
      if (v === "light") {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      if (v === "dark" || v === FORCED_DARK) {
        document.documentElement.dataset.theme = "dark";
        if (v === "dark") {
          localStorage.setItem(STORAGE_KEY, FORCED_DARK);
        }
      }
    } catch (_) {}
  }

  init();
  syncThemeColor();

  try {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", syncThemeColor);
  } catch (_) {}

  let count = 0;
  let lastAt = 0;

  document.addEventListener("click", (e) => {
    if (!isBackdropTarget(e.target)) return;

    requestAnimationFrame(clearSelection);

    const now = Date.now();
    if (now - lastAt > resetMs) count = 0;
    lastAt = now;
    count += 1;

    if (count >= 2) {
      count = 0;
      if (document.documentElement.dataset.theme === "dark") {
        setForcedDark(false);
      } else {
        setForcedDark(true);
      }
    }
  });
})();
