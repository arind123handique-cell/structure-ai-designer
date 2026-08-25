import { IS456Flexure, FlexureDesignResult } from '@/features/codes/is456/flexure';
import { IS456Shear, ShearDesignResult } from '@/features/codes/is456/shear';
import { IS456DevelopmentLength } from '@/features/codes/is456/developmentLength';
import { IS13920BeamDuctile, BeamDuctileResult } from '@/features/codes/is13920/beamDuctile';
import { BeamBarArrangement, RebarOption, BeamCurtailmentDetail } from './barArrangement';
import { DetailedCalculationReport } from '@/features/calculations/types';

export interface BeamDesignInput {
  memberId: number;
  b: number; // Width in mm (e.g. 300)
  D: number; // Depth in mm (e.g. 450)
  spanLength: number; // m
  fck: number; // N/mm2 (e.g. 25)
  fy: number; // N/mm2 (e.g. 500)
  cover?: number; // mm (default: 30)
  Mu_top: number; // kNm (Support Hogging Moment)
  Mu_bottom: number; // kNm (Midspan Sagging Moment)
  Vu: number; // kN (Maximum Shear Force)
  Ast_top_anl?: number; // mm² (Direct required Ast from STAAD ANL file)
  Ast_bottom_anl?: number; // mm² (Direct required Ast from STAAD ANL file)
  governingLoadCase?: number;
  allowedDiameters?: number[];
}

export interface BeamDesignOutput {
  memberId: number;
  dimensions: string;
  spanLength: number;
  effectiveDepth: number; // mm
  demandMu: number;  // kNm — factored design hogging moment demand
  demandVu: number;  // kN  — factored design shear force demand
  astTopReqAnl?: number; // mm² — from STAAD ANL file
  astBottomReqAnl?: number; // mm² — from STAAD ANL file
  flexureTop: FlexureDesignResult;
  flexureBottom: FlexureDesignResult;
  topRebar: RebarOption;
  bottomRebar: RebarOption;
  curtailment: BeamCurtailmentDetail;
  shear: ShearDesignResult;
  ductility: BeamDuctileResult;
  developmentLength: number; // mm
  governingLoadCase: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  calculationReport: DetailedCalculationReport;
}

export class BeamDesignEngine {
  public static design(input: BeamDesignInput): BeamDesignOutput {
    const { memberId, b, D, spanLength, fck, fy, Mu_top, Mu_bottom, Vu } = input;
    const cover = input.cover || 30;
    const governingLoadCase = input.governingLoadCase || 1;

    // Strict Universal Rebar Selection Check: If 0 allowed diameters, design cannot proceed
    if (input.allowedDiameters && input.allowedDiameters.length === 0) {
      return {
        memberId,
        dimensions: `${b}x${D} mm`,
        spanLength,
        effectiveDepth: D - cover - 10,
        demandMu: Math.max(Math.abs(Mu_top), Math.abs(Mu_bottom)),
        demandVu: Math.abs(Vu),
        flexureTop: { status: 'FAIL', Ast_required: 0, Ast_min: 0, Ast_max: 0, failureReason: 'No universal rebars selected' } as any,
        flexureBottom: { status: 'FAIL', Ast_required: 0, Ast_min: 0, Ast_max: 0, failureReason: 'No universal rebars selected' } as any,
        topRebar: { callout: 'NO REBAR SELECTED (LOCKED)', totalArea: 0, barCount: 0, mainDiameter: 0, layers: 1, bars: [] },
        bottomRebar: { callout: 'NO REBAR SELECTED (LOCKED)', totalArea: 0, barCount: 0, mainDiameter: 0, layers: 1, bars: [] },
        curtailment: {
          throughTop: { count: 0, diameter: 0, callout: 'None', area: 0 },
          extraTopSupport: { count: 0, diameter: 0, callout: 'None', area: 0, cutoffLength: 0, hasExtra: false },
          throughBottom: { count: 0, diameter: 0, callout: 'None', area: 0 },
          extraBottomMidspan: { count: 0, diameter: 0, callout: 'None', area: 0, startOffset: 0, length: 0, hasExtra: false },
          topScheduleCallout: 'NO REBAR SELECTED (LOCKED)',
          bottomScheduleCallout: 'NO REBAR SELECTED (LOCKED)',
          totalTopArea: 0,
          totalBottomArea: 0,
          isCrowded: false,
          minClearSpacingTop: 0,
          minClearSpacingBottom: 0,
        },
        shear: { status: 'FAIL', stirrupSpacing: 0, stirrupDiameter: 0, legs: 2, callout: 'None' } as any,
        ductility: { isCompliant: false, issues: ['Universal rebar selection empty'] } as any,
        developmentLength: 0,
        governingLoadCase,
        status: 'FAIL',
        calculationReport: {
          title: 'BEAM DESIGN LOCKED — NO UNIVERSAL REBARS SELECTED',
          sections: [],
          isCompliant: false,
        } as any,
      };
    }

    // Assumed main bar dia 20mm for initial effective depth
    const d = D - cover - 20 / 2;

    // 1. Flexure Design (Top Support Hogging)
    const flexureTop = IS456Flexure.designFlexure({
      b,
      D,
      d,
      fck,
      fy,
      Mu: Math.abs(Mu_top),
      d_prime: cover + 10,
    });

    // 2. Flexure Design (Bottom Midspan Sagging)
    const flexureBottom = IS456Flexure.designFlexure({
      b,
      D,
      d,
      fck,
      fy,
      Mu: Math.abs(Mu_bottom),
      d_prime: cover + 10,
    });

    // 3. IS 13920 Minimum Ductile Steel Calculation (Cl. 6.2.1)
    const rho_min = (0.24 * Math.sqrt(fck)) / fy;
    const Ast_min_ductile = parseFloat((rho_min * b * d).toFixed(1));

    // Target steel areas satisfying IS 456 flexure, STAAD ANL direct demand, and IS 13920 ductility
    const targetAstTop = Math.max(flexureTop.Ast_req, input.Ast_top_anl || 0, Ast_min_ductile);
    const targetAstBottom = Math.max(
      flexureBottom.Ast_req,
      input.Ast_bottom_anl || 0,
      Ast_min_ductile,
      0.5 * targetAstTop
    );

    // Practical Bar Selection
    const topRebar = BeamBarArrangement.selectBars(targetAstTop, b, cover, input.allowedDiameters);
    const bottomRebar = BeamBarArrangement.selectBars(targetAstBottom, b, cover, input.allowedDiameters);

    // Advanced Curtailment & Extra Bars Design (IS 456 Cl. 26.2.3 & SP 34)
    const curtailment = BeamBarArrangement.designCurtailment(
      targetAstTop,
      targetAstBottom,
      b,
      D,
      spanLength,
      cover,
      input.allowedDiameters
    );

    // 4. Shear Design
    const shear = IS456Shear.designShear({
      b,
      d,
      fck,
      fy,
      Vu,
      Ast_prov: curtailment.totalTopArea,
      stirrupDiameter: 8,
      legs: 2,
    });

    // 5. Development Length Ld
    const developmentLength = IS456DevelopmentLength.calculateLd(topRebar.mainDiameter, fy, fck, true, false);

    // 6. IS 13920 Ductility Checks
    const ductility = IS13920BeamDuctile.checkDuctility({
      b,
      D,
      d,
      fck,
      fy,
      Ast_top: curtailment.totalTopArea,
      Ast_bottom: curtailment.throughBottom.area,
      minBarDia: Math.min(curtailment.throughTop.diameter, curtailment.throughBottom.diameter),
    });

    // Overall Status
    let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    if (flexureTop.status === 'FAIL' || flexureBottom.status === 'FAIL' || shear.status === 'FAIL') {
      status = 'FAIL';
    } else if (ductility.status === 'WARNING') {
      status = 'WARNING';
    }

    // Generate Full Transparent Calculation Report
    const calculationReport: DetailedCalculationReport = {
      elementId: memberId,
      elementType: 'BEAM',
      title: `BEAM B-${memberId} (${b} × ${D} mm) DESIGN CALCULATION SHEET`,
      designCode: 'IS 456:2000 & IS 13920:2016',
      governingLoadCase,
      timestamp: new Date().toLocaleString(),
      overallStatus: status,
      summaryCallout: `Top: ${topRebar.callout} | Bot: ${bottomRebar.callout} | Shear: ${shear.callout}`,
      sections: [
        {
          title: '1. Section Geometry & Material Specifications',
          steps: [
            {
              symbol: 'b',
              description: 'Beam Width',
              formula: 'b',
              substitution: `${b}`,
              result: `${b} mm`,
            },
            {
              symbol: 'D',
              description: 'Overall Depth',
              formula: 'D',
              substitution: `${D}`,
              result: `${D} mm`,
            },
            {
              symbol: 'd',
              description: 'Effective Depth',
              formula: 'D - clear_cover - phi_bar / 2',
              substitution: `${D} - ${cover} - 20/2`,
              result: `${d} mm`,
              codeReference: 'IS 456:2000 Cl. 23.0',
            },
            {
              symbol: 'fck',
              description: 'Concrete Characteristic Strength',
              formula: 'fck',
              substitution: `${fck}`,
              result: `${fck} N/mm²`,
            },
            {
              symbol: 'fy',
              description: 'Steel Yield Strength',
              formula: 'fy',
              substitution: `${fy}`,
              result: `${fy} N/mm²`,
            },
          ],
        },
        {
          title: '2. Flexural Design at Support (Top Hogging Moment)',
          steps: [
            {
              symbol: 'Mu,top',
              description: 'Factored Design Hogging Moment',
              formula: 'Mu',
              substitution: `${Math.abs(Mu_top).toFixed(2)}`,
              result: `${Math.abs(Mu_top).toFixed(2)} kNm`,
              codeReference: 'IS 456:2000 Cl. 38.1',
            },
            {
              symbol: 'Mu,lim',
              description: 'Limiting Moment of Resistance',
              formula: '0.36 * fck * b * xu_max * (d - 0.42 * xu_max)',
              substitution: `0.36 * ${fck} * ${b} * ${(flexureTop.xu_max).toFixed(1)} * (${d} - 0.42 * ${(flexureTop.xu_max).toFixed(1)})`,
              result: `${flexureTop.Mu_lim} kNm`,
              codeReference: 'IS 456:2000 Cl. G-1.1',
            },
            {
              symbol: 'Ast,req',
              description: 'Required Tension Reinforcement',
              formula: '(0.5 * fck / fy) * [1 - sqrt(1 - 4.6 * Mu / (fck * b * d²))] * b * d',
              substitution: `(0.5 * ${fck} / ${fy}) * [1 - sqrt(1 - 4.6 * ${Math.abs(Mu_top).toFixed(1)}e6 / (${fck} * ${b} * ${d}²))] * ${b} * ${d}`,
              result: `${flexureTop.Ast_req} mm²`,
              codeReference: 'IS 456:2000 Cl. G-1.1',
            },
            {
              symbol: 'Ast,prov',
              description: 'Provided Top Reinforcement',
              formula: 'Bar Schedule',
              substitution: `${topRebar.callout} (${topRebar.barCount} bars)`,
              result: `${topRebar.totalArea} mm² (pt = ${((topRebar.totalArea * 100) / (b * d)).toFixed(2)}%)`,
              status: topRebar.totalArea >= flexureTop.Ast_req ? 'PASS' : 'FAIL',
            },
          ],
        },
        {
          title: '3. Flexural Design at Mid-span (Bottom Sagging Moment)',
          steps: [
            {
              symbol: 'Mu,bot',
              description: 'Factored Design Sagging Moment',
              formula: 'Mu',
              substitution: `${Math.abs(Mu_bottom).toFixed(2)}`,
              result: `${Math.abs(Mu_bottom).toFixed(2)} kNm`,
            },
            {
              symbol: 'Ast,req',
              description: 'Required Sagging Reinforcement',
              formula: '(0.5 * fck / fy) * [1 - sqrt(1 - 4.6 * Mu / (fck * b * d²))] * b * d',
              substitution: `Formula substitution`,
              result: `${flexureBottom.Ast_req} mm²`,
              codeReference: 'IS 456:2000 Cl. G-1.1',
            },
            {
              symbol: 'Ast,prov',
              description: 'Provided Bottom Reinforcement',
              formula: 'Bar Schedule',
              substitution: `${bottomRebar.callout}`,
              result: `${bottomRebar.totalArea} mm² (pt = ${((bottomRebar.totalArea * 100) / (b * d)).toFixed(2)}%)`,
              status: bottomRebar.totalArea >= flexureBottom.Ast_req ? 'PASS' : 'FAIL',
            },
          ],
        },
        {
          title: '4. Shear Reinforcement & Link Spacing',
          steps: [
            {
              symbol: 'Vu',
              description: 'Factored Shear Force',
              formula: 'Vu',
              substitution: `${Vu.toFixed(2)}`,
              result: `${Vu.toFixed(2)} kN`,
              codeReference: 'IS 456:2000 Cl. 40.1',
            },
            {
              symbol: 'tau_v',
              description: 'Nominal Shear Stress',
              formula: 'Vu / (b * d)',
              substitution: `${Vu.toFixed(2)}e3 / (${b} * ${d})`,
              result: `${shear.tau_v} N/mm²`,
              codeReference: 'IS 456:2000 Cl. 40.1',
            },
            {
              symbol: 'tau_c,max',
              description: 'Maximum Shear Stress Check',
              formula: 'Table 20 IS 456',
              substitution: `fck = ${fck}`,
              result: `${shear.tau_c_max} N/mm²`,
              codeReference: 'IS 456:2000 Table 20',
              status: shear.tau_v <= shear.tau_c_max ? 'PASS' : 'FAIL',
            },
            {
              symbol: 'tau_c',
              description: 'Design Shear Strength of Concrete',
              formula: 'Table 19 Interpolation',
              substitution: `pt = ${((topRebar.totalArea * 100) / (b * d)).toFixed(2)}%, fck = ${fck}`,
              result: `${shear.tau_c} N/mm²`,
              codeReference: 'IS 456:2000 Table 19',
            },
            {
              symbol: 'sv',
              description: 'Provided Stirrup Spacing',
              formula: 'min((0.87 * fy * Asv * d) / Vus, 0.75 * d, 300)',
              substitution: `Asv = ${shear.Asv} mm², Vus = ${shear.Vus_req} kN`,
              result: `${shear.callout}`,
              codeReference: 'IS 456:2000 Cl. 26.5.1.5',
              status: shear.status,
            },
          ],
        },
        {
          title: '5. IS 13920:2016 Seismic Ductility & Confinement',
          steps: [
            {
              symbol: 'rho_min',
              description: 'Minimum Tension Steel Ratio',
              formula: '0.24 * sqrt(fck) / fy',
              substitution: `0.24 * sqrt(${fck}) / ${fy}`,
              result: `${ductility.Ast_min_ductile} mm²`,
              codeReference: 'IS 13920:2016 Cl. 6.2.1',
              status: topRebar.totalArea >= ductility.Ast_min_ductile ? 'PASS' : 'WARNING',
            },
            {
              symbol: '2d Zone',
              description: 'Plastic Hinge Confinement Zone',
              formula: '2 * d from face of support',
              substitution: `2 * ${d}`,
              result: `${ductility.confinementZoneLength} mm`,
              codeReference: 'IS 13920:2016 Cl. 6.3.5',
            },
            {
              symbol: 's_confine',
              description: 'Maximum Hoop Spacing in 2d Zone',
              formula: 'min(d/4, 8 * db, 100 mm)',
              substitution: `min(${Math.floor(d / 4)}, ${8 * topRebar.mainDiameter}, 100)`,
              result: `${ductility.confinementHoopSpacingMax} mm c/c (First hoop at 50 mm)`,
              codeReference: 'IS 13920:2016 Cl. 6.3.5',
            },
            {
              symbol: 'Ld',
              description: 'Tension Development Length in Joint',
              formula: '(phi * 0.87 * fy) / (4 * 1.6 * tau_bd)',
              substitution: `(${topRebar.mainDiameter} * 0.87 * ${fy}) / (4 * 1.6 * 1.4)`,
              result: `${developmentLength} mm`,
              codeReference: 'IS 456:2000 Cl. 26.2.1',
            },
          ],
        },
        {
          title: '6. Bar Curtailment & Extra Bars Detailing (IS 456 Cl. 26.2.3 & SP 34)',
          steps: [
            {
              symbol: 'Top Thru',
              description: 'Continuous Top Anchor / Through Bars',
              formula: 'Min 2 corner bars full span',
              substitution: `${curtailment.throughTop.callout}`,
              result: `${curtailment.throughTop.area} mm²`,
              codeReference: 'IS 456:2000 Cl. 26.2.3.3',
            },
            {
              symbol: 'Top Extra',
              description: 'Extra Top Support Hogging Curtailment',
              formula: 'Cutoff at max(L/3, Ld) from support face',
              substitution: `${curtailment.extraTopSupport.callout} (Length = ${curtailment.extraTopSupport.cutoffLength} m)`,
              result: `${curtailment.extraTopSupport.area} mm²`,
              codeReference: 'SP 34:1987 / IS 456 Cl. 26.2.3',
            },
            {
              symbol: 'Bot Thru',
              description: 'Continuous Bottom Full-Span Bars',
              formula: 'Min 2 corner bars anchored into column Ld',
              substitution: `${curtailment.throughBottom.callout}`,
              result: `${curtailment.throughBottom.area} mm²`,
              codeReference: 'IS 13920:2016 Cl. 6.2.3',
            },
            {
              symbol: 'Bot Extra',
              description: 'Extra Bottom Midspan Sagging Curtailment',
              formula: 'Central 0.75L zone',
              substitution: `${curtailment.extraBottomMidspan.callout} (Length = ${curtailment.extraBottomMidspan.length} m)`,
              result: `${curtailment.extraBottomMidspan.area} mm²`,
              codeReference: 'SP 34:1987 / IS 456 Cl. 26.2.3',
            },
            ...(curtailment.sideFaceBars
              ? [
                  {
                    symbol: 'Side Face',
                    description: 'Side Face Skin Reinforcement (D > 750 mm)',
                    formula: '0.1% web area distributed equally on two faces',
                    substitution: `${curtailment.sideFaceBars.callout}`,
                    result: `${curtailment.sideFaceBars.area} mm²`,
                    codeReference: 'IS 456:2000 Cl. 26.5.1.6',
                  },
                ]
              : []),
          ],
        },
      ],
    };

    return {
      memberId,
      dimensions: `${b} × ${D} mm`,
      spanLength,
      effectiveDepth: d,
      demandMu: Math.abs(Mu_top),
      demandVu: Math.abs(Vu),
      astTopReqAnl: input.Ast_top_anl,
      astBottomReqAnl: input.Ast_bottom_anl,
      flexureTop,
      flexureBottom,
      topRebar,
      bottomRebar,
      curtailment,
      shear,
      ductility,
      developmentLength,
      governingLoadCase,
      status,
      calculationReport,
    };
  }
}

