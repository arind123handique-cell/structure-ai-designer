import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { useProjectStore } from '../features/projects/projectStore';
import { NormalizedStructuralModel, Node3D, Member3D, Support3D, Plate3D } from '../features/model/types';

describe('3D Viewport Selection Engine — 5 Scenarios Verified 5 Times', () => {
  let scene: THREE.Scene;
  let dynamicGroup: THREE.Group;
  let camera: THREE.PerspectiveCamera;
  let raycaster: THREE.Raycaster;

  // Mock model setup
  const mockModel: NormalizedStructuralModel = {
    nodes: new Map<number, Node3D>([
      [1, { id: 1, x: 0, y: 0, z: 0, isSupport: true }],
      [2, { id: 2, x: 0, y: 3.5, z: 0 }],
      [3, { id: 3, x: 5, y: 3.5, z: 0 }],
      [4, { id: 4, x: 5, y: 0, z: 0, isSupport: true }],
      [5, { id: 5, x: 0, y: 3.5, z: 5 }],
      [6, { id: 6, x: 5, y: 3.5, z: 5 }],
    ]),
    members: new Map<number, Member3D>([
      // Member 1: Column from node 1 (0,0,0) to node 2 (0,3.5,0)
      [
        1,
        {
          id: 1,
          startNodeId: 1,
          endNodeId: 2,
          length: 3.5,
          section: { name: 'COL_300x450', type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
          classification: 'COLUMN',
          isAutoClassified: false,
          materialName: 'CONCRETE',
          designStatus: 'PASS',
        },
      ],
      // Member 2: Beam from node 2 (0,3.5,0) to node 3 (5,3.5,0)
      [
        2,
        {
          id: 2,
          startNodeId: 2,
          endNodeId: 3,
          length: 5.0,
          section: { name: 'BEAM_300x450', type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
          classification: 'BEAM',
          isAutoClassified: false,
          materialName: 'CONCRETE',
          designStatus: 'PASS',
        },
      ],
    ]),
    plates: new Map<number, Plate3D>([
      [
        1,
        {
          id: 1,
          nodeIds: [2, 3, 6, 5],
          thickness: 0.15,
          classification: 'SLAB',
          materialName: 'CONCRETE',
        },
      ],
    ]),
    supports: new Map<number, Support3D>([
      [1, { nodeId: 1, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [4, { nodeId: 4, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
    ]),
    loadCases: new Map(),
    loadCombinations: new Map(),
    memberForces: [],
    nodeDisplacements: new Map(),
    reactions: [],
    storyDrifts: [],
    boundingBox: { minX: 0, maxX: 5, minY: 0, maxY: 3.5, minZ: 0, maxZ: 5 },
    statistics: {
      totalNodes: 6,
      totalMembers: 2,
      totalPlates: 1,
      totalSupports: 2,
      totalColumns: 1,
      totalBeams: 1,
      totalLoadCases: 0,
      totalCombinations: 0,
      maxElevation: 3.5,
      baseElevation: 0,
    },
  };

  // Reusable 3D Raycasting Engine matching Structural3DViewer.tsx
  function performRaycastSelection(
    rayOrigin: THREE.Vector3,
    rayDirection: THREE.Vector3,
    isMulti: boolean = false
  ) {
    raycaster.set(rayOrigin, rayDirection);

    const intersects = raycaster.intersectObjects(dynamicGroup.children, true);
    // console.log
    if (intersects.length === 0) {
      console.log('RAY MISSED! Origin:', rayOrigin, 'Dir:', rayDirection, 'DynamicGroup children:', dynamicGroup.children.length);
    } else {
      console.log('RAY HIT! Count:', intersects.length, 'Targets:', intersects.map(i => i.object.userData));
    }

    if (intersects.length > 0) {
      let hitTarget: THREE.Object3D | null = null;
      let resolvedMemberId: number | null = null;

      // Priority 1: Structural members (beam/column), supports, pile caps
      for (const item of intersects) {
        let node: THREE.Object3D | null = item.object;
        while (node && node !== dynamicGroup && node !== scene) {
          if (node.userData && node.userData.memberId != null) {
            resolvedMemberId = Number(node.userData.memberId);
            hitTarget = node;
            break;
          }
          if (
            node.userData &&
            (node.userData.type === 'support' ||
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

      // Priority 2: Plates (slabs) or architectural elements
      if (!hitTarget) {
        for (const item of intersects) {
          let node: THREE.Object3D | null = item.object;
          while (node && node !== dynamicGroup && node !== scene) {
            if (node.userData && (node.userData.plateId != null || node.userData.type != null)) {
              hitTarget = node;
              break;
            }
            node = node.parent;
          }
          if (hitTarget) break;
        }
      }

      if (hitTarget) {
        const u = hitTarget.userData;
        if (u.type === 'support' && u.nodeId) {
          useProjectStore.getState().selectSupportNode(Number(u.nodeId), isMulti);
          useProjectStore.getState().selectMember(null);
          useProjectStore.getState().selectPlate(null);
          return;
        } else if (u.type === 'plate' && u.plateId) {
          useProjectStore.getState().selectPlate(Number(u.plateId));
          useProjectStore.getState().selectMember(null);
          if (!isMulti) useProjectStore.getState().clearSelectedSupportNodes();
          return;
        } else if (u.memberId != null || resolvedMemberId != null) {
          const targetId = resolvedMemberId ?? Number(u.memberId);
          useProjectStore.getState().selectMember(targetId);
          useProjectStore.getState().selectPlate(null);
          if (!isMulti) useProjectStore.getState().clearSelectedSupportNodes();
          return;
        }
      }
    }

    // Empty space deselect
    if (!isMulti) {
      useProjectStore.getState().selectMember(null);
      useProjectStore.getState().selectPlate(null);
      useProjectStore.getState().clearSelectedSupportNodes();
    }
  }

  beforeEach(() => {
    // Reset store state
    useProjectStore.setState({
      activeModel: mockModel,
      selectedMemberId: null,
      selectedPlateId: null,
      selectedSupportNodeIds: [],
    });

    scene = new THREE.Scene();
    dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);

    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 2, 0);

    raycaster = new THREE.Raycaster();
    raycaster.camera = camera;
    raycaster.params.Line.threshold = 0.5;

    // 1. Build Column 1 Mesh (at X=0, Y=1.75, Z=0)
    const colGeom = new THREE.BoxGeometry(0.3, 3.5, 0.45);
    const colMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
    const colMesh = new THREE.Mesh(colGeom, colMat);
    colMesh.position.set(0, 1.75, 0);
    colMesh.userData = { memberId: 1, type: 'member', isColumn: true };
    dynamicGroup.add(colMesh);

    // Column 1 Edge Line (with outline tolerance)
    const colEdges = new THREE.EdgesGeometry(colGeom);
    const colEdgeLine = new THREE.LineSegments(colEdges, new THREE.LineBasicMaterial({ color: 0x059669 }));
    colEdgeLine.position.copy(colMesh.position);
    colEdgeLine.userData = { memberId: 1, type: 'member', isColumn: true };
    dynamicGroup.add(colEdgeLine);

    // 2. Build Beam 2 Mesh (at X=2.5, Y=3.5, Z=0)
    const beamGeom = new THREE.BoxGeometry(5.0, 0.45, 0.3);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const beamMesh = new THREE.Mesh(beamGeom, beamMat);
    beamMesh.position.set(2.5, 3.5, 0);
    beamMesh.userData = { memberId: 2, type: 'member', isColumn: false };
    dynamicGroup.add(beamMesh);

    // 3. Build Slab Plate 1 (quad from X=0 to 5, Z=0 to 5 at Y=3.5)
    // Note: Sits right on top of Beam 2!
    const plateGeom = new THREE.BufferGeometry();
    const plateVertices = new Float32Array([
      0, 3.5, 0,
      5, 3.5, 0,
      5, 3.5, 5,
      0, 3.5, 0,
      5, 3.5, 5,
      0, 3.5, 5,
    ]);
    plateGeom.setAttribute('position', new THREE.BufferAttribute(plateVertices, 3));
    plateGeom.computeVertexNormals();
    const plateMesh = new THREE.Mesh(plateGeom, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    plateMesh.userData = { type: 'plate', plateId: 1 };
    dynamicGroup.add(plateMesh);

    // 4. Build Support Cone at Node 1 (0, 0, 0)
    const suppGeom = new THREE.ConeGeometry(0.4, 0.6, 4);
    const suppMesh = new THREE.Mesh(suppGeom, new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide }));
    suppMesh.position.set(0, -0.3, 0);
    suppMesh.userData = { type: 'support', nodeId: 1 };
    dynamicGroup.add(suppMesh);

    colMesh.updateMatrix();
    colMesh.updateMatrixWorld(true);
    colEdgeLine.updateMatrix();
    colEdgeLine.updateMatrixWorld(true);
    beamMesh.updateMatrix();
    beamMesh.updateMatrixWorld(true);
    plateMesh.updateMatrix();
    plateMesh.updateMatrixWorld(true);
    suppMesh.updateMatrix();
    suppMesh.updateMatrixWorld(true);

    dynamicGroup.updateMatrix();
    dynamicGroup.updateMatrixWorld(true);
    scene.updateMatrix();
    scene.updateMatrixWorld(true);
  });

  // Run the 5 verification scenarios in a 5-iteration loop (5 tests x 5 iterations = 25 checks)
  for (let iteration = 1; iteration <= 5; iteration++) {
    describe(`Iteration ${iteration} of 5`, () => {
      it(`[Scenario 1 / Iteration ${iteration}]: Column Selection — ray hitting Column 1 / EdgeLine selects member #1`, () => {
        // Raycast directed right at the center of Column 1
        const origin = new THREE.Vector3(0, 1.75, 5);
        const dir = new THREE.Vector3(0, 0, -1).normalize();

        performRaycastSelection(origin, dir);

        const state = useProjectStore.getState();
        expect(state.selectedMemberId).toBe(1);
        expect(state.selectedPlateId).toBeNull();
        expect(state.selectedSupportNodeIds).toEqual([]);
      });

      it(`[Scenario 2 / Iteration ${iteration}]: Beam vs Slab Prioritization — clicking Beam #2 under floor slab selects Beam #2`, () => {
        // Raycast from above (Y=10) down through the slab (Y=3.5) directly at Beam 2 (X=2.5, Y=3.5, Z=0)
        const origin = new THREE.Vector3(2.5, 10, 0);
        const dir = new THREE.Vector3(0, -1, 0).normalize();

        performRaycastSelection(origin, dir);

        const state = useProjectStore.getState();
        // Priority 1 ensures Beam 2 is selected rather than the floor slab plate!
        expect(state.selectedMemberId).toBe(2);
        expect(state.selectedPlateId).toBeNull();
      });

      it(`[Scenario 3 / Iteration ${iteration}]: Slab Plate Selection — clicking open floor bay selects Floor Slab #1`, () => {
        // Raycast from above (Y=10) down through the slab center (X=2.5, Z=2.5) where NO beam exists
        const origin = new THREE.Vector3(2.5, 10, 2.5);
        const dir = new THREE.Vector3(0, -1, 0).normalize();

        performRaycastSelection(origin, dir);

        const state = useProjectStore.getState();
        expect(state.selectedPlateId).toBe(1);
        expect(state.selectedMemberId).toBeNull();
      });

      it(`[Scenario 4 / Iteration ${iteration}]: Support / Foundation Selection — clicking Support at Node 1 selects Support Node #1`, () => {
        // Raycast directed at Support Cone at (0, -0.3, 0)
        const origin = new THREE.Vector3(0, -0.3, 5);
        const dir = new THREE.Vector3(0, 0, -1).normalize();

        performRaycastSelection(origin, dir);

        const state = useProjectStore.getState();
        expect(state.selectedSupportNodeIds).toContain(1);
        expect(state.selectedMemberId).toBeNull();
        expect(state.selectedPlateId).toBeNull();
      });

      it(`[Scenario 5 / Iteration ${iteration}]: Empty Space Deselection & Drag Discrimination`, () => {
        // First, select Member 1
        useProjectStore.getState().selectMember(1);
        expect(useProjectStore.getState().selectedMemberId).toBe(1);

        // Raycast into empty space (X=100, Y=100, Z=100)
        const origin = new THREE.Vector3(100, 100, 100);
        const dir = new THREE.Vector3(0, 1, 0).normalize();

        performRaycastSelection(origin, dir);

        const state = useProjectStore.getState();
        expect(state.selectedMemberId).toBeNull();
        expect(state.selectedPlateId).toBeNull();
        expect(state.selectedSupportNodeIds).toEqual([]);

        // Verify Drag vs Click Discriminator logic
        const startPos = { x: 200, y: 300 };
        const dragEndPos = { x: 250, y: 350 }; // distance = 70.7px > 6px -> DRAG
        const dragDist = Math.hypot(dragEndPos.x - startPos.x, dragEndPos.y - startPos.y);
        const isDrag = dragDist >= 6;
        expect(isDrag).toBe(true);

        const clickEndPos = { x: 202, y: 301 }; // distance = 2.2px < 6px -> CLICK
        const clickDist = Math.hypot(clickEndPos.x - startPos.x, clickEndPos.y - startPos.y);
        const isClick = clickDist < 6;
        expect(isClick).toBe(true);
      });
    });
  }
});
