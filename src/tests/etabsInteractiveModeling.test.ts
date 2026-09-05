import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LruCache, disposeThreeObject } from '../utils/memoryManager';
import { useProjectStore } from '../features/projects/projectStore';
import { FloorPlanEngine } from '../features/drawings/floorPlanEngine';
import { NormalizedStructuralModel, Node3D, Member3D, Support3D } from '../features/model/types';
import * as THREE from 'three';

describe('ETABS Interactive Modeling & Memory Management Subsystem', () => {
  describe('Memory Optimization: LruCache and Disposal', () => {
    it('evicts least recently used items and calls dispose on eviction', () => {
      const disposedKeys: string[] = [];
      const cache = new LruCache<string, { dispose: () => void }>(3, (_val, key) => {
        disposedKeys.push(key);
      });

      const itemA = { dispose: vi.fn() };
      const itemB = { dispose: vi.fn() };
      const itemC = { dispose: vi.fn() };
      const itemD = { dispose: vi.fn() };

      cache.set('A', itemA);
      cache.set('B', itemB);
      cache.set('C', itemC);

      expect(cache.size).toBe(3);
      expect(disposedKeys.length).toBe(0);

      // Access A so B becomes the oldest
      cache.get('A');

      // Adding D should evict B
      cache.set('D', itemD);
      expect(cache.size).toBe(3);
      expect(disposedKeys).toEqual(['B']);
      expect(cache.has('B')).toBe(false);
      expect(cache.has('A')).toBe(true);
      expect(cache.has('C')).toBe(true);
      expect(cache.has('D')).toBe(true);
    });

    it('deeply disposes Three.js object hierarchy without throwing', () => {
      const parent = new THREE.Group();
      const geom = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const mesh = new THREE.Mesh(geom, mat);
      parent.add(mesh);

      const geomDisposeSpy = vi.spyOn(geom, 'dispose');
      const matDisposeSpy = vi.spyOn(mat, 'dispose');

      disposeThreeObject(parent);

      expect(geomDisposeSpy).toHaveBeenCalled();
      expect(matDisposeSpy).toHaveBeenCalled();
    });
  });

  describe('ProjectStore: Interactive Grids and Story Management', () => {
    const createBaseModel = (): NormalizedStructuralModel => ({
      nodes: new Map<number, Node3D>([
        [1, { id: 1, x: 0, y: 0, z: 0, isSupport: true }],
        [2, { id: 2, x: 0, y: 3.5, z: 0 }],
        [3, { id: 3, x: 4, y: 3.5, z: 0 }],
        [4, { id: 4, x: 4, y: 0, z: 0, isSupport: true }],
      ]),
      members: new Map<number, Member3D>([
        [
          1,
          {
            id: 1,
            startNodeId: 1,
            endNodeId: 2,
            length: 3.5,
            classification: 'COLUMN',
            isAutoClassified: false,
            section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.45, name: 'C450x450' },
            materialName: 'CONCRETE',
            designStatus: 'NOT_DESIGNED',
          },
        ],
        [
          2,
          {
            id: 2,
            startNodeId: 2,
            endNodeId: 3,
            length: 4.0,
            classification: 'BEAM',
            isAutoClassified: false,
            section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3, name: 'B300x450' },
            materialName: 'CONCRETE',
            designStatus: 'NOT_DESIGNED',
          },
        ],
        [
          3,
          {
            id: 3,
            startNodeId: 4,
            endNodeId: 3,
            length: 3.5,
            classification: 'COLUMN',
            isAutoClassified: false,
            section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.45, name: 'C450x450' },
            materialName: 'CONCRETE',
            designStatus: 'NOT_DESIGNED',
          },
        ],
      ]),
      plates: new Map(),
      supports: new Map<number, Support3D>([
        [
          1,
          {
            nodeId: 1,
            type: 'FIXED',
            releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
          },
        ],
        [
          4,
          {
            nodeId: 4,
            type: 'FIXED',
            releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
          },
        ],
      ]),
      loadCases: new Map(),
      loadCombinations: new Map(),
      reactions: [],
      memberForces: [],
      storyDrifts: [],
      boundingBox: { minX: 0, maxX: 4, minY: 0, maxY: 3.5, minZ: 0, maxZ: 0 },
      statistics: {
        totalNodes: 4,
        totalMembers: 3,
        totalBeams: 1,
        totalColumns: 2,
        totalPlates: 0,
        totalSupports: 2,
        totalLoadCases: 0,
        totalCombinations: 0,
        maxElevation: 3.5,
        baseElevation: 0,
      },
    });

    beforeEach(() => {
      useProjectStore.setState({
        activeModel: createBaseModel(),
        activeProject: null,
      });
    });

    it('updates custom grid system and updates floor plan extraction', async () => {
      const store = useProjectStore.getState();

      await store.updateGridSystem([0, 5, 10], [0, 4, 8]);

      const updatedModel = useProjectStore.getState().activeModel!;
      expect(updatedModel.customGrids).toBeDefined();
      expect(updatedModel.customGrids?.x).toEqual([0, 5, 10]);
      expect(updatedModel.customGrids?.z).toEqual([0, 4, 8]);

      // FloorPlanEngine should now extract the custom grid lines
      const plans = FloorPlanEngine.extractAllFloorPlans(updatedModel);
      expect(plans.length).toBeGreaterThan(0);
      const topPlan = plans[plans.length - 1];
      expect(topPlan.gridLinesX.map((g) => g.coord)).toEqual([0, 5, 10]);
      expect(topPlan.gridLinesZ.map((g) => g.coord)).toEqual([0, 4, 8]);
    });

    it('updates story heights, shifting node elevations and recalculating member lengths', async () => {
      const store = useProjectStore.getState();

      // Change story 1 from 3.5m to 4.2m
      await store.updateStoryHeights([{ oldElev: 3.5, newElev: 4.2 }]);

      const updatedModel = useProjectStore.getState().activeModel!;
      expect(updatedModel.nodes.get(2)!.y).toBe(4.2);
      expect(updatedModel.nodes.get(3)!.y).toBe(4.2);
      expect(updatedModel.nodes.get(1)!.y).toBe(0); // Base remains at 0

      // Columns 1 and 3 length updated to 4.2m
      expect(updatedModel.members.get(1)!.length).toBe(4.2);
      expect(updatedModel.members.get(3)!.length).toBe(4.2);

      // Beam length between nodes 2 and 3 remains 4.0m
      expect(updatedModel.members.get(2)!.length).toBe(4.0);
    });

    it('adds story on top with continuous columns and replicated framing beams', async () => {
      const store = useProjectStore.getState();

      // Add a 3.0m storey on top of the 3.5m story (replicate framing = true)
      await store.addStoryOnTop(3.0, true);

      const updatedModel = useProjectStore.getState().activeModel!;
      expect(updatedModel.statistics.totalNodes).toBe(6); // 4 + 2 new nodes at y=6.5
      expect(updatedModel.statistics.maxElevation).toBe(6.5);

      // Verify new nodes exist at y=6.5
      const nodesAtTop = Array.from(updatedModel.nodes.values()).filter((n) => Math.abs(n.y - 6.5) < 0.05);
      expect(nodesAtTop.length).toBe(2);

      // Verify continuous column members were added
      const cols = Array.from(updatedModel.members.values()).filter((m) => m.classification === 'COLUMN');
      expect(cols.length).toBe(4); // 2 original + 2 new upper columns

      // Verify framing beam was replicated at y=6.5
      const beams = Array.from(updatedModel.members.values()).filter((m) => m.classification === 'BEAM');
      expect(beams.length).toBe(2); // 1 original + 1 replicated top beam
    });

    it('deletes top story level cleanly but protects foundation level', async () => {
      const store = useProjectStore.getState();

      // Attempt to delete base level (y=0) containing supports -> should be rejected
      await store.deleteStoryLevel(0);
      let model = useProjectStore.getState().activeModel!;
      expect(model.nodes.size).toBe(4); // Nothing deleted

      // Add a floor on top first so we have 2 upper levels
      await store.addStoryOnTop(3.0, true);
      model = useProjectStore.getState().activeModel!;
      expect(model.nodes.size).toBe(6);

      // Now delete the newly added top level at y=6.5
      await store.deleteStoryLevel(6.5);
      model = useProjectStore.getState().activeModel!;
      expect(model.nodes.size).toBe(4);
      expect(model.members.size).toBe(3);
      expect(model.statistics.maxElevation).toBe(3.5);
    });
  });
});
