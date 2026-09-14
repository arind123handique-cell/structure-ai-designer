import * as d from './cdp-driver.mjs';
import fs from 'node:fs';

const log = (m) => {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${m}`;
  console.log(line);
  fs.appendFileSync('/tmp/clickthrough.log', line + '\n');
};

log('booting; goto app');
await d.goto();
try {
  await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
  log('login page shown');
} catch {
  log('login page NOT shown — body: ' + (await d.text()).slice(0, 300));
}
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.sleepMs(300);
log('local mode seeded; reloading');
await d.goto();
await d.sleepMs(6000);

const visible = await d.text();
log('POST-RELOAD visible: ' + visible.slice(0, 500).replace(/\n/g, ' | '));
const errsNow = [...d.getConsoleErrors(), ...d.getPageErrors()];
log('POST-RELOAD errors: ' + (errsNow.length ? errsNow.slice(0, 5).join(' || ') : '(none)'));

if (visible.includes('Welcome Back') || visible.includes('Sign In')) {
  log('STILL ON LOGIN — aborting scenario');
  await d.close();
  process.exit(2);
}

const errors = [];
// NOTE: fn is stringified and evaluated in the browser — inline the literal, never use a closure var.
const waitForText = (text, ms) =>
  d.evalJs(`(async () => {
    const t = ${JSON.stringify(text)};
    const start = Date.now();
    while (Date.now() - start < ${ms}) {
      if (document.body && document.body.innerText.includes(t)) return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  })()`).catch(() => false);

async function nav(label, clickJs, waitText, waitMs = 5000) {
  d.clearErrors();
  log(`nav → ${label}`);
  try {
    const r = await d.evalJs(clickJs);
    log(`  click result: ${r}`);
    await d.sleepMs(1800);
    const ok = waitText ? await waitForText(waitText, waitMs) : true;
    const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools|download the React/i.test(e));
    if (errs.length) errors.push({ label, errs });
    let snippet = '';
    if (!ok) {
      snippet = ' SCREEN: ' + (await d.text()).replace(/\n/g, ' | ').slice(0, 400);
    }
    log(`  ${ok ? 'OK' : 'FAILED(text)'} ${errs.length ? '| errs: ' + errs.slice(0, 3).join(' || ') : ''}${snippet}`);
  } catch (e) {
    errors.push({ label, errs: [String(e)] });
    log(`  EXCEPTION ${e}`);
  }
}

const clickSidebar = (text) => `
  (() => {
    const btns = [...document.querySelectorAll('aside button')];
    const b = btns.find((x) => x.innerText && x.innerText.trim().includes(${JSON.stringify(text)}));
    if (!b) return 'no-button:' + ${JSON.stringify(text)};
    b.click(); return 'clicked';
  })()
`;

await nav('Stage 1 — Plot & Site', clickSidebar('Plot & Site Area'), 'Plot & Site Area');
await nav('Stage 2 — Architectural Plan', clickSidebar('Architectural Plan'), 'Architectural');
await nav('Stage 3a — ETABS Studio', clickSidebar('Manual Structural Analysis'), 'IS 456 / IS 13920 READY');
await nav('Stage 3b — 3D Model', clickSidebar('3D Structural Model'), 'Structural Model');
await nav('Stage 3c — Member Forces', clickSidebar('Member Forces'), 'Member');
await nav('Stage 3d — Support Reactions', clickSidebar('Support Reactions'), 'Reaction');
await nav('Stage 3e — Load Cases', clickSidebar('Load Cases & Comb'), 'Load');
await nav('Stage 3f — Elements', clickSidebar('Elements & Building Details'), 'Element');
await nav('Stage 3g — Warnings', clickSidebar('Model Warnings'), 'Warning');

for (const [label, wait] of [
  ['Beam Design', 'Beam'], ['Column Design', 'Column'], ['Pile Design', 'Pile'],
  ['Pile Cap Design', 'Pile Cap'], ['Slab Design', 'Slab'], ['Staircase Design', 'Stair'],
  ['Shear Wall Design', 'Shear'], ['Grade Beam Design', 'Grade'], ['Footing Design', 'Footing'],
]) {
  await nav(`Stage 4 — ${label}`, clickSidebar(label), wait);
}

await nav('Stage 5 — Detailing', clickSidebar('Walls, Doors & Windows'), 'Architectural');

for (const [label, wait] of [
  ['2D Structural GA Plans', 'Plan'], ['CAD Drawing Sheets', 'Drawing'], ['Reports', 'Report'],
]) {
  await nav(`Stage 6 — ${label}`, clickSidebar(label), wait);
}

await nav('Design Settings', clickSidebar('Design Settings'), 'Setting');
await nav('Project Dashboard', `(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Project Dashboard')); b&&b.click(); return 'x'; })()`, '');

log('\n==================== FINAL REPORT ====================');
if (errors.length === 0) {
  log('ALL VIEWS LOADED CLEAN — no console/page errors captured.');
} else {
  for (const { label, errs } of errors) {
    log(`\n[${label}]`);
    errs.forEach((e) => log('  ' + e.split('\n')[0].slice(0, 300)));
  }
}
await d.close();
process.exit(errors.length === 0 ? 0 : 1);
