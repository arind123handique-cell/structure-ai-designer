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

  const fiberResult = await d.evalJs(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const rect = canvas.getBoundingClientRect();
    const parent = canvas.parentElement;
    const fiberKey = Object.keys(parent).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    let cur = parent[fiberKey];
    let camera = null;
    let scene = null;
    let dynamicGroup = null;
    let raycasterRef = null;
    let performRaycastFn = null;

    while (cur) {
      if (cur.memoizedState) {
        let hook = cur.memoizedState;
        while (hook) {
          const val = hook.memoizedState?.current;
          if (val && val.isPerspectiveCamera) camera = val;
          if (val && val.isScene) scene = val;
          if (val && val.isGroup && val.name !== 'PLOT_BOUNDARY' && !dynamicGroup) dynamicGroup = val;
          if (val && val.intersectObjects) raycasterRef = val;
          if (typeof val === 'function') performRaycastFn = val;
          hook = hook.next;
        }
        if (camera && scene) break;
      }
      cur = cur.return;
    }

    if (!camera || !scene || !dynamicGroup) {
      return { error: 'Missing camera, scene or dynamicGroup', camera: !!camera, scene: !!scene, dynamicGroup: !!dynamicGroup };
    }

    // Now find 5 members and project them to screen coordinates
    const dbg = window.__3D_DEBUG__;
    const memberMeshes = dbg.memberMeshes;
    const sampleTests = [];

    // Force matrix update
    scene.updateMatrixWorld(true);

    let count = 0;
    for (const [id, mesh] of memberMeshes.entries()) {
      const worldPos = new mesh.position.constructor();
      mesh.getWorldPosition(worldPos);
      const proj = worldPos.clone().project(camera);

      // Check if within frustum (-1 to 1)
      const inFrustum = proj.x >= -1 && proj.x <= 1 && proj.y >= -1 && proj.y <= 1 && proj.z >= -1 && proj.z <= 1;

      const screenX = rect.left + ((proj.x + 1) / 2) * rect.width;
      const screenY = rect.top + ((-proj.y + 1) / 2) * rect.height;

      // Test raycasting from this screen coordinate
      const mouse = new proj.constructor(
        ((screenX - rect.left) / rect.width) * 2 - 1,
        -((screenY - rect.top) / rect.height) * 2 + 1,
        0.5
      );
      // Unproject or use raycasterRef
      raycasterRef.setFromCamera(mouse, camera);
      const hits = raycasterRef.intersectObjects([dynamicGroup], true);

      sampleTests.push({
        id,
        isColumn: mesh.userData?.isColumn,
        screen: { x: Math.round(screenX), y: Math.round(screenY) },
        hitsCount: hits.length,
        allHits: hits.map(h => {
          let p = h.object;
          const chain = [];
          while (p) {
            chain.push({
              type: p.type,
              name: p.name,
              uDataKeys: p.userData ? Object.keys(p.userData) : [],
              memberId: p.userData?.memberId,
              typeKey: p.userData?.type
            });
            p = p.parent;
          }
          return {
            objType: h.object?.type,
            chain,
            distance: Number(h.distance.toFixed(2))
          };
        })
      });

      count++;
      if (count >= 5) break;
    }

    // Inspect Member 3 specifically
    const m3 = memberMeshes.get(3);
    const m3Info = m3 ? {
      hasGeometry: !!m3.geometry,
      scale: { x: m3.scale.x, y: m3.scale.y, z: m3.scale.z },
      pos: { x: m3.position.x, y: m3.position.y, z: m3.position.z },
      memberId: m3.userData?.memberId,
      type: m3.userData?.type
    } : null;

    return {
      canvasRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      cameraPos: { x: camera.position.x.toFixed(2), y: camera.position.y.toFixed(2), z: camera.position.z.toFixed(2) },
      sampleTests,
      m3Info
    };
  })()`);

  console.log('Fiber Result Summary:');
  console.dir(fiberResult.sampleTests, { depth: null });
} catch (e) {
  console.error(e);
} finally {
  await d.close();
  process.exit(0);
}
