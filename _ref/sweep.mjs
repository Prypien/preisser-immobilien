// Prüft eine Seite über viele Viewport-Breiten hinweg auf waagerechten
// Überlauf, zu kleine Tippziele und zu geringen Textkontrast.
//   node _ref/sweep.mjs <url> [breiten...]
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const [url, ...argWidths] = process.argv.slice(2);
const widths = (argWidths.length ? argWidths : [320, 360, 390, 414, 480, 600, 768, 834, 900, 992, 1024, 1280, 1440, 1920]).map(Number);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9700 + (Number(process.env.PORT_OFFSET) || 0);

const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', `--remote-debugging-port=${PORT}`,
  '--window-size=1600,1000', '--user-data-dir=/tmp/cdp-sweep-' + PORT, 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} });

let wsUrl;
for (let i = 0; i < 60; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const p = list.find((t) => t.type === 'page');
    if (p?.webSocketDebuggerUrl) { wsUrl = p.webSocketDebuggerUrl; break; }
  } catch {}
}
if (!wsUrl) { console.error('Chrome nicht erreichbar'); process.exit(1); }
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nextId = 1; const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'Fehler');
  return r.result.value;
};

await send('Page.enable'); await send('Runtime.enable');
console.log(`Prüfung: ${url}\n`);
let problems = 0;

for (const width of widths) {
  const height = width <= 480 ? 812 : 1000;
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width <= 480,
    screenWidth: width, screenHeight: height,
  });
  await send('Page.navigate', { url });
  await sleep(1600);
  // Zeitlimit: Bilder mit loading="lazy" außerhalb des Sichtfelds laden nie,
  // ein unbegrenztes Warten bliebe hier hängen.
  await evaluate(`Promise.race([
    Promise.all([...document.images].filter(i => !i.complete)
      .map(i => new Promise(r => { i.onload = i.onerror = r }))),
    new Promise(r => setTimeout(r, 4000)),
  ]).then(() => 1)`);

  const res = JSON.parse(await evaluate(`(() => {
    const de = document.documentElement, vw = de.clientWidth;
    const over = [];
    document.querySelectorAll('*').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.right > vw + 1) {
        over.push(el.tagName.toLowerCase() + '.' + (el.getAttribute('class')||'').split(' ')[0] +
                  ' [' + Math.round(b.left) + '..' + Math.round(b.right) + ']');
      }
    });
    // Tippziele: interaktive Elemente sollten mindestens 24x24 CSS-Pixel messen.
    const small = [];
    document.querySelectorAll('a, button, [role="button"], input, select').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) return;
      if (getComputedStyle(el).display === 'inline') return;
      if (b.width < 24 || b.height < 24) {
        small.push((el.textContent.trim().slice(0, 22) || el.tagName) + ' ' +
                   Math.round(b.width) + 'x' + Math.round(b.height));
      }
    });
    return JSON.stringify({
      vw, scrollW: de.scrollWidth, docH: de.scrollHeight,
      over: over.slice(0, 6), overN: over.length,
      small: [...new Set(small)].slice(0, 6), smallN: small.length,
    });
  })()`));

  const hasScroll = res.scrollW > res.vw;
  const flags = [];
  if (hasScroll) { flags.push(`waagerechter Überlauf ${res.scrollW}>${res.vw}`); problems++; }
  if (res.smallN) { flags.push(`${res.smallN} zu kleine Tippziele`); problems++; }
  const mark = flags.length ? '✗' : '✓';
  console.log(`${mark} ${String(width).padStart(4)}px  Höhe ${String(res.docH).padStart(5)}  ` +
              (flags.length ? flags.join(', ') : 'in Ordnung'));
  if (hasScroll) res.over.forEach((o) => console.log(`        über den Rand: ${o}`));
  if (res.smallN) res.small.forEach((s) => console.log(`        Tippziel: ${s}`));
}

console.log(problems ? `\n${problems} Befund(e).` : '\nKeine Befunde.');
ws.close();
process.exit(0);
