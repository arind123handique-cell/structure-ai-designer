import { ProjectMetadata } from '@/types';
import {
  Node3D,
  Member3D,
  Plate3D,
  Support3D,
  LoadCase,
  LoadCombination,
  JointReaction,
  MemberForceRecord,
  MemberDesignSummary,
  StoryDriftRecord,
} from '@/features/model/types';
import { EngineeringWarning } from '@/features/warnings/types';

export interface SerializedStructuralModel {
  nodes: [number, Node3D][];
  members: [number, Member3D][];
  plates: [number, Plate3D][];
  supports: [number, Support3D][];
  loadCases: [number, LoadCase][];
  loadCombinations: [number, LoadCombination][];
  reactions: JointReaction[];
  memberForces: MemberForceRecord[];
  designSummaries?: [number, MemberDesignSummary][];
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

export interface StoredProject {
  metadata: ProjectMetadata;
  model: SerializedStructuralModel;
  warnings: EngineeringWarning[];
  rawAnlContent?: string;
  projectPileTypes?: any[];
  supportPileAssignments?: Record<number, string>;
  customPileCapOverrides?: Record<number, any>;
  customCombinedCapOverrides?: Record<string, any>;
  manualMergedPileCapGroups?: number[][];
  detachedCombinedCapNodeIds?: number[];
  allowedColumnRebarDiameters?: number[];
  allowedBeamRebarDiameters?: number[];
  universalRebarSelection?: {
    longitudinalDiameters: number[];
    shearTieDiameters: number[];
    isConfigured: boolean;
  };
  savedColumnDesigns?: Record<number, any>;
  savedBeamDesigns?: Record<number, any>;
  savedShearWallDesigns?: Record<number, any>;
  savedGradeBeamDesigns?: any[];
  savedFootingDesigns?: Record<number, any>;
  customColumnRebarOverrides?: Record<number, any>;
  customBeamRebarOverrides?: Record<number, any>;
  customShearWallOverrides?: Record<number, any>;
}
