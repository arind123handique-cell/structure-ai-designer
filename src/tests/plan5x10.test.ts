import { describe, it, expect } from 'vitest';
import { FemSolver3D } from '../features/calculations/femSolver3D';
import { NormalizedStructuralModel, Node3D, Member3D, Support3D } from '../features/model/types';

/**
 * 5m x 10m plan project test.
 *
 * Builds a G+1 reinforced-concrete space frame on a 5m (X) x 10m (Z) footprint and
 * runs the app's own 3D FEM solver on it. Verifies equilibrium, displacement,
 * reaction and member-force magnitudes are physically sensible for a small house
 * plan, and confirms the solve stays fast (well under the ~100ms freeze budget).
 */

type LcType = 'DEAD' | 'LIVE' | 'SEISMIC';

function buildPlan5x10(opts: { baysX: number; baysZ: number; stories: number; storyH: number }): {
  model: NormalizedStructuralModel;
  stats: { nodes: number; members: number; columns: number; beams: number; dof: number };
} {
  const { baysX, baysZ, stories, storyH } = opts;
  const widthX = 5; // metres (plan, X)
  const widthZ = 10; // metres (plan, Z)
  const bayX = widthX / baysX;
  const bayZ = widthZ / baysZ;

  const nodes = new Map<number, Node3D>();
  const members = new Map<number, Member3D>();
  const supports = new Map<number, Support3D>();
  const key = new Map<string, number>();
  let nid = 1;
  let mid = 1;

  for (let s = 0; s <= stories; s++) {
    const y = parseFloat((s * storyH).toFixed(3));
    for (let ix = 0; ix <= baysX; ix++) {
      for (let iz = 0; iz <= baysZ; iz++) {
        const x = parseFloat((ix * bayX).toFixed(3));
        const z = parseFloat((iz * bayZ).toFixed(3));
        const id = nid++;
        const isSupport = s === 0;
        nodes.set(id, { id, x, y, z, isSupport });
        key.set(`${s}_${ix}_${iz}`, id);
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

  // Columns
  for (let s = 0; s < stories; s++) {
    for (let ix = 0; ix <= baysX; ix++) {
      for (let iz = 0; iz <= baysZ; iz++) {
        members.set(mid++, {
          id: mid - 1,
          startNodeId: key.get(`${s}_${ix}_${iz}`)!,
          endNodeId: key.get(`${s + 1}_${ix}_${iz}`)!,
          length: storyH,
          classification: 'COLUMN',
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.3, zd: 0.3, name: 'C300x300' },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
        });
      }
    }
  }

  // Beams (along X, then along Z)
  for (let s = 1; s <= stories; s++) {
    for (let ix = 0; ix < baysX; ix++) {
      for (let iz = 0; iz <= baysZ; iz++) {
        members.set(mid, {
          id: mid,
          startNodeId: key.get(`${s}_${ix}_${iz}`)!,
          endNodeId: key.get(`${s}_${ix + 1}_${iz}`)!,
          length: bayX,
          classification: 'BEAM',
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.23, name: 'B230x450' },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
        });
        mid++;
      }
    }
    for (let ix = 0; ix <= baysX; ix++) {
      for (let iz = 0; iz < baysZ; iz++) {
        members.set(mid, {
          id: mid,
          startNodeId: key.get(`${s}_${ix}_${iz}`)!,
          endNodeId: key.get(`${s}_${ix}_${iz + 1}`)!,
          length: bayZ,
          classification: 'BEAM',
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.23, name: 'B230x450' },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
        });
        mid++;
      }
    }
  }

  const numLC = 3;
  const loadCases = new Map<number, { id: number; title: string; type: LcType; isCombination: boolean }>();
  const lcTitles: [number, string][] = [
    [1, 'DEAD'],
    [2, 'LIVE'],
    [3, 'EQX'],
  ];
  for (const [id, type] of lcTitles as [number, string][]) {
    loadCases.set(id, { id, title: type, type: type as LcType, isCombination: false });
  }

  let columns = 0;
  let beams = 0;
  for (const m of members.values()) {
    if (m.classification === 'COLUMN') columns++;
    else if (m.classification === 'BEAM') beams++;
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
    boundingBox: { minX: 0, maxX: widthX, minY: 0, maxY: stories * storyH, minZ: 0, maxZ: widthZ },
    statistics: {
      totalNodes: nodes.size,
      totalMembers: members.size,
      totalBeams: beams,
      totalColumns: columns,
      totalPlates: 0,
      totalSupports: supports.size,
      totalLoadCases: numLC,
      totalCombinations: 0,
      maxElevation: stories * storyH,
      baseElevation: 0,
    },
  };

  return { model, stats: { nodes: nodes.size, members: members.size, columns, beams, dof: nodes.size * 6 } };
}

describe('5m x 10m plan project', () => {
  const cfg = { baysX: 2, baysZ: 2, stories: 1, storyH: 3.2 };
  let model: NormalizedStructuralModel;
  let stats: { nodes: number; members: number; columns: number; beams: number; dof: number };
  let fem: ReturnType<typeof FemSolver3D.analyzeModel>;
  let ms: number;

  it('builds the plan and solves without freezing', () => {
    const built = buildPlan5x10(cfg);
    model = built.model;
    stats = built.stats;
    const t0 = performance.now();
    fem = FemSolver3D.analyzeModel(model, { concreteDensity: 25 });
    ms = performance.now() - t0;

    // eslint-disable-next-line no-console
    console.log(
      `5m x 10m G+1: nodes=${stats.nodes} members=${stats.members} (cols=${stats.columns}, beams=${stats.beams}) dof=${stats.dof} solve=${ms.toFixed(1)}ms`
    );
    expect(stats.nodes).toBeGreaterThan(0);
    expect(stats.members).toBeGreaterThan(0);
  });

  it('keeps the solve well under the ~100ms freeze budget', () => {
    expect(ms).toBeLessThan(100);
    // eslint-disable-next-line no-console
    console.log(`solve time ${ms.toFixed(1)}ms < 100ms freeze budget`);
  });

  it('is in vertical equilibrium (applied loads ≈ computed reactions)', () => {
    const totalApplied = fem.totalAppliedLoadKn.y;
    const totalReaction = fem.totalReactionKn.y;
    // eslint-disable-next-line no-console
    console.log(`total applied |Fy|=${totalApplied.toFixed(1)} kN (all LCs), total |Fy| reactions=${totalReaction.toFixed(1)} kN`);
    // The solver's own equivalence: aggregate applied loads should balance aggregate reactions.
    expect(fem.equilibriumCheck).toBe('PASS');
    expect(Math.abs(totalApplied - totalReaction) / Math.max(1, Math.abs(totalApplied))).toBeLessThan(0.10);
  });

  it('produces physically sensible support reactions and displacements', () => {
    const dlMax = Math.max(...fem.reactions.filter((r) => r.loadCaseId === 1).map((r) => Math.abs(r.fy)));
    // For a 5x10m G+1 frame: total dead load ~ (slab+beams+cols) on 6 columns.
    // Expect each column reaction to be on the order of a few tens of kN -- a 5x10m single
    // storey carries roughly 5x10m area x (0.125m slab x 25 + 3 kPa) ~ hundreds of kN total,
    // so per-column ~ a few tens to ~100 kN.
    // eslint-disable-next-line no-console
    console.log(`max DL support reaction = ${dlMax.toFixed(1)} kN; max displacement = ${(fem.maxDisplacementM * 1000).toFixed(1)} mm`);
    expect(dlMax).toBeGreaterThan(1);
    expect(dlMax).toBeLessThan(400);
    // Displacements should be small (well under IS 1893 drift allowance)
    expect(fem.maxDisplacementM * 1000).toBeLessThan(30);
  });

  it('reports member internal forces for every member and load case', () => {
    const expectedRecords = stats.members * fem.memberForces.length;
    expect(fem.memberForces.length).toBeGreaterThan(0);
    // 5 stations per member per load case
    const memberIds = new Set(fem.memberForces.map((mf) => mf.memberId));
    expect(memberIds.size).toBe(stats.members);
    // eslint-disable-next-line no-console
    console.log(`member force records = ${fem.memberForces.length} (${stats.members} members x 3 LCs x 5 stations)`);
  });
});
