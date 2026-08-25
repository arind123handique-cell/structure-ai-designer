import { describe, it, expect } from 'vitest';
import { IS456LoadCombinations } from '@/features/codes/is456/loadCombinations';

describe('IS 456 / IS 1893 Load Combinations Engine', () => {
  it('should generate standard IS collapse and serviceability load combinations', () => {
    const combs = IS456LoadCombinations.getStandardCombinations();

    expect(combs.length).toBeGreaterThanOrEqual(15);

    // Check 1.5(DL + LL)
    const grav = combs.find((c) => c.name === '1.5(DL + LL)');
    expect(grav).toBeDefined();
    expect(grav?.factors.dl).toBe(1.5);
    expect(grav?.factors.ll).toBe(1.5);
    expect(grav?.type).toBe('STRENGTH');

    // Check 1.2(DL + LL + EQX)
    const eq12 = combs.find((c) => c.name === '1.2(DL + LL + EQX)');
    expect(eq12).toBeDefined();
    expect(eq12?.factors.eqx).toBe(1.2);

    // Check 0.9DL + 1.5EQX (Uplift / Overturning)
    const uplift = combs.find((c) => c.name === '0.9DL + 1.5EQX');
    expect(uplift).toBeDefined();
    expect(uplift?.factors.dl).toBe(0.9);
    expect(uplift?.factors.eqx).toBe(1.5);

    // Check SLS combination
    const sls = combs.find((c) => c.name === '1.0(DL + LL) [SLS]');
    expect(sls).toBeDefined();
    expect(sls?.type).toBe('SERVICEABILITY');
  });
});
