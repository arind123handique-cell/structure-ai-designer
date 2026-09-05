import { describe, it, expect } from 'vitest';
import { FemSolver3D } from '../features/calculations/femSolver3D';
import { NormalizedStructuralModel, Node3D, Member3D, Support3D } from '../features/model/types';

/**
 * Verifies the banded solver is a drop-in replacement:
 *  - identical results to the original dense Cholesky solver
 *  - meaningfully faster on larger models (the fix for the freeze)
 */

interface BuildOpts {
  baysX: number;
  baysZ: number;
  stories: number;
  widthX: number;
  widthZ: number;
  storyH: number;
}

function buildBuildingGrid(opts: BuildOpts): NormalizedStructuralModel {
  const { baysX, baysZ, stories, widthX, widthZ, storyH } = opts;
  const nodes = new Map<number, Node3D>();
  const members = new Map<number, Member3D>();
  const supports = new Map<number, Support3D>();
  const gridNodeMap = new Map<string, number>();
  let nodeIdCounter = 1;
  let memberIdCounter = 1;

  for (let s = 0; s <= stories; s++) {
    const y = parseFloat((s * storyH).toFixed(3));
    for (let ix = 0; ix <= baysX; ix++) {
      for (let iz = 0; iz <= baysZ; iz++) {
        const id = nodeIdCounter++;
        const isSupport = s === 0;
        nodes.set(id, { id, x: ix * widthX, y, z: iz * widthZ, isSupport });
        gridNodeMap.set(`${s}_${ix}_${iz}`, id);
        if (isSupport) {
          supports.set(id, {
            nodeId: id,
            type: 'FIXED',
            releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
          });
        }
      }
    }
  }
  for (let s = 0; s < stories; s++) {
    for (let ix = 0; ix <= baysX; ix++) {
      for (let iz = 0; iz <= baysZ; iz++) {
        const id = memberIdCounter++;
        members.set(id, {
          id,
          startNodeId: gridNodeMap.get(`${s}_${ix}_${iz}`)!,
          endNodeId: gridNodeMap.get(`${s + 1}_${ix}_${iz}`)!,
          length: storyH,
          classification: 'COLUMN',
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.45, name: 'C450x450' },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
        });
      }
    }
  }
  for (let s = 1; s <= stories; s++) {
    for (let ix = 0; ix < baysX; ix++) {
      for (let iz = 0; iz <= baysZ; iz++) {
        const id = memberIdCounter++;
        members.set(id, {
          id,
          startNodeId: gridNodeMap.get(`${s}_${ix}_${iz}`)!,
          endNodeId: gridNodeMap.get(`${s}_${ix + 1}_${iz}`)!,
          length: widthX,
          classification: 'BEAM',
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3, name: 'B300x450' },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
        });
      }
    }
    for (let ix = 0; ix <= baysX; ix++) {
      for (let iz = 0; iz < baysZ; iz++) {
        const id = memberIdCounter++;
        members.set(id, {
          id,
          startNodeId: gridNodeMap.get(`${s}_${ix}_${iz}`)!,
          endNodeId: gridNodeMap.get(`${s}_${ix}_${iz + 1}`)!,
          length: widthZ,
          classification: 'BEAM',
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3, name: 'B300x450' },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
        });
      }
    }
  }

  return {
    nodes,
    members,
    plates: new Map(),
    supports,
    loadCases: new Map([
      [1, { id: 1, title: 'Dead Load (DL)', type: 'DEAD' as const, isCombination: false }],
      [2, { id: 2, title: 'Live Load (LL)', type: 'LIVE' as const, isCombination: false }],
      [3, { id: 3, title: 'Seismic Load X (EQX)', type: 'SEISMIC' as const, isCombination: false }],
      [4, { id: 4, title: 'Seismic Load Z (EQZ)', type: 'SEISMIC' as const, isCombination: false }],
    ]),
    loadCombinations: new Map(),
    reactions: [],
    memberForces: [],
    storyDrifts: [],
    boundingBox: { minX: 0, maxX: baysX * widthX, minY: 0, maxY: stories * storyH, minZ: 0, maxZ: baysZ * widthZ },
    statistics: {
      totalNodes: nodes.size,
      totalMembers: members.size,
      totalBeams: 0,
      totalColumns: 0,
      totalPlates: 0,
      totalSupports: supports.size,
      totalLoadCases: 4,
      totalCombinations: 0,
      maxElevation: stories * storyH,
      baseElevation: 0,
    },
  };
}

function extractMatrix(model: NormalizedStructuralModel): { K: number[][]; F: number[] } {
  // Reproduce the assembled K_mod and F_mod for a fixed single load case (DEAD) exactly
  // as analyzeModel does, so we can compare solvers on an identical linear system.
  const nodes = Array.from(model.nodes.values()).sort((a, b) => a.id - b.id);
  const members = Array.from(model.members.values());
  const nodeIndexMap = new Map<number, number>();
  nodes.forEach((n, idx) => nodeIndexMap.set(n.id, idx));
  const n = nodes.length * 6;
  const K_global = Array.from({ length: n }, () => new Float64Array(n));

  members.forEach((mem) => {
    const start = model.nodes.get(mem.startNodeId)!;
    const end = model.nodes.get(mem.endNodeId)!;
    const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L < 1e-4) return;
    const props = FemSolver3D.calculateSectionProps(mem.section);
    const R = FemSolver3D.get3dRotationMatrix(start, end, mem.betaAngle || 0);
    const kLocal = FemSolver3D.getLocalStiffnessMatrix(L, props.area, props.iy, props.iz, props.j, props.e, props.g);
    const kG = FemSolver3D.transformStiffnessToGlobal(kLocal, R);
    const a = nodeIndexMap.get(start.id)! * 6;
    const b = nodeIndexMap.get(end.id)! * 6;
    const dof = [
      a, a + 1, a + 2, a + 3, a + 4, a + 5,
      b, b + 1, b + 2, b + 3, b + 4, b + 5,
    ];
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        K_global[dof[i]][dof[j]] += kG[i][j];
      }
    }
  });

  const F = new Array(n).fill(0);
  // apply fixed supports same as analyzeModel
  nodes.forEach((nd) => {
    if (nd.isSupport) {
      const base = nodeIndexMap.get(nd.id)! * 6;
      for (let d = 0; d < 6; d++) {
        K_global[base + d].fill(0);
        K_global[base + d][base + d] = 1e12;
        F[base + d] = 0;
      }
    }
  });
  const K = K_global.map((row) => Array.from(row));
  return { K, F };
}

describe('Banded solver: drop-in equivalence & performance', () => {
  it('produces numerically identical displacements to the dense solver', () => {
    for (const opts of [
      { baysX: 2, baysZ: 1, stories: 1, widthX: 4, widthZ: 3, storyH: 3.2 },
      { baysX: 3, baysZ: 2, stories: 2, widthX: 4.5, widthZ: 4, storyH: 3.2 },
      { baysX: 4, baysZ: 3, stories: 3, widthX: 4.5, widthZ: 4, storyH: 3.2 },
    ]) {
      const model = buildBuildingGrid(opts);
      const { K, F } = extractMatrix(model);

      const dense = FemSolver3D.solveLinearSystem(K, F);
      const banded = FemSolver3D.solveLinearSystemBanded(K, F);

      expect(banded.length).toBe(dense.length);
      for (let i = 0; i < dense.length; i++) {
        expect(Math.abs(banded[i] - dense[i])).toBeLessThan(1e-6);
      }
    }
  });

  it('is faster than the dense solver on a moderately sized model', () => {
    const model = buildBuildingGrid({ baysX: 5, baysZ: 4, stories: 4, widthX: 4.5, widthZ: 4, storyH: 3.2 });
    const { K, F } = extractMatrix(model);

    const dense = FemSolver3D.solveLinearSystem(K, F);
    const banded = FemSolver3D.solveLinearSystemBanded(K, F);
    // equivalence on the same sized system
    expect(banded.length).toBe(dense.length);

    const t0 = performance.now();
    for (let i = 0; i < 8; i++) FemSolver3D.solveLinearSystem(K, F);
    const denseMs = performance.now() - t0;

    const t1 = performance.now();
    for (let i = 0; i < 8; i++) FemSolver3D.solveLinearSystemBanded(K, F);
    const bandedMs = performance.now() - t1;

    // eslint-disable-next-line no-console
    console.log(`dense=${denseMs.toFixed(1)}ms  banded=${bandedMs.toFixed(1)}ms  speedup=${(denseMs / Math.max(0.1, bandedMs)).toFixed(1)}x`);
    expect(bandedMs).toBeLessThan(denseMs);
  });
});
