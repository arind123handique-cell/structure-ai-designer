import { create } from 'zustand';
import { StoredProject } from './types';
import { ProjectStorage } from './projectStorage';
import { ANLParser } from '../anl/anlParser';
import {
  NormalizedStructuralModel,
  Member3D,
  Node3D,
  Support3D,
  CrossSection,
  MemberLoad,
  ShellLoad,
  MemberModifier,
  LoadCase,
  LoadCombination,
} from '../model/types';
import { ProjectMetadata, DesignParameters } from '@/types';
import { EngineeringWarning } from '../warnings/types';
import { ColumnDesignEngine } from '../design/column/columnDesignEngine';
import { BeamDesignEngine } from '../design/beam/beamDesignEngine';
import { MemberDesignSummary } from '../model/types';
import { FemSolver3D } from '../calculations/femSolver3D';
import { runFemAnalysisAsync } from '../calculations/femWorkerClient';
import { SeismicEngine } from '../calculations/seismicEngine';
import {
  ArchitecturalWall,
  ArchitecturalDoor,
  ArchitecturalWindow,
  ArchitecturalOpening,
  ArchitecturalRoom,
  ArchitecturalStaircase,
  ArchitecturalDimension,
  ArchitecturalSettings,
  ActivePlanTool,
} from '../architectural/types/architecturalTypes';
import { ArchitecturalIdGenerator } from '../architectural/utils/idGenerator';
import { ArchitecturalGeometryEngine } from '../architectural/engines/architecturalGeometryEngine';

export type ViewTab =
  | 'dashboard'
  | 'etabs-studio'
  | '3d-model'
  | 'member-forces'
  | 'joint-reactions'
  | 'load-cases'
  | 'elements'
  | 'warnings'
  | 'beams-design'
  | 'columns-design'
  | 'piles-design'
  | 'pilecaps-design'
  | 'gradebeams-design'
  | 'footings-design'
  | 'shearwalls-design'
  | 'slabs-design'
  | 'staircase-design'
  | 'floor-plans'
  | 'architectural-plan'
  | 'drawings'
  | 'reports'
  | 'settings';

export interface FilterLayerState {
  showBeams: boolean;
  showColumns: boolean;
  showPlates: boolean;
  showSupports: boolean;
  showNodeLabels: boolean;
  showMemberLabels: boolean;
}

export interface UniversalRebarSelection {
  longitudinalDiameters: number[];
  shearTieDiameters: number[];
  isConfigured: boolean;
}

export interface ProjectState {
  projects: StoredProject[];
  activeProject: StoredProject | null;
  activeModel: NormalizedStructuralModel | null;
  selectedMemberId: number | null;
  selectedNodeId: number | null;
  selectedPlateId: number | null;
  activeView: ViewTab;
  filterLayers: FilterLayerState;
  isImportModalOpen: boolean;
  isNewProjectModalOpen: boolean;
  setNewProjectModalOpen: (open: boolean) => void;
  isLoading: boolean;

  // Foundation Pile & Pile Cap States
  projectPileTypes: any[];
  supportPileAssignments: Record<number, string>;
  customPileCapOverrides: Record<number, { customPileCount?: number; customCapLength?: number; customCapWidth?: number; customCapDepth?: number }>;
  customCombinedCapOverrides: Record<string, { customPileCount?: number; customCapLength?: number; customCapWidth?: number; customCapDepth?: number; customSafePileCapacity?: number; customBottomRebar?: string; customTopRebar?: string }>;
  manualMergedPileCapGroups: number[][];
  detachedCombinedCapNodeIds: number[];
  selectedSupportNodeIds: number[];

  // Universal Rebar Selection Configuration (Strictly Governs All Design Engines)
  universalRebarSelection: UniversalRebarSelection;
  isUniversalRebarModalOpen: boolean;
  setUniversalRebarModalOpen: (open: boolean) => void;
  setUniversalRebarSelection: (selection: Partial<UniversalRebarSelection>) => void;
  setUniversalLongitudinalDiameters: (dias: number[]) => void;
  setUniversalShearTieDiameters: (dias: number[]) => void;

  // Legacy module-level rebar arrays (synchronized with universalRebarSelection)
  allowedColumnRebarDiameters: number[];
  allowedBeamRebarDiameters: number[];
  setAllowedColumnRebarDiameters: (dias: number[]) => void;
  setAllowedBeamRebarDiameters: (dias: number[]) => void;
  rotateColumnOrientation: (memberId: number) => Promise<void>;
  autoOrientAllColumns: () => Promise<number>;

  // Actions
  initializeStore: () => Promise<void>;
  createProject: (metadata: Partial<ProjectMetadata>) => Promise<StoredProject>;
  updateProjectMetadata: (metadata: Partial<ProjectMetadata>) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  deleteInactiveProjects: () => Promise<void>;
  reloadProjects: () => Promise<void>;
  importANL: (fileName: string, content: string, customMetadata?: Partial<ProjectMetadata>) => Promise<StoredProject>;
  selectMember: (id: number | null) => void;
  selectNode: (id: number | null) => void;
  selectPlate: (id: number | null) => void;
  selectSupportNode: (nodeId: number | null, multi?: boolean) => void;
  clearSelectedSupportNodes: () => void;
  mergeSelectedPileCaps: (nodeIds?: number[]) => void;
  unmergePileCapGroup: (nodeIdInGroup: number) => void;
  splitCombinedPileCapGroup: (
    originalNodeIds: number[],
    keepNodeIds: number[],
    detachedNodeIds: number[],
    newCombinedGroupNodeIds?: number[]
  ) => void;
  detachNodesFromCombinedPileCap: (nodeIdsToDetach: number[]) => void;
  clearDetachedCombinedCapNodes: () => void;
  setActiveView: (view: ViewTab) => void;
  toggleFilterLayer: (layer: keyof FilterLayerState) => void;
  setImportModalOpen: (open: boolean) => void;
  updateDesignSettings: (settings: Partial<DesignParameters>) => Promise<void>;
  updateMemberSection: (memberId: number, yd: number, zd: number, name?: string) => Promise<void>;
  updateMemberMaterial: (memberId: number, materialName: string) => Promise<void>;
  assignMemberLocalAxis: (memberIds: number[], betaAngle: number) => Promise<void>;
  batchUpdateSections: (updates: { memberId: number; yd: number; zd: number; name?: string }[]) => Promise<void>;
  updatePlateThickness: (plateId: number, thicknessMeters: number) => Promise<void>;
  batchUpdatePlateThicknesses: (updates: { plateId: number; thicknessMeters: number }[]) => Promise<void>;
  setProjectPileTypes: (types: any[]) => void;
  updateProjectPileType: (pile: any) => void;
  assignPileTypeToSupport: (supportNodeId: number, pileTypeId: string) => void;
  setCustomPileCapOverride: (supportNodeId: number, override: { customPileCount?: number; customCapLength?: number; customCapWidth?: number; customCapDepth?: number }) => void;
  clearCustomPileCapOverride: (supportNodeId: number) => void;
  setCustomCombinedCapOverride: (groupId: string, override: { customPileCount?: number; customCapLength?: number; customCapWidth?: number; customCapDepth?: number; customSafePileCapacity?: number; customBottomRebar?: string; customTopRebar?: string }) => void;
  clearCustomCombinedCapOverride: (groupId: string) => void;
  // Saved Component Designs & Overrides
  savedColumnDesigns: Record<number, any>;
  savedBeamDesigns: Record<number, any>;
  savedShearWallDesigns: Record<number, any>;
  savedGradeBeamDesigns: any[];
  savedFootingDesigns: Record<number, any>;
  savedPileCapDesigns: Record<number, any>;
  savedCombinedCapDesigns: any[];
  savedSlabDesigns: Record<string, any>;
  customColumnRebarOverrides: Record<number, any>;
  customBeamRebarOverrides: Record<number, any>;
  customShearWallOverrides: Record<number, any>;
  customSlabOverrides: Record<string, any>;
  customStaircaseGeometry?: any;
  customStaircaseLandingEntry?: any;

  // Architectural Floor Plan State
  architecturalWalls: Record<string, ArchitecturalWall>;
  architecturalDoors: Record<string, ArchitecturalDoor>;
  architecturalWindows: Record<string, ArchitecturalWindow>;
  architecturalOpenings: Record<string, ArchitecturalOpening>;
  architecturalRooms: Record<string, ArchitecturalRoom>;
  architecturalStaircases: Record<string, ArchitecturalStaircase>;
  architecturalDimensions: Record<string, ArchitecturalDimension>;
  architecturalSettings: ArchitecturalSettings;
  activeFloorIndex: number;
  activePlanTool: ActivePlanTool;
  selectedArchitecturalId: string | null;
  selectedArchitecturalType: 'WALL' | 'DOOR' | 'WINDOW' | 'OPENING' | 'ROOM' | 'STAIRCASE' | 'DIMENSION' | null;

  // Architectural Actions
  setActiveFloorIndex: (idx: number) => void;
  setActivePlanTool: (tool: ActivePlanTool) => void;
  selectArchitecturalElement: (id: string | null, type?: 'WALL' | 'DOOR' | 'WINDOW' | 'OPENING' | 'ROOM' | 'STAIRCASE' | 'DIMENSION' | null) => void;
  addWall: (wall: ArchitecturalWall) => Promise<void>;
  updateWall: (id: string, updates: Partial<ArchitecturalWall>) => Promise<void>;
  deleteWall: (id: string, deleteHosted?: boolean) => Promise<void>;
  addDoor: (door: ArchitecturalDoor) => Promise<void>;
  updateDoor: (id: string, updates: Partial<ArchitecturalDoor>) => Promise<void>;
  deleteDoor: (id: string) => Promise<void>;
  addWindow: (win: ArchitecturalWindow) => Promise<void>;
  updateWindow: (id: string, updates: Partial<ArchitecturalWindow>) => Promise<void>;
  deleteWindow: (id: string) => Promise<void>;
  addOpening: (op: ArchitecturalOpening) => Promise<void>;
  updateOpening: (id: string, updates: Partial<ArchitecturalOpening>) => Promise<void>;
  deleteOpening: (id: string) => Promise<void>;
  addRoom: (room: ArchitecturalRoom) => Promise<void>;
  updateRoom: (id: string, updates: Partial<ArchitecturalRoom>) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  addStaircase: (staircase: ArchitecturalStaircase) => Promise<void>;
  updateStaircase: (id: string, updates: Partial<ArchitecturalStaircase>) => Promise<void>;
  deleteStaircase: (id: string) => Promise<void>;
  deleteStaircaseFromFloor: (stairId: string, floorId: string) => Promise<void>;
  restoreStaircaseForFloor: (stairId: string, floorId: string) => Promise<void>;
  setRoomsForFloor: (floorId: string, rooms: ArchitecturalRoom[]) => Promise<void>;
  addDimension: (dim: ArchitecturalDimension) => Promise<void>;
  deleteDimension: (id: string) => Promise<void>;
  updateArchitecturalSettings: (settings: Partial<ArchitecturalSettings>) => Promise<void>;
  copyFloorPlan: (sourceFloorId: string, targetFloorId: string) => Promise<void>;
  undoArchitecturalAction: () => Promise<void>;
  redoArchitecturalAction: () => Promise<void>;

  // Component Design Persistence Actions
  saveColumnDesigns: (designs: Map<number, any> | Record<number, any>, overrides?: Map<number, any> | Record<number, any>) => Promise<void>;
  saveBeamDesigns: (designs: Map<number, any> | Record<number, any>, overrides?: Map<number, any> | Record<number, any>) => Promise<void>;
  saveShearWallDesigns: (designs: Map<number, any> | Record<number, any>, overrides?: Record<number, any>) => Promise<void>;
  saveGradeBeamDesigns: (designs: any[]) => Promise<void>;
  saveFootingDesigns: (designs: Map<number, any> | Record<number, any>) => Promise<void>;
  savePileCapDesigns: (designedCaps?: Map<number, any> | Record<number, any>, combinedCaps?: any[]) => Promise<void>;
  savePileDesigns: (types: any[]) => Promise<void>;
  saveSlabDesigns: (designs: Map<string, any> | Record<string, any>, overrides?: Record<string, any>) => Promise<void>;
  saveStaircaseDesigns: (designs: any, geometry?: any, landingEntry?: any) => Promise<void>;

  // Standalone ETABS & 3D FEM Analysis Actions
  runFemAnalysis: () => Promise<void>;
  runSeismicAnalysis: (params?: Partial<any>) => Promise<any>;
  runAllDesignChecks: () => Promise<number>;
  generateBuildingGrid: (
    baysX?: number,
    baysZ?: number,
    widthX?: number,
    widthZ?: number,
    stories?: number,
    storyH?: number
  ) => Promise<void>;
  addStructuralNode: (x: number, y: number, z: number, isSupport?: boolean) => Promise<number>;
  addStructuralMember: (
    startNodeId: number,
    endNodeId: number,
    section?: Partial<CrossSection>,
    classification?: 'COLUMN' | 'BEAM'
  ) => Promise<number>;
  addStructuralPlate: (
    nodeIds: number[],
    classification?: 'SLAB' | 'WALL',
    thickness?: number,
    materialName?: string
  ) => Promise<number>;
  deleteStructuralElements: (nodeIds?: number[], memberIds?: number[]) => Promise<void>;
  assignMemberSection: (memberIds: number[], section: Partial<CrossSection>) => Promise<void>;
  assignSupportRestraint: (nodeIds: number[], type: 'FIXED' | 'PINNED' | 'ROLLER') => Promise<void>;
  assignFrameLoads: (memberIds: number[], load: MemberLoad) => Promise<void>;
  deleteMemberLoads: (memberIds: number[]) => Promise<void>;
  assignShellLoads: (levelY: number, load: ShellLoad) => Promise<void>;
  assignMemberModifiers: (memberIds: number[], modifiers: Partial<MemberModifier>) => Promise<void>;
  replicateStory: (sourceElevationY: number, targetElevationsY: number[]) => Promise<void>;
  updateLoadPatterns: (patterns: LoadCase[]) => Promise<void>;
  updateLoadCombinations: (combos: LoadCombination[]) => Promise<void>;
}

const DEFAULT_DESIGN_SETTINGS: DesignParameters = {
  code: 'IS456_2000',
  concreteGrade: 'M25',
  steelGrade: 'Fe500D',
  shearRebarGrade: 'Fe500D',
  clearCoverBeam: 30,
  clearCoverColumn: 40,
  clearCoverFooting: 50,
  clearCoverSlab: 20,
  clearCoverPile: 60,
  maxAggregateSize: 20,
  seismicZone: 'IV',
  responseReductionFactor: 5,
  importanceFactor: 1.2,
  soilType: 'II_MEDIUM',
  windSpeed: 39,
  windTerrainCategory: 2,
};

export const DEFAULT_ARCHITECTURAL_SETTINGS: ArchitecturalSettings = {
  standardInternalWallThickness: 115,
  standardExternalWallThickness: 230,
  standardStoryHeight: 3.2,
  wallReferenceLine: 'CENTERLINE',
  snapSettings: {
    enabled: true,
    endpoint: true,
    midpoint: true,
    intersection: true,
    center: true,
    perpendicular: true,
    parallel: true,
    nearest: true,
    columnCenter: true,
    columnFace: true,
    beamCenterline: true,
    grid: true,
    tolerance: 0.25,
  },
  gridSettings: {
    enabled: true,
    spacing: 0.5,
    majorInterval: 4,
    adaptive: true,
  },
  showDimensions: false,
  showRoomLabels: false,
  showStructuralUnderlay: true,
  showPreviousFloorUnderlay: false,
  previousFloorOpacity: 0.35,
};

let architecturalUndoStack: any[] = [];
let architecturalRedoStack: any[] = [];
const MAX_UNDO_STACK = 15;

function pushArchUndo(action: any) {
  architecturalUndoStack.push(action);
  if (architecturalUndoStack.length > MAX_UNDO_STACK) architecturalUndoStack.shift();
  architecturalRedoStack = [];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  activeModel: null,
  selectedMemberId: null,
  selectedNodeId: null,
  selectedPlateId: null,
  activeView: 'dashboard',
  filterLayers: {
    showBeams: true,
    showColumns: true,
    showPlates: true,
    showSupports: true,
    showNodeLabels: false,
    showMemberLabels: false,
  },
  isImportModalOpen: false,
  isNewProjectModalOpen: false,
  setNewProjectModalOpen: (isNewProjectModalOpen) => set({ isNewProjectModalOpen }),
  isLoading: false,

  // Architectural Floor Plan Initial State
  architecturalWalls: {},
  architecturalDoors: {},
  architecturalWindows: {},
  architecturalOpenings: {},
  architecturalRooms: {},
  architecturalStaircases: {},
  architecturalDimensions: {},
  architecturalSettings: DEFAULT_ARCHITECTURAL_SETTINGS,
  customStaircaseGeometry: null,
  customStaircaseLandingEntry: null,
  activeFloorIndex: 1,
  activePlanTool: 'SELECT',
  selectedArchitecturalId: null,
  selectedArchitecturalType: null,

  // Foundation Pile & Pile Cap Initial State
  projectPileTypes: [],
  supportPileAssignments: {},
  customPileCapOverrides: {},
  customCombinedCapOverrides: {},
  manualMergedPileCapGroups: [],
  detachedCombinedCapNodeIds: [],
  selectedSupportNodeIds: [],

  // Saved Component Designs & Overrides Initial State
  savedColumnDesigns: {},
  savedBeamDesigns: {},
  savedShearWallDesigns: {},
  savedGradeBeamDesigns: [],
  savedFootingDesigns: {},
  savedPileCapDesigns: {},
  savedCombinedCapDesigns: [],
  savedSlabDesigns: {},
  customColumnRebarOverrides: {},
  customBeamRebarOverrides: {},
  customShearWallOverrides: {},
  customSlabOverrides: {},

  // Rebar Configuration States
  universalRebarSelection: {
    longitudinalDiameters: [12, 16, 20, 25],
    shearTieDiameters: [8, 10],
    isConfigured: true,
  },
  isUniversalRebarModalOpen: false,
  allowedColumnRebarDiameters: [12, 16, 20, 25],
  allowedBeamRebarDiameters: [12, 16, 20, 25],

  initializeStore: async () => {
    set({ isLoading: true });
    try {
      const allProjects = await ProjectStorage.getAllProjects();
      set({ projects: allProjects });

      if (allProjects.length > 0) {
        const first = allProjects[0];
        const model = ProjectStorage.deserializeModel(first.model);
        const uRebar = first.universalRebarSelection || {
          longitudinalDiameters: first.allowedColumnRebarDiameters || [12, 16, 20, 25],
          shearTieDiameters: [8, 10],
          isConfigured: true,
        };

        set({
          activeProject: first,
          activeModel: model,
          projectPileTypes: first.projectPileTypes || [],
          supportPileAssignments: first.supportPileAssignments || {},
          customPileCapOverrides: first.customPileCapOverrides || {},
          customCombinedCapOverrides: first.customCombinedCapOverrides || {},
          manualMergedPileCapGroups: first.manualMergedPileCapGroups || [],
          detachedCombinedCapNodeIds: first.detachedCombinedCapNodeIds || [],
          savedColumnDesigns: first.savedColumnDesigns || {},
          savedBeamDesigns: first.savedBeamDesigns || {},
          savedShearWallDesigns: first.savedShearWallDesigns || {},
          savedGradeBeamDesigns: first.savedGradeBeamDesigns || [],
          savedFootingDesigns: first.savedFootingDesigns || {},
          savedPileCapDesigns: first.savedPileCapDesigns || {},
          savedCombinedCapDesigns: first.savedCombinedCapDesigns || [],
          savedSlabDesigns: first.savedSlabDesigns || {},
          customColumnRebarOverrides: first.customColumnRebarOverrides || {},
          customBeamRebarOverrides: first.customBeamRebarOverrides || {},
          customShearWallOverrides: first.customShearWallOverrides || {},
          customSlabOverrides: first.customSlabOverrides || {},
          architecturalWalls: first.architecturalWalls || {},
          architecturalDoors: first.architecturalDoors || {},
          architecturalWindows: first.architecturalWindows || {},
          architecturalOpenings: first.architecturalOpenings || {},
          architecturalRooms: first.architecturalRooms || {},
          architecturalStaircases: first.architecturalStaircases || {},
          architecturalDimensions: first.architecturalDimensions || {},
          architecturalSettings: first.architecturalSettings || DEFAULT_ARCHITECTURAL_SETTINGS,
          universalRebarSelection: uRebar,
          allowedColumnRebarDiameters: uRebar.longitudinalDiameters,
          allowedBeamRebarDiameters: uRebar.longitudinalDiameters,
          selectedSupportNodeIds: [],
        });
      }
    } catch (err) {
      console.error('Failed to initialize projects from IndexedDB:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createProject: async (metadata) => {
    const id = `prj_${Date.now()}`;
    const fullMetadata: ProjectMetadata = {
      id,
      name: metadata.name || 'New Structural Project',
      code: metadata.code || `PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      client: metadata.client || 'Client Name',
      engineer: metadata.engineer || 'Lead Engineer',
      location: metadata.location || 'Site Location',
      date: metadata.date || new Date().toISOString().split('T')[0],
      description: metadata.description || 'RCC Structural Analysis & Design to IS 456 / IS 13920',
      designSettings: { ...DEFAULT_DESIGN_SETTINGS, ...metadata.designSettings },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Empty model
    const emptyModel: NormalizedStructuralModel = {
      nodes: new Map(),
      members: new Map(),
      plates: new Map(),
      supports: new Map(),
      loadCases: new Map(),
      loadCombinations: new Map(),
      reactions: [],
      memberForces: [],
      storyDrifts: [],
      boundingBox: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10 },
      statistics: {
        totalNodes: 0,
        totalMembers: 0,
        totalBeams: 0,
        totalColumns: 0,
        totalPlates: 0,
        totalSupports: 0,
        totalLoadCases: 0,
        totalCombinations: 0,
        maxElevation: 0,
        baseElevation: 0,
      },
    };

    const storedProject: StoredProject = {
      metadata: fullMetadata,
      model: ProjectStorage.serializeModel(emptyModel),
      warnings: [],
      architecturalWalls: {},
      architecturalDoors: {},
      architecturalWindows: {},
      architecturalOpenings: {},
      architecturalRooms: {},
      architecturalDimensions: {},
      architecturalSettings: DEFAULT_ARCHITECTURAL_SETTINGS,
    };

    await ProjectStorage.saveProject(storedProject);
    const updated = await ProjectStorage.getAllProjects();
    set({
      projects: updated,
      activeProject: storedProject,
      activeModel: emptyModel,
      architecturalWalls: {},
      architecturalDoors: {},
      architecturalWindows: {},
      architecturalOpenings: {},
      architecturalRooms: {},
      architecturalDimensions: {},
      architecturalSettings: DEFAULT_ARCHITECTURAL_SETTINGS,
    });
    return storedProject;
  },

  updateProjectMetadata: async (metadata) => {
    const current = get().activeProject;
    if (!current) return;

    const updatedProject: StoredProject = {
      ...current,
      metadata: {
        ...current.metadata,
        ...metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    await ProjectStorage.saveProject(updatedProject);
    const updatedList = await ProjectStorage.getAllProjects();
    set({
      activeProject: updatedProject,
      projects: updatedList,
    });
  },

  openProject: async (id) => {
    set({ isLoading: true });
    try {
      const project = await ProjectStorage.getProject(id);
      if (project) {
        const model = ProjectStorage.deserializeModel(project.model);
        const uRebar = project.universalRebarSelection || {
          longitudinalDiameters: project.allowedColumnRebarDiameters || [12, 16, 20, 25],
          shearTieDiameters: [8, 10],
          isConfigured: true,
        };

        set({
          activeProject: project,
          activeModel: model,
          selectedMemberId: null,
          selectedNodeId: null,
          projectPileTypes: project.projectPileTypes || [],
          supportPileAssignments: project.supportPileAssignments || {},
          customPileCapOverrides: project.customPileCapOverrides || {},
          customCombinedCapOverrides: project.customCombinedCapOverrides || {},
          manualMergedPileCapGroups: project.manualMergedPileCapGroups || [],
          detachedCombinedCapNodeIds: project.detachedCombinedCapNodeIds || [],
          savedColumnDesigns: project.savedColumnDesigns || {},
          savedBeamDesigns: project.savedBeamDesigns || {},
          savedShearWallDesigns: project.savedShearWallDesigns || {},
          savedGradeBeamDesigns: project.savedGradeBeamDesigns || [],
          savedFootingDesigns: project.savedFootingDesigns || {},
          savedPileCapDesigns: project.savedPileCapDesigns || {},
          savedCombinedCapDesigns: project.savedCombinedCapDesigns || [],
          savedSlabDesigns: project.savedSlabDesigns || {},
          customColumnRebarOverrides: project.customColumnRebarOverrides || {},
          customBeamRebarOverrides: project.customBeamRebarOverrides || {},
          customShearWallOverrides: project.customShearWallOverrides || {},
          customSlabOverrides: project.customSlabOverrides || {},
          architecturalWalls: project.architecturalWalls || {},
          architecturalDoors: project.architecturalDoors || {},
          architecturalWindows: project.architecturalWindows || {},
          architecturalOpenings: project.architecturalOpenings || {},
          architecturalRooms: project.architecturalRooms || {},
          architecturalStaircases: project.architecturalStaircases || {},
          architecturalDimensions: project.architecturalDimensions || {},
          architecturalSettings: project.architecturalSettings || DEFAULT_ARCHITECTURAL_SETTINGS,
          universalRebarSelection: uRebar,
          allowedColumnRebarDiameters: uRebar.longitudinalDiameters,
          allowedBeamRebarDiameters: uRebar.longitudinalDiameters,
          selectedSupportNodeIds: [],
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  deleteProject: async (id) => {
    await ProjectStorage.deleteProject(id);
    const updated = await ProjectStorage.getAllProjects();
    const currentActive = get().activeProject;
    let nextActive: StoredProject | null = null;
    let nextModel: NormalizedStructuralModel | null = null;

    if (currentActive?.metadata.id === id) {
      if (updated.length > 0) {
        nextActive = updated[0];
        nextModel = ProjectStorage.deserializeModel(nextActive.model);
      }
    } else {
      nextActive = currentActive;
      nextModel = get().activeModel;
    }

    set({ projects: updated, activeProject: nextActive, activeModel: nextModel });
  },

  deleteInactiveProjects: async () => {
    const currentActive = get().activeProject;
    if (!currentActive) return;
    const all = await ProjectStorage.getAllProjects();
    for (const p of all) {
      if (p.metadata.id !== currentActive.metadata.id) {
        await ProjectStorage.deleteProject(p.metadata.id);
      }
    }
    const updated = await ProjectStorage.getAllProjects();
    set({ projects: updated });
  },

  reloadProjects: async () => {
    const allProjects = await ProjectStorage.getAllProjects();
    set({ projects: allProjects });
  },

  importANL: async (fileName, content, customMetadata) => {
    set({ isLoading: true });
    try {
      let modelToUse: NormalizedStructuralModel;
      let warningsToUse: any[] = [];
      let staadVersion = 'STAAD.Pro CONNECT Edition';
      let engineer = customMetadata?.engineer || 'Lead Structural Engineer';
      let date = new Date().toISOString().split('T')[0];

      if (fileName.toLowerCase().endsWith('.ifc')) {
        const { IfcStructuralEngine } = await import('@/features/architectural/engines/ifcStructuralEngine');
        const bim = IfcStructuralEngine.parseIfc(content);
        modelToUse = IfcStructuralEngine.interpretToStructuralModel(bim);
        staadVersion = 'IFC 2x3 / Revit BIM Integration';
      } else {
        const parseResult = ANLParser.parse(content);
        modelToUse = parseResult.model;
        warningsToUse = parseResult.warnings;
        staadVersion = parseResult.staadVersion || staadVersion;
        engineer = parseResult.engineer || engineer;
        date = parseResult.date || date;
      }

      const id = customMetadata?.id || `prj_${Date.now()}`;

      const metadata: ProjectMetadata = {
        id,
        name: customMetadata?.name || fileName.replace(/\.(anl|std|ifc)$/i, '') || 'Imported Model',
        code: customMetadata?.code || `STR-${Math.floor(1000 + Math.random() * 9000)}`,
        client: customMetadata?.client || 'Engineering Client',
        engineer,
        location: customMetadata?.location || 'Sector 12, Phase II',
        date,
        description: `Imported from ${fileName} with ${modelToUse.nodes.size} nodes and ${modelToUse.members.size} members.`,
        anlFileName: fileName,
        anlFileSize: content.length,
        staadVersion,
        designSettings: { ...DEFAULT_DESIGN_SETTINGS, ...customMetadata?.designSettings },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const storedProject: StoredProject = {
        metadata,
        model: ProjectStorage.serializeModel(modelToUse),
        warnings: warningsToUse,
        rawAnlContent: content,
      };

      await ProjectStorage.saveProject(storedProject);
      const updated = await ProjectStorage.getAllProjects();

      set({
        projects: updated,
        activeProject: storedProject,
        activeModel: modelToUse,
        selectedMemberId: null,
        selectedNodeId: null,
        isImportModalOpen: false,
      });

      return storedProject;
    } finally {
      set({ isLoading: false });
    }
  },

  selectMember: (id) => set({ selectedMemberId: id, selectedNodeId: null, selectedPlateId: null }),
  selectNode: (id) => set({ selectedNodeId: id, selectedMemberId: null, selectedPlateId: null }),
  selectPlate: (id) => set({ selectedPlateId: id, selectedMemberId: null, selectedNodeId: null }),

  selectSupportNode: (nodeId, multi = false) => {
    if (nodeId === null) {
      set({ selectedSupportNodeIds: [] });
      return;
    }
    const current = get().selectedSupportNodeIds || [];
    if (multi) {
      if (current.includes(nodeId)) {
        set({ selectedSupportNodeIds: current.filter((id) => id !== nodeId) });
      } else {
        set({ selectedSupportNodeIds: [...current, nodeId] });
      }
    } else {
      set({ selectedSupportNodeIds: [nodeId] });
    }
  },

  clearSelectedSupportNodes: () => set({ selectedSupportNodeIds: [] }),

  mergeSelectedPileCaps: (nodeIds) => {
    const toMerge = nodeIds && nodeIds.length >= 2 ? nodeIds : get().selectedSupportNodeIds;
    if (!toMerge || toMerge.length < 2) return;

    const existing = get().manualMergedPileCapGroups || [];
    const filtered = existing.filter((grp) => !grp.some((nid) => toMerge.includes(nid)));
    const updated = [...filtered, [...toMerge]];

    const prevDetached = get().detachedCombinedCapNodeIds || [];
    const updatedDetached = prevDetached.filter((id) => !toMerge.includes(id));

    set({
      manualMergedPileCapGroups: updated,
      detachedCombinedCapNodeIds: updatedDetached,
      selectedSupportNodeIds: [],
    });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        manualMergedPileCapGroups: updated,
        detachedCombinedCapNodeIds: updatedDetached,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  unmergePileCapGroup: (nodeIdInGroup) => {
    const existing = get().manualMergedPileCapGroups || [];
    const groupToUnmerge = existing.find((grp) => grp.includes(nodeIdInGroup));
    const nodesToDetach = groupToUnmerge || [nodeIdInGroup];

    const updated = existing.filter((grp) => !grp.includes(nodeIdInGroup));
    const prevDetached = get().detachedCombinedCapNodeIds || [];
    const newDetached = Array.from(new Set([...prevDetached, ...nodesToDetach]));

    set({
      manualMergedPileCapGroups: updated,
      detachedCombinedCapNodeIds: newDetached,
      selectedSupportNodeIds: [],
    });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        manualMergedPileCapGroups: updated,
        detachedCombinedCapNodeIds: newDetached,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  splitCombinedPileCapGroup: (
    originalNodeIds,
    keepNodeIds,
    detachedNodeIds,
    newCombinedGroupNodeIds
  ) => {
    const existing = get().manualMergedPileCapGroups || [];
    const filtered = existing.filter((grp) => !grp.some((nid) => originalNodeIds.includes(nid)));
    const updated = [...filtered];

    if (keepNodeIds && keepNodeIds.length >= 2) {
      updated.push([...keepNodeIds]);
    }
    if (newCombinedGroupNodeIds && newCombinedGroupNodeIds.length >= 2) {
      updated.push([...newCombinedGroupNodeIds]);
    }

    const prevDetached = get().detachedCombinedCapNodeIds || [];
    const newDetachedSet = new Set(prevDetached);
    detachedNodeIds.forEach((id) => newDetachedSet.add(id));
    keepNodeIds.forEach((id) => newDetachedSet.delete(id));
    (newCombinedGroupNodeIds || []).forEach((id) => newDetachedSet.delete(id));

    const updatedDetached = Array.from(newDetachedSet);

    set({
      manualMergedPileCapGroups: updated,
      detachedCombinedCapNodeIds: updatedDetached,
      selectedSupportNodeIds: [],
    });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        manualMergedPileCapGroups: updated,
        detachedCombinedCapNodeIds: updatedDetached,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  detachNodesFromCombinedPileCap: (nodeIdsToDetach) => {
    const existing = get().manualMergedPileCapGroups || [];
    const updated = existing
      .map((grp) => grp.filter((id) => !nodeIdsToDetach.includes(id)))
      .filter((grp) => grp.length >= 2);

    const prevDetached = get().detachedCombinedCapNodeIds || [];
    const newDetached = Array.from(new Set([...prevDetached, ...nodeIdsToDetach]));

    set({
      manualMergedPileCapGroups: updated,
      detachedCombinedCapNodeIds: newDetached,
      selectedSupportNodeIds: [],
    });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        manualMergedPileCapGroups: updated,
        detachedCombinedCapNodeIds: newDetached,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  clearDetachedCombinedCapNodes: () => {
    set({ detachedCombinedCapNodeIds: [] });
    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        detachedCombinedCapNodeIds: [],
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  setActiveView: (view) => set({ activeView: view }),

  toggleFilterLayer: (layer) => {
    set((state) => ({
      filterLayers: {
        ...state.filterLayers,
        [layer]: !state.filterLayers[layer],
      },
    }));
  },

  setImportModalOpen: (open) => set({ isImportModalOpen: open }),

  updateDesignSettings: async (settings) => {
    const current = get().activeProject;
    if (!current) return;

    const updatedMetadata: ProjectMetadata = {
      ...current.metadata,
      designSettings: { ...current.metadata.designSettings, ...settings },
      updatedAt: new Date().toISOString(),
    };

    const updatedProject: StoredProject = {
      ...current,
      metadata: updatedMetadata,
    };

    await ProjectStorage.saveProject(updatedProject);
    const all = await ProjectStorage.getAllProjects();
    set({ activeProject: updatedProject, projects: all });
  },

  updateMemberSection: async (memberId, yd, zd, name) => {
    const currentModel = get().activeModel;
    const currentProj = get().activeProject;
    if (!currentModel || !currentProj) return;

    const member = currentModel.members.get(memberId);
    if (!member) return;

    const sectionName = name || `${Math.round(zd * 1000)}x${Math.round(yd * 1000)} mm`;
    const updatedMember: Member3D = {
      ...member,
      section: {
        ...member.section,
        yd,
        zd,
        name: sectionName,
      },
    };

    const newMembers = new Map(currentModel.members);
    newMembers.set(memberId, updatedMember);

    const updatedModel: NormalizedStructuralModel = {
      ...currentModel,
      members: newMembers,
    };

    const updatedProject: StoredProject = {
      ...currentProj,
      model: ProjectStorage.serializeModel(updatedModel),
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({ activeModel: updatedModel, activeProject: updatedProject });
  },

  updateMemberMaterial: async (memberId, materialName) => {
    const currentModel = get().activeModel;
    const currentProj = get().activeProject;
    if (!currentModel || !currentProj) return;

    const member = currentModel.members.get(memberId);
    if (!member) return;

    const updatedMember: Member3D = {
      ...member,
      materialName,
    };

    const newMembers = new Map(currentModel.members);
    newMembers.set(memberId, updatedMember);

    const updatedModel: NormalizedStructuralModel = {
      ...currentModel,
      members: newMembers,
    };

    const updatedProject: StoredProject = {
      ...currentProj,
      model: ProjectStorage.serializeModel(updatedModel),
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({ activeModel: updatedModel, activeProject: updatedProject });
  },

  assignMemberLocalAxis: async (memberIds, betaAngle) => {
    const currentModel = get().activeModel;
    const currentProj = get().activeProject;
    if (!currentModel || !currentProj) return;

    const newMembers = new Map(currentModel.members);
    for (const memberId of memberIds) {
      const member = newMembers.get(memberId);
      if (member) {
        newMembers.set(memberId, { ...member, betaAngle });
      }
    }

    const updatedModel: NormalizedStructuralModel = {
      ...currentModel,
      members: newMembers,
    };

    const updatedProject: StoredProject = {
      ...currentProj,
      model: ProjectStorage.serializeModel(updatedModel),
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({ activeModel: updatedModel, activeProject: updatedProject });
  },

  batchUpdateSections: async (updates) => {
    const currentModel = get().activeModel;
    const currentProj = get().activeProject;
    if (!currentModel || !currentProj) return;

    const newMembers = new Map(currentModel.members);

    for (const u of updates) {
      const member = newMembers.get(u.memberId);
      if (member) {
        const sectionName = u.name || `${Math.round(u.zd * 1000)}x${Math.round(u.yd * 1000)} mm`;
        newMembers.set(u.memberId, {
          ...member,
          section: {
            ...member.section,
            yd: u.yd,
            zd: u.zd,
            name: sectionName,
          },
        });
      }
    }

    const updatedModel: NormalizedStructuralModel = {
      ...currentModel,
      members: newMembers,
    };

    const updatedProject: StoredProject = {
      ...currentProj,
      model: ProjectStorage.serializeModel(updatedModel),
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({ activeModel: updatedModel, activeProject: updatedProject });
  },

  updatePlateThickness: async (plateId, thicknessMeters) => {
    const currentModel = get().activeModel;
    const currentProj = get().activeProject;
    if (!currentModel || !currentProj) return;

    const plate = currentModel.plates.get(plateId);
    if (!plate) return;

    const updatedPlate = {
      ...plate,
      thickness: thicknessMeters,
    };

    const newPlates = new Map(currentModel.plates);
    newPlates.set(plateId, updatedPlate);

    const updatedModel: NormalizedStructuralModel = {
      ...currentModel,
      plates: newPlates,
    };

    const updatedProject: StoredProject = {
      ...currentProj,
      model: ProjectStorage.serializeModel(updatedModel),
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({ activeModel: updatedModel, activeProject: updatedProject });
  },

  batchUpdatePlateThicknesses: async (updates) => {
    const currentModel = get().activeModel;
    const currentProj = get().activeProject;
    if (!currentModel || !currentProj) return;

    const newPlates = new Map(currentModel.plates);

    for (const u of updates) {
      const plate = newPlates.get(u.plateId);
      if (plate) {
        newPlates.set(u.plateId, {
          ...plate,
          thickness: u.thicknessMeters,
        });
      }
    }

    const updatedModel: NormalizedStructuralModel = {
      ...currentModel,
      plates: newPlates,
    };

    const updatedProject: StoredProject = {
      ...currentProj,
      model: ProjectStorage.serializeModel(updatedModel),
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({ activeModel: updatedModel, activeProject: updatedProject });
  },

  setProjectPileTypes: (types) => {
    set({ projectPileTypes: types });
  },

  updateProjectPileType: (pile) => {
    const prev = get().projectPileTypes;
    const next = prev.map((p) => (p.id === pile.id ? pile : p));
    set({ projectPileTypes: next });
  },

  assignPileTypeToSupport: (supportNodeId, pileTypeId) => {
    const prev = get().supportPileAssignments;
    const updated = { ...prev, [supportNodeId]: pileTypeId };
    set({ supportPileAssignments: updated });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        supportPileAssignments: updated,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  setCustomPileCapOverride: (supportNodeId, override) => {
    const prev = get().customPileCapOverrides;
    const updated = { ...prev, [supportNodeId]: { ...prev[supportNodeId], ...override } };
    set({ customPileCapOverrides: updated });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        customPileCapOverrides: updated,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  clearCustomPileCapOverride: (supportNodeId) => {
    const prev = { ...get().customPileCapOverrides };
    delete prev[supportNodeId];
    set({ customPileCapOverrides: prev });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        customPileCapOverrides: prev,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  setCustomCombinedCapOverride: (groupId, override) => {
    const prev = get().customCombinedCapOverrides;
    const updated = { ...prev, [groupId]: { ...prev[groupId], ...override } };
    set({ customCombinedCapOverrides: updated });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        customCombinedCapOverrides: updated,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  clearCustomCombinedCapOverride: (groupId: string) => {
    const prev = { ...get().customCombinedCapOverrides };
    delete prev[groupId];
    set({ customCombinedCapOverrides: prev });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        customCombinedCapOverrides: prev,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  setUniversalRebarModalOpen: (open) => set({ isUniversalRebarModalOpen: open }),

  setUniversalRebarSelection: (selection) => {
    const prev = get().universalRebarSelection;
    const updated = {
      ...prev,
      ...selection,
      isConfigured: selection.isConfigured !== undefined ? selection.isConfigured : true,
    };

    set({
      universalRebarSelection: updated,
      allowedColumnRebarDiameters: updated.longitudinalDiameters,
      allowedBeamRebarDiameters: updated.longitudinalDiameters,
    });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        universalRebarSelection: updated,
        allowedColumnRebarDiameters: updated.longitudinalDiameters,
        allowedBeamRebarDiameters: updated.longitudinalDiameters,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  setUniversalLongitudinalDiameters: (dias) => {
    const prev = get().universalRebarSelection;
    const updated = {
      ...prev,
      longitudinalDiameters: dias,
      isConfigured: dias.length > 0,
    };

    set({
      universalRebarSelection: updated,
      allowedColumnRebarDiameters: dias,
      allowedBeamRebarDiameters: dias,
    });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        universalRebarSelection: updated,
        allowedColumnRebarDiameters: dias,
        allowedBeamRebarDiameters: dias,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  setUniversalShearTieDiameters: (dias) => {
    const prev = get().universalRebarSelection;
    const updated = {
      ...prev,
      shearTieDiameters: dias,
    };

    set({ universalRebarSelection: updated });

    const currentProj = get().activeProject;
    if (currentProj) {
      ProjectStorage.saveProject({
        ...currentProj,
        universalRebarSelection: updated,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      });
    }
  },

  setAllowedColumnRebarDiameters: (dias) => {
    get().setUniversalLongitudinalDiameters(dias);
  },

  setAllowedBeamRebarDiameters: (dias) => {
    get().setUniversalLongitudinalDiameters(dias);
  },

  rotateColumnOrientation: async (memberId: number) => {
    const currentModel = get().activeModel;
    if (!currentModel) return;
    const member = currentModel.members.get(memberId);
    if (!member) return;
    const curYd = member.section.yd || 0.45;
    const curZd = member.section.zd || 0.30;
    const newYd = curZd;
    const newZd = curYd;
    const newName = `${Math.round(newZd * 1000)}x${Math.round(newYd * 1000)} mm`;
    await get().updateMemberSection(memberId, newYd, newZd, newName);
  },

  autoOrientAllColumns: async () => {
    const currentModel = get().activeModel;
    const currentProj = get().activeProject;
    if (!currentModel || !currentProj) return 0;

    const fck = currentProj.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = currentProj.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const cover = currentProj.metadata.designSettings.clearCoverColumn || 40;
    const allowed = get().allowedColumnRebarDiameters || [12, 16, 20, 25];

    const updates: { memberId: number; yd: number; zd: number; name: string }[] = [];

    for (const member of currentModel.members.values()) {
      if (member.classification !== 'COLUMN') continue;
      const b = Math.round((member.section.zd || 0.3) * 1000);
      const D = Math.round((member.section.yd || 0.45) * 1000);
      if (b === D) continue;

      let maxPu = 0;
      let maxMux = 0;
      let maxMuy = 0;
      let govLC = 1;
      const forces = currentModel.memberForces.filter((f) => f.memberId === member.id);
      for (const f of forces) {
        if (Math.abs(f.axial) > maxPu) {
          maxPu = Math.abs(f.axial);
          govLC = f.loadCaseId;
        }
        if (Math.abs(f.mz) > maxMux) maxMux = Math.abs(f.mz);
        if (Math.abs(f.my) > maxMuy) maxMuy = Math.abs(f.my);
      }
      if (maxPu <= 0) maxPu = 650;

      const resNormal = ColumnDesignEngine.design({
        memberId: member.id,
        b,
        D,
        unsupportedHeight: member.length || 3.5,
        fck,
        fy,
        cover,
        Pu: maxPu,
        Mux: maxMux,
        Muy: maxMuy,
        governingLoadCase: govLC,
        allowedDiameters: allowed,
      });

      const resRotated = ColumnDesignEngine.design({
        memberId: member.id,
        b: D,
        D: b,
        unsupportedHeight: member.length || 3.5,
        fck,
        fy,
        cover,
        Pu: maxPu,
        Mux: maxMuy,
        Muy: maxMux,
        governingLoadCase: govLC,
        allowedDiameters: allowed,
      });

      const normalScore = resNormal.status === 'PASS' ? resNormal.rebar.pt_prov : (resNormal.biaxialCheck.interactionRatio + 10);
      const rotatedScore = resRotated.status === 'PASS' ? resRotated.rebar.pt_prov : (resRotated.biaxialCheck.interactionRatio + 10);

      if (rotatedScore < normalScore - 0.05) {
        const newYd = member.section.zd || 0.30;
        const newZd = member.section.yd || 0.45;
        const newName = `${Math.round(newZd * 1000)}x${Math.round(newYd * 1000)} mm`;
        updates.push({
          memberId: member.id,
          yd: newYd,
          zd: newZd,
          name: newName,
        });
      }
    }

    if (updates.length > 0) {
      await get().batchUpdateSections(updates);
    }
    return updates.length;
  },

  saveColumnDesigns: async (designs, overrides) => {
    const currentProj = get().activeProject;
    if (!currentProj) return;

    const colObj: Record<number, any> = designs instanceof Map ? Object.fromEntries(designs) : (designs || {});
    const ovrObj: Record<number, any> = overrides instanceof Map ? Object.fromEntries(overrides) : (overrides || get().customColumnRebarOverrides);

    const updatedProject: StoredProject = {
      ...currentProj,
      savedColumnDesigns: colObj,
      customColumnRebarOverrides: ovrObj,
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({
      activeProject: updatedProject,
      savedColumnDesigns: colObj,
      customColumnRebarOverrides: ovrObj,
    });
  },

  saveBeamDesigns: async (designs, overrides) => {
    const currentProj = get().activeProject;
    if (!currentProj) return;

    const bmObj: Record<number, any> = designs instanceof Map ? Object.fromEntries(designs) : (designs || {});
    const ovrObj: Record<number, any> = overrides instanceof Map ? Object.fromEntries(overrides) : (overrides || get().customBeamRebarOverrides);

    const updatedProject: StoredProject = {
      ...currentProj,
      savedBeamDesigns: bmObj,
      customBeamRebarOverrides: ovrObj,
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({
      activeProject: updatedProject,
      savedBeamDesigns: bmObj,
      customBeamRebarOverrides: ovrObj,
    });
  },

  saveShearWallDesigns: async (designs, overrides) => {
    const currentProj = get().activeProject;
    if (!currentProj) return;

    const wallObj: Record<number, any> = designs instanceof Map ? Object.fromEntries(designs) : (designs || {});
    const ovrObj: Record<number, any> = overrides || get().customShearWallOverrides;

    const updatedProject: StoredProject = {
      ...currentProj,
      savedShearWallDesigns: wallObj,
      customShearWallOverrides: ovrObj,
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({
      activeProject: updatedProject,
      savedShearWallDesigns: wallObj,
      customShearWallOverrides: ovrObj,
    });
  },

  saveGradeBeamDesigns: async (designs) => {
    const currentProj = get().activeProject;
    if (!currentProj) return;

    const updatedProject: StoredProject = {
      ...currentProj,
      savedGradeBeamDesigns: designs,
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({
      activeProject: updatedProject,
      savedGradeBeamDesigns: designs,
    });
  },

  saveFootingDesigns: async (designs) => {
    const currentProj = get().activeProject;
    if (!currentProj) return;

    const ftgObj: Record<number, any> = designs instanceof Map ? Object.fromEntries(designs) : (designs || {});

    const updatedProject: StoredProject = {
      ...currentProj,
      savedFootingDesigns: ftgObj,
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({
      activeProject: updatedProject,
      savedFootingDesigns: ftgObj,
    });
  },

  savePileCapDesigns: async (designedCaps?: Map<number, any> | Record<number, any>, combinedCaps?: any[]) => {
    const currentProj = get().activeProject;
    if (!currentProj) return;

    const pileCapObj: Record<number, any> = { ...(get().savedPileCapDesigns || {}) };
    if (designedCaps) {
      if (designedCaps instanceof Map) {
        designedCaps.forEach((val, key) => {
          pileCapObj[key] = val;
        });
      } else {
        Object.assign(pileCapObj, designedCaps);
      }
    }

    const combinedList = combinedCaps || get().savedCombinedCapDesigns || [];

    const updatedProject: StoredProject = {
      ...currentProj,
      projectPileTypes: get().projectPileTypes,
      supportPileAssignments: get().supportPileAssignments,
      customPileCapOverrides: get().customPileCapOverrides,
      customCombinedCapOverrides: get().customCombinedCapOverrides,
      manualMergedPileCapGroups: get().manualMergedPileCapGroups,
      detachedCombinedCapNodeIds: get().detachedCombinedCapNodeIds,
      allowedColumnRebarDiameters: get().allowedColumnRebarDiameters,
      allowedBeamRebarDiameters: get().allowedBeamRebarDiameters,
      savedPileCapDesigns: pileCapObj,
      savedCombinedCapDesigns: combinedList,
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({
      activeProject: updatedProject,
      savedPileCapDesigns: pileCapObj,
      savedCombinedCapDesigns: combinedList,
    });
  },

  savePileDesigns: async (types: any[]) => {
    set({ projectPileTypes: types });
    const currentProj = get().activeProject;
    if (!currentProj) return;

    const updatedProject: StoredProject = {
      ...currentProj,
      projectPileTypes: types,
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({ activeProject: updatedProject, projectPileTypes: types });
  },

  saveSlabDesigns: async (designs: Map<string, any> | Record<string, any>, overrides?: Record<string, any>) => {
    const currentProj = get().activeProject;
    if (!currentProj) return;

    const slabObj: Record<string, any> = {};
    if (designs) {
      if (designs instanceof Map) {
        designs.forEach((val, key) => {
          slabObj[key] = val;
        });
      } else {
        Object.assign(slabObj, designs);
      }
    }

    const ovObj = overrides || get().customSlabOverrides || {};

    const updatedProject: StoredProject = {
      ...currentProj,
      savedSlabDesigns: slabObj,
      customSlabOverrides: ovObj,
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({
      activeProject: updatedProject,
      savedSlabDesigns: slabObj,
      customSlabOverrides: ovObj,
    });
  },

  saveStaircaseDesigns: async (designs: any, geometry?: any, landingEntry?: any) => {
    const currentProj = get().activeProject;
    if (!currentProj) return;

    const updatedProject: StoredProject = {
      ...currentProj,
      savedStaircaseDesigns: designs,
      customStaircaseGeometry: geometry,
      customStaircaseLandingEntry: landingEntry,
      metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
    };

    await ProjectStorage.saveProject(updatedProject);
    set({
      activeProject: updatedProject,
    });
  },

  // Architectural Actions
  setActiveFloorIndex: (idx: number) => {
    set({ activeFloorIndex: idx });
  },

  setActivePlanTool: (tool: ActivePlanTool) => {
    set({ activePlanTool: tool });
  },

  selectArchitecturalElement: (id, type = null) => {
    set({ selectedArchitecturalId: id, selectedArchitecturalType: type });
  },

  addWall: async (wall: ArchitecturalWall) => {
    const currentWalls = get().architecturalWalls || {};
    const updatedWalls = { ...currentWalls, [wall.id]: wall };

    pushArchUndo({ type: 'ADD_WALL', wall });

    const currentProj = get().activeProject;
    set({ architecturalWalls: updatedWalls, selectedArchitecturalId: wall.id, selectedArchitecturalType: 'WALL' });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalWalls: updatedWalls,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  updateWall: async (id: string, updates: Partial<ArchitecturalWall>) => {
    const currentWalls = get().architecturalWalls || {};
    const oldWall = currentWalls[id];
    if (!oldWall) return;

    const updatedWall = { ...oldWall, ...updates };
    const updatedWalls = { ...currentWalls, [id]: updatedWall };

    let updatedDoors = get().architecturalDoors || {};
    let updatedWindows = get().architecturalWindows || {};
    let updatedOpenings = get().architecturalOpenings || {};

    if (updates.start || updates.end) {
      const oldLen = ArchitecturalGeometryEngine.distance(oldWall.start, oldWall.end);
      const newLen = ArchitecturalGeometryEngine.distance(updatedWall.start, updatedWall.end);
      const ratio = oldLen > 1e-4 ? newLen / oldLen : 1;

      // Adjust doors
      let doorsChanged = false;
      const newDoors = { ...updatedDoors };
      for (const dId in newDoors) {
        if (newDoors[dId].hostWallId === id) {
          const halfW = newDoors[dId].width / 2;
          const newPos = Math.max(halfW, Math.min(newLen - halfW, newDoors[dId].position * ratio));
          newDoors[dId] = { ...newDoors[dId], position: newPos };
          doorsChanged = true;
        }
      }
      if (doorsChanged) updatedDoors = newDoors;

      // Adjust windows
      let winsChanged = false;
      const newWins = { ...updatedWindows };
      for (const wId in newWins) {
        if (newWins[wId].hostWallId === id) {
          const halfW = newWins[wId].width / 2;
          const newPos = Math.max(halfW, Math.min(newLen - halfW, newWins[wId].position * ratio));
          newWins[wId] = { ...newWins[wId], position: newPos };
          winsChanged = true;
        }
      }
      if (winsChanged) updatedWindows = newWins;

      // Adjust openings
      let opsChanged = false;
      const newOps = { ...updatedOpenings };
      for (const oId in newOps) {
        if (newOps[oId].hostWallId === id) {
          const halfW = newOps[oId].width / 2;
          const newPos = Math.max(halfW, Math.min(newLen - halfW, newOps[oId].position * ratio));
          newOps[oId] = { ...newOps[oId], position: newPos };
          opsChanged = true;
        }
      }
      if (opsChanged) updatedOpenings = newOps;
    }

    pushArchUndo({ type: 'UPDATE_WALL', previous: oldWall, current: updatedWall });

    const currentProj = get().activeProject;
    set({
      architecturalWalls: updatedWalls,
      architecturalDoors: updatedDoors,
      architecturalWindows: updatedWindows,
      architecturalOpenings: updatedOpenings,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalWalls: updatedWalls,
        architecturalDoors: updatedDoors,
        architecturalWindows: updatedWindows,
        architecturalOpenings: updatedOpenings,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  deleteWall: async (id: string, deleteHosted = true) => {
    const currentWalls = { ...(get().architecturalWalls || {}) };
    const wallToDelete = currentWalls[id];
    if (!wallToDelete) return;

    delete currentWalls[id];

    let currentDoors = { ...(get().architecturalDoors || {}) };
    let currentWindows = { ...(get().architecturalWindows || {}) };
    let currentOpenings = { ...(get().architecturalOpenings || {}) };

    const deletedDoors: ArchitecturalDoor[] = [];
    const deletedWindows: ArchitecturalWindow[] = [];
    const deletedOpenings: ArchitecturalOpening[] = [];

    if (deleteHosted) {
      for (const dId in currentDoors) {
        if (currentDoors[dId].hostWallId === id) {
          deletedDoors.push(currentDoors[dId]);
          delete currentDoors[dId];
        }
      }
      for (const wId in currentWindows) {
        if (currentWindows[wId].hostWallId === id) {
          deletedWindows.push(currentWindows[wId]);
          delete currentWindows[wId];
        }
      }
      for (const oId in currentOpenings) {
        if (currentOpenings[oId].hostWallId === id) {
          deletedOpenings.push(currentOpenings[oId]);
          delete currentOpenings[oId];
        }
      }
    }

    pushArchUndo({
      type: 'DELETE_WALL',
      wall: wallToDelete,
      deletedDoors,
      deletedWindows,
      deletedOpenings,
    });

    const currentProj = get().activeProject;
    set({
      architecturalWalls: currentWalls,
      architecturalDoors: currentDoors,
      architecturalWindows: currentWindows,
      architecturalOpenings: currentOpenings,
      selectedArchitecturalId: get().selectedArchitecturalId === id ? null : get().selectedArchitecturalId,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalWalls: currentWalls,
        architecturalDoors: currentDoors,
        architecturalWindows: currentWindows,
        architecturalOpenings: currentOpenings,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  addDoor: async (door: ArchitecturalDoor) => {
    const currentDoors = get().architecturalDoors || {};
    const updatedDoors = { ...currentDoors, [door.id]: door };
    pushArchUndo({ type: 'ADD_DOOR', door });

    const currentProj = get().activeProject;
    set({ architecturalDoors: updatedDoors, selectedArchitecturalId: door.id, selectedArchitecturalType: 'DOOR' });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalDoors: updatedDoors,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  updateDoor: async (id: string, updates: Partial<ArchitecturalDoor>) => {
    const currentDoors = get().architecturalDoors || {};
    const oldDoor = currentDoors[id];
    if (!oldDoor) return;

    const updatedDoor = { ...oldDoor, ...updates };
    const updatedDoors = { ...currentDoors, [id]: updatedDoor };
    pushArchUndo({ type: 'UPDATE_DOOR', previous: oldDoor, current: updatedDoor });

    const currentProj = get().activeProject;
    set({ architecturalDoors: updatedDoors });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalDoors: updatedDoors,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  deleteDoor: async (id: string) => {
    const currentDoors = { ...(get().architecturalDoors || {}) };
    const door = currentDoors[id];
    if (!door) return;
    delete currentDoors[id];
    pushArchUndo({ type: 'DELETE_DOOR', door });

    const currentProj = get().activeProject;
    set({
      architecturalDoors: currentDoors,
      selectedArchitecturalId: get().selectedArchitecturalId === id ? null : get().selectedArchitecturalId,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalDoors: currentDoors,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  addWindow: async (win: ArchitecturalWindow) => {
    const currentWins = get().architecturalWindows || {};
    const updatedWins = { ...currentWins, [win.id]: win };
    pushArchUndo({ type: 'ADD_WINDOW', window: win });

    const currentProj = get().activeProject;
    set({ architecturalWindows: updatedWins, selectedArchitecturalId: win.id, selectedArchitecturalType: 'WINDOW' });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalWindows: updatedWins,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  updateWindow: async (id: string, updates: Partial<ArchitecturalWindow>) => {
    const currentWins = get().architecturalWindows || {};
    const oldWin = currentWins[id];
    if (!oldWin) return;

    const updatedWin = { ...oldWin, ...updates };
    const updatedWins = { ...currentWins, [id]: updatedWin };
    pushArchUndo({ type: 'UPDATE_WINDOW', previous: oldWin, current: updatedWin });

    const currentProj = get().activeProject;
    set({ architecturalWindows: updatedWins });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalWindows: updatedWins,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  deleteWindow: async (id: string) => {
    const currentWins = { ...(get().architecturalWindows || {}) };
    const win = currentWins[id];
    if (!win) return;
    delete currentWins[id];
    pushArchUndo({ type: 'DELETE_WINDOW', window: win });

    const currentProj = get().activeProject;
    set({
      architecturalWindows: currentWins,
      selectedArchitecturalId: get().selectedArchitecturalId === id ? null : get().selectedArchitecturalId,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalWindows: currentWins,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  addOpening: async (op: ArchitecturalOpening) => {
    const currentOps = get().architecturalOpenings || {};
    const updatedOps = { ...currentOps, [op.id]: op };
    pushArchUndo({ type: 'ADD_OPENING', opening: op });

    const currentProj = get().activeProject;
    set({ architecturalOpenings: updatedOps, selectedArchitecturalId: op.id, selectedArchitecturalType: 'OPENING' });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalOpenings: updatedOps,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  updateOpening: async (id: string, updates: Partial<ArchitecturalOpening>) => {
    const currentOps = get().architecturalOpenings || {};
    const oldOp = currentOps[id];
    if (!oldOp) return;

    const updatedOp = { ...oldOp, ...updates };
    const updatedOps = { ...currentOps, [id]: updatedOp };
    pushArchUndo({ type: 'UPDATE_OPENING', previous: oldOp, current: updatedOp });

    const currentProj = get().activeProject;
    set({ architecturalOpenings: updatedOps });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalOpenings: updatedOps,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  deleteOpening: async (id: string) => {
    const currentOps = { ...(get().architecturalOpenings || {}) };
    const op = currentOps[id];
    if (!op) return;
    delete currentOps[id];
    pushArchUndo({ type: 'DELETE_OPENING', opening: op });

    const currentProj = get().activeProject;
    set({
      architecturalOpenings: currentOps,
      selectedArchitecturalId: get().selectedArchitecturalId === id ? null : get().selectedArchitecturalId,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalOpenings: currentOps,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  addRoom: async (room: ArchitecturalRoom) => {
    const currentRooms = get().architecturalRooms || {};
    const updatedRooms = { ...currentRooms, [room.id]: room };
    pushArchUndo({ type: 'ADD_ROOM', room });

    const currentProj = get().activeProject;
    set({ architecturalRooms: updatedRooms, selectedArchitecturalId: room.id, selectedArchitecturalType: 'ROOM' });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalRooms: updatedRooms,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  updateRoom: async (id: string, updates: Partial<ArchitecturalRoom>) => {
    const currentRooms = get().architecturalRooms || {};
    const oldRoom = currentRooms[id];
    if (!oldRoom) return;

    const updatedRoom = { ...oldRoom, ...updates };
    const updatedRooms = { ...currentRooms, [id]: updatedRoom };
    pushArchUndo({ type: 'UPDATE_ROOM', previous: oldRoom, current: updatedRoom });

    const currentProj = get().activeProject;
    set({ architecturalRooms: updatedRooms });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalRooms: updatedRooms,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  deleteRoom: async (id: string) => {
    const currentRooms = { ...(get().architecturalRooms || {}) };
    const room = currentRooms[id];
    if (!room) return;
    delete currentRooms[id];
    pushArchUndo({ type: 'DELETE_ROOM', room });

    const currentProj = get().activeProject;
    set({
      architecturalRooms: currentRooms,
      selectedArchitecturalId: get().selectedArchitecturalId === id ? null : get().selectedArchitecturalId,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalRooms: currentRooms,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  addStaircase: async (staircase: ArchitecturalStaircase) => {
    const currentStairs = get().architecturalStaircases || {};
    const updatedStairs = { ...currentStairs, [staircase.id]: staircase };
    pushArchUndo({ type: 'ADD_STAIRCASE', staircase });

    const currentProj = get().activeProject;
    set({
      architecturalStaircases: updatedStairs,
      selectedArchitecturalId: staircase.id,
      selectedArchitecturalType: 'STAIRCASE',
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalStaircases: updatedStairs,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  updateStaircase: async (id: string, updates: Partial<ArchitecturalStaircase>) => {
    const currentStairs = get().architecturalStaircases || {};
    const oldStair = currentStairs[id];
    if (!oldStair) return;

    const updatedStair = { ...oldStair, ...updates };
    const updatedStairs = { ...currentStairs, [id]: updatedStair };
    pushArchUndo({ type: 'UPDATE_STAIRCASE', previous: oldStair, current: updatedStair });

    const currentProj = get().activeProject;
    set({ architecturalStaircases: updatedStairs });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalStaircases: updatedStairs,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  deleteStaircase: async (id: string) => {
    const currentStairs = { ...(get().architecturalStaircases || {}) };
    const stair = currentStairs[id];
    if (!stair) return;
    delete currentStairs[id];
    pushArchUndo({ type: 'DELETE_STAIRCASE', staircase: stair });

    const currentProj = get().activeProject;
    set({
      architecturalStaircases: currentStairs,
      selectedArchitecturalId: get().selectedArchitecturalId === id ? null : get().selectedArchitecturalId,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalStaircases: currentStairs,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  deleteStaircaseFromFloor: async (stairId: string, floorId: string) => {
    const currentStairs = { ...(get().architecturalStaircases || {}) };
    const stair = currentStairs[stairId];
    if (!stair) return;

    if (stair.floorId === floorId && stair.allFloors === false) {
      delete currentStairs[stairId];
    } else {
      const disabled = new Set(stair.disabledFloorIds || []);
      disabled.add(floorId);
      currentStairs[stairId] = {
        ...stair,
        disabledFloorIds: Array.from(disabled),
      };
    }

    pushArchUndo({ type: 'DELETE_STAIRCASE', staircase: stair });

    const currentProj = get().activeProject;
    set({
      architecturalStaircases: currentStairs,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalStaircases: currentStairs,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  restoreStaircaseForFloor: async (stairId: string, floorId: string) => {
    const currentStairs = { ...(get().architecturalStaircases || {}) };
    const stair = currentStairs[stairId];
    if (!stair) return;

    const disabled = (stair.disabledFloorIds || []).filter((f) => f !== floorId);
    currentStairs[stairId] = {
      ...stair,
      disabledFloorIds: disabled,
    };

    const currentProj = get().activeProject;
    set({
      architecturalStaircases: currentStairs,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalStaircases: currentStairs,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  setRoomsForFloor: async (floorId: string, newFloorRooms: ArchitecturalRoom[]) => {
    const currentRooms = { ...(get().architecturalRooms || {}) };
    for (const rId in currentRooms) {
      if (currentRooms[rId].floorId === floorId) {
        delete currentRooms[rId];
      }
    }
    for (const r of newFloorRooms) {
      currentRooms[r.id] = r;
    }

    const currentProj = get().activeProject;
    set({ architecturalRooms: currentRooms });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalRooms: currentRooms,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  addDimension: async (dim: ArchitecturalDimension) => {
    const currentDims = get().architecturalDimensions || {};
    const updatedDims = { ...currentDims, [dim.id]: dim };
    pushArchUndo({ type: 'ADD_DIMENSION', dimension: dim });

    const currentProj = get().activeProject;
    set({ architecturalDimensions: updatedDims });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalDimensions: updatedDims,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  deleteDimension: async (id: string) => {
    const currentDims = { ...(get().architecturalDimensions || {}) };
    const dim = currentDims[id];
    if (!dim) return;
    delete currentDims[id];
    pushArchUndo({ type: 'DELETE_DIMENSION', dimension: dim });

    const currentProj = get().activeProject;
    set({
      architecturalDimensions: currentDims,
      selectedArchitecturalId: get().selectedArchitecturalId === id ? null : get().selectedArchitecturalId,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalDimensions: currentDims,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  updateArchitecturalSettings: async (settings: Partial<ArchitecturalSettings>) => {
    const current = get().architecturalSettings || DEFAULT_ARCHITECTURAL_SETTINGS;
    const updated: ArchitecturalSettings = {
      ...current,
      ...settings,
      snapSettings: { ...current.snapSettings, ...(settings.snapSettings || {}) },
      gridSettings: { ...current.gridSettings, ...(settings.gridSettings || {}) },
    };

    const currentProj = get().activeProject;
    set({ architecturalSettings: updated });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalSettings: updated,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  copyFloorPlan: async (sourceFloorId: string, targetFloorId: string) => {
    const currentWalls = get().architecturalWalls || {};
    const currentDoors = get().architecturalDoors || {};
    const currentWindows = get().architecturalWindows || {};
    const currentOpenings = get().architecturalOpenings || {};
    const currentRooms = get().architecturalRooms || {};

    const sourceWalls = Object.values(currentWalls).filter((w) => w.floorId === sourceFloorId);
    const sourceDoors = Object.values(currentDoors).filter((d) => d.floorId === sourceFloorId);
    const sourceWindows = Object.values(currentWindows).filter((w) => w.floorId === sourceFloorId);
    const sourceOpenings = Object.values(currentOpenings).filter((o) => o.floorId === sourceFloorId);
    const sourceRooms = Object.values(currentRooms).filter((r) => r.floorId === sourceFloorId);

    const newWalls: Record<string, ArchitecturalWall> = { ...currentWalls };
    const newDoors: Record<string, ArchitecturalDoor> = { ...currentDoors };
    const newWindows: Record<string, ArchitecturalWindow> = { ...currentWindows };
    const newOpenings: Record<string, ArchitecturalOpening> = { ...currentOpenings };
    const newRooms: Record<string, ArchitecturalRoom> = { ...currentRooms };

    const wallIdMap = new Map<string, string>();
    const existingWallIds = Object.keys(newWalls);

    // Copy walls with fresh unique IDs
    for (const w of sourceWalls) {
      const newId = ArchitecturalIdGenerator.generateWallId(existingWallIds);
      existingWallIds.push(newId);
      wallIdMap.set(w.id, newId);

      const targetFloorIdx = parseInt(targetFloorId.replace('floor_', ''), 10) || 0;
      const baseElev = targetFloorIdx * 3.2;

      newWalls[newId] = {
        ...w,
        id: newId,
        floorId: targetFloorId,
        baseElevation: baseElev,
        topElevation: baseElev + w.height,
      };
    }

    // Copy hosted doors
    const existingDoorIds = Object.keys(newDoors);
    for (const d of sourceDoors) {
      const mappedWallId = wallIdMap.get(d.hostWallId);
      if (mappedWallId) {
        const newId = ArchitecturalIdGenerator.generateDoorId(existingDoorIds);
        existingDoorIds.push(newId);
        newDoors[newId] = {
          ...d,
          id: newId,
          floorId: targetFloorId,
          hostWallId: mappedWallId,
        };
      }
    }

    // Copy hosted windows
    const existingWinIds = Object.keys(newWindows);
    for (const win of sourceWindows) {
      const mappedWallId = wallIdMap.get(win.hostWallId);
      if (mappedWallId) {
        const newId = ArchitecturalIdGenerator.generateWindowId(existingWinIds);
        existingWinIds.push(newId);
        newWindows[newId] = {
          ...win,
          id: newId,
          floorId: targetFloorId,
          hostWallId: mappedWallId,
        };
      }
    }

    // Copy hosted openings
    const existingOpIds = Object.keys(newOpenings);
    for (const op of sourceOpenings) {
      const mappedWallId = wallIdMap.get(op.hostWallId);
      if (mappedWallId) {
        const newId = ArchitecturalIdGenerator.generateOpeningId(existingOpIds);
        existingOpIds.push(newId);
        newOpenings[newId] = {
          ...op,
          id: newId,
          floorId: targetFloorId,
          hostWallId: mappedWallId,
        };
      }
    }

    // Copy rooms
    const existingRoomIds = Object.keys(newRooms);
    for (const r of sourceRooms) {
      const newId = ArchitecturalIdGenerator.generateRoomId(existingRoomIds);
      existingRoomIds.push(newId);
      newRooms[newId] = {
        ...r,
        id: newId,
        floorId: targetFloorId,
      };
    }

    const currentProj = get().activeProject;
    set({
      architecturalWalls: newWalls,
      architecturalDoors: newDoors,
      architecturalWindows: newWindows,
      architecturalOpenings: newOpenings,
      architecturalRooms: newRooms,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalWalls: newWalls,
        architecturalDoors: newDoors,
        architecturalWindows: newWindows,
        architecturalOpenings: newOpenings,
        architecturalRooms: newRooms,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  undoArchitecturalAction: async () => {
    if (architecturalUndoStack.length === 0) return;
    const action = architecturalUndoStack.pop();
    architecturalRedoStack.push(action);

    const walls = { ...(get().architecturalWalls || {}) };
    const doors = { ...(get().architecturalDoors || {}) };
    const windows = { ...(get().architecturalWindows || {}) };
    const openings = { ...(get().architecturalOpenings || {}) };
    const rooms = { ...(get().architecturalRooms || {}) };
    const dims = { ...(get().architecturalDimensions || {}) };

    switch (action.type) {
      case 'ADD_WALL':
        delete walls[action.wall.id];
        break;
      case 'UPDATE_WALL':
        walls[action.previous.id] = action.previous;
        break;
      case 'DELETE_WALL':
        walls[action.wall.id] = action.wall;
        if (action.deletedDoors) action.deletedDoors.forEach((d: any) => { doors[d.id] = d; });
        if (action.deletedWindows) action.deletedWindows.forEach((w: any) => { windows[w.id] = w; });
        if (action.deletedOpenings) action.deletedOpenings.forEach((o: any) => { openings[o.id] = o; });
        break;
      case 'ADD_DOOR':
        delete doors[action.door.id];
        break;
      case 'UPDATE_DOOR':
        doors[action.previous.id] = action.previous;
        break;
      case 'DELETE_DOOR':
        doors[action.door.id] = action.door;
        break;
      case 'ADD_WINDOW':
        delete windows[action.window.id];
        break;
      case 'UPDATE_WINDOW':
        windows[action.previous.id] = action.previous;
        break;
      case 'DELETE_WINDOW':
        windows[action.window.id] = action.window;
        break;
      case 'ADD_OPENING':
        delete openings[action.opening.id];
        break;
      case 'UPDATE_OPENING':
        openings[action.previous.id] = action.previous;
        break;
      case 'DELETE_OPENING':
        openings[action.opening.id] = action.opening;
        break;
      case 'ADD_ROOM':
        delete rooms[action.room.id];
        break;
      case 'UPDATE_ROOM':
        rooms[action.previous.id] = action.previous;
        break;
      case 'DELETE_ROOM':
        rooms[action.room.id] = action.room;
        break;
      case 'ADD_DIMENSION':
        delete dims[action.dimension.id];
        break;
      case 'DELETE_DIMENSION':
        dims[action.dimension.id] = action.dimension;
        break;
    }

    const currentProj = get().activeProject;
    set({
      architecturalWalls: walls,
      architecturalDoors: doors,
      architecturalWindows: windows,
      architecturalOpenings: openings,
      architecturalRooms: rooms,
      architecturalDimensions: dims,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalWalls: walls,
        architecturalDoors: doors,
        architecturalWindows: windows,
        architecturalOpenings: openings,
        architecturalRooms: rooms,
        architecturalDimensions: dims,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  redoArchitecturalAction: async () => {
    if (architecturalRedoStack.length === 0) return;
    const action = architecturalRedoStack.pop();
    architecturalUndoStack.push(action);

    const walls = { ...(get().architecturalWalls || {}) };
    const doors = { ...(get().architecturalDoors || {}) };
    const windows = { ...(get().architecturalWindows || {}) };
    const openings = { ...(get().architecturalOpenings || {}) };
    const rooms = { ...(get().architecturalRooms || {}) };
    const dims = { ...(get().architecturalDimensions || {}) };

    switch (action.type) {
      case 'ADD_WALL':
        walls[action.wall.id] = action.wall;
        break;
      case 'UPDATE_WALL':
        walls[action.current.id] = action.current;
        break;
      case 'DELETE_WALL':
        delete walls[action.wall.id];
        if (action.deletedDoors) action.deletedDoors.forEach((d: any) => { delete doors[d.id]; });
        if (action.deletedWindows) action.deletedWindows.forEach((w: any) => { delete windows[w.id]; });
        if (action.deletedOpenings) action.deletedOpenings.forEach((o: any) => { delete openings[o.id]; });
        break;
      case 'ADD_DOOR':
        doors[action.door.id] = action.door;
        break;
      case 'UPDATE_DOOR':
        doors[action.current.id] = action.current;
        break;
      case 'DELETE_DOOR':
        delete doors[action.door.id];
        break;
      case 'ADD_WINDOW':
        windows[action.window.id] = action.window;
        break;
      case 'UPDATE_WINDOW':
        windows[action.current.id] = action.current;
        break;
      case 'DELETE_WINDOW':
        delete windows[action.window.id];
        break;
      case 'ADD_OPENING':
        openings[action.opening.id] = action.opening;
        break;
      case 'UPDATE_OPENING':
        openings[action.current.id] = action.current;
        break;
      case 'DELETE_OPENING':
        delete openings[action.opening.id];
        break;
      case 'ADD_ROOM':
        rooms[action.room.id] = action.room;
        break;
      case 'UPDATE_ROOM':
        rooms[action.current.id] = action.current;
        break;
      case 'DELETE_ROOM':
        delete rooms[action.room.id];
        break;
      case 'ADD_DIMENSION':
        dims[action.dimension.id] = action.dimension;
        break;
      case 'DELETE_DIMENSION':
        delete dims[action.dimension.id];
        break;
    }

    const currentProj = get().activeProject;
    set({
      architecturalWalls: walls,
      architecturalDoors: doors,
      architecturalWindows: windows,
      architecturalOpenings: openings,
      architecturalRooms: rooms,
      architecturalDimensions: dims,
    });

    if (currentProj) {
      const updatedProject: StoredProject = {
        ...currentProj,
        architecturalWalls: walls,
        architecturalDoors: doors,
        architecturalWindows: windows,
        architecturalOpenings: openings,
        architecturalRooms: rooms,
        architecturalDimensions: dims,
        metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }
  },

  runFemAnalysis: async () => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return;

    set({ isLoading: true });
    // Yield to the event loop so the browser can paint the running loading screen
    await new Promise((resolve) => setTimeout(resolve, 30));

    try {
      const femResult = await runFemAnalysisAsync(activeModel, {
        concreteE: activeProject?.metadata.designSettings?.concreteGrade === 'M30' ? 27386000 : 25000000,
        concreteDensity: 25,
      });

      // Compute factored Load Combination forces by superposing per-load-case results.
      // (The FEM solver processes raw load cases; combination results are derived here.)
      let comboCases = femResult.memberForces;
      let comboReactions = femResult.reactions;
      let comboDrifts = femResult.storyDrifts;
      const comboDisplacements: Map<number, { [lcId: number]: [number, number, number, number, number, number] }> = new Map(
        Array.from(femResult.nodeDisplacements.entries()).map(([nid, m]) => [nid, { ...m }])
      );
      if (activeModel.loadCombinations && activeModel.loadCombinations.size > 0) {
        const comboForces: { [memberId: number]: { [lcId: number]: { sectionLocation: number; axial: number; vy: number; vz: number; torsion: number; my: number; mz: number }[] } } = {};
        const comboReacts: { [lcId: number]: { [nodeId: number]: { fx: number; fy: number; fz: number; mx: number; my: number; mz: number } } } = {};

        // Group per-load-case records by loadCaseId
        const caseForces = new Map<number, typeof femResult.memberForces>();
        for (const mf of femResult.memberForces) {
          const arr = caseForces.get(mf.loadCaseId) || [];
          arr.push(mf);
          caseForces.set(mf.loadCaseId, arr);
        }
        const caseReacts = new Map<number, typeof femResult.reactions>();
        for (const r of femResult.reactions) {
          const arr = caseReacts.get(r.loadCaseId) || [];
          arr.push(r);
          caseReacts.set(r.loadCaseId, arr);
        }

        for (const [cid, combo] of activeModel.loadCombinations.entries()) {
          // --- Member forces ---
          const perLoc: { [memberId: number]: { [locIndex: number]: { axial: number; vy: number; vz: number; torsion: number; my: number; mz: number } } } = {};
          for (const factor of combo.factors) {
            const cases = caseForces.get(factor.loadCaseId) || [];
            for (const mf of cases) {
              const cur = perLoc[mf.memberId] || {};
              const idx = mf.sectionLocation;
              const acc = cur[idx] || { axial: 0, vy: 0, vz: 0, torsion: 0, my: 0, mz: 0 };
              acc.axial += factor.factor * (mf.axial || 0);
              acc.vy += factor.factor * (mf.vy || 0);
              acc.vz += factor.factor * (mf.vz || 0);
              acc.torsion += factor.factor * (mf.torsion || 0);
              acc.my += factor.factor * (mf.my || 0);
              acc.mz += factor.factor * (mf.mz || 0);
              cur[idx] = acc;
              perLoc[mf.memberId] = cur;
            }
          }
          for (const [memberId, locs] of Object.entries(perLoc)) {
            for (const [locKey, f] of Object.entries(locs)) {
              comboForces[Number(memberId)] = comboForces[Number(memberId)] || {};
              comboForces[Number(memberId)][cid] = comboForces[Number(memberId)][cid] || [];
              comboForces[Number(memberId)][cid].push({
                sectionLocation: parseFloat(locKey) || 0,
                axial: parseFloat(f.axial.toFixed(2)),
                vy: parseFloat(f.vy.toFixed(2)),
                vz: parseFloat(f.vz.toFixed(2)),
                torsion: parseFloat(f.torsion.toFixed(2)),
                my: parseFloat(f.my.toFixed(2)),
                mz: parseFloat(f.mz.toFixed(2)),
              });
            }
          }

          // --- Reactions ---
          const perNode: { [nodeId: number]: { fx: number; fy: number; fz: number; mx: number; my: number; mz: number } } = {};
          for (const factor of combo.factors) {
            for (const r of caseReacts.get(factor.loadCaseId) || []) {
              const acc = perNode[r.nodeId] || { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
              acc.fx += factor.factor * (r.fx || 0);
              acc.fy += factor.factor * (r.fy || 0);
              acc.fz += factor.factor * (r.fz || 0);
              acc.mx += factor.factor * (r.mx || 0);
              acc.my += factor.factor * (r.my || 0);
              acc.mz += factor.factor * (r.mz || 0);
              perNode[r.nodeId] = acc;
            }
          }
          comboReacts[cid] = perNode;
        }

        // --- Linear superposition of nodal displacements for each combination ---
        for (const [cid, combo] of activeModel.loadCombinations.entries()) {
          for (const [nodeId, caseMap] of femResult.nodeDisplacements.entries()) {
            const acc: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
            for (const factor of combo.factors) {
              const d = caseMap[factor.loadCaseId];
              if (!d) continue;
              for (let k = 0; k < 6; k++) acc[k] += factor.factor * d[k];
            }
            const existing = comboDisplacements.get(nodeId) || {};
            existing[cid] = acc.map((v) => parseFloat(v.toFixed(6))) as [number, number, number, number, number, number];
            comboDisplacements.set(nodeId, existing);
          }
        }

        // Append combination member force records (O(N) direct mapping, zero searching)
        const extraForces: typeof femResult.memberForces = [];
        for (const [memberId, lcs] of Object.entries(comboForces)) {
          for (const [lcId, list] of Object.entries(lcs)) {
            let stationIdx = 0;
            for (const f of list) {
              extraForces.push({
                memberId: Number(memberId),
                loadCaseId: Number(lcId),
                sectionLocation: f.sectionLocation ?? (stationIdx * 0.25),
                axial: f.axial,
                vy: f.vy,
                vz: f.vz,
                torsion: f.torsion,
                my: f.my,
                mz: f.mz,
              });
              stationIdx++;
            }
          }
        }
        comboCases = [...femResult.memberForces, ...extraForces];

        // Append combination reaction records
        const extraReacts: typeof femResult.reactions = [];
        for (const [lcId, nodes] of Object.entries(comboReacts)) {
          for (const [nodeId, r] of Object.entries(nodes)) {
            extraReacts.push({
              nodeId: Number(nodeId),
              loadCaseId: Number(lcId),
              fx: parseFloat(r.fx.toFixed(2)),
              fy: parseFloat(r.fy.toFixed(2)),
              fz: parseFloat(r.fz.toFixed(2)),
              mx: parseFloat(r.mx.toFixed(2)),
              my: parseFloat(r.my.toFixed(2)),
              mz: parseFloat(r.mz.toFixed(2)),
            });
          }
        }
        comboReactions = [...femResult.reactions, ...extraReacts];
      }

      const updatedModel: NormalizedStructuralModel = {
        ...activeModel,
        reactions: comboReactions,
        memberForces: comboCases,
        storyDrifts: comboDrifts,
        nodeDisplacements: comboDisplacements,
      };

      set({ activeModel: updatedModel, isLoading: false });

      if (activeProject) {
        const updatedProject: StoredProject = {
          ...activeProject,
          model: ProjectStorage.serializeModel(updatedModel),
          metadata: {
            ...activeProject.metadata,
            updatedAt: new Date().toISOString(),
          },
        };
        try {
          await ProjectStorage.saveProject(updatedProject);
        } catch (storageErr) {
          console.warn('Could not save project to local DB:', storageErr);
        }
        set({ activeProject: updatedProject });
      }
    } catch (e) {
      console.error('FEM analysis failed:', e);
      set({ isLoading: false });
      throw e;
    }
  },

  runSeismicAnalysis: async (params?: Partial<any>) => {
    const { activeModel, activeProject, assignFrameLoads } = get();
    if (!activeModel || activeModel.members.size === 0) return null;

    // 1. Compute IS 1893:2016 equivalent-static seismic parameters from the real model
    const summary = SeismicEngine.computeEquivalentStaticSeismic(activeModel, params);

    // 2. Convert per-storey lateral forces into nodal EQX / EQZ frame loads.
    //    Each storey force is distributed to the beam/column joints at that elevation.
    if (summary.storeys.length > 0) {
      // Collect storey lateral forces keyed by elevation
      const storeyForces = summary.storeys.map((s) => ({
        elevationY: s.elevationY,
        qx: s.lateralForceQxKn,
        qz: s.lateralForceQzKn,
        nJoints: 1,
      }));

      // Distribute evenly across the joints at each elevation for EQX
      for (const sf of storeyForces) {
        const joints = Array.from(activeModel.nodes.values()).filter(
          (n) => Math.abs(n.y - sf.elevationY) < 0.1
        );
        if (joints.length === 0) continue;
        const perJointX = sf.qx / joints.length;
        for (const j of joints) {
          // EQX applies lateral load in X on this joint -> represented as equal and
          // opposite nodal forces on the member ends of the two adjacent columns
          const membersHere = Array.from(activeModel.members.values()).filter(
            (m) =>
              (m.startNodeId === j.id || m.endNodeId === j.id) &&
              activeModel.nodes.get(m.startNodeId) &&
              (
                Math.abs(activeModel.nodes.get(m.startNodeId)!.y - sf.elevationY) < 0.1 ||
                Math.abs(activeModel.nodes.get(m.endNodeId)!.y - sf.elevationY) < 0.1
              )
          );
          if (membersHere.length === 0) continue;
          // Assign a point/lateral load to the column member carrying X-lateral force
          await assignFrameLoads([membersHere[0].id], {
            memberId: 0,
            loadPattern: 'EQX',
            type: 'POINT',
            w1: perJointX,
            d1: 0.5,
            direction: 'GLOBAL_X',
          });
        }
      }
    }

    // 3. Rerun FEM so the EQ loads are analysed together with DL/LL
    await get().runFemAnalysis();

    return summary;
  },

  runAllDesignChecks: async () => {
    const { activeModel, activeProject } = get();
    if (!activeModel || !activeProject || activeModel.members.size === 0) return 0;

    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const cover = activeProject.metadata.designSettings.clearCoverColumn || 40;

    const summaryMap = new Map<number, MemberDesignSummary>();

    for (const member of activeModel.members.values()) {
      const forces = (activeModel.memberForces || []).filter((f) => f.memberId === member.id);
      if (forces.length === 0) continue;

      let maxPu = 0, maxVy = 0, maxVz = 0, maxMz = 0, maxMy = 0, govLC = 1;
      for (const f of forces) {
        if (Math.abs(f.axial) > Math.abs(maxPu)) { maxPu = f.axial; govLC = f.loadCaseId; }
        if (Math.abs(f.vy) > Math.abs(maxVy)) maxVy = f.vy;
        if (Math.abs(f.vz) > Math.abs(maxVz)) maxVz = f.vz;
        if (Math.abs(f.mz) > Math.abs(maxMz)) maxMz = f.mz;
        if (Math.abs(f.my) > Math.abs(maxMy)) maxMy = f.my;
      }

      const b = Math.round((member.section.zd || 0.3) * 1000);
      const D = Math.round((member.section.yd || 0.45) * 1000);

      let status: MemberDesignSummary['status'] = 'PASS';
      const notes: string[] = [];

      if (member.classification === 'COLUMN') {
        const res = ColumnDesignEngine.design({
          memberId: member.id,
          b,
          D,
          unsupportedHeight: member.length || 3.5,
          fck,
          fy,
          cover,
          Pu: Math.abs(maxPu) || 650,
          Mux: Math.abs(maxMz),
          Muy: Math.abs(maxMy),
          governingLoadCase: govLC,
          allowedDiameters: [12, 16, 20, 25],
        });
        status = res.status;
        if (res.status === 'FAIL') notes.push(`Bi-axial corner case exceeded (IR ${res.biaxialCheck.interactionRatio.toFixed(2)}).`);
      } else if (member.classification === 'BEAM') {
        const res = BeamDesignEngine.design({
          memberId: member.id,
          b,
          D,
          spanLength: member.length || 4,
          fck,
          fy,
          Mu_top: Math.abs(forces.reduce((M, f) => Math.max(M, Math.abs(f.mz)), 0)),
          Mu_bottom: Math.abs(forces.reduce((M, f) => Math.max(M, Math.abs(f.mz)), 0)) * 0.6,
          Vu: Math.max(Math.abs(maxVy), Math.abs(maxVz)),
        });
        status = res.flexureTop.status === 'FAIL' || res.flexureBottom.status === 'FAIL' || res.shear.status === 'FAIL' ? 'FAIL' : 'PASS';
        if (status === 'FAIL') notes.push('Flexure / shear demand exceeded section capacity.');
      }

      summaryMap.set(member.id, {
        memberId: member.id,
        classification: member.classification,
        sectionDimensions: `${D}×${b} mm`,
        governingLoadCase: govLC,
        maxAxial: parseFloat(Math.abs(maxPu).toFixed(1)),
        maxShear: parseFloat(Math.max(Math.abs(maxVy), Math.abs(maxVz)).toFixed(1)),
        maxMoment: parseFloat(Math.max(Math.abs(maxMz), Math.abs(maxMy)).toFixed(1)),
        status,
        notes,
      });
    }

    // Update member designStatus and attach designSummaries to the model
    const members = new Map(activeModel.members);
    for (const [mid, sum] of summaryMap.entries()) {
      const m = members.get(mid);
      if (m) {
        members.set(mid, { ...m, designStatus: sum.status === 'FAIL'
          ? 'FAIL' : sum.status === 'WARNING' ? 'WARNING' : 'PASS' });
      }
    }

    const updatedModel: NormalizedStructuralModel = {
      ...activeModel,
      members,
      designSummaries: summaryMap,
    };

    set({ activeModel: updatedModel });

    if (activeProject) {
      const updatedProject: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
        metadata: { ...activeProject.metadata, updatedAt: new Date().toISOString() },
      };
      await ProjectStorage.saveProject(updatedProject);
      set({ activeProject: updatedProject });
    }

    return summaryMap.size;
  },

  generateBuildingGrid: async (
    baysX = 3,
    baysZ = 2,
    widthX = 4.5,
    widthZ = 4.0,
    stories = 3,
    storyH = 3.2
  ) => {
    set({ isLoading: true });
    try {
      const nodes = new Map<number, Node3D>();
      const members = new Map<number, Member3D>();
      const supports = new Map<number, Support3D>();
      const plates = new Map();

      let nodeIdCounter = 1;
      let memberIdCounter = 1;

      // Coordinate map to Node ID: `${s}_${ix}_${iz}` -> nodeId
      const gridNodeMap = new Map<string, number>();

      for (let s = 0; s <= stories; s++) {
        const y = parseFloat((s * storyH).toFixed(3));
        for (let ix = 0; ix <= baysX; ix++) {
          const x = parseFloat((ix * widthX).toFixed(3));
          for (let iz = 0; iz <= baysZ; iz++) {
            const z = parseFloat((iz * widthZ).toFixed(3));
            const id = nodeIdCounter++;
            const isSupport = s === 0;

            nodes.set(id, { id, x, y, z, isSupport });
            gridNodeMap.set(`${s}_${ix}_${iz}`, id);

            if (isSupport) {
              supports.set(id, {
                nodeId: id,
                type: 'FIXED',
                releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
              });
            }
          }
        }
      }

      // Create Columns (Vertical between stories)
      for (let s = 0; s < stories; s++) {
        for (let ix = 0; ix <= baysX; ix++) {
          for (let iz = 0; iz <= baysZ; iz++) {
            const startId = gridNodeMap.get(`${s}_${ix}_${iz}`)!;
            const endId = gridNodeMap.get(`${s + 1}_${ix}_${iz}`)!;
            const id = memberIdCounter++;

            members.set(id, {
              id,
              startNodeId: startId,
              endNodeId: endId,
              length: storyH,
              classification: 'COLUMN',
              isAutoClassified: true,
              section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.45, name: 'C450x450' },
              materialName: 'CONCRETE',
              designStatus: 'NOT_DESIGNED',
            });
          }
        }
      }

      // Create Beams (Horizontal at each elevated story s >= 1)
      for (let s = 1; s <= stories; s++) {
        // X-direction Beams
        for (let ix = 0; ix < baysX; ix++) {
          for (let iz = 0; iz <= baysZ; iz++) {
            const startId = gridNodeMap.get(`${s}_${ix}_${iz}`)!;
            const endId = gridNodeMap.get(`${s}_${ix + 1}_${iz}`)!;
            const id = memberIdCounter++;

            members.set(id, {
              id,
              startNodeId: startId,
              endNodeId: endId,
              length: widthX,
              classification: 'BEAM',
              isAutoClassified: true,
              section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3, name: 'B300x450' },
              materialName: 'CONCRETE',
              designStatus: 'NOT_DESIGNED',
            });
          }
        }

        // Z-direction Beams
        for (let ix = 0; ix <= baysX; ix++) {
          for (let iz = 0; iz < baysZ; iz++) {
            const startId = gridNodeMap.get(`${s}_${ix}_${iz}`)!;
            const endId = gridNodeMap.get(`${s}_${ix}_${iz + 1}`)!;
            const id = memberIdCounter++;

            members.set(id, {
              id,
              startNodeId: startId,
              endNodeId: endId,
              length: widthZ,
              classification: 'BEAM',
              isAutoClassified: true,
              section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3, name: 'B300x450' },
              materialName: 'CONCRETE',
              designStatus: 'NOT_DESIGNED',
            });
          }
        }
      }

      const totalBeams = Array.from(members.values()).filter((m) => m.classification === 'BEAM').length;
      const totalColumns = Array.from(members.values()).filter((m) => m.classification === 'COLUMN').length;

      const newModel: NormalizedStructuralModel = {
        nodes,
        members,
        plates,
        supports,
        loadCases: new Map([
          [1, { id: 1, title: 'Dead Load (DL)', type: 'DEAD', isCombination: false }],
          [2, { id: 2, title: 'Live Load (LL)', type: 'LIVE', isCombination: false }],
          [3, { id: 3, title: 'Seismic Load X (EQX)', type: 'SEISMIC', direction: 'X', isCombination: false }],
          [4, { id: 4, title: 'Seismic Load Z (EQZ)', type: 'SEISMIC', direction: 'Z', isCombination: false }],
        ]),
        loadCombinations: new Map([
          [101, { id: 101, title: '1.5(DL + LL)', factors: [{ loadCaseId: 1, factor: 1.5 }, { loadCaseId: 2, factor: 1.5 }] }],
          [102, { id: 102, title: '1.2(DL + LL + EQX)', factors: [{ loadCaseId: 1, factor: 1.2 }, { loadCaseId: 2, factor: 1.2 }, { loadCaseId: 3, factor: 1.2 }] }],
        ]),
        reactions: [],
        memberForces: [],
        storyDrifts: [],
        boundingBox: {
          minX: 0,
          maxX: baysX * widthX,
          minY: 0,
          maxY: stories * storyH,
          minZ: 0,
          maxZ: baysZ * widthZ,
        },
        statistics: {
          totalNodes: nodes.size,
          totalMembers: members.size,
          totalBeams,
          totalColumns,
          totalPlates: 0,
          totalSupports: supports.size,
          totalLoadCases: 4,
          totalCombinations: 2,
          maxElevation: stories * storyH,
          baseElevation: 0,
        },
      };

      // Run FEM solver on the newly generated structural building frame via Web Worker
      const femResult = await runFemAnalysisAsync(newModel);
      newModel.reactions = femResult.reactions;
      newModel.memberForces = femResult.memberForces;
      newModel.storyDrifts = femResult.storyDrifts;

      const currentProj = get().activeProject;
      let targetProj: StoredProject;
      if (!currentProj) {
        targetProj = {
          metadata: {
            id: `prj_${Date.now()}`,
            name: `${baysX}x${baysZ} Bay G+${stories - 1} Building Model`,
            code: `PRJ-${new Date().getFullYear()}-ETABS`,
            client: 'Structure AI Client',
            engineer: 'Structural Engineer',
            location: 'Site Location',
            date: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            description: 'Parametric Multi-Storey Building Model',
            designSettings: DEFAULT_DESIGN_SETTINGS,
          },
          model: ProjectStorage.serializeModel(newModel),
          warnings: [],
        };
      } else {
        targetProj = {
          ...currentProj,
          model: ProjectStorage.serializeModel(newModel),
          metadata: { ...currentProj.metadata, updatedAt: new Date().toISOString() },
        };
      }

      await ProjectStorage.saveProject(targetProj);
      set({ activeModel: newModel, activeProject: targetProj, isLoading: false });
    } catch (e) {
      console.error('Failed to generate building grid:', e);
      set({ isLoading: false });
    }
  },

  addStructuralNode: async (x: number, y: number, z: number, isSupport = false) => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return -1;

    const newId = Math.max(0, ...Array.from(activeModel.nodes.keys())) + 1;
    const newNodes = new Map(activeModel.nodes);
    newNodes.set(newId, { id: newId, x, y, z, isSupport });

    const newSupports = new Map(activeModel.supports);
    if (isSupport) {
      newSupports.set(newId, {
        nodeId: newId,
        type: 'FIXED',
        releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
      });
    }

    const updatedModel: NormalizedStructuralModel = {
      ...activeModel,
      nodes: newNodes,
      supports: newSupports,
      statistics: {
        ...activeModel.statistics,
        totalNodes: newNodes.size,
        totalSupports: newSupports.size,
      },
    };

    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
    return newId;
  },

  addStructuralMember: async (
    startNodeId: number,
    endNodeId: number,
    section: Partial<CrossSection> = { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
    classification?: 'COLUMN' | 'BEAM'
  ) => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return -1;

    const start = activeModel.nodes.get(startNodeId);
    const end = activeModel.nodes.get(endNodeId);
    if (!start || !end) return -1;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = parseFloat(Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(3));

    const isCol = classification ? classification === 'COLUMN' : Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > Math.abs(dz);

    const newId = Math.max(0, ...Array.from(activeModel.members.keys())) + 1;
    const newMembers = new Map(activeModel.members);
    newMembers.set(newId, {
      id: newId,
      startNodeId,
      endNodeId,
      length,
      classification: isCol ? 'COLUMN' : 'BEAM',
      isAutoClassified: true,
      section: {
        type: section.type || 'RECTANGULAR',
        yd: section.yd || (isCol ? 0.45 : 0.45),
        zd: section.zd || (isCol ? 0.45 : 0.3),
        name: section.name || (isCol ? 'C450x450' : 'B300x450'),
      },
      materialName: 'CONCRETE',
      designStatus: 'NOT_DESIGNED',
    });

    const totalBeams = Array.from(newMembers.values()).filter((m) => m.classification === 'BEAM').length;
    const totalColumns = Array.from(newMembers.values()).filter((m) => m.classification === 'COLUMN').length;

    const updatedModel: NormalizedStructuralModel = {
      ...activeModel,
      members: newMembers,
      statistics: {
        ...activeModel.statistics,
        totalMembers: newMembers.size,
        totalBeams,
        totalColumns,
      },
    };

    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
    return newId;
  },

  addStructuralPlate: async (
    nodeIds: number[],
    classification: 'SLAB' | 'WALL' = 'SLAB',
    thickness?: number,
    materialName = 'M25'
  ) => {
    const { activeModel, activeProject } = get();
    if (!activeModel || nodeIds.length < 3) return -1;

    const existingNodes = nodeIds.filter((nid) => activeModel.nodes.has(nid));
    if (existingNodes.length < 3) return -1;

    const newId = Math.max(0, ...Array.from(activeModel.plates.keys())) + 1;
    const newPlates = new Map(activeModel.plates);
    newPlates.set(newId, {
      id: newId,
      nodeIds: existingNodes,
      thickness: thickness ?? (classification === 'WALL' ? 0.23 : 0.125),
      materialName,
      classification,
    });

    const updatedModel: NormalizedStructuralModel = {
      ...activeModel,
      plates: newPlates,
      statistics: {
        ...activeModel.statistics,
        totalPlates: newPlates.size,
      },
    };

    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
    return newId;
  },

  deleteStructuralElements: async (nodeIds = [], memberIds = []) => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return;

    const newNodes = new Map(activeModel.nodes);
    const newMembers = new Map(activeModel.members);
    const newSupports = new Map(activeModel.supports);
    const newMemberLoads = new Map(activeModel.memberLoads || []);
    const newMemberModifiers = new Map(activeModel.memberModifiers || []);

    const toDelete = new Set<number>(memberIds);
    memberIds.forEach((id) => newMembers.delete(id));
    nodeIds.forEach((id) => {
      newNodes.delete(id);
      newSupports.delete(id);
      // Remove any member connected to this deleted node
      for (const [memId, mem] of newMembers.entries()) {
        if (mem.startNodeId === id || mem.endNodeId === id) {
          newMembers.delete(memId);
          toDelete.add(memId);
        }
      }
    });

    // Clean up stale per-member references (loads, modifiers, forces, reactions)
    toDelete.forEach((id) => {
      newMemberLoads.delete(id);
      newMemberModifiers.delete(id);
    });
    const memberForces = activeModel.memberForces.filter((mf) => !toDelete.has(mf.memberId));
    const reactions = activeModel.reactions.filter((r) =>
      !nodeIds.includes(r.nodeId) && !toDelete.has(r.nodeId)
    );

    const totalBeams = Array.from(newMembers.values()).filter((m) => m.classification === 'BEAM').length;
    const totalColumns = Array.from(newMembers.values()).filter((m) => m.classification === 'COLUMN').length;

    const updatedModel: NormalizedStructuralModel = {
      ...activeModel,
      nodes: newNodes,
      members: newMembers,
      supports: newSupports,
      memberLoads: newMemberLoads,
      memberModifiers: newMemberModifiers,
      memberForces,
      reactions,
      statistics: {
        ...activeModel.statistics,
        totalNodes: newNodes.size,
        totalMembers: newMembers.size,
        totalBeams,
        totalColumns,
        totalSupports: newSupports.size,
      },
    };

    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
  },

  assignMemberSection: async (memberIds: number[], section: Partial<CrossSection>) => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return;

    const newMembers = new Map(activeModel.members);
    memberIds.forEach((id) => {
      const mem = newMembers.get(id);
      if (mem) {
        newMembers.set(id, {
          ...mem,
          section: {
            ...mem.section,
            ...section,
          },
        });
      }
    });

    const updatedModel = { ...activeModel, members: newMembers };
    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
  },

  assignSupportRestraint: async (nodeIds: number[], type: 'FIXED' | 'PINNED' | 'ROLLER') => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return;

    const newSupports = new Map(activeModel.supports);
    const newNodes = new Map(activeModel.nodes);

    nodeIds.forEach((id) => {
      const n = newNodes.get(id);
      if (n) {
        newNodes.set(id, { ...n, isSupport: true });
        newSupports.set(id, {
          nodeId: id,
          type,
          releases: {
            // PINNED: translations fixed, rotations released
            // ROLLER: additionally releases one horizontal translation (fx) so it can slide,
            //         while still resisting vertical (fy) gravity and staying stable
            fx: type === 'ROLLER',
            fy: false,
            fz: false,
            mx: type === 'PINNED' || type === 'ROLLER',
            my: type === 'PINNED' || type === 'ROLLER',
            mz: type === 'PINNED' || type === 'ROLLER',
          },
        });
      }
    });

    const updatedModel = { ...activeModel, nodes: newNodes, supports: newSupports };
    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
  },

  assignFrameLoads: async (memberIds: number[], load: MemberLoad) => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return;

    const newMemberLoads = new Map(activeModel.memberLoads || []);
    memberIds.forEach((id) => {
      const existing = newMemberLoads.get(id) || [];
      // Replace existing load of same pattern or append
      const filtered = existing.filter((l) => l.loadPattern !== load.loadPattern);
      newMemberLoads.set(id, [...filtered, { ...load, memberId: id, id: `load_${id}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}` }]);
    });

    const updatedModel = { ...activeModel, memberLoads: newMemberLoads };
    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
  },

  deleteMemberLoads: async (memberIds: number[]) => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return;

    const newMemberLoads = new Map(activeModel.memberLoads || []);
    memberIds.forEach((id) => newMemberLoads.delete(id));

    const updatedModel = { ...activeModel, memberLoads: newMemberLoads };
    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
  },

  assignShellLoads: async (levelY: number, load: ShellLoad) => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return;

    const existingLoads = (activeModel.shellLoads || []).filter(
      (sl) => !(Math.abs(sl.levelY - levelY) < 0.1 && sl.loadPattern === load.loadPattern)
    );
    const newShellLoads = [...existingLoads, { ...load, levelY, id: `sload_${levelY}_${Date.now()}` }];

    const updatedModel = { ...activeModel, shellLoads: newShellLoads };
    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
  },

  assignMemberModifiers: async (memberIds: number[], modifiers: Partial<MemberModifier>) => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return;

    const newModifiers = new Map(activeModel.memberModifiers || []);
    memberIds.forEach((id) => {
      const current = newModifiers.get(id) || {
        memberId: id,
        axialArea: 1.0,
        shearY: 1.0,
        shearZ: 1.0,
        torsionJ: 0.2,
        momentIyy: 0.35,
        momentIzz: 0.35,
      };
      newModifiers.set(id, { ...current, ...modifiers, memberId: id });
    });

    const updatedModel = { ...activeModel, memberModifiers: newModifiers };
    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
  },

  replicateStory: async (sourceElevationY: number, targetElevationsY: number[]) => {
    const { activeModel, activeProject, runFemAnalysis } = get();
    if (!activeModel || targetElevationsY.length === 0) return;

    const newNodes = new Map(activeModel.nodes);
    const newMembers = new Map(activeModel.members);
    const newMemberLoads = new Map(activeModel.memberLoads || []);

    let maxNodeId = Math.max(0, ...Array.from(newNodes.keys()));
    let maxMemId = Math.max(0, ...Array.from(newMembers.keys()));

    // Find all nodes at source elevation
    const sourceNodes = Array.from(newNodes.values()).filter(
      (n) => Math.abs(n.y - sourceElevationY) < 0.15
    );

    // Find all beams at source elevation
    const sourceBeams = Array.from(newMembers.values()).filter((m) => {
      const sNode = newNodes.get(m.startNodeId);
      const eNode = newNodes.get(m.endNodeId);
      return (
        sNode &&
        eNode &&
        Math.abs(sNode.y - sourceElevationY) < 0.15 &&
        Math.abs(eNode.y - sourceElevationY) < 0.15
      );
    });

    // Find all columns whose TOP node is at the source elevation (so we can
    // replicate the column below each target storey layout)
    const sourceColumns = Array.from(newMembers.values()).filter((m) => {
      const sNode = newNodes.get(m.startNodeId);
      const eNode = newNodes.get(m.endNodeId);
      if (!sNode || !eNode) return false;
      const topNode = sNode.y > eNode.y ? sNode : eNode;
      return (
        m.classification === 'COLUMN' &&
        Math.abs(topNode.y - sourceElevationY) < 0.15
      );
    });

    const newMemberModifiers = new Map(activeModel.memberModifiers || []);

    for (const targetY of targetElevationsY) {
      if (Math.abs(targetY - sourceElevationY) < 0.1) continue;

      const sourceToTargetNodeMap = new Map<number, number>();

      // 1. Create duplicate nodes at target elevation
      sourceNodes.forEach((sn) => {
        // Check if node already exists at target coordinate
        const existingNode = Array.from(newNodes.values()).find(
          (n) =>
            Math.abs(n.x - sn.x) < 0.05 &&
            Math.abs(n.z - sn.z) < 0.05 &&
            Math.abs(n.y - targetY) < 0.1
        );

        if (existingNode) {
          sourceToTargetNodeMap.set(sn.id, existingNode.id);
        } else {
          maxNodeId += 1;
          newNodes.set(maxNodeId, {
            id: maxNodeId,
            x: sn.x,
            y: targetY,
            z: sn.z,
            isSupport: false,
          });
          sourceToTargetNodeMap.set(sn.id, maxNodeId);
        }
      });

      // 2. Duplicate framing beams
      sourceBeams.forEach((sb) => {
        const newStartNodeId = sourceToTargetNodeMap.get(sb.startNodeId);
        const newEndNodeId = sourceToTargetNodeMap.get(sb.endNodeId);

        if (newStartNodeId && newEndNodeId) {
          // Check if beam already exists
          const existingBeam = Array.from(newMembers.values()).find(
            (m) =>
              (m.startNodeId === newStartNodeId && m.endNodeId === newEndNodeId) ||
              (m.startNodeId === newEndNodeId && m.endNodeId === newStartNodeId)
          );

          if (!existingBeam) {
            maxMemId += 1;
            newMembers.set(maxMemId, {
              id: maxMemId,
              startNodeId: newStartNodeId,
              endNodeId: newEndNodeId,
              length: sb.length,
              classification: 'BEAM',
              isAutoClassified: true,
              section: { ...sb.section },
              materialName: sb.materialName,
              designStatus: 'NOT_DESIGNED',
            });

            // Replicate beam loads if any
            const loads = newMemberLoads.get(sb.id);
            if (loads) {
              newMemberLoads.set(
                maxMemId,
                loads.map((l) => ({ ...l, memberId: maxMemId }))
              );
            }

            // Replicate member modifiers if any
            const mod = activeModel.memberModifiers?.get(sb.id);
            if (mod) {
              newMemberModifiers.set(maxMemId, { ...mod, memberId: maxMemId });
            }
          }
        }
      });

      // 3. Duplicate columns whose top joint is at the target elevation
      sourceColumns.forEach((sc) => {
        const topSource = newNodes.get(sc.startNodeId);
        const topSourceIsTop =
          topSource &&
          Math.abs(topSource.y - sourceElevationY) < 0.15 &&
          sc.startNodeId === topSource.id;
        // The top source node maps to a target node; re-derive column ends:
        const sNode = newNodes.get(sc.startNodeId);
        const eNode = newNodes.get(sc.endNodeId);
        if (!sNode || !eNode) return;

        // Top node of source column is the one at sourceElevationY
        const srcTop = sNode.y > eNode.y ? sNode : eNode;
        const srcBot = sNode.y > eNode.y ? eNode : sNode;

        const targetTopNodeId = sourceToTargetNodeMap.get(srcTop.id);
        if (!targetTopNodeId) return;

        // Find matching existing node below target elevation (same x, z, y = srcBot.y + offset)
        const targetBotNodeId = Array.from(newNodes.values()).find(
          (n) =>
            Math.abs(n.x - srcBot.x) < 0.05 &&
            Math.abs(n.z - srcBot.z) < 0.05 &&
            Math.abs(n.y - srcBot.y) < 0.1
        )?.id;

        if (!targetBotNodeId) return;

        const existingCol = Array.from(newMembers.values()).find(
          (m) =>
            (m.startNodeId === targetBotNodeId && m.endNodeId === targetTopNodeId) ||
            (m.startNodeId === targetTopNodeId && m.endNodeId === targetBotNodeId)
        );

        if (!existingCol) {
          maxMemId += 1;
          const botNode = newNodes.get(targetBotNodeId)!;
          const topNode = newNodes.get(targetTopNodeId)!;
          const dy = topNode.y - botNode.y;
          newMembers.set(maxMemId, {
            id: maxMemId,
            startNodeId: botNode.id,
            endNodeId: topNode.id,
            length: parseFloat(Math.abs(dy).toFixed(3)),
            classification: 'COLUMN',
            isAutoClassified: true,
            section: { ...sc.section },
            materialName: sc.materialName,
            designStatus: 'NOT_DESIGNED',
          });

          const mod = activeModel.memberModifiers?.get(sc.id);
          if (mod) {
            newMemberModifiers.set(maxMemId, { ...mod, memberId: maxMemId });
          }
        }
      });
    }

    const updatedModel = {
      ...activeModel,
      nodes: newNodes,
      members: newMembers,
      memberLoads: newMemberLoads,
      memberModifiers: newMemberModifiers,
      statistics: {
        ...activeModel.statistics,
        totalNodes: newNodes.size,
        totalMembers: newMembers.size,
        totalBeams: Array.from(newMembers.values()).filter((m) => m.classification === 'BEAM').length,
        totalColumns: Array.from(newMembers.values()).filter((m) => m.classification === 'COLUMN').length,
      },
    };

    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }

    await runFemAnalysis();
  },

  updateLoadPatterns: async (patterns: LoadCase[]) => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return;

    const newMap = new Map<number, LoadCase>();
    patterns.forEach((p) => newMap.set(p.id, p));

    const updatedModel = { ...activeModel, loadCases: newMap };
    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
  },

  updateLoadCombinations: async (combos: LoadCombination[]) => {
    const { activeModel, activeProject } = get();
    if (!activeModel) return;

    const newMap = new Map<number, LoadCombination>();
    combos.forEach((c) => newMap.set(c.id, c));

    const updatedModel = { ...activeModel, loadCombinations: newMap };
    set({ activeModel: updatedModel });
    if (activeProject) {
      const updatedProj: StoredProject = {
        ...activeProject,
        model: ProjectStorage.serializeModel(updatedModel),
      };
      await ProjectStorage.saveProject(updatedProj);
      set({ activeProject: updatedProj });
    }
  },
}));
