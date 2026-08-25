import { describe, it, expect } from 'vitest';
import { LateralLoadAuditor } from '@/features/anl/lateralLoadAuditor';

describe('STAAD Lateral Load Auditor', () => {
  it('should detect IS 1893 seismic and IS 875 wind loads from ANL string', () => {
    const rawAnl = `
      STAAD SPACE
      START JOB INFORMATION
      ENGINEER DATE 23-AUG-26
      END JOB INFORMATION
      DEFINE 1893 LOAD
      ZONE 0.24 K 1.0 I 1.2 R 5
      SELFWEIGHT 1
      JOINT WEIGHT
      1 TO 100 WEIGHT 45.0
      LOAD 1 DEAD LOAD
      LOAD 2 LIVE LOAD
      LOAD 3 SEISMIC LOAD IN X DIRECTION (IS 1893)
      1893 LOAD X 1.0
      LOAD 4 SEISMIC LOAD IN Z DIRECTION (IS 1893)
      1893 LOAD Z 1.0
      LOAD 5 WIND LOAD IN X DIRECTION
      WIND LOAD X 1.0 TYPE 1
      PERFORM ANALYSIS
    `;

    const result = LateralLoadAuditor.audit(rawAnl);

    expect(result.hasStaticSeismic).toBe(true);
    expect(result.hasWindLoad).toBe(true);
    expect(result.isCompliant).toBe(true);
    expect(result.generatedWarnings.length).toBe(0);
  });

  it('should flag warnings when lateral loads are missing', () => {
    const rawAnl = `
      STAAD SPACE
      LOAD 1 DEAD LOAD
      LOAD 2 LIVE LOAD
      PERFORM ANALYSIS
    `;

    const result = LateralLoadAuditor.audit(rawAnl);

    expect(result.hasStaticSeismic).toBe(false);
    expect(result.hasWindLoad).toBe(false);
    expect(result.isCompliant).toBe(false);
    expect(result.generatedWarnings.length).toBeGreaterThan(0);
  });
});
