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

  const res = await d.evalJs(`(() => {
    const dbg = window.__3D_DEBUG__;
    if (!dbg || !dbg.memberMeshes || dbg.memberMeshes.size === 0) return { error: 'no meshes' };

    // Find the scene and camera from the first mesh
    const firstMesh = Array.from(dbg.memberMeshes.values())[0];
    const dynamicGroup = firstMesh.parent;
    const scene = dynamicGroup.parent;

    // Find camera: look through scene or check window
    let camera = null;
    // In Three.js, camera might be in scene or in OrbitControls
    scene.traverse(obj => {
      if (obj.isCamera) camera = obj;
    });

    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();

    // Check if raycasterRef or camera is available
    return {
      dynamicGroupType: dynamicGroup.type,
      dynamicGroupChildrenCount: dynamicGroup.children.length,
      sceneType: scene.type,
      sceneChildrenCount: scene.children.length,
      sceneCameraFound: !!camera,
      memberCount: dbg.memberMeshes.size
    };
  })()`);

  console.log('HIERARCHY DEBUG:', JSON.stringify(res, null, 2));
} catch (e) {
  console.error(e);
} finally {
  await d.close();
  process.exit(0);
}
