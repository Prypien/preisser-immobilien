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

  var animated = chunks.concat(rollers);

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    animated.forEach(function (el) { el.classList.add('is-running'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.25 });

    animated.forEach(function (el) { observer.observe(el); });

    // Sicherheitsnetz: Was nach zehn Sekunden noch nicht gelaufen ist, wird
    // einfach eingeblendet. Kein Text darf dauerhaft unsichtbar bleiben,
    // nur weil eine Beobachtung nicht ausgelöst hat.
    window.setTimeout(function () {
      animated.forEach(function (el) {
        if (!el.classList.contains('is-running')) el.classList.add('is-running');
      });
    }, 10000);
  }

  /* ---------------------------------------------------------------------
     1b. Zählwerk

     Jede Ziffer wird zu einer Walze: ein senkrechter Streifen mit 0–9,
     zweimal hintereinander. Der Streifen fährt auf die Zielziffer in der
     zweiten Runde — dadurch dreht die Walze einmal ganz durch, bevor sie
     einrastet. Alles außer Ziffern bleibt stehen.
     --------------------------------------------------------------------- */

  var rollers = Array.prototype.slice.call(document.querySelectorAll('[data-roll]'));

  function buildRoll(el) {
    if (el.dataset.built === 'true') return;
    var text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.setAttribute('role', 'text');
    el.textContent = '';

    var digitIndex = 0;
    Array.prototype.forEach.call(text, function (character) {
      if (character < '0' || character > '9') {
        var fixed = document.createElement('span');
        fixed.className = 'roll-fixed';
        fixed.setAttribute('aria-hidden', 'true');
        fixed.textContent = character === ' ' ? ' ' : character;
        el.appendChild(fixed);
        return;
      }

      var column = document.createElement('span');
      column.className = 'roll-col';
      column.setAttribute('aria-hidden', 'true');

      var strip = document.createElement('span');
      strip.className = 'roll-strip';
      for (var pass = 0; pass < 2; pass++) {
        for (var d = 0; d <= 9; d++) {
          var cell = document.createElement('span');
          cell.className = 'roll-cell';
          cell.textContent = String(d);
          strip.appendChild(cell);
        }
      }
      // Zielposition: einmal ganz durch (10) plus die Ziffer selbst.
      strip.style.setProperty('--stop', 10 + Number(character));
      strip.style.setProperty('--i', digitIndex);
      column.appendChild(strip);
      el.appendChild(column);
      digitIndex += 1;
    });

    el.dataset.built = 'true';
  }

  rollers.forEach(buildRoll);

  /* ---------------------------------------------------------------------
     2. Wiederholen — spielt alle Textbewegungen einer Variante erneut ab.
     --------------------------------------------------------------------- */

  document.querySelectorAll('[data-replay]').forEach(function (button) {
    button.addEventListener('click', function () {
      var scope = document.getElementById(button.dataset.replay);
      if (!scope) return;
      scope.querySelectorAll('.chars, [data-roll]').forEach(function (el, i) {
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
