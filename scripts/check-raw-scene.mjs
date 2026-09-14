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
  await d.sleepMs(3000);

  const raw = await d.evalJs(`(() => {
    const dbg = window.__3D_DEBUG__;
    if (!dbg) return 'no dbg';
    return {
      hasScene: !!dbg.scene,
      hasCamera: !!dbg.camera,
      sceneChildrenLength: dbg.scene ? dbg.scene.children.length : -1,
      childNames: dbg.scene ? dbg.scene.children.map(c => c.type + (c.name ? ':' + c.name : '')) : [],
      dynamicGroupChildren: dbg.dynamicGroup ? dbg.dynamicGroup.children.length : -1,
      memberMeshesSize: dbg.memberMeshes ? dbg.memberMeshes.size : -1,
    };
  })()`);
  console.log('Raw scene check:', raw);

} catch (err) {
  console.error(err);
} finally {
  await d.close();
  process.exit(0);
}
