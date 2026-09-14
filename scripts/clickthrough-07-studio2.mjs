import * as d from './cdp-driver.mjs';

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(6000);
// New empty project
await d.evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('+ New Project')); b&&b.click(); return !!b; })()`);
await d.sleepMs(800);
await d.evalJs(`(() => {
  const inputs = [...document.querySelectorAll('input')];
  const nameInput = inputs.find((i) => (i.placeholder||'').toLowerCase().includes('name'));
  if (nameInput) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(nameInput,'EmptyTest2'); nameInput.dispatchEvent(new Event('input',{bubbles:true})); }
  return 'filled';
})()`);
await d.sleepMs(400);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Create & Launch/i.test(x.innerText)); b&&b.click(); return !!b; })()`);
await d.sleepMs(6000);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('aside button')].find(x=>x.innerText.includes('Manual Structural Analysis')); b&&b.click(); return !!b; })()`);
await d.sleepMs(5000);

const full = await d.text();
console.log('LEN', full.length);
console.log('HAS wizard CTA:', full.includes('Launch Building Wizard'));
console.log('HAS ETABS Framing:', full.includes('ETABS Framing'));
console.log('HAS Create Standard:', full.includes('Create Standard G+2'));
console.log('=== tail 1600 ===');
console.log(full.slice(Math.max(0, full.length - 1600)));
console.log('=== ERRORS ===');
console.log([...d.getConsoleErrors(), ...d.getPageErrors()].join('\n') || '(none)');
await d.close();
process.exit(0);
