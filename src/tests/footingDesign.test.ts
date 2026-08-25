import { describe, it, expect } from 'vitest';
import { FoundationSoilPressure } from '@/features/codes/foundation/soilPressure';
import { FootingDesignEngine } from '@/features/design/footing/footingDesignEngine';

describe('IS 456 Isolated Footing Design Engine', () => {
  it('should calculate soil base pressure distribution and tension check', () => {
    // P = 500 kN, Mx = 25 kNm, My = 15 kNm, L = 2.0 m, B = 2.0 m, SBC = 200 kN/m2
    const result = FoundationSoilPressure.checkPressure({
      P: 500,
      Mx: 25,
      My: 15,
      L: 2.0,
      B: 2.0,
      SBC: 200,
      footingDepth: 0.5,
    });

    expect(result.status).toBe('PASS');
    expect(result.q_max).toBeLessThanOrEqual(200);
    expect(result.q_min).toBeGreaterThan(0);
    expect(result.hasTension).toBe(false);
  });

  it('should run master FootingDesignEngine end-to-end', () => {
    const output = FootingDesignEngine.design({
      supportNodeId: 5,
      colWidth: 450,
      colDepth: 550,
      factoredVerticalLoad: 750,
      factoredMomentX: 20,
      factoredMomentY: 10,
      SBC: 200,
      fck: 25,
      fy: 500,
      governingLoadCase: 10,
    });

    expect(output.status).toBe('PASS');
    expect(output.length).toBeGreaterThanOrEqual(1.5);
    expect(output.thickness).toBeGreaterThanOrEqual(450);
    expect(output.punchingShear.status).toBe('PASS');
    expect(output.oneWayShear.status).toBe('PASS');
    expect(output.rebarCalloutX).toContain('T16');
    expect(output.calculationReport.sections.length).toBe(3);
  });
});
