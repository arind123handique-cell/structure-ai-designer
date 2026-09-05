import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../features/projects/projectStorage', () => ({
  ProjectStorage: {
    saveProject: vi.fn().mockResolvedValue(true),
    getProject: vi.fn().mockResolvedValue(null),
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

describe('ETABS Standalone Modeling and Analysis Store Tests', () => {
  beforeEach(() => {
    useProjectStore.setState({
      activeModel: null,
      activeProject: null,
    });
  });

  it('should generate a multi-storey building frame from building grid wizard in 1 click and auto-solve FEM analysis', async () => {
    const store = useProjectStore.getState();

    // Generate 3x2 bay, 3-storey building frame:
    await store.generateBuildingGrid(3, 2, 4.5, 4.0, 3, 3.2);

    const activeModel = useProjectStore.getState().activeModel;
    expect(activeModel).toBeDefined();

    // Nodes = (3+1) * (2+1) * (3+1) = 4 * 3 * 4 = 48 nodes
    expect(activeModel?.nodes.size).toBe(48);

    // Columns = 4 * 3 * 3 = 36 columns
    expect(activeModel?.statistics.totalColumns).toBe(36);

    // Beams = 3 storeys * (3 * 3 + 4 * 2) = 3 * (9 + 8) = 51 beams
    expect(activeModel?.statistics.totalBeams).toBe(51);

    // Total Members = 36 + 51 = 87
    expect(activeModel?.members.size).toBe(87);

    // Fixed base supports at ground level = 4 * 3 = 12 supports
    expect(activeModel?.supports.size).toBe(12);

    // Verify auto-solved FEM analysis results exist
    expect(activeModel?.reactions.length).toBeGreaterThanOrEqual(12);
    expect(activeModel?.memberForces.length).toBeGreaterThanOrEqual(87 * 5); // 5 stations per member
  });

  it('should allow manually adding and deleting structural nodes and members', async () => {
    const store = useProjectStore.getState();
    await store.generateBuildingGrid(2, 2, 4.0, 4.0, 1, 3.2);

    const initialNodes = useProjectStore.getState().activeModel?.nodes.size || 0;
    const initialMembers = useProjectStore.getState().activeModel?.members.size || 0;

    // Add custom node
    const n1 = await store.addStructuralNode(2.0, 3.2, 2.0);
    const n2 = await store.addStructuralNode(2.0, 3.2, 4.0);
    expect(n1).toBeGreaterThan(0);
    expect(n2).toBeGreaterThan(0);

    // Add secondary beam between n1 and n2
    const memId = await store.addStructuralMember(n1, n2, { yd: 0.4, zd: 0.25 }, 'BEAM');
    expect(memId).toBeGreaterThan(0);

    const afterAddMem = useProjectStore.getState().activeModel?.members.get(memId);
    expect(afterAddMem).toBeDefined();
    expect(afterAddMem?.classification).toBe('BEAM');
    expect(afterAddMem?.length).toBeCloseTo(2.0, 2);

    // Delete custom member
    await store.deleteStructuralElements([], [memId]);
    expect(useProjectStore.getState().activeModel?.members.has(memId)).toBe(false);
  });
});
