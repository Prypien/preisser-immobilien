// Sucht die Ursache eines waagerechten Überlaufs, indem es Abschnitte
// nacheinander ausblendet und die Breite neu misst.
//   node _ref/find-overflow.mjs <url> <breite> [auswahl]
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const [url, widthArg, selector = '.lab-widget'] = process.argv.slice(2);
const width = Number(widthArg);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9800 + (Number(process.env.PORT_OFFSET) || 0);

const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1', `--remote-debugging-port=${PORT}`,
  '--window-size=1200,900', '--user-data-dir=/tmp/cdp-find-' + PORT, 'about:blank'], { stdio: 'ignore' });
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
await send('Emulation.setDeviceMetricsOverride', {
  width, height: 800, deviceScaleFactor: 1, mobile: width <= 480,
  screenWidth: width, screenHeight: 800,
});
await send('Page.navigate', { url });
await sleep(2500);

const report = await evaluate(`(() => {
  const de = document.documentElement;
  const base = de.scrollWidth;
  const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
  const culprits = [];
  nodes.forEach((n, i) => {
    const prev = n.style.display;
    n.style.display = 'none';
    const now = de.scrollWidth;
    n.style.display = prev;
    if (now < base) {
      const label = (n.id || n.className || n.tagName) + '';
      culprits.push({ i, label: label.slice(0, 60), ohne: now });
    }
  });
  return JSON.stringify({ vw: de.clientWidth, base, culprits }, null, 1);
})()`);

console.log(report);
ws.close();
process.exit(0);
