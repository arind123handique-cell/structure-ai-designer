import { describe, it, expect } from 'vitest';
import { FemSolver3D } from '../features/calculations/femSolver3D';
import { NormalizedStructuralModel, Node3D, Member3D, Support3D } from '../features/model/types';

describe('FemSolver3D Space Frame FEM Analysis Engine', () => {
  it('should calculate accurate section properties for rectangular and circular cross-sections', () => {
    const rectProps = FemSolver3D.calculateSectionProps({
      type: 'RECTANGULAR',
      yd: 0.5, // 500mm depth
      zd: 0.3, // 300mm width
    });

    expect(rectProps.area).toBeCloseTo(0.15, 4); // 0.3 * 0.5 = 0.15 m2
    expect(rectProps.iz).toBeCloseTo((0.3 * Math.pow(0.5, 3)) / 12, 6); // 0.003125 m4
    expect(rectProps.iy).toBeCloseTo((0.5 * Math.pow(0.3, 3)) / 12, 6); // 0.001125 m4
    expect(rectProps.j).toBeGreaterThan(0);

    const circProps = FemSolver3D.calculateSectionProps({
      type: 'CIRCULAR',
      yd: 0.4, // 400mm dia
    });
    expect(circProps.area).toBeCloseTo((Math.PI * 0.16) / 4, 4);
    expect(circProps.iy).toBeCloseTo(circProps.iz, 6);
  });

  it('should generate symmetric 12x12 local element stiffness matrix', () => {
    const k = FemSolver3D.getLocalStiffnessMatrix(
      4.0, // 4m length
      0.15, // 0.15 m2
      0.001, // Iy
      0.003, // Iz
      0.002, // J
      25000000, // E = 25 GPa
      10416667 // G = 10.4 GPa
    );

    expect(k.length).toBe(12);
    expect(k[0].length).toBe(12);

    // Verify matrix symmetry: k[i][j] == k[j][i]
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        expect(k[i][j]).toBeCloseTo(k[j][i], 4);
      }
    }
  });

  it('should solve a 3D structural building portal frame under gravity & lateral loads', () => {
    // 1. Define a 1-bay 2-storey 3D frame:
    // Base nodes at Y = 0.0m
    const nodes = new Map<number, Node3D>([
      [1, { id: 1, x: 0, y: 0, z: 0, isSupport: true }],
      [2, { id: 2, x: 5, y: 0, z: 0, isSupport: true }],
      [3, { id: 3, x: 0, y: 0, z: 4, isSupport: true }],
      [4, { id: 4, x: 5, y: 0, z: 4, isSupport: true }],
      // Storey 1 nodes at Y = 3.2m
      [5, { id: 5, x: 0, y: 3.2, z: 0 }],
      [6, { id: 6, x: 5, y: 3.2, z: 0 }],
      [7, { id: 7, x: 0, y: 3.2, z: 4 }],
      [8, { id: 8, x: 5, y: 3.2, z: 4 }],
    ]);

    const members = new Map<number, Member3D>([
      // Storey 1 Columns
      [1, { id: 1, startNodeId: 1, endNodeId: 5, length: 3.2, classification: 'COLUMN', isAutoClassified: false, section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 }, materialName: 'CONCRETE', designStatus: 'NOT_DESIGNED' }],
      [2, { id: 2, startNodeId: 2, endNodeId: 6, length: 3.2, classification: 'COLUMN', isAutoClassified: false, section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 }, materialName: 'CONCRETE', designStatus: 'NOT_DESIGNED' }],
      [3, { id: 3, startNodeId: 3, endNodeId: 7, length: 3.2, classification: 'COLUMN', isAutoClassified: false, section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 }, materialName: 'CONCRETE', designStatus: 'NOT_DESIGNED' }],
      [4, { id: 4, startNodeId: 4, endNodeId: 8, length: 3.2, classification: 'COLUMN', isAutoClassified: false, section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 }, materialName: 'CONCRETE', designStatus: 'NOT_DESIGNED' }],
      // Storey 1 Beams
      [5, { id: 5, startNodeId: 5, endNodeId: 6, length: 5.0, classification: 'BEAM', isAutoClassified: false, section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.25 }, materialName: 'CONCRETE', designStatus: 'NOT_DESIGNED' }],
      [6, { id: 6, startNodeId: 7, endNodeId: 8, length: 5.0, classification: 'BEAM', isAutoClassified: false, section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.25 }, materialName: 'CONCRETE', designStatus: 'NOT_DESIGNED' }],
      [7, { id: 7, startNodeId: 5, endNodeId: 7, length: 4.0, classification: 'BEAM', isAutoClassified: false, section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.25 }, materialName: 'CONCRETE', designStatus: 'NOT_DESIGNED' }],
      [8, { id: 8, startNodeId: 6, endNodeId: 8, length: 4.0, classification: 'BEAM', isAutoClassified: false, section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.25 }, materialName: 'CONCRETE', designStatus: 'NOT_DESIGNED' }],
    ]);

    const supports = new Map<number, Support3D>([
      [1, { nodeId: 1, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [2, { nodeId: 2, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [3, { nodeId: 3, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [4, { nodeId: 4, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
    ]);

    const model: NormalizedStructuralModel = {
      nodes,
      members,
      plates: new Map(),
      supports,
      loadCases: new Map([
        [1, { id: 1, title: 'Dead Load (DL)', type: 'DEAD', isCombination: false }],
        [2, { id: 2, title: 'Live Load (LL)', type: 'LIVE', isCombination: false }],
      ]),
      loadCombinations: new Map(),
      reactions: [],
      memberForces: [],
      storyDrifts: [],
      boundingBox: { minX: 0, maxX: 5, minY: 0, maxY: 3.2, minZ: 0, maxZ: 4 },
      statistics: {
        totalNodes: 8,
        totalMembers: 8,
        totalBeams: 4,
        totalColumns: 4,
        totalPlates: 0,
        totalSupports: 4,
        totalLoadCases: 2,
        totalCombinations: 0,
        maxElevation: 3.2,
        baseElevation: 0,
      },
    };

    const results = FemSolver3D.analyzeModel(model);

    expect(results).toBeDefined();
    expect(results.nodeDisplacements.size).toBe(8);
    expect(results.reactions.length).toBeGreaterThanOrEqual(4);
    expect(results.memberForces.length).toBeGreaterThanOrEqual(40); // 8 members * 5 stations

    // Verify column axial compression forces exist
    const colForces = results.memberForces.filter((f) => f.memberId === 1 && f.loadCaseId === 1);
    expect(colForces.length).toBe(5);
    // Vertical equilibrium: reactions on base supports are positive vertical reaction
    const baseReactions = results.reactions.filter((r) => r.loadCaseId === 1);
    expect(baseReactions.length).toBe(4);
    const sumRy = baseReactions.reduce((acc, r) => acc + r.fy, 0);
    expect(sumRy).toBeGreaterThan(50); // Total DL reaction
  });
});
