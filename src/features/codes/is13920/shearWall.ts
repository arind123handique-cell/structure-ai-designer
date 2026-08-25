import { IS456Shear } from '../is456/shear';

export interface ShearWallInput {
  wallId: number;
  Lw: number; // Wall length in mm (e.g. 3000)
  tw: number; // Wall thickness in mm (e.g. 200)
  Hw: number; // Wall height in mm (e.g. 3500)
  fck: number; // N/mm2 (e.g. 25)
  fy: number; // N/mm2 (e.g. 500)
  Pu: number; // Factored axial load in kN
  Vu: number; // Factored shear force in kN
  Mu: number; // Factored in-plane bending moment in kNm
  isMultiStorey?: boolean; // If > 4 storeys, min tw is 200 mm
  allowedDiameters?: number[];
  allowedTieDiameters?: number[];

  // Optional manual rebar overrides
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

export interface BoundaryElementResult {
  isBoundaryElementRequired: boolean;
  extremeFiberStress: number; // sigma_c in N/mm2
  stressLimit: number; // 0.2 * fck in N/mm2
  boundaryLength: number; // c in mm (>= 0.15 * Lw)
  boundaryWidth: number; // tw in mm
  boundaryArea: number; // mm2
  minLongitudinalSteel: number; // mm2 (0.8% of boundary area)
  providedLongitudinalSteel: number; // mm2
  longitudinalBarCount: number;
  longitudinalBarDia: number;
  recommendedRebarCallout: string; // e.g. "8-T16 (1608 mm², pt = 1.05%)"
  confiningHoopDia: number;
  confiningHoopSpacing: number; // mm (<= 100 mm)
  confiningHoopCallout: string; // e.g. "8mm confining ties @ 100 mm c/c"
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export interface ShearWallResult {
  wallId: number;
  Lw: number;
  tw: number;
  Hw: number;
  minThicknessCheck: boolean;
  minThicknessRequired: number;
  webVerticalRebar: string; // e.g. "2-Curtains T10 @ 150 mm c/c (pt = 0.34%)"
  webHorizontalRebar: string; // e.g. "2-Curtains T10 @ 150 mm c/c (pt = 0.34%)"
  webVerticalDia: number;
  webVerticalSpacing: number;
  webHorizontalDia: number;
  webHorizontalSpacing: number;
  webCurtains: number;
  webSteelPercentage: number; // pt >= 0.25%
  webHorizSteelPercentage: number;
  nominalShearStress: number; // tau_v in N/mm2
  tau_c: number; // Concrete shear strength in N/mm2
  tau_c_max: number; // Max permissible shear stress in N/mm2
  shearDemandVu: number; // kN
  shearCapacityVc: number; // kN (tau_c * tw * dw)
  shearSteelDemandVus: number; // kN (Vu - Vc)
  shearSteelCapacityVus: number; // kN (0.87 * fy * Ah * dw / sv)
  shearStatus: 'PASS' | 'FAIL';
  boundary: BoundaryElementResult;
  status: 'PASS' | 'WARNING' | 'FAIL';
  failureReason?: string;
  isCustomized?: boolean;
}

export class IS13920ShearWall {
  /**
   * Designs and verifies a ductile RC shear wall as per IS 13920:2016 Cl. 9 & Cl. 10 and IS 456:2000 Cl. 32.
   */
  public static designWall(input: ShearWallInput): ShearWallResult {
    const wallId = input.wallId || 1;
    const Lw = Number(input.Lw) > 0 ? Number(input.Lw) : 3000;
    const tw = Number(input.tw) > 0 ? Number(input.tw) : 230;
    const Hw = Number(input.Hw) > 0 ? Number(input.Hw) : 3500;
    const fck = Number(input.fck) > 0 ? Number(input.fck) : 25;
    const fy = Number(input.fy) > 0 ? Number(input.fy) : 500;
    const Pu = typeof input.Pu === 'number' && !isNaN(input.Pu) ? Math.abs(input.Pu) : 1200;
    const Vu = typeof input.Vu === 'number' && !isNaN(input.Vu) ? Math.abs(input.Vu) : 220;
    const Mu = typeof input.Mu === 'number' && !isNaN(input.Mu) ? Math.abs(input.Mu) : 450;
    const isMultiStorey = input.isMultiStorey ?? true;

    // 1. Minimum thickness check (IS 13920:2016 Cl. 9.1.2)
    // tw >= 150 mm (200 mm for buildings > 4 storeys), and tw >= Hw / 20 where Hw is unsupported storey height
    const unsupportedStoreyHeight = Hw > 4500
      ? Math.min(Hw / Math.max(1, Math.round(Hw / 3200)), 3500)
      : Hw;
    const minTwCode = isMultiStorey ? 200 : 150;
    const minTwSlenderness = Math.round(unsupportedStoreyHeight / 20);
    const minTwRequired = Math.max(minTwCode, minTwSlenderness);
    const minThicknessCheck = tw >= minTwRequired;

    // 2. Web Reinforcement (IS 13920 Cl. 9.1.4 & 9.1.5)
    // Minimum 0.25% in each direction, double curtain if tw >= 200 mm
    const isDoubleCurtain = input.customWebCurtains ? input.customWebCurtains >= 2 : tw >= 200;
    const curtains = isDoubleCurtain ? 2 : 1;
    const maxSpacing = Math.min(Math.floor(Lw / 5), 3 * tw, 450);

    const allowedTies = input.allowedTieDiameters && input.allowedTieDiameters.length > 0
      ? input.allowedTieDiameters
      : [8, 10];
    const defaultWebDia = allowedTies.includes(10) ? 10 : (allowedTies[0] || 8);
    const defaultWebSpacing = Math.min(150, Math.floor(maxSpacing / 25) * 25);

    const webVertDia = input.customWebVerticalDia || defaultWebDia;
    const webVertSpacing = input.customWebVerticalSpacing || defaultWebSpacing;
    const webHorizDia = input.customWebHorizontalDia || defaultWebDia;
    const webHorizSpacing = input.customWebHorizontalSpacing || defaultWebSpacing;

    const singleAreaVert = (Math.PI * webVertDia * webVertDia) / 4;
    const webAstVertPerMeter = (1000 / webVertSpacing) * singleAreaVert * curtains;
    const webSteelPercentage = parseFloat(((webAstVertPerMeter * 100) / (tw * 1000)).toFixed(2));

    const singleAreaHoriz = (Math.PI * webHorizDia * webHorizDia) / 4;
    const webAstHorizPerMeter = (1000 / webHorizSpacing) * singleAreaHoriz * curtains;
    const webHorizSteelPercentage = parseFloat(((webAstHorizPerMeter * 100) / (tw * 1000)).toFixed(2));

    const webVerticalRebar = `${curtains > 1 ? `${curtains}-Curtains ` : ''}T${webVertDia} @ ${webVertSpacing} mm c/c (pt = ${webSteelPercentage}%)`;
    const webHorizontalRebar = `${curtains > 1 ? `${curtains}-Curtains ` : ''}T${webHorizDia} @ ${webHorizSpacing} mm c/c (pt = ${webHorizSteelPercentage}%)`;

    // 3. Nominal Shear Stress & Shear Capacity Check (IS 13920 Cl. 9.2 & IS 456 Table 20)
    // dw = 0.8 * Lw (effective depth of wall as per IS 13920 Cl. 9.2.1)
    const dw = 0.8 * Lw;
    const Vu_N = Math.abs(Vu) * 1e3;
    const tau_v = parseFloat((Vu_N / (tw * dw)).toFixed(3));
    const tau_c_max = IS456Shear.getTauCMax(fck);
    const tau_c = parseFloat(IS456Shear.getTauC(fck, Math.max(webSteelPercentage, 0.25)).toFixed(3));

    const Vc_N = tau_c * tw * dw;
    const shearCapacityVc = parseFloat((Vc_N / 1e3).toFixed(1));
    const Vus_N = Math.max(0, Vu_N - Vc_N);
    const shearSteelDemandVus = parseFloat((Vus_N / 1e3).toFixed(1));

    // Shear steel capacity provided by horizontal bars (IS 13920 Cl. 9.2.3: Vus = 0.87 * fy * Ah * dw / sv)
    const Ah = curtains * singleAreaHoriz; // area of horizontal rebar at spacing sv
    const shearSteelCapacityVus_N = (0.87 * fy * Ah * dw) / webHorizSpacing;
    const shearSteelCapacityVus = parseFloat((shearSteelCapacityVus_N / 1e3).toFixed(1));

    const shearStatus = (tau_v <= tau_c_max && (Vus_N === 0 || shearSteelCapacityVus_N >= Vus_N)) ? 'PASS' : 'FAIL';

    // 4. Boundary Element Check (IS 13920:2016 Cl. 9.4)
    // Required if extreme fiber compressive stress sigma_c > 0.2 * fck
    const Ag = tw * Lw;
    const Z = (tw * Lw * Lw) / 6;
    const directStress = (Pu * 1e3) / (Ag > 0 ? Ag : 1);
    const bendingStress = (Mu * 1e6) / (Z > 0 ? Z : 1);
    const totalStress = directStress + bendingStress;
    const extremeFiberStress = isNaN(totalStress) ? 0 : parseFloat(totalStress.toFixed(2));
    const stressLimit = parseFloat((0.2 * fck).toFixed(2));

    const isBoundaryElementRequired = extremeFiberStress > stressLimit;

    // Boundary element dimensions: length c >= max(0.15 * Lw, 200 mm)
    const autoBoundaryLength = Math.max(Math.round(0.15 * Lw), 250);
    const boundaryLength = input.customBoundaryLength || autoBoundaryLength;
    const boundaryWidth = tw;
    const boundaryArea = boundaryLength * boundaryWidth;

    // Longitudinal vertical steel in boundary element: min 0.8% of boundary area, max 4% (Cl. 9.4.4)
    const minLongitudinalSteel = Math.max(800, Math.round(0.008 * boundaryArea));
    const validDias = input.allowedDiameters && input.allowedDiameters.length > 0
      ? input.allowedDiameters
      : [12, 16, 20, 25];

    let chosenDia = input.customBoundaryBarDia || validDias[validDias.length - 1];
    let chosenCount = input.customBoundaryBarCount || 8;

    if (!input.customBoundaryBarDia && !input.customBoundaryBarCount) {
      let bestExcess = Infinity;
      const barCounts = [8, 10, 12, 14, 16];
      for (const dia of validDias) {
        const singleA = (Math.PI * dia * dia) / 4;
        for (const cnt of barCounts) {
          const totalA = cnt * singleA;
          if (totalA >= minLongitudinalSteel) {
            const excess = totalA - minLongitudinalSteel;
            if (excess < bestExcess) {
              bestExcess = excess;
              chosenDia = dia;
              chosenCount = cnt;
            }
          }
        }
      }
    }

    const providedLongitudinalSteel = Math.round(chosenCount * ((Math.PI * chosenDia * chosenDia) / 4));
    const boundarySteelPt = parseFloat(((providedLongitudinalSteel * 100) / boundaryArea).toFixed(2));
    const recommendedRebarCallout = `${chosenCount}-T${chosenDia} (${providedLongitudinalSteel} mm², pt = ${boundarySteelPt}%)`;

    // Special confining ties in boundary element (IS 13920 Cl. 9.4.5)
    // Spacing <= min(tw/2, 100 mm, 6 * db)
    const autoTieDia = Math.max(8, Math.round(chosenDia / 4));
    const confiningHoopDia = input.customBoundaryTieDia || (allowedTies.includes(autoTieDia) ? autoTieDia : (allowedTies[0] || 8));
    const autoConfiningSpacing = Math.min(Math.floor(tw / 2), 100, Math.round(6 * chosenDia));
    const confiningHoopSpacing = input.customBoundaryTieSpacing || autoConfiningSpacing;
    const confiningHoopCallout = `${confiningHoopDia}mm special confining ties @ ${confiningHoopSpacing} mm c/c`;

    let boundaryStatus: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    if (isBoundaryElementRequired) {
      if (providedLongitudinalSteel < minLongitudinalSteel) {
        boundaryStatus = 'FAIL';
      } else if (confiningHoopSpacing > 100 || confiningHoopSpacing > Math.floor(tw / 2) || confiningHoopSpacing > Math.round(6 * chosenDia)) {
        boundaryStatus = 'WARNING';
      }
    }

    const boundary: BoundaryElementResult = {
      isBoundaryElementRequired,
      extremeFiberStress,
      stressLimit,
      boundaryLength,
      boundaryWidth,
      boundaryArea,
      minLongitudinalSteel,
      providedLongitudinalSteel,
      longitudinalBarCount: chosenCount,
      longitudinalBarDia: chosenDia,
      recommendedRebarCallout,
      confiningHoopDia,
      confiningHoopSpacing,
      confiningHoopCallout,
      status: boundaryStatus,
    };

    let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    let failureReason: string | undefined = undefined;

    if (!minThicknessCheck) {
      status = 'FAIL';
      failureReason = `Wall thickness (${tw} mm) is less than minimum specified (${minTwRequired} mm) as per IS 13920 Cl. 9.1.2.`;
    } else if (tau_v > tau_c_max) {
      status = 'FAIL';
      failureReason = `Nominal shear stress tau_v (${tau_v} N/mm²) exceeds tau_c_max (${tau_c_max} N/mm²). Increase wall thickness or length.`;
    } else if (shearStatus === 'FAIL') {
      status = 'FAIL';
      failureReason = `Provided horizontal shear steel (${shearSteelCapacityVus} kN) is insufficient for shear demand Vus (${shearSteelDemandVus} kN).`;
    } else if (webSteelPercentage < 0.25 || webHorizSteelPercentage < 0.25) {
      status = 'WARNING';
      failureReason = `Web reinforcement (${Math.min(webSteelPercentage, webHorizSteelPercentage)}%) is less than IS 13920 minimum 0.25%.`;
    } else if (isBoundaryElementRequired && boundary.status === 'FAIL') {
      status = 'FAIL';
      failureReason = `Boundary longitudinal reinforcement (${providedLongitudinalSteel} mm²) is less than minimum 0.8% (${minLongitudinalSteel} mm²).`;
    } else if (isBoundaryElementRequired && boundary.status === 'WARNING') {
      status = 'WARNING';
      failureReason = `Boundary confining hoop spacing (${confiningHoopSpacing} mm) exceeds code limit (${autoConfiningSpacing} mm).`;
    } else if (extremeFiberStress > 0.35 * fck) {
      status = 'WARNING';
      failureReason = `Extreme fiber compressive stress (${extremeFiberStress} N/mm²) is high (> 0.35 fck = ${(0.35 * fck).toFixed(1)} N/mm²). Consider upsizing wall thickness.`;
    }

    const isCustomized = Boolean(
      input.customWebVerticalDia ||
      input.customWebVerticalSpacing ||
      input.customWebHorizontalDia ||
      input.customWebHorizontalSpacing ||
      input.customBoundaryLength ||
      input.customBoundaryBarCount ||
      input.customBoundaryBarDia ||
      input.customBoundaryTieDia ||
      input.customBoundaryTieSpacing
    );

    return {
      wallId,
      Lw,
      tw,
      Hw,
      minThicknessCheck,
      minThicknessRequired: minTwRequired,
      webVerticalRebar,
      webHorizontalRebar,
      webVerticalDia: webVertDia,
      webVerticalSpacing: webVertSpacing,
      webHorizontalDia: webHorizDia,
      webHorizontalSpacing: webHorizSpacing,
      webCurtains: curtains,
      webSteelPercentage,
      webHorizSteelPercentage,
      nominalShearStress: tau_v,
      tau_c,
      tau_c_max,
      shearDemandVu: Math.abs(Vu),
      shearCapacityVc,
      shearSteelDemandVus,
      shearSteelCapacityVus,
      shearStatus,
      boundary,
      status,
      failureReason,
      isCustomized,
    };
  }
}
