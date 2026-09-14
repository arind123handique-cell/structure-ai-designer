import * as d from './cdp-driver.mjs';

try {
  console.log('Connecting to port 37854...');
  await d.goto('http://localhost:37854/');
  await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
  await d.goto('http://localhost:37854/');
  await d.sleepMs(2000);

  // Click 3D Structural Model
  await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button, a')];
    const target = btns.find(b => b.innerText && b.innerText.includes('3D Structural Model'));
    if (target) target.click();
  })()`);
  await d.sleepMs(2000);

  console.log('Selecting Beam #1...');
  const clickedBeam = await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const beam1 = btns.find(b => b.innerText && b.innerText.includes('Beam #1'));
    if (beam1) {
      beam1.click();
      return 'Clicked Beam #1 button';
    }
    // Also try projectStore
    if (window.__PROJECT_STORE__) {
      window.__PROJECT_STORE__.getState().selectMember(1);
      return 'Selected via __PROJECT_STORE__';
    }
    return 'Beam #1 button not found';
  })()`);
  console.log('Result:', clickedBeam);
  await d.sleepMs(2000);


  await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/beam_selected_inspector.png');
  console.log('Screenshot saved to scratch/beam_selected_inspector.png');

  // Click 2D CAD Projection tab
  console.log('Clicking 2D CAD Projection tab...');
  const clicked2D = await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const tab = btns.find(b => b.innerText && b.innerText.includes('2D CAD Projection'));
    if (tab) {
      tab.click();
      return 'Clicked 2D CAD Projection';
    }
    return 'Tab not found';
  })()`);
  console.log('Result:', clicked2D);
  await d.sleepMs(1500);

  await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/beam_2d_projection.png');
  console.log('Screenshot saved to scratch/beam_2d_projection.png');

  // Click 3D Rebar Inside tab
  console.log('Clicking 3D Rebar Inside tab...');
  const clicked3D = await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const tab = btns.find(b => b.innerText && b.innerText.includes('3D Rebar Inside'));
    if (tab) {
      tab.click();
      return 'Clicked 3D Rebar Inside';
    }
    return 'Tab not found';
  })()`);
  console.log('Result:', clicked3D);
  await d.sleepMs(1500);

  await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/beam_3d_rebar.png');
  console.log('Screenshot saved to scratch/beam_3d_rebar.png');

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
