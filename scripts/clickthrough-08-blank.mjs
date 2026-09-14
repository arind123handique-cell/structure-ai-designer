import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct8.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(6000);

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

const click = (text, scoped = false) => `
  (() => {
    const scope = ${scoped} ? [...document.querySelectorAll('aside button')] : [...document.querySelectorAll('button')];
    const b = scope.find((x) => x.innerText && x.innerText.trim().includes(${JSON.stringify(text)}));
    if (!b) return 'no-button';
    b.click(); return 'clicked';
  })()
`;

const errors = [];
async function nav(label, clickJs, waitText, waitMs = 5000) {
  d.clearErrors();
  try {
    await d.evalJs(clickJs);
    await d.sleepMs(1500);
    const ok = waitText ? await waitForText(waitText, waitMs) : true;
    const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools|download the React/i.test(e));
    if (errs.length) errors.push({ label, errs });
    log(`${ok ? 'OK' : 'FAILED'} ${label} ${errs.length ? 'ERR: ' + errs.slice(0, 2).join(' | ') : ''}`);
  } catch (e) { errors.push({ label, errs: [String(e)] }); log(`EXC ${label}: ${e}`); }
}

// Open New Project → Blank Canvas mode
await d.evalJs(click('+ New Project'));
await d.sleepMs(800);
await d.evalJs(click('Blank Canvas'));
await d.sleepMs(400);
await d.evalJs(`(() => {
  const inputs = [...document.querySelectorAll('input')];
  const nameInput = inputs.find((i) => (i.placeholder||'').toLowerCase().includes('name'));
  if (nameInput) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(nameInput,'BLANK TEST'); nameInput.dispatchEvent(new Event('input',{bubbles:true})); }
  return !!nameInput;
})()`);
await d.sleepMs(300);
await d.evalJs(click('Create & Launch'));
await d.sleepMs(4000);
const t0 = await d.text();
log('after create: has "Blank"→' + t0.includes('Studio'));

// Blank project should have zero members — click through every design view
const aside = (txt) => click(txt, true);
await nav('Plot (blank)', aside('Plot & Site Area'), 'Plot & Site');
await nav('Architectural (blank)', aside('Architectural Plan'), 'Architectural');
await nav('Studio (blank)', aside('Manual Structural Analysis'), 'IS 456 RCC Design');
for (const [label, wait] of [
  ['Beam Design', 'Beam'], ['Column Design', 'Column'], ['Slab Design', 'Slab'],
  ['Staircase Design', 'Stair'], ['Shear Wall Design', 'Shear'], ['Grade Beam Design', 'Grade'],
  ['Footing Design', 'Footing'], ['Pile Design', 'Pile'], ['Pile Cap Design', 'Pile Cap'],
]) {
  await nav(label + ' (blank)', aside(label), wait);
}
await nav('3D (blank)', aside('3D Structural Model'), '');
await nav('GA Plans (blank)', aside('2D Structural GA Plans'), '');
await nav('Drawings (blank)', aside('CAD Drawing Sheets'), '');
await nav('Reports (blank)', aside('Reports'), '');
await nav('Forces (blank)', aside('Member Forces'), '');
await nav('Reactions (blank)', aside('Support Reactions'), '');
await nav('Load Cases (blank)', aside('Load Cases & Comb'), '');
await nav('Elements (blank)', aside('Elements & Building Details'), '');
await nav('Warnings (blank)', aside('Model Warnings'), '');

log('\n==== BLANK PROJECT REPORT ====');
if (!errors.length) log('ALL BLANK-PROJECT VIEWS CLEAN');
else for (const { label, errs } of errors) { log(`[${label}]`); errs.forEach((e) => log('  ' + e.split('\n')[0].slice(0, 300))); }
await d.close();
process.exit(errors.length ? 1 : 0);
