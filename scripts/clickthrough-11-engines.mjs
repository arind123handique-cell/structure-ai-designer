import * as d from './cdp-driver.mjs';
import fs from 'node:fs';
const log = (m) => { console.log(m); fs.appendFileSync('/tmp/ct11.log', m + '\n'); };

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(8000);
log('booted, sample auto-import expected. Header: ' + ((await d.text()).match(/\d+ Members/) || ['none'])[0]);

const waitForText = (text, ms = 15000) =>
  d.evalJs(`(async () => {
    const t = ${JSON.stringify(text)};
    const start = Date.now();
    while (Date.now() - start < ${ms}) {
      if (document.body && document.body.innerText.includes(t)) return true;
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  })()`).catch(() => false);
const clickButton = (text) => `
  (() => {
    const scope = [...document.querySelectorAll('button')];
    const b = scope.find((x) => x.innerText && x.innerText.trim().includes(${JSON.stringify(text)}) && x.offsetParent !== null);
    if (!b) return 'no-button';
    b.click(); return 'clicked';
  })()
`;
const errors = [];
async function act(label, clickJs, waitText, settleMs = 8000, waitMs = 60000) {
  d.clearErrors();
  log(`act → ${label}`);
  try {
    const r = await d.evalJs(clickJs);
    log(`  click: ${r}`);
    const ok = waitText ? await waitForText(waitText, waitMs) : true;
    await d.sleepMs(settleMs);
    const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools|download the React/i.test(e));
    if (errs.length) errors.push({ label, errs });
    log(`  ${ok ? 'OK' : 'TIMEOUT-wait'} ${errs.length ? 'ERR: ' + errs.slice(0, 3).join(' || ') : ''}`);
    if (!ok) log('  screen tail: ' + (await d.text()).slice(-500).replace(/\n/g, ' | '));
  } catch (e) { errors.push({ label, errs: [String(e)] }); log(`  EXCEPTION ${e}`); }
}

// 1. Open ETABS studio (sample model auto-loads into dashboard → studio)
await act('open studio', clickButton('Manual Structural Analysis'), 'IS 456 / IS 13920 READY', 3000, 20000);

// 2. Run Analysis via modal menu button
await act('open Run Analysis modal', clickButton('Run Analysis'), '', 3000);
await act('execute FEM analysis', clickButton('Run Analysis Now'), 'Analysis Complete', 4000, 120000);
// some modals say "Execute Analysis" / "Run Analysis"
const tAfter = await d.text();
log('post-analysis has SOLVED/Complete: ' + /Analysis Complete|SOLVED|PASS/i.test(tAfter));

// 3. Run concrete design
await act('open concrete design', clickButton('Run Concrete Design'), '', 3000);
await act('run design checks', `(() => {
  const bs = [...document.querySelectorAll('button')];
  const b = bs.find((x) => /Design (All|Now|Members)|Run Design|Apply Design/i.test(x.innerText) && x.offsetParent !== null);
  if (!b) return 'no-design-btn';
  b.click(); return 'clicked:' + b.innerText.trim();
})()`, 'Complete', 3000, 120000);

// 4. Visit design views and trigger per-module design runs
async function designView(clickTxt, runTxtRe, waitRe, viewLabel) {
  d.clearErrors();
  log(`act → design: ${viewLabel}`);
  await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.trim().includes(${JSON.stringify(clickTxt)})); b&&b.click(); return !!b; })()`);
  await d.sleepMs(3500);
  const r = await d.evalJs(`(() => {
    const bs = [...document.querySelectorAll('button')];
    const b = bs.find((x) => ${runTxtRe} && x.offsetParent !== null);
    if (!b) return 'no-btn';
    b.click(); return 'clicked:' + b.innerText.trim();
  })()`);
  log('  click: ' + r);
  const ok = await waitForText(waitRe, 60000);
  await d.sleepMs(2500);
  const errs = [...d.getConsoleErrors(), ...d.getPageErrors()].filter((e) => !/favicon|React DevTools|download the React/i.test(e));
  if (errs.length) errors.push({ label: 'design:' + viewLabel, errs });
  log(`  ${ok ? 'OK' : 'TIMEOUT'} ${errs.length ? 'ERR: ' + errs.slice(0, 2).join(' || ') : ''}`);
}

// Column + beam designs are the core path
await designView('Column Design', '/Design All|Run Design|Apply All|Design Selected/i.test(x.innerText)', 'PASS', 'Column Design');
await designView('Beam Design', '/Design All|Run Design|Apply All|Design Selected/i.test(x.innerText)', 'PASS', 'Beam Design');

log('\n==== ENGINE REPORT ====');
if (!errors.length) log('ENGINE RUNS CLEAN');
else for (const { label, errs } of errors) { log(`[${label}]`); errs.forEach((e) => log('  ' + e.split('\n')[0].slice(0, 300))); }
await d.close();
process.exit(errors.length ? 1 : 0);
