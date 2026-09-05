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
import { FemSolver3D } from '../features/calculations/femSolver3D';

describe('ETABS Structural Engineering Feature Suite Tests', () => {
  beforeEach(async () => {
    // Generate a 2x2 bay 2-storey parametric building model for testing
    await useProjectStore.getState().generateBuildingGrid(2, 2, 4.0, 4.0, 2, 3.2);
  });

  it('should assign uniform distributed frame load (UDL) to beams', async () => {
    const store = useProjectStore.getState();
    const model = store.activeModel;
    expect(model).toBeDefined();

    // Find all beams
    const beams = Array.from(model!.members.values()).filter((m) => m.classification === 'BEAM');
    expect(beams.length).toBeGreaterThan(0);

    const targetBeamId = beams[0].id;

    // Assign 12.5 kN/m masonry wall load
    await store.assignFrameLoads([targetBeamId], {
      memberId: targetBeamId,
      loadPattern: 'WALL',
      type: 'UNIFORM',
      w1: 12.5,
      direction: 'GLOBAL_Y',
    });

    const updatedModel = useProjectStore.getState().activeModel;
    const assignedLoads = updatedModel?.memberLoads?.get(targetBeamId);

    expect(assignedLoads).toBeDefined();
    expect(assignedLoads!.length).toBe(1);
    expect(assignedLoads![0].w1).toBe(12.5);
    expect(assignedLoads![0].loadPattern).toBe('WALL');
  });

  it('should delete assigned frame loads', async () => {
    const store = useProjectStore.getState();
    const model = store.activeModel!;
    const beams = Array.from(model.members.values()).filter((m) => m.classification === 'BEAM');
    const targetBeamId = beams[0].id;

    await store.assignFrameLoads([targetBeamId], {
      memberId: targetBeamId,
      loadPattern: 'WALL',
      type: 'UNIFORM',
      w1: 12.5,
      direction: 'GLOBAL_Y',
    });

    expect(useProjectStore.getState().activeModel?.memberLoads?.get(targetBeamId)?.length).toBe(1);

    await store.deleteMemberLoads([targetBeamId]);
    expect(useProjectStore.getState().activeModel?.memberLoads?.get(targetBeamId)).toBeUndefined();
  });

  it('should assign frame cross-sections to columns and beams', async () => {
    const store = useProjectStore.getState();
    const model = store.activeModel!;
    const columns = Array.from(model.members.values()).filter((m) => m.classification === 'COLUMN');
    expect(columns.length).toBeGreaterThan(0);

    const colId = columns[0].id;

    // Assign C450x600 cross-section
    await store.assignMemberSection([colId], {
      name: 'C450x600',
      yd: 0.60,
      zd: 0.45,
      type: 'RECTANGULAR',
    });

    const updatedCol = useProjectStore.getState().activeModel?.members.get(colId);
    expect(updatedCol?.section.name).toBe('C450x600');
    expect(updatedCol?.section.yd).toBe(0.60);
    expect(updatedCol?.section.zd).toBe(0.45);
  });

  it('should assign support boundary restraints to joints', async () => {
    const store = useProjectStore.getState();
    const model = store.activeModel!;
    const baseNode = Array.from(model.nodes.values()).find((n) => Math.abs(n.y - 0.0) < 0.1);
    expect(baseNode).toBeDefined();

    // Assign Pinned Support
    await store.assignSupportRestraint([baseNode!.id], 'PINNED');

    const updatedSupport = useProjectStore.getState().activeModel?.supports.get(baseNode!.id);
    expect(updatedSupport).toBeDefined();
    expect(updatedSupport?.type).toBe('PINNED');
    expect(updatedSupport?.releases.mx).toBe(true);
    expect(updatedSupport?.releases.fx).toBe(false);
  });

  it('should replicate story framing to higher elevations', async () => {
    const store = useProjectStore.getState();
    const initialBeamsCount = Array.from(store.activeModel!.members.values()).filter((m) => m.classification === 'BEAM').length;

    // Replicate 1st floor (3.2m) to 3rd floor (9.6m) and 4th floor (12.8m)
    await store.replicateStory(3.2, [9.6, 12.8]);

    const updatedModel = useProjectStore.getState().activeModel!;
    const newBeamsCount = Array.from(updatedModel.members.values()).filter((m) => m.classification === 'BEAM').length;

    expect(newBeamsCount).toBeGreaterThan(initialBeamsCount);
  });

  it('should solve direct stiffness FEM with custom member loads and verify equilibrium', async () => {
    const store = useProjectStore.getState();
    const model = store.activeModel!;
    const beams = Array.from(model.members.values()).filter((m) => m.classification === 'BEAM');

    // Assign wall loads to all beams
    await store.assignFrameLoads(
      beams.map((b) => b.id),
      {
        memberId: 0,
        loadPattern: 'DEAD',
        type: 'UNIFORM',
        w1: 15.0,
        direction: 'GLOBAL_Y',
      }
    );

    const updatedModel = useProjectStore.getState().activeModel!;
    const result = FemSolver3D.analyzeModel(updatedModel);

    expect(result.reactions.length).toBeGreaterThan(0);
    expect(result.totalReactionKn.y).toBeGreaterThan(0);
    expect(result.equilibriumCheck).toBe('PASS');
  });
});
