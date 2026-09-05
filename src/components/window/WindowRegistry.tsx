import React from 'react';
import { Window, WindowContentProps } from './Window';
import { WindowInstance, useWindowStore } from './WindowStore';
import { ProjectWindow } from './windows/ProjectWindow';
import { StoryDataWindow } from './windows/StoryDataWindow';
import { GridSystemWindow } from './windows/GridSystemWindow';
import { MaterialPropertyWindow } from './windows/MaterialPropertyWindow';
import { FrameSectionWindow } from './windows/FrameSectionWindow';
import { SlabSectionWindow } from './windows/SlabSectionWindow';
import { WallSectionWindow } from './windows/WallSectionWindow';
import { FoundationPropertyWindow } from './windows/FoundationPropertyWindow';
import { AssignSectionWindow } from './windows/AssignSectionWindow';
import { AssignMaterialWindow } from './windows/AssignMaterialWindow';
import { AssignSupportWindow } from './windows/AssignSupportWindow';
import { AssignLoadWindow } from './windows/AssignLoadWindow';
import { AssignLocalAxisWindow } from './windows/AssignLocalAxisWindow';
import { LoadPatternWindow } from './windows/LoadPatternWindow';
import { LoadCombinationWindow } from './windows/LoadCombinationWindow';
import { SeismicLoadWindow } from './windows/SeismicLoadWindow';
import { RunAnalysisWindow } from './windows/RunAnalysisWindow';
import { AnalysisOutputWindow } from './windows/AnalysisOutputWindow';
import { MemberForcesWindow } from './windows/MemberForcesWindow';
import { JointReactionsWindow } from './windows/JointReactionsWindow';
import { StoryDriftWindow } from './windows/StoryDriftWindow';
import { JointDisplacementWindow } from './windows/JointDisplacementWindow';
import { DesignSummaryWindow } from './windows/DesignSummaryWindow';
import { PileTypeWindow } from './windows/PileTypeWindow';
import { QuantityTakeoffWindow } from './windows/QuantityTakeoffWindow';
import { BbsWindow } from './windows/BbsWindow';
import { ReportsWindow } from './windows/ReportsWindow';
import { AuditWindow } from './windows/AuditWindow';
import { UserSettingsWindow } from './windows/UserSettingsWindow';

/**
 * Centralized engineering window registry.
 *
 * Every dedicated engineering operation in the application should be
 * registered here as { id, title, category, size, content }.
 *
 * Content components receive { instance, close, setDirty } props and are
 * expected to read from / write to the central project store.
 */
export interface WindowDefinition {
  id: string;
  title: string;
  category: string;
  size: { width: number; height: number };
  content: React.FC<WindowContentProps>;
  /** Prevent content from opening more than once at a time. */
  singleton?: boolean;
}

export const WINDOW_REGISTRY: WindowDefinition[] = [
  // ── MODEL / DEFINE ────────────────────────────────────────────────
  { id: 'project', title: 'Project Information', category: 'Model', size: { width: 520, height: 560 }, singleton: true, content: ProjectWindow },
  { id: 'storyData', title: 'Story Data', category: 'Define', size: { width: 520, height: 460 }, singleton: true, content: StoryDataWindow },
  { id: 'gridSystem', title: 'Grid System', category: 'Define', size: { width: 480, height: 440 }, singleton: true, content: GridSystemWindow },
  { id: 'materialProperties', title: 'Material Property', category: 'Define', size: { width: 420, height: 540 }, singleton: true, content: MaterialPropertyWindow },
  { id: 'frameSection', title: 'Frame Section Property', category: 'Define', size: { width: 620, height: 640 }, singleton: true, content: FrameSectionWindow },
  { id: 'slabSection', title: 'Slab Section Property', category: 'Define', size: { width: 460, height: 420 }, singleton: true, content: SlabSectionWindow },
  { id: 'wallSection', title: 'Wall Section Property', category: 'Define', size: { width: 460, height: 420 }, singleton: true, content: WallSectionWindow },
  { id: 'foundationProperty', title: 'Foundation Property', category: 'Define', size: { width: 620, height: 560 }, singleton: true, content: FoundationPropertyWindow },

  // ── ASSIGN ────────────────────────────────────────────────────────
  { id: 'assignSection', title: 'Assign Section', category: 'Assign', size: { width: 520, height: 620 }, singleton: true, content: AssignSectionWindow },
  { id: 'assignMaterial', title: 'Assign Material', category: 'Assign', size: { width: 460, height: 420 }, singleton: true, content: AssignMaterialWindow },
  { id: 'assignSupport', title: 'Assign Support / Restraint', category: 'Assign', size: { width: 460, height: 460 }, singleton: true, content: AssignSupportWindow },
  { id: 'assignLoad', title: 'Assign Member Load', category: 'Assign', size: { width: 520, height: 640 }, singleton: true, content: AssignLoadWindow },
  { id: 'assignLocalAxis', title: 'Assign Local Axis', category: 'Assign', size: { width: 460, height: 460 }, singleton: true, content: AssignLocalAxisWindow },

  // ── LOADS / ANALYZE ───────────────────────────────────────────────
  { id: 'loadPattern', title: 'Load Patterns', category: 'Loads', size: { width: 540, height: 520 }, singleton: true, content: LoadPatternWindow },
  { id: 'loadCombination', title: 'Load Combinations', category: 'Loads', size: { width: 560, height: 620 }, singleton: true, content: LoadCombinationWindow },
  { id: 'seismicLoad', title: 'Seismic Load (IS 1893:2016)', category: 'Loads', size: { width: 480, height: 520 }, singleton: true, content: SeismicLoadWindow },

  // ── ANALYZE / RESULTS ────────────────────────────────────────────
  { id: 'runAnalysis', title: 'Run Analysis', category: 'Analyze', size: { width: 460, height: 440 }, singleton: true, content: RunAnalysisWindow },
  { id: 'analysisOutput', title: 'Analysis Output', category: 'Results', size: { width: 720, height: 580 }, singleton: true, content: AnalysisOutputWindow },
  { id: 'memberForces', title: 'Member Forces', category: 'Results', size: { width: 640, height: 520 }, singleton: true, content: MemberForcesWindow },
  { id: 'jointReactions', title: 'Joint Reactions', category: 'Results', size: { width: 560, height: 480 }, singleton: true, content: JointReactionsWindow },
  { id: 'storyDrift', title: 'Story Drift', category: 'Results', size: { width: 580, height: 460 }, singleton: true, content: StoryDriftWindow },
  { id: 'jointDisplacement', title: 'Joint Displacements', category: 'Results', size: { width: 620, height: 500 }, singleton: true, content: JointDisplacementWindow },

  // ── DESIGN ───────────────────────────────────────────────────────
  { id: 'designSummary', title: 'Concrete Design Summary', category: 'Design', size: { width: 680, height: 520 }, singleton: true, content: DesignSummaryWindow },

  // ── FOUNDATION ───────────────────────────────────────────────────
  { id: 'pileType', title: 'Pile Types (IS 2911:2010)', category: 'Foundation', size: { width: 520, height: 640 }, singleton: true, content: PileTypeWindow },

  // ── AUDIT / OUTPUT ──────────────────────────────────────────────
  { id: 'audit', title: 'Design Audit', category: 'Audit', size: { width: 520, height: 520 }, singleton: true, content: AuditWindow },
  { id: 'quantityTakeoff', title: 'Quantity Takeoff', category: 'Output', size: { width: 560, height: 580 }, singleton: true, content: QuantityTakeoffWindow },
  { id: 'bbs', title: 'Bar Bending Schedule', category: 'Output', size: { width: 680, height: 560 }, singleton: true, content: BbsWindow },
  { id: 'reports', title: 'Reports / Calculation Book', category: 'Output', size: { width: 460, height: 480 }, singleton: true, content: ReportsWindow },

  // ── USER / ACCOUNT ───────────────────────────────────────────────
  { id: 'userSettings', title: 'User Account & Profile Settings', category: 'User', size: { width: 680, height: 620 }, singleton: true, content: UserSettingsWindow },
];

export const findWindowDef = (id: string): WindowDefinition | undefined =>
  WINDOW_REGISTRY.find((d) => d.id === id);

export const WindowSlot: React.FC<{ instance: WindowInstance }> = ({ instance }) => {
  const def = findWindowDef(instance.windowId);
  if (!def) return null;

  const content = React.createElement(def.content, {
    instance,
    close: () => useWindowStore.getState().closeWindow(instance.instanceId),
    setDirty: (dirty: boolean) =>
      useWindowStore.getState().setWindowDirty(instance.instanceId, dirty),
  } as WindowContentProps);

  return (
    <Window
      instance={instance}
      title={def.title}
      categoryLabel={def.category}
      content={content}
    />
  );
};

/** Imperative helper used by menu/canvas callers to open a registered window. */
export const openRegisteredWindow = (
  id: string,
  props?: Record<string, unknown>,
  options?: { modal?: boolean; size?: { width: number; height: number } }
): string => {
  const def = findWindowDef(id);
  const store = useWindowStore.getState();
  if (def?.singleton) {
    const existing = store.windows.find((w) => w.windowId === id && !w.minimized);
    if (existing) {
      store.focusWindow(existing.instanceId);
      return existing.instanceId;
    }
  }
  return store.openWindow(id, props, {
    ...(options || {}),
    size: options?.size ?? def?.size,
  });
};