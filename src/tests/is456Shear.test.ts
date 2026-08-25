import { describe, it, expect } from 'vitest';
import { IS456Shear } from '@/features/codes/is456/shear';

describe('IS 456 Shear Design Engine', () => {
  it('should return correct Table 20 maximum shear stress tau_c_max', () => {
    expect(IS456Shear.getTauCMax(20)).toBe(2.8);
    expect(IS456Shear.getTauCMax(25)).toBe(3.1);
    expect(IS456Shear.getTauCMax(30)).toBe(3.5);
    expect(IS456Shear.getTauCMax(35)).toBe(3.7);
    expect(IS456Shear.getTauCMax(40)).toBe(4.0);
  });

  it('should interpolate Table 19 design concrete shear strength tau_c accurately', () => {
    // For M25 concrete:
    // pt = 0.15% -> tau_c = 0.29 N/mm2
    // pt = 0.50% -> tau_c = 0.49 N/mm2
    // pt = 1.00% -> tau_c = 0.64 N/mm2
    const tau_c_015 = IS456Shear.getTauC(25, 0.15);
    const tau_c_050 = IS456Shear.getTauC(25, 0.50);
    const tau_c_100 = IS456Shear.getTauC(25, 1.00);

    expect(tau_c_015).toBeCloseTo(0.29, 2);
    expect(tau_c_050).toBeCloseTo(0.49, 2);
    expect(tau_c_100).toBeCloseTo(0.64, 2);
  });

  it('should design shear stirrups correctly for beam section', () => {
    // b = 300 mm, d = 410 mm, fck = 25, fy = 500, Vu = 120 kN, Ast = 942 mm2 (pt = 0.765%)
    const result = IS456Shear.designShear({
      b: 300,
      d: 410,
      fck: 25,
      fy: 500,
      Vu: 120,
      Ast_prov: 942,
      stirrupDiameter: 8,
      legs: 2,
    });

    expect(result.status).toBe('PASS');
    expect(result.tau_v).toBeCloseTo(0.976, 2);
    expect(result.tau_c).toBeGreaterThan(0.5);
    expect(result.Vus_req).toBeGreaterThan(0);
    expect(result.spacing_prov).toBeLessThanOrEqual(300);
    expect(result.callout).toContain('2L-8mm');
  });

  it('should fail when nominal shear stress exceeds tau_c_max', () => {
    // Overstressed beam: b = 200 mm, d = 300 mm, Vu = 300 kN -> tau_v = 5.0 N/mm2 > 3.1
    const result = IS456Shear.designShear({
      b: 200,
      d: 300,
      fck: 25,
      fy: 500,
      Vu: 300,
      Ast_prov: 600,
    });

    expect(result.status).toBe('FAIL');
    expect(result.failureReason).toContain('exceeds maximum permissible limit');
  });
});
