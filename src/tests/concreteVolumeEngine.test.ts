import { describe, it, expect } from 'vitest';
import { ConcreteVolumeEngine } from '@/features/calculations/concreteVolumeEngine';
import { NormalizedStructuralModel } from '@/features/model/types';

describe('ConcreteVolumeEngine', () => {
  const mockModel = {
    nodes: new Map([
      [1, { id: 1, x: 0, y: 0, z: 0 }],
      [2, { id: 2, x: 5, y: 0, z: 0 }],
      [3, { id: 3, x: 0, y: 3.5, z: 0 }],
      [4, { id: 4, x: 5, y: 3.5, z: 0 }],
    ]),
    members: new Map([
      [
        1,
        {
          id: 1,
          startNodeId: 1,
          endNodeId: 3,
          length: 3.5,
          section: { type: 'RECTANGULAR', name: '450x550 mm', zd: 0.45, yd: 0.55 },
          classification: 'COLUMN',
          materialName: 'CONCRETE',
          isAutoClassified: true,
          designStatus: 'PASS',
        },
      ],
      [
        2,
        {
          id: 2,
          startNodeId: 2,
          endNodeId: 4,
          length: 3.5,
          section: { type: 'RECTANGULAR', name: '450x550 mm', zd: 0.45, yd: 0.55 },
          classification: 'COLUMN',
          materialName: 'CONCRETE',
          isAutoClassified: true,
          designStatus: 'PASS',
        },
      ],
      [
        3,
        {
          id: 3,
          startNodeId: 3,
          endNodeId: 4,
          length: 5.0,
          section: { type: 'RECTANGULAR', name: '300x450 mm', zd: 0.30, yd: 0.45 },
          classification: 'BEAM',
          materialName: 'CONCRETE',
          isAutoClassified: true,
          designStatus: 'PASS',
        },
      ],
    ]),
    plates: new Map([
      [
        1,
        {
          id: 1,
          nodeIds: [1, 2, 4, 3],
          thickness: 0.23,
          classification: 'WALL',
          materialName: 'CONCRETE',
        },
      ],
    ]),
    supports: new Map([
      [1, { nodeId: 1, type: 'FIXED', isFixed: true, fx: true, fy: true, fz: true, mx: true, my: true, mz: true, releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [2, { nodeId: 2, type: 'FIXED', isFixed: true, fx: true, fy: true, fz: true, mx: true, my: true, mz: true, releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
    ]),
    loadCases: new Map(),
    loadCombinations: new Map(),
    memberForces: [],
    reactions: [],
    statistics: {
      totalNodes: 4,
      totalMembers: 3,
      totalBeams: 1,
      totalColumns: 2,
      totalPlates: 1,
      totalSupports: 2,
      totalLoadCases: 0,
      totalCombinations: 0,
      maxElevation: 3.5,
      baseElevation: 0,
    },
  } as unknown as NormalizedStructuralModel;

  it('calculates separate concrete volume for columns correctly', () => {
    const summary = ConcreteVolumeEngine.calculateBuildingConcreteSummary(mockModel);
    const colComp = summary.components.find((c) => c.id === 'columns');
    expect(colComp).toBeDefined();
    expect(colComp?.count).toBe(2);
    // 2 * (0.45 * 0.55 * 3.5) = 2 * 0.86625 = 1.7325 -> 1.73 m3
    expect(colComp?.concreteM3).toBeCloseTo(1.73, 2);
  });

  it('calculates separate concrete volume for beams correctly', () => {
    const summary = ConcreteVolumeEngine.calculateBuildingConcreteSummary(mockModel);
    const beamComp = summary.components.find((c) => c.id === 'beams');
    expect(beamComp).toBeDefined();
    expect(beamComp?.count).toBe(1);
    // 1 * (0.30 * 0.45 * 5.0) = 0.675 -> 0.68 m3
    expect(beamComp?.concreteM3).toBeCloseTo(0.68, 2);
  });

  it('calculates separate concrete volume for shear walls correctly', () => {
    const summary = ConcreteVolumeEngine.calculateBuildingConcreteSummary(mockModel);
    const wallComp = summary.components.find((c) => c.id === 'shearwalls');
    expect(wallComp).toBeDefined();
    expect(wallComp?.count).toBe(1);
    // L=5.0, H=3.5, tw=0.23 -> 5.0 * 0.23 * 3.5 = 4.025 -> 4.03 m3
    expect(wallComp?.concreteM3).toBeCloseTo(4.03, 2);
  });

  it('calculates substructure vs superstructure split correctly', () => {
    const summary = ConcreteVolumeEngine.calculateBuildingConcreteSummary(mockModel);
    expect(summary.grandTotalConcreteM3).toBeGreaterThan(0);
    expect(summary.superstructureConcreteM3).toBeGreaterThan(0);
    expect(summary.substructureConcreteM3).toBeGreaterThan(0);
    expect(summary.totalCementBags).toBeGreaterThan(0);
    expect(summary.totalSandM3).toBeGreaterThan(0);
    expect(summary.totalAggregateM3).toBeGreaterThan(0);
  });
});
