// Vollseiten-Screenshot mit exakt emuliertem Viewport.
//   node _ref/shoot.mjs <url> <praefix> <breite> [weitere breiten...]
//
// Chrome erzwingt eine Mindest-Fensterbreite; --window-size allein liefert
// daher bei 375 px ein falsches Layout. Deshalb wird die Größe über
// Emulation.setDeviceMetricsOverride gesetzt.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const [url, prefix, ...widths] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9500 + (Number(process.env.PORT_OFFSET) || 0);

const chrome = spawn(CHROME, [
  '--headless', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${PORT}`,
  '--window-size=1600,1000',
  '--user-data-dir=/tmp/cdp-shoot-' + PORT,
  'about:blank',
], { stdio: 'ignore' });
process.on('exit', () => { try { chrome.kill(); } catch {} });

let wsUrl;
for (let i = 0; i < 60; i++) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch {}
}
if (!wsUrl) { console.error('Chrome nicht erreichbar'); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nextId = 1;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'Fehler');
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');

for (const w of widths) {
  const width = Number(w);
  const height = width <= 480 ? 812 : width <= 800 ? 1024 : 900;
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1,
    mobile: width <= 480,
    screenWidth: width, screenHeight: height,
  });
  await send('Page.navigate', { url });
  await sleep(2000);

  // Erst durchscrollen (löst Scroll-Animationen aus und stößt das
  // Nachladen der Bilder an), dann auf die Bilder warten – mit Zeitlimit,
  // denn Bilder mit loading="lazy" außerhalb des Sichtfelds laden nie und
  // ein unbegrenztes Warten würde hier hängen bleiben.
  await evaluate(`(async () => {
    const step = innerHeight * 0.6;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y); await new Promise(r => setTimeout(r, 80));
    }
    scrollTo(0, 0); await new Promise(r => setTimeout(r, 500));
    return 1;
  })()`);

  // Scroll-Animationen in den Endzustand zwingen. Beim Durchscrollen lösen
  // sie zwar aus, aber ob jede Beobachtung rechtzeitig greift, ist nicht
  // garantiert – für einen Screenshot zählt nur das Endbild.

  // Verbleibende Bilder erzwingen: loading="lazy" aufheben, laden und
  // dekodieren lassen. Ohne decode() sind Bilder zwar geladen, aber beim
  // Auslösen der Aufnahme noch nicht gezeichnet.
  await evaluate(`(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
    await Promise.race([
      Promise.all([...document.images].map(i =>
        i.decode ? i.decode().catch(() => {})
                 : new Promise(r => { i.onload = i.onerror = r }))),
      new Promise(r => setTimeout(r, 12000)),
    ]);
    return 1;
  })()`);
  await evaluate(`(() => {
    document.querySelectorAll('.chars, .board, .kinetic').forEach(e => e.classList.add('is-running'));
    document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-revealed'));
    document.querySelectorAll('[data-mask]').forEach(e => {
      e.style.setProperty('--open', 1); e.classList.add('is-open');
    });
    return 1;
  })()`);

  // Bewegungen ausklingen lassen, sonst wird mitten im Lauf ausgelöst.
  await sleep(2600);

  const info = await evaluate(`JSON.stringify({
    h: document.documentElement.scrollHeight,
    sw: document.documentElement.scrollWidth,
    vw: document.documentElement.clientWidth
  })`);
  const { h, sw, vw } = JSON.parse(info);

  const shot = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height: h, scale: 1 },
  });
  const file = `shots/${prefix}-${width}.png`;
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  const flag = sw > vw ? `  ⚠ waagerechter Überlauf: scrollWidth ${sw} > ${vw}` : '  ✓ kein Überlauf';
  console.log(`${file}  ${width}x${h}${flag}`);
}

ws.close();
process.exit(0);
