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

  const traceResult = await d.evalJs(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const btns = [...document.querySelectorAll('button')];
    const beamBtn = btns.find(b => b.innerText && b.innerText.includes('Beam #1'));
    if (beamBtn) {
      beamBtn.click();
      return { foundAndClicked: true, text: beamBtn.innerText };
    }
    return { foundAndClicked: false };
  })()`);

  console.log('Trace Result:', traceResult);

  await d.sleepMs(1500);

  const afterState = await d.evalJs(`(() => {
    const h3 = document.querySelector('h3');
    const badge = document.querySelector('.bg-emerald-700, .bg-sky-700, .bg-amber-700');
    return {
      h3Text: h3 ? h3.innerText : 'no h3',
      badgeText: badge ? badge.innerText : 'no badge',
      bodySnippet: document.body.innerText.split('\\n').filter(l => l.includes('COLUMN') || l.includes('MEMBER') || l.includes('BEAM')).slice(0, 5)
    };
  })()`);

  console.log('After State:', afterState);
  console.log('Console messages during run:');
  console.log(d.getConsoleErrors().slice(-20));
} catch (e) {
  console.error(e);
} finally {
  await d.close();
  process.exit(0);
}
