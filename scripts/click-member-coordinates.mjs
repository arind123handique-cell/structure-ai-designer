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
  await d.sleepMs(2500);

  // In the page, find member screen coordinates using camera projection!
  const memberPoints = await d.evalJs(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas' };

    // Let's inspect window.__SCENE__ or we can get it from Three.js fiber/cache/etc.
    // Or we can query the canvas event listeners
    return {
      canvasRect: canvas.getBoundingClientRect()
    };
  })()`);
  console.log('Member points test setup:', memberPoints);

} catch (err) {
  console.error(err);
} finally {
  await d.close();
  process.exit(0);
}
