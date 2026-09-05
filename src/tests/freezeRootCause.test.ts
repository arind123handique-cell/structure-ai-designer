import { describe, it, expect } from 'vitest';
import { FemSolver3D } from '../features/calculations/femSolver3D';
import { NormalizedStructuralModel, Node3D, Member3D, Support3D } from '../features/model/types';

/**
 * Root-cause freeze tests.
 *
 * Hypothesis: The app freezes because the 3D direct-stiffness FEM solver runs
 * synchronously on the main thread and its cost grows ~cubically with the number
 * of joints (O( (6*N)^3 ) dense Cholesky), with the full dense global matrix being
 * deep-copied and re-solved for EVERY load case.
 *
 * These 10 simulations prove that cost empirically and expose the threshold at
 * which a browser main thread would visibly freeze (>~100ms block).
 */

interface BuildOpts {
  baysX: number;
  baysZ: number;
  stories: number;
  widthX: number;
  widthZ: number;
  storyH: number;
  loadCases?: number;
}

function buildBuildingGrid(opts: BuildOpts): { model: NormalizedStructuralModel; stats: { nodes: number; members: number; dof: number } } {
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
        const x = parseFloat((ix * widthX).toFixed(3));
        const z = parseFloat((iz * widthZ).toFixed(3));
        const id = nodeIdCounter++;
        const isSupport = s === 0;
        nodes.set(id, { id, x, y, z, isSupport });
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

  const numLC = opts.loadCases || 4;
  const loadCases = new Map<number, { id: number; title: string; type: 'DEAD' | 'LIVE' | 'SEISMIC'; isCombination: boolean }>();
  for (let i = 1; i <= numLC; i++) {
    const type: 'DEAD' | 'LIVE' | 'SEISMIC' = i === 1 ? 'DEAD' : i === 2 ? 'LIVE' : 'SEISMIC';
    loadCases.set(i, { id: i, title: `LC${i}`, type, isCombination: false });
  }

  const model: NormalizedStructuralModel = {
    nodes,
    members,
    plates: new Map(),
    supports,
    loadCases,
    loadCombinations: new Map(),
    reactions: [],
    memberForces: [],
    storyDrifts: [],
    boundingBox: {
      minX: 0,
      maxX: baysX * widthX,
      minY: 0,
      maxY: stories * storyH,
      minZ: 0,
      maxZ: baysZ * widthZ,
    },
    statistics: {
      totalNodes: nodes.size,
      totalMembers: members.size,
      totalBeams: 0,
      totalColumns: 0,
      totalPlates: 0,
      totalSupports: supports.size,
      totalLoadCases: numLC,
      totalCombinations: 0,
      maxElevation: stories * storyH,
      baseElevation: 0,
    },
  };

  return { model, stats: { nodes: nodes.size, members: members.size, dof: nodes.size * 6 } };
}

function timeAnalysis(model: NormalizedStructuralModel): number {
  const t0 = performance.now();
  FemSolver3D.analyzeModel(model, { concreteDensity: 25 });
  return performance.now() - t0;
}

describe('FREEZE ROOT-CAUSE: Dense 3D FEM solver main-thread cost scaling', () => {
  const scenarios: { name: string; opts: BuildOpts }[] = [
    { name: 'sim-1: 1-bay G+1 (tiny)', opts: { baysX: 1, baysZ: 1, stories: 1, widthX: 4, widthZ: 3, storyH: 3.2 } },
    { name: 'sim-2: 2x1 G+1 (small)', opts: { baysX: 2, baysZ: 1, stories: 1, widthX: 4, widthZ: 3, storyH: 3.2 } },
    { name: 'sim-3: 3x2 G+2 (typical house)', opts: { baysX: 3, baysZ: 2, stories: 2, widthX: 4.5, widthZ: 4, storyH: 3.2 } },
    { name: 'sim-4: 3x2 G+3', opts: { baysX: 3, baysZ: 2, stories: 3, widthX: 4.5, widthZ: 4, storyH: 3.2 } },
    { name: 'sim-5: 4x3 G+3', opts: { baysX: 4, baysZ: 3, stories: 3, widthX: 4.5, widthZ: 4, storyH: 3.2 } },
    { name: 'sim-6: 4x3 G+4', opts: { baysX: 4, baysZ: 3, stories: 4, widthX: 4.5, widthZ: 4, storyH: 3.2 } },
    { name: 'sim-7: 5x4 G+4', opts: { baysX: 5, baysZ: 4, stories: 4, widthX: 4.5, widthZ: 4, storyH: 3.2 } },
    { name: 'sim-8: 5x4 G+5', opts: { baysX: 5, baysZ: 4, stories: 5, widthX: 4.5, widthZ: 4, storyH: 3.2 } },
    { name: 'sim-9: 6x5 G+5', opts: { baysX: 6, baysZ: 5, stories: 5, widthX: 4.5, widthZ: 4, storyH: 3.2 } },
    { name: 'sim-10: 6x5 G+6 (large commercial)', opts: { baysX: 6, baysZ: 5, stories: 6, widthX: 4.5, widthZ: 4, storyH: 3.2 } },
  ];

  it('records solve time growth and identifies the freeze threshold', () => {
    const results: { name: string; nodes: number; dof: number; ms: number }[] = [];

    for (const { name, opts } of scenarios) {
      const { model, stats } = buildBuildingGrid(opts);
      const ms = timeAnalysis(model);
      results.push({ name, nodes: stats.nodes, dof: stats.dof, ms });
    }

    // eslint-disable-next-line no-console
    console.table(results);

    const freezeThresholdMs = 100; // ~100ms synchronous block = visible jank on main thread
    const frozen = results.filter((r) => r.ms > freezeThresholdMs);

    // The critical claim: at least the larger models exceed the 100ms main-thread
    // budget, which is what makes the UI freeze.
    expect(frozen.length).toBeGreaterThan(0);

    // Expose whether even a "typical" G+2 house (sim-3) is at risk
    const typical = results.find((r) => r.name.includes('sim-3'))!;
    expect(typical.ms).toBeGreaterThan(0);
  });

  it('shows the cost grows faster than linear (approximately cubic in DOF)', () => {
    const small = buildBuildingGrid(scenarios[0].opts);
    const big = buildBuildingGrid(scenarios[scenarios.length - 1].opts);
    const msSmall = timeAnalysis(small.model);
    const msBig = timeAnalysis(big.model);

    const dofRatio = big.stats.dof / small.stats.dof;
    const timeRatio = msBig / Math.max(0.01, msSmall);

    // Document the empirical scaling exponent: time should grow ~ (dofRatio)^p, p>1
    const exponent = Math.log(Math.max(1, timeRatio)) / Math.log(Math.max(1, dofRatio));
    expect(dofRatio).toBeGreaterThan(5);
    // We assert superlinear growth, proving the dense-solve main-thread strategy scales badly.
    expect(exponent).toBeGreaterThan(1.5);
  });
});
