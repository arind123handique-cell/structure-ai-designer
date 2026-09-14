import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct10.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(6000);

// Open New Project modal (first matching button)
const openRes = await d.evalJs(`(() => {
  const bs = [...document.querySelectorAll('button')].filter((x) => x.innerText.includes('+ New Project'));
  const b = bs[bs.length - 1];
  if (!b) return 'none';
  b.click(); return 'opened';
})()`);
log('open modal: ' + openRes);
await d.sleepMs(1000);
// Click the "Blank Canvas" mode DIV (it is a div, not a button)
const modeRes = await d.evalJs(`(() => {
  const els = [...document.querySelectorAll('div,button')];
  const el = els.find((x) => x.innerText && x.innerText.trim().startsWith('Blank Canvas'));
  if (!el) return 'no-blank-div';
  el.click(); return 'blank-clicked';
})()`);
log('blank mode: ' + modeRes);
await d.sleepMs(500);
// Verify wizard fields hidden → means BLANK active
const blankActive = await d.evalJs(`(() => {
  const body = document.body.innerText;
  return body.includes('Auto Frame Wizard') && !document.querySelector('[class*="modal"]') ? 'x' : 'y';
})()`);
log('modal present: ' + blankActive);

// Fill project name input
const fill = await d.evalJs(`(() => {
  const inputs = [...document.querySelectorAll('input')];
  const nameInput = inputs.find((i) => (i.placeholder||'').toLowerCase().includes('name'));
  if (nameInput) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(nameInput,'TRUE BLANK'); nameInput.dispatchEvent(new Event('input',{bubbles:true})); return 'filled'; }
  return 'no-name-input';
})()`);
log('fill name: ' + fill);
await d.sleepMs(300);
const created = await d.evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Create & Launch/i.test(x.innerText) && x.offsetParent !== null);
  if (!b) return 'no-create-btn';
  b.click(); return 'created';
})()`);
log('create: ' + created);
await d.sleepMs(7000);
const t = await d.text();
const m = t.match(/(\d+) Members/);
log('members after blank create: ' + (m ? m[0] : 'none'));
log('studio empty CTA visible: ' + t.includes('Launch Building Wizard'));

// If blank, walk all views
const waitForText = (text, ms = 5000) =>
  d.evalJs(`(async () => {
    const t = ${JSON.stringify(text)};
    const start = Date.now();
    while (Date.now() - start < ${ms}) {
      if (document.body && document.body.innerText.includes(t)) return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  })()`).catch(() => false);
const clickAny = (text) => `
  (() => {
    const scope = [...document.querySelectorAll('aside button')];
    const b = scope.find((x) => x.innerText && x.innerText.trim().includes(${JSON.stringify(text)}));
    if (!b) return 'no-button';
    b.click(); return 'clicked';
  })()
`;
const errors = [];
async function nav(label, txt, wait) {
  d.clearErrors();
  await d.evalJs(clickAny(txt));
  await d.sleepMs(1500);
  const ok = wait ? await waitForText(wait) : true;
  const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools|download the React/i.test(e));
  if (errs.length) errors.push({ label, errs });
  log(`${ok ? 'OK' : 'FAILED'} ${label} ${errs.length ? 'ERR: ' + errs.slice(0, 2).join(' | ') : ''}`);
  if (!ok) log('  screen: ' + (await d.text()).slice(0, 300).replace(/\n/g, ' | '));
}

for (const [label, text, wait] of [
  ['Plot', 'Plot & Site Area', 'Plot & Site'],
  ['Architectural', 'Architectural Plan', 'Architectural'],
  ['Studio', 'Manual Structural Analysis', 'Launch Building Wizard'],
  ['Beam Design', 'Beam Design', 'Beam'],
  ['Column Design', 'Column Design', 'Column'],
  ['Slab Design', 'Slab Design', 'Slab'],
  ['Staircase', 'Staircase Design', 'Stair'],
  ['Shear Wall', 'Shear Wall Design', 'Shear'],
  ['Grade Beam', 'Grade Beam Design', 'Grade'],
  ['Footing', 'Footing Design', 'Footing'],
  ['Pile', 'Pile Design', 'Pile'],
  ['Pile Cap', 'Pile Cap Design', 'Pile Cap'],
  ['3D', '3D Structural Model', ''],
  ['GA Plans', '2D Structural GA Plans', ''],
  ['Drawings', 'CAD Drawing Sheets', ''],
  ['Reports', 'Reports', ''],
  ['Forces', 'Member Forces', ''],
  ['Reactions', 'Support Reactions', ''],
  ['Load Cases', 'Load Cases & Comb', ''],
  ['Elements', 'Elements & Building Details', ''],
  ['Warnings', 'Model Warnings', ''],
]) { await nav(label, text, wait); }

log('\n==== TRUE BLANK REPORT ====');
if (!errors.length) log('ALL TRUE-BLANK VIEWS CLEAN');
else for (const { label, errs } of errors) { log(`[${label}]`); errs.forEach((e) => log('  ' + e.split('\n')[0].slice(0, 300))); }
await d.close();
process.exit(errors.length ? 1 : 0);
