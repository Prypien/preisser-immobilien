/**
 * Vergleicht zwei Fingerabdrücke (siehe measure.mjs) über den sichtbaren Text.
 *
 *   node _ref/compare.mjs _ref/fp-orig-1440.json _ref/fp-neu-1440.json
 */
import { readFileSync } from 'node:fs';

const [aPath, bPath] = process.argv.slice(2);
const a = JSON.parse(readFileSync(aPath, 'utf8'));
const b = JSON.parse(readFileSync(bPath, 'utf8'));

const pad = (s, n) => String(s).padEnd(n).slice(0, n);

console.log(`\n=== Rahmendaten ===`);
console.log(`Dokumenthöhe   Original ${a.docHeight}   Nachbau ${b.docHeight}   Δ ${b.docHeight - a.docHeight}`);
console.log(`Überläufe      Original ${a.overflow.length}   Nachbau ${b.overflow.length}`);

console.log(`\n=== Abschnitte ===`);
const n = Math.max(a.sections.length, b.sections.length);
for (let i = 0; i < n; i++) {
  const s = a.sections[i], t = b.sections[i];
  console.log(
    `${pad(i, 3)} ${pad(s ? s.tag + ' ' + s.cls : '—', 34)} y=${pad(s?.y ?? '-', 6)} h=${pad(s?.h ?? '-', 6)} │ ` +
    `${pad(t ? t.tag + ' ' + t.cls : '—', 30)} y=${pad(t?.y ?? '-', 6)} h=${pad(t?.h ?? '-', 6)} ` +
    `${s && t ? 'Δh ' + (t.h - s.h) : ''}`
  );
}

// Textknoten beider Seiten gegenüberstellen
const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
const byText = (rows) => {
  const map = new Map();
  rows.filter(r => r.text.length > 3).forEach(r => {
    const k = norm(r.text);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return map;
};

const ma = byText(a.rows), mb = byText(b.rows);

console.log(`\n=== Text nur im Original ===`);
let missing = 0;
for (const k of ma.keys()) if (!mb.has(k)) { console.log('  – ' + k.slice(0, 90)); missing++; }
if (!missing) console.log('  (keiner)');

console.log(`\n=== Text nur im Nachbau ===`);
let extra = 0;
for (const k of mb.keys()) if (!ma.has(k)) { console.log('  + ' + k.slice(0, 90)); extra++; }
if (!extra) console.log('  (keiner)');

console.log(`\n=== Abweichungen bei gemeinsamen Texten ===`);
console.log(pad('Text', 44) + pad('x  orig→neu', 18) + pad('y  orig→neu', 20) + pad('Breite', 16) + pad('Schriftgröße', 18) + 'Schrift');
const diffs = [];
for (const [k, rowsA] of ma) {
  const rowsB = mb.get(k);
  if (!rowsB) continue;
  const ra = rowsA[0], rb = rowsB[0];
  const dx = rb.x - ra.x, dy = rb.y - ra.y, dw = rb.w - ra.w;
  const fsDiff = ra.fs !== rb.fs, ffDiff = ra.ff !== rb.ff, colDiff = ra.color !== rb.color;
  if (Math.abs(dx) > 3 || Math.abs(dw) > 6 || fsDiff || ffDiff || colDiff || Math.abs(dy) > 24) {
    diffs.push({ k, ra, rb, dx, dy, dw, fsDiff, ffDiff, colDiff });
  }
}
diffs.sort((p, q) => Math.abs(q.dx) + Math.abs(q.dw) - Math.abs(p.dx) - Math.abs(p.dw));
for (const d of diffs.slice(0, 45)) {
  console.log(
    pad(d.k, 44) +
    pad(`${d.ra.x}→${d.rb.x} (${d.dx >= 0 ? '+' : ''}${d.dx})`, 18) +
    pad(`${d.ra.y}→${d.rb.y} (${d.dy >= 0 ? '+' : ''}${d.dy})`, 20) +
    pad(`${d.ra.w}→${d.rb.w} (${d.dw >= 0 ? '+' : ''}${d.dw})`, 16) +
    pad(d.fsDiff ? `${d.ra.fs}→${d.rb.fs}` : d.ra.fs, 18) +
    (d.ffDiff ? `${d.ra.ff}→${d.rb.ff}` : '') + (d.colDiff ? `  Farbe ${d.ra.color}→${d.rb.color}` : '')
  );
}
if (!diffs.length) console.log('  (keine)');
console.log(`\n${diffs.length} abweichende Textknoten von ${ma.size} gemeinsamen.`);
