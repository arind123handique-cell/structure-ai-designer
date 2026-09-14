import * as d from './cdp-driver.mjs';

await d.goto();
await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 20000);
console.log('login visible');
// Test: raw evalJs includes check
const raw = await d.evalJs(`document.body.innerText.includes('Welcome Back')`);
console.log('raw includes:', raw);
// Test waitFor boolean
const wf = await d.waitFor(() => document.body && document.body.innerText.includes('Welcome Back'), 5000).then(() => 'RESOLVED', () => 'TIMEOUT');
console.log('waitFor:', wf);
// Test waitFor numeric/string return
const wf2 = await d.waitFor(() => (document.body.innerText.length > 100 ? 'yes' : null), 5000).then((v) => 'RESOLVED:' + v, () => 'TIMEOUT');
console.log('waitFor truthy string:', wf2);
await d.close();
process.exit(0);
