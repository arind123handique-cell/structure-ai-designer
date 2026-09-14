/**
 * Click-through debug driver (dev only) — drives headless Chrome via CDP.
 * Usage: node cdp-driver.mjs <script-name>
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const APP_URL = process.env.APP_URL || 'http://localhost:5199/';

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + (process.env.TMPDIR || 'C:/Users/Administrator/AppData/Local/Temp') + '/cdp-profile-' + Date.now(),
  '--window-size=1680,1050',
  'about:blank',
], { stdio: 'ignore' });

let wsUrl = null;
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    const j = await res.json();
    wsUrl = j.webSocketDebuggerUrl;
    if (wsUrl) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 300));
}
if (!wsUrl) { console.error('CDP not available'); process.exit(1); }

// Create a fresh page target
const target = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(APP_URL)}`, { method: 'PUT' }).then((r) => r.json());
const pageWs = new WebSocket(target.webSocketDebuggerUrl);

let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const pageErrors = [];

export function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    pageWs.send(JSON.stringify({ id, method, params }));
  });
}

pageWs.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const type = msg.params.type;
    const text = msg.params.args.map((a) => (typeof a.value === 'object' ? JSON.stringify(a.value) : (a.value ?? a.description ?? ''))).join(' ');
    consoleErrors.push(`[${type.toUpperCase()}] ${text}`);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    const text = d.exception?.description || d.text || '';
    pageErrors.push(text);
  }
  if (msg.method === 'Log.entryAdded') {
    consoleErrors.push('[LOG] ' + (msg.params.entry.text || ''));
  }
});

await new Promise((res) => pageWs.addEventListener('open', res, { once: true }));

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function goto(url = APP_URL) {
  await send('Page.navigate', { url });
  await waitFor(() => typeof document !== 'undefined' && document.readyState === 'complete', 15000);
}

export async function waitFor(fn, timeout = 20000, interval = 250) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const v = await evalJs(`(${fn.toString()})()`);
      if (v) return v;
    } catch {}
    await sleep(interval);
  }
  throw new Error('waitFor timeout: ' + fn.toString().slice(0, 120));
}

export async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval error: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result?.value;
}

export async function text() {
  return evalJs('document.body ? document.body.innerText.slice(0, 4000) : ""');
}

export async function sleepMs(ms) { await sleep(ms); }

export async function screenshot(outPath) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  if (r && r.data) {
    fs.writeFileSync(outPath, Buffer.from(r.data, 'base64'));
    return outPath;
  }
  return null;
}

export function getConsoleErrors() { return [...consoleErrors]; }
export function getPageErrors() { return [...pageErrors]; }
export function clearErrors() { consoleErrors.length = 0; pageErrors.length = 0; }

export async function close() {
  try { await send('Page.close'); } catch {}
  chrome.kill();
}

// keep process alive while script drives; the importing script calls close()
globalThis.__driverReady = true;
