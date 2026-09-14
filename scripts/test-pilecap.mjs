import * as d from './cdp-driver.mjs';

try {
  await d.goto('http://localhost:37854/');
  await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
  await d.goto('http://localhost:37854/');
  await d.sleepMs(2000);

  // Navigate to 3D Model
  await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button, a')];
    const target = btns.find(b => b.innerText && b.innerText.includes('3D Structural Model'));
    if (target) target.click();
  })()`);
  await d.sleepMs(2000);

  // Select Column #53 first to show the connected pile cap pill
  await d.evalJs(`(() => {
    const input = document.querySelector('input[placeholder*="Search column"]');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'Column');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  })()`);
  await d.sleepMs(1000);

  await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const colBtn = btns.find(b => b.innerText && b.innerText.includes('Column #'));
    if (colBtn) colBtn.click();
  })()`);
  await d.sleepMs(1500);

  // Now click the PILE CAP PC-1 button in the bottom floating toolbar
  console.log('Clicking PILE CAP PC-1 pill button...');
  const pcClicked = await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const pcBtn = btns.find(b => b.innerText && b.innerText.includes('PILE CAP'));
    if (pcBtn) {
      pcBtn.click();
      return 'Clicked: ' + pcBtn.innerText.trim();
    }
    return 'Pile Cap button not found';
  })()`);
  console.log('Result:', pcClicked);
  await d.sleepMs(1500);

  // Screenshot Properties & Loads of Pile Cap
  await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/pilecap_properties.png');
  console.log('Saved pilecap_properties.png');

  // Click 2D CAD Projection
  await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const tab = btns.find(b => b.innerText && b.innerText.includes('2D CAD Projection'));
    if (tab) tab.click();
  })()`);
  await d.sleepMs(1000);
  await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/pilecap_2d_projection.png');
  console.log('Saved pilecap_2d_projection.png');

  // Click 3D Rebar Inside
  await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const tab = btns.find(b => b.innerText && b.innerText.includes('3D Rebar Inside'));
    if (tab) tab.click();
  })()`);
  await d.sleepMs(1000);
  await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/pilecap_3d_rebar.png');
  console.log('Saved pilecap_3d_rebar.png');

  console.log('\n--- CONSOLE ERRORS ---');
  console.log(d.getConsoleErrors());

  console.log('\n--- PAGE ERRORS / EXCEPTIONS ---');
  console.log(d.getPageErrors());

} catch (err) {
  console.error('Test script failed:', err);
} finally {
  await d.close();
  process.exit(0);
}
