import { create } from 'zustand';
import { StoredProject } from './types';
import { ProjectStorage } from './projectStorage';
import { ANLParser } from '../anl/anlParser';
import { NormalizedStructuralModel, Member3D, Node3D } from '../model/types';
import { ProjectMetadata, DesignParameters } from '@/types';
import { EngineeringWarning } from '../warnings/types';
import { ColumnDesignEngine } from '../design/column/columnDesignEngine';
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
  showDimensions: true,
  showRoomLabels: true,
  showStructuralUnderlay: true,
  showPreviousFloorUnderlay: false,
  previousFloorOpacity: 0.35,
};

let architecturalUndoStack: any[] = [];
let architecturalRedoStack: any[] = [];
const MAX_UNDO_STACK = 50;

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
      const parseResult = ANLParser.parse(content);
      const id = customMetadata?.id || `prj_${Date.now()}`;

      const metadata: ProjectMetadata = {
        id,
        name: customMetadata?.name || fileName.replace(/\.(anl|std)$/i, '') || 'Imported STAAD Model',
        code: customMetadata?.code || `STAAD-${Math.floor(1000 + Math.random() * 9000)}`,
        client: customMetadata?.client || 'Engineering Client',
        engineer: parseResult.engineer || customMetadata?.engineer || 'Lead Structural Engineer',
        location: customMetadata?.location || 'Sector 12, Phase II',
        date: parseResult.date || new Date().toISOString().split('T')[0],
        description: `Imported from ${fileName} with ${parseResult.model.nodes.size} nodes and ${parseResult.model.members.size} members.`,
        anlFileName: fileName,
        anlFileSize: content.length,
        staadVersion: parseResult.staadVersion,
        designSettings: { ...DEFAULT_DESIGN_SETTINGS, ...customMetadata?.designSettings },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const storedProject: StoredProject = {
        metadata,
        model: ProjectStorage.serializeModel(parseResult.model),
        warnings: parseResult.warnings,
        rawAnlContent: content,
      };

      await ProjectStorage.saveProject(storedProject);
      const updated = await ProjectStorage.getAllProjects();

      set({
        projects: updated,
        activeProject: storedProject,
        activeModel: parseResult.model,
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
}));
