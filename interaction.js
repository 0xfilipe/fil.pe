(() => {
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest("a");
      if (!a || a.target !== "_blank") return;
      if (e.detail > 1) {
        e.preventDefault();
      }
    },
    true
  );

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  let ctx;
  let lastHoverAt = 0;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctx;
  }

  function unlockAudio() {
    const c = getCtx();
    return c.state === "suspended" ? c.resume() : Promise.resolve();
  }

  function playBlip({ frequency, duration, peakGain }) {
    const c = getCtx();
    if (c.state !== "running") return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, c.currentTime);
    const t0 = c.currentTime;
    const attack = 0.004;
    const release = Math.max(duration - attack, 0.012);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + attack + release);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + attack + release + 0.02);
  }

  document.addEventListener(
    "pointerdown",
    () => {
      unlockAudio();
    },
    { once: true, passive: true }
  );

  document
    .querySelectorAll(".chip-link, .work-item-link, .back-icon-button")
    .forEach((el) => {
      el.addEventListener(
        "mouseenter",
        () => {
          const now = performance.now();
          if (now - lastHoverAt < 220) return;
          lastHoverAt = now;
          playBlip({ frequency: 880, duration: 0.028, peakGain: 0.0012 });
        },
        { passive: true }
      );

      el.addEventListener("click", () => {
        unlockAudio().then(() =>
          playBlip({ frequency: 520, duration: 0.04, peakGain: 0.005 })
        );
      });
    });
})();
