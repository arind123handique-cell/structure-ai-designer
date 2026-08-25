import { IS456ColumnAxial, ColumnAxialResult } from '@/features/codes/is456/columnAxial';
import { IS456ColumnBiaxial, ColumnBiaxialResult, PMCurvePoint } from '@/features/codes/is456/columnBiaxial';
import { IS13920ColumnDuctile, ColumnDuctileResult } from '@/features/codes/is13920/columnDuctile';
import { ColumnBarArrangement, ColumnRebarOption } from './barArrangement';
import { DetailedCalculationReport } from '@/features/calculations/types';

export interface ColumnDesignInput {
  memberId: number;
  b: number; // Width in mm (e.g. 450)
  D: number; // Depth in mm (e.g. 550)
  unsupportedHeight: number; // m
  fck: number; // N/mm2 (e.g. 25)
  fy: number; // N/mm2 (e.g. 500)
  cover?: number; // mm (default: 40)
  Pu: number; // kN (Factored Axial Compression)
  Mux: number; // kNm (Major Bending Moment)
  Muy: number; // kNm (Minor Bending Moment)
  governingLoadCase?: number;
  allowedDiameters?: number[];
}

export interface ColumnDesignOutput {
  memberId: number;
  dimensions: string;
  height: number;
  factoredDemandPu: number;
  factoredDemandMux: number;
  factoredDemandMuy: number;
  axialCheck: ColumnAxialResult;
  biaxialCheck: ColumnBiaxialResult;
  rebar: ColumnRebarOption;
  availableRebarOptions: ColumnRebarOption[];
  ductility: ColumnDuctileResult;
  governingLoadCase: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  calculationReport: DetailedCalculationReport;
}

export class ColumnDesignEngine {
  public static design(input: ColumnDesignInput): ColumnDesignOutput {
    const { memberId, b, D, unsupportedHeight, fck, fy, Pu, Mux, Muy } = input;
    const cover = input.cover || 40;
    const governingLoadCase = input.governingLoadCase || 1;
    const heightMm = unsupportedHeight * 1000;

    // Strict Universal Rebar Selection Check: If 0 allowed diameters, design cannot proceed
    if (input.allowedDiameters && input.allowedDiameters.length === 0) {
      return {
        memberId,
        dimensions: `${b}x${D} mm`,
        height: unsupportedHeight,
        factoredDemandPu: Pu,
        factoredDemandMux: Mux,
        factoredDemandMuy: Muy,
        axialCheck: { status: 'FAIL', capacity: 0, demand: Pu, failureReason: 'Universal rebar selection is empty. Select at least one diameter.' } as any,
        biaxialCheck: { status: 'FAIL', interactionRatio: 9.99, summary: 'No allowed rebar diameters selected' } as any,
        rebar: {
          callout: 'NO REBAR SELECTED (LOCKED)',
          totalArea: 0,
          totalBars: 0,
          isMixed: false,
          cornerBars: { diameter: 0, count: 4, callout: 'None', area: 0 },
          spacingX: 0,
          spacingY: 0,
          isConfinementCompliant: false,
          pt_prov: 0,
        },
        availableRebarOptions: [],
        ductility: { isCompliant: false, issues: ['Universal rebar selection empty'] } as any,
        governingLoadCase,
        status: 'FAIL',
        calculationReport: {
          title: 'COLUMN DESIGN LOCKED — NO UNIVERSAL REBARS SELECTED',
          sections: [],
          isCompliant: false,
        } as any,
      };
    }

    // Minimum eccentricity check as per Cl. 25.4
    const emin_x = IS456ColumnAxial.calculateEmin(heightMm, D);
    const emin_y = IS456ColumnAxial.calculateEmin(heightMm, b);

    // Design moments accounting for minimum eccentricity
    const Mux_design = Math.max(Math.abs(Mux), (Math.abs(Pu) * emin_x) / 1000);
    const Muy_design = Math.max(Math.abs(Muy), (Math.abs(Pu) * emin_y) / 1000);

    // Iterate pt from 0.8% to 4.0% in increments of 0.2% to find optimal steel ratio
    let optimalPt = 0.8;
    let bestBiaxialResult: ColumnBiaxialResult | null = null;

    for (let testPt = 0.8; testPt <= 4.0; testPt += 0.2) {
      const biaxialResult = IS456ColumnBiaxial.checkBiaxial({
        b,
        D,
        fck,
        fy,
        Pu,
        Mux: Mux_design,
        Muy: Muy_design,
        pt: testPt,
        d_prime: cover + 10,
      });

      if (biaxialResult.interactionRatio <= 1.0) {
        optimalPt = testPt;
        bestBiaxialResult = biaxialResult;
        break;
      }
      bestBiaxialResult = biaxialResult;
    }

    if (!bestBiaxialResult) {
      bestBiaxialResult = IS456ColumnBiaxial.checkBiaxial({
        b,
        D,
        fck,
        fy,
        Pu,
        Mux: Mux_design,
        Muy: Muy_design,
        pt: 4.0,
      });
    }

    // Longitudinal Bar Arrangement (Mixed & Uniform restricted to allowed diameters)
    const Ag = b * D;
    const Asc_req = (optimalPt / 100) * Ag;
    const availableRebarOptions = ColumnBarArrangement.getAvailableOptions(Asc_req, b, D, cover, input.allowedDiameters);
    const rebar = ColumnBarArrangement.selectBars(Asc_req, b, D, cover, input.allowedDiameters);

    // Re-verify biaxial capacity with provided steel area
    const finalBiaxialCheck = IS456ColumnBiaxial.checkBiaxial({
      b,
      D,
      fck,
      fy,
      Pu,
      Mux: Mux_design,
      Muy: Muy_design,
      pt: rebar.pt_prov,
      d_prime: cover + rebar.cornerBars.diameter / 2,
    });

    // Axial capacity check
    const axialCheck = IS456ColumnAxial.checkAxial({
      b,
      D,
      unsupportedLength: heightMm,
      fck,
      fy,
      Pu,
      Asc_prov: rebar.totalArea,
    });

    // IS 13920 Ductile Detailing
    const ductility = IS13920ColumnDuctile.checkDuctility({
      b,
      D,
      unsupportedHeight: heightMm,
      fck,
      fy,
      minMainBarDia: rebar.cornerBars.diameter,
      cover,
    });

    // Overall Status
    let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    if (finalBiaxialCheck.status === 'FAIL' || axialCheck.status === 'FAIL') {
      status = 'FAIL';
    } else if (finalBiaxialCheck.status === 'WARNING') {
      status = 'WARNING';
    }

    // Detailed Calculation Report
    const calculationReport = ColumnDesignEngine.buildReport(memberId, b, D, unsupportedHeight, fck, fy, Pu, Mux_design, Muy_design, emin_x, emin_y, heightMm, Ag, rebar, ductility, finalBiaxialCheck, axialCheck, status, governingLoadCase, cover);

    return {
      memberId,
      dimensions: `${b} × ${D} mm`,
      height: unsupportedHeight,
      factoredDemandPu: Pu,
      factoredDemandMux: Mux,
      factoredDemandMuy: Muy,
      axialCheck,
      biaxialCheck: finalBiaxialCheck,
      rebar,
      availableRebarOptions,
      ductility,
      governingLoadCase,
      status,
      calculationReport,
    };
  }

  public static rebuildReportWithRebar(design: ColumnDesignOutput, newRebar: ColumnRebarOption): DetailedCalculationReport {
    const { memberId, height, factoredDemandPu, factoredDemandMux, factoredDemandMuy, axialCheck, biaxialCheck, ductility, governingLoadCase, status } = design;
    const parts = design.dimensions.replace(' mm', '').split('×').map((s) => parseInt(s.trim()));
    const b = parts[0] || 450;
    const D = parts[1] || 550;
    const fck = 25;
    const fy = 500;
    const cover = 40;
    const heightMm = height * 1000;
    const emin_x = IS456ColumnAxial.calculateEmin(heightMm, D);
    const emin_y = IS456ColumnAxial.calculateEmin(heightMm, b);
    const Mux_design = Math.max(Math.abs(factoredDemandMux), (Math.abs(factoredDemandPu) * emin_x) / 1000);
    const Muy_design = Math.max(Math.abs(factoredDemandMuy), (Math.abs(factoredDemandPu) * emin_y) / 1000);
    const Ag = b * D;

    return ColumnDesignEngine.buildReport(memberId, b, D, height, fck, fy, factoredDemandPu, Mux_design, Muy_design, emin_x, emin_y, heightMm, Ag, newRebar, ductility, biaxialCheck, axialCheck, status, governingLoadCase, cover);
  }

  private static buildReport(
    memberId: number, b: number, D: number, unsupportedHeight: number,
    fck: number, fy: number, Pu: number, Mux_design: number, Muy_design: number,
    emin_x: number, emin_y: number, heightMm: number, Ag: number,
    rebar: ColumnRebarOption, ductility: ColumnDuctileResult,
    finalBiaxialCheck: ColumnBiaxialResult, axialCheck: ColumnAxialResult,
    status: 'PASS' | 'WARNING' | 'FAIL', governingLoadCase: number, cover: number
  ): DetailedCalculationReport {
    return {
      elementId: memberId,
      elementType: 'COLUMN',
      title: `COLUMN C-${memberId} (${b} × ${D} mm) DESIGN CALCULATION SHEET`,
      designCode: 'IS 456:2000 & IS 13920:2016',
      governingLoadCase,
      timestamp: new Date().toLocaleString(),
      overallStatus: status,
      summaryCallout: `Longitudinal: ${rebar.callout} (${rebar.pt_prov}%) | Ties: ${ductility.recommendedTieCallout}`,
      sections: [
        {
          title: '1. Column Geometry & Slenderness Checks',
          steps: [
            {
              symbol: 'b × D',
              description: 'Column Dimensions',
              formula: 'b × D',
              substitution: `${b} × ${D}`,
              result: `${b} × ${D} mm`,
            },
            {
              symbol: 'H',
              description: 'Unsupported Height',
              formula: 'L',
              substitution: `${unsupportedHeight.toFixed(2)}`,
              result: `${unsupportedHeight.toFixed(2)} m (${heightMm} mm)`,
            },
            {
              symbol: 'Le/D, Le/b',
              description: 'Slenderness Ratio Check',
              formula: 'Le / D <= 12 and Le / b <= 12',
              substitution: `${axialCheck.slenderness_x} (Major), ${axialCheck.slenderness_y} (Minor)`,
              result: axialCheck.isShortColumn ? 'SHORT COLUMN (< 12)' : 'SLENDER COLUMN (> 12)',
              codeReference: 'IS 456:2000 Cl. 25.1.2',
              status: 'INFO',
            },
            {
              symbol: 'emin,x',
              description: 'Minimum Eccentricity (X-axis)',
              formula: 'max(L/500 + D/30, 20 mm)',
              substitution: `max(${heightMm}/500 + ${D}/30, 20)`,
              result: `${emin_x} mm`,
              codeReference: 'IS 456:2000 Cl. 25.4',
            },
            {
              symbol: 'emin,y',
              description: 'Minimum Eccentricity (Y-axis)',
              formula: 'max(L/500 + b/30, 20 mm)',
              substitution: `max(${heightMm}/500 + ${b}/30, 20)`,
              result: `${emin_y} mm`,
              codeReference: 'IS 456:2000 Cl. 25.4',
            },
          ],
        },
        {
          title: '2. Axial Load & Pure Axial Capacity (Puz)',
          steps: [
            {
              symbol: 'Pu',
              description: 'Design Factored Axial Load',
              formula: 'Pu',
              substitution: `${Pu.toFixed(2)}`,
              result: `${Pu.toFixed(2)} kN`,
              codeReference: 'IS 456:2000 Cl. 39.3',
            },
            {
              symbol: 'Puz',
              description: 'Pure Axial Compression Capacity',
              formula: '0.45 * fck * Ac + 0.75 * fy * Asc',
              substitution: `0.45 * ${fck} * ${(Ag - rebar.totalArea)} + 0.75 * ${fy} * ${rebar.totalArea}`,
              result: `${finalBiaxialCheck.Puz} kN`,
              codeReference: 'IS 456:2000 Cl. 39.6',
              status: Math.abs(Pu) <= finalBiaxialCheck.Puz ? 'PASS' : 'FAIL',
            },
            {
              symbol: 'Pu / Puz',
              description: 'Axial Compression Ratio',
              formula: 'Pu / Puz',
              substitution: `${Math.abs(Pu).toFixed(1)} / ${finalBiaxialCheck.Puz}`,
              result: `${(Math.abs(Pu) / finalBiaxialCheck.Puz).toFixed(3)}`,
            },
            {
              symbol: 'alpha_n',
              description: 'Bresler Biaxial Interaction Exponent',
              formula: '1.0 + [(Pu/Puz - 0.2) / 0.6]',
              substitution: `Function of Pu/Puz = ${(Math.abs(Pu) / finalBiaxialCheck.Puz).toFixed(3)}`,
              result: `${finalBiaxialCheck.alpha_n}`,
              codeReference: 'IS 456:2000 Cl. 39.6',
            },
          ],
        },
        {
          title: '3. Biaxial Bending Interaction Check (IS 456 Cl. 39.6)',
          steps: [
            {
              symbol: 'Mux, Muy',
              description: 'Factored Design Biaxial Moments',
              formula: 'max(Mu, Pu * emin)',
              substitution: `Mux = ${Mux_design.toFixed(2)}, Muy = ${Muy_design.toFixed(2)}`,
              result: `Mux = ${Mux_design.toFixed(2)} kNm, Muy = ${Muy_design.toFixed(2)} kNm`,
            },
            {
              symbol: 'Mux1',
              description: 'Uniaxial Moment Capacity about Major X-axis',
              formula: 'Interpolated from P-M Interaction Curve',
              substitution: `At Pu = ${Pu.toFixed(1)} kN`,
              result: `${finalBiaxialCheck.Mux1} kNm`,
              codeReference: 'SP:16 Chart 44 / IS 456',
            },
            {
              symbol: 'Muy1',
              description: 'Uniaxial Moment Capacity about Minor Y-axis',
              formula: 'Interpolated from P-M Interaction Curve',
              substitution: `At Pu = ${Pu.toFixed(1)} kN`,
              result: `${finalBiaxialCheck.Muy1} kNm`,
              codeReference: 'SP:16 Chart 44 / IS 456',
            },
            {
              symbol: 'IR',
              description: 'Bresler Interaction Equation Check',
              formula: '(Mux / Mux1)^alpha_n + (Muy / Muy1)^alpha_n <= 1.0',
              substitution: `(${Mux_design.toFixed(1)} / ${finalBiaxialCheck.Mux1})^${finalBiaxialCheck.alpha_n} + (${Muy_design.toFixed(1)} / ${finalBiaxialCheck.Muy1})^${finalBiaxialCheck.alpha_n}`,
              result: `${finalBiaxialCheck.interactionRatio} <= 1.0`,
              codeReference: 'IS 456:2000 Cl. 39.6',
              status: finalBiaxialCheck.interactionRatio <= 1.0 ? 'PASS' : 'FAIL',
            },
          ],
        },
        {
          title: '4. Longitudinal Reinforcement & Ductile Ties',
          steps: [
            {
              symbol: 'Asc,prov',
              description: 'Provided Longitudinal Steel',
              formula: 'Bar Schedule',
              substitution: `${rebar.callout} (${rebar.totalBars} bars)`,
              result: `${rebar.totalArea} mm² (pt = ${rebar.pt_prov}%)`,
              codeReference: 'IS 456:2000 Cl. 26.5.3.1 (0.8% - 4.0%)',
              status: rebar.pt_prov >= 0.8 && rebar.pt_prov <= 4.0 ? 'PASS' : 'WARNING',
            },
            {
              symbol: 'lo',
              description: 'Special Confining Reinforcement Length',
              formula: 'max(D, b, H/6, 450 mm)',
              substitution: `max(${D}, ${b}, ${Math.round(heightMm / 6)}, 450)`,
              result: `${ductility.lo} mm at top and bottom ends`,
              codeReference: 'IS 13920:2016 Cl. 7.6.1',
            },
            {
              symbol: 's_confine',
              description: 'Confining Tie Spacing in lo Zone',
              formula: 'min(b/4, 100 mm, 6 * db_min)',
              substitution: `min(${Math.floor(b / 4)}, 100, ${6 * rebar.cornerBars.diameter})`,
              result: `${ductility.confiningTieSpacingMax} mm c/c`,
              codeReference: 'IS 13920:2016 Cl. 7.6.1',
              status: 'PASS',
            },
            {
              symbol: 'Ties',
              description: 'Recommended Transverse Link Detailing',
              formula: 'Closed outer hoop + cross-ties',
              substitution: `${ductility.recommendedTieCallout}`,
              result: `${ductility.recommendedTieCallout}`,
              codeReference: 'IS 13920:2016 Cl. 7.6',
            },
          ],
        },
      ],
    };
  }
}
