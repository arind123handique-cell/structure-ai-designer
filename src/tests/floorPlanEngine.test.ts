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
    expect(floor1Plan.beams.map((b) => b.label)).toEqual(['B1', 'B2', 'B3', 'B4']);
    expect(floor1Plan.columns.length).toBe(4);

    // Check Level 2: Roof & Terrace Framing Plan
    const roofPlan = plans[2];
    expect(roofPlan.isFoundationLevel).toBe(false);
    expect(roofPlan.sheetNumber).toBe('STR-102');
    expect(roofPlan.elevationY).toBe(7.0);
    expect(roofPlan.beams.length).toBe(4);
    expect(roofPlan.beams.map((b) => b.label)).toEqual(['B1', 'B2', 'B3', 'B4']);
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

  it('should absorb all 4 columns (Node 2, 3, 6, 927) on the shear wall combined pile cap matching 3D model', () => {
    const model = createSampleModel();
    // Add shear wall and extra nodes/columns: Node 2, 3, 6, 927 and core plate nodes 364, 365, 366, 367
    const extraNodes = [
      { id: 6, x: 5.4, z: -4.3 },
      { id: 927, x: 8.1, z: -4.3 },
      { id: 364, x: 8.1, z: -3.8 },
      { id: 365, x: 8.1, z: -2.3 },
      { id: 366, x: 9.6, z: -3.8 },
      { id: 367, x: 9.6, z: -2.3 },
    ];
    // Set coordinates for Node 2 (C21) and Node 3 (C22) matching the real structural model
    model.nodes.get(2)!.x = 5.4;
    model.nodes.get(2)!.z = 0.0;
    model.nodes.get(3)!.x = 8.1;
    model.nodes.get(3)!.z = 0.0;

    extraNodes.forEach((n) => {
      model.nodes.set(n.id, { id: n.id, x: n.x, y: 0, z: n.z, isSupport: true });
      model.supports!.set(n.id, {
        nodeId: n.id,
        type: 'FIXED',
        releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
      });
    });

    // Add column members for 6 and 927
    [6, 927].forEach((nid) => {
      const topId = nid + 1000;
      model.nodes.set(topId, { id: topId, x: model.nodes.get(nid)!.x, y: 3.5, z: model.nodes.get(nid)!.z });
      model.members.set(nid + 500, {
        id: nid + 500,
        startNodeId: nid,
        endNodeId: topId,
        length: 3.5,
        classification: 'COLUMN',
        isAutoClassified: false,
        section: { type: 'RECTANGULAR', yd: 0.55, zd: 0.45 },
        materialName: 'CONCRETE',
        designStatus: 'PASS',
      });
    });

    // Provide a combined pile cap covering the shear wall
    const dummyCombinedCap = [{
      groupId: 'SW-1',
      reason: 'SHEAR_WALL' as const,
      label: 'PC-SW-1',
      nodeIds: [364, 365, 366, 367],
      absorbedIndividualCaps: [364, 365, 366, 367],
      columnLabels: ['SW'],
      minX: 5.4,
      maxX: 9.6,
      minZ: -4.3,
      maxZ: 0.0,
      wallLengthM: 4.2,
      wallWidthM: 4.3,
      totalFactoredLoad: 3000,
      totalWorkingLoad: 2000,
      safePileCapacity: 280,
      pileDiameter: 350,
      pileSpacing: 1050,
      capLength: 5500,
      capWidth: 7000,
      capDepth: 900,
      pileCount: 20,
      pileOffsets: [],
      reinforcement: {} as any,
      status: 'PASS' as const,
    }];

    const plans = FloorPlanEngine.extractAllFloorPlans(
      model,
      undefined,
      undefined,
      undefined,
      [[2, 3, 6, 927]], // manualMergedPileCapGroups
      undefined,
      undefined,
      undefined,
      dummyCombinedCap // savedCombinedCapDesigns
    );

    const foundation = plans[0];
    expect(foundation.combinedPileCaps?.length).toBe(1);
    const grp = foundation.combinedPileCaps![0];

    // Verify that all 4 columns are absorbed
    expect(grp.absorbedIndividualCaps).toContain(2);
    expect(grp.absorbedIndividualCaps).toContain(3);
    expect(grp.absorbedIndividualCaps).toContain(6);
    expect(grp.absorbedIndividualCaps).toContain(927);

    // Verify that absorbedCombinedCapNodeIds contains all 4 columns
    expect(foundation.absorbedCombinedCapNodeIds?.has(2)).toBe(true);
    expect(foundation.absorbedCombinedCapNodeIds?.has(3)).toBe(true);
    expect(foundation.absorbedCombinedCapNodeIds?.has(6)).toBe(true);
    expect(foundation.absorbedCombinedCapNodeIds?.has(927)).toBe(true);

    // Verify column labels
    expect(grp.columnLabels).toContain('C21');
    expect(grp.columnLabels).toContain('C22');
    expect(grp.columnLabels).toContain('C14');
    expect(grp.columnLabels).toContain('C15');

    // Verify physical bounding box spans all columns and core
    expect(grp.minX).toBeCloseTo(5.4, 2);
    expect(grp.maxX).toBeCloseTo(9.6, 2);
    expect(grp.minZ).toBeCloseTo(-4.3, 2);
    expect(grp.maxZ).toBeCloseTo(0.0, 2);

    const cx = (grp.minX + grp.maxX) / 2;
    const cz = (grp.minZ + grp.maxZ) / 2;
    expect(cx).toBeCloseTo(7.5, 2);
    expect(cz).toBeCloseTo(-2.15, 2);
  });
});
