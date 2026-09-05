import { StructuralClassification, ElementDesignStatus } from '@/types';

export interface Node3D {
  id: number;
  x: number; // meters
  y: number; // meters (vertical elevation in STAAD)
  z: number; // meters
  isSupport?: boolean;
}

export interface CrossSection {
  type: 'RECTANGULAR' | 'CIRCULAR' | 'TEE' | 'I_SECTION' | 'SHELL_THICKNESS' | 'GENERAL';
  yd?: number; // Depth / Diameter in meters
  zd?: number; // Width in meters
  thickness?: number; // Shell thickness in meters
  name?: string;
}

export interface Member3D {
  id: number;
  startNodeId: number;
  endNodeId: number;
  length: number; // meters
  classification: StructuralClassification;
  isAutoClassified: boolean;
  section: CrossSection;
  materialName: string;
  betaAngle?: number;
  designStatus: ElementDesignStatus;
}

export interface Plate3D {
  id: number;
  nodeIds: number[]; // 3 or 4 joint IDs
  thickness: number; // meters
  materialName: string;
  classification: 'SLAB' | 'WALL' | 'PLATE';
  isLiftCore?: boolean;
}

export interface Support3D {
  nodeId: number;
  type: 'FIXED' | 'PINNED' | 'ROLLER' | 'SPRING' | 'INCLINED';
  releases: {
    fx: boolean; // true = released/free, false = restrained
    fy: boolean;
    fz: boolean;
    mx: boolean;
    my: boolean;
    mz: boolean;
  };
  springConstants?: {
    kx?: number;
    ky?: number;
    kz?: number;
  };
}

export type LoadType = 'DEAD' | 'LIVE' | 'WIND' | 'SEISMIC' | 'MASS' | 'TEMPERATURE' | 'COMBINATION' | 'OTHER';

export interface LoadCase {
  id: number;
  title: string;
  type: LoadType;
  direction?: 'X' | 'Y' | 'Z' | '-X' | '-Y' | '-Z';
  isCombination: boolean;
}

export interface LoadCombination {
  id: number;
  title: string;
  factors: { loadCaseId: number; factor: number }[];
}

export interface JointReaction {
  nodeId: number;
  loadCaseId: number;
  fx: number; // kN
  fy: number; // kN (Vertical)
  fz: number; // kN
  mx: number; // kNm
  my: number; // kNm
  mz: number; // kNm
}

export interface MemberForceRecord {
  memberId: number;
  loadCaseId: number;
  sectionLocation: number; // distance from start in meters
  axial: number; // Fx in kN (+ = tension, - = compression)
  vy: number; // Shear Y in kN
  vz: number; // Shear Z in kN
  torsion: number; // Mx in kNm
  my: number; // Moment Y in kNm
  mz: number; // Moment Z in kNm
}

export interface MemberDesignSummary {
  memberId: number;
  classification: StructuralClassification;
  sectionDimensions: string;
  governingLoadCase: number;
  maxAxial: number; // kN
  maxShear: number; // kN
  maxMoment: number; // kNm
  astTopReq?: number; // max top required steel from STAAD (mm²)
  astBottomReq?: number; // max bottom required steel from STAAD (mm²)
  astTopSections?: number[]; // 5 sections [0, L/4, L/2, 3L/4, L]
  astBottomSections?: number[]; // 5 sections [0, L/4, L/2, 3L/4, L]
  status: ElementDesignStatus;
  notes?: string[];
}

export interface StoryDriftRecord {
  storyName: string;
  height: number; // meters
  loadCaseId: number;
  avgDispCm: number;
  driftCm: number;
  driftRatio: number;
  allowableRatio: number;
  status: 'PASS' | 'FAIL' | 'WARNING';
}

export interface MemberLoad {
  id?: string;
  memberId: number;
  loadPattern: string; // 'DEAD' | 'LIVE' | 'SDL' | 'WALL' | 'EQX' | 'EQZ'
  type: 'UNIFORM' | 'POINT' | 'TRAPEZOIDAL';
  w1: number; // Magnitude in kN/m (UDL) or kN (Point)
  w2?: number; // End magnitude for trapezoidal
  d1?: number; // Distance from start node (m)
  d2?: number; // Distance for end (m)
  direction: 'GLOBAL_Y' | 'LOCAL_Y' | 'GLOBAL_X' | 'GLOBAL_Z';
}

export interface ShellLoad {
  id?: string;
  plateId?: number;
  levelY: number;
  loadPattern: string; // 'DEAD' | 'LIVE' | 'SDL'
  pressure: number; // kN/m²
  distributionType: 'TWO_WAY' | 'ONE_WAY_X' | 'ONE_WAY_Z';
}

export interface MemberModifier {
  memberId: number;
  axialArea: number; // 1.0 default
  shearY: number; // 1.0 default
  shearZ: number; // 1.0 default
  torsionJ: number; // 0.20 cracked default
  momentIyy: number; // 0.35 beam / 0.70 col
  momentIzz: number; // 0.35 beam / 0.70 col
}

export interface NormalizedStructuralModel {
  nodes: Map<number, Node3D>;
  members: Map<number, Member3D>;
  plates: Map<number, Plate3D>;
  supports: Map<number, Support3D>;
  loadCases: Map<number, LoadCase>;
  loadCombinations: Map<number, LoadCombination>;
  memberLoads?: Map<number, MemberLoad[]>;
  shellLoads?: ShellLoad[];
  /**
   * Explicit external-load metadata captured from a real STAAD input model
   * (.STD/.ANL). When present, the FEM solver applies the actual STAAD loads
   * (concrete self-weight at the material density + explicit member UDLs)
   * instead of generic heuristics, which is what makes re-analysis match STAAD.
   */
  extLoads?: {
    source: 'STAAD' | 'APP';
    concreteDensity?: number; // kN/m3
    concreteE?: number; // kN/m2
    selfweightFactor?: number; // signed, e.g. -1 (downward)
    selfweightAxis?: 'Y' | 'Z';
  };
  memberModifiers?: Map<number, MemberModifier>;
  reactions: JointReaction[]; // grouped by node and load case
  memberForces: MemberForceRecord[];
  nodeDisplacements?: Map<number, { [loadCaseId: number]: [number, number, number, number, number, number] }>; // [ux, uy, uz, rx, ry, rz] in m / rad
  designSummaries?: Map<number, MemberDesignSummary>;
  storyDrifts: StoryDriftRecord[];
  boundingBox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  statistics: {
    totalNodes: number;
    totalMembers: number;
    totalBeams: number;
    totalColumns: number;
    totalPlates: number;
    totalSupports: number;
    totalLoadCases: number;
    totalCombinations: number;
    maxElevation: number;
    baseElevation: number;
  };
}
