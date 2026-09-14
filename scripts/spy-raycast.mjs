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

  // Hook into selectMember on the store!
  const hookResult = await d.evalJs(`(() => {
    window.__SELECT_MEMBER_CALLS__ = [];
    const canvas = document.querySelector('canvas');
    const parent = canvas.parentElement;
    const fiberKey = Object.keys(parent).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    let cur = parent[fiberKey];
    let store = null;

    // Search up fiber tree to find useProjectStore
    while (cur) {
      if (cur.memoizedState) {
        let h = cur.memoizedState;
        while (h) {
          const val = h.memoizedState;
          // Check if val has getState
          if (val && typeof val.getState === 'function') {
            store = val;
            break;
          }
          h = h.next;
        }
      }
      if (store) break;
      cur = cur.return;
    }

    // Also check window or hook into window
    return { foundStoreInFiber: !!store };
  })()`);
  console.log('Hook result:', hookResult);

  // Now, let's extract the exact objects used by raycast from the fiber and test them
  const innerTrace = await d.evalJs(`(() => {
    const canvas = document.querySelector('canvas');
    const parent = canvas.parentElement;
    const fiberKey = Object.keys(parent).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    let cur = parent[fiberKey];
    while (cur && (!cur.memoizedState || !cur.memoizedState.memoizedState || !('current' in cur.memoizedState.memoizedState))) {
      cur = cur.return;
    }

    let h = cur.memoizedState;
    // Collect all refs
    const refs = [];
    while (h) {
      if (h.memoizedState && typeof h.memoizedState === 'object' && 'current' in h.memoizedState) {
        refs.push(h.memoizedState.current);
      }
      h = h.next;
    }

    // refs[0]: containerRef
    // refs[1]: rendererRef
    // refs[2]: sceneRef
    // refs[3]: cameraRef
    // refs[4]: controlsRef
    // refs[6]: plotBoundaryGroupRef
    // refs[7]: dynamicGroupRef
    // refs[15]: raycasterRef
    // refs[16]: mouseRef
    // refs[21]: performRaycastSelectionRef

    const renderer = refs[1];
    const scene = refs[2];
    const camera = refs[3];
    const dynamicGroup = refs[7];
    const raycaster = refs[15];
    const mouse = refs[16];

    const B = renderer?.domElement || canvas;
    const K = B.getBoundingClientRect();

    const clientX = 427;
    const clientY = 675;

    mouse.x = ((clientX - K.left) / K.width) * 2 - 1;
    mouse.y = -((clientY - K.top) / K.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    scene.updateMatrixWorld(true);

    const intersects = raycaster.intersectObjects([dynamicGroup], true);

    let hitTarget = null;
    let resolvedMemberId = null;

    for (const item of intersects) {
      let node = item.object;
      while (node && node !== dynamicGroup && node !== scene) {
        if (node.userData && node.userData.memberId != null) {
          resolvedMemberId = Number(node.userData.memberId);
          hitTarget = node;
          break;
        }
        if (
          node.userData &&
          (node.userData.type === 'pile' ||
            node.userData.type === 'support' ||
            node.userData.type === 'gradebeam' ||
            node.userData.type === 'combinedPileCap')
        ) {
          hitTarget = node;
          break;
        }
        node = node.parent;
      }
      if (hitTarget) break;
    }

    const raycastFn = refs[21];
    const h3Before = document.querySelector('h3')?.innerText;

    let fnError = null;
    try {
      raycastFn(427, 675, false);
    } catch (e) {
      fnError = e.message;
    }

    return {
      h3Before,
      fnError,
      resolvedMemberId,
      fnSource: raycastFn ? raycastFn.toString() : null
    };
  })()`);

  console.log('Raycast direct execution:', innerTrace);

  await d.sleepMs(1500);

  const afterDirect = await d.evalJs(`(() => {
    const h3 = document.querySelector('h3');
    return { h3Text: h3?.innerText };
  })()`);

  console.log('After direct execution:', afterDirect);

  // Now dispatch the native click at (427, 675)!
  console.log('Dispatching native click at (427, 675)...');
  await d.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 427,
    y: 675,
    button: 'left',
    clickCount: 1
  });
  await d.sleepMs(50);
  await d.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 427,
    y: 675,
    button: 'left',
    clickCount: 1
  });

  await d.sleepMs(1500);

  const spyLogs = await d.evalJs(`window.__RAYCAST_SPY__`);
  console.log('Raycast spy calls:', spyLogs);

} catch (e) {
  console.error(e);
} finally {
  await d.close();
  process.exit(0);
}
