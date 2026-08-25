import { describe, it, expect } from 'vitest';
import { PileCapOptimizationEngine } from '@/features/design/pilecap/pileCapOptimizationEngine';
import { NormalizedStructuralModel, Support3D } from '@/features/model/types';

describe('PileCapOptimizationEngine', () => {
  it('should optimize single pile cap depth and rebar for minimum volume while passing punching shear', () => {
    const result = PileCapOptimizationEngine.optimizeSinglePileCap(
      1,
      1300, // Pu = 1300 kN
      20,
      15,
      25, // M25
      500, // Fe500D
      450, // Qsafe = 450 kN
      500, // Dp = 500 mm
      [12, 16, 20, 25],
      450,
      550
    );

    expect(result.status).toBe('PASS');
    expect(result.optimizedPileCount).toBeGreaterThanOrEqual(2);
    expect(result.optimizedCapSize.depth).toBeGreaterThanOrEqual(700);
    expect(result.punchingShearRatio).toBeLessThanOrEqual(1.0);
    expect(result.optimizedRebarX).toBeDefined();
    expect(result.optimizedTopRebar).toBeDefined();
    expect(result.optimizedSideFaceRebar).toBeDefined();
  });

  it('should batch optimize all pile caps across the structural model', () => {
    const mockModel: Partial<NormalizedStructuralModel> = {
      nodes: new Map([
        [1, { id: 1, x: 0, y: 0, z: 0 }],
        [2, { id: 2, x: 5, y: 0, z: 0 }],
      ]),
      supports: new Map<number, Support3D>([
        [1, { nodeId: 1, type: 'PINNED', releases: { fx: false, fy: false, fz: false, mx: true, my: true, mz: true } }],
        [2, { nodeId: 2, type: 'PINNED', releases: { fx: false, fy: false, fz: false, mx: true, my: true, mz: true } }],
      ]),
      reactions: [
        { nodeId: 1, loadCaseId: 1, fx: 0, fy: 1250, fz: 0, mx: 10, my: 0, mz: 15 },
        { nodeId: 2, loadCaseId: 1, fx: 0, fy: 1450, fz: 0, mx: 15, my: 0, mz: 20 },
      ],
    };

    const summary = PileCapOptimizationEngine.optimizeAllPileCaps(
      mockModel as NormalizedStructuralModel,
      null,
      [12, 16, 20, 25],
      450,
      500
    );

    expect(summary.totalCaps).toBe(2);
    expect(summary.allPassed).toBe(true);
    expect(summary.results.length).toBe(2);
    expect(summary.totalOptimizedConcreteM3).toBeGreaterThan(0);
  });
});
