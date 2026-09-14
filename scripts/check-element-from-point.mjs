import * as d from './cdp-driver.mjs';

try {
  await d.goto('http://localhost:37854/');
  await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
  await d.goto('http://localhost:37854/');
  await d.sleepMs(2500);

  // Navigate to 3D Model
  await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button, a')];
    const target = btns.find(b => b.innerText && b.innerText.includes('3D Structural Model'));
    if (target) target.click();
  })()`);
  await d.sleepMs(2500);

  // Inspect the canvas and test click dispatch
  const res = await d.evalJs(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const rect = canvas.getBoundingClientRect();

    // Check all event listeners on canvas
    return {
      canvasRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      clientCenter: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    };
  })()`);
  console.log('Canvas info:', res);

  // Now let's expose window.__RAYCAST_DEBUG__ in Structural3DViewer if we want, or inspect the DOM elements!
  // Wait, let's check what element is at (clientCenter.x, clientCenter.y)!
  const elemAtCenter = await d.evalJs(`(() => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const el = document.elementFromPoint(cx, cy);
    return {
      tagName: el ? el.tagName : null,
      className: el ? el.className : null,
      isCanvas: el === canvas,
      id: el ? el.id : null
    };
  })()`);
  console.log('Element from point at center of canvas:', elemAtCenter);

} catch (err) {
  console.error(err);
} finally {
  await d.close();
  process.exit(0);
}
