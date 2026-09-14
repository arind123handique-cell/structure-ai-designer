import * as d from './cdp-driver.mjs';

try {
  await d.goto('http://localhost:37854/');
  await d.evalJs(`localStorage.setItem('structureai:localMode','1'); true`);
  await d.goto('http://localhost:37854/');
  await d.sleepMs(2000);

  // Navigate to 3D Structural Model
  await d.evalJs(`(() => {
    const btns = [...document.querySelectorAll('button, a')];
    const target = btns.find(b => b.innerText && b.innerText.includes('3D Structural Model'));
    if (target) target.click();
  })()`);
  await d.sleepMs(3000);

  const testResult = await d.evalJs(`(() => {
    const dbg = window.__3D_DEBUG__;
    if (!dbg) return { error: 'no dbg' };

    // Get current selection before
    const store = window.useProjectStore ? window.useProjectStore.getState() : null;

    // Call raycast at screen coordinates x: 413, y: 632 (where Member 1 was projected)
    dbg.raycast(413, 632);

    return {
      invoked: true
    };
  })()`);

  console.log('Raycast test invoked:', testResult);
  await d.sleepMs(1500);

  // Check what the UI displays
  const uiState = await d.evalJs(`(() => {
    const bodyText = document.body.innerText;
    const badges = [...document.querySelectorAll('span, h3, h4, div')].map(e => e.innerText?.trim()).filter(Boolean);
    const memberBadge = badges.find(b => b.includes('MEMBER') || b.includes('COLUMN') || b.includes('BEAM'));
    const inspectorOpen = badges.some(b => b.includes('ENGINEERING PROPERTIES') || b.includes('REBAR') || b.includes('GEOMETRY'));

    return {
      memberBadge,
      inspectorOpen,
      sampleBadges: badges.filter(b => b.includes('MEMBER') || b.includes('COLUMN') || b.includes('BEAM') || b.includes('SUPPORT')).slice(0, 10)
    };
  })()`);

  console.log('UI State after dbg.raycast(413, 632):', JSON.stringify(uiState, null, 2));

  // Now let's try CDP native mouse click at (413, 632)!
  console.log('\nNow dispatching native mouse click at (413, 632)...');
  await d.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 413,
    y: 632,
    button: 'left',
    clickCount: 1
  });
  await d.sleepMs(50);
  await d.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 413,
    y: 632,
    button: 'left',
    clickCount: 1
  });

  await d.sleepMs(1500);

  const uiStateNative = await d.evalJs(`(() => {
    const badges = [...document.querySelectorAll('span, h3, h4, div')].map(e => e.innerText?.trim()).filter(Boolean);
    const memberBadge = badges.find(b => b.includes('MEMBER') || b.includes('COLUMN') || b.includes('BEAM'));
    const inspectorOpen = badges.some(b => b.includes('ENGINEERING PROPERTIES') || b.includes('REBAR') || b.includes('GEOMETRY'));

    return {
      memberBadge,
      inspectorOpen,
      sampleBadges: badges.filter(b => b.includes('MEMBER') || b.includes('COLUMN') || b.includes('BEAM') || b.includes('SUPPORT')).slice(0, 10)
    };
  })()`);

  console.log('UI State after native click at (413, 632):', JSON.stringify(uiStateNative, null, 2));

  await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/test_click_member_413_632.png');
  console.log('Screenshot saved to scratch/test_click_member_413_632.png');

} catch (e) {
  console.error(e);
} finally {
  await d.close();
  process.exit(0);
}
