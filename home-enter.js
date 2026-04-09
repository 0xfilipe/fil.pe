(() => {
  const main = document.querySelector("main.home-enter");
  if (!main) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    main.classList.add("home-enter--active");
    return;
  }

  const pieces = main.querySelectorAll("[data-home-enter]");
  const stepS = 0.068;
  const durS = 0.44;
  pieces.forEach((el, i) => {
    el.style.setProperty("--home-enter-delay", `${i * stepS}s`);
    el.style.setProperty("--home-enter-dur", `${durS}s`);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      main.classList.add("home-enter--active");
    });
  });
})();
