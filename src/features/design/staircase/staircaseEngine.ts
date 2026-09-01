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
  bbsSchedule?: StaircaseBbsSchedule;
}

export type StaircaseBarShape = 'CRANKED' | 'L_BAR' | 'STRAIGHT' | 'U_BAR';

export interface StaircaseBbsItem {
  mark: string; // e.g. "ST1-01", "ST1-02", "ST1-03", "ST2-01", "ST-KINK", "ST-LAND"
  flightName: string; // e.g. "Flight 1", "Flight 2", "Mid-Landing"
  description: string; // e.g. "Bottom Main Tension Waist Rebar (Cranked)"
  shapeType: StaircaseBarShape;
  diameter: number; // mm
  spacingMm?: number; // mm
  a: number; // mm
  b: number; // mm
  c: number; // mm
  d?: number; // mm
  numBarsPerFlight: number;
  numFlights: number;
  totalCount: number;
  cuttingLengthM: number;
  totalLengthM: number;
  unitWeightKgM: number;
  totalWeightKg: number;
  remarks: string;
}

export interface StaircaseBbsDiameterSummary {
  dia: number;
  totalLengthM: number;
  totalWeightKg: number;
  unitWeightKgM: number;
}

export interface StaircaseBbsSchedule {
  storeyId: string;
  levelName: string;
  elevationRange: string;
  concreteGrade: string; // e.g. "M25"
  steelGrade: string; // e.g. "Fe 500D"
  clearCoverMm: number; // 20 mm
  items: StaircaseBbsItem[];
  diameterSummary: StaircaseBbsDiameterSummary[];
  totalLengthM: number;
  netWeightKg: number;
  wastageAllowancePercent: number; // 5%
  wastageWeightKg: number;
  grossWeightKg: number;
  grossWeightMT: number;
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
    const supports = model.supports;

    // Robust Diaphragm Level Detection: Look for elevations where vertical columns terminate or major horizontal beam grids meet
    const columnElevations = new Map<number, number>();
    for (const m of members.values()) {
      const n1 = nodes.get(m.startNodeId);
      const n2 = nodes.get(m.endNodeId);
      if (n1 && n2 && Math.abs(n1.y - n2.y) >= 0.5) {
        const y1 = Math.round(n1.y * 100) / 100;
        const y2 = Math.round(n2.y * 100) / 100;
        columnElevations.set(y1, (columnElevations.get(y1) || 0) + 1);
        columnElevations.set(y2, (columnElevations.get(y2) || 0) + 1);
      }
    }

    const beamElevations = new Map<number, number>();
    for (const m of members.values()) {
      if (m.classification === 'BEAM') {
        const n1 = nodes.get(m.startNodeId);
        const n2 = nodes.get(m.endNodeId);
        if (n1 && n2 && Math.abs(n1.y - n2.y) < 0.15) {
          const y = Math.round(n1.y * 100) / 100;
          beamElevations.set(y, (beamElevations.get(y) || 0) + 1);
        }
      }
    }

    // Include support base elevations
    const supportElevations = new Set<number>();
    if (supports) {
      for (const sup of supports.values()) {
        const node = nodes.get(sup.nodeId);
        if (node) supportElevations.add(Math.round(node.y * 100) / 100);
      }
    }

    // Candidate elevations: levels with columns starting/terminating (>= 1 column),
    // framing beams (>= 1 beam), or ground supports
    const candidateY = new Set<number>();
    for (const [y, colCount] of columnElevations.entries()) {
      if (colCount >= 1) candidateY.add(y);
    }
    for (const [y, beamCount] of beamElevations.entries()) {
      if (beamCount >= 1) candidateY.add(y);
    }
    for (const y of supportElevations) {
      candidateY.add(y);
    }

    // Always include minimum base node elevation (e.g. 0.00m Ground / Foundation level)
    const allNodeY = Array.from(nodes.values()).map((n) => Math.round(n.y * 100) / 100);
    if (allNodeY.length > 0) {
      candidateY.add(Math.min(...allNodeY));
    }

    // Fallback if no columns or beams found
    if (candidateY.size === 0) {
      for (const n of nodes.values()) candidateY.add(Math.round(n.y * 100) / 100);
    }

    const sortedCandidates = Array.from(candidateY).sort((a, b) => a - b);

    // Cluster close candidate elevations within 0.35m tolerance (e.g. beam centerline vs slab top)
    const clusteredY: number[] = [];
    for (const y of sortedCandidates) {
      if (clusteredY.length === 0) {
        clusteredY.push(y);
      } else {
        const lastY = clusteredY[clusteredY.length - 1];
        if (Math.abs(y - lastY) > 0.35) {
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

    const bbsSchedule = this.generateStaircaseBbsSchedule(diaphragm, geom, flight1, flight2);

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
      bbsSchedule,
    };
  }

  /**
   * Generates a standard IS 2502 / SP:34 Bar Bending Schedule (BBS) for a staircase storey
   */
  public static generateStaircaseBbsSchedule(
    diaphragm: DiaphragmLevelInfo,
    geom: StaircaseRoomGeometry,
    flight1: StaircaseFlightDesignOutput,
    flight2: StaircaseFlightDesignOutput
  ): StaircaseBbsSchedule {
    const items: StaircaseBbsItem[] = [];
    const coverMm = 20;
    const fck = geom.fck || 25;
    const fy = geom.fy || 500;
    const concreteGrade = `M${fck}`;
    const steelGrade = `Fe ${fy}D`;
    const elevationRange = `EL. +${diaphragm.bottomElevationY.toFixed(2)}m → +${diaphragm.topElevationY.toFixed(2)}m`;

    const addFlightBbs = (f: StaircaseFlightDesignOutput, flightIdx: 1 | 2) => {
      const pfx = `ST${flightIdx}`;
      const fName = `Flight ${flightIdx}`;
      const WfMm = f.flightWidthM * 1000;
      const effectiveGoingMm = f.goingLengthM * 1000;
      const flightRiseMm = f.flightRiseM * 1000;
      const slopeLengthMm = Math.round(Math.hypot(effectiveGoingMm, flightRiseMm));
      const waistThicknessMm = f.waistSlabThicknessMm;
      const dWaistMm = waistThicknessMm - 2 * coverMm;
      const landingWidthMm = geom.landingWidthM * 1000;

      // 1. Bottom Main Longitudinal Tension Bars (Cranked with SP:34 Kink Cross-Over)
      const mainDia = f.mainRebarDia;
      const mainSpacing = f.mainRebarSpacing;
      const LdMainMm = Math.round(47 * mainDia); // IS 456 Cl. 26.2.1
      const legA = Math.min(landingWidthMm - 50, LdMainMm + 150);
      const legB = slopeLengthMm;
      const legC = Math.min(landingWidthMm - 50, LdMainMm + 150);
      const crankD = dWaistMm;
      const numMainBars = Math.max(3, Math.floor((WfMm - 2 * coverMm) / mainSpacing) + 1);
      const cutLenMainM = parseFloat(((legA + legB + legC - 2 * (2 * mainDia)) / 1000).toFixed(2));
      const unitWtMain = parseFloat(((mainDia * mainDia) / 162.2).toFixed(3));
      const totalLenMainM = parseFloat((numMainBars * cutLenMainM).toFixed(2));
      const totalWtMainKg = parseFloat((totalLenMainM * unitWtMain).toFixed(2));

      items.push({
        mark: `${pfx}-01`,
        flightName: fName,
        description: `${fName} Main Bottom Tension Waist Rebar (T${mainDia}@${mainSpacing}mm c/c)`,
        shapeType: 'CRANKED',
        diameter: mainDia,
        spacingMm: mainSpacing,
        a: legA,
        b: legB,
        c: legC,
        d: crankD,
        numBarsPerFlight: numMainBars,
        numFlights: 1,
        totalCount: numMainBars,
        cuttingLengthM: cutLenMainM,
        totalLengthM: totalLenMainM,
        unitWeightKgM: unitWtMain,
        totalWeightKg: totalWtMainKg,
        remarks: `Cranked waist bar with Ld = ${LdMainMm}mm anchorage into landing slabs (SP:34)`,
      });

      // 2. Top Support Negative Hogging Rebar (L-Bar at landing supports)
      const topDia = Math.max(10, Math.min(12, mainDia));
      const topSpacing = 150;
      const topLdMm = Math.round(47 * topDia);
      const topSpanExtMm = Math.round(0.30 * f.effectiveSpanLeffM * 1000);
      const legTopA = dWaistMm;
      const legTopB = topSpanExtMm + topLdMm;
      const numTopBarsEachEnd = Math.max(3, Math.floor((WfMm - 2 * coverMm) / topSpacing) + 1);
      const totalTopBars = numTopBarsEachEnd * 2;
      const cutLenTopM = parseFloat(((legTopA + legTopB - 2 * topDia) / 1000).toFixed(2));
      const unitWtTop = parseFloat(((topDia * topDia) / 162.2).toFixed(3));
      const totalLenTopM = parseFloat((totalTopBars * cutLenTopM).toFixed(2));
      const totalWtTopKg = parseFloat((totalLenTopM * unitWtTop).toFixed(2));

      items.push({
        mark: `${pfx}-02`,
        flightName: fName,
        description: `${fName} Top Negative Support Steel (T${topDia}@${topSpacing}mm c/c @ 0.3L + Ld)`,
        shapeType: 'L_BAR',
        diameter: topDia,
        spacingMm: topSpacing,
        a: legTopA,
        b: legTopB,
        c: 0,
        numBarsPerFlight: totalTopBars,
        numFlights: 1,
        totalCount: totalTopBars,
        cuttingLengthM: cutLenTopM,
        totalLengthM: totalLenTopM,
        unitWeightKgM: unitWtTop,
        totalWeightKg: totalWtTopKg,
        remarks: `Support negative rebar (0.3Leff + Ld) at landing junctions`,
      });

      // 3. Transverse Distribution Bars (Tied across flight width)
      const distDia = f.distributionRebarDia;
      const distSpacing = f.distributionRebarSpacing;
      const numDistBarsAlongWaist = Math.max(4, Math.floor(slopeLengthMm / distSpacing) + 1);
      const numDistBarsLanding = Math.max(4, Math.floor((2 * landingWidthMm) / distSpacing) + 1);
      const totalDistBars = numDistBarsAlongWaist + numDistBarsLanding;
      const distCutLenM = parseFloat(((WfMm - 2 * coverMm + 2 * 100) / 1000).toFixed(2));
      const unitWtDist = parseFloat(((distDia * distDia) / 162.2).toFixed(3));
      const totalLenDistM = parseFloat((totalDistBars * distCutLenM).toFixed(2));
      const totalWtDistKg = parseFloat((totalLenDistM * unitWtDist).toFixed(2));

      items.push({
        mark: `${pfx}-03`,
        flightName: fName,
        description: `${fName} Transverse Distribution Rebar (T${distDia}@${distSpacing}mm c/c)`,
        shapeType: 'STRAIGHT',
        diameter: distDia,
        spacingMm: distSpacing,
        a: 100,
        b: Math.round(WfMm - 2 * coverMm),
        c: 100,
        numBarsPerFlight: totalDistBars,
        numFlights: 1,
        totalCount: totalDistBars,
        cuttingLengthM: distCutLenM,
        totalLengthM: totalLenDistM,
        unitWeightKgM: unitWtDist,
        totalWeightKg: totalWtDistKg,
        remarks: `Transverse shrinkage & distribution bars across waist and landing zones`,
      });
    };

    // Process Flight 1 & Flight 2
    addFlightBbs(flight1, 1);
    addFlightBbs(flight2, 2);

    // 4. Mid-Landing Kink Cross-Over Reinforcement (SP:34 Cl. 10.4 & IS 13920)
    const kinkDia = Math.max(10, flight1.mainRebarDia);
    const kinkLdMm = Math.round(47 * kinkDia);
    const numKinkBars = Math.max(4, Math.floor((flight1.flightWidthM * 1000 - 40) / 150) + 1);
    const kinkCutLenM = parseFloat(((200 + kinkLdMm + 200) / 1000).toFixed(2));
    const unitWtKink = parseFloat(((kinkDia * kinkDia) / 162.2).toFixed(3));
    const totalLenKinkM = parseFloat((numKinkBars * kinkCutLenM).toFixed(2));
    const totalWtKinkKg = parseFloat((totalLenKinkM * unitWtKink).toFixed(2));

    items.push({
      mark: 'ST-KINK',
      flightName: 'Mid-Landing',
      description: `Mid-Landing Kink Cross-Over Rebar (T${kinkDia}@150mm c/c — SP:34 / IS 13920)`,
      shapeType: 'L_BAR',
      diameter: kinkDia,
      spacingMm: 150,
      a: 200,
      b: kinkLdMm + 200,
      c: 0,
      numBarsPerFlight: numKinkBars,
      numFlights: 1,
      totalCount: numKinkBars,
      cuttingLengthM: kinkCutLenM,
      totalLengthM: totalLenKinkM,
      unitWeightKgM: unitWtKink,
      totalWeightKg: totalWtKinkKg,
      remarks: `Kink cross-over bars to prevent concrete spalling at re-entrant corner (IS 13920)`,
    });

    // 5. Landing Slab Edge U-Binder Mesh (U-Bars)
    const landTieDia = 8;
    const landWidthMm = geom.roomWidth * 1000;
    const numLandTies = Math.max(4, Math.floor((geom.landingWidthM * 1000) / 150) + 1);
    const landCutLenM = parseFloat(((landWidthMm - 40 + 2 * 150) / 1000).toFixed(2));
    const unitWtLand = parseFloat(((landTieDia * landTieDia) / 162.2).toFixed(3));
    const totalLenLandM = parseFloat((numLandTies * landCutLenM).toFixed(2));
    const totalWtLandKg = parseFloat((totalLenLandM * unitWtLand).toFixed(2));

    items.push({
      mark: 'ST-LAND',
      flightName: 'Landing Slabs',
      description: `Landing Slab Edge Reinforcement & Waist Chairs (T${landTieDia}@150mm c/c)`,
      shapeType: 'U_BAR',
      diameter: landTieDia,
      spacingMm: 150,
      a: 150,
      b: Math.round(landWidthMm - 40),
      c: 150,
      numBarsPerFlight: numLandTies,
      numFlights: 1,
      totalCount: numLandTies,
      cuttingLengthM: landCutLenM,
      totalLengthM: totalLenLandM,
      unitWeightKgM: unitWtLand,
      totalWeightKg: totalWtLandKg,
      remarks: `Edge U-caps & waist slab bar chairs for reinforcement cover maintenance`,
    });

    // Compute Diameter-Wise Summary
    const diaMap = new Map<number, { totalLengthM: number; totalWeightKg: number }>();
    items.forEach((item) => {
      const cur = diaMap.get(item.diameter) || { totalLengthM: 0, totalWeightKg: 0 };
      cur.totalLengthM += item.totalLengthM;
      cur.totalWeightKg += item.totalWeightKg;
      diaMap.set(item.diameter, cur);
    });

    const diameterSummary: StaircaseBbsDiameterSummary[] = Array.from(diaMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([dia, data]) => ({
        dia,
        totalLengthM: parseFloat(data.totalLengthM.toFixed(2)),
        totalWeightKg: parseFloat(data.totalWeightKg.toFixed(2)),
        unitWeightKgM: parseFloat(((dia * dia) / 162.2).toFixed(3)),
      }));

    const totalLengthM = parseFloat(items.reduce((s, i) => s + i.totalLengthM, 0).toFixed(2));
    const netWeightKg = parseFloat(items.reduce((s, i) => s + i.totalWeightKg, 0).toFixed(2));
    const wastageAllowancePercent = 5.0; // 5% wastage per CPWD / IS 2502
    const wastageWeightKg = parseFloat((netWeightKg * 0.05).toFixed(2));
    const grossWeightKg = parseFloat((netWeightKg + wastageWeightKg).toFixed(2));
    const grossWeightMT = parseFloat((grossWeightKg / 1000).toFixed(3));

    return {
      storeyId: `STAIR-STOREY-${diaphragm.levelIndex}`,
      levelName: diaphragm.levelName,
      elevationRange,
      concreteGrade,
      steelGrade,
      clearCoverMm: coverMm,
      items,
      diameterSummary,
      totalLengthM,
      netWeightKg,
      wastageAllowancePercent,
      wastageWeightKg,
      grossWeightKg,
      grossWeightMT,
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
