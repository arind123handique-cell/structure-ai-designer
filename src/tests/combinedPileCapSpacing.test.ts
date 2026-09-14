import { describe, it, expect } from 'vitest';
import { CombinedPileCapEngine } from '@/features/design/pilecap/combinedPileCapEngine';

describe('Combined Pile Cap Spacing & Grid Placement (IS 2911:2010 Cl. 6.6.1)', () => {
  it('strictly enforces s >= 2.5 * Dp and expands cap dimensions dynamically', () => {
    const Dp = 500;
    const eo = 500;
    const sMin = 2.5 * Dp; // 1250 mm

    const testScenarios = [
      { count: 4, lx: 1500, lz: 1500 },
      { count: 6, lx: 1800, lz: 2500 },
      { count: 8, lx: 2000, lz: 3000 },
      { count: 12, lx: 2200, lz: 4500 },
      { count: 14, lx: 2500, lz: 5000 },
      { count: 15, lx: 2500, lz: 4000 },
      { count: 16, lx: 3000, lz: 5000 },
      { count: 20, lx: 3500, lz: 6000 },
      { count: 24, lx: 4000, lz: 7000 },
    ];

    for (const sc of testScenarios) {
      const grid = CombinedPileCapEngine.computeOptimalGrid(sc.count, sc.lx, sc.lz, Dp, eo);

      // 1. All rows and columns must be fully populated (symmetrical)
      expect(grid.pileOffsets.length).toBe(grid.nX * grid.nZ);
      expect(grid.pileOffsets.length).toBeGreaterThanOrEqual(sc.count);

      // 2. Minimum center-to-center distance between ANY pair of piles must be >= 2.5 * Dp
      let minDist = Infinity;
      for (let i = 0; i < grid.pileOffsets.length; i++) {
        for (let j = i + 1; j < grid.pileOffsets.length; j++) {
          const d = Math.hypot(
            grid.pileOffsets[i].x - grid.pileOffsets[j].x,
            grid.pileOffsets[i].z - grid.pileOffsets[j].z
          );
          if (d < minDist) minDist = d;
        }
      }
      expect(minDist).toBeGreaterThanOrEqual(sMin);

      // 3. Spacing along axes must be >= sMin
      if (grid.nX > 1) {
        expect(grid.sX).toBeGreaterThanOrEqual(sMin);
      }
      if (grid.nZ > 1) {
        expect(grid.sZ).toBeGreaterThanOrEqual(sMin);
      }

      // 4. Edge distances: outermost piles must maintain at least eo to cap boundaries
      const xs = grid.pileOffsets.map((p) => p.x);
      const zs = grid.pileOffsets.map((p) => p.z);
      const halfLen = grid.capLength / 2;
      const halfWid = grid.capWidth / 2;

      const minEdgeX = halfLen - Math.max(...xs);
      const minEdgeZ = halfWid - Math.max(...zs);

      expect(minEdgeX).toBeGreaterThanOrEqual(eo - 1); // allow 1mm roundoff
      expect(minEdgeZ).toBeGreaterThanOrEqual(eo - 1);
    }
  });

  it('works correctly for standard 350mm diameter piles', () => {
    const Dp = 350;
    const eo = 350;
    const sMin = 2.5 * Dp; // 875 mm

    for (const count of [4, 6, 8, 12, 16]) {
      const grid = CombinedPileCapEngine.computeOptimalGrid(count, 2000, 3000, Dp, eo);

      expect(grid.pileOffsets.length).toBe(grid.nX * grid.nZ);
      if (grid.nX > 1) expect(grid.sX).toBeGreaterThanOrEqual(sMin);
      if (grid.nZ > 1) expect(grid.sZ).toBeGreaterThanOrEqual(sMin);
    }
  });

  it('designs merged shear wall cap with statutory compliant pile spacing', () => {
    const Dp = 500;
    const swNodes = [
      { nodeId: 3, x: 8.1, z: -2.3, Pu: 2500, colLabel: 'SW-1', colSlNo: 1 },
      { nodeId: 364, x: 9.6, z: -2.3, Pu: 2500, colLabel: 'SW-2', colSlNo: 2 },
      { nodeId: 365, x: 9.6, z: -3.8, Pu: 2500, colLabel: 'SW-3', colSlNo: 3 },
      { nodeId: 366, x: 8.1, z: -3.8, Pu: 2500, colLabel: 'SW-4', colSlNo: 4 },
    ];

    const cap = CombinedPileCapEngine.designShearWallCap(swNodes, Dp, 1, undefined, 280);

    expect(cap.pileCount).toBe(cap.pileOffsets.length);
    expect(cap.pileRows * cap.pileCols).toBe(cap.pileCount);

    // Spacing must satisfy IS 2911 Cl. 6.6.1
    expect(cap.pileSpacing).toBeGreaterThanOrEqual(2.5 * Dp);

    // Verify center-to-center distance of every pair
    let minDist = Infinity;
    for (let i = 0; i < cap.pileOffsets.length; i++) {
      for (let j = i + 1; j < cap.pileOffsets.length; j++) {
        const d = Math.hypot(
          cap.pileOffsets[i].x - cap.pileOffsets[j].x,
          cap.pileOffsets[i].z - cap.pileOffsets[j].z
        );
        if (d < minDist) minDist = d;
      }
    }
    expect(minDist).toBeGreaterThanOrEqual(2.5 * Dp);

    // Enclosing cap dimensions must be wide enough
    expect(cap.capLength).toBeGreaterThanOrEqual(cap.wallLengthM * 1000 + 2 * Dp);
    expect(cap.capWidth).toBeGreaterThanOrEqual(cap.wallWidthM * 1000 + 2 * Dp);
  });
});
