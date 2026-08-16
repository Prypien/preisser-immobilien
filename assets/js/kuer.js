/* =============================================================================
   Kür — Verhalten
   1. Fallblattanzeige (Ziffern als Abflugtafel)
   2. Kinetische Zeilen
   3. Querlauf (senkrechtes Scrollen schiebt waagerecht)
   4. Maskenwechsel (die Bildmarke öffnet sich zum Bild)
   5. Leuchtkontakt (Schein folgt dem Zeiger)

   Ohne Abhängigkeiten. Alles hat einen sichtbaren Ruhezustand: fällt das
   Skript aus, steht der Inhalt trotzdem da.
   ========================================================================== */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var wide = window.matchMedia('(min-width: 992px)');

  // Erst ab hier darf das Stylesheet Ausgangszustände setzen, die ohne
  // Skript falsch wären (Walze auf Null, Blende geschlossen).
  document.documentElement.classList.add('js-anim');

  /* ---------------------------------------------------------------------
     1. Fallblattanzeige
     Jede Ziffer bekommt ein Fenster mit einem Streifen 0–9, zweimal
     hintereinander. Der Streifen fährt in der zweiten Runde auf die
     Zielziffer — die Walze läuft also einmal ganz durch.
     --------------------------------------------------------------------- */

  var boards = Array.prototype.slice.call(document.querySelectorAll('[data-board]'));

  boards.forEach(function (el) {
    var text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.setAttribute('role', 'text');
    el.textContent = '';

    var digit = 0;
    Array.prototype.forEach.call(text, function (character) {
      if (character < '0' || character > '9') {
        var fixed = document.createElement('span');
        fixed.className = 'board-fixed';
        fixed.setAttribute('aria-hidden', 'true');
        fixed.textContent = character === ' ' ? ' ' : character;
        el.appendChild(fixed);
        return;
      }

      var cell = document.createElement('span');
      cell.className = 'board-cell';
      cell.setAttribute('aria-hidden', 'true');

      var strip = document.createElement('span');
      strip.className = 'board-strip';
      for (var pass = 0; pass < 2; pass++) {
        for (var d = 0; d <= 9; d++) {
          var face = document.createElement('span');
          face.className = 'board-face';
          face.textContent = String(d);
          strip.appendChild(face);
        }
      }
      strip.style.setProperty('--stop', 10 + Number(character));
      strip.style.setProperty('--i', digit);
      cell.appendChild(strip);
      el.appendChild(cell);
      digit += 1;
    });
  });

  /* ---------------------------------------------------------------------
     2. Kinetische Zeilen
     Der Text wird an <br> in Zeilen zerlegt; jede Zeile bekommt eine
     eigene Hülle, damit sie hinter ihrer Kante hervorsteigen kann.
     --------------------------------------------------------------------- */

  var kinetics = Array.prototype.slice.call(document.querySelectorAll('[data-kinetic]'));

  kinetics.forEach(function (el) {
    var parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = parts.map(function (part, i) {
      return '<span class="line"><span style="--i:' + i + '">' + part.trim() + '</span></span>';
    }).join('');
    el.classList.add('js-kinetic');
  });

  /* ---------------------------------------------------------------------
     Gemeinsames Auslösen beim Sichtbarwerden
     --------------------------------------------------------------------- */

  var staged = boards.concat(kinetics);

  if (reduced.matches || !('IntersectionObserver' in window)) {
    staged.forEach(function (el) { el.classList.add('is-running'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-running');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.25 });

    staged.forEach(function (el) { observer.observe(el); });

    // Sicherheitsnetz — nichts darf dauerhaft verborgen bleiben.
    window.setTimeout(function () {
      staged.forEach(function (el) { el.classList.add('is-running'); });
    }, 10000);
  }

  /* ---------------------------------------------------------------------
     3. Querlauf
     Die Hülle ist so hoch wie der Streifen breit ist. Wie weit sie
     durchgescrollt ist, bestimmt die waagerechte Verschiebung.
     --------------------------------------------------------------------- */

  var reels = Array.prototype.slice.call(document.querySelectorAll('[data-reel]'));
  var reelTicking = false;

  function layoutReels() {
    reels.forEach(function (reel) {
      var track = reel.querySelector('.reel-track');
      if (!track) return;
      if (!wide.matches) {
        reel.style.height = '';
        track.style.setProperty('--shift', 0);
        return;
      }
      // Zusätzliche Höhe = Überstand des Streifens über das Sichtfenster.
      var extra = Math.max(0, track.scrollWidth - window.innerWidth);
      reel.style.height = (window.innerHeight + extra) + 'px';
    });
  }

  function updateReels() {
    reelTicking = false;
    if (!wide.matches) return;
    reels.forEach(function (reel) {
      var track = reel.querySelector('.reel-track');
      var bar = reel.querySelector('.reel-progress');
      if (!track) return;
      var extra = Math.max(0, track.scrollWidth - window.innerWidth);
      var rect = reel.getBoundingClientRect();
      var travelled = Math.min(Math.max(-rect.top, 0), extra);
      track.style.setProperty('--shift', travelled);
      if (bar) bar.style.setProperty('--progress', extra ? travelled / extra : 0);
    });
  }

  function requestReelUpdate() {
    if (reelTicking) return;
    reelTicking = true;
    window.requestAnimationFrame(updateReels);
  }

  if (reels.length) {
    layoutReels();
    updateReels();
    window.addEventListener('scroll', requestReelUpdate, { passive: true });
    window.addEventListener('resize', function () { layoutReels(); requestReelUpdate(); });
    window.addEventListener('load', function () { layoutReels(); requestReelUpdate(); });
  }

  /* ---------------------------------------------------------------------
     4. Maskenwechsel — die Bildmarke wächst auf und gibt das Bild frei.
     --------------------------------------------------------------------- */

  var masks = Array.prototype.slice.call(document.querySelectorAll('[data-mask]'));

  // Wenn die Blende ganz offen ist, wird die Maske abgeworfen — sonst bliebe
  // eine harte Kante stehen, wo das Zeichen endet.
  function openMask(el) {
    el.style.setProperty('--open', 1);
    window.setTimeout(function () { el.classList.add('is-open'); }, 1500);
  }

  if (masks.length) {
    if (reduced.matches || !('IntersectionObserver' in window)) {
      masks.forEach(function (el) { el.classList.add('is-open'); });
    } else {
      var maskObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          openMask(entry.target);
          maskObserver.unobserve(entry.target);
        });
      }, { threshold: 0.3 });
      masks.forEach(function (el) {
        el.style.setProperty('--open', 0);
        maskObserver.observe(el);
      });
      window.setTimeout(function () {
        masks.forEach(function (el) { el.classList.add('is-open'); });
      }, 10000);
    }
  }

  /* ---------------------------------------------------------------------
     5. Leuchtkontakt — der Schein folgt dem Zeiger, aber nur dort, wo es
     einen gibt. Auf Telefonen bleibt die Ruhelage aus dem Stylesheet.
     --------------------------------------------------------------------- */

  if (fine.matches && !reduced.matches) {
    document.querySelectorAll('[data-spot]').forEach(function (el) {
      el.addEventListener('pointermove', function (event) {
        var rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
        el.style.setProperty('--my', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', function () {
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
      });
    });
  }
})();
