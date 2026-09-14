import { describe, it, expect } from 'vitest';
import {
  getPileOffsetsMm,
  getTruncated3PilePolygonMm,
  get3PileDimensionsMm,
  get5PilePolygonMm,
  get5PileDimensionsMm,
  get6PilePolygonMm,
  get6PileDimensionsMm,
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

  it('calculates 5-pile regular pentagon polygon and dimensions complying with IS 2911 / SP:34', () => {
    const s = 1050; // Spacing 3 * Dp for Dp=350
    const eo = 350;

    const dims = get5PileDimensionsMm(s, eo);
    expect(dims.RpMm).toBe(893); // 1050 / (2 * sin(36°)) ~ 893.18
    expect(dims.RcapMm).toBe(1326); // 893 + 350 / cos(36°) ~ 1325.62 -> 1326
    expect(dims.facetDimMm).toBe(1559); // 2 * 1326 * sin(36°) ~ 1558.8
    expect(dims.widthMm).toBe(2522); // 2 * 1326 * cos(18°) ~ 2522.1
    expect(dims.lengthMm).toBe(2399); // 1326 * (1 + cos(36°)) ~ 2398.8

    const poly = get5PilePolygonMm(s, eo, 'UP', 0);
    expect(poly).toHaveLength(5);

    // Verify all 5 edges have facet length equal to facetDimMm (+-1 mm due to integer vertex rounding)
    for (let i = 0; i < 5; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % 5];
      const edgeLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      expect(Math.abs(Math.round(edgeLen) - dims.facetDimMm)).toBeLessThanOrEqual(1);
    }

    // Verify perpendicular edge clearance from each pile to its adjacent cap edge is exactly eo (350 mm)
    const piles = getPileOffsetsMm(5, s, 'UP');
    expect(piles).toHaveLength(5);

    // Apex pile at (0, Rp): distance to edge between v0 and v1
    // v0: (0, Rcap), v1: (Rcap * cos(18°), Rcap * sin(18°))
    // Line equation from v0 to v1: normal vector is (cos(36°), sin(36°))
    // Distance from (0, Rp) to line = Rcap * cos(36°) - Rp * cos(36°) = (Rcap - Rp) * cos(36°) = eo
    const p0 = piles[0];
    const v0 = poly[0];
    const v1 = poly[1];
    // Vector v0 -> v1
    const dx = v1.x - v0.x;
    const dy = v1.y - v0.y;
    const edgeLength = Math.hypot(dx, dy);
    // Perpendicular distance from p0 to segment v0-v1: |(p0.x - v0.x)*dy - (p0.y - v0.y)*dx| / edgeLength
    const perpDist = Math.abs((p0.x - v0.x) * dy - (p0.y - v0.y) * dx) / edgeLength;
    expect(Math.round(perpDist)).toBe(eo);
  });

  it('calculates 6-pile regular hexagon polygon and dimensions complying with IS 2911 / SP:34', () => {
    const s = 1050; // Spacing 3 * Dp for Dp=350
    const eo = 350;

    const dims = get6PileDimensionsMm(s, eo);
    expect(dims.RpMm).toBe(1050); // Circumradius Rp = s for regular hexagon
    expect(dims.RcapMm).toBe(1454); // 1050 + 2 * 350 / sqrt(3) ~ 1454.14
    expect(dims.facetDimMm).toBe(1454); // Side of regular hexagon = Rcap
    expect(dims.widthMm).toBe(2908); // 2 * Rcap
    expect(dims.lengthMm).toBe(2518); // sqrt(3) * Rcap

    const poly = get6PilePolygonMm(s, eo, 'UP', 0);
    expect(poly).toHaveLength(6);

    // Verify all 6 edges have equal facet length equal to facetDimMm (+-1 mm)
    for (let i = 0; i < 6; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % 6];
      const edgeLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      expect(Math.round(edgeLen)).toBe(dims.facetDimMm);
    }

    // Verify perpendicular edge clearance from each pile to its adjacent cap edge is exactly eo (350 mm)
    const piles = getPileOffsetsMm(6, s, 'UP', 'HEXAGONAL');
    expect(piles).toHaveLength(6);

    // Pile 0 at (0, s): distance to edge between v0 and v1
    const p0 = piles[0];
    const v0 = poly[0];
    const v1 = poly[1];
    const dx = v1.x - v0.x;
    const dy = v1.y - v0.y;
    const edgeLength = Math.hypot(dx, dy);
    const perpDist = Math.abs((p0.x - v0.x) * dy - (p0.y - v0.y) * dx) / edgeLength;
    expect(Math.round(perpDist)).toBe(eo);
  });

  it('calculates 6-pile offsets: hexagonal vs rectangular 3x2 grid', () => {
    const s = 1500;
    // Hexagonal regular
    const hexOffsets = getPileOffsetsMm(6, s, 'UP', 'HEXAGONAL');
    expect(hexOffsets).toHaveLength(6);
    // All 6 piles at distance s from center
    hexOffsets.forEach((p) => {
      const dist = Math.hypot(p.x, p.y);
      expect(Math.round(dist)).toBe(s);
    });

    // Rectangular 3x2 grid
    const rectOffsets = getPileOffsetsMm(6, s, 'UP', 'RECTANGULAR');
    expect(rectOffsets).toHaveLength(6);
    // xs are -s, 0, s and ys are -s/2, s/2
    const xs = rectOffsets.map((p) => p.x);
    const ys = rectOffsets.map((p) => p.y);
    expect(Math.min(...xs)).toBe(-s);
    expect(Math.max(...xs)).toBe(s);
    expect(Math.min(...ys)).toBe(-s / 2);
    expect(Math.max(...ys)).toBe(s / 2);
  });
});
