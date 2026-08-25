import { describe, it, expect } from 'vitest';
import { IS456Flexure } from '@/features/codes/is456/flexure';
import { BeamDesignEngine } from '@/features/design/beam/beamDesignEngine';
import { BeamBarArrangement } from '@/features/design/beam/barArrangement';

describe('IS 456 & IS 13920 Beam Design Engine & Extra Bars', () => {
  it('should calculate limiting moment capacity Mu,lim correctly', () => {
    const Mu_lim = IS456Flexure.calculateMuLim(300, 450, 25, 500);
    expect(Mu_lim).toBeCloseTo(202.9, 1);
  });

  it('should design singly reinforced beam when Mu <= Mu_lim', () => {
    const result = IS456Flexure.designFlexure({
      b: 300,
      D: 450,
      d: 410,
      fck: 25,
      fy: 500,
      Mu: 120,
    });

    expect(result.status).toBe('PASS');
    expect(result.isDoublyReinforced).toBe(false);
    expect(result.Ast_req).toBeGreaterThan(600);
    expect(result.Ast_req).toBeLessThan(1200);
    expect(result.Asc_req).toBe(0);
  });

  it('should design doubly reinforced beam when Mu > Mu_lim', () => {
    const result = IS456Flexure.designFlexure({
      b: 300,
      D: 450,
      d: 410,
      fck: 25,
      fy: 500,
      Mu: 220,
      d_prime: 40,
    });

    expect(result.status).toBe('PASS');
    expect(result.isDoublyReinforced).toBe(true);
    expect(result.Asc_req).toBeGreaterThan(200);
  });

  it('should design continuous through bars and extra curtailed bars properly', () => {
    const curtailment = BeamBarArrangement.designCurtailment(
      650, // Ast_top_req (requires extra top bars)
      500, // Ast_bottom_req (requires extra bottom bars)
      300,
      450,
      4.5
    );

    expect(curtailment.throughTop.count).toBe(2);
    expect(curtailment.extraTopSupport.hasExtra).toBe(true);
    expect(curtailment.extraTopSupport.cutoffLength).toBe(1.5); // 4.5 / 3 = 1.5m
    expect(curtailment.throughBottom.count).toBe(2);
    expect(curtailment.extraBottomMidspan.hasExtra).toBe(true);
    expect(curtailment.extraBottomMidspan.length).toBeCloseTo(3.38, 1);
  });

  it('should run full master BeamDesignEngine end-to-end with extra bars', () => {
    const output = BeamDesignEngine.design({
      memberId: 101,
      b: 300,
      D: 450,
      spanLength: 4.5,
      fck: 25,
      fy: 500,
      Mu_top: 110,
      Mu_bottom: 85,
      Vu: 95,
      governingLoadCase: 3,
    });

    expect(output.status).toBe('PASS');
    expect(output.curtailment).toBeDefined();
    expect(output.curtailment.throughTop.count).toBeGreaterThanOrEqual(2);
    expect(output.curtailment.topScheduleCallout).toBeTruthy();
    expect(output.shear.callout).toContain('2L-8mm');
    expect(output.ductility.confinementZoneLength).toBeGreaterThan(700);
    expect(output.calculationReport.sections.length).toBe(6);
  });
});
