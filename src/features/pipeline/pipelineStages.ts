/**
 * Building Design Pipeline — the guided end-to-end workflow of StructureAI Designer.
 *
 * Order of stages matches the engineering workflow:
 *   1. Plot / Site      — define where the building will be placed
 *   2. Architectural    — rough architectural plan (walls, rooms, circulation)
 *   3. Model & Analysis — place columns/beams/slabs, run FEM, view results in 3D
 *   4. Design           — design every member (beam, column, slab, foundation...)
 *   5. Detailing        — walls at each floor, windows, doors, finishes
 *   6. Outputs          — GA plans, CAD drawing sheets, BBS, reports & BOQ
 */
import type { ViewTab } from '@/features/projects/projectStore';

export interface PipelineStage {
  id: string;
  index: number; // 1-based
  title: string;
  shortTitle: string;
  description: string;
  primaryView: ViewTab;
  /** Views that belong to this stage (primary + secondary) */
  views: ViewTab[];
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'plot',
    index: 1,
    title: 'Plot & Site',
    shortTitle: 'Plot',
    description: 'Define the land plot, setbacks and building footprint placement.',
    primaryView: 'plot-area',
    views: ['plot-area'],
  },
  {
    id: 'architectural',
    index: 2,
    title: 'Architectural Plan',
    shortTitle: 'Architectural',
    description: 'Rough architectural drawing — walls, rooms, doors and windows.',
    primaryView: 'architectural-plan',
    views: ['architectural-plan'],
  },
  {
    id: 'model-analysis',
    index: 3,
    title: 'Model & Analysis',
    shortTitle: 'Model / Analysis',
    description: 'Place columns, beams and slabs; run 3D FEM analysis; inspect results.',
    primaryView: 'etabs-studio',
    views: ['etabs-studio', '3d-model', 'member-forces', 'joint-reactions', 'load-cases', 'elements', 'warnings'],
  },
  {
    id: 'design',
    index: 4,
    title: 'Design',
    shortTitle: 'Design',
    description: 'Design every structural member — beams, columns, slabs, foundations.',
    primaryView: 'columns-design',
    views: [
      'beams-design',
      'columns-design',
      'slabs-design',
      'staircase-design',
      'shearwalls-design',
      'gradebeams-design',
      'footings-design',
      'piles-design',
      'pilecaps-design',
      'rcdc-design',
    ],
  },
  {
    id: 'detailing',
    index: 5,
    title: 'Detailing',
    shortTitle: 'Detailing',
    description: 'Floor-by-floor detailing — walls, windows, doors and openings.',
    primaryView: 'architectural-plan',
    views: ['architectural-plan'],
  },
  {
    id: 'outputs',
    index: 6,
    title: 'Outputs',
    shortTitle: 'Outputs',
    description: 'GA plans, CAD drawing sheets, Bar Bending Schedule, reports & BOQ.',
    primaryView: 'drawings',
    views: ['floor-plans', 'drawings', 'reports'],
  },
];

const VIEW_TO_STAGE = new Map<string, PipelineStage>();
for (const stage of PIPELINE_STAGES) {
  for (const v of stage.views) {
    // First (earliest) owning stage wins — a view shared by two stages (e.g.
    // architectural-plan in Architectural and Detailing) resolves to the earlier one.
    if (!VIEW_TO_STAGE.has(v)) {
      VIEW_TO_STAGE.set(v, stage);
    }
  }
}

export function getStageForView(view: ViewTab): PipelineStage | null {
  return VIEW_TO_STAGE.get(view) || null;
}

export function getStageById(stageId: string): PipelineStage | null {
  return PIPELINE_STAGES.find((s) => s.id === stageId) || null;
}

export function getNextStage(current: PipelineStage): PipelineStage | null {
  return PIPELINE_STAGES.find((s) => s.index === current.index + 1) || null;
}

export function getPreviousStage(current: PipelineStage): PipelineStage | null {
  return PIPELINE_STAGES.find((s) => s.index === current.index - 1) || null;
}

/** Views that exist in the app but are not part of the guided pipeline (dashboard, settings) */
export const NON_PIPELINE_VIEWS: ViewTab[] = ['dashboard', 'settings'];