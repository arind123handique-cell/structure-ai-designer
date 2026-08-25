import { describe, it, expect } from 'vitest';
import { ColumnDesignEngine } from '@/features/design/column/columnDesignEngine';
import { BeamDesignEngine } from '@/features/design/beam/beamDesignEngine';
import { ColumnBarArrangement } from '@/features/design/column/barArrangement';
import { BbsEngine } from '@/features/calculations/bbsEngine';
import { PDFReportGenerator } from '@/features/reports/pdfReportGenerator';

describe('Universal Rebar Selection & Global Enforcement Engine', () => {
  it('should strictly restrict column rebar options to allowed universal diameters', () => {
    // Test with only 12mm and 16mm allowed
    const allowed = [12, 16];
    const design = ColumnDesignEngine.design({
      memberId: 1,
      b: 450,
      D: 550,
      unsupportedHeight: 3.5,
      fck: 25,
      fy: 500,
      Pu: 600,
      Mux: 30,
      Muy: 25,
      allowedDiameters: allowed,
    });

    expect(design.rebar.cornerBars.diameter).toBeLessThanOrEqual(16);
    expect(design.rebar.callout).not.toContain('T20');
    expect(design.rebar.callout).not.toContain('T25');
    expect(design.rebar.callout).not.toContain('T32');
  });

  it('should lock / fail column design when 0 universal diameters are selected', () => {
    const emptyAllowed: number[] = [];
    const design = ColumnDesignEngine.design({
      memberId: 1,
      b: 450,
      D: 550,
      unsupportedHeight: 3.5,
      fck: 25,
      fy: 500,
      Pu: 600,
      Mux: 30,
      Muy: 25,
      allowedDiameters: emptyAllowed,
    });

    expect(design.status).toBe('FAIL');
    expect(design.rebar.callout).toContain('NO REBAR SELECTED (LOCKED)');
  });

  it('should lock / fail beam design when 0 universal diameters are selected', () => {
    const emptyAllowed: number[] = [];
    const design = BeamDesignEngine.design({
      memberId: 1,
      b: 300,
      D: 450,
      spanLength: 4.5,
      fck: 25,
      fy: 500,
      Mu_top: 60,
      Mu_bottom: 45,
      Vu: 50,
      allowedDiameters: emptyAllowed,
    });

    expect(design.status).toBe('FAIL');
    expect(design.topRebar.callout).toContain('NO REBAR SELECTED (LOCKED)');
  });

  it('should respect larger allowed diameters (e.g. 20, 25mm) when selected', () => {
    const heavyAllowed = [20, 25];
    const design = ColumnDesignEngine.design({
      memberId: 1,
      b: 450,
      D: 550,
      unsupportedHeight: 3.5,
      fck: 25,
      fy: 500,
      Pu: 1200,
      Mux: 80,
      Muy: 60,
      allowedDiameters: heavyAllowed,
    });

    expect(design.status).toBe('PASS');
    expect(heavyAllowed).toContain(design.rebar.cornerBars.diameter);
  });

  it('should result in exactly 0 kg of 20mm steel across BBS and PDF Report when 20mm is toggled off', () => {
    const mockModel: any = {
      nodes: new Map([[1, { id: 1, x: 0, y: 0, z: 0, isSupport: true }], [2, { id: 2, x: 0, y: 3.5, z: 0 }]]),
      members: new Map([[1, { id: 1, startNodeId: 1, endNodeId: 2, length: 3.5, classification: 'COLUMN', section: { zd: 0.45, yd: 0.55 } }]]),
      plates: new Map(),
      supports: new Map([[1, { nodeId: 1, type: 'FIXED' }]]),
      reactions: [],
      memberForces: [],
    };

    const mockDataset: any = {
      metadata: { designSettings: { concreteGrade: 'M25', steelGrade: 'Fe500D' } },
      universalRebarSelection: {
        longitudinalDiameters: [12, 16, 25], // 20mm is OFF!
        shearTieDiameters: [8, 10],
        isConfigured: true,
      },
    };

    const bbs = BbsEngine.generateBuildingBbs(mockModel, mockDataset);
    expect(bbs.byCategoryDiameterMatrix['COLUMN']?.[20] || 0).toBe(0);
    expect(bbs.byCategoryDiameterMatrix['BEAM']?.[20] || 0).toBe(0);
    expect(bbs.byCategoryDiameterMatrix['PILE_CAP']?.[20] || 0).toBe(0);

    const pdfCalc = PDFReportGenerator.calculateAllComponentDesigns(mockModel, mockDataset.metadata.designSettings, mockDataset);
    expect(pdfCalc.grandTotals.dia20).toBe(0);
  });
});
