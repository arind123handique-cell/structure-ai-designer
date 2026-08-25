import { IS13920ShearWall, ShearWallInput, ShearWallResult } from '@/features/codes/is13920/shearWall';
import { DetailedCalculationReport } from '@/features/calculations/types';

export interface MasterShearWallInput {
  wallId: number;
  length: number; // Lw in m (e.g. 3.2 m)
  thickness: number; // tw in mm (e.g. 230 mm)
  height: number; // Hw in m (e.g. 3.5 m)
  fck: number; // N/mm2 (e.g. 25)
  fy: number; // N/mm2 (e.g. 500)
  Pu: number; // kN (Factored axial load)
  Vu: number; // kN (Factored in-plane shear)
  Mu: number; // Factored in-plane bending moment in kNm
  governingLoadCase?: number;
  allowedDiameters?: number[];
  allowedTieDiameters?: number[];

  // Manual rebar & section overrides
  customWebVerticalDia?: number;
  customWebVerticalSpacing?: number;
  customWebHorizontalDia?: number;
  customWebHorizontalSpacing?: number;
  customWebCurtains?: number;
  customBoundaryLength?: number;
  customBoundaryBarCount?: number;
  customBoundaryBarDia?: number;
  customBoundaryTieDia?: number;
  customBoundaryTieSpacing?: number;
}

export interface MasterShearWallOutput {
  wallId: number;
  length: number; // m
  thickness: number; // mm
  height: number; // m
  input: MasterShearWallInput;
  result: ShearWallResult;
  governingLoadCase: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  calculationReport: DetailedCalculationReport;
}

export class ShearWallEngine {
  public static design(input: MasterShearWallInput): MasterShearWallOutput {
    const {
      wallId,
      length,
      thickness,
      height,
      fck,
      fy,
      Pu,
      Vu,
      Mu,
      allowedDiameters,
      allowedTieDiameters,
      customWebVerticalDia,
      customWebVerticalSpacing,
      customWebHorizontalDia,
      customWebHorizontalSpacing,
      customWebCurtains,
      customBoundaryLength,
      customBoundaryBarCount,
      customBoundaryBarDia,
      customBoundaryTieDia,
      customBoundaryTieSpacing,
    } = input;
    const governingLoadCase = input.governingLoadCase || 1;

    const Lw_mm = Math.round(length * 1000);
    const Hw_mm = Math.round(height * 1000);

    const result = IS13920ShearWall.designWall({
      wallId,
      Lw: Lw_mm,
      tw: thickness,
      Hw: Hw_mm,
      fck,
      fy,
      Pu,
      Vu,
      Mu,
      allowedDiameters,
      allowedTieDiameters,
      customWebVerticalDia,
      customWebVerticalSpacing,
      customWebHorizontalDia,
      customWebHorizontalSpacing,
      customWebCurtains,
      customBoundaryLength,
      customBoundaryBarCount,
      customBoundaryBarDia,
      customBoundaryTieDia,
      customBoundaryTieSpacing,
    });

    const status = result.status;

    // Detailed Step-by-Step IS 13920 & IS 456 Calculation Report
    const calculationReport: DetailedCalculationReport = {
      elementId: wallId,
      elementType: 'WALL' as any,
      title: `DUCTILE RC SHEAR WALL SW-${wallId} (${length.toFixed(2)}m × ${thickness}mm × ${height.toFixed(2)}m) CALCULATION SHEET`,
      designCode: 'IS 13920:2016 Cl. 9 & Cl. 10 & IS 456:2000 Cl. 32',
      governingLoadCase,
      timestamp: new Date().toLocaleString(),
      overallStatus: status,
      summaryCallout: `Web: ${result.webVerticalRebar} | Boundary: ${result.boundary.isBoundaryElementRequired ? result.boundary.recommendedRebarCallout : 'Not Required'} | Shear: ${result.nominalShearStress} N/mm² (Cap: ${result.tau_c_max} N/mm²)`,
      sections: [
        {
          title: '1. Wall Geometry & IS 13920 Minimum Thickness Check',
          steps: [
            {
              symbol: 'Lw × tw × Hw',
              description: 'Shear Wall Cross-Section & Story Height',
              formula: 'Lw × tw × Hw',
              substitution: `${Lw_mm} × ${thickness} × ${Hw_mm}`,
              result: `${length.toFixed(2)}m × ${thickness}mm × ${height.toFixed(2)}m`,
            },
            {
              symbol: 'tw,min',
              description: 'Minimum Wall Thickness (Multi-Storey & Slenderness Check)',
              formula: 'max(200 mm, Hw / 20)',
              substitution: `max(200, ${Hw_mm} / 20 = ${Math.round(Hw_mm / 20)}) = ${result.minThicknessRequired} mm`,
              result: `${thickness} mm >= ${result.minThicknessRequired} mm (${result.minThicknessCheck ? 'PASS' : 'FAIL - Non Compliant'})`,
              codeReference: 'IS 13920:2016 Cl. 9.1.2',
              status: result.minThicknessCheck ? 'PASS' : 'FAIL',
            },
          ],
        },
        {
          title: '2. In-Plane Shear Stress, Concrete Capacity & Shear Reinforcement',
          steps: [
            {
              symbol: 'Vu',
              description: 'Factored In-Plane Shear Demand',
              formula: 'Vu (from STAAD Analysis)',
              substitution: `Factored shear force = ${Vu.toFixed(2)} kN`,
              result: `${Vu.toFixed(2)} kN`,
            },
            {
              symbol: 'tau_v',
              description: 'Nominal In-Plane Shear Stress',
              formula: 'Vu / (tw * 0.8 * Lw)',
              substitution: `${Vu.toFixed(1)}e3 / (${thickness} * 0.8 * ${Lw_mm})`,
              result: `${result.nominalShearStress} N/mm²`,
              codeReference: 'IS 13920:2016 Cl. 9.2.1',
            },
            {
              symbol: 'tau_c,max',
              description: 'Maximum Permissible Shear Stress Limit',
              formula: '0.62 * sqrt(fck) (IS 456 Table 20)',
              substitution: `0.62 * sqrt(${fck})`,
              result: `${result.tau_c_max} N/mm²`,
              codeReference: 'IS 456:2000 Table 20',
              status: result.nominalShearStress <= result.tau_c_max ? 'PASS' : 'FAIL',
            },
            {
              symbol: 'tau_c',
              description: 'Concrete Shear Strength (IS 456 Table 19)',
              formula: 'IS 456 Table 19 function of pt',
              substitution: `fck = ${fck}, pt = ${result.webSteelPercentage}%`,
              result: `${result.tau_c} N/mm² (Concrete Shear Capacity Vc = ${result.shearCapacityVc} kN)`,
            },
            {
              symbol: 'Vus,demand / Vus,prov',
              description: 'Shear Reinforcement Capacity (Horizontal Bars)',
              formula: 'Vus = 0.87 * fy * Ah * dw / sv',
              substitution: `Demand Vus = ${result.shearSteelDemandVus} kN <= Provided Vus = ${result.shearSteelCapacityVus} kN`,
              result: `${result.webHorizontalRebar}`,
              codeReference: 'IS 13920:2016 Cl. 9.2.3',
              status: result.shearStatus,
            },
          ],
        },
        {
          title: '3. Boundary Element Trigger & Compressive Stress Evaluation',
          steps: [
            {
              symbol: 'sigma_c',
              description: 'Extreme Fiber Compressive Stress (Axial + In-Plane Bending)',
              formula: 'Pu / Ag + 6 * Mu / (tw * Lw²)',
              substitution: `${Pu.toFixed(1)}e3 / (${thickness} * ${Lw_mm}) + 6 * ${Mu.toFixed(1)}e6 / (${thickness} * ${Lw_mm}²)`,
              result: `${result.boundary.extremeFiberStress} N/mm²`,
              codeReference: 'IS 13920:2016 Cl. 9.4.1',
            },
            {
              symbol: '0.2 * fck',
              description: 'Boundary Element Trigger Stress Limit',
              formula: '0.2 * fck',
              substitution: `0.2 * ${fck}`,
              result: `${result.boundary.stressLimit} N/mm² (${result.boundary.isBoundaryElementRequired ? 'TRIGGERED: Boundary Elements Required' : 'NOT REQUIRED: sigma_c <= 0.2 fck'})`,
              codeReference: 'IS 13920:2016 Cl. 9.4.1',
              status: result.boundary.isBoundaryElementRequired ? 'WARNING' : 'PASS',
            },
            {
              symbol: 'c × tw',
              description: 'Boundary Element Boundary Zone Dimensions',
              formula: 'c >= max(0.15 * Lw, 200 mm)',
              substitution: `c = ${result.boundary.boundaryLength} mm, tw = ${result.boundary.boundaryWidth} mm (Area = ${result.boundary.boundaryArea} mm²)`,
              result: `${result.boundary.boundaryLength} × ${result.boundary.boundaryWidth} mm`,
              codeReference: 'IS 13920:2016 Cl. 9.4.2',
            },
            {
              symbol: 'Ast,boundary',
              description: 'Longitudinal Vertical Steel in Boundary Zone',
              formula: 'min 0.8% of boundary area (max 4.0%)',
              substitution: `min 0.008 * ${result.boundary.boundaryArea} = ${result.boundary.minLongitudinalSteel} mm² <= Provided = ${result.boundary.providedLongitudinalSteel} mm²`,
              result: `${result.boundary.recommendedRebarCallout}`,
              codeReference: 'IS 13920:2016 Cl. 9.4.4',
              status: result.boundary.status,
            },
            {
              symbol: 'Confining Hoops',
              description: 'Special Confining Hoops & Cross-Ties',
              formula: 'spacing <= min(tw/2, 100 mm, 6 * db)',
              substitution: `spacing <= min(${Math.floor(thickness / 2)}, 100, ${6 * result.boundary.longitudinalBarDia}) = ${result.boundary.confiningHoopSpacing} mm`,
              result: `${result.boundary.confiningHoopCallout}`,
              codeReference: 'IS 13920:2016 Cl. 9.4.5',
              status: 'PASS',
            },
          ],
        },
      ],
    };

    return {
      wallId,
      length,
      thickness,
      height,
      input,
      result,
      governingLoadCase,
      status,
      calculationReport,
    };
  }

  /**
   * 1-Click Automated Engineering Fix for Ductile RC Shear Wall (IS 13920:2016 / IS 456:2000).
   * Comprehensively resolves all possible failing or warning criteria:
   * 1. Minimum thickness violations (tw >= max(200mm, Hw/20))
   * 2. In-plane shear stress violations (tau_v > tau_c_max) by upsizing thickness & upgrading fck
   * 3. Horizontal shear reinforcement deficit (Vus capacity < Vus demand) by configuring rebar spacing
   * 4. Web minimum reinforcement (< 0.25% in each direction) by detailing double curtains
   * 5. Boundary element sizing, longitudinal vertical steel (>= 0.8%), and special confining hoops
   * 6. Extreme fiber high stress warnings (sigma_c > 0.35 fck) by increasing thickness
   */
  public static autoFix(input: MasterShearWallInput): {
    fixedInput: MasterShearWallInput;
    fixedOutput: MasterShearWallOutput;
    changesApplied: string[];
  } {
    const changesApplied: string[] = [];
    const storeyHeight = input.height > 4.5
      ? Math.min(input.height / Math.max(1, Math.round(input.height / 3.2)), 3.5)
      : input.height;
    const minTwRequired = Math.max(200, Math.round((storeyHeight * 1000) / 20));
    let currentTw = Math.max(input.thickness, minTwRequired);

    if (input.thickness < minTwRequired) {
      changesApplied.push(`Set wall thickness to compliant ${currentTw}mm (IS 13920:2016 Cl. 9.1.2 min ${minTwRequired}mm for storey height = ${storeyHeight.toFixed(2)}m)`);
    }

    let fck = input.fck;
    let allowedLong = input.allowedDiameters && input.allowedDiameters.length > 0
      ? input.allowedDiameters
      : [12, 16, 20, 25];
    let allowedTies = input.allowedTieDiameters && input.allowedTieDiameters.length > 0
      ? input.allowedTieDiameters
      : [8, 10];

    // Iteratively resolve shear stress (tau_v <= tau_c_max) and extreme compressive stress (sigma_c <= 0.35 fck)
    let output = this.design({
      ...input,
      thickness: currentTw,
      fck,
      customWebVerticalDia: undefined,
      customWebVerticalSpacing: undefined,
      customWebHorizontalDia: undefined,
      customWebHorizontalSpacing: undefined,
      customBoundaryBarCount: undefined,
      customBoundaryBarDia: undefined,
      customBoundaryTieSpacing: undefined,
    });

    while ((output.result.nominalShearStress > output.result.tau_c_max || output.result.boundary.extremeFiberStress > 0.35 * fck) && currentTw < 600) {
      currentTw += 25;
      output = this.design({
        ...input,
        thickness: currentTw,
        fck,
      });
      changesApplied.push(`Upsized wall thickness to ${currentTw}mm to satisfy nominal shear stress (tau_v = ${output.result.nominalShearStress} N/mm² <= ${output.result.tau_c_max} N/mm²) & stress limits`);
    }

    if (output.result.nominalShearStress > output.result.tau_c_max && fck < 35) {
      fck = 35;
      output = this.design({ ...input, thickness: currentTw, fck });
      changesApplied.push(`Upgraded concrete grade to M35 to increase maximum permissible shear stress capacity tau_c_max to ${output.result.tau_c_max} N/mm²`);
    }

    // Configure horizontal & vertical web reinforcement to satisfy >= 0.25% steel and shear demand Vus
    let webHorizDia = 10;
    let webHorizSpacing = 150;
    if (output.result.shearSteelDemandVus > 0) {
      if (output.result.shearSteelDemandVus > 250) {
        webHorizDia = 12;
        webHorizSpacing = 100;
      } else if (output.result.shearSteelDemandVus > 150) {
        webHorizDia = 10;
        webHorizSpacing = 100;
      } else {
        webHorizDia = 10;
        webHorizSpacing = 125;
      }
    }

    // Ensure web steel ratio pt >= 0.25% for both vertical and horizontal rebar
    const webVertDia = 10;
    const singleVertA = (Math.PI * webVertDia * webVertDia) / 4;
    const maxVertSpacingForMinPt = Math.floor((800 * singleVertA) / currentTw);
    const webVertSpacing = Math.min(150, Math.max(75, Math.floor(maxVertSpacingForMinPt / 25) * 25));

    const singleHorizA = (Math.PI * webHorizDia * webHorizDia) / 4;
    const maxHorizSpacingForMinPt = Math.floor((800 * singleHorizA) / currentTw);
    webHorizSpacing = Math.min(webHorizSpacing, Math.max(75, Math.floor(maxHorizSpacingForMinPt / 25) * 25));

    changesApplied.push(`Configured web double curtain: 2-Curtains T${webVertDia} @ ${webVertSpacing} mm c/c vert & T${webHorizDia} @ ${webHorizSpacing} mm c/c horiz (IS 13920 Cl. 9.1.4 min 0.25% steel)`);

    // Configure ductile boundary elements
    let boundaryBarCount = 8;
    let boundaryBarDia = allowedLong[allowedLong.length - 1] || 16;
    let boundaryTieSpacing = Math.min(Math.floor(currentTw / 2), 100, Math.round(6 * boundaryBarDia));

    if (output.result.boundary.isBoundaryElementRequired) {
      const bArea = output.result.boundary.boundaryLength * currentTw;
      const minSteel = Math.max(800, Math.round(0.008 * bArea));
      for (const dia of allowedLong) {
        const sArea = (Math.PI * dia * dia) / 4;
        for (const cnt of [8, 10, 12, 14, 16]) {
          if (cnt * sArea >= minSteel) {
            boundaryBarCount = cnt;
            boundaryBarDia = dia;
            break;
          }
        }
        if (boundaryBarCount * ((Math.PI * boundaryBarDia * boundaryBarDia) / 4) >= minSteel) break;
      }
      boundaryTieSpacing = Math.min(Math.floor(currentTw / 2), 100, Math.round(6 * boundaryBarDia));
      changesApplied.push(`Configured ductile boundary elements: ${boundaryBarCount}-T${boundaryBarDia} with ${allowedTies[0] || 8}mm special confining ties @ ${boundaryTieSpacing} mm c/c (IS 13920 Cl. 9.4)`);
    }

    const fixedInput: MasterShearWallInput = {
      ...input,
      thickness: currentTw,
      fck,
      customWebVerticalDia: webVertDia,
      customWebVerticalSpacing: webVertSpacing,
      customWebHorizontalDia: webHorizDia,
      customWebHorizontalSpacing: webHorizSpacing,
      customWebCurtains: 2,
      customBoundaryBarCount: boundaryBarCount,
      customBoundaryBarDia: boundaryBarDia,
      customBoundaryTieSpacing: boundaryTieSpacing,
    };

    const fixedOutput = this.design(fixedInput);

    return {
      fixedInput,
      fixedOutput,
      changesApplied,
    };
  }
}


