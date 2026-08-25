import { describe, it, expect } from 'vitest';
import { IS13920GradeBeam } from '../features/codes/is13920/gradeBeam';
import { GradeBeamDesignEngine } from '../features/design/gradebeam/gradeBeamEngine';

describe('IS 13920:2016 Grade Beam & Tie Beam Design', () => {
  it('correctly calculates minimum axial tension tie force (10% max Pu >= 100 kN)', () => {
    // Pu1 = 1528 kN, Pu2 = 1316 kN
    const res = IS13920GradeBeam.design({
      b: 300,
      D: 450,
      spanLength: 5.4,
      fck: 25,
      fy: 500,
      factoredPu1: 1528.9,
      factoredPu2: 1316.5,
    });

    expect(res.factoredTensionTiePu).toBe(152.9); // 10% of 1528.9
    expect(res.status).toBe('PASS');
    expect(res.astReqTotal).toBeGreaterThan(300);
    expect(res.endZoneSpacing).toBeLessThanOrEqual(100);
    expect(res.confinementLength).toBe(900); // 2 * 450
  });

  it('enforces minimum tie force of 100 kN for small column loads', () => {
    const res = IS13920GradeBeam.design({
      b: 300,
      D: 450,
      spanLength: 3.5,
      fck: 25,
      fy: 500,
      factoredPu1: 450,
      factoredPu2: 500,
    });

    expect(res.factoredTensionTiePu).toBe(100); // Max(10% of 650 default, 100) = 100
  });

  it('runs master GradeBeamDesignEngine and generates complete detailed calculation sheet', () => {
    const output = GradeBeamDesignEngine.design({
      gradeBeamId: 'GB-1-2',
      startNodeId: 1,
      endNodeId: 2,
      startColumnLabel: 'C1',
      endColumnLabel: 'C2',
      startPileCapLabel: 'PC-1',
      endPileCapLabel: 'PC-2',
      spanLength: 5.4,
      b: 300,
      D: 450,
      fck: 25,
      fy: 500,
      factoredPu1: 1316.5,
      factoredPu2: 1528.9,
    });

    expect(output.gradeBeamId).toBe('GB-1-2');
    expect(output.factoredTensionTiePu).toBe(152.9);
    expect(output.calculationReport.sections.length).toBeGreaterThan(3);
    expect(output.topRebarCallout).toContain('T');
    expect(output.bottomRebarCallout).toContain('T');
  });
});
