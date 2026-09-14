import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct19.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(5000);

const countDialogs = () => d.evalJs(`document.querySelectorAll('[role="dialog"]').length`);
const dumpDialogs = () => d.evalJs(`(() => {
  return [...document.querySelectorAll('[role="dialog"]')].map((dl) => {
    const lab = dl.getAttribute('aria-label') || '';
    const txt = (dl.innerText || '').slice(0, 260).replace(/\\n/g, ' | ');
    return lab + ' :: ' + txt;
  });
})()`);

log('dialogs before: ' + await countDialogs());
// Click toolbar ▶ Run Analysis via the exact button (has title attr Run 3D)
const r = await d.evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').includes('Run 3D Space Frame') && x.offsetParent !== null);
  if (!b) return 'none';
  b.click(); return 'clicked:' + (b.innerText || '').trim();
})()`);
log('click: ' + r);
await d.sleepMs(2500);
log('dialogs after: ' + await countDialogs());
const dlgs = await dumpDialogs();
log('dialog list:\n' + (dlgs.join('\n---\n') || '(none)'));
await d.close();
process.exit(0);
