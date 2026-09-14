import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct5.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(6000);

// Delete all current projects so we exercise the empty path? Instead: create NEW empty project via modal.
const clickText = (text) => `
  (() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => x.innerText && x.innerText.trim().includes(${JSON.stringify(text)}));
    if (!b) return 'no-button';
    b.click(); return 'clicked';
  })()
`;
const clickAsideText = (text) => `
  (() => {
    const btns = [...document.querySelectorAll('aside button')];
    const b = btns.find((x) => x.innerText && x.innerText.trim().includes(${JSON.stringify(text)}));
    if (!b) return 'no-button';
    b.click(); return 'clicked';
  })()
`;

const waitForText = (text, ms = 6000) =>
  d.evalJs(`(async () => {
    const t = ${JSON.stringify(text)};
    const start = Date.now();
    while (Date.now() - start < ${ms}) {
      if (document.body && document.body.innerText.includes(t)) return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  })()`).catch(() => false);

const errors = [];
async function nav(label, clickJs, waitText) {
  d.clearErrors();
  log(`nav → ${label}`);
  try {
    const r = await d.evalJs(clickJs);
    await d.sleepMs(1800);
    const ok = waitText ? await waitForText(waitText) : true;
    const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools|download the React/i.test(e));
    if (errs.length) errors.push({ label, errs });
    log(`  ${ok ? 'OK' : 'FAILED(text)'} ${errs.length ? '| ERR: ' + errs.slice(0, 2).join(' || ') : ''}  (click=${r})`);
    if (!ok) log('  screen: ' + (await d.text()).slice(0, 250).replace(/\n/g, ' | '));
  } catch (e) {
    errors.push({ label, errs: [String(e)] });
    log(`  EXCEPTION ${e}`);
  }
}

log('=== step 1: open New Project modal');
await nav('open new project modal', clickText('+ New Project'), 'Create');
log('=== step 2: fill + submit');
await d.sleepMs(600);
// Fill inputs inside modal — find open modal by text 'Create Project'/'Project Name'
const fillRes = await d.evalJs(`(() => {
  const labels = [...document.querySelectorAll('label')].map((l) => l.innerText);
  const inputs = [...document.querySelectorAll('input, textarea')];
  const nameInput = inputs.find((i) => { const p = i.closest('div')?.parentElement?.innerText || ''; return p.includes('Project Name') || (i.placeholder||'').toLowerCase().includes('name'); });
  const locInput = inputs.find((i) => (i.placeholder||'').toLowerCase().includes('location'));
  if (nameInput) { nameInput.focus(); nameInput.value='ClickTest Empty'; nameInput.dispatchEvent(new Event('input',{bubbles:true})); }
  if (locInput) { locInput.focus(); locInput.value='Test Site'; locInput.dispatchEvent(new Event('input',{bubbles:true})); }
  return 'filled: name=' + !!nameInput + ' loc=' + !!locInput;
})()`);
log('fill: ' + fillRes);
await d.sleepMs(400);
// find create/submit button in modal (exclude Cancel)
const subRes = await d.evalJs(`(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find((x) => /create|save|start/i.test(x.innerText) && !/cancel/i.test(x.innerText) && x.offsetParent !== null && document.body.innerText.indexOf(x.innerText) > document.body.innerText.indexOf('Project Name'));
  if (!b) return 'no-submit';
  b.click(); return 'submit-clicked:' + b.innerText.trim();
})()`);
log('submit: ' + subRes);
await d.sleepMs(5000);
log('screen after create: ' + (await d.text()).slice(0, 400).replace(/\n/g, ' | '));
await d.waitFor(() => !document.body.innerText.includes('Welcome Back'), 15000).catch(()=>{});
await d.sleepMs(2000);

log('=== now walk stages on empty project');
await nav('Stage 1 — Plot', clickAsideText('Plot & Site Area'), 'Plot & Site');
await nav('Stage 2 — Architectural', clickAsideText('Architectural Plan'), 'Architectural');
await nav('Stage 3 — Studio (empty)', clickAsideText('Manual Structural Analysis'), 'Launch Building Wizard');
await nav('Stage 3b — 3D (empty)', clickAsideText('3D Structural Model'), '');
await nav('Stage 4 — Column (empty)', clickAsideText('Column Design'), '');
await nav('Stage 4 — Beam (empty)', clickAsideText('Beam Design'), '');
await nav('Stage 4 — Slab (empty)', clickAsideText('Slab Design'), '');
await nav('Stage 4 — Footing (empty)', clickAsideText('Footing Design'), '');
await nav('Stage 4 — Pile (empty)', clickAsideText('Pile Design'), '');
await nav('Stage 4 — PileCap (empty)', clickAsideText('Pile Cap Design'), '');
await nav('Stage 4 — ShearWall (empty)', clickAsideText('Shear Wall Design'), '');
await nav('Stage 4 — GradeBeam (empty)', clickAsideText('Grade Beam Design'), '');
await nav('Stage 5 — Detailing', clickAsideText('Walls, Doors & Windows'), '');
await nav('Stage 6 — GA Plans', clickAsideText('2D Structural GA Plans'), '');
await nav('Stage 6 — Drawings', clickAsideText('CAD Drawing Sheets'), '');
await nav('Stage 6 — Reports', clickAsideText('Reports'), '');

log('\n==================== EMPTY-PROJECT REPORT ====================');
if (errors.length === 0) log('ALL EMPTY-PROJECT VIEWS CLEAN');
else for (const { label, errs } of errors) { log(`\n[${label}]`); errs.forEach((e) => log('  ' + e.split('\n')[0].slice(0, 250))); }
await d.close();
process.exit(errors.length === 0 ? 0 : 1);
