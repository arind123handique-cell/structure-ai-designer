import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct17.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(4000);
const r = await d.evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Run Analysis') && x.innerText.trim().startsWith('▶') && x.offsetParent !== null);
  if (!b) return 'none';
  b.click(); return 'clicked';
})()`);
log('toolbar click: ' + r);
await d.sleepMs(6000);
// Find any element containing window content text
const found = await d.evalJs(`(() => {
  const out = {};
  out.windowStore = typeof window !== 'undefined' ? '(not exposed)' : 'x';
  // Look for absolutely-positioned floating panels with "Analysis" text
  const all = [...document.querySelectorAll('div,section')];
  const withRun = all.filter((el) => el.children.length > 3 && /Run Analysis|Analysis Complete|Running 3D FEM|ANALYSIS OUTPUT/.test(el.innerText || ''));
  out.matches = withRun.length;
  out.firstText = withRun[0] ? (withRun[0].innerText || '').slice(0, 500) : '';
  // Count elements with z-index >= 50 (floating window)
  const floating = [...document.querySelectorAll('div')].filter((el) => {
    const z = parseFloat(getComputedStyle(el).zIndex || '0');
    return z >= 30 && el.innerText && el.innerText.length > 20;
  });
  out.floating = floating.slice(0, 5).map((el) => ({ z: getComputedStyle(el).zIndex, t: (el.innerText || '').slice(0, 120) }));
  return out;
})()`);
log('probe: ' + JSON.stringify(found, null, 1).slice(0, 1500));
await d.close();
process.exit(0);
