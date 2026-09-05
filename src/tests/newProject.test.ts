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

describe('New Project Feature Tests', () => {
  beforeEach(() => {
    useProjectStore.setState({
      activeModel: null,
      activeProject: null,
      isNewProjectModalOpen: false,
    });
  });

  it('should toggle isNewProjectModalOpen state correctly', () => {
    const store = useProjectStore.getState();
    expect(store.isNewProjectModalOpen).toBe(false);

    store.setNewProjectModalOpen(true);
    expect(useProjectStore.getState().isNewProjectModalOpen).toBe(true);

    store.setNewProjectModalOpen(false);
    expect(useProjectStore.getState().isNewProjectModalOpen).toBe(false);
  });

  it('should create a new project with custom metadata, design parameters, and empty model', async () => {
    const store = useProjectStore.getState();

    const created = await store.createProject({
      name: 'High-Rise Commercial Tower',
      code: 'PRJ-2026-HR01',
      client: 'Skyline Corp',
      engineer: 'Er. John Doe',
      location: 'Mumbai City',
      description: 'G+10 Commercial Building',
      designSettings: {
        code: 'IS456_2000',
        concreteGrade: 'M35',
        steelGrade: 'Fe500D',
        shearRebarGrade: 'Fe500D',
        clearCoverBeam: 30,
        clearCoverColumn: 40,
        clearCoverFooting: 50,
        clearCoverSlab: 20,
        clearCoverPile: 60,
        maxAggregateSize: 20,
        seismicZone: 'IV',
        responseReductionFactor: 5,
        importanceFactor: 1.5,
        soilType: 'II_MEDIUM',
        windSpeed: 44,
        windTerrainCategory: 2,
      },
    });

    expect(created).toBeDefined();
    expect(created.metadata.name).toBe('High-Rise Commercial Tower');
    expect(created.metadata.code).toBe('PRJ-2026-HR01');
    expect(created.metadata.designSettings.concreteGrade).toBe('M35');
    expect(created.metadata.designSettings.importanceFactor).toBe(1.5);

    const activeProj = useProjectStore.getState().activeProject;
    expect(activeProj?.metadata.client).toBe('Skyline Corp');
    expect(activeProj?.metadata.engineer).toBe('Er. John Doe');
  });

  it('should update project metadata correctly', async () => {
    const store = useProjectStore.getState();

    await store.createProject({
      name: 'Original Name',
      client: 'Original Client',
    });

    await store.updateProjectMetadata({
      name: 'Renamed Project Structure',
      client: 'New Client Enterprise',
    });

    const activeProj = useProjectStore.getState().activeProject;
    expect(activeProj?.metadata.name).toBe('Renamed Project Structure');
    expect(activeProj?.metadata.client).toBe('New Client Enterprise');
  });
});
