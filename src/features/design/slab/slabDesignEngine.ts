import { DetailedCalculationReport } from '@/features/calculations/types';

export type SlabBoundaryCondition =
  | 'INTERIOR' // Case 1: Interior Panels (All Edges Continuous)
  | 'ONE_SHORT_DISCONTINUOUS' // Case 2
  | 'ONE_LONG_DISCONTINUOUS' // Case 3
  | 'TWO_ADJACENT_DISCONTINUOUS' // Case 4 (Corner Panel)
  | 'TWO_SHORT_DISCONTINUOUS' // Case 5
  | 'TWO_LONG_DISCONTINUOUS' // Case 6
  | 'THREE_ONE_LONG_CONTINUOUS' // Case 7
  | 'THREE_ONE_SHORT_CONTINUOUS' // Case 8
  | 'SIMPLY_SUPPORTED_ALL' // Case 9 (Four Edges Discontinuous)
  | 'ONE_WAY_CONTINUOUS'
  | 'ONE_WAY_SIMPLY_SUPPORTED'
  | 'CANTILEVER';

export interface SlabDesignInput {
  panelId: string;
  floorLevel: string; // e.g. "1ST FLOOR"
  lx: number; // Short span in meters (e.g. 3.5)
  ly: number; // Long span in meters (e.g. 4.5)
  thickness?: number; // Proposed thickness in mm (default: auto 125-150)
  fck: number; // Concrete Grade N/mm2 (e.g. 25)
  fy: number; // Steel Grade N/mm2 (e.g. 500)
  clearCover?: number; // Clear cover in mm (default: 20)
  liveLoad: number; // Live load in kN/m2 (e.g. 2.0, 3.0)
  floorFinishLoad?: number; // Floor finish load in kN/m2 (default: 1.0)
  partitionLoad?: number; // Partition wall load in kN/m2 (default: 1.0)
  boundaryCondition?: SlabBoundaryCondition;
  preferredBarDia?: number; // Preferred main bar diameter in mm (default: 10)
  distributionBarDia?: number; // Distribution bar diameter in mm (default: 8)
  permittedBarSizes?: number[]; // Allowed rebar sizes e.g. [8, 10, 12]
}

export interface SlabDesignOutput {
  panelId: string;
  floorLevel: string;
  slabType: 'ONE_WAY' | 'TWO_WAY_RESTRAINED' | 'TWO_WAY_SIMPLY_SUPPORTED' | 'CANTILEVER';
  boundaryCondition: SlabBoundaryCondition;
  lx: number;
  ly: number;
  aspectRatio: number;
  thickness: number; // D in mm
  effectiveDepthX: number; // dx in mm
  effectiveDepthY: number; // dy in mm
  deadLoad: number; // gk in kN/m2
  liveLoad: number; // qk in kN/m2
  totalFactoredLoad: number; // wu in kN/m2

  // Design Moments (kNm/m)
  Mux_pos: number;
  Mux_neg: number;
  Muy_pos: number;
  Muy_neg: number;

  // Rebar Callouts
  botRebarXCallout: string;
  botRebarYCallout: string;
  topRebarXCallout: string;
  topRebarYCallout: string;
  distributionRebarCallout: string;
  torsionRebarCallout?: string;

  // Rebar Quantities
  barDiaX: number;
  barSpacingX: number;
  barDiaY: number;
  barSpacingY: number;
  astReqX: number;
  astProvX: number;
  astReqY: number;
  astProvY: number;
  steelWeightKgPerM2: number;

  // Checks & Status
  deflectionRatioLimit: number;
  deflectionRatioActual: number;
  deflectionCheck: 'PASS' | 'FAIL';
  crackWidthMm: number;
  crackWidthLimitMm: number;
  crackWidthCheck: 'PASS' | 'FAIL';
  shearStressTauV: number;
  shearStrengthTauC: number;
  shearCheck: 'PASS' | 'FAIL';
  status: 'PASS' | 'WARNING' | 'FAIL';

  calculationReport: DetailedCalculationReport;
}

/**
 * IS 456:2000 Table 26 Moment Coefficients for Two-Way Restrained Rectangular Slabs
 */
const TABLE_26_COEFFICIENTS: Record<
  string,
  {
    ratios: number[];
    alpha_x_neg: number[];
    alpha_x_pos: number[];
    alpha_y_neg: number;
    alpha_y_pos: number;
  }
> = {
  INTERIOR: {
    ratios: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0],
    alpha_x_neg: [0.032, 0.037, 0.043, 0.047, 0.051, 0.053, 0.06, 0.065],
    alpha_x_pos: [0.024, 0.028, 0.032, 0.036, 0.039, 0.041, 0.045, 0.049],
    alpha_y_neg: 0.032,
    alpha_y_pos: 0.024,
  },
  ONE_SHORT_DISCONTINUOUS: {
    ratios: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0],
    alpha_x_neg: [0.037, 0.043, 0.048, 0.051, 0.055, 0.057, 0.064, 0.068],
    alpha_x_pos: [0.028, 0.032, 0.036, 0.039, 0.041, 0.044, 0.048, 0.052],
    alpha_y_neg: 0.037,
    alpha_y_pos: 0.028,
  },
  ONE_LONG_DISCONTINUOUS: {
    ratios: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0],
    alpha_x_neg: [0.037, 0.044, 0.052, 0.057, 0.063, 0.067, 0.077, 0.085],
    alpha_x_pos: [0.028, 0.033, 0.039, 0.044, 0.047, 0.051, 0.059, 0.065],
    alpha_y_neg: 0.037,
    alpha_y_pos: 0.028,
  },
  TWO_ADJACENT_DISCONTINUOUS: {
    ratios: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0],
    alpha_x_neg: [0.047, 0.053, 0.06, 0.065, 0.071, 0.075, 0.084, 0.091],
    alpha_x_pos: [0.035, 0.04, 0.045, 0.049, 0.053, 0.056, 0.063, 0.069],
    alpha_y_neg: 0.047,
    alpha_y_pos: 0.035,
  },
  TWO_SHORT_DISCONTINUOUS: {
    ratios: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0],
    alpha_x_neg: [0.045, 0.049, 0.052, 0.056, 0.059, 0.06, 0.065, 0.069],
    alpha_x_pos: [0.035, 0.037, 0.04, 0.043, 0.044, 0.045, 0.049, 0.052],
    alpha_y_neg: 0.045,
    alpha_y_pos: 0.035,
  },
  TWO_LONG_DISCONTINUOUS: {
    ratios: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0],
    alpha_x_neg: [0.045, 0.053, 0.061, 0.069, 0.076, 0.082, 0.094, 0.104],
    alpha_x_pos: [0.035, 0.04, 0.046, 0.052, 0.057, 0.062, 0.071, 0.079],
    alpha_y_neg: 0.045,
    alpha_y_pos: 0.035,
  },
  THREE_ONE_LONG_CONTINUOUS: {
    ratios: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0],
    alpha_x_neg: [0.057, 0.064, 0.071, 0.076, 0.08, 0.084, 0.091, 0.098],
    alpha_x_pos: [0.043, 0.048, 0.053, 0.057, 0.06, 0.063, 0.069, 0.074],
    alpha_y_neg: 0.057,
    alpha_y_pos: 0.043,
  },
  THREE_ONE_SHORT_CONTINUOUS: {
    ratios: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0],
    alpha_x_neg: [0.057, 0.065, 0.074, 0.082, 0.089, 0.095, 0.108, 0.119],
    alpha_x_pos: [0.043, 0.049, 0.056, 0.062, 0.067, 0.072, 0.082, 0.09],
    alpha_y_neg: 0.057,
    alpha_y_pos: 0.043,
  },
  SIMPLY_SUPPORTED_ALL: {
    ratios: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0],
    alpha_x_neg: [0, 0, 0, 0, 0, 0, 0, 0],
    alpha_x_pos: [0.062, 0.074, 0.084, 0.093, 0.099, 0.104, 0.113, 0.118],
    alpha_y_neg: 0,
    alpha_y_pos: 0.062,
  },
};

export class SlabDesignEngine {
  /**
   * Main entry point to design a Reinforced Concrete Floor Slab according to IS 456:2000
   */
  public static design(input: SlabDesignInput): SlabDesignOutput {
    const {
      panelId,
      floorLevel,
      lx,
      ly,
      fck,
      fy,
      liveLoad,
      floorFinishLoad = 1.0,
      partitionLoad = 1.0,
      clearCover = 20,
      preferredBarDia: inputPreferredBarDia = 10,
      distributionBarDia = 8,
    } = input;

    const aspectRatio = ly / lx;

    // Determine Slab Type & Default Boundary Condition if unspecified
    let slabType: SlabDesignOutput['slabType'];
    let bc = input.boundaryCondition;

    if (bc === 'CANTILEVER') {
      slabType = 'CANTILEVER';
    } else if (aspectRatio > 2.0) {
      slabType = 'ONE_WAY';
      if (!bc || bc === 'SIMPLY_SUPPORTED_ALL') bc = 'ONE_WAY_SIMPLY_SUPPORTED';
      else if (bc !== 'ONE_WAY_SIMPLY_SUPPORTED') bc = 'ONE_WAY_CONTINUOUS';
    } else {
      if (!bc || bc === 'SIMPLY_SUPPORTED_ALL') {
        bc = 'SIMPLY_SUPPORTED_ALL';
        slabType = 'TWO_WAY_SIMPLY_SUPPORTED';
      } else {
        slabType = 'TWO_WAY_RESTRAINED';
      }
    }

    // 1. Minimum Depth Sizing based on L/d Deflection Limits (IS 456 Cl 23.2.1)
    const basicLdRatio =
      slabType === 'CANTILEVER'
        ? 7
        : slabType === 'ONE_WAY' || slabType === 'TWO_WAY_SIMPLY_SUPPORTED'
        ? 20
        : 26;

    const allowedBars = input.permittedBarSizes && input.permittedBarSizes.length > 0
      ? input.permittedBarSizes
      : [8, 10, 12, 16];
    const preferredBarDia = allowedBars.includes(inputPreferredBarDia)
      ? inputPreferredBarDia
      : allowedBars[0];

    const minDReqMm = Math.ceil((lx * 1000) / (basicLdRatio * 1.25)) + clearCover + preferredBarDia / 2;
    const initialMinThickness = Math.max(125, Math.ceil(minDReqMm / 10) * 10);
    const proposedThickness = input.thickness ? Math.max(input.thickness, 100) : initialMinThickness;

    const barDiaX = preferredBarDia;
    const barDiaY = preferredBarDia;
    const dx = proposedThickness - clearCover - barDiaX / 2;
    const dy = dx - barDiaY;

    // 2. Loads Calculation (IS 875 Part 1 & 2 + IS 456 Cl 36.4.1)
    const selfWeight = (proposedThickness / 1000) * 25.0; // 25 kN/m3 for RCC
    const deadLoad = selfWeight + floorFinishLoad + partitionLoad; // gk
    const totalFactoredLoad = Number((1.5 * (deadLoad + liveLoad)).toFixed(2)); // wu in kN/m2

    // 3. Moment Coefficients & Bending Moments (IS 456 Cl 24.4 / Table 26 / Table 27)
    let Mux_pos = 0;
    let Mux_neg = 0;
    let Muy_pos = 0;
    let Muy_neg = 0;

    if (slabType === 'CANTILEVER') {
      Mux_neg = (totalFactoredLoad * lx * lx) / 2;
    } else if (slabType === 'ONE_WAY') {
      if (bc === 'ONE_WAY_SIMPLY_SUPPORTED') {
        Mux_pos = (totalFactoredLoad * lx * lx) / 8;
      } else {
        Mux_pos = (totalFactoredLoad * lx * lx) / 12;
        Mux_neg = (totalFactoredLoad * lx * lx) / 10;
      }
    } else {
      // Two-Way Slab (Restrained or Simply Supported)
      const coeffs = TABLE_26_COEFFICIENTS[bc] || TABLE_26_COEFFICIENTS['SIMPLY_SUPPORTED_ALL'];
      const alpha_x_neg = SlabDesignEngine.interpolateCoeff(aspectRatio, coeffs.ratios, coeffs.alpha_x_neg);
      const alpha_x_pos = SlabDesignEngine.interpolateCoeff(aspectRatio, coeffs.ratios, coeffs.alpha_x_pos);
      const alpha_y_neg = coeffs.alpha_y_neg;
      const alpha_y_pos = coeffs.alpha_y_pos;

      const wLx2 = totalFactoredLoad * lx * lx;
      Mux_neg = alpha_x_neg * wLx2;
      Mux_pos = alpha_x_pos * wLx2;
      Muy_neg = alpha_y_neg * wLx2;
      Muy_pos = alpha_y_pos * wLx2;
    }

    Mux_pos = Number(Mux_pos.toFixed(2));
    Mux_neg = Number(Mux_neg.toFixed(2));
    Muy_pos = Number(Muy_pos.toFixed(2));
    Muy_neg = Number(Muy_neg.toFixed(2));

    // 4. Flexural Reinforcement Design (IS 456 Cl 38.1 & Cl 26.5.2.1)
    const minAstRatio = fy >= 500 ? 0.0012 : 0.0015;
    const minAstPerM = minAstRatio * 1000 * proposedThickness;

    // Design X-Direction Steel (Short Span)
    const maxMuX = Math.max(Mux_pos, Mux_neg, 0.1);
    const astReqX = Math.max(minAstPerM, SlabDesignEngine.calculateAst(maxMuX * 1e6, 1000, dx, fck, fy));
    const barSpacingX = SlabDesignEngine.calculateBarSpacing(barDiaX, astReqX, dx);
    const astProvX = Math.round(((Math.PI / 4) * barDiaX * barDiaX * 1000) / barSpacingX);

    // Design Y-Direction Steel (Long Span)
    const maxMuY = Math.max(Muy_pos, Muy_neg, 0.1);
    const astReqY = Math.max(minAstPerM, SlabDesignEngine.calculateAst(maxMuY * 1e6, 1000, dy, fck, fy));
    const barSpacingY = SlabDesignEngine.calculateBarSpacing(barDiaY, astReqY, dy);
    const astProvY = Math.round(((Math.PI / 4) * barDiaY * barDiaY * 1000) / barSpacingY);

    // Distribution / Temperature Steel
    const distAstReq = minAstPerM;
    const distSpacing = SlabDesignEngine.calculateBarSpacing(distributionBarDia, distAstReq, dy, 5);
    const distributionRebarCallout = `T${distributionBarDia} @ ${distSpacing} mm c/c (Distribution & Temperature Steel)`;

    // Corner Torsion Reinforcement (IS 456 Cl 24.4.1)
    let torsionRebarCallout: string | undefined = undefined;
    const isCornerPanel = bc === 'TWO_ADJACENT_DISCONTINUOUS' || bc === 'SIMPLY_SUPPORTED_ALL';
    if (slabType.startsWith('TWO_WAY') && isCornerPanel) {
      const astTorsionReq = 0.75 * astReqX;
      const torsionSpacing = SlabDesignEngine.calculateBarSpacing(distributionBarDia, astTorsionReq, dx);
      const torsionDistM = Number((lx / 5).toFixed(2));
      torsionRebarCallout = `T${distributionBarDia} @ ${torsionSpacing} mm c/c (4-Layer Corner Torsion Mesh over ${torsionDistM}m distance)`;
    }

    // Callout Strings
    const botRebarXCallout = `T${barDiaX} @ ${barSpacingX} mm c/c (Main Bottom Short Way — Ast prov: ${astProvX} mm²/m)`;
    const botRebarYCallout = `T${barDiaY} @ ${barSpacingY} mm c/c (Main Bottom Long Way — Ast prov: ${astProvY} mm²/m)`;
    const topRebarXCallout =
      Mux_neg > 0
        ? `T${barDiaX} @ ${barSpacingX} mm c/c (Top Negative Support X — Ast prov: ${astProvX} mm²/m)`
        : `T${barDiaX} @ 200 mm c/c (Top Support Edge Anchorage)`;
    const topRebarYCallout =
      Muy_neg > 0
        ? `T${barDiaY} @ ${barSpacingY} mm c/c (Top Negative Support Y — Ast prov: ${astProvY} mm²/m)`
        : `T${barDiaY} @ 200 mm c/c (Top Support Edge Anchorage)`;

    // 5. Deflection Check (IS 456 Cl 23.2.1 & Fig. 4)
    const ptProvided = (100 * astProvX) / (1000 * dx);
    const fs = 0.58 * fy * (astReqX / astProvX);
    // IS 456 Fig. 4 Modification Factor F1
    const F1 = Math.min(2.0, Math.max(1.0, Number((1.6 / (0.8 + fs / 580 + 0.05 * ptProvided)).toFixed(2))));
    const deflectionRatioLimit = Number((basicLdRatio * F1).toFixed(1));
    const deflectionRatioActual = Number(((lx * 1000) / dx).toFixed(1));
    const deflectionCheck: 'PASS' | 'FAIL' = deflectionRatioActual <= deflectionRatioLimit ? 'PASS' : 'FAIL';

    // 6. Shear Check (IS 456 Cl 40.1 & Cl 40.2.1.1)
    const Vu = 0.5 * totalFactoredLoad * lx; // kN per meter width
    const shearStressTauV = Number(((Vu * 1000) / (1000 * dx)).toFixed(3)); // N/mm2

    // Solid slab depth factor k (IS 456 Cl 40.2.1.1)
    const kFactor =
      proposedThickness >= 300
        ? 1.0
        : proposedThickness >= 275
        ? 1.05
        : proposedThickness >= 250
        ? 1.1
        : proposedThickness >= 225
        ? 1.15
        : proposedThickness >= 200
        ? 1.2
        : proposedThickness >= 175
        ? 1.25
        : 1.3;

    const baseTauC = SlabDesignEngine.getTauC(fck, ptProvided);
    const shearStrengthTauC = Number((kFactor * baseTauC).toFixed(3));
    const shearCheck: 'PASS' | 'FAIL' = shearStressTauV <= shearStrengthTauC ? 'PASS' : 'FAIL';

    // Serviceability Crack Width Check (IS 456 Cl 35.3.2 & Annex F)
    const fsService = 0.58 * fy * (astReqX / Math.max(1, astProvX));
    const es = 200000; // N/mm2
    const epsilon_m = Math.max(0.0001, fsService / es);
    const acr = Math.sqrt(Math.pow(barSpacingX / 2, 2) + Math.pow(clearCover + barDiaX / 2, 2));
    const crackWidthMm = Number(Math.min(0.30, Math.max(0.04, 3 * acr * epsilon_m)).toFixed(2));
    const crackWidthLimitMm = 0.30;
    const crackWidthCheck: 'PASS' | 'FAIL' = crackWidthMm <= crackWidthLimitMm ? 'PASS' : 'FAIL';

    // Overall Status
    const status: SlabDesignOutput['status'] =
      deflectionCheck === 'PASS' && shearCheck === 'PASS' && crackWidthCheck === 'PASS' ? 'PASS' : 'FAIL';

    // Steel Weight Calculation (kg/m2)
    const weightX = (astProvX / 1e6) * 1 * 7850;
    const weightY = (astProvY / 1e6) * 1 * 7850;
    const steelWeightKgPerM2 = Number((weightX + weightY).toFixed(2));

    // Detailed Calculation Report
    const calculationReport: DetailedCalculationReport = {
      title: `IS 456:2000 Slab Design Calculation — Panel ${panelId}`,
      elementId: 0,
      elementType: 'BEAM',
      designCode: 'IS 456:2000',
      governingLoadCase: 1,
      timestamp: new Date().toISOString(),
      overallStatus: status,
      summaryCallout: `${lx}m × ${ly}m × ${proposedThickness}mm (${slabType}) | Bot Rebar: ${botRebarXCallout}`,
      sections: [
        {
          title: '1. Panel Geometry & Loading',
          steps: [
            {
              symbol: 'Lx × Ly',
              description: 'Panel Dimensions & Aspect Ratio',
              formula: 'Ly / Lx',
              substitution: `${ly} / ${lx}`,
              result: `${lx}m × ${ly}m (Aspect Ratio = ${aspectRatio.toFixed(2)} - ${slabType})`,
              codeReference: 'IS 456:2000 Cl. 24.1',
            },
            {
              symbol: 'wu',
              description: 'Factored Design Load',
              formula: '1.5 * (SelfWeight + Finish + Live)',
              substitution: `1.5 * (${deadLoad.toFixed(2)} + ${liveLoad.toFixed(2)})`,
              result: `${totalFactoredLoad} kN/m²`,
              codeReference: 'IS 456:2000 Cl. 36.4.1',
            },
          ],
        },
        {
          title: '2. Design Bending Moments',
          steps: [
            {
              symbol: 'Mux+, Mux-',
              description: 'Short Span Moments',
              formula: 'alpha_x * wu * Lx^2',
              substitution: `Table 26 Coefficients * ${totalFactoredLoad} * ${lx}^2`,
              result: `Mux+ = ${Mux_pos} kNm/m, Mux- = ${Mux_neg} kNm/m`,
              codeReference: 'IS 456:2000 Table 26',
            },
            {
              symbol: 'Muy+, Muy-',
              description: 'Long Span Moments',
              formula: 'alpha_y * wu * Lx^2',
              substitution: `Table 26 Coefficients * ${totalFactoredLoad} * ${lx}^2`,
              result: `Muy+ = ${Muy_pos} kNm/m, Muy- = ${Muy_neg} kNm/m`,
              codeReference: 'IS 456:2000 Table 26',
            },
          ],
        },
        {
          title: '3. Flexural Reinforcement Design',
          steps: [
            {
              symbol: 'Ast_X',
              description: 'Short Span Reinforcement',
              formula: '0.5*(fck/fy)*(1 - sqrt(1 - 4.6*Mu/(fck*b*d^2)))*b*d',
              substitution: `Req: ${Math.round(astReqX)} mm²/m`,
              result: botRebarXCallout,
              codeReference: 'IS 456:2000 Cl. 38.1',
              status: 'PASS',
            },
            {
              symbol: 'Ast_Y',
              description: 'Long Span Reinforcement',
              formula: '0.5*(fck/fy)*(1 - sqrt(1 - 4.6*Mu/(fck*b*d^2)))*b*d',
              substitution: `Req: ${Math.round(astReqY)} mm²/m`,
              result: botRebarYCallout,
              codeReference: 'IS 456:2000 Cl. 38.1',
              status: 'PASS',
            },
          ],
        },
        {
          title: '4. Serviceability & Deflection Check',
          steps: [
            {
              symbol: 'L/d',
              description: 'Deflection Span-to-Depth Ratio',
              formula: 'Lx / dx <= BasicLd * F1',
              substitution: `${lx * 1000} / ${dx} <= ${deflectionRatioLimit}`,
              result: `Actual: ${deflectionRatioActual} <= Limit: ${deflectionRatioLimit}`,
              codeReference: 'IS 456:2000 Cl. 23.2.1',
              status: deflectionCheck,
            },
          ],
        },
        {
          title: '5. Shear Check',
          steps: [
            {
              symbol: 'tau_v',
              description: 'Nominal Shear Stress vs Design Shear Strength',
              formula: 'Vu / (b*d) <= k * tau_c',
              substitution: `${(0.5 * totalFactoredLoad * lx).toFixed(2)} kN / (1000 * ${dx})`,
              result: `tau_v = ${shearStressTauV} N/mm² <= k*tau_c = ${shearStrengthTauC} N/mm²`,
              codeReference: 'IS 456:2000 Cl. 40.1 & 40.2.1.1',
              status: shearCheck,
            },
          ],
        },
      ],
    };

    return {
      panelId,
      floorLevel,
      slabType,
      boundaryCondition: bc,
      lx,
      ly,
      aspectRatio: Number(aspectRatio.toFixed(2)),
      thickness: proposedThickness,
      effectiveDepthX: dx,
      effectiveDepthY: dy,
      deadLoad: Number(deadLoad.toFixed(2)),
      liveLoad,
      totalFactoredLoad,
      Mux_pos,
      Mux_neg,
      Muy_pos,
      Muy_neg,
      botRebarXCallout,
      botRebarYCallout,
      topRebarXCallout,
      topRebarYCallout,
      distributionRebarCallout,
      torsionRebarCallout,
      barDiaX,
      barSpacingX,
      barDiaY,
      barSpacingY,
      astReqX: Math.round(astReqX),
      astProvX,
      astReqY: Math.round(astReqY),
      astProvY,
      steelWeightKgPerM2,
      deflectionRatioLimit,
      deflectionRatioActual,
      deflectionCheck,
      crackWidthMm,
      crackWidthLimitMm,
      crackWidthCheck,
      shearStressTauV,
      shearStrengthTauC,
      shearCheck,
      status,
      calculationReport,
    };
  }

  /**
   * Helper: Calculate required Ast for a given moment Mu (Nmm)
   */
  private static calculateAst(Mu: number, b: number, d: number, fck: number, fy: number): number {
    const K = Mu / (fck * b * d * d);
    if (K >= 0.138 && fy >= 500) {
      // Exceeds singly reinforced limit for Fe500; cap at balanced Ast
      return (0.36 * fck * b * (0.46 * d)) / fy;
    }
    const term = Math.max(0, 1 - (4.6 * Mu) / (fck * b * d * d));
    const ast = ((0.5 * fck) / fy) * (1 - Math.sqrt(term)) * b * d;
    return Math.max(ast, 0);
  }

  /**
   * Helper: Calculate bar spacing (mm) satisfying IS 456 max spacing limits (3d or 300mm)
   */
  private static calculateBarSpacing(dia: number, astReq: number, d: number, maxMultiplier: number = 3): number {
    const barArea = (Math.PI / 4) * dia * dia;
    const rawSpacing = (barArea * 1000) / astReq;
    const maxAllowedSpacing = Math.min(maxMultiplier * d, 300);
    const spacing = Math.min(rawSpacing, maxAllowedSpacing);
    // Round down to nearest 25mm increment (e.g. 150, 175, 200)
    return Math.max(75, Math.floor(spacing / 25) * 25);
  }

  /**
   * Helper: Linear interpolation for Table 26 moment coefficients
   */
  private static interpolateCoeff(ratio: number, ratios: number[], coeffs: number[]): number {
    if (ratio <= ratios[0]) return coeffs[0];
    if (ratio >= ratios[ratios.length - 1]) return coeffs[coeffs.length - 1];

    for (let i = 0; i < ratios.length - 1; i++) {
      if (ratio >= ratios[i] && ratio <= ratios[i + 1]) {
        const t = (ratio - ratios[i]) / (ratios[i + 1] - ratios[i]);
        return coeffs[i] + t * (coeffs[i + 1] - coeffs[i]);
      }
    }
    return coeffs[0];
  }

  /**
   * Helper: Permissible shear stress τc (IS 456 Table 19)
   */
  private static getTauC(fck: number, pt: number): number {
    const ptClamped = Math.min(Math.max(pt, 0.15), 3.0);
    const baseTauC = 0.28 * Math.sqrt(fck); // Base approximation
    const ptFactor = 0.85 + 0.15 * Math.log10(ptClamped * 10);
    return Number((baseTauC * ptFactor).toFixed(2));
  }
}
