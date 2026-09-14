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

  // Wrap ue.current (performRaycastSelectionRef.current) in fiber
  const wrapResult = await d.evalJs(`(() => {
    window.__RAYCAST_LOGS__ = [];
    const canvas = document.querySelector('canvas');
    const parent = canvas.parentElement;
    const fiberKey = Object.keys(parent).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    let cur = parent[fiberKey];
    while (cur && (!cur.memoizedState || !cur.memoizedState.memoizedState || typeof cur.memoizedState.memoizedState !== 'object' || !('current' in cur.memoizedState.memoizedState))) {
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

    const renderer = refs[1];
    const scene = refs[2];
    const camera = refs[3];
    const dynamicGroup = refs[7];
    const raycaster = refs[15];
    const mouse = refs[16];

    // Find the store functions from fiber or hook #21
    const fnRef = refs.find(r => typeof r === 'function');
    
    // Let's inspect what happens step-by-step
    const B = renderer?.domElement || canvas;
    const K = B.getBoundingClientRect();
    const i = 427;
    const D = 675;
    const L = false;

    mouse.x = ((i - K.left) / K.width) * 2 - 1;
    mouse.y = -((D - K.top) / K.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    scene.updateMatrixWorld(true);
    const W = [dynamicGroup];
    const je = raycaster.intersectObjects(W, true);

    let ye = null;
    let tt = null;

    for (const le of je) {
      let ke = le.object;
      for (; ke && ke !== dynamicGroup && ke !== scene; ) {
        if (ke.userData && ke.userData.memberId != null) {
          tt = Number(ke.userData.memberId);
          ye = ke;
          break;
        }
        if (
          ke.userData &&
          (ke.userData.type === 'pile' ||
            ke.userData.type === 'support' ||
            ke.userData.type === 'gradebeam' ||
            ke.userData.type === 'combinedPileCap')
        ) {
          ye = ke;
          break;
        }
        ke = ke.parent;
      }
      if (ye) break;
    }

    if (!ye) {
      for (const le of je) {
        let ke = le.object;
        for (; ke && ke !== dynamicGroup && ke !== scene; ) {
          if (ke.userData && (ke.userData.plateId != null || ke.userData.type != null)) {
            ye = ke;
            break;
          }
          ke = ke.parent;
        }
        if (ye) break;
      }
    }

    let branch = 'none';
    let targetMemberId = null;
    if (ye) {
      const le = ye.userData;
      if (le.type === 'arch_wall') branch = 'arch_wall';
      else if (le.type === 'arch_door') branch = 'arch_door';
      else if (le.type === 'arch_window') branch = 'arch_window';
      else if (le.type === 'arch_opening') branch = 'arch_opening';
      else if (le.type === 'arch_room') branch = 'arch_room';
      else if (le.type === 'arch_staircase') branch = 'arch_staircase';
      else if (le.type === 'gradebeam' && le.gradeBeamId) branch = 'gradebeam';
      else if (le.type === 'combinedPileCap' && le.nodeIds) branch = 'combinedPileCap';
      else if (le.type === 'pile' && le.nodeId) branch = 'pile';
      else if (le.type === 'support' && le.nodeId) branch = 'support';
      else if (le.type === 'plate' && le.plateId) branch = 'plate';
      else if (le.memberId != null || tt != null) {
        branch = 'member';
        targetMemberId = tt ?? Number(le.memberId);
      }
    } else {
      branch = 'empty_space';
    }

    return {
      jeLength: je.length,
      yeFound: !!ye,
      tt,
      branch,
      targetMemberId,
      yeUserData: ye ? {
        memberId: ye.userData?.memberId,
        type: ye.userData?.type,
        isColumn: ye.userData?.isColumn
      } : null
    };
  })()`);

  console.log('Instrumented trace:', JSON.stringify(wrapResult, null, 2));

  // Dispatch native click at (427, 675)
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

  const logs = await d.evalJs(`window.__RAYCAST_LOGS__`);
  console.log('Raycast logs:', JSON.stringify(logs, null, 2));

  const afterState = await d.evalJs(`(() => {
    const h3 = document.querySelector('h3');
    return { h3: h3?.innerText };
  })()`);
  console.log('Inspector title after click:', afterState);

} catch (e) {
  console.error(e);
} finally {
  await d.close();
  process.exit(0);
}
