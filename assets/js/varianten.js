/* =============================================================================
   Gestaltungsvarianten — Verhalten
   1. Zeichenweise Bewegung (jedes Zeichen dreht einzeln herein)
   2. Wiederholen-Schaltflächen
   3. Reiter im etg24-Entwurf
   Ohne Abhängigkeiten. Bewegungen respektieren prefers-reduced-motion.
   ========================================================================== */

(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------------
     1. Zeichenweise Bewegung

     Der sichtbare Text wird in einzelne Elemente zerlegt, jedes bekommt
     seinen Platz in der Reihe als CSS-Variable. Für Vorlesewerkzeuge bleibt
     der ursprüngliche Text über aria-label erhalten; die Bruchstücke selbst
     werden ausgeblendet, damit sie nicht Zeichen für Zeichen vorgelesen
     werden.
     --------------------------------------------------------------------- */

  var chunks = Array.prototype.slice.call(document.querySelectorAll('.chars'));

  function split(el) {
    if (el.dataset.split === 'true') return;
    var text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.setAttribute('role', 'text');
    el.textContent = '';

    var index = 0;
    Array.prototype.forEach.call(text, function (character) {
      var span = document.createElement('span');
      span.className = 'char';
      span.setAttribute('aria-hidden', 'true');
      // Geschütztes Leerzeichen, damit die Lücke beim Umbruch erhalten bleibt.
      span.textContent = character === ' ' ? ' ' : character;
      span.style.setProperty('--i', index);
      el.appendChild(span);
      // Leerzeichen zählen nicht mit — sonst entstehen sichtbare Löcher
      // im Rhythmus der Verzögerungen.
      if (character !== ' ') index += 1;
    });

    el.dataset.split = 'true';
  }

  function run(el) {
    el.classList.remove('is-running');
    // Erzwingt einen Umbruch im Stilbaum, damit die Bewegung neu startet.
    void el.offsetWidth;
    el.classList.add('is-running');
  }

  chunks.forEach(split);

  // Erst ab hier darf das Stylesheet die Zeichen verstecken. Bricht das
  // Skript vorher ab, bleibt der Text sichtbar.
  document.documentElement.classList.add('js-anim');

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    chunks.forEach(function (el) { el.classList.add('is-running'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.25 });

    chunks.forEach(function (el) { observer.observe(el); });

    // Sicherheitsnetz: Was nach zehn Sekunden noch nicht gelaufen ist, wird
    // einfach eingeblendet. Kein Text darf dauerhaft unsichtbar bleiben,
    // nur weil eine Beobachtung nicht ausgelöst hat.
    window.setTimeout(function () {
      chunks.forEach(function (el) {
        if (!el.classList.contains('is-running')) el.classList.add('is-running');
      });
    }, 10000);
  }

  /* ---------------------------------------------------------------------
     2. Wiederholen — spielt alle Textbewegungen einer Variante erneut ab.
     --------------------------------------------------------------------- */

  document.querySelectorAll('[data-replay]').forEach(function (button) {
    button.addEventListener('click', function () {
      var scope = document.getElementById(button.dataset.replay);
      if (!scope) return;
      scope.querySelectorAll('.chars').forEach(function (el, i) {
        el.classList.remove('is-running');
        void el.offsetWidth;
        // Die Blöcke starten leicht versetzt, sonst wirkt es wie ein Ruck.
        window.setTimeout(function () { el.classList.add('is-running'); }, i * 90);
      });
    });
  });

  /* ---------------------------------------------------------------------
     3. Reiter im etg24-Entwurf
     --------------------------------------------------------------------- */

  document.querySelectorAll('[data-tabs]').forEach(function (group) {
    var tabs = Array.prototype.slice.call(group.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    function select(tab) {
      tabs.forEach(function (other) {
        var selected = other === tab;
        other.setAttribute('aria-selected', selected ? 'true' : 'false');
        other.setAttribute('tabindex', selected ? '0' : '-1');
        var panel = document.getElementById(other.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { select(tab); });

      // Pfeiltasten wechseln den Reiter, wie es für Reitergruppen üblich ist.
      tab.addEventListener('keydown', function (event) {
        var step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        var next = tabs[(index + step + tabs.length) % tabs.length];
        select(next);
        next.focus();
      });
    });

    select(tabs[0]);
  });
})();
