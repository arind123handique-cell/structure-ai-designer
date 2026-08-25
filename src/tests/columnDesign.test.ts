import { describe, it, expect } from 'vitest';
import { IS456ColumnAxial } from '@/features/codes/is456/columnAxial';
import { IS456ColumnBiaxial } from '@/features/codes/is456/columnBiaxial';
import { ColumnDesignEngine } from '@/features/design/column/columnDesignEngine';
import { ColumnBarArrangement } from '@/features/design/column/barArrangement';
import { ColumnAutoFixEngine } from '@/features/design/column/columnAutoFixEngine';

describe('IS 456 & IS 13920 Column Design Engine', () => {
  it('should calculate minimum eccentricity emin according to IS 456 Cl. 25.4', () => {
    const emin1 = IS456ColumnAxial.calculateEmin(3000, 450);
    expect(emin1).toBe(21.0);

    const emin2 = IS456ColumnAxial.calculateEmin(2500, 300);
    expect(emin2).toBe(20.0);
  });

  it('should calculate Bresler exponent alpha_n linearly between 1.0 and 2.0', () => {
    expect(IS456ColumnAxial.calculateAlphaN(100, 1000)).toBe(1.0);
    expect(IS456ColumnAxial.calculateAlphaN(500, 1000)).toBe(1.5);
    expect(IS456ColumnAxial.calculateAlphaN(900, 1000)).toBe(2.0);
  });

  it('should check biaxial interaction using Bresler method', () => {
    const result = IS456ColumnBiaxial.checkBiaxial({
      b: 450,
      D: 550,
      fck: 25,
      fy: 500,
      Pu: 800,
      Mux: 60,
      Muy: 35,
      pt: 1.5,
    });

    expect(result.status).toBe('PASS');
    expect(result.interactionRatio).toBeLessThanOrEqual(1.0);
    expect(result.Mux1).toBeGreaterThan(100);
    expect(result.Muy1).toBeGreaterThan(80);
  });

  it('should auto-configure a practical constructable rebar arrangement (8 bars, non-congested spacing)', () => {
    const b = 450;
    const D = 550;
    const Asc_req = 2000; // mm2 (~0.81% of Ag)

    const rebar = ColumnBarArrangement.selectBars(Asc_req, b, D);

    expect(rebar.totalBars).toBeLessThanOrEqual(12);
    expect(rebar.totalArea).toBeGreaterThanOrEqual(Asc_req);
    expect(rebar.isConfinementCompliant).toBe(true);
    expect(rebar.spacingX).toBeLessThanOrEqual(300);
    expect(rebar.spacingY).toBeLessThanOrEqual(300);
    expect(rebar.spacingX).toBeGreaterThanOrEqual(120); // Spacing is not congested
  });

  it('should run full master ColumnDesignEngine end-to-end with practical rebar and available options', () => {
    const output = ColumnDesignEngine.design({
      memberId: 53,
      b: 450,
      D: 550,
      unsupportedHeight: 3.2,
      fck: 25,
      fy: 500,
      Pu: 750,
      Mux: 55,
      Muy: 30,
      governingLoadCase: 14,
    });

    expect(output.status).toBe('PASS');
    expect(output.rebar.callout).toBeTruthy();
    expect(output.rebar.totalBars).toBeGreaterThanOrEqual(4);
    expect(output.availableRebarOptions.length).toBeGreaterThan(0);
    expect(output.ductility.recommendedTieCallout).toContain('ties');
    expect(output.calculationReport.sections.length).toBe(4);
  });

  it('should strictly restrict rebar selection to user-selected allowed diameters (e.g. 12mm and 16mm only)', () => {
    const b = 300;
    const D = 450;
    const Ag = b * D;
    const Asc_req = 0.008 * Ag; // 1080 mm2

    const allowed = [12, 16];
    const rebar = ColumnBarArrangement.selectBars(Asc_req, b, D, 40, allowed);

    expect(allowed.includes(rebar.cornerBars.diameter)).toBe(true);
    if (rebar.faceBars) {
      expect(allowed.includes(rebar.faceBars.diameter)).toBe(true);
    }
    expect(rebar.callout).not.toContain('T20');
    expect(rebar.callout).not.toContain('T25');
    expect(rebar.callout).not.toContain('T32');
  });

  it('should produce economical mixed rebar combinations near 0.8% to 1.2% pt', () => {
    const b = 300;
    const D = 450;
    const Ag = b * D;
    const Asc_req = 0.008 * Ag; // 1080 mm2

    const options = ColumnBarArrangement.getAvailableOptions(Asc_req, b, D, 40, [12, 16, 20]);
    const mixedEco = options.find((o) => o.isMixed && o.pt_prov >= 0.8 && o.pt_prov <= 1.2);

    expect(mixedEco).toBeDefined();
    expect(mixedEco?.callout).toContain('+');
    expect(mixedEco?.pt_prov).toBeGreaterThanOrEqual(0.8);
    expect(mixedEco?.pt_prov).toBeLessThanOrEqual(1.2);
  });

  it('should reduce steel demand when rotated 90 degrees if major moment aligns with depth', () => {
    // Column with high moment along Y-axis:
    const Pu = 1000;
    const Mux = 30;
    const Muy = 120; // High moment against minor axis of 300x600

    const normal = ColumnDesignEngine.design({
      memberId: 101,
      b: 300,
      D: 600,
      unsupportedHeight: 3.2,
      fck: 25,
      fy: 500,
      Pu,
      Mux,
      Muy,
      allowedDiameters: [12, 16, 20, 25],
    });

    const rotated = ColumnDesignEngine.design({
      memberId: 101,
      b: 600,
      D: 300,
      unsupportedHeight: 3.2,
      fck: 25,
      fy: 500,
      Pu,
      Mux: Muy, // major moment now acts along 600mm depth
      Muy: Mux,
      allowedDiameters: [12, 16, 20, 25],
    });

    // Rotated column has much higher moment resistance along the major axis
    expect(rotated.rebar.pt_prov).toBeLessThanOrEqual(normal.rebar.pt_prov);
  });

  it('should automatically diagnose failing column and provide 90-degree rotation or up-sized section auto-fix recommendation', () => {
    // Failing column due to orientation mismatch: 450x600 with high M_uy
    const failingMember: any = {
      id: 55,
      classification: 'COLUMN',
      length: 3.2,
      startNodeId: 55,
      endNodeId: 155,
      section: { zd: 0.45, yd: 0.60, name: '450x600 mm' },
    };

    const mockModel: any = {
      memberForces: [
        { memberId: 55, axial: -988, mz: 35, my: 180, loadCaseId: 14 },
      ],
      reactions: [],
      supports: new Map(),
    };

    const initialDesign = ColumnDesignEngine.design({
      memberId: 55,
      b: 450,
      D: 600,
      unsupportedHeight: 3.2,
      fck: 25,
      fy: 500,
      Pu: 988,
      Mux: 35,
      Muy: 180,
      governingLoadCase: 14,
      allowedDiameters: [12, 16, 20, 25],
    });

    const rec = ColumnAutoFixEngine.diagnoseAndSolve(
      failingMember,
      mockModel,
      initialDesign,
      25,
      500,
      40,
      [12, 16, 20, 25]
    );

    expect(rec.memberId).toBe(55);
    expect(rec.expectedIR).toBeLessThanOrEqual(0.88);
    expect(rec.recommendedSection.name).toBeTruthy();
    expect(rec.reason).toBeTruthy();
  });
});

