import * as d from './cdp-driver.mjs';

try {
  await d.goto('http://localhost:37854/');
  await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
  await d.goto('http://localhost:37854/');
  await d.sleepMs(2000);

  // Click 3D Structural Model tab
  await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button, a')];
    const target = btns.find(b => b.innerText && b.innerText.includes('3D Structural Model'));
    if (target) target.click();
  })()`);
  await d.sleepMs(2500);

  // Probe canvas and test raycasting directly
  const probeResult = await d.evalJs(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };
    const rect = canvas.getBoundingClientRect();

    // Click right at the center of the canvas
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Check pointer events
    const downEv = new PointerEvent('pointerdown', {
      clientX: cx,
      clientY: cy,
      button: 0,
      bubbles: true,
      cancelable: true
    });
    const upEv = new PointerEvent('pointerup', {
      clientX: cx,
      clientY: cy,
      button: 0,
      bubbles: true,
      cancelable: true
    });

    canvas.dispatchEvent(downEv);
    canvas.dispatchEvent(upEv);

    // Also check current store state
    const storeState = window.__PROJECT_STORE__ ? window.__PROJECT_STORE__.getState() : null;

    return {
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      center: { cx, cy },
      selectedMemberId: storeState ? storeState.selectedMemberId : 'no store on window',
    };
  })()`);

  console.log('Probe Result:', probeResult);
  await d.sleepMs(1500);

  // Check what happens when we test multiple points across the canvas
  const raycastMultiTest = await d.evalJs(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 'No canvas';
    const rect = canvas.getBoundingClientRect();

    // Test a 5x5 grid of points across the center of canvas
    const results = [];
    for (let gx = 0.3; gx <= 0.7; gx += 0.1) {
      for (let gy = 0.3; gy <= 0.7; gy += 0.1) {
        const x = rect.left + rect.width * gx;
        const y = rect.top + rect.height * gy;

        canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, bubbles: true }));
        canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, button: 0, bubbles: true }));
      }
    }
    return 'Dispatched 25 test clicks across center';
  })()`);
  console.log('Multi click test:', raycastMultiTest);
  await d.sleepMs(1500);

  // Take screenshot to see if anything got selected
  await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/canvas_click_test.png');
  console.log('Saved scratch/canvas_click_test.png');

  console.log('\n--- CONSOLE LOGS ---');
  console.log(d.getConsoleErrors());
  console.log('\n--- PAGE ERRORS ---');
  console.log(d.getPageErrors());

} catch (err) {
  console.error('Error:', err);
} finally {
  await d.close();
  process.exit(0);
}
