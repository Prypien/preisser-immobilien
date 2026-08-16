// Misst das Layout einer Seite über das Chrome DevTools Protocol.
//   node _ref/measure.mjs <url> <breite> <ausgabe.json>
// Liefert für jedes sichtbare Element Position, Größe und die wichtigsten
// berechneten Stile – die Grundlage für den Soll/Ist-Vergleich.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const [url, widthArg, outFile] = process.argv.slice(2);
const width = Number(widthArg);
// Realistische Fensterhöhe; die Seite wird vor der Messung einmal komplett
// durchgescrollt, damit alle Scroll-Animationen ihren Endzustand erreichen.
const height = width <= 480 ? 812 : width <= 800 ? 1024 : 900;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222 + (Number(process.env.PORT_OFFSET) || 0);

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${PORT}`,
  `--window-size=${width},${height}`,
  '--user-data-dir=/tmp/cdp-measure-' + PORT,
  'about:blank',
], { stdio: 'ignore' });

const cleanup = () => { try { chrome.kill(); } catch {} };
process.on('exit', cleanup);

let wsUrl;
for (let i = 0; i < 60; i++) {
  await sleep(250);
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch {}
}
if (!wsUrl) { console.error('Chrome nicht erreichbar'); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let nextId = 1;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'Fehler im Seitenkontext');
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url });
await sleep(4500);
// Alle Bilder abwarten, damit Höhen stimmen
await evaluate(`Promise.all([...document.images].filter(i=>!i.complete).map(i=>new Promise(r=>{i.onload=i.onerror=r}))).then(()=>1)`);
await sleep(1000);

// Einmal durch die ganze Seite scrollen, damit Scroll-Animationen auslösen,
// danach zurück nach oben.
await evaluate(`(async () => {
  const step = innerHeight * 0.6;
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    scrollTo(0, y);
    await new Promise(r => setTimeout(r, 90));
  }
  scrollTo(0, document.documentElement.scrollHeight);
  await new Promise(r => setTimeout(r, 800));
  scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 600));
  return 1;
})()`);
await sleep(800);

const data = await evaluate(`(() => {
  const skip = new Set(['SCRIPT','STYLE','DEFS','SYMBOL','PATH','G','CIRCLE','LINEARGRADIENT','STOP','TITLE','BR','USE']);
  const rows = [];
  const walk = (el) => {
    if (skip.has(el.tagName.toUpperCase())) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width > 0 || r.height > 0) {
      const text = [...el.childNodes].filter(n => n.nodeType === 3)
        .map(n => n.textContent.replace(/\\s+/g,' ').trim()).join(' ').trim();
      rows.push({
        tag: el.tagName.toLowerCase(),
        text: text.slice(0, 70),
        x: Math.round(r.left), y: Math.round(r.top + scrollY),
        w: Math.round(r.width), h: Math.round(r.height),
        fs: cs.fontSize, fw: cs.fontWeight, ff: cs.fontFamily.split(',')[0].replace(/["']/g,''),
        color: cs.color, bg: cs.backgroundColor, radius: cs.borderRadius,
        display: cs.display, align: cs.textAlign,
      });
    }
    for (const c of el.children) walk(c);
  };
  walk(document.body);
  const vw = document.documentElement.clientWidth;
  const overflow = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
      overflow.push({ tag: el.tagName.toLowerCase(), cls: (el.getAttribute('class')||'').slice(0,50),
                      left: Math.round(r.left), right: Math.round(r.right) });
    }
  });
  return {
    vw, docHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    overflowCount: overflow.length, overflow: overflow.slice(0, 25),
    rows,
  };
})()`);

writeFileSync(outFile, JSON.stringify(data, null, 1));
console.log(`${url} @${width}: ${data.rows.length} Elemente, Höhe ${data.docHeight}px, ` +
            `scrollWidth ${data.scrollWidth} (Viewport ${data.vw}), Überläufe: ${data.overflowCount}`);
ws.close();
cleanup();
process.exit(0);
