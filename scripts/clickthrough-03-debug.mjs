import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct3.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(6000);
log('--- post reload body (first 400): ' + (await d.text()).slice(0, 400).replace(/\n/g, ' | '));
d.clearErrors();
const r = await d.evalJs(`(() => {
  const btns = [...document.querySelectorAll('aside button')];
  const b = btns.find((x) => x.innerText && x.innerText.trim().includes('Plot & Site Area'));
  if (!b) return 'NO BUTTON';
  b.click(); return 'CLICKED';
})()`);
log('click: ' + r);
await d.sleepMs(4000);
const t = await d.text();
log('--- after click body (first 1200):');
log(t.slice(0, 1200));
log('--- errors: ' + [...d.getConsoleErrors(), ...d.getPageErrors()].join(' || ') || '(none)');
log('--- has root children: ' + (await d.evalJs('document.getElementById("root") ? document.getElementById("root").childElementCount : -1')));
await d.close();
process.exit(0);
