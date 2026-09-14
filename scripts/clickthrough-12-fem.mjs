import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct12.log', m + '\n'); };

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

// Open studio from sidebar
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(4000);
// Open Run Analysis window via the studio menu (button labeled exactly "Run Analysis" near top)
const r = await d.evalJs(`(() => {
  const bs = [...document.querySelectorAll('button')];
  const b = bs.find((x) => x.innerText.trim() === 'Run Analysis' && x.offsetParent !== null);
  if (!b) return 'none';
  b.click(); return 'opened:' + b.innerText.trim();
})()`);
log('open run analysis: ' + r);
await d.sleepMs(2000);
// Inside the window click the execute button "▶ Run Analysis" (the LAST one with Play)
const r2 = await d.evalJs(`(() => {
  const bs = [...document.querySelectorAll('button')];
  const matches = bs.filter((x) => x.innerText.includes('Run Analysis') && x.offsetParent !== null);
  const b = matches[matches.length - 1];
  if (!b) return 'none found (' + matches.length + ')';
  b.click(); return 'executed';
})()`);
log('execute: ' + r2);
const complete = await waitForText('Analysis Complete', 120000);
log('Analysis Complete shown: ' + complete);
await d.sleepMs(3000);
const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools|download the React/i.test(e));
log('errors: ' + (errs.length ? errs.slice(0, 5).join(' || ') : '(none)'));
log('screen tail: ' + (await d.text()).slice(-400).replace(/\n/g, ' | '));
await d.close();
process.exit(0);
