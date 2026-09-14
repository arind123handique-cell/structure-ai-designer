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

  // Expose a debug window logger
  await d.evalJs(`(() => {
    window.__3D_CLICKS__ = [];
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    ['pointerdown', 'pointerup', 'click'].forEach(evt => {
      canvas.addEventListener(evt, e => {
        window.__3D_CLICKS__.push({
          type: evt,
          button: e.button,
          clientX: e.clientX,
          clientY: e.clientY,
          pointerId: e.pointerId
        });
      }, true); // capturing phase
    });
  })()`);

  // Get canvas center
  const center = await d.evalJs(`(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  console.log('Canvas center for click:', center);

  // Use CDP native mouse click
  console.log('Dispatching native mousePressed and mouseReleased at center...');
  await d.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: center.x,
    y: center.y,
    button: 'left',
    clickCount: 1
  });
  await d.sleepMs(50);
  await d.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: center.x,
    y: center.y,
    button: 'left',
    clickCount: 1
  });

  await d.sleepMs(1500);

  const clicks = await d.evalJs(`window.__3D_CLICKS__`);
  console.log('Captured events on canvas:', clicks);

  // Check what is currently selected in the UI
  const selectionInfo = await d.evalJs(`(() => {
    const hud = document.querySelector('body');
    const text = hud ? hud.innerText : '';
    const hasMemberInspector = text.includes('BEAM MEMBER') || text.includes('COLUMN') || text.includes('MEMBER #');
    return {
      hasMemberInspector,
      preview: text.split('\\n').filter(l => l.includes('MEMBER') || l.includes('BEAM') || l.includes('COLUMN') || l.includes('PILE')).slice(0, 10)
    };
  })()`);
  console.log('Selection Info after click:', selectionInfo);

  await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/after_native_click.png');

} catch (err) {
  console.error(err);
} finally {
  await d.close();
  process.exit(0);
}
