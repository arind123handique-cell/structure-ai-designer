import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../features/projects/projectStorage', () => ({
  ProjectStorage: {
    saveProject: vi.fn().mockResolvedValue(true),
    getProject: vi.fn().mockResolvedValue(null),
    getAllProjects: vi.fn().mockResolvedValue([]),
    loadProjects: vi.fn().mockResolvedValue([]),
    deleteProject: vi.fn().mockResolvedValue(true),
    setCloudUser: vi.fn(),
    syncToCloud: vi.fn().mockResolvedValue(0),
    syncFromCloud: vi.fn().mockResolvedValue(0),
    serializeModel: (model: any) => ({
      nodes: Array.from(model.nodes.entries()),
      members: Array.from(model.members.entries()),
      plates: Array.from(model.plates.entries()),
      supports: Array.from(model.supports.entries()),
      loadCases: Array.from(model.loadCases.entries()),
      loadCombinations: Array.from(model.loadCombinations.entries()),
      memberLoads: model.memberLoads ? Array.from(model.memberLoads.entries()) : undefined,
      shellLoads: model.shellLoads,
      memberModifiers: model.memberModifiers ? Array.from(model.memberModifiers.entries()) : undefined,
      reactions: model.reactions,
      memberForces: model.memberForces,
      designSummaries: model.designSummaries ? Array.from(model.designSummaries.entries()) : undefined,
      storyDrifts: model.storyDrifts,
      boundingBox: model.boundingBox,
      statistics: model.statistics,
    }),
    deserializeModel: (s: any) => ({
      nodes: new Map(s.nodes),
      members: new Map(s.members),
      plates: new Map(s.plates),
      supports: new Map(s.supports),
      loadCases: new Map(s.loadCases),
      loadCombinations: new Map(s.loadCombinations),
      memberLoads: s.memberLoads ? new Map(s.memberLoads) : new Map(),
      shellLoads: s.shellLoads || [],
      memberModifiers: s.memberModifiers ? new Map(s.memberModifiers) : new Map(),
      reactions: s.reactions,
      memberForces: s.memberForces,
      designSummaries: s.designSummaries ? new Map(s.designSummaries) : new Map(),
      storyDrifts: s.storyDrifts,
      boundingBox: s.boundingBox,
      statistics: s.statistics,
    }),
  },
}));

import { useProjectStore } from '../features/projects/projectStore';
import { SeismicEngine } from '../features/calculations/seismicEngine';
import { TributaryLoadEngine } from '../features/calculations/tributaryLoadEngine';

describe('Advanced ETABS Modules Test Suite', () => {
  beforeEach(async () => {
    // Generate standard 3x2 bay 3-storey space frame building model
    await useProjectStore.getState().generateBuildingGrid(3, 2, 4.5, 4.0, 3, 3.2);
  });

  it('should compute IS 1893:2016 Equivalent Static Seismic Base Shear and Storey Forces', () => {
    const model = useProjectStore.getState().activeModel;
    expect(model).toBeDefined();

    const summary = SeismicEngine.computeEquivalentStaticSeismic(model, {
      seismicZone: 'IV',
      soilType: 'II_MEDIUM',
      importanceFactorI: 1.2,
      responseReductionFactorR: 5.0,
      hasBrickInfill: true,
    });

    expect(summary.buildingHeightH).toBeCloseTo(9.6, 0.5);
    expect(summary.periodTx).toBeGreaterThan(0.1);
    expect(summary.periodTx).toBeLessThan(1.5);
    expect(summary.saByG_X).toBeGreaterThanOrEqual(1.0);
    expect(summary.ahX).toBeGreaterThan(0.01);
    expect(summary.totalSeismicWeightW).toBeGreaterThan(1000);
    expect(summary.baseShearVbx).toBeGreaterThan(50);
    expect(summary.storeys.length).toBe(3);

    // Verify vertical force distribution Qi increases with height hi
    const qBottom = summary.storeys[0].lateralForceQxKn;
    const qTop = summary.storeys[2].lateralForceQxKn;
    expect(qTop).toBeGreaterThan(qBottom);

    // Total distributed storey forces sum to base shear Vb
    const sumQi = summary.storeys.reduce((sum, s) => sum + s.lateralForceQxKn, 0);
    expect(sumQi).toBeCloseTo(summary.baseShearVbx, 0.1);
  });

  it('should compute Center of Mass (CM), Center of Rigidity (CR), and Design Eccentricity', () => {
    const model = useProjectStore.getState().activeModel;
    const summary = SeismicEngine.computeEquivalentStaticSeismic(model);

    const firstStorey = summary.storeys[0];
    expect(firstStorey).toBeDefined();
    expect(firstStorey.centerOfMass.x).toBeGreaterThan(0);
    expect(firstStorey.centerOfMass.z).toBeGreaterThan(0);
    expect(firstStorey.centerOfRigidity.x).toBeGreaterThan(0);
    expect(firstStorey.centerOfRigidity.z).toBeGreaterThan(0);

    // Design eccentricity edi >= 0.05 * bi
    expect(firstStorey.designEccentricity.edx).toBeGreaterThanOrEqual(0.05 * summary.buildingDimensionDx);
    expect(firstStorey.torsionalStatus).toBe('PASS');
  });

  it('should compute 45-degree yield-line tributary slab loads to framing beams', () => {
    const model = useProjectStore.getState().activeModel;
    const result = TributaryLoadEngine.computeTributaryLoads(model, 3.2, 1.5, 3.0);

    expect(result.totalBays).toBeGreaterThan(0);
    expect(result.totalFloorAreaM2).toBeGreaterThan(50);
    expect(result.totalFloorLoadKn).toBeGreaterThan(100);
    expect(result.assignedLoads.length).toBeGreaterThan(0);

    // Verify beams receive positive UDLs
    const firstLoad = result.assignedLoads[0];
    expect(firstLoad.w1).toBeGreaterThan(0);
    expect(firstLoad.type).toBe('UNIFORM');
  });

  it('should add a structural slab / shear-wall plate via addStructuralPlate', async () => {
    const store = useProjectStore.getState();
    const model = store.activeModel!;
    const levelNodes = Array.from(model.nodes.values()).filter((n) => Math.abs(n.y - 3.2) < 0.1);

    // Pick 4 nodes forming a square bay at the first floor
    const origin = levelNodes.find((n) => Math.abs(n.x) < 0.1 && Math.abs(n.z) < 0.1);
    expect(origin).toBeDefined();
    const cornerNodes = levelNodes.filter(
      (n) => Math.abs(n.x - origin!.x) <= 4.6 && Math.abs(n.z - origin!.z) <= 4.1
    ).slice(0, 4);

    const plateId = await store.addStructuralPlate(cornerNodes.map((n) => n.id), 'SLAB', 0.125, 'M25');
    expect(plateId).toBeGreaterThan(0);

    const updated = useProjectStore.getState().activeModel!;
    const plate = updated.plates.get(plateId);
    expect(plate).toBeDefined();
    expect(plate!.classification).toBe('SLAB');
    expect(plate!.thickness).toBe(0.125);
    expect(plate!.nodeIds.length).toBeGreaterThanOrEqual(3);

    // Wall plate with 230mm thickness
    const wallId = await useProjectStore.getState().addStructuralPlate([cornerNodes[0].id, cornerNodes[1].id, cornerNodes[2].id], 'WALL', 0.23);
    const wall = useProjectStore.getState().activeModel!.plates.get(wallId);
    expect(wall!.thickness).toBe(0.23);
  });

  it('should run automated design checks and store design summaries', async () => {
    const store = useProjectStore.getState();
    // Ensure analysis results exist before designing
    await store.runFemAnalysis();

    const checked = await store.runAllDesignChecks();
    expect(checked).toBeGreaterThan(0);

    const updated = useProjectStore.getState().activeModel!;
    expect(updated.designSummaries).toBeDefined();
    expect(updated.designSummaries!.size).toBe(checked);

    const summaries = Array.from(updated.designSummaries!.values());
    for (const s of summaries) {
      expect(s.maxAxial).toBeGreaterThanOrEqual(0);
      expect(s.sectionDimensions).toMatch(/mm/);
    }
  });

  it('should run full seismic analysis wiring applied through the store', async () => {
    const store = useProjectStore.getState();
    const summary = await store.runSeismicAnalysis({
      seismicZone: 'IV',
      soilType: 'II_MEDIUM',
      importanceFactorI: 1.2,
      responseReductionFactorR: 5.0,
    });

    expect(summary).not.toBeNull();
    expect(summary.baseShearVbx).toBeGreaterThan(50);
    // Seismic loads should now appear in the model's load cases
    const lcs = useProjectStore.getState().activeModel!.loadCases;
    const hasEqx = Array.from(lcs.values()).some((lc) => lc.title.includes('EQX'));
    expect(hasEqx).toBe(true);
  });
});
