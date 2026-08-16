/* =============================================================================
   Preißer Immobilien GmbH — Verhalten
   1. Navigation (Mobilmenü + Aufklappmenü „Leistungen“)
   2. Kartenstapel: scrollabhängiges Auffächern
   3. Einblenden beim Scrollen
   Ohne Abhängigkeiten. Bewegungen respektieren prefers-reduced-motion.
   ========================================================================== */

(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var compact = window.matchMedia('(max-width: 991px)');

  /* ---------------------------------------------------------------------
     1. Navigation
     Im Original gab es unterhalb von 992 px überhaupt keine Navigation –
     das Menü war ausgeblendet und es existierte keine Schaltfläche dafür.
     --------------------------------------------------------------------- */

  var nav = document.querySelector('[data-nav]');
  var navToggle = document.querySelector('[data-nav-toggle]');
  var navMenu = document.querySelector('[data-nav-menu]');

  function setMenu(open) {
    if (!nav || !navToggle) return;
    nav.setAttribute('data-open', open ? 'true' : 'false');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.querySelector('.visually-hidden').textContent = open ? 'Menü schließen' : 'Menü öffnen';
  }

  if (navToggle) {
    setMenu(false);

    navToggle.addEventListener('click', function () {
      setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
    });

    // Auswahl eines Menüpunkts schließt das Mobilmenü.
    navMenu.addEventListener('click', function (event) {
      if (compact.matches && event.target.closest('a')) setMenu(false);
    });

    // Klick außerhalb schließt das Mobilmenü.
    document.addEventListener('click', function (event) {
      if (!compact.matches) return;
      if (nav.contains(event.target)) return;
      setMenu(false);
    });

    // Beim Wechsel auf Desktopbreite den Mobilzustand zurücksetzen.
    compact.addEventListener('change', function () {
      setMenu(false);
      closeDropdowns();
    });
  }

  /* Aufklappmenü „Leistungen“ ------------------------------------------- */

  var dropdowns = Array.prototype.slice.call(document.querySelectorAll('[data-dropdown]'));

  function setDropdown(dropdown, open) {
    var toggle = dropdown.querySelector('[data-dropdown-toggle]');
    var panel = dropdown.querySelector('[data-dropdown-panel]');
    if (!toggle || !panel) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
  }

  function closeDropdowns(except) {
    dropdowns.forEach(function (dropdown) {
      if (dropdown !== except) setDropdown(dropdown, false);
    });
  }

  dropdowns.forEach(function (dropdown) {
    var toggle = dropdown.querySelector('[data-dropdown-toggle]');
    if (!toggle) return;

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      closeDropdowns(dropdown);
      setDropdown(dropdown, open);
    });

    // Auf dem Desktop öffnet bereits der Mauszeiger.
    dropdown.addEventListener('mouseenter', function () {
      if (!compact.matches) setDropdown(dropdown, true);
    });

    dropdown.addEventListener('mouseleave', function () {
      if (!compact.matches) setDropdown(dropdown, false);
    });

    // Tastaturfokus verlässt das Menü -> schließen.
    dropdown.addEventListener('focusout', function (event) {
      if (compact.matches) return;
      if (!dropdown.contains(event.relatedTarget)) setDropdown(dropdown, false);
    });

    dropdown.addEventListener('click', function (event) {
      if (event.target.closest('[data-dropdown-panel] a')) setDropdown(dropdown, false);
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    closeDropdowns();
    if (navToggle && navToggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      navToggle.focus();
    }
  });

  document.addEventListener('click', function (event) {
    dropdowns.forEach(function (dropdown) {
      if (!dropdown.contains(event.target)) setDropdown(dropdown, false);
    });
  });

  /* ---------------------------------------------------------------------
     2. Kartenstapel
     Der Fortschritt (0 … 1) beschreibt, wie weit der Stapel durch das
     Sichtfenster gewandert ist. Die eigentliche Bewegung steckt im CSS.
     --------------------------------------------------------------------- */

  var stacks = Array.prototype.slice.call(document.querySelectorAll('[data-card-stack]'));
  var ticking = false;

  function updateStacks() {
    ticking = false;
    var vh = window.innerHeight;
    stacks.forEach(function (stack) {
      var rect = stack.getBoundingClientRect();
      var progress = (vh - rect.top) / (vh + rect.height);
      progress = Math.min(1, Math.max(0, progress));
      stack.style.setProperty('--reveal', progress.toFixed(4));
    });
  }

  function requestStackUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateStacks);
  }

  if (stacks.length && !reducedMotion.matches) {
    updateStacks();
    window.addEventListener('scroll', requestStackUpdate, { passive: true });
    window.addEventListener('resize', requestStackUpdate);
  }

  /* ---------------------------------------------------------------------
     3. Einblenden beim Scrollen
     --------------------------------------------------------------------- */

  var revealables = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  if (!revealables.length) return;

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-revealed'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });

  revealables.forEach(function (el) { observer.observe(el); });
})();
