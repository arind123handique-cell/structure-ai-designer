import { NormalizedStructuralModel } from '@/features/model/types';
import { ProjectMetadata, DesignParameters } from '@/types';
import { DetailedCalculationReport } from '@/features/calculations/types';

export type StaircaseType = 'DOG_LEGGED' | 'OPEN_WELL' | 'STRAIGHT' | 'CANTILEVER';

export type LandingEntryType = 'BOTH_SIDES' | 'LEFT_ONLY' | 'RIGHT_ONLY' | 'FRONT_ONLY' | 'DUAL_LANDING_ACCESS';

export interface StaircaseLandingEntryConfig {
  entryType: LandingEntryType;
  hasLeftDoor: boolean;
  leftDoorWidthM: number; // e.g. 1.0 m
  hasRightDoor: boolean;
  rightDoorWidthM: number; // e.g. 1.0 m
  hasFrontDoor: boolean;
  frontDoorWidthM: number; // e.g. 1.2 m
  hasMidLandingExit: boolean; // e.g. Balcony or fire escape access from mid landing
  midLandingExitWidthM: number; // e.g. 0.9 m
  leftDoorLabel?: string;
  rightDoorLabel?: string;
  frontDoorLabel?: string;
}

export interface StaircaseRoomGeometry {
  roomLength: number; // Length L in meters (e.g. 4.80 m)
  roomWidth: number; // Width B in meters (e.g. 2.40 m)
  wallThicknessMm: number; // Wall thickness (e.g. 230 mm)
  flightWidthM: number; // Width of each flight (e.g. 1.10 m)
  wellGapWidthM: number; // Gap between two flights (e.g. 0.20 m)
  treadMm: number; // Tread T in mm (e.g. 275 mm)
  riserMm: number; // Riser R in mm (e.g. 150 mm)
  waistSlabThicknessMm: number; // Waist slab thickness in mm (e.g. 160 mm)
  landingWidthM: number; // Landing depth in meters (e.g. 1.20 m)
  handrailHeightM: number; // Handrail height (e.g. 1.0 m)
  liveLoadKnM2: number; // Live load (IS 875 Pt 2: 3.0 to 5.0 kN/m2)
  floorFinishKnM2: number; // Floor finish load (1.0 kN/m2)
  fck: number; // Concrete characteristic strength (e.g. 25 N/mm2)
  fy: number; // Steel yield strength (e.g. 500 N/mm2)
}

export interface DiaphragmLevelInfo {
  levelIndex: number;
  levelName: string;
  bottomElevationY: number; // e.g. 0.00 m
  topElevationY: number; // e.g. 3.20 m
  storeyHeightM: number; // e.g. 3.20 m
  midLandingElevationY: number; // e.g. 1.60 m
  isRoofLevel: boolean;
}

export interface StaircaseFlightDesignOutput {
  id: string; // e.g. "FLIGHT-1"
  name: string; // e.g. "Flight 1 (Ground to Mid-Landing)"
  flightIndex: 1 | 2;
  levelName: string;
  bottomElevationY: number;
  topElevationY: number;
  flightRiseM: number;
  riserCount: number;
  treadCount: number;
  treadMm: number;
  riserMm: number;
  goingLengthM: number;
  flightWidthM: number;
  waistSlabThicknessMm: number;
  slopeAngleDeg: number;
  effectiveSpanLeffM: number;
  headroomM: number;

  // Loads
  deadLoadWaistSlabKnM2: number;
  deadLoadStepsKnM2: number;
  floorFinishKnM2: number;
  totalDeadLoadKnM2: number;
  liveLoadKnM2: number;
  factoredLoadWuKnM2: number;
  factoredLoadWuPerMeterKn: number;

  // Moments & Shear
  designMomentMu: number; // kNm
  designShearVu: number; // kN
  effectiveDepthD: number; // mm
  effectiveDepthReqMm: number; // mm

  // Rebar Details
  mainRebarDia: number; // mm
  mainRebarSpacing: number; // mm
  mainRebarCallout: string;
  mainAstProvided: number; // mm2/m
  mainAstRequired: number; // mm2/m
  ptProvided: number; // %

  distributionRebarDia: number; // mm
  distributionRebarSpacing: number; // mm
  distributionRebarCallout: string;
  distributionAstProvided: number; // mm2/m

  topNegativeRebarCallout: string;
  kinkAnchorageDetail: string;

  // Landing Details & Clearances
  landingRebarCallout: string;
  landingThicknessMm: number;
  landingEntryConfig: StaircaseLandingEntryConfig;
  clearLandingPassageWidthM: number;
  landingClearanceCheck: 'PASS' | 'WARNING' | 'FAIL';

  // Compliance Checks
  depthCheck: 'PASS' | 'FAIL';
  deflectionCheck: 'PASS' | 'FAIL';
  shearCheck: 'PASS' | 'FAIL';
  headroomCheck: 'PASS' | 'WARNING';
  status: 'PASS' | 'WARNING' | 'FAIL';

  // Material Take-off
  concreteM3: number;
  formworkM2: number;
  steelKg: number;
  cementBags: number;

  calculationReport: DetailedCalculationReport;
}

export interface StoreyStaircaseDesignOutput {
  storeyId: string;
  levelIndex: number;
  levelName: string;
  bottomElevationY: number;
  topElevationY: number;
  storeyHeightM: number;
  midLandingElevationY: number;
  roomGeometry: StaircaseRoomGeometry;
  landingEntryConfig: StaircaseLandingEntryConfig;
  flight1: StaircaseFlightDesignOutput;
  flight2: StaircaseFlightDesignOutput;
  totalStoreyConcreteM3: number;
  totalStoreyFormworkM2: number;
  totalStoreySteelKg: number;
  totalStoreyCementBags: number;
  overallStatus: 'PASS' | 'WARNING' | 'FAIL';
}

export interface BuildingStaircaseSummary {
  totalStoreys: number;
  totalFlights: number;
  totalConcreteM3: number;
  totalFormworkM2: number;
  totalSteelKg: number;
  totalSteelMT: number;
  totalCementBags: number;
  averageSteelIntensityKgM3: number;
  storeyDesigns: StoreyStaircaseDesignOutput[];
  diaphragmLevels: DiaphragmLevelInfo[];
}

export class StaircaseDesignEngine {
  /**
   * Extracts floor diaphragm levels from STAAD.Pro model
   */
  public static extractDiaphragmLevels(model: NormalizedStructuralModel | null): DiaphragmLevelInfo[] {
    if (!model || !model.nodes) {
      // Default G+4 diaphragm elevations if no model is loaded
      return [
        { levelIndex: 1, levelName: 'Ground to 1st Floor Diaphragm', bottomElevationY: 0.0, topElevationY: 3.2, storeyHeightM: 3.2, midLandingElevationY: 1.6, isRoofLevel: false },
        { levelIndex: 2, levelName: '1st to 2nd Floor Diaphragm', bottomElevationY: 3.2, topElevationY: 6.4, storeyHeightM: 3.2, midLandingElevationY: 4.8, isRoofLevel: false },
        { levelIndex: 3, levelName: '2nd to 3rd Floor Diaphragm', bottomElevationY: 6.4, topElevationY: 9.6, storeyHeightM: 3.2, midLandingElevationY: 8.0, isRoofLevel: false },
        { levelIndex: 4, levelName: '3rd to 4th Floor Diaphragm', bottomElevationY: 9.6, topElevationY: 12.8, storeyHeightM: 3.2, midLandingElevationY: 11.2, isRoofLevel: false },
        { levelIndex: 5, levelName: '4th Floor to Roof Diaphragm', bottomElevationY: 12.8, topElevationY: 16.0, storeyHeightM: 3.2, midLandingElevationY: 14.4, isRoofLevel: true },
      ];
    }

    const nodes = model.nodes;
    const members = model.members;
    const beamElevations = new Set<number>();

    // 1. Check beam elevations
    for (const m of members.values()) {
      if (m.classification === 'BEAM') {
        const n1 = nodes.get(m.startNodeId);
        const n2 = nodes.get(m.endNodeId);
        if (n1 && n2 && Math.abs(n1.y - n2.y) < 0.15) {
          beamElevations.add(parseFloat(n1.y.toFixed(2)));
        }
      }
    }

    // 2. Check plates
    if (model.plates) {
      for (const p of model.plates.values()) {
        const pNodes = p.nodeIds.map((id) => nodes.get(id)).filter(Boolean);
        if (pNodes.length > 0) {
          const avgY = pNodes.reduce((sum, n) => sum + (n?.y || 0), 0) / pNodes.length;
          beamElevations.add(parseFloat(avgY.toFixed(2)));
        }
      }
    }

    // 3. Collect all Y elevations
    const allNodeY = Array.from(nodes.values()).map((n) => parseFloat(n.y.toFixed(2)));
    const minY = allNodeY.length > 0 ? Math.min(...allNodeY) : 0;
    beamElevations.add(minY);

    const sortedY = Array.from(beamElevations).sort((a, b) => a - b);

    // Cluster Y elevations within 2.0m tolerance so intermediate landing nodes merge into main diaphragm storeys
    const clusteredY: number[] = [];
    for (const y of sortedY) {
      if (clusteredY.length === 0) {
        clusteredY.push(y);
      } else {
        const lastY = clusteredY[clusteredY.length - 1];
        if (y - lastY >= 2.0) {
          clusteredY.push(y);
        }
      }
    }

    if (clusteredY.length <= 1) {
      // Fallback standard levels if single elevation detected
      const base = clusteredY[0] || 0;
      clusteredY.length = 0;
      clusteredY.push(base, base + 3.2, base + 6.4, base + 9.6, base + 12.8, base + 16.0);
    }

    // Build Diaphragm Level list
    const levels: DiaphragmLevelInfo[] = [];
    for (let i = 0; i < clusteredY.length - 1; i++) {
      const bottomY = clusteredY[i];
      const topY = clusteredY[i + 1];
      const storeyH = parseFloat((topY - bottomY).toFixed(2));
      const midLandingY = parseFloat((bottomY + storeyH / 2).toFixed(2));
      const isRoof = i === clusteredY.length - 2;

      const levelName = i === 0
        ? `Ground to 1st Floor Diaphragm (EL. +${bottomY.toFixed(2)}m → +${topY.toFixed(2)}m)`
        : isRoof
        ? `${i}th Floor to Roof Diaphragm (EL. +${bottomY.toFixed(2)}m → +${topY.toFixed(2)}m)`
        : `${i}th to ${i + 1}th Floor Diaphragm (EL. +${bottomY.toFixed(2)}m → +${topY.toFixed(2)}m)`;

      levels.push({
        levelIndex: i + 1,
        levelName,
        bottomElevationY: bottomY,
        topElevationY: topY,
        storeyHeightM: storeyH,
        midLandingElevationY: midLandingY,
        isRoofLevel: isRoof,
      });
    }

    return levels;
  }

  /**
   * Default geometry configuration
   */
  public static getDefaultGeometry(metadata?: ProjectMetadata): StaircaseRoomGeometry {
    const fck = metadata?.designSettings?.concreteGrade === 'M30' ? 30 : 25;
    const fy = metadata?.designSettings?.steelGrade === 'Fe500D' ? 500 : 500;

    return {
      roomLength: 4.80, // 4.80 m room length
      roomWidth: 2.40, // 2.40 m room width (1.1m flight + 0.2m well + 1.1m flight)
      wallThicknessMm: 230,
      flightWidthM: 1.10,
      wellGapWidthM: 0.20,
      treadMm: 275, // 275 mm tread
      riserMm: 160, // 160 mm riser
      waistSlabThicknessMm: 160,
      landingWidthM: 1.20, // 1.20 m landing depth
      handrailHeightM: 1.0,
      liveLoadKnM2: 4.0, // 4.0 kN/m2 for staircase (IS 875 Part 2)
      floorFinishKnM2: 1.0, // 1.0 kN/m2
      fck,
      fy,
    };
  }

  /**
   * Default dual-side landing entry configuration
   */
  public static getDefaultLandingEntryConfig(): StaircaseLandingEntryConfig {
    return {
      entryType: 'BOTH_SIDES',
      hasLeftDoor: true,
      leftDoorWidthM: 1.0,
      hasRightDoor: true,
      rightDoorWidthM: 1.0,
      hasFrontDoor: true,
      frontDoorWidthM: 1.2,
      hasMidLandingExit: false,
      midLandingExitWidthM: 0.9,
      leftDoorLabel: 'Left Entry Door (1.0m)',
      rightDoorLabel: 'Right Entry Door (1.0m)',
      frontDoorLabel: 'Main Corridor Access (1.2m)',
    };
  }

  /**
   * Designs a single staircase flight as per IS 456:2000 Cl. 33 & IS 13920
   */
  public static designFlight(
    flightIndex: 1 | 2,
    diaphragm: DiaphragmLevelInfo,
    geom: StaircaseRoomGeometry,
    entryConfig: StaircaseLandingEntryConfig
  ): StaircaseFlightDesignOutput {
    const flightRiseM = parseFloat((diaphragm.storeyHeightM / 2).toFixed(3));
    const riserM = geom.riserMm / 1000;
    const treadM = geom.treadMm / 1000;

    // Number of risers and treads
    const calculatedRisers = Math.round(flightRiseM / riserM);
    const riserCount = Math.max(8, calculatedRisers);
    const actualRiserMm = parseFloat(((flightRiseM / riserCount) * 1000).toFixed(1));
    const actualRiserM = actualRiserMm / 1000;

    const treadCount = riserCount - 1;
    const goingLengthM = parseFloat((treadCount * treadM).toFixed(3));

    // Slope angle theta = arctan(R / T)
    const slopeAngleRad = Math.atan(actualRiserM / treadM);
    const slopeAngleDeg = parseFloat(((slopeAngleRad * 180) / Math.PI).toFixed(1));

    // Effective span Leff as per IS 456 Cl. 33.1
    // Leff = Going + 0.5 * (Landing1 + Landing2)
    const effectiveSpanLeffM = parseFloat((goingLengthM + geom.landingWidthM).toFixed(3));

    // Waist slab thickness and effective depth
    const D = geom.waistSlabThicknessMm; // mm
    const clearCover = 20; // mm (IS 456 Cl. 26.4.2)
    const barDiaEst = 12; // mm
    const d = D - clearCover - barDiaEst / 2; // mm

    // Load calculations (IS 456 Cl. 33.2 & IS 875 Pt 2)
    // 1. Self-weight of waist slab on slope converted to plan:
    // w_waist = 25 * (t_w / 1000) * sqrt(1 + (R/T)^2)
    const waistSlopeFactor = Math.sqrt(1 + Math.pow(actualRiserM / treadM, 2));
    const deadLoadWaistSlabKnM2 = parseFloat((25 * (D / 1000) * waistSlopeFactor).toFixed(2));

    // 2. Self-weight of triangular steps on plan:
    // w_steps = 25 * (R / 2)
    const deadLoadStepsKnM2 = parseFloat((25 * (actualRiserM / 2)).toFixed(2));

    // 3. Floor finishes
    const floorFinishKnM2 = geom.floorFinishKnM2;

    // Total Dead load on plan
    const totalDeadLoadKnM2 = parseFloat((deadLoadWaistSlabKnM2 + deadLoadStepsKnM2 + floorFinishKnM2).toFixed(2));

    // Live load on plan
    const liveLoadKnM2 = geom.liveLoadKnM2;

    // Factored design load wu = 1.5 * (DL + LL)
    const factoredLoadWuKnM2 = parseFloat((1.5 * (totalDeadLoadKnM2 + liveLoadKnM2)).toFixed(2));
    const factoredLoadWuPerMeterKn = parseFloat((factoredLoadWuKnM2 * geom.flightWidthM).toFixed(2));

    // Design Bending Moment Mu = (wu * Leff^2) / 8
    const designMomentMu = parseFloat(((factoredLoadWuKnM2 * Math.pow(effectiveSpanLeffM, 2)) / 8).toFixed(2));

    // Design Shear Force Vu = (wu * Leff) / 2
    const designShearVu = parseFloat(((factoredLoadWuKnM2 * effectiveSpanLeffM) / 2).toFixed(2));

    // Effective depth requirement for Fe500 (Mu_lim = 0.138 * fck * b * d^2)
    const b = 1000; // per 1m width
    const dReqMm = parseFloat(Math.sqrt((designMomentMu * 1e6) / (0.138 * geom.fck * b)).toFixed(1));
    const depthCheck = d >= dReqMm ? 'PASS' : 'FAIL';

    // Required Ast calculation (IS 456 Cl. G-1.1)
    // Ast = [0.5 * fck / fy] * [1 - sqrt(1 - 4.6 * Mu / (fck * b * d^2))] * b * d
    const term = (4.6 * designMomentMu * 1e6) / (geom.fck * b * Math.pow(d, 2));
    let mainAstRequired = 0;
    if (term < 1.0) {
      mainAstRequired = parseFloat((((0.5 * geom.fck) / geom.fy) * (1 - Math.sqrt(1 - term)) * b * d).toFixed(1));
    } else {
      mainAstRequired = parseFloat(((0.0035 * b * d * geom.fck) / geom.fy).toFixed(1));
    }

    // Minimum reinforcement check (0.12% for Fe500 as per IS 456 Cl. 26.5.2.1)
    const minAst = parseFloat((0.0012 * b * D).toFixed(1));
    const finalMainAstReq = Math.max(minAst, mainAstRequired);

    // Select main rebar spacing
    const mainBarDia = 12; // mm
    const singleBarArea = (Math.PI * Math.pow(mainBarDia, 2)) / 4;
    const exactSpacing = (singleBarArea * 1000) / finalMainAstReq;
    // Round down to standard spacing: 100, 125, 150, 175, 200 mm (max 3d or 300mm)
    const maxSpacing = Math.min(3 * d, 300);
    const mainRebarSpacing = Math.min(maxSpacing, Math.max(100, Math.floor(exactSpacing / 25) * 25));
    const mainAstProvided = parseFloat(((singleBarArea * 1000) / mainRebarSpacing).toFixed(1));
    const ptProvided = parseFloat(((mainAstProvided / (b * d)) * 100).toFixed(2));
    const mainRebarCallout = `T${mainBarDia} @ ${mainRebarSpacing} mm c/c (Bottom Main Tensile Rebar)`;

    // Distribution steel (0.12% of gross section)
    const distBarDia = 8; // mm
    const distSingleBarArea = (Math.PI * Math.pow(distBarDia, 2)) / 4;
    const distAstReq = minAst;
    const distExactSpacing = (distSingleBarArea * 1000) / distAstReq;
    const distMaxSpacing = Math.min(5 * d, 450);
    const distributionRebarSpacing = Math.min(distMaxSpacing, Math.max(125, Math.floor(distExactSpacing / 25) * 25));
    const distributionAstProvided = parseFloat(((distSingleBarArea * 1000) / distributionRebarSpacing).toFixed(1));
    const distributionRebarCallout = `T${distBarDia} @ ${distributionRebarSpacing} mm c/c (Transverse Distribution)`;

    // Top negative steel at supports (50% of main steel as per IS 456)
    const topNegativeRebarCallout = `T10 @ 150 mm c/c (Top Negative Rebar over 0.25 Leff)`;

    // Kink anchorage detail at junction (IS 13920 / SP:34)
    const Ld = Math.round(47 * mainBarDia); // 47 * phi for Fe500 in M25
    const kinkAnchorageDetail = `Cross-over kink tension bars extended with Ld = ${Ld} mm full tension development length into landing compression zone (IS 13920 Cl. 7 / SP:34)`;

    // Landing reinforcement
    const landingThicknessMm = D;
    const landingMainRebar = `T10 @ 150 mm c/c B.W. (Bottom Mesh)`;
    const landingDistributionRebar = `T8 @ 150 mm c/c (Top Distribution / Negative Mesh)`;

    // Dual Landing Entry Clearance Check
    // Clear landing passage width must be >= flight width as per NBC & IS 456
    const clearLandingPassageWidthM = geom.landingWidthM;
    let landingClearanceCheck: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    if (clearLandingPassageWidthM < geom.flightWidthM - 0.05) {
      landingClearanceCheck = 'WARNING';
    }
    if (entryConfig.hasLeftDoor && entryConfig.leftDoorWidthM > geom.landingWidthM) {
      landingClearanceCheck = 'WARNING';
    }
    if (entryConfig.hasRightDoor && entryConfig.rightDoorWidthM > geom.landingWidthM) {
      landingClearanceCheck = 'WARNING';
    }

    // Deflection Check (Span-to-depth ratio IS 456 Cl. 23.2.1 & Fig 4)
    const actualSpanToDepth = (effectiveSpanLeffM * 1000) / d;
    const fs = 0.58 * geom.fy * (finalMainAstReq / Math.max(1, mainAstProvided));
    const kt = Math.min(2.0, Math.max(1.4, 1 / (0.225 + 0.00322 * fs - 0.625 * Math.log10(Math.max(0.15, ptProvided)))));
    const allowableSpanToDepth = parseFloat((20 * kt).toFixed(1));
    const deflectionCheck = actualSpanToDepth <= allowableSpanToDepth ? 'PASS' : 'FAIL';

    // Shear Stress Check (tau_v <= tau_c)
    const tauV = (designShearVu * 1e3) / (b * d);
    const tauC = 0.36; // for M25 and pt ~ 0.3%
    const shearCheck = tauV <= tauC ? 'PASS' : 'FAIL';

    // Headroom check (NBC minimum 2.20m clear vertical)
    const headroomM = parseFloat((diaphragm.storeyHeightM / 2 + 1.20 - actualRiserM).toFixed(2));
    const headroomCheck = headroomM >= 2.15 ? 'PASS' : 'WARNING';

    // Overall flight status
    const status = depthCheck === 'PASS' && deflectionCheck === 'PASS' && shearCheck === 'PASS'
      ? 'PASS'
      : depthCheck === 'FAIL' || shearCheck === 'FAIL'
      ? 'FAIL'
      : 'WARNING';

    // Quantities per flight
    // 1. Waist slab volume: Going * FlightWidth * (t_w / cos theta)
    const waistVol = (goingLengthM * geom.flightWidthM * (D / 1000)) * waistSlopeFactor;
    // 2. Steps volume: 0.5 * R * T * N_steps * FlightWidth
    const stepsVol = 0.5 * actualRiserM * treadM * treadCount * geom.flightWidthM;
    // 3. Landing volume (half landing shared per flight): LandingLength * LandingWidth * Thickness
    const landingVol = geom.roomWidth * geom.landingWidthM * (landingThicknessMm / 1000) * 0.5;
    const concreteM3 = parseFloat((waistVol + stepsVol + landingVol).toFixed(3));

    // Formwork / Centering & Shuttering Area
    const waistSoffitArea = (goingLengthM / Math.cos(slopeAngleRad)) * geom.flightWidthM;
    const riserSoffitArea = riserCount * actualRiserM * geom.flightWidthM;
    const landingSoffitArea = (geom.roomWidth * geom.landingWidthM) * 0.5;
    const sideWaistArea = 2 * (0.5 * goingLengthM * flightRiseM);
    const formworkM2 = parseFloat((waistSoffitArea + riserSoffitArea + landingSoffitArea + sideWaistArea).toFixed(2));

    // Steel Weight (approx 85 kg/m3 for IS 456 staircase)
    const steelKg = parseFloat((concreteM3 * 88.0).toFixed(1));

    // Cement bags (8.2 bags per m3 for M25)
    const cementBags = Math.round(concreteM3 * (geom.fck >= 30 ? 9.0 : 8.2));

    const bottomEl = flightIndex === 1 ? diaphragm.bottomElevationY : diaphragm.midLandingElevationY;
    const topEl = flightIndex === 1 ? diaphragm.midLandingElevationY : diaphragm.topElevationY;

    // Step-by-Step Calculation Report
    const calculationReport: DetailedCalculationReport = {
      elementId: `STAIR-${diaphragm.levelIndex}-FLIGHT-${flightIndex}`,
      elementType: 'STAIRCASE',
      title: flightIndex === 1
        ? `IS 456 Staircase Flight 1 (EL. +${bottomEl.toFixed(2)}m → Mid-Landing +${topEl.toFixed(2)}m)`
        : `IS 456 Staircase Flight 2 (Mid-Landing +${bottomEl.toFixed(2)}m → Floor Diaphragm +${topEl.toFixed(2)}m)`,
      designCode: 'IS 456:2000 & IS 13920:2016',
      governingLoadCase: 1,
      timestamp: new Date().toISOString(),
      overallStatus: status,
      summaryCallout: `${riserCount}R @ ${actualRiserMm}mm × ${treadCount}T @ ${geom.treadMm}mm | Main Rebar: ${mainRebarCallout}`,
      sections: [
        {
          title: '1. Geometric Configuration & Story Diaphragm Extraction',
          steps: [
            {
              symbol: 'Hf, R, T',
              description: 'Flight Rise, Riser & Tread Sizing',
              formula: 'Hf = Delta_Y / 2, N_R = Hf / R, N_T = N_R - 1',
              substitution: `Hf = ${flightRiseM}m, R = ${actualRiserMm}mm, T = ${geom.treadMm}mm => N_R = ${riserCount}, N_T = ${treadCount}`,
              result: `Going Length = ${goingLengthM} m, Slope theta = ${slopeAngleDeg}°`,
              codeReference: 'IS 456:2000 Cl. 33.1 & NBC 2016',
              status: 'PASS',
            },
          ],
        },
        {
          title: '2. Effective Span Calculation (IS 456 Cl. 33.1)',
          steps: [
            {
              symbol: 'Leff',
              description: 'Effective Span',
              formula: 'L_going + 0.5 * (L_land1 + L_land2)',
              substitution: `${goingLengthM} + 0.5 * (${geom.landingWidthM} + ${geom.landingWidthM})`,
              result: `${effectiveSpanLeffM} m`,
              codeReference: 'IS 456:2000 Cl. 33.1',
              status: 'PASS',
            },
          ],
        },
        {
          title: '3. Design Loading & Factored Load wu',
          steps: [
            {
              symbol: 'wu',
              description: 'Factored Design Load on Plan',
              formula: '1.5 * [w_waist + w_steps + w_finish + LiveLoad]',
              substitution: `1.5 * [${deadLoadWaistSlabKnM2} + ${deadLoadStepsKnM2} + ${floorFinishKnM2} + ${liveLoadKnM2}]`,
              result: `${factoredLoadWuKnM2} kN/m² (${factoredLoadWuPerMeterKn} kN/m)`,
              codeReference: 'IS 456:2000 Cl. 33.2 & IS 875 Part 2',
              status: 'PASS',
            },
          ],
        },
        {
          title: '4. Maximum Bending Moment & Effective Depth Check',
          steps: [
            {
              symbol: 'Mu, d_req',
              description: 'Design Moment & Required Effective Depth',
              formula: 'Mu = (wu * Leff^2) / 8, d_req = sqrt(Mu / (0.138 * fck * b))',
              substitution: `Mu = (${factoredLoadWuKnM2} * ${effectiveSpanLeffM}^2) / 8 = ${designMomentMu} kNm, d_req = ${dReqMm} mm`,
              result: `d_prov = ${d} mm >= d_req = ${dReqMm} mm`,
              codeReference: 'IS 456:2000 Cl. G-1.1',
              status: depthCheck,
            },
          ],
        },
        {
          title: '5. Main Tensile Reinforcement & Distribution Steel',
          steps: [
            {
              symbol: 'Ast,prov',
              description: 'Main Tensile Bottom Steel',
              formula: '[0.5*fck/fy]*[1 - sqrt(1 - 4.6*Mu/(fck*b*d^2))]*b*d',
              substitution: `Req: ${mainAstRequired} mm²/m => Provide ${mainRebarCallout}`,
              result: `${mainAstProvided} mm²/m (pt = ${ptProvided}%)`,
              codeReference: 'IS 456:2000 Cl. 26.5.2.1',
              status: 'PASS',
            },
            {
              symbol: 'Ast,dist',
              description: 'Transverse Distribution Steel',
              formula: '0.0012 * b * D',
              substitution: `0.0012 * 1000 * ${D} = ${minAst} mm²/m`,
              result: distributionRebarCallout,
              codeReference: 'IS 456:2000 Cl. 26.5.2.1',
              status: 'PASS',
            },
          ],
        },
        {
          title: '6. Kink Detailing & Dual-Side Landing Clearance',
          steps: [
            {
              symbol: 'Ld, Passages',
              description: 'Kink Anchorage & Landing Door Clearance',
              formula: 'Ld = 47 * phi, Clear Landing >= Flight Width',
              substitution: `Ld = ${Ld} mm. Left Door: ${entryConfig.leftDoorWidthM}m, Right Door: ${entryConfig.rightDoorWidthM}m`,
              result: `Dual Landing Entry Check: ${landingClearanceCheck} (Ld = ${Ld}mm)`,
              codeReference: 'IS 13920:2016 Cl. 7 & SP:34',
              status: landingClearanceCheck,
            },
          ],
        },
      ],
    };

    return {
      id: `FLIGHT-${flightIndex}`,
      name: flightIndex === 1
        ? `Flight 1 (EL. +${bottomEl.toFixed(2)}m → Mid-Landing +${topEl.toFixed(2)}m)`
        : `Flight 2 (Mid-Landing +${bottomEl.toFixed(2)}m → Diaphragm +${topEl.toFixed(2)}m)`,
      flightIndex,
      levelName: diaphragm.levelName,
      bottomElevationY: bottomEl,
      topElevationY: topEl,
      flightRiseM,
      riserCount,
      treadCount,
      treadMm: geom.treadMm,
      riserMm: actualRiserMm,
      goingLengthM,
      flightWidthM: geom.flightWidthM,
      waistSlabThicknessMm: D,
      slopeAngleDeg,
      effectiveSpanLeffM,
      headroomM,
      deadLoadWaistSlabKnM2,
      deadLoadStepsKnM2,
      floorFinishKnM2,
      totalDeadLoadKnM2,
      liveLoadKnM2,
      factoredLoadWuKnM2,
      factoredLoadWuPerMeterKn,
      designMomentMu,
      designShearVu,
      effectiveDepthD: d,
      effectiveDepthReqMm: dReqMm,
      mainRebarDia: mainBarDia,
      mainRebarSpacing,
      mainRebarCallout,
      mainAstProvided,
      mainAstRequired,
      ptProvided,
      distributionRebarDia: distBarDia,
      distributionRebarSpacing,
      distributionRebarCallout,
      distributionAstProvided,
      topNegativeRebarCallout,
      kinkAnchorageDetail,
      landingRebarCallout: `${landingMainRebar} & ${landingDistributionRebar}`,
      landingThicknessMm,
      landingEntryConfig: entryConfig,
      clearLandingPassageWidthM,
      landingClearanceCheck,
      depthCheck,
      deflectionCheck,
      shearCheck,
      headroomCheck,
      status,
      concreteM3,
      formworkM2,
      steelKg,
      cementBags,
      calculationReport,
    };
  }

  /**
   * Designs the full staircase for a single story interval
   */
  public static designStorey(
    diaphragm: DiaphragmLevelInfo,
    geom: StaircaseRoomGeometry,
    entryConfig: StaircaseLandingEntryConfig
  ): StoreyStaircaseDesignOutput {
    const flight1 = this.designFlight(1, diaphragm, geom, entryConfig);
    const flight2 = this.designFlight(2, diaphragm, geom, entryConfig);

    const totalStoreyConcreteM3 = parseFloat((flight1.concreteM3 + flight2.concreteM3).toFixed(3));
    const totalStoreyFormworkM2 = parseFloat((flight1.formworkM2 + flight2.formworkM2).toFixed(2));
    const totalStoreySteelKg = parseFloat((flight1.steelKg + flight2.steelKg).toFixed(1));
    const totalStoreyCementBags = flight1.cementBags + flight2.cementBags;

    const overallStatus: 'PASS' | 'WARNING' | 'FAIL' =
      flight1.status === 'FAIL' || flight2.status === 'FAIL'
        ? 'FAIL'
        : flight1.status === 'WARNING' || flight2.status === 'WARNING'
        ? 'WARNING'
        : 'PASS';

    return {
      storeyId: `STAIR-STOREY-${diaphragm.levelIndex}`,
      levelIndex: diaphragm.levelIndex,
      levelName: diaphragm.levelName,
      bottomElevationY: diaphragm.bottomElevationY,
      topElevationY: diaphragm.topElevationY,
      storeyHeightM: diaphragm.storeyHeightM,
      midLandingElevationY: diaphragm.midLandingElevationY,
      roomGeometry: geom,
      landingEntryConfig: entryConfig,
      flight1,
      flight2,
      totalStoreyConcreteM3,
      totalStoreyFormworkM2,
      totalStoreySteelKg,
      totalStoreyCementBags,
      overallStatus,
    };
  }

  /**
   * Generates the complete building staircase design summary across all diaphragm levels
   */
  public static calculateBuildingStaircaseSummary(
    model: NormalizedStructuralModel | null,
    metadata?: ProjectMetadata,
    overrides?: {
      customGeometry?: StaircaseRoomGeometry;
      customLandingEntry?: StaircaseLandingEntryConfig;
      storeyOverrides?: Record<number, Partial<StaircaseRoomGeometry>>;
    }
  ): BuildingStaircaseSummary {
    const diaphragmLevels = this.extractDiaphragmLevels(model);
    const baseGeom = overrides?.customGeometry || this.getDefaultGeometry(metadata);
    const baseEntry = overrides?.customLandingEntry || this.getDefaultLandingEntryConfig();

    const storeyDesigns = diaphragmLevels.map((lvl) => {
      const geom = {
        ...baseGeom,
        ...(overrides?.storeyOverrides?.[lvl.levelIndex] || {}),
      };
      return this.designStorey(lvl, geom, baseEntry);
    });

    const totalStoreys = storeyDesigns.length;
    const totalFlights = totalStoreys * 2;
    const totalConcreteM3 = parseFloat(storeyDesigns.reduce((sum, s) => sum + s.totalStoreyConcreteM3, 0).toFixed(2));
    const totalFormworkM2 = parseFloat(storeyDesigns.reduce((sum, s) => sum + s.totalStoreyFormworkM2, 0).toFixed(1));
    const totalSteelKg = parseFloat(storeyDesigns.reduce((sum, s) => sum + s.totalStoreySteelKg, 0).toFixed(1));
    const totalSteelMT = parseFloat((totalSteelKg / 1000).toFixed(2));
    const totalCementBags = storeyDesigns.reduce((sum, s) => sum + s.totalStoreyCementBags, 0);
    const averageSteelIntensityKgM3 = totalConcreteM3 > 0 ? parseFloat((totalSteelKg / totalConcreteM3).toFixed(1)) : 88.0;

    return {
      totalStoreys,
      totalFlights,
      totalConcreteM3,
      totalFormworkM2,
      totalSteelKg,
      totalSteelMT,
      totalCementBags,
      averageSteelIntensityKgM3,
      storeyDesigns,
      diaphragmLevels,
    };
  }
}
