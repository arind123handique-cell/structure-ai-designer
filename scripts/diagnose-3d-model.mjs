import * as d from './cdp-driver.mjs';

try {
  console.log('Navigating to app on port 37854...');
  await d.goto('http://localhost:37854/');
  await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
  await d.goto('http://localhost:37854/');
  await d.sleepMs(3000);

  console.log('Current page text preview:');
  const t = await d.text();
  console.log(t.slice(0, 300));

  console.log('Clicking "3D Structural Model" button...');
  const clicked = await d.evalJs(`(() => {
    // Try sidebar buttons
    const btns = [...document.querySelectorAll('button, a')];
    const target = btns.find(b => b.innerText && b.innerText.includes('3D Structural Model'));
    if (target) {
      target.click();
      return 'Clicked via text match: ' + target.innerText;
    }
    // Try setting store directly
    if (window.__PROJECT_STORE__) {
      window.__PROJECT_STORE__.getState().setActiveView('3d-model');
      return 'Set via __PROJECT_STORE__';
    }
    return 'Button not found, btns: ' + btns.map(b => b.innerText?.trim()).filter(Boolean).slice(0, 15).join(' | ');
  })()`);
  console.log('Click result:', clicked);

  await d.sleepMs(3000);

  console.log('Page text after click:');
  const tAfter = await d.text();
  console.log(tAfter.slice(0, 300));

  console.log('\n--- CONSOLE ERRORS ---');
  console.log(d.getConsoleErrors());

  console.log('\n--- PAGE ERRORS / EXCEPTIONS ---');
  console.log(d.getPageErrors());

  await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/diagnose_3d.png');
  console.log('Screenshot saved to scratch/diagnose_3d.png');

} catch (err) {
  console.error('Diagnosis script failed:', err);
} finally {
  await d.close();
  process.exit(0);
}
