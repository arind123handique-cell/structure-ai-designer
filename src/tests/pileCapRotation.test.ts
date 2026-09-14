import { describe, it, expect, beforeEach } from 'vitest';
import {
  rotatePoint2D,
  rotatePoints2D,
  angleToOrientation,
  orientationToAngle,
  getPileOffsetsMm,
} from '@/features/design/pilecap/pileCapGeometryUtils';
import { PileCapDesignEngine } from '@/features/design/pilecap/pileCapDesignEngine';
import { useProjectStore } from '@/features/projects/projectStore';

describe('Pile Cap Rotation & Multi-Module Synchronization', () => {
  describe('Geometry Utilities (rotatePoint2D & rotatePoints2D)', () => {
    it('rotates Cartesian coordinates clockwise correctly', () => {
      const pt = { x: 0, y: 100 }; // Point pointing UP (+Y)
      const center = { x: 0, y: 0 };

      // 90 deg CW in Cartesian (Y up) -> points RIGHT (+X)
      const p90 = rotatePoint2D(pt, 90, center, false);
      expect(p90.x).toBeCloseTo(100, 1);
      expect(p90.y).toBeCloseTo(0, 1);

      // 180 deg CW -> points DOWN (-Y)
      const p180 = rotatePoint2D(pt, 180, center, false);
      expect(p180.x).toBeCloseTo(0, 1);
      expect(p180.y).toBeCloseTo(-100, 1);

      // 270 deg CW -> points LEFT (-X)
      const p270 = rotatePoint2D(pt, 270, center, false);
      expect(p270.x).toBeCloseTo(-100, 1);
      expect(p270.y).toBeCloseTo(0, 1);

      // 360 deg / 0 deg -> unchanged
      const p360 = rotatePoint2D(pt, 360, center, false);
      expect(p360.x).toBe(0);
      expect(p360.y).toBe(100);
    });

    it('rotates SVG coordinates (Y down) clockwise correctly', () => {
      const center = { x: 100, y: 100 };
      const pt = { x: 100, y: 50 }; // In SVG, 50 px UP from center (Y is smaller)

      // 90 deg CW in SVG screen space: turns to the RIGHT (x increases to 150, y becomes 100)
      const p90Svg = rotatePoint2D(pt, 90, center, true);
      expect(p90Svg.x).toBeCloseTo(150, 1);
      expect(p90Svg.y).toBeCloseTo(100, 1);

      // 180 deg CW in SVG screen space: turns DOWN (x is 100, y increases to 150)
      const p180Svg = rotatePoint2D(pt, 180, center, true);
      expect(p180Svg.x).toBeCloseTo(100, 1);
      expect(p180Svg.y).toBeCloseTo(150, 1);
    });

    it('maps angles to CapOrientation correctly for 3-pile triangular caps', () => {
      expect(angleToOrientation(0)).toBe('UP');
      expect(angleToOrientation(360)).toBe('UP');
      expect(angleToOrientation(90)).toBe('RIGHT');
      expect(angleToOrientation(180)).toBe('DOWN');
      expect(angleToOrientation(270)).toBe('LEFT');

      expect(orientationToAngle('UP')).toBe(0);
      expect(orientationToAngle('RIGHT')).toBe(90);
      expect(orientationToAngle('DOWN')).toBe(180);
      expect(orientationToAngle('LEFT')).toBe(270);
    });
  });

  describe('PileCapDesignEngine with rotationAngle', () => {
    it('rotates a 2-pile cap by 90 degrees and swaps orthogonal dimensions', () => {
      const base0 = PileCapDesignEngine.design({
        supportNodeId: 1,
        colWidth: 450,
        colDepth: 450,
        pileDiameter: 500,
        safePileCapacity: 450,
        customPileCount: 2,
        factoredVerticalLoad: 750,
        fck: 25,
        fy: 500,
        rotationAngle: 0,
      });

      const rot90 = PileCapDesignEngine.design({
        supportNodeId: 1,
        colWidth: 450,
        colDepth: 450,
        pileDiameter: 500,
        safePileCapacity: 450,
        customPileCount: 2,
        factoredVerticalLoad: 750,
        fck: 25,
        fy: 500,
        rotationAngle: 90,
      });

      expect(rot90.rotationAngle).toBe(90);
      // Dimensions swap L <-> B
      expect(rot90.capLength).toBe(base0.capWidth);
      expect(rot90.capWidth).toBe(base0.capLength);

      // Pile offsets rotate from X-aligned to Y-aligned
      expect(base0.pileOffsets[0].y).toBe(0);
      expect(base0.pileOffsets[1].y).toBe(0);

      expect(rot90.pileOffsets[0].x).toBe(0);
      expect(rot90.pileOffsets[1].x).toBe(0);
      expect(Math.abs(rot90.pileOffsets[0].y)).toBeGreaterThan(0);
      expect(Math.abs(rot90.pileOffsets[1].y)).toBeGreaterThan(0);
    });

    it('rotates a 3-pile triangular cap through 0, 90, 180, 270 degrees', () => {
      const angles = [0, 90, 180, 270] as const;
      const expectedOrients = ['UP', 'RIGHT', 'DOWN', 'LEFT'] as const;

      angles.forEach((deg, idx) => {
        const out = PileCapDesignEngine.design({
          supportNodeId: 2,
          colWidth: 450,
          colDepth: 450,
          pileDiameter: 500,
          safePileCapacity: 450,
          customPileCount: 3,
          factoredVerticalLoad: 1100,
          fck: 25,
          fy: 500,
          rotationAngle: deg,
        });

        expect(out.rotationAngle).toBe(deg);
        expect(out.pileOffsets.length).toBe(3);

        const expectedOffsets = getPileOffsetsMm(3, out.pileSpacing, expectedOrients[idx]);
        expect(out.pileOffsets[0].x).toBe(expectedOffsets[0].x);
        expect(out.pileOffsets[0].y).toBe(expectedOffsets[0].y);
      });
    });

    it('rotates a 4-pile cap by 90 and 180 degrees', () => {
      const out0 = PileCapDesignEngine.design({
        supportNodeId: 3,
        colWidth: 450,
        colDepth: 450,
        pileDiameter: 500,
        safePileCapacity: 450,
        customPileCount: 4,
        factoredVerticalLoad: 1500,
        fck: 25,
        fy: 500,
        rotationAngle: 0,
      });

      const out90 = PileCapDesignEngine.design({
        supportNodeId: 3,
        colWidth: 450,
        colDepth: 450,
        pileDiameter: 500,
        safePileCapacity: 450,
        customPileCount: 4,
        factoredVerticalLoad: 1500,
        fck: 25,
        fy: 500,
        rotationAngle: 90,
      });

      expect(out90.rotationAngle).toBe(90);
      expect(out90.pileOffsets.length).toBe(4);

      // Rotated 90 deg clockwise: (x, y) -> (y, -x)
      out0.pileOffsets.forEach((p0) => {
        const expectedX = p0.y;
        const expectedY = -p0.x;
        const match = out90.pileOffsets.some(
          (pRot) => Math.abs(pRot.x - expectedX) <= 1 && Math.abs(pRot.y - expectedY) <= 1
        );
        expect(match).toBe(true);
      });
    });
  });

  describe('Project Store Rotation Actions', () => {
    beforeEach(() => {
      // Clear overrides before each test
      const state = useProjectStore.getState();
      state.customPileCapOverrides = {};
      state.customCombinedCapOverrides = {};
    });

    it('rotates individual pile cap CW: 0 -> 90 -> 180 -> 270 -> 0', () => {
      const store = useProjectStore.getState();
      const nodeId = 101;

      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBeUndefined();

      store.rotatePileCap(nodeId, 'CW');
      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBe(90);

      store.rotatePileCap(nodeId, 'CW');
      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBe(180);

      store.rotatePileCap(nodeId, 'CW');
      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBe(270);

      store.rotatePileCap(nodeId, 'CW');
      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBe(0);
    });

    it('rotates individual pile cap CCW: 0 -> 270 -> 180 -> 90 -> 0', () => {
      const store = useProjectStore.getState();
      const nodeId = 102;

      store.rotatePileCap(nodeId, 'CCW');
      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBe(270);

      store.rotatePileCap(nodeId, 'CCW');
      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBe(180);

      store.rotatePileCap(nodeId, 'CCW');
      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBe(90);

      store.rotatePileCap(nodeId, 'CCW');
      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBe(0);
    });

    it('sets individual pile cap rotation angle directly', () => {
      const store = useProjectStore.getState();
      const nodeId = 103;

      store.setPileCapRotation(nodeId, 180);
      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBe(180);

      store.setPileCapRotation(nodeId, 0);
      expect(useProjectStore.getState().customPileCapOverrides[nodeId]?.rotationAngle).toBe(0);
    });

    it('rotates combined pile cap CW and CCW', () => {
      const store = useProjectStore.getState();
      const groupId = 'SW-1';

      store.rotateCombinedPileCap(groupId, 'CW');
      expect(useProjectStore.getState().customCombinedCapOverrides[groupId]?.rotationAngle).toBe(90);

      store.rotateCombinedPileCap(groupId, 'CW');
      expect(useProjectStore.getState().customCombinedCapOverrides[groupId]?.rotationAngle).toBe(180);

      store.rotateCombinedPileCap(groupId, 'CCW');
      expect(useProjectStore.getState().customCombinedCapOverrides[groupId]?.rotationAngle).toBe(90);

      store.setCombinedCapRotation(groupId, 270);
      expect(useProjectStore.getState().customCombinedCapOverrides[groupId]?.rotationAngle).toBe(270);
    });
  });
});
