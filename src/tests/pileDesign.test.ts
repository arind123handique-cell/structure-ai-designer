import { describe, it, expect } from 'vitest';
import { IS2911PileCapacity } from '@/features/codes/is2911/pileCapacity';
import { IS2911PileGroup } from '@/features/codes/is2911/pileGroup';
import { PileDesignEngine } from '@/features/design/pile/pileDesignEngine';

describe('IS 2911:2010 Pile Design Engine', () => {
  it('should calculate structural and geotechnical capacity of bored pile', () => {
    // Dia 500 mm, L = 12 m, fck = 25 N/mm2, fy = 500 N/mm2, cu = 55 kN/m2, alpha = 0.6
    const result = IS2911PileCapacity.calculateCapacity({
      diameter: 500,
      length: 12.0,
      fck: 25,
      fy: 500,
      cu: 55,
      alpha: 0.6,
      FOS: 2.5,
    });

    expect(result.status).toBe('PASS');
    expect(result.structuralCapacity).toBeGreaterThan(1500);
    expect(result.skinFrictionUltimate).toBeGreaterThan(500);
    expect(result.endBearingUltimate).toBeGreaterThan(80);
    expect(result.safeWorkingLoad).toBeGreaterThan(250);
    expect(result.recommendedRebarCallout).toContain('6-T16');
  });

  it('should calculate Converse-Labarre group efficiency correctly', () => {
    // 2x2 pile group (4 piles), diameter = 500 mm, spacing = 1500 mm
    // theta = arctan(500 / 1500) = 18.43 deg
    // Eg = 1 - 18.43 * [(1*2 + 1*2) / (90 * 2 * 2)] = 1 - 18.43 * (4 / 360) = 1 - 0.2048 = 0.795
    const Eg = IS2911PileGroup.calculateGroupEfficiency(2, 2, 500, 1500);
    expect(Eg).toBeCloseTo(0.795, 2);
  });

  it('should support manual capacity override and custom rebar layouts', () => {
    const manualResult = IS2911PileCapacity.calculateCapacity({
      diameter: 600,
      length: 15.0,
      fck: 30,
      fy: 500,
      manualSafeCapacity: 650,
      customBarCount: 8,
      customBarDiameter: 20,
      customSpiralDiameter: 10,
      customSpiralPitch: 100,
    });

    expect(manualResult.status).toBe('PASS');
    expect(manualResult.safeWorkingLoad).toBe(650);
    expect(manualResult.recommendedRebarCallout).toContain('8-T20');
    expect(manualResult.recommendedSpiralCallout).toContain('10mm');
  });

  it('should design Standard Project Pile Types (P-1, P-2) for project-wide usage', () => {
    const defaults = PileDesignEngine.getDefaultProjectPileTypes();
    expect(defaults.length).toBe(2);

    const p1 = defaults[0];
    expect(p1.id).toBe('P-1');
    expect(p1.diameter).toBe(500);
    expect(p1.safeWorkingLoad).toBe(450);
    expect(p1.rebarCallout).toContain('6-T16');
    expect(p1.calculationReport.sections.length).toBe(3);

    const p2 = defaults[1];
    expect(p2.id).toBe('P-2');
    expect(p2.diameter).toBe(600);
    expect(p2.safeWorkingLoad).toBe(650);
    expect(p2.rebarCallout).toContain('8-T20');
  });

  it('should support customized pile geometry, 350mm Dia with 12-T12 reinforcement', () => {
    const customPile = PileDesignEngine.designPileType({
      id: 'P-1',
      name: 'Custom Bored Pile Dia 350mm',
      diameter: 350,
      length: 11.0,
      safeWorkingLoad: 280,
      isManualCapacity: true,
      barCount: 12,
      barDiameter: 12,
      spiralDiameter: 8,
      spiralPitch: 150,
      fck: 25,
      fy: 500,
    });

    expect(customPile.diameter).toBe(350);
    expect(customPile.length).toBe(11.0);
    expect(customPile.safeWorkingLoad).toBe(280);
    expect(customPile.barCount).toBe(12);
    expect(customPile.barDiameter).toBe(12);
    expect(customPile.rebarCallout).toContain('12-T12');
    expect(customPile.status).toBe('PASS');
    expect(customPile.structuralCapacity).toBeGreaterThan(1000);
  });
});

