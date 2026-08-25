import { describe, it, expect } from 'vitest';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';
import { NormalizedStructuralModel, Node3D, Member3D, Support3D } from '@/features/model/types';

describe('2D Floor Framing & Foundation Plan Engine', () => {
  const createSampleModel = (): NormalizedStructuralModel => {
    const nodes = new Map<number, Node3D>();
    const members = new Map<number, Member3D>();
    const supports = new Map<number, Support3D>();

    // 4 Columns: Base (Y=0), Floor 1 (Y=3.5), Floor 2 (Y=7.0)
    // C1: (0, 0), C2: (5, 0), C3: (0, 6), C4: (5, 6)
    const baseCoords = [
      { id: 1, x: 0, z: 0 },
      { id: 2, x: 5, z: 0 },
      { id: 3, x: 0, z: 6 },
      { id: 4, x: 5, z: 6 },
    ];

    // Add Foundation Nodes (Y=0)
    baseCoords.forEach((b) => {
      nodes.set(b.id, { id: b.id, x: b.x, y: 0, z: b.z, isSupport: true });
      supports.set(b.id, {
        nodeId: b.id,
        type: 'FIXED',
        releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
      });
    });

    // Add Floor 1 Nodes (Y=3.5)
    baseCoords.forEach((b) => {
      const f1Id = b.id + 10;
      nodes.set(f1Id, { id: f1Id, x: b.x, y: 3.5, z: b.z });
    });

    // Add Floor 2 / Roof Nodes (Y=7.0)
    baseCoords.forEach((b) => {
      const f2Id = b.id + 20;
      nodes.set(f2Id, { id: f2Id, x: b.x, y: 7.0, z: b.z });
    });

    // Ground Columns (1->11, 2->12, 3->13, 4->14)
    baseCoords.forEach((b, idx) => {
      const colId = 100 + idx + 1;
      members.set(colId, {
        id: colId,
        startNodeId: b.id,
        endNodeId: b.id + 10,
        length: 3.5,
        classification: 'COLUMN',
        isAutoClassified: false,
        section: { type: 'RECTANGULAR', yd: 0.55, zd: 0.45 },
        materialName: 'CONCRETE',
        designStatus: 'PASS',
      });
    });

    // Story 1 Columns (11->21, 12->22, 13->23, 14->24)
    baseCoords.forEach((b, idx) => {
      const colId = 200 + idx + 1;
      members.set(colId, {
        id: colId,
        startNodeId: b.id + 10,
        endNodeId: b.id + 20,
        length: 3.5,
        classification: 'COLUMN',
        isAutoClassified: false,
        section: { type: 'RECTANGULAR', yd: 0.55, zd: 0.45 },
        materialName: 'CONCRETE',
        designStatus: 'PASS',
      });
    });

    // Floor 1 Beams (11-12, 12-14, 14-13, 13-11)
    const f1Beams = [
      { id: 301, n1: 11, n2: 12, len: 5.0 },
      { id: 302, n1: 12, n2: 14, len: 6.0 },
      { id: 303, n1: 14, n2: 13, len: 5.0 },
      { id: 304, n1: 13, n2: 11, len: 6.0 },
    ];
    f1Beams.forEach((b) => {
      members.set(b.id, {
        id: b.id,
        startNodeId: b.n1,
        endNodeId: b.n2,
        length: b.len,
        classification: 'BEAM',
        isAutoClassified: false,
        section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
        materialName: 'CONCRETE',
        designStatus: 'PASS',
      });
    });

    // Floor 2 Beams (21-22, 22-24, 24-23, 23-21)
    const f2Beams = [
      { id: 401, n1: 21, n2: 22, len: 5.0 },
      { id: 402, n1: 22, n2: 24, len: 6.0 },
      { id: 403, n1: 24, n2: 23, len: 5.0 },
      { id: 404, n1: 23, n2: 21, len: 6.0 },
    ];
    f2Beams.forEach((b) => {
      members.set(b.id, {
        id: b.id,
        startNodeId: b.n1,
        endNodeId: b.n2,
        length: b.len,
        classification: 'BEAM',
        isAutoClassified: false,
        section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
        materialName: 'CONCRETE',
        designStatus: 'PASS',
      });
    });

    return {
      nodes,
      members,
      plates: new Map(),
      supports,
      loadCases: new Map(),
      loadCombinations: new Map(),
      reactions: [
        { nodeId: 1, loadCaseId: 1, fx: 0, fy: 1600, fz: 0, mx: 0, my: 0, mz: 0 },
        { nodeId: 2, loadCaseId: 1, fx: 0, fy: 1400, fz: 0, mx: 0, my: 0, mz: 0 },
        { nodeId: 3, loadCaseId: 1, fx: 0, fy: 2200, fz: 0, mx: 0, my: 0, mz: 0 },
        { nodeId: 4, loadCaseId: 1, fx: 0, fy: 2600, fz: 0, mx: 0, my: 0, mz: 0 },
      ],
      memberForces: [],
      storyDrifts: [],
      boundingBox: { minX: 0, maxX: 5, minY: 0, maxY: 7, minZ: 0, maxZ: 6 },
      statistics: {
        totalNodes: 12,
        totalMembers: 16,
        totalBeams: 8,
        totalColumns: 8,
        totalPlates: 0,
        totalSupports: 4,
        totalLoadCases: 1,
        totalCombinations: 0,
        maxElevation: 7.0,
        baseElevation: 0.0,
      },
    };
  };

  it('should extract floor plans for each elevation level from foundation to roof', () => {
    const model = createSampleModel();
    const plans = FloorPlanEngine.extractAllFloorPlans(model);

    expect(plans.length).toBe(3); // Level 0 (Foundation), Level 3.5 (1st Floor), Level 7.0 (Roof)

    // Check Level 0: Foundation
    const foundationPlan = plans[0];
    expect(foundationPlan.isFoundationLevel).toBe(true);
    expect(foundationPlan.sheetNumber).toBe('STR-100');
    expect(foundationPlan.elevationY).toBe(0);
    expect(foundationPlan.columns.length).toBe(4);
    expect(foundationPlan.columns[0].pileCap).toBeDefined();

    // Check Level 1: 1st Floor Framing Plan
    const floor1Plan = plans[1];
    expect(floor1Plan.isFoundationLevel).toBe(false);
    expect(floor1Plan.sheetNumber).toBe('STR-101');
    expect(floor1Plan.elevationY).toBe(3.5);
    expect(floor1Plan.beams.length).toBe(4);
    expect(floor1Plan.columns.length).toBe(4);

    // Check Level 2: Roof & Terrace Framing Plan
    const roofPlan = plans[2];
    expect(roofPlan.isFoundationLevel).toBe(false);
    expect(roofPlan.sheetNumber).toBe('STR-102');
    expect(roofPlan.elevationY).toBe(7.0);
    expect(roofPlan.beams.length).toBe(4);
    expect(roofPlan.columns.length).toBe(4);
  });

  it('should compute grid lines, bay dimensions, and takeoff metrics accurately', () => {
    const model = createSampleModel();
    const plans = FloorPlanEngine.extractAllFloorPlans(model);

    const f1 = plans[1];
    expect(f1.gridLinesX.length).toBe(2); // X: 0, 5
    expect(f1.gridLinesZ.length).toBe(2); // Z: 0, 6
    expect(f1.gridLinesX[0].id).toBe('1');
    expect(f1.gridLinesX[1].id).toBe('2');
    expect(f1.gridLinesZ[0].id).toBe('A');
    expect(f1.gridLinesZ[1].id).toBe('B');

    expect(f1.metrics.totalBeams).toBe(4);
    expect(f1.metrics.totalColumns).toBe(4);
    expect(f1.metrics.totalConcreteM3).toBeGreaterThan(0);
    expect(f1.metrics.totalSteelKg).toBeGreaterThan(0);
  });
});
