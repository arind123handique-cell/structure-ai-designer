import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct21.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);

// Go to studio
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(5000);

// Open Concrete Design modal (indigo button in toolbar)
const r1 = await d.evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'Run Concrete Design' && x.offsetParent !== null);
  if (!b) return 'none';
  b.click(); return 'clicked';
})()`);
log('open design modal: ' + r1);
await d.sleepMs(2500);

// In the modal click "Run Design Checks & Apply to Model"
const r2 = await d.evalJs(`(() => {
  const bs = [...document.querySelectorAll('button')];
  const b = bs.find((x) => /Run Design Checks/.test(x.innerText) && x.offsetParent !== null);
  if (!b) return 'none';
  b.click(); return 'clicked:' + b.innerText.trim();
})()`);
log('run design checks: ' + r2);
// Watch dialog state
let state = 'UNKNOWN';
for (let i = 0; i < 40; i++) {
  await d.sleepMs(5000);
  const txt = await d.text();
  if (/Design Complete|Designs applied|All checks pass|PASS/i.test(txt) && !/Running/.test(txt)) { state = 'COMPLETE'; break; }
  if (/failed|error/i.test(txt) && i > 2) { state = 'ERR-LIKE'; break; }
  if (i % 4 === 3) log('  ...still working (' + ((i + 1) * 5) + 's)');
}
log('design modal state: ' + state);
const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools/i.test(e));
log('errors: ' + (errs.length ? errs.slice(0, 6).join(' || ') : '(none)'));

// Now go to Column Design view and run 1-Click Auto-Design All Columns
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Column Design')); b&&b.click(); return !!b; })()`);
await d.sleepMs(4000);
const r3 = await d.evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Auto-Design All Columns') && x.offsetParent !== null);
  if (!b) return 'none';
  b.click(); return 'clicked';
})()`);
log('auto-design columns: ' + r3);
let colState = 'UNKNOWN';
for (let i = 0; i < 40; i++) {
  await d.sleepMs(5000);
  const txt = await d.text();
  if (/Design Complete|All .* columns .* design|PASS/i.test(txt)) { colState = 'COMPLETE'; break; }
  if (i % 4 === 3) log('  ...columns still working (' + ((i + 1) * 5) + 's)');
}
log('columns auto-design state: ' + colState);
await d.sleepMs(2000);
const errs2 = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools/i.test(e));
log('errors after columns: ' + (errs2.length ? errs2.slice(0, 6).join(' || ') : '(none)'));
const t = await d.text();
log('screen tail: ' + t.slice(-500).replace(/\n/g, ' | '));
await d.close();
process.exit(0);
