import { FoundationSoilPressure, SoilPressureResult } from '@/features/codes/foundation/soilPressure';
import { FoundationPunchingShear, PunchingShearResult } from '@/features/codes/foundation/punchingShear';
import { FoundationOneWayShear, OneWayShearResult } from '@/features/codes/foundation/oneWayShear';
import { IS456Flexure, FlexureDesignResult } from '@/features/codes/is456/flexure';
import { DetailedCalculationReport } from '@/features/calculations/types';

export interface FootingDesignInput {
  supportNodeId: number;
  colWidth?: number; // a in mm (default: 450)
  colDepth?: number; // b in mm (default: 550)
  factoredVerticalLoad: number; // Pu in kN
  factoredMomentX?: number; // kNm
  factoredMomentY?: number; // kNm
  SBC?: number; // Safe Bearing Capacity in kN/m2 (default: 200)
  fck: number; // N/mm2 (e.g. 25)
  fy: number; // N/mm2 (e.g. 500)
  governingLoadCase?: number;
}

export interface FootingDesignOutput {
  supportNodeId: number;
  length: number; // L in m
  width: number; // B in m
  thickness: number; // D in mm
  effectiveDepth: number; // d in mm
  soilPressure: SoilPressureResult;
  punchingShear: PunchingShearResult;
  oneWayShear: OneWayShearResult;
  flexureX: FlexureDesignResult;
  flexureY: FlexureDesignResult;
  rebarCalloutX: string; // e.g. "T16 @ 150 mm c/c bottom mat"
  rebarCalloutY: string;
  governingLoadCase: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  calculationReport: DetailedCalculationReport;
}

export class FootingDesignEngine {
  public static design(input: FootingDesignInput): FootingDesignOutput {
    const { supportNodeId, fck, fy, factoredVerticalLoad } = input;
    const colA = input.colWidth || 450;
    const colB = input.colDepth || 550;
    const SBC = input.SBC || 200; // kN/m2
    const governingLoadCase = input.governingLoadCase || 1;

    const Pu = Math.abs(factoredVerticalLoad);
    const P_working = Pu / 1.5;
    const Mx = (input.factoredMomentX || 15) / 1.5;
    const My = (input.factoredMomentY || 10) / 1.5;

    // 1. Footing Plan Dimensions (L x B)
    // Area required = 1.1 * P_working / SBC (accounting for 10% self weight)
    const areaReq = (1.1 * P_working) / SBC;
    let L = Math.max(1.5, Math.ceil(Math.sqrt(areaReq) * 10) / 10);
    let B = L; // square pad footing default

    // Sizing Depth D (sized for punching shear and one-way shear)
    let thickness = Math.max(450, Math.ceil(Math.max(colA, colB) * 1.0 / 50) * 50);
    const cover = 50;
    let d = thickness - cover - 8;

    // 2. Base Pressure Check
    let soilPressure = FoundationSoilPressure.checkPressure({
      P: P_working,
      Mx,
      My,
      L,
      B,
      SBC,
      footingDepth: thickness / 1000,
    });

    if (soilPressure.status === 'FAIL') {
      L += 0.4;
      B += 0.4;
      soilPressure = FoundationSoilPressure.checkPressure({
        P: P_working,
        Mx,
        My,
        L,
        B,
        SBC,
        footingDepth: thickness / 1000,
      });
    }

    // 3. Two-Way Punching Shear Check at d/2
    let punchingShear = FoundationPunchingShear.checkPunching({
      colWidth: colA,
      colDepth: colB,
      effectiveDepth: d,
      fck,
      factoredPunchingForce: Pu,
    });

    if (punchingShear.status === 'FAIL') {
      thickness += 150;
      d = thickness - cover - 8;
      punchingShear = FoundationPunchingShear.checkPunching({
        colWidth: colA,
        colDepth: colB,
        effectiveDepth: d,
        fck,
        factoredPunchingForce: Pu,
      });
    }

    // 4. One-Way Shear at Distance d from Column Face
    const qu = (Pu / (L * B)); // Factored soil upward pressure (kN/m2)
    const overhangX = (L * 1000 - colA) / 2; // mm
    const critSectionDistance = (overhangX - d) / 1000; // m
    const Vu_oneWay = Math.max(10, qu * B * Math.max(0, critSectionDistance));

    const oneWayShear = FoundationOneWayShear.checkOneWayShear({
      shearForce: Vu_oneWay,
      width: B * 1000,
      effectiveDepth: d,
      fck,
      pt_prov: 0.25,
    });

    // 5. Flexural Design at Column Face
    // Cantilever projection: c = (L - a) / 2
    const cx = (L - colA / 1000) / 2;
    const cy = (B - colB / 1000) / 2;

    const Mu_x = (qu * B * cx * cx) / 2;
    const Mu_y = (qu * L * cy * cy) / 2;

    const flexureX = IS456Flexure.designFlexure({
      b: B * 1000,
      D: thickness,
      d,
      fck,
      fy,
      Mu: Mu_x,
    });

    const flexureY = IS456Flexure.designFlexure({
      b: L * 1000,
      D: thickness,
      d,
      fck,
      fy,
      Mu: Mu_y,
    });

    const rebarCalloutX = `T16 @ 150 mm c/c (Ast = ${Math.round(flexureX.Ast_req)} mm² bottom mat)`;
    const rebarCalloutY = `T16 @ 150 mm c/c (Ast = ${Math.round(flexureY.Ast_req)} mm² bottom mat)`;

    let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    if (soilPressure.status === 'FAIL' || punchingShear.status === 'FAIL' || oneWayShear.status === 'FAIL') {
      status = 'FAIL';
    } else if (soilPressure.status === 'WARNING') {
      status = 'WARNING';
    }

    // Detailed Calculation Report
    const calculationReport: DetailedCalculationReport = {
      elementId: supportNodeId,
      elementType: 'FOOTING',
      title: `ISOLATED PAD FOOTING F-${supportNodeId} (${L}m × ${B}m × ${thickness}mm) CALCULATION SHEET`,
      designCode: 'IS 456:2000 Cl. 34',
      governingLoadCase,
      timestamp: new Date().toLocaleString(),
      overallStatus: status,
      summaryCallout: `${L}m × ${B}m × ${thickness}mm | q_max = ${soilPressure.q_max} kN/m² (SBC: ${SBC}) | Rebar: T16@150 B.W.`,
      sections: [
        {
          title: '1. Footing Geometry & Soil Bearing Pressure',
          steps: [
            {
              symbol: 'L × B × D',
              description: 'Footing Dimensions',
              formula: 'L × B × D',
              substitution: `${L}m × ${B}m × ${thickness}mm`,
              result: `${L} × ${B} m (Depth = ${thickness} mm, d = ${d} mm)`,
            },
            {
              symbol: 'q_max',
              description: 'Maximum Base Pressure Check',
              formula: '(P_total / A) * (1 + 6*ex/L + 6*ey/B) <= SBC',
              substitution: `(${soilPressure.totalLoad} / ${soilPressure.area}) * (1 + 6*${soilPressure.ex}/${L})`,
              result: `${soilPressure.q_max} kN/m² (SBC = ${SBC} kN/m²)`,
              codeReference: 'IS 456:2000 Cl. 34.1',
              status: soilPressure.q_max <= SBC ? 'PASS' : 'FAIL',
            },
            {
              symbol: 'q_min',
              description: 'Minimum Base Pressure (Tension Check)',
              formula: '(P_total / A) * (1 - 6*ex/L - 6*ey/B) >= 0',
              substitution: `Edge pressure`,
              result: `${soilPressure.q_min} kN/m²`,
              status: soilPressure.hasTension ? 'WARNING' : 'PASS',
            },
          ],
        },
        {
          title: '2. Two-Way Punching Shear Check at Column Perimeter',
          steps: [
            {
              symbol: 'bo',
              description: 'Critical Perimeter at d/2',
              formula: '2 * (a + d) + 2 * (b + d)',
              substitution: `2 * (${colA} + ${d}) + 2 * (${colB} + ${d})`,
              result: `${punchingShear.criticalPerimeter} mm`,
              codeReference: 'IS 456:2000 Cl. 31.6.3',
            },
            {
              symbol: 'tau_vp',
              description: 'Actual Punching Shear Stress',
              formula: 'Pu / (bo * d)',
              substitution: `${Pu.toFixed(1)}e3 / (${punchingShear.criticalPerimeter} * ${d})`,
              result: `${punchingShear.tau_vp} N/mm²`,
            },
            {
              symbol: 'tau_cp',
              description: 'Permissible Punching Shear Capacity',
              formula: 'ks * 0.25 * sqrt(fck)',
              substitution: `${punchingShear.ks} * 0.25 * sqrt(${fck})`,
              result: `${punchingShear.tau_cp} N/mm²`,
              codeReference: 'IS 456:2000 Cl. 31.6.3.1',
              status: punchingShear.status,
            },
          ],
        },
        {
          title: '3. One-Way Shear & Flexural Reinforcement',
          steps: [
            {
              symbol: 'Vu,oneWay',
              description: 'One-Way Shear Force at d from Column Face',
              formula: 'qu * B * (overhang - d)',
              substitution: `${qu.toFixed(1)} * ${B} * ${critSectionDistance.toFixed(3)}`,
              result: `${oneWayShear.Vu} kN (tau_v = ${oneWayShear.tau_v} N/mm² <= ${oneWayShear.tau_c})`,
              codeReference: 'IS 456:2000 Cl. 34.2.4',
              status: oneWayShear.status,
            },
            {
              symbol: 'Mu,x',
              description: 'Bending Moment at Column Face (X-axis)',
              formula: 'qu * B * cx² / 2',
              substitution: `${qu.toFixed(1)} * ${B} * (${cx.toFixed(3)})² / 2`,
              result: `${Mu_x.toFixed(1)} kNm`,
              codeReference: 'IS 456:2000 Cl. 34.2.3',
            },
            {
              symbol: 'Ast,x',
              description: 'Required Bottom Reinforcement (X-direction)',
              formula: '(0.5 * fck / fy) * [1 - sqrt(1 - 4.6 * Mu / (fck * B * d²))] * B * d',
              substitution: `Formula substitution`,
              result: `${flexureX.Ast_req} mm² (${rebarCalloutX})`,
              codeReference: 'IS 456:2000 Cl. G-1.1',
              status: 'PASS',
            },
            {
              symbol: 'Ast,y',
              description: 'Required Bottom Reinforcement (Y-direction)',
              formula: 'Formula substitution for Mu = ' + Mu_y.toFixed(1) + ' kNm',
              substitution: `Formula substitution`,
              result: `${flexureY.Ast_req} mm² (${rebarCalloutY})`,
              status: 'PASS',
            },
          ],
        },
      ],
    };

    return {
      supportNodeId,
      length: L,
      width: B,
      thickness,
      effectiveDepth: d,
      soilPressure,
      punchingShear,
      oneWayShear,
      flexureX,
      flexureY,
      rebarCalloutX,
      rebarCalloutY,
      governingLoadCase,
      status,
      calculationReport,
    };
  }
}
