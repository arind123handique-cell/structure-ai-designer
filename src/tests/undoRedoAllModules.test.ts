import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandManager, ActionCommand } from '../features/commands/commandManager';

vi.mock('../features/projects/projectStorage', () => ({
  ProjectStorage: {
    saveProject: vi.fn().mockResolvedValue(true),
    getProject: vi.fn().mockResolvedValue(null),
    getAllProjects: vi.fn().mockResolvedValue([]),
    loadProjects: vi.fn().mockResolvedValue([]),
    deleteProject: vi.fn().mockResolvedValue(true),
    serializeModel: (model: any) => ({
      nodes: model?.nodes ? Array.from(model.nodes.entries()) : [],
      members: model?.members ? Array.from(model.members.entries()) : [],
      plates: model?.plates ? Array.from(model.plates.entries()) : [],
      supports: model?.supports ? Array.from(model.supports.entries()) : [],
      loadCases: model?.loadCases ? Array.from(model.loadCases.entries()) : [],
      loadCombinations: model?.loadCombinations ? Array.from(model.loadCombinations.entries()) : [],
      reactions: model?.reactions || [],
      memberForces: model?.memberForces || [],
      storyDrifts: model?.storyDrifts || [],
      boundingBox: model?.boundingBox || { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10 },
      statistics: model?.statistics || { totalNodes: 0, totalMembers: 0, totalBeams: 0, totalColumns: 0, totalPlates: 0, totalSupports: 0, totalLoadCases: 0 },
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
      storyDrifts: s.storyDrifts,
      boundingBox: s.boundingBox,
      statistics: s.statistics,
    }),
  },
}));

import { useProjectStore } from '../features/projects/projectStore';
import { ArchitecturalWall, ArchitecturalStaircase, ArchitecturalDoor } from '../features/architectural/types/architecturalTypes';
import { NormalizedStructuralModel } from '../features/model/types';

describe('Universal Undo / Redo Subsystem Across All Modules', () => {
  beforeEach(() => {
    CommandManager.resetInstance();
    const cmdMgr = CommandManager.getInstance();
    cmdMgr.clear();

    const emptyModel: NormalizedStructuralModel = {
      nodes: new Map(),
      members: new Map(),
      plates: new Map(),
      supports: new Map(),
      loadCases: new Map(),
      loadCombinations: new Map(),
      reactions: [],
      memberForces: [],
      storyDrifts: [],
      boundingBox: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10 },
      statistics: {
        totalNodes: 0,
        totalMembers: 0,
        totalBeams: 0,
        totalColumns: 0,
        totalPlates: 0,
        totalSupports: 0,
        totalLoadCases: 0,
        totalCombinations: 0,
        maxElevation: 10,
        baseElevation: 0,
      },
    };

    useProjectStore.setState({
      activeProject: {
        metadata: {
          id: 'test_proj_undo',
          name: 'Test Project Undo Redo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          designSettings: {
            code: 'IS456_2000',
            concreteGrade: 'M25',
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
            importanceFactor: 1.2,
            soilType: 'II_MEDIUM',
            windSpeed: 39,
            windTerrainCategory: 2,
          },
        } as any,
        model: {} as any,
      } as any,
      activeModel: emptyModel,
      manualMergedPileCapGroups: [],
      detachedCombinedCapNodeIds: [],
      customPileCapOverrides: {},
      architecturalWalls: {},
      architecturalDoors: {},
      architecturalStaircases: {},
    });
  });

  it('Module 1: ActionCommand integration with CommandManager', async () => {
    const cmdMgr = CommandManager.getInstance();
    let stateVal = 10;

    const cmd = new ActionCommand(
      'Increment stateVal',
      () => { stateVal -= 5; },
      () => { stateVal += 5; }
    );

    cmdMgr.record(cmd);
    expect(cmdMgr.canUndo()).toBe(true);
    expect(cmdMgr.getUndoHistoryDescriptions()).toContain('Increment stateVal');

    // Undo
    await cmdMgr.undo();
    expect(stateVal).toBe(5);
    expect(cmdMgr.canUndo()).toBe(false);
    expect(cmdMgr.canRedo()).toBe(true);

    // Redo
    await cmdMgr.redo();
    expect(stateVal).toBe(10);
    expect(cmdMgr.canUndo()).toBe(true);
    expect(cmdMgr.canRedo()).toBe(false);
  });

  it('Module 2: Architectural Module Undo / Redo (Walls & Staircases)', async () => {
    const store = useProjectStore.getState();
    const cmdMgr = CommandManager.getInstance();

    const wall: ArchitecturalWall = {
      id: 'wall_test_1',
      start: { x: 0, y: 0 },
      end: { x: 5, y: 0 },
      thickness: 0.23,
      height: 3.2,
      baseElevation: 0,
      topElevation: 3.2,
      wallType: 'EXTERNAL',
      floorId: 'floor_0',
    };

    await store.addWall(wall);
    expect(useProjectStore.getState().architecturalWalls['wall_test_1']).toBeDefined();
    expect(cmdMgr.canUndo()).toBe(true);

    // Undo adding wall
    await cmdMgr.undo();
    expect(useProjectStore.getState().architecturalWalls['wall_test_1']).toBeUndefined();

    // Redo adding wall
    await cmdMgr.redo();
    expect(useProjectStore.getState().architecturalWalls['wall_test_1']).toBeDefined();

    // Add Door
    const door = {
      id: 'door_test_1',
      floorId: 'floor_0',
      hostWallId: 'wall_test_1',
      position: 2.0,
      width: 0.9,
      height: 2.1,
      sillHeight: 0,
      doorType: 'SINGLE_SWING' as const,
      swingDirection: 'RIGHT' as const,
    };

    await store.addDoor(door);
    expect(useProjectStore.getState().architecturalDoors['door_test_1']).toBeDefined();

    // Undo Door
    await cmdMgr.undo();
    expect(useProjectStore.getState().architecturalDoors['door_test_1']).toBeUndefined();

    // Redo Door
    await cmdMgr.redo();
    expect(useProjectStore.getState().architecturalDoors['door_test_1']).toBeDefined();

    // Add Staircase
    const stair = {
      id: 'stair_test_1',
      floorId: 'floor_0',
      name: 'Test Stair',
      position: { x: 2, y: 2 },
      rotation: 0,
      staircaseType: 'DOG_LEGGED' as const,
      roomLength: 4.8,
      roomWidth: 2.4,
      flightWidth: 1.1,
      wellGap: 0.2,
      landingDepth: 1.2,
      treadMm: 275,
      riserMm: 160,
      riserCount: 10,
      treadCount: 9,
      waistThicknessMm: 160,
      wallThicknessMm: 230,
      hasEnclosureWalls: true,
      hasLeftDoor: true,
      leftDoorWidth: 1.0,
      hasRightDoor: true,
      rightDoorWidth: 1.0,
      hasFrontDoor: true,
      frontDoorWidth: 1.2,
      direction: 'UP' as const,
      startElevation: 0,
      endElevation: 3.2,
    };

    await store.addStaircase(stair);
    expect(useProjectStore.getState().architecturalStaircases['stair_test_1']).toBeDefined();

    // Undo Staircase
    await cmdMgr.undo();
    expect(useProjectStore.getState().architecturalStaircases['stair_test_1']).toBeUndefined();

    // Redo Staircase
    await cmdMgr.redo();
    expect(useProjectStore.getState().architecturalStaircases['stair_test_1']).toBeDefined();
  });

  it('Module 3: Foundation Pile Caps Undo / Redo (Merging, Custom Overrides & Rotation)', async () => {
    const store = useProjectStore.getState();
    const cmdMgr = CommandManager.getInstance();

    // Merge pile caps [101, 102]
    store.mergeSelectedPileCaps([101, 102]);
    expect(useProjectStore.getState().manualMergedPileCapGroups).toEqual([[101, 102]]);
    expect(cmdMgr.canUndo()).toBe(true);

    // Undo merge
    await cmdMgr.undo();
    expect(useProjectStore.getState().manualMergedPileCapGroups).toEqual([]);

    // Redo merge
    await cmdMgr.redo();
    expect(useProjectStore.getState().manualMergedPileCapGroups).toEqual([[101, 102]]);

    // Custom pile cap override
    store.setCustomPileCapOverride(101, { customPileCount: 4, customCapDepth: 900, rotationAngle: 0 });
    expect(useProjectStore.getState().customPileCapOverrides[101]?.customPileCount).toBe(4);

    // Undo override
    await cmdMgr.undo();
    expect(useProjectStore.getState().customPileCapOverrides[101]).toBeUndefined();

    // Redo override
    await cmdMgr.redo();
    expect(useProjectStore.getState().customPileCapOverrides[101]?.customPileCount).toBe(4);

    // Rotate Pile Cap CW (0 -> 90)
    store.rotatePileCap(101, 'CW');
    expect(useProjectStore.getState().customPileCapOverrides[101]?.rotationAngle).toBe(90);

    // Undo rotation
    await cmdMgr.undo();
    expect(useProjectStore.getState().customPileCapOverrides[101]?.rotationAngle).toBe(0);

    // Redo rotation
    await cmdMgr.redo();
    expect(useProjectStore.getState().customPileCapOverrides[101]?.rotationAngle).toBe(90);
  });

  it('Module 4: 3D Structural Modeling Undo / Redo (Nodes, Members, Sections & Deletions)', async () => {
    const store = useProjectStore.getState();
    const cmdMgr = CommandManager.getInstance();

    // Add node
    const n1 = await store.addStructuralNode(0, 0, 0, true);
    const n2 = await store.addStructuralNode(0, 3.2, 0, false);
    expect(n1).toBeGreaterThan(0);
    expect(n2).toBeGreaterThan(0);
    expect(useProjectStore.getState().activeModel?.nodes.has(n2)).toBe(true);

    // Add member
    const m1 = await store.addStructuralMember(n1, n2, { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 }, 'COLUMN');
    expect(m1).toBeGreaterThan(0);
    expect(useProjectStore.getState().activeModel?.members.has(m1)).toBe(true);

    // Undo member addition
    await cmdMgr.undo();
    expect(useProjectStore.getState().activeModel?.members.has(m1)).toBe(false);

    // Redo member addition
    await cmdMgr.redo();
    expect(useProjectStore.getState().activeModel?.members.has(m1)).toBe(true);

    // Assign Member Section
    await store.assignMemberSection([m1], { type: 'RECTANGULAR', yd: 0.6, zd: 0.45 });
    expect(useProjectStore.getState().activeModel?.members.get(m1)?.section.yd).toBe(0.6);

    // Undo section assignment
    await cmdMgr.undo();
    expect(useProjectStore.getState().activeModel?.members.get(m1)?.section.yd).toBe(0.45);

    // Redo section assignment
    await cmdMgr.redo();
    expect(useProjectStore.getState().activeModel?.members.get(m1)?.section.yd).toBe(0.6);

    // Delete member
    await store.deleteStructuralElements([], [m1]);
    expect(useProjectStore.getState().activeModel?.members.has(m1)).toBe(false);

    // Undo delete
    await cmdMgr.undo();
    expect(useProjectStore.getState().activeModel?.members.has(m1)).toBe(true);

    // Redo delete
    await cmdMgr.redo();
    expect(useProjectStore.getState().activeModel?.members.has(m1)).toBe(false);
  });

  it('Module 5: Design Settings Undo / Redo', async () => {
    const store = useProjectStore.getState();
    const cmdMgr = CommandManager.getInstance();

    expect(useProjectStore.getState().activeProject?.metadata.designSettings.concreteGrade).toBe('M25');

    // Update concrete grade to M35
    await store.updateDesignSettings({ concreteGrade: 'M35' });
    expect(useProjectStore.getState().activeProject?.metadata.designSettings.concreteGrade).toBe('M35');
    expect(cmdMgr.canUndo()).toBe(true);

    // Undo design settings
    await cmdMgr.undo();
    expect(useProjectStore.getState().activeProject?.metadata.designSettings.concreteGrade).toBe('M25');

    // Redo design settings
    await cmdMgr.redo();
    expect(useProjectStore.getState().activeProject?.metadata.designSettings.concreteGrade).toBe('M35');
  });

  it('Module 6: Shell Loads, Member Modifiers & Story Management Undo / Redo', async () => {
    const store = useProjectStore.getState();
    const cmdMgr = CommandManager.getInstance();

    const n1 = await store.addStructuralNode(0, 0, 0, true);
    const n2 = await store.addStructuralNode(0, 3.2, 0, false);
    const m1 = await store.addStructuralMember(n1, n2, { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 }, 'COLUMN');

    // 1. Assign Shell Loads
    await store.assignShellLoads(3.2, {
      levelY: 3.2,
      loadPattern: 'LIVE',
      pressure: 2.5,
      distributionType: 'TWO_WAY',
    });
    expect(useProjectStore.getState().activeModel?.shellLoads?.length).toBe(1);

    // Undo Shell Load
    await cmdMgr.undo();
    expect(useProjectStore.getState().activeModel?.shellLoads?.length).toBe(0);

    // Redo Shell Load
    await cmdMgr.redo();
    expect(useProjectStore.getState().activeModel?.shellLoads?.length).toBe(1);

    // 2. Assign Member Modifiers
    await store.assignMemberModifiers([m1], { momentIyy: 0.7, momentIzz: 0.7 });
    expect(useProjectStore.getState().activeModel?.memberModifiers?.get(m1)?.momentIyy).toBe(0.7);

    // Undo Member Modifiers
    await cmdMgr.undo();
    expect(useProjectStore.getState().activeModel?.memberModifiers?.get(m1)).toBeUndefined();

    // Redo Member Modifiers
    await cmdMgr.redo();
    expect(useProjectStore.getState().activeModel?.memberModifiers?.get(m1)?.momentIyy).toBe(0.7);

    // 3. Add Story On Top
    const nodeCountBefore = useProjectStore.getState().activeModel!.nodes.size;
    await store.addStoryOnTop(3.0, false);
    expect(useProjectStore.getState().activeModel!.nodes.size).toBeGreaterThan(nodeCountBefore);

    // Undo Add Story On Top
    await cmdMgr.undo();
    expect(useProjectStore.getState().activeModel!.nodes.size).toBe(nodeCountBefore);

    // Redo Add Story On Top
    await cmdMgr.redo();
    expect(useProjectStore.getState().activeModel!.nodes.size).toBeGreaterThan(nodeCountBefore);

    // 4. Update Story Heights
    await store.updateStoryHeights([{ oldElev: 3.2, newElev: 4.0 }]);
    expect(useProjectStore.getState().activeModel!.nodes.get(n2)?.y).toBe(4.0);

    // Undo Update Story Heights
    await cmdMgr.undo();
    expect(useProjectStore.getState().activeModel!.nodes.get(n2)?.y).toBe(3.2);

    // Redo Update Story Heights
    await cmdMgr.redo();
    expect(useProjectStore.getState().activeModel!.nodes.get(n2)?.y).toBe(4.0);
  });
});
