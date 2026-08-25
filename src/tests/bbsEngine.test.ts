import { describe, it, expect } from 'vitest';
import { BbsEngine } from '@/features/calculations/bbsEngine';
import { NormalizedStructuralModel, Member3D, Support3D } from '@/features/model/types';

describe('BbsEngine', () => {
  it('should generate complete BBS for building elements with standard diameter matrix', () => {
    const mockMembers = new Map<number, Member3D>();
    mockMembers.set(1, {
      id: 1,
      startNodeId: 3,
      endNodeId: 4,
      length: 5.0,
      classification: 'BEAM',
      isAutoClassified: true,
      materialName: 'CONCRETE',
      designStatus: 'PASS',
      section: { type: 'RECTANGULAR', name: '300x450', zd: 0.3, yd: 0.45 },
    });
    mockMembers.set(2, {
      id: 2,
      startNodeId: 1,
      endNodeId: 3,
      length: 3.5,
      classification: 'COLUMN',
      isAutoClassified: true,
      materialName: 'CONCRETE',
      designStatus: 'PASS',
      section: { type: 'RECTANGULAR', name: '450x550', zd: 0.45, yd: 0.55 },
    });

    const mockSupports = new Map<number, Support3D>();
    mockSupports.set(1, {
      nodeId: 1,
      type: 'FIXED',
      releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
    });

    const mockModel: NormalizedStructuralModel = {
      nodes: new Map([
        [1, { id: 1, x: 0, y: 0, z: 0 }],
        [2, { id: 2, x: 5, y: 0, z: 0 }],
        [3, { id: 3, x: 0, y: 3.5, z: 0 }],
        [4, { id: 4, x: 5, y: 3.5, z: 0 }],
      ]),
      members: mockMembers,
      plates: new Map(),
      supports: mockSupports,
      loadCases: new Map(),
      loadCombinations: new Map(),
      reactions: [],
      memberForces: [],
      storyDrifts: [],
      boundingBox: { minX: 0, maxX: 5, minY: 0, maxY: 3.5, minZ: 0, maxZ: 0 },
      statistics: {
        totalNodes: 4,
        totalMembers: 2,
        totalBeams: 1,
        totalColumns: 1,
        totalPlates: 0,
        totalSupports: 1,
        totalLoadCases: 0,
        totalCombinations: 0,
        maxElevation: 3.5,
        baseElevation: 0,
      },
    };

    const mockProject = {
      metadata: {
        id: 'proj-1',
        name: 'Test Commercial Tower',
        code: 'TOWER-01',
        engineer: 'Er. Sharma',
        location: 'Mumbai',
        designSettings: {
          concreteGrade: 'M25',
          steelGrade: 'Fe500D',
          seismicZone: 'III',
          soilType: 'Medium',
          clearCoverBeam: 30,
          clearCoverColumn: 40,
          clearCoverFooting: 60,
        },
      },
      warnings: [],
    } as any;

    const bbs = BbsEngine.generateBuildingBbs(mockModel, mockProject);

    expect(bbs.projectName).toBe('Test Commercial Tower');
    expect(bbs.items.length).toBeGreaterThan(0);

    // Verify beams, columns, and pile caps are present
    const hasBeams = bbs.items.some((i) => i.elementCategory === 'BEAM');
    const hasColumns = bbs.items.some((i) => i.elementCategory === 'COLUMN');
    const hasPileCaps = bbs.items.some((i) => i.elementCategory === 'PILE_CAP');

    expect(hasBeams).toBe(true);
    expect(hasColumns).toBe(true);
    expect(hasPileCaps).toBe(true);

    // Verify cutting lengths and bend deductions
    bbs.items.forEach((item) => {
      expect(item.cuttingLengthM).toBeGreaterThan(0);
      expect(item.totalCount).toBeGreaterThan(0);
      expect(item.totalLengthM).toBeGreaterThan(0);
      expect(BbsEngine.STANDARD_DIAMETERS).toContain(item.diameter);
    });

    // Verify grand totals
    expect(bbs.grandTotalLengthM).toBeGreaterThan(0);
    expect(bbs.grandTotalWeightKg).toBeGreaterThan(0);
    expect(bbs.grandTotalWeightMT).toBeGreaterThan(0);

    // Verify diameter summaries unit weights
    const dia8 = bbs.diameterSummaries.find((d) => d.diameter === 8);
    expect(dia8?.unitWeightKgM).toBeCloseTo((8 * 8) / 162.2, 2);

    const dia16 = bbs.diameterSummaries.find((d) => d.diameter === 16);
    expect(dia16?.unitWeightKgM).toBeCloseTo((16 * 16) / 162.2, 2);

    const dia20 = bbs.diameterSummaries.find((d) => d.diameter === 20);
    expect(dia20?.unitWeightKgM).toBeCloseTo((20 * 20) / 162.2, 2);
  });
});
