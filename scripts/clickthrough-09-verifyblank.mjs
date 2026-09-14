import * as d from './cdp-driver.mjs';

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
await d.goto();
await d.sleepMs(6000);

// Step A: on a fresh profile, does the app auto-import the sample? Check the header stats.
const tA = await d.text();
const sampleMatch = tA.match(/(\d+) Members/);
console.log('A) After first boot — header shows members:', sampleMatch ? sampleMatch[0] : 'none/other');

// Step B: create BLANK project
await d.evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('+ New Project')); b&&b.click(); return !!b; })()`);
await d.sleepMs(800);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Blank Canvas')); b&&b.click(); return !!b; })()`);
await d.sleepMs(300);
await d.evalJs(`(() => {
  const inputs = [...document.querySelectorAll('input')];
  const nameInput = inputs.find((i) => (i.placeholder||'').toLowerCase().includes('name'));
  if (nameInput) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(nameInput,'VERIFY BLANK'); nameInput.dispatchEvent(new Event('input',{bubbles:true})); }
  return !!nameInput;
})()`);
await d.sleepMs(200);
await d.evalJs(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Create & Launch/i.test(x.innerText)); b&&b.click(); return !!b; })()`);
await d.sleepMs(7000);
const tB = await d.text();
const membersB = tB.match(/(\d+) Members/);
const header = tB.slice(0, 900).replace(/\n/g, ' | ');
console.log('B) After BLANK create — header first 900:', header.slice(0, 500));
console.log('B) members count visible:', membersB ? membersB[0] : 'not visible');
console.log('B) shows Launch Building Wizard (0 members):', tB.includes('Launch Building Wizard'));
console.log('B) errors:', [...d.getConsoleErrors(), ...d.getPageErrors()].join(' | ') || '(none)');
await d.close();
process.exit(0);
