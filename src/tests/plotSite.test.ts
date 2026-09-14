import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_PLOT_SITE,
  validatePlotSite,
  computePlotMetrics,
  getBuildingFootprintCorners,
  fitPlotSiteToModel,
  isModelInsidePlotSite,
  PlotSite,
} from '@/features/plot/plotTypes';
import { PIPELINE_STAGES, getStageForView, getNextStage, getPreviousStage } from '@/features/pipeline/pipelineStages';
import { useProjectStore } from '@/features/projects/projectStore';

// In-memory ProjectStorage mock so plot persistence can be verified without IndexedDB
const { memoryDb } = vi.hoisted(() => ({ memoryDb: new Map<string, any>() }));
vi.mock('@/features/projects/projectStorage', () => ({
  ProjectStorage: {
    saveProject: vi.fn(async (project: any) => {
      memoryDb.set(project.metadata.id, JSON.parse(JSON.stringify(project)));
    }),
    getProject: vi.fn(async (id: string) => memoryDb.get(id)),
    getAllProjects: vi.fn(async () => Array.from(memoryDb.values())),
    deleteProject: vi.fn(async (id: string) => {
      memoryDb.delete(id);
    }),
    setCloudUser: vi.fn(),
    syncToCloud: vi.fn().mockResolvedValue(0),
    syncFromCloud: vi.fn().mockResolvedValue(0),
    serializeModel: (model: any) => ({
      nodes: model?.nodes ? Array.from(model.nodes.entries()) : [],
      members: model?.members ? Array.from(model.members.entries()) : [],
      plates: model?.plates ? Array.from(model.plates.entries()) : [],
      supports: model?.supports ? Array.from(model.supports.entries()) : [],
      loadCases: model?.loadCases ? Array.from(model.loadCases.entries()) : [],
      loadCombinations: model?.loadCombinations ? Array.from(model.loadCombinations.entries()) : [],
      memberLoads: model?.memberLoads ? Array.from(model.memberLoads.entries()) : undefined,
      shellLoads: model?.shellLoads,
      memberModifiers: model?.memberModifiers ? Array.from(model.memberModifiers.entries()) : undefined,
      reactions: model?.reactions || [],
      memberForces: model?.memberForces || [],
      designSummaries: model?.designSummaries ? Array.from(model.designSummaries.entries()) : undefined,
      storyDrifts: model?.storyDrifts || [],
      boundingBox: model?.boundingBox,
      statistics: model?.statistics,
    }),
    deserializeModel: (s: any) => ({
      nodes: new Map(s.nodes),
      members: new Map(s.members),
      plates: new Map(s.plates),
      supports: new Map(s.supports),
      loadCases: new Map(s.loadCases),
      loadCombinations: new Map(s.loadCombinations),
      memberLoads: s.memberLoads ? new Map(s.memberLoads) : new Map(),
      shellLoads: s.shellLoads || [],
      memberModifiers: s.memberModifiers ? new Map(s.memberModifiers) : new Map(),
      reactions: s.reactions,
      memberForces: s.memberForces,
      designSummaries: s.designSummaries ? new Map(s.designSummaries) : new Map(),
      storyDrifts: s.storyDrifts,
      boundingBox: s.boundingBox,
      statistics: s.statistics,
    }),
  },
}));

describe('Plot / Site Stage', () => {
  describe('validatePlotSite', () => {
    it('accepts a valid default plot', () => {
      const result = validatePlotSite(DEFAULT_PLOT_SITE);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects zero/negative plot dimensions', () => {
      const bad = { ...DEFAULT_PLOT_SITE, plotLength: 0, plotWidth: -5 };
      const result = validatePlotSite(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('greater than zero');
    });

    it('rejects setbacks that consume the whole plot', () => {
      const bad = { ...DEFAULT_PLOT_SITE, frontSetback: 10, rearSetback: 10 };
      const result = validatePlotSite(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('exceed the plot length');
    });

    it('rejects a building footprint larger than the buildable envelope', () => {
      const bad = { ...DEFAULT_PLOT_SITE, buildingLength: 20 };
      const result = validatePlotSite(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('exceeds available envelope');
    });

    it('rejects a footprint offset that pushes the building out of the plot', () => {
      const bad = { ...DEFAULT_PLOT_SITE, buildingOffsetX: 30 };
      const result = validatePlotSite(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('outside the plot');
    });

    it('rejects negative setbacks', () => {
      const bad = { ...DEFAULT_PLOT_SITE, leftSetback: -1 };
      const result = validatePlotSite(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('cannot be negative');
    });
  });

  describe('computePlotMetrics', () => {
    it('computes plot, buildable and footprint areas correctly', () => {
      const m = computePlotMetrics(DEFAULT_PLOT_SITE);
      expect(m.plotArea).toBeCloseTo(18 * 12, 6);
      expect(m.buildingFootprintArea).toBeCloseTo(12 * 8, 6);
      expect(m.buildableArea).toBeCloseTo((18 - 3 - 2) * (12 - 1.5 - 1.5), 6);
      expect(m.groundCoverageRatio).toBeCloseTo((12 * 8) / (18 * 12), 6);
      expect(m.buildingSetbackX).toBe(DEFAULT_PLOT_SITE.buildingOffsetX);
      expect(m.buildingSetbackZ).toBe(DEFAULT_PLOT_SITE.buildingOffsetZ);
    });
  });

  describe('getBuildingFootprintCorners', () => {
    it('returns 4 corners around the footprint origin', () => {
      const corners = getBuildingFootprintCorners(DEFAULT_PLOT_SITE);
      expect(corners).toHaveLength(4);
      // Axis-aligned footprint: min/max match offsets and offsets+size
      const xs = corners.map((c) => c.x);
      const zs = corners.map((c) => c.z);
      expect(Math.min(...xs)).toBeCloseTo(DEFAULT_PLOT_SITE.buildingOffsetX, 6);
      expect(Math.max(...xs)).toBeCloseTo(DEFAULT_PLOT_SITE.buildingOffsetX + DEFAULT_PLOT_SITE.buildingLength, 6);
      expect(Math.min(...zs)).toBeCloseTo(DEFAULT_PLOT_SITE.buildingOffsetZ, 6);
      expect(Math.max(...zs)).toBeCloseTo(DEFAULT_PLOT_SITE.buildingOffsetZ + DEFAULT_PLOT_SITE.buildingWidth, 6);
    });

    it('rotates the footprint by 90 degrees', () => {
      const rotated: PlotSite = { ...DEFAULT_PLOT_SITE, buildingRotation: 90 };
      const corners = getBuildingFootprintCorners(rotated);
      const xs = corners.map((c) => c.x);
      const zs = corners.map((c) => c.z);
      // After 90° rotation the extents swap: width becomes X extent
      const cx = rotated.buildingOffsetX + rotated.buildingLength / 2;
      const cz = rotated.buildingOffsetZ + rotated.buildingWidth / 2;
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(rotated.buildingWidth, 6);
      expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(rotated.buildingLength, 6);
      expect(Math.min(...xs)).toBeCloseTo(cx - rotated.buildingWidth / 2, 6);
      expect(Math.min(...zs)).toBeCloseTo(cz - rotated.buildingLength / 2, 6);
    });
  });
});

describe('Plot Store Persistence', () => {
  beforeEach(async () => {
    memoryDb.clear();
    // Reset store to a clean state
    useProjectStore.setState({
      plotSite: DEFAULT_PLOT_SITE,
      pipelineStageId: null,
      activeProject: null,
      activeModel: null,
      projects: [],
    });
  });

  it('exposes a default plot when no project is loaded', () => {
    expect(useProjectStore.getState().plotSite).toEqual(DEFAULT_PLOT_SITE);
  });

  it('setPlotSite updates the store state', async () => {
    const custom: PlotSite = {
      ...DEFAULT_PLOT_SITE,
      plotLength: 24,
      plotWidth: 15,
      frontSetback: 4,
      buildingRotation: 90,
    };
    await useProjectStore.getState().setPlotSite(custom);
    expect(useProjectStore.getState().plotSite).toEqual(custom);
  });

  it('setPlotSite persists to the active project (mock storage)', async () => {
    const { createProject, setPlotSite } = useProjectStore.getState();
    const proj = await createProject({ name: 'Plot Test Project' });
    expect(proj).toBeTruthy();
    expect(useProjectStore.getState().activeProject?.plotSite).toEqual(DEFAULT_PLOT_SITE);

    const custom: PlotSite = { ...DEFAULT_PLOT_SITE, plotLength: 30, plotWidth: 20 };
    await setPlotSite(custom);
    expect(useProjectStore.getState().plotSite).toEqual(custom);

    // Verify the active project carries the plot and it round-trips through storage
    const stored = (await useProjectStore.getState().activeProject!.plotSite) as PlotSite;
    expect(stored).toEqual(custom);
    expect(memoryDb.get(proj.metadata.id).plotSite).toEqual(custom);
  });

  it('new projects default to the standard plot config', async () => {
    const proj = await useProjectStore.getState().createProject({ name: 'Default Plot' });
    expect(proj.plotSite).toEqual(DEFAULT_PLOT_SITE);
    expect(useProjectStore.getState().activeProject?.plotSite).toEqual(DEFAULT_PLOT_SITE);
  });
});

describe('Building Design Pipeline Stages', () => {
  it('has exactly 6 ordered stages', () => {
    expect(PIPELINE_STAGES).toHaveLength(6);
    expect(PIPELINE_STAGES.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(PIPELINE_STAGES[0].id).toBe('plot');
    expect(PIPELINE_STAGES[5].id).toBe('outputs');
  });

  it('maps every stage view to its owning stage', () => {
    for (const stage of PIPELINE_STAGES) {
      for (const v of stage.views) {
        const owner = getStageForView(v);
        // Views may be shared across stages (architectural-plan is used by both
        // Architectural and Detailing); first/earliest owner wins the mapping.
        expect(stage.views.includes(v)).toBe(true);
        expect(owner).not.toBeNull();
        if (owner && v !== 'architectural-plan') {
          expect(owner.id).toBe(stage.id);
        }
      }
    }
    // Shared view resolves to the earliest owning stage (Architectural, stage 2)
    expect(getStageForView('architectural-plan')?.id).toBe('architectural');
  });

  it('walks forward and backward through stages', () => {
    const first = PIPELINE_STAGES[0];
    const second = getNextStage(first);
    expect(second?.id).toBe('architectural');
    expect(getPreviousStage(second!)?.id).toBe('plot');
    expect(getNextStage(PIPELINE_STAGES[5])).toBeNull();
    expect(getPreviousStage(PIPELINE_STAGES[0])).toBeNull();
  });

  it('covers all stage views with only the intended architectural-plan duplication', () => {
    const allViews = PIPELINE_STAGES.flatMap((s) => s.views);
    const counts = new Map<string, number>();
    for (const v of allViews) counts.set(v, (counts.get(v) || 0) + 1);
    for (const [v, c] of counts) {
      if (v === 'architectural-plan') {
        // Architectural (stage 2) + Detailing (stage 5) intentionally share it
        expect(c).toBe(2);
      } else {
        expect(c).toBe(1);
      }
    }
  });

  it('exposes primary views that exist as app tabs', () => {
    for (const stage of PIPELINE_STAGES) {
      expect(typeof stage.primaryView).toBe('string');
      expect(stage.primaryView.length).toBeGreaterThan(0);
    }
  });
});

describe('Plot & 3D Model Alignment Utilities', () => {
  const staad6MilesBounds = {
    minX: -1.25,
    maxX: 14.75,
    minY: 0,
    maxY: 16.0,
    minZ: -18.1,
    maxZ: 1.25,
  };

  it('fitPlotSiteToModel auto-fits site plan around model bounding box with negative coordinates', () => {
    const fitted = fitPlotSiteToModel(staad6MilesBounds, {
      front: 3.0,
      rear: 2.0,
      left: 1.5,
      right: 1.5,
    });

    expect(fitted.plotOriginX).toBeCloseTo(-1.25 - 3.0, 2); // -4.25
    expect(fitted.plotOriginZ).toBeCloseTo(-18.1 - 1.5, 2); // -19.6
    expect(fitted.buildingLength).toBeCloseTo(16.0, 2);
    expect(fitted.buildingWidth).toBeCloseTo(19.35, 2);
    expect(fitted.plotLength).toBeCloseTo(16.0 + 3.0 + 2.0, 2); // 21.0
    expect(fitted.plotWidth).toBeCloseTo(19.35 + 1.5 + 1.5, 2); // 22.35
    expect(fitted.buildingOffsetX).toBe(3.0);
    expect(fitted.buildingOffsetZ).toBe(1.5);
    expect(fitted.groundElevation).toBe(0);

    const validation = validatePlotSite(fitted);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    const check = isModelInsidePlotSite(staad6MilesBounds, fitted);
    expect(check.isInside).toBe(true);
    expect(check.outsideReasons).toHaveLength(0);
  });

  it('isModelInsidePlotSite detects when a model is outside plot bounds', () => {
    const defaultPlot = DEFAULT_PLOT_SITE; // X: [0, 18], Z: [0, 12]
    const check = isModelInsidePlotSite(staad6MilesBounds, defaultPlot);
    expect(check.isInside).toBe(false);
    expect(check.outsideReasons.length).toBeGreaterThan(0);
  });

  it('fitSitePlanToModel updates active project plotSite to encompass the model', async () => {
    const mockModel: any = {
      nodes: new Map([[1, { id: 1, x: -2, y: 0, z: -5 }]]),
      members: new Map(),
      plates: new Map(),
      supports: new Map(),
      boundingBox: { minX: -2, maxX: 10, minY: 0, maxY: 6, minZ: -5, maxZ: 5 },
      statistics: { baseElevation: 0, maxElevation: 6 },
    };

    useProjectStore.setState({
      activeModel: mockModel,
      plotSite: DEFAULT_PLOT_SITE,
    });

    await useProjectStore.getState().fitSitePlanToModel();

    const updatedPlot = useProjectStore.getState().plotSite!;
    expect(updatedPlot.plotOriginX).toBeCloseTo(-5.0, 2);
    expect(updatedPlot.plotOriginZ).toBeCloseTo(-6.5, 2);
    expect(updatedPlot.buildingLength).toBeCloseTo(12, 2);
    expect(updatedPlot.buildingWidth).toBeCloseTo(10, 2);
    expect(isModelInsidePlotSite(mockModel.boundingBox, updatedPlot).isInside).toBe(true);
  });

  it('moveModelToSitePlan shifts building nodes into the site footprint coordinates', async () => {
    const customPlot: PlotSite = {
      ...DEFAULT_PLOT_SITE,
      plotOriginX: 10,
      plotOriginZ: 10,
      buildingOffsetX: 3,
      buildingOffsetZ: 2,
      groundElevation: 1.5,
    };

    const mockModel: any = {
      nodes: new Map([
        [1, { id: 1, x: 0, y: 0, z: 0 }],
        [2, { id: 2, x: 10, y: 3, z: 5 }],
      ]),
      members: new Map(),
      plates: new Map(),
      supports: new Map(),
      boundingBox: { minX: 0, maxX: 10, minY: 0, maxY: 3, minZ: 0, maxZ: 5 },
      statistics: { baseElevation: 0, maxElevation: 3 },
    };

    useProjectStore.setState({
      activeModel: mockModel,
      plotSite: customPlot,
      architecturalWalls: {
        'W-1': {
          id: 'W-1',
          start: { x: 0, y: 0 },
          end: { x: 10, y: 0 },
          baseElevation: 0,
          topElevation: 3.2,
        } as any,
      },
    });

    await useProjectStore.getState().moveModelToSitePlan();

    const shiftedModel = useProjectStore.getState().activeModel!;
    // Target minX = 10 + 3 = 13, minZ = 10 + 2 = 12, minY = 1.5
    expect(shiftedModel.boundingBox.minX).toBeCloseTo(13, 2);
    expect(shiftedModel.boundingBox.minZ).toBeCloseTo(12, 2);
    expect(shiftedModel.boundingBox.minY).toBeCloseTo(1.5, 2);

    const node1 = shiftedModel.nodes.get(1)!;
    expect(node1.x).toBeCloseTo(13, 2);
    expect(node1.y).toBeCloseTo(1.5, 2);
    expect(node1.z).toBeCloseTo(12, 2);

    // Architectural wall also shifted
    const wall1 = useProjectStore.getState().architecturalWalls['W-1']!;
    expect(wall1.start.x).toBeCloseTo(13, 2);
    expect(wall1.start.y).toBeCloseTo(12, 2);
    expect(wall1.baseElevation).toBeCloseTo(1.5, 2);
    expect(wall1.topElevation).toBeCloseTo(3.2 + 1.5, 2);
  });
});