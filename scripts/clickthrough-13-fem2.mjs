import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct13.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);
log('booted. members: ' + ((await d.text()).match(/\d+ Members/) || ['?'])[0]);

const waitForText = (text, ms) =>
  d.evalJs(`(async () => {
    const t = ${JSON.stringify(text)};
    const start = Date.now();
    while (Date.now() - start < ${ms}) {
      if (document.body && document.body.innerText.includes(t)) return true;
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  })()`).catch(() => false);

// Studio from sidebar
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(4000);
// Menu item: "Run Analysis (Window)..."
const r1 = await d.evalJs(`(() => {
  const bs = [...document.querySelectorAll('button')];
  const b = bs.find((x) => x.innerText.includes('Run Analysis (Window)') && x.offsetParent !== null);
  if (!b) return 'none';
  b.click(); return 'menu-opened';
})()`);
log('menu: ' + r1);
await d.sleepMs(2500);
// Window should now be open with its own "Run Analysis" button
const winText = await d.text();
log('window open with header: ' + /ANALYSIS|Run 3D FEM/i.test(winText));
const r2 = await d.evalJs(`(() => {
  const bs = [...document.querySelectorAll('button')];
  const matches = bs.filter((x) => x.innerText.includes('Run Analysis') && x.offsetParent !== null);
  const b = matches[matches.length - 1];
  if (!b) return 'none(' + matches.length + ')';
  b.click(); return 'executed';
})()`);
log('execute: ' + r2);
const done = await waitForText('Analysis Complete', 150000);
log('Analysis Complete: ' + done);
await d.sleepMs(2500);
const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools|download the React/i.test(e));
log('errors: ' + (errs.length ? errs.slice(0, 5).join(' || ') : '(none)'));
const t = await d.text();
log('has FAILED state: ' + t.includes('Analysis Failed'));
log('screen tail 500: ' + t.slice(-500).replace(/\n/g, ' | '));
await d.close();
process.exit(0);
