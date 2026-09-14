import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct23.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(5000);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('button')].find((x)=>x.innerText.trim()==='Run Concrete Design' && x.offsetParent!==null); b&&b.click(); return !!b; })()`);
await d.sleepMs(2500);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('button')].find((x)=>/Run Design Checks/.test(x.innerText) && x.offsetParent!==null); b&&b.click(); return !!b; })()`);

const t0 = Date.now();
let done = false;
let lastStatus = '';
for (let i = 0; i < 60; i++) {
  await d.sleepMs(5000);
  const info = await d.evalJs(`(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].map(x=>x.innerText).join(' | ');
    const rows = (document.body.innerText.match(/Re-run Design Checks/g) || []).length;
    return { rows, hasDialog: dlg.includes('Run Design Checks'), dlgTail: dlg.slice(-200).replace(/\\n/g,' ') };
  })()`);
  const secs = Math.round((Date.now() - t0) / 1000);
  const status = info.rows > 0 ? 'BUTTON-CHANGED(complete)' : 'RUNNING';
  if (status !== lastStatus) log(`  [${secs}s] ${status} rowsMatch=${info.rows}`);
  lastStatus = status;
  if (info.rows > 0) { done = true; break; }
  if (secs >= 120) break;
}
const secsTotal = Math.round((Date.now() - t0) / 1000);
log(`RESULT: ${done ? 'COMPLETED' : 'STILL-RUNNING'} after ${secsTotal}s`);
const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools/i.test(e));
log('errors: ' + (errs.length ? errs.slice(0, 5).join(' || ') : '(none)'));
log('page responsive check — body text len: ' + ((await d.text()).length));
await d.close();
process.exit(0);
