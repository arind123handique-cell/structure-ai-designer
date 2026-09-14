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

  // Query __3D_DEBUG__
  const debugInfo = await d.evalJs(`(() => {
    const dbg = window.__3D_DEBUG__;
    if (!dbg) return { error: '__3D_DEBUG__ not found on window' };

    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();

    const meshesCount = dbg.memberMeshes ? dbg.memberMeshes.size : 0;
    const dynamicGroupChildren = dbg.dynamicGroup ? dbg.dynamicGroup.children.length : 0;

    // Pick 3 members and compute their projected 2D screen coordinates
    const projectedMembers = [];
    if (dbg.memberMeshes && dbg.camera) {
      let count = 0;
      for (const [id, mesh] of dbg.memberMeshes.entries()) {
        if (count >= 5) break;
        const worldPos = new mesh.position.constructor();
        mesh.getWorldPosition(worldPos);
        const projected = worldPos.clone().project(dbg.camera);
        // Convert to clientX, clientY
        const screenX = rect.left + ((projected.x + 1) / 2) * rect.width;
        const screenY = rect.top + ((-projected.y + 1) / 2) * rect.height;

        projectedMembers.push({
          memberId: id,
          type: mesh.userData.isColumn ? 'COLUMN' : 'BEAM',
          worldPos: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
          projected: { x: projected.x, y: projected.y, z: projected.z },
          screen: { x: Math.round(screenX), y: Math.round(screenY) }
        });
        count++;
      }
    }

    const sceneChildren = dbg.scene ? dbg.scene.children.map(c => ({
      name: c.name,
      type: c.type,
      childrenCount: c.children ? c.children.length : 0,
      isDynamicGroup: c === dbg.dynamicGroup
    })) : [];

    return {
      meshesCount,
      dynamicGroupChildren,
      sceneChildren,
      canvasRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      projectedMembers
    };

  })()`);

  console.log('3D Debug Info:', JSON.stringify(debugInfo, null, 2));

  // Now test raycasting directly at the screen coordinates of the first projected member!
  if (debugInfo.projectedMembers && debugInfo.projectedMembers.length > 0) {
    const target = debugInfo.projectedMembers[0];
    console.log(`\nTesting raycast directly on ${target.type} #${target.memberId} at screen (${target.screen.x}, ${target.screen.y})...`);

    const raycastResult = await d.evalJs(`(() => {
      const dbg = window.__3D_DEBUG__;
      if (!dbg) return 'no dbg';

      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      const clientX = ${target.screen.x};
      const clientY = ${target.screen.y};

      // Raycaster calculation
      const mouse = new dbg.camera.position.constructor(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
        0
      );

      const raycaster = new window.THREE ? new window.THREE.Raycaster() : null;
      // Or call dbg.raycast
      dbg.raycast(clientX, clientY);

      return 'Invoked dbg.raycast(' + clientX + ', ' + clientY + ')';
    })()`);
    console.log('Raycast call result:', raycastResult);

    await d.sleepMs(1500);

    const selectionAfter = await d.evalJs(`(() => {
      const title = document.querySelector('h3');
      return title ? title.innerText : 'no h3 found';
    })()`);
    console.log('Inspector title after raycasting at screen pos:', selectionAfter);

    await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/projected_raycast_test.png');
    console.log('Saved scratch/projected_raycast_test.png');
  }

} catch (err) {
  console.error(err);
} finally {
  await d.close();
  process.exit(0);
}
