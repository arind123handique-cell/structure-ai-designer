import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct20.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(5000);
await d.evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').includes('Run 3D Space Frame') && x.offsetParent !== null);
  b && b.click(); return !!b;
})()`);
await d.sleepMs(2500);

// Click the actual Run button inside the dialog (last matching, role=dialog)
const r = await d.evalJs(`(() => {
  const dlg = [...document.querySelectorAll('[role="dialog"]')].find((x) => (x.getAttribute('aria-label') || '').includes('Run Analysis'));
  if (!dlg) return 'no-dialog';
  const b = [...dlg.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Run Analysis');
  if (!b) return 'no-run-btn';
  b.click(); return 'executed';
})()`);
log('execute: ' + r);

// Poll dialog content for completion or failure states
let state = 'UNKNOWN';
for (let i = 0; i < 40; i++) {
  await d.sleepMs(5000);
  const txt = await d.evalJs(`(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].find((x) => (x.getAttribute('aria-label') || '').includes('Run Analysis'));
    return dlg ? dlg.innerText : '';
  })()`);
  if (/Analysis Complete/.test(txt)) { state = 'COMPLETE'; break; }
  if (/Analysis Failed/.test(txt)) { state = 'FAILED'; break; }
  if (i % 3 === 2) log(`  ...still running (${(i + 1) * 5}s) — ${txt.slice(0, 80).replace(/\n/g, ' ')}`);
}
log('FINAL STATE: ' + state);
const finalTxt = await d.evalJs(`(() => {
  const dlg = [...document.querySelectorAll('[role="dialog"]')].find((x) => (x.getAttribute('aria-label') || '').includes('Run Analysis'));
  return dlg ? dlg.innerText.slice(0, 700) : '(dialog closed)';
})()`);
log('--- dialog text ---\n' + finalTxt);
const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools/i.test(e));
log('errors: ' + (errs.length ? errs.slice(0, 8).join(' || ') : '(none)'));
await d.close();
process.exit(0);
