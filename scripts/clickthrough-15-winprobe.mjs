import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct15.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(4000);

// Click the toolbar "▶ Run Analysis" button by locating nearest the Play SVG within toolbar
const r = await d.evalJs(`(() => {
  const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('class','')?.includes && false);
  const btns = [...document.querySelectorAll('button')];
  // Toolbar run analysis has ▶ char or Play icon + text
  const b = btns.find((x) => x.innerText.includes('▶') || (x.innerText.trim().startsWith('Run Analysis') && x.offsetParent !== null));
  if (!b) return 'none';
  b.click();
  return 'clicked:' + JSON.stringify(b.innerText.trim());
})()`);
log('click: ' + r);
await d.sleepMs(4000);

// Enumerate windows: any element with role=dialog or window title bars
const winInfo = await d.evalJs(`(() => {
  const dlg = [...document.querySelectorAll('[role="dialog"], .window-host, [class*="window"], [class*="Window"]')];
  return dlg.length;
})()`);
log('dialog-ish elements: ' + winInfo);

const winText = await d.evalJs(`(() => {
  const nodes = [...document.querySelectorAll('body *')].filter((el) => {
    const s = el.className && typeof el.className === 'string' ? el.className : '';
    return /window/i.test(s) || /dialog/i.test(s);
  });
  return nodes.slice(0, 8).map((el) => (el.innerText || '').slice(0, 200)).filter(Boolean).join('\\n---\\n');
})()`);
log('window texts:\n' + (winText || '(none)'));
const body = await d.text();
log('body has "Run Analysis (Window)": ' + body.includes('Run Analysis (Window)'));
log('body has "ANALYSIS OUTPUT": ' + /ANALYSIS OUTPUT/.test(body));
log('body has window host markers: ' + (/ANALYSIS WINDOW|RUN 3D FEM ANALYSIS|Analysis Complete|Running/.test(body)));
await d.close();
process.exit(0);
