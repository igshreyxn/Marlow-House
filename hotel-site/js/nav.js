(function () {
  const toggle = document.querySelector('.hamburger');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open-mobile');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // One-time glow on the hero availability widget to draw the eye,
  // never repeats and respects reduced-motion.
  const widget = document.querySelector('.availability');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (widget && !prefersReducedMotion) {
    setTimeout(() => widget.classList.add('glow'), 200);
  }
})();
