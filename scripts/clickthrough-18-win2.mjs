import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct18.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(4000);
const r = await d.evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('▶ Run Analysis') && x.offsetParent !== null);
  if (!b) return 'none';
  b.click(); return 'clicked';
})()`);
log('clicked ▶ Run Analysis: ' + r);
await d.sleepMs(3000);
// Does the RunAnalysis modal or window content appear anywhere?
const res = await d.evalJs(`(() => {
  const t = document.body.innerText;
  return {
    hasSolverStatus: t.includes('Solver Status'),
    hasRunAnalysisBtn2: (t.match(/Run Analysis/g) || []).length,
    hasWindowTitleBar: [...document.querySelectorAll('div')].filter((el) => { const s = getComputedStyle(el); return s.position === 'absolute' || s.position === 'fixed'; }).length,
    windowCountByClass: document.querySelectorAll('[class*="Window"], [class*="window"]').length,
  };
})()`);
log('probe: ' + JSON.stringify(res));
// If there are window instances maybe they are rendered by WindowSlot with specific class; try listing fixed children
const kids = await d.evalJs(`(() => {
  const arr = [...document.querySelectorAll('body > *')];
  return arr.slice(0, 10).map((el) => (el.className && typeof el.className === 'string' ? el.className.slice(0, 80) : el.tagName));
})()`);
log('body children: ' + JSON.stringify(kids));
await d.close();
process.exit(0);
