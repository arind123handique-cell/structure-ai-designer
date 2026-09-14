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
  await d.sleepMs(2500);

  const columnReport = await d.evalJs(`(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const rect = canvas.getBoundingClientRect();
    const parent = canvas.parentElement;

    const fiberKey = Object.keys(parent).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    let cur = parent[fiberKey];
    let camera, scene, dynamicGroup, raycasterRef, memberMeshes;

    while (cur) {
      if (cur.memoizedState) {
        let hook = cur.memoizedState;
        while (hook) {
          const val = hook.memoizedState?.current;
          if (val && val.isPerspectiveCamera) camera = val;
          if (val && val.isScene) scene = val;
          if (val && val.isGroup && val.name !== 'PLOT_BOUNDARY' && !dynamicGroup) dynamicGroup = val;
          if (val && val.intersectObjects) raycasterRef = val;
          if (val && val instanceof Map && val.size > 0 && !memberMeshes) memberMeshes = val;
          hook = hook.next;
        }
        if (camera && scene && dynamicGroup && memberMeshes) break;
      }
      cur = cur.return;
    }

    scene.updateMatrixWorld(true);

    const projectedColumns = [];
    for (const [id, mesh] of memberMeshes.entries()) {
      if (!mesh.userData?.isColumn) continue;

      const worldPos = new mesh.position.constructor();
      mesh.getWorldPosition(worldPos);
      const proj = worldPos.clone().project(camera);

      // We only want columns facing camera with z < 0.99
      const screenX = Math.round(rect.left + ((proj.x + 1) / 2) * rect.width);
      const screenY = Math.round(rect.top + ((-proj.y + 1) / 2) * rect.height);

      // Check if screenX, screenY is well inside the canvas (at least 50px from edge)
      if (screenX >= rect.left + 50 && screenX <= rect.right - 50 &&
          screenY >= rect.top + 50 && screenY <= rect.bottom - 50) {
        
        // Test raycast at this exact screen position
        const mouseX = ((screenX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((screenY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.setFromCamera(new camera.position.constructor(mouseX, mouseY), camera);
        const hits = raycasterRef.intersectObjects([dynamicGroup], true);

        let hitMemberId = null;
        for (const h of hits) {
          let n = h.object;
          while (n && n !== dynamicGroup) {
            if (n.userData?.memberId != null) {
              hitMemberId = Number(n.userData.memberId);
              break;
            }
            n = n.parent;
          }
          if (hitMemberId) break;
        }

        projectedColumns.push({
          memberId: id,
          screenX,
          screenY,
          hitsCount: hits.length,
          hitMemberId,
          distance: hits.length > 0 ? hits[0].distance.toFixed(2) : null
        });

        if (projectedColumns.length >= 8) break;
      }
    }

    return {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      projectedColumns
    };
  })()`);

  console.log('Projected Columns Report:');
  console.dir(columnReport, { depth: null });

  if (columnReport.projectedColumns && columnReport.projectedColumns.length > 0) {
    const col = columnReport.projectedColumns[0];
    console.log(`\nChecking element at (${col.screenX}, ${col.screenY})...`);

    const elInfo = await d.evalJs(`(() => {
      const el = document.elementFromPoint(${col.screenX}, ${col.screenY});
      const canvas = document.querySelector('canvas');
      return {
        tag: el?.tagName,
        className: el?.className,
        isCanvas: el === canvas,
        parent: el?.parentElement?.className
      };
    })()`);
    console.log('Element at click point:', elInfo);

    console.log(`Now dispatching CDP native mouse click on Column #${col.memberId} at screen (${col.screenX}, ${col.screenY})...`);

    await d.evalJs(`(() => {
      window.__CLICK_EVENTS__ = [];
      const canvas = document.querySelector('canvas');
      ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].forEach(type => {
        canvas.addEventListener(type, e => {
          window.__CLICK_EVENTS__.push({
            type,
            clientX: e.clientX,
            clientY: e.clientY,
            button: e.button,
            pointerType: e.pointerType,
            isTrusted: e.isTrusted
          });
        });
      });
    })()`);

    await d.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: col.screenX,
      y: col.screenY,
      button: 'left',
      clickCount: 1
    });
    await d.sleepMs(50);
    await d.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: col.screenX,
      y: col.screenY,
      button: 'left',
      clickCount: 1
    });

    await d.sleepMs(1500);

    const events = await d.evalJs(`window.__CLICK_EVENTS__`);
    console.log('Events captured on canvas:', events);

    const selectionAfter = await d.evalJs(`(() => {
      const h3 = document.querySelector('h3');
      const badge = document.querySelector('.bg-emerald-700, .bg-sky-700, .bg-amber-700');
      return {
        h3: h3 ? h3.innerText : 'no h3',
        badge: badge ? badge.innerText : 'no badge',
        bodyText: document.body.innerText.split('\\n').filter(l => l.includes('COLUMN') || l.includes('MEMBER') || l.includes('BEAM')).slice(0, 5)
      };
    })()`);

    console.log('Selection after native click on column:', selectionAfter);
    await d.screenshot('C:/Users/Administrator/.gemini/antigravity/brain/94a9b6a1-f8f4-4bdd-9d59-f66ab4488a55/scratch/after_column_click.png');
  }

} catch (e) {
  console.error(e);
} finally {
  await d.close();
  process.exit(0);
}
