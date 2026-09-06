export interface RCDCMetadata {
  fileName: string;
  rcdcVersion: string;
  dbVersion: string;
  projectName?: string;
  engineer?: string;
  designCode?: string;
  client?: string;
  date?: string;
  analysisFileName?: string;
}

export interface RCDCLevel {
  levelNo: number;
  name: string;
  heightMm: number;
  elevation: number; // m above base
}

export interface RCDCNode {
  nodeNo: number;
  x: number; // m
  y: number; // m
  z: number; // m
}

export interface RCDCSection {
  frameSectionId: number;
  name: string;
  depthMm: number; // D (mm)
  widthMm: number; // b (mm)
  areaCm2: number;
  ixxCm4: number;
  izzCm4: number;
}

export interface RCDCMaterial {
  concreteGradeId: number;
  name: string; // e.g. "M30"
  fck: number; // N/mm2
}

export interface RCDCRebarType {
  reinforcementTypeId: number;
  name: string; // e.g. "Fe500 D", "Fe415"
  fy: number; // N/mm2
}

export interface RCDCLoadCase {
  loadId: number;
  name: string;
  symbol: string; // e.g. DL, LL, EQ-X
  type: string; // e.g. DEAD, LIVE, EQ, WIND, TEMP, SNOW
}

export interface RCDCLoadCombinationItem {
  loadCaseId: number;
  factor: number;
}

export interface RCDCLoadCombination {
  combId: number;
  name: string;
  factors: RCDCLoadCombinationItem[];
}

export interface RCDCForceRecord {
  loadCombId?: number;
  loadCaseId?: number;
  axial: number; // kN
  shearMajor: number; // kN
  shearMinor: number; // kN
  torsion: number; // kNm
  momentMajor: number; // kNm (major-axis bending, top/bottom in beams)
  momentMinor: number; // kNm
}

export interface RCDCEnvelope {
  maxAxial: number;
  minAxial: number;
  maxShear: number;
  maxTorsion: number;
  maxMomentMajor: number;
  maxMomentMinor: number;
  governingLoadCombId?: number;
}

export interface RCDCBeamStation {
  locationMm: number;
  astLocation: number; // 1 = support, 2 = midspan, 3 = both
  momentTop: number; // kNm
  momentBottom: number; // kNm
  astTopReq: number; // mm2
  astTopProv: number; // mm2
  astBottomReq: number; // mm2
  astBottomProv: number; // mm2
  designFlagTop: number;
  designFlagBottom: number;
  torsion: number; // kNm
  shear: number; // kN
  asvCalc: number; // mm2
  shearSpacingCal: number; // mm
  shearSpacingProv: number; // mm
  shearDiaMm: number;
  shearLegs: number;
  shearDesignFlag: number;
  astTopLoadCombId: number;
  astBottomLoadCombId: number;
  shearLoadCombId: number;
}

export interface RCDCBeamZone {
  zoneNo: number;
  startMm: number;
  endMm: number;
  topAstLoc: number; // 1 support, 2 midspan, 3 both
  bottomAstLoc: number;
  momentTop: number;
  momentBottom: number;
  astTopProv: number;
  astBottomProv: number;
  shear: number;
  asvProv: number;
  shearSpacingMm: number;
  torsion: number;
  rebarTop?: RCDCBarLayer;
  rebarBottom?: RCDCBarLayer;
  stirrup?: RCDCShearZone;
}

export interface RCDCBar {
  diameterMm: number;
  count: number;
  areaMm2: number; // count * pi*d^2/4
}

export interface RCDCBarLayer {
  zoneNo: number;
  ast: number; // mm2
  bars: RCDCBar[];
  basicZone: number; // 1-Top, 2-Bottom, 3-Shear
  designLocation: number; // 1 support, 2 midspan
}

export interface RCDCShearZone {
  zoneNo: number;
  spacingMm: number;
  diameterMm: number;
  legs: number;
  asvMm2: number;
}

export interface RCDCBeam {
  beamNo: number;
  name: string;
  startNodeNo: number;
  endNodeNo: number;
  levelNo: number;
  frameSectionId: number;
  widthMm: number;
  depthMm: number;
  clearSpanMm: number;
  concreteGradeId: number;
  steelGradeId: number;
  coverMm: number;
  reinforcementTypeId: number;
  envelope: RCDCEnvelope;
  stations: RCDCBeamStation[];
  zones: RCDCBeamZone[];
  topLayers: RCDCBarLayer[];
  bottomLayers: RCDCBarLayer[];
  shearZones: RCDCShearZone[];
}

export interface RCDCLinkZone {
  zoneNo: number;
  type: number; // 1 = confinement (end), 2 = main body
  startMm: number;
  endMm: number;
  spacingMm: number;
  diameterMm: number;
  legs: number;
  linkSets: number;
  asvMm2: number;
}

export interface RCDCColumn {
  columnNo: number;
  name: string;
  startNodeNo: number;
  endNodeNo: number;
  levelNo: number;
  frameSectionId: number;
  familyNo: number;
  widthMm: number; // b (mm)
  depthMm: number; // D (mm)
  unsupportedLengthMm: number;
  concreteGradeId: number;
  steelGradeId: number;
  reinforcementTypeId: number;
  coverMm: number;
  interactionRatio: number;
  braced: boolean;
  effectiveLengthFactorMajor: number;
  effectiveLengthFactorMinor: number;
  designFail: boolean;
  envelope: RCDCEnvelope;
  mainBars: RCDCBar[];
  linkZones: RCDCLinkZone[];
  statusAstProvidedMm2: number;
}

export interface RCDCSlabEdges {
  edgeId: number;
  startNodeNo: number;
  endNodeNo: number;
  edgeType: string; // 'b' beam, 'c' column, 'o' open
  edgeName: string;
}

export interface RCDCSlabPanel {
  panelNo: number;
  areaNo: number;
  mark: string;
  levelNo: number;
  thicknessMm: number;
  spanTypeId: number;
  designDirection: string;
  designCodeId: number;
  concreteGradeId: number;
  steelGradeId: number;
  concreteName: string;
  steelName: string;
  nodeNos: number[];
  edges: RCDCSlabEdges[];
  widthMm: number;
  heightMm: number;
  dim1Mm: number;
  dim2Mm: number;
  liveLoad: number;
  finishedLoad: number;
  coverMm: number;
  deflectionChecked: boolean;
  // Reinforcement by Panel_Design_Details / Panel_Reinforcement_Detail
  astDesign: number; // mm2/m
  astReqMain: number; // mm2/m
  astProvMain: number; // mm2/m
  mainBarDiameter: number;
  mainBarSpacing: number;
  mainBarDirection: string;
  astReqDistribution: number;
  astProvDistribution: number;
  distBarDiameter: number;
  distBarSpacing: number;
  edgeBeams: RCDCBeamDependency[];
  reinforcement: RCDCSlabReinforcement[];
  span: number;
  averageClearSpan: number;
  liveLoadKgM2: number;
}

export interface RCDCBeamDependency {
  beamNo: number;
  spanId: number;
}

export interface RCDCSlabReinforcement {
  reinforcementTypeId: number;
  bendingMoment: number; // kNm/m
  astReqMm2PerM: number; // mm2/m
  astProvMm2PerM: number; // mm2/m
  barId: number;
  barDiameterMm: number;
  barSpacingMm: number;
  legs: number;
  curtailmentLocation: number;
}

export interface RCDCSlabSchedule {
  panelNo: number;
  mark: string;
  thickness: number;
  schedule: string;
  loadPsf: number;
}

export interface RCDCDocument {
  format: 'RCDC';
  schemaVersion: 1;
  metadata: RCDCMetadata;
  levels: RCDCLevel[];
  nodes: RCDCNode[];
  supports: number[]; // nodeNos with supports
  sections: RCDCSection[];
  beams: RCDCBeam[];
  columns: RCDCColumn[];
  slabs: RCDCSlabPanel[];
  slabSchedule: RCDCSlabSchedule[];
  loadCases: RCDCLoadCase[];
  loadCombinations: RCDCLoadCombination[];
  concreteGrades: RCDCMaterial[];
  steelGrades: RCDCRebarType[];
  barDiameters: Record<number, RCDCBar>;
  warnings: string[];
}

export const RCDC_FORMAT = 'RCDC';