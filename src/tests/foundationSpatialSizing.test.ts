import { describe, it, expect } from 'vitest';
import { FoundationSpatialSizingEngine, CapFootprint2D } from '@/features/design/pilecap/foundationSpatialSizingEngine';
import { CombinedPileCapEngine } from '@/features/design/pilecap/combinedPileCapEngine';
import { NormalizedStructuralModel } from '@/features/model/types';
import { PlotSite } from '@/features/plot/plotTypes';
import { PileCapDesignOutput } from '@/features/design/pilecap/pileCapDesignEngine';

describe('FoundationSpatialSizingEngine', () => {
  const samplePlot: PlotSite = {
    plotLength: 20.0,
    plotWidth: 15.0,
    plotOriginX: 0.0,
    plotOriginZ: 0.0,
    roadSide: 'FRONT',
    frontSetback: 1.5,
    rearSetback: 1.5,
    leftSetback: 1.0,
    rightSetback: 1.0,
    buildingLength: 15,
    buildingWidth: 10,
    buildingOffsetX: 2,
    buildingOffsetZ: 2,
    groundElevation: 0,
    buildingRotation: 0,
  };

  const createDummyCap = (
    nodeId: number,
    pileCount: number,
    length: number,
    width: number,
    rotationAngle = 0
  ): PileCapDesignOutput => ({
    supportNodeId: nodeId,
    factoredVerticalLoad: 800,
    workingVerticalLoad: 533.3,
    factoredMomentX: 20,
    factoredMomentY: 10,
    pileCount,
    capShape: 'RECTANGULAR',
    pileDiameter: 350,
    rotationAngle,
    safePileCapacity: 280,
    pileSpacing: 1050,
    edgeDistance: 350,
    pileOffsets: [],
    capLength: length,
    capWidth: width,
    capDepth: 750,
    effectiveDepth: 674,
    loadPerPile: 400,
    columnPunching: {} as any,
    flexureX: {} as any,
    flexureY: {} as any,
    rebarCalloutX: 'T16 @ 125 mm c/c',
    rebarCalloutY: 'T16 @ 125 mm c/c',
    topRebarCallout: 'T12 @ 150 mm c/c',
    sideFaceRebarCallout: '2-T12 @ 200 mm c/c',
    topAstReq: 250,
    topAstProv: 350,
    sideFaceAstReq: 100,
    sideFaceAstProv: 150,
    bottomBarDia: 16,
    bottomBarSpacing: 125,
    topBarDia: 12,
    topBarSpacing: 150,
    sideBarDia: 12,
    numSideLayers: 2,
    sideBarSpacing: 200,
    governingLoadCase: 1,
    status: 'PASS',
    calculationReport: {} as any,
  });

  describe('checkCollision', () => {
    it('should detect when two pile caps physically overlap', () => {
      const capA: CapFootprint2D = {
        id: 1,
        label: 'PC-1',
        isCombined: false,
        centerX: 5.0,
        centerZ: 5.0,
        minX: 4.0,
        maxX: 6.0,
        minZ: 4.0,
        maxZ: 6.0,
        dimX: 2000,
        dimZ: 2000,
        rotationAngle: 0,
      };

      const capB: CapFootprint2D = {
        id: 2,
        label: 'PC-2',
        isCombined: false,
        centerX: 6.5,
        centerZ: 5.0,
        minX: 5.5,
        maxX: 7.5,
        minZ: 4.0,
        maxZ: 6.0,
        dimX: 2000,
        dimZ: 2000,
        rotationAngle: 0,
      };

      const col = FoundationSpatialSizingEngine.checkCollision(capA, capB, 0.15);
      expect(col).not.toBeNull();
      expect(col?.capA).toBe('PC-1');
      expect(col?.capB).toBe('PC-2');
      expect(col?.overlapXM).toBeGreaterThan(0);
    });

    it('should detect when two caps do not overlap but violate the 150mm clear gap requirement', () => {
      const capA: CapFootprint2D = {
        id: 1,
        label: 'PC-1',
        isCombined: false,
        centerX: 5.0,
        centerZ: 5.0,
        minX: 4.0,
        maxX: 6.0,
        minZ: 4.0,
        maxZ: 6.0,
        dimX: 2000,
        dimZ: 2000,
        rotationAngle: 0,
      };

      // Gap of 80mm between capA (maxX=6.0) and capB (minX=6.08)
      const capB: CapFootprint2D = {
        id: 2,
        label: 'PC-2',
        isCombined: false,
        centerX: 7.08,
        centerZ: 5.0,
        minX: 6.08,
        maxX: 8.08,
        minZ: 4.0,
        maxZ: 6.0,
        dimX: 2000,
        dimZ: 2000,
        rotationAngle: 0,
      };

      const col = FoundationSpatialSizingEngine.checkCollision(capA, capB, 0.15);
      expect(col).not.toBeNull();
      expect(col?.clearGapM).toBeLessThan(0.15);
    });

    it('should return null when caps maintain >150mm clear gap', () => {
      const capA: CapFootprint2D = {
        id: 1,
        label: 'PC-1',
        isCombined: false,
        centerX: 2.0,
        centerZ: 2.0,
        minX: 1.0,
        maxX: 3.0,
        minZ: 1.0,
        maxZ: 3.0,
        dimX: 2000,
        dimZ: 2000,
        rotationAngle: 0,
      };

      const capB: CapFootprint2D = {
        id: 2,
        label: 'PC-2',
        isCombined: false,
        centerX: 6.0,
        centerZ: 2.0,
        minX: 5.0,
        maxX: 7.0,
        minZ: 1.0,
        maxZ: 3.0,
        dimX: 2000,
        dimZ: 2000,
        rotationAngle: 0,
      };

      const col = FoundationSpatialSizingEngine.checkCollision(capA, capB, 0.15);
      expect(col).toBeNull();
    });
  });

  describe('checkPlotViolations', () => {
    const limits = FoundationSpatialSizingEngine.getPlotLimits(samplePlot)!;

    it('should detect when a pile cap crosses outside the front property line', () => {
      const capOutside: CapFootprint2D = {
        id: 1,
        label: 'PC-1',
        isCombined: false,
        centerX: 0.5, // 0.5m from X=0
        centerZ: 5.0,
        minX: -0.5, // crosses by 0.5m past X=0
        maxX: 1.5,
        minZ: 4.0,
        maxZ: 6.0,
        dimX: 2000,
        dimZ: 2000,
        rotationAngle: 0,
      };

      const vios = FoundationSpatialSizingEngine.checkPlotViolations(capOutside, limits);
      expect(vios.length).toBe(1);
      expect(vios[0].boundarySide).toBe('FRONT');
      expect(vios[0].protrusionXM).toBeCloseTo(0.5, 2);
    });

    it('should return no violations for caps fully contained inside plot', () => {
      const capInside: CapFootprint2D = {
        id: 2,
        label: 'PC-2',
        isCombined: false,
        centerX: 5.0,
        centerZ: 5.0,
        minX: 4.0,
        maxX: 6.0,
        minZ: 4.0,
        maxZ: 6.0,
        dimX: 2000,
        dimZ: 2000,
        rotationAngle: 0,
      };

      const vios = FoundationSpatialSizingEngine.checkPlotViolations(capInside, limits);
      expect(vios.length).toBe(0);
    });
  });

  describe('getOptimalIndividualOrientation', () => {
    it('should rotate rectangular cap from 0° to 90° when 0° protrudes past plot line but 90° stays inside', () => {
      const mockModel = {
        nodes: new Map([[1, { id: 1, x: 0.8, y: 0, z: 5.0 }]]),
        members: new Map(),
        supports: new Map([[1, { nodeId: 1 }]]),
      } as unknown as NormalizedStructuralModel;

      // 2-pile rectangular cap: Length=2100mm (X at 0° -> halfX=1.05m -> minX = 0.8 - 1.05 = -0.25m: crosses plot line!)
      // Width=1050mm (X at 90° -> halfX=0.525m -> minX = 0.8 - 0.525 = +0.275m: fully inside plot!)
      const cap = createDummyCap(1, 2, 2100, 1050, 0);
      const allSupports = [{ nodeId: 1, x: 0.8, z: 5.0 }];

      const opt = FoundationSpatialSizingEngine.getOptimalIndividualOrientation(
        1,
        cap,
        mockModel,
        allSupports,
        samplePlot
      );

      expect(opt.recommendedRotation).toBe(90);
    });

    it('should rotate rectangular cap to maximize clearance to neighbor column', () => {
      // Two columns spaced 2.5m apart along X, but 10m apart along Z
      const mockModel = {
        nodes: new Map([
          [1, { id: 1, x: 5.0, y: 0, z: 5.0 }],
          [2, { id: 2, x: 7.2, y: 0, z: 5.0 }], // 2.2m apart along X
        ]),
        members: new Map(),
        supports: new Map([
          [1, { nodeId: 1 }],
          [2, { nodeId: 2 }],
        ]),
      } as unknown as NormalizedStructuralModel;

      // If at 0°, capLength (2400mm) points along X -> halfX = 1.2m -> gap to center is 2.2 - 1.2 = 1.0m (tight)
      // If at 90°, capWidth (1200mm) points along X -> halfX = 0.6m -> gap is 2.2 - 0.6 = 1.6m (much clearer!)
      const cap = createDummyCap(1, 2, 2400, 1200, 0);
      const allSupports = [
        { nodeId: 1, x: 5.0, z: 5.0 },
        { nodeId: 2, x: 7.2, z: 5.0 },
      ];

      const opt = FoundationSpatialSizingEngine.getOptimalIndividualOrientation(
        1,
        cap,
        mockModel,
        allSupports,
        samplePlot
      );

      expect(opt.recommendedRotation).toBe(90);
    });
  });

  describe('findCollisionClusters', () => {
    it('should group columns whose individual pile caps collide into a combined cluster', () => {
      const mockModel = {
        nodes: new Map([
          [1, { id: 1, x: 5.0, y: 0, z: 5.0 }],
          [2, { id: 2, x: 6.5, y: 0, z: 5.0 }], // distance 1.5m
          [3, { id: 3, x: 12.0, y: 0, z: 5.0 }], // distance 5.5m (far away)
        ]),
        members: new Map(),
        supports: new Map([
          [1, { nodeId: 1 }],
          [2, { nodeId: 2 }],
          [3, { nodeId: 3 }],
        ]),
      } as unknown as NormalizedStructuralModel;

      const caps = new Map<number, PileCapDesignOutput>([
        [1, createDummyCap(1, 4, 2100, 2100)],
        [2, createDummyCap(2, 4, 2100, 2100)],
        [3, createDummyCap(3, 4, 2100, 2100)],
      ]);

      const nodes = [
        { nodeId: 1, x: 5.0, z: 5.0, Pu: 800 },
        { nodeId: 2, x: 6.5, z: 5.0, Pu: 800 },
        { nodeId: 3, x: 12.0, z: 5.0, Pu: 800 },
      ];

      const clusters = FoundationSpatialSizingEngine.findCollisionClusters(mockModel, nodes, caps, [], 0.15);

      expect(clusters.length).toBe(1);
      expect(clusters[0]).toContain(1);
      expect(clusters[0]).toContain(2);
      expect(clusters[0]).not.toContain(3);
    });

    it('should respect detachedNodeIds and not merge detached columns', () => {
      const mockModel = {
        nodes: new Map([
          [1, { id: 1, x: 5.0, y: 0, z: 5.0 }],
          [2, { id: 2, x: 6.5, y: 0, z: 5.0 }],
        ]),
        members: new Map(),
        supports: new Map([
          [1, { nodeId: 1 }],
          [2, { nodeId: 2 }],
        ]),
      } as unknown as NormalizedStructuralModel;

      const caps = new Map<number, PileCapDesignOutput>([
        [1, createDummyCap(1, 4, 2100, 2100)],
        [2, createDummyCap(2, 4, 2100, 2100)],
      ]);

      const nodes = [
        { nodeId: 1, x: 5.0, z: 5.0, Pu: 800 },
        { nodeId: 2, x: 6.5, z: 5.0, Pu: 800 },
      ];

      // Node 2 is detached by user
      const clusters = FoundationSpatialSizingEngine.findCollisionClusters(mockModel, nodes, caps, [2], 0.15);
      expect(clusters.length).toBe(0);
    });
  });

  describe('detectAndDesignAll with autoMergeCollisions', () => {
    it('should automatically merge colliding columns into an auto-sized combined pile cap', () => {
      const mockModel = {
        nodes: new Map([
          [10, { id: 10, x: 5.0, y: 0, z: 5.0 }],
          [11, { id: 11, x: 6.4, y: 0, z: 5.0 }], // 1.4m spacing
          [20, { id: 20, x: 12.0, y: 0, z: 5.0 }], // standalone
        ]),
        members: new Map(),
        supports: new Map([
          [10, { nodeId: 10 }],
          [11, { nodeId: 11 }],
          [20, { nodeId: 20 }],
        ]),
        reactions: [
          { nodeId: 10, fx: 0, fy: 650, fz: 0, mx: 0, my: 0, mz: 0, loadCaseId: 1 },
          { nodeId: 11, fx: 0, fy: 650, fz: 0, mx: 0, my: 0, mz: 0, loadCaseId: 1 },
          { nodeId: 20, fx: 0, fy: 650, fz: 0, mx: 0, my: 0, mz: 0, loadCaseId: 1 },
        ],
      } as unknown as NormalizedStructuralModel;

      const indCaps = new Map<number, PileCapDesignOutput>([
        [10, createDummyCap(10, 4, 2100, 2100)],
        [11, createDummyCap(11, 4, 2100, 2100)],
        [20, createDummyCap(20, 4, 2100, 2100)],
      ]);

      const combined = CombinedPileCapEngine.detectAndDesignAll(
        mockModel,
        indCaps,
        350,
        [],
        [],
        undefined,
        280,
        samplePlot,
        true // autoMergeCollisions enabled
      );

      expect(combined.length).toBe(1);
      expect(combined[0].nodeIds).toContain(10);
      expect(combined[0].nodeIds).toContain(11);
      expect(combined[0].nodeIds).not.toContain(20);
      expect(combined[0].absorbedIndividualCaps).toEqual(expect.arrayContaining([10, 11]));

      // Verify IS 2911 Cl. 6.6.1 minimum pile spacing (>= 2.5 * Dp = 875mm)
      expect(combined[0].pileSpacing).toBeGreaterThanOrEqual(2.5 * 350);
    });
  });

  describe('autoSizeAll Master Method', () => {
    it('should re-orient caps and merge colliding clusters in a single call, producing clean audit compliance', () => {
      const mockModel = {
        nodes: new Map([
          // Column 1: near front plot boundary (X=0.8), cap length along X protrudes outside plot at 0°
          [1, { id: 1, x: 0.8, y: 0, z: 5.0 }],
          // Column 2 & 3: spaced 1.4m apart -> collide
          [2, { id: 2, x: 8.0, y: 0, z: 5.0 }],
          [3, { id: 3, x: 9.4, y: 0, z: 5.0 }],
        ]),
        members: new Map(),
        supports: new Map([
          [1, { nodeId: 1 }],
          [2, { nodeId: 2 }],
          [3, { nodeId: 3 }],
        ]),
      } as unknown as NormalizedStructuralModel;

      const caps = new Map<number, PileCapDesignOutput>([
        [1, createDummyCap(1, 2, 2100, 1050, 0)], // 0° extends to X = -0.25m
        [2, createDummyCap(2, 4, 2100, 2100, 0)],
        [3, createDummyCap(3, 4, 2100, 2100, 0)],
      ]);

      const result = FoundationSpatialSizingEngine.autoSizeAll(
        mockModel,
        caps,
        [],
        [],
        samplePlot
      );

      // Verify column 1 was rotated to 90° so it stays inside plot
      expect(result.recommendedRotations[1]).toBe(90);
      expect(result.rotatedCapCount).toBeGreaterThanOrEqual(1);

      // Verify columns 2 & 3 were merged
      expect(result.newCombinedGroups.length).toBe(1);
      expect(result.newCombinedGroups[0]).toContain(2);
      expect(result.newCombinedGroups[0]).toContain(3);
      expect(result.mergedNodeCount).toBe(2);
    });
  });
});
