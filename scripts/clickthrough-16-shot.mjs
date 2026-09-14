import * as d from './cdp-driver.mjs';

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(9000);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(4000);
// Click the toolbar run analysis button
const r = await d.evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('▶') && x.offsetParent !== null && x.innerText.length < 30);
  if (!b) return 'none';
  b.click(); return 'clicked:' + b.innerText.trim();
})()`);
console.log('click:', r);
await d.sleepMs(5000);
// screenshot main page
await d.screenshot('/tmp/win.png');
console.log('saved /tmp/win.png');
const t = await d.text();
console.log('=== FULL TEXT (unique check) ===');
const lines = [...new Set(t.split('\n').filter((l) => l.trim()))];
console.log(lines.filter((l) => /Analysis|Run|FEM|window|Window|Complete|Running/i.test(l)).join('\n').slice(0, 900));
await d.close();
process.exit(0);
