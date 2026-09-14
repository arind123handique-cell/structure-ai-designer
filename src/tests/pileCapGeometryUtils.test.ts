import { describe, it, expect } from 'vitest';
import {
  getPileOffsetsMm,
  getTruncated3PilePolygonMm,
  get3PileDimensionsMm,
  renderQuarteredPileSvg,
  getSectionRebarPaths,
  determineCapOrientation,
} from '../features/design/pilecap/pileCapGeometryUtils';

describe('pileCapGeometryUtils', () => {
  it('calculates 2-pile offsets correctly', () => {
    const offsets = getPileOffsetsMm(2, 1500, 'UP');
    expect(offsets).toHaveLength(2);
    expect(offsets[0].x).toBe(-750);
    expect(offsets[1].x).toBe(750);
    expect(offsets[0].y).toBe(0);
  });

  it('calculates 3-pile equilateral offsets for all 4 orientations', () => {
    const s = 1800;
    const Rp = Math.round(s / Math.sqrt(3)); // 1039
    const halfRp = Math.round(Rp / 2); // 520

    // UP
    const upOffsets = getPileOffsetsMm(3, s, 'UP');
    expect(upOffsets).toHaveLength(3);
    expect(upOffsets[0]).toEqual({ x: 0, y: Rp });
    expect(upOffsets[1]).toEqual({ x: -900, y: -halfRp });
    expect(upOffsets[2]).toEqual({ x: 900, y: -halfRp });

    // DOWN
    const downOffsets = getPileOffsetsMm(3, s, 'DOWN');
    expect(downOffsets[0]).toEqual({ x: 0, y: -Rp });
    expect(downOffsets[1]).toEqual({ x: -900, y: halfRp });
    expect(downOffsets[2]).toEqual({ x: 900, y: halfRp });

    // LEFT
    const leftOffsets = getPileOffsetsMm(3, s, 'LEFT');
    expect(leftOffsets[0]).toEqual({ x: -Rp, y: 0 });
    expect(leftOffsets[1]).toEqual({ x: halfRp, y: -900 });
    expect(leftOffsets[2]).toEqual({ x: halfRp, y: 900 });

    // RIGHT
    const rightOffsets = getPileOffsetsMm(3, s, 'RIGHT');
    expect(rightOffsets[0]).toEqual({ x: Rp, y: 0 });
    expect(rightOffsets[1]).toEqual({ x: -halfRp, y: -900 });
    expect(rightOffsets[2]).toEqual({ x: -halfRp, y: 900 });
  });

  it('calculates truncated 3-pile polygon vertices with flat apex and chamfered base', () => {
    const s = 1800;
    const eo = 450;
    const pts = getTruncated3PilePolygonMm(s, eo, 'UP', 0);
    expect(pts).toHaveLength(6);

    const Rp = s / Math.sqrt(3);
    const topY = Rp + eo;
    const btmY = -(Rp / 2 + eo);

    // Top flat edge has width 2 * eo = 900 mm (x from -450 to +450)
    expect(pts[0].x).toBe(-450);
    expect(pts[0].y).toBeCloseTo(topY, 1);
    expect(pts[1].x).toBe(450);
    expect(pts[1].y).toBeCloseTo(topY, 1);

    // Bottom flat edge has width s + 2 * eo = 2700 mm (x from -1350 to +1350)
    expect(pts[3].x).toBe(1350);
    expect(pts[3].y).toBeCloseTo(btmY, 1);
    expect(pts[4].x).toBe(-1350);
    expect(pts[4].y).toBeCloseTo(btmY, 1);
  });

  it('calculates 3-pile dimensions matching authentic CAD geometry', () => {
    const s = 1800;
    const eo = 450;
    const dims = get3PileDimensionsMm(s, eo);

    expect(dims.lengthMm).toBe(2700); // base width
    expect(dims.apexWidthMm).toBe(900); // apex width
    expect(dims.RpMm).toBe(1039);
    expect(dims.halfRpMm).toBe(520);
    expect(dims.widthMm).toBe(2459); // total height ~ 2445 to 2460
  });

  it('renders quarter-shaded pile svg path with 2 opposite quadrants', () => {
    const { shadedQuadrantPath, crosshairs } = renderQuarteredPileSvg(100, 100, 20);
    expect(shadedQuadrantPath).toContain('M 100 100');
    expect(shadedQuadrantPath).toContain('A 20 20');
    expect(crosshairs).toHaveLength(2);
  });

  it('generates rebar cross section paths with 90 degree return hooks', () => {
    const paths = getSectionRebarPaths(50, 100, 300, 100, 60, 40, 40, 50);
    expect(paths.bottomMatPath).toContain('M');
    expect(paths.bottomMatPath).toContain('L');
    expect(paths.topMatPath).toContain('M');
    expect(paths.columnStarterPaths).toHaveLength(2);
    expect(paths.sideTiePoints).toHaveLength(4);
  });

  it('determines cap orientation correctly for perimeter columns', () => {
    const bounds = { minX: 0, maxX: 20, minZ: 0, maxZ: 20 };
    expect(determineCapOrientation(10, 0, bounds)).toBe('UP');
    expect(determineCapOrientation(10, 20, bounds)).toBe('DOWN');
    expect(determineCapOrientation(0, 10, bounds)).toBe('LEFT');
    expect(determineCapOrientation(20, 10, bounds)).toBe('RIGHT');
  });
});
