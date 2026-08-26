import { create } from 'zustand';
import { StoredProject } from './types';
import { ProjectStorage } from './projectStorage';
import { ANLParser } from '../anl/anlParser';
import { NormalizedStructuralModel, Member3D, Node3D } from '../model/types';
import { ProjectMetadata, DesignParameters } from '@/types';
import { EngineeringWarning } from '../warnings/types';
import { ColumnDesignEngine } from '../design/column/columnDesignEngine';

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
  | 'floor-plans'
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

  // Component Design Persistence Actions
  saveColumnDesigns: (designs: Map<number, any> | Record<number, any>, overrides?: Map<number, any> | Record<number, any>) => Promise<void>;
  saveBeamDesigns: (designs: Map<number, any> | Record<number, any>, overrides?: Map<number, any> | Record<number, any>) => Promise<void>;
  saveShearWallDesigns: (designs: Map<number, any> | Record<number, any>, overrides?: Record<number, any>) => Promise<void>;
  saveGradeBeamDesigns: (designs: any[]) => Promise<void>;
  saveFootingDesigns: (designs: Map<number, any> | Record<number, any>) => Promise<void>;
  savePileCapDesigns: (designedCaps?: Map<number, any> | Record<number, any>, combinedCaps?: any[]) => Promise<void>;
  savePileDesigns: (types: any[]) => Promise<void>;
  saveSlabDesigns: (designs: Map<string, any> | Record<string, any>, overrides?: Record<string, any>) => Promise<void>;
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
    };

    await ProjectStorage.saveProject(storedProject);
    const updated = await ProjectStorage.getAllProjects();
    set({ projects: updated, activeProject: storedProject, activeModel: emptyModel });
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
}));
