import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct14.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);

// Open Run Analysis window directly via the toolbar (▶ Run Analysis exact text)
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(4000);
const r1 = await d.evalJs(`(() => {
  const bs = [...document.querySelectorAll('button')];
  const b = bs.find((x) => x.innerText.includes('Run Analysis') && !x.innerText.includes('Window') && x.offsetParent !== null);
  if (!b) return 'none';
  b.click(); return 'clicked-toolbar';
})()`);
log('open: ' + r1);
await d.sleepMs(3000);
// Click the execute button that lives inside the opened window (has Play icon + Run Analysis)
const r2 = await d.evalJs(`(() => {
  const bs = [...document.querySelectorAll('button')];
  const m = bs.filter((x) => /Run Analysis|Execute|Start/.test(x.innerText) && x.offsetParent !== null);
  const b = m[m.length - 1];
  if (!b) return 'none(' + m.length + ')';
  b.click(); return 'exec:' + b.innerText.trim();
})()`);
log('exec: ' + r2);
// Wait up to 2.5 min, dump whole body innerText to file for inspection
for (let i = 0; i < 24; i++) {
  await d.sleepMs(6000);
  const t = await d.text();
  const state = /Analysis Complete/.test(t) ? 'COMPLETE' : /Running 3D FEM/.test(t) ? 'RUNNING' : /Analysis Failed/.test(t) ? 'FAILED' : 'OTHER';
  log(`t+${(i + 1) * 6}s → ${state}`);
  if (state === 'COMPLETE' || state === 'FAILED') break;
}
const t = await d.text();
const idx = t.indexOf('ANALYSIS');
log('--- window region ---');
log(t.slice(Math.max(0, idx - 200), idx + 1500));
log('--- errors ---');
log([...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools/i.test(e)).slice(0, 8).join(' || ') || '(none)');
await d.close();
process.exit(0);
