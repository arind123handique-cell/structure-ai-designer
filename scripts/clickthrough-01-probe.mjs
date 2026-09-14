import * as d from './cdp-driver.mjs';

await d.goto();
// Give Firebase auth time to settle
await d.sleepMs(12000);
const t = await d.text();
console.log('=== VISIBLE TEXT (first 1500) ===');
console.log(t.slice(0, 1500));
console.log('=== CONSOLE / PAGE ERRORS ===');
const errs = [...d.getConsoleErrors(), ...d.getPageErrors()];
console.log(errs.length ? errs.slice(0, 30).join('\n') : '(none)');
await d.close();
process.exit(0);
