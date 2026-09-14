import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct22.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Column Design')); b&&b.click(); return !!b; })()`);
await d.sleepMs(5000);
// Run auto-design
await d.evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Auto-Design All Columns') && x.offsetParent !== null);
  b && b.click(); return !!b;
})()`);
// Wait for design to finish
for (let i = 0; i < 30; i++) {
  await d.sleepMs(5000);
  const t = await d.text();
  if (!/Running|Analyzing/i.test(t) && (t.includes('PASS') || i > 15)) break;
}
log('wait done');
await d.sleepMs(2000);
const t = await d.text();
const nanCount = (t.match(/NaN/g) || []).length;
const m3samples = t.match(/[\d.]+ m³/g) || [];
log('NaN occurrences on screen: ' + nanCount);
log('volume samples: ' + m3samples.slice(0, 8).join(', '));
log('errs: ' + ([...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools/i.test(e)).slice(0,5).join(' || ') || '(none)'));
await d.close();
process.exit(0);
