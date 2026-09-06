import {
  RCDCDocument,
  RCDCLevel,
} from './types';
import { buildRCDCMemberIds } from './rcdxKeys';
import {
  NormalizedStructuralModel,
  Node3D,
  Support3D,
  CrossSection,
  LoadCase,
  LoadCombination,
  MemberDesignSummary,
} from '@/features/model/types';
import { StructuralClassification, ElementDesignStatus } from '@/types';

const APP_LOAD_TYPE: Record<string, LoadCase['type']> = {
  DEAD: 'DEAD',
  LIVE: 'LIVE',
  SNOW: 'LIVE',
  EQ: 'SEISMIC',
  WIND: 'WIND',
  TEMP: 'TEMPERATURE',
  OTHER: 'OTHER',
};

function toLoadType(t: string): LoadCase['type'] {
  return APP_LOAD_TYPE[t] ?? 'OTHER';
}

function memberStatus(hasDesign: boolean, fail: boolean, hasForces: boolean): ElementDesignStatus {
  if (!hasDesign) return 'NOT_DESIGNED';
  if (fail) return 'FAIL';
  if (!hasForces) return 'WARNING';
  return 'PASS';
}

/**
 * Builds a NormalizedStructuralModel from an imported RCDC design document.
 * Member ids follow the convention in rcdxKeys.ts so saved designs and force
 * records stay consistent with the 3D viewer.
 */
export function rcdcToModel(doc: RCDCDocument): NormalizedStructuralModel {
  const ids = buildRCDCMemberIds(doc);
  const supportSet = new Set(doc.supports);

  const nodes = new Map<number, Node3D>();
  for (const n of doc.nodes) {
    nodes.set(n.nodeNo, {
      id: n.nodeNo,
      x: n.x,
      y: n.y,
      z: n.z,
      isSupport: supportSet.has(n.nodeNo),
    });
  }

  const supports = new Map<number, Support3D>();
  for (const n of doc.supports) {
    supports.set(n, {
      nodeId: n,
      type: 'FIXED',
      releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
    });
  }

  const sectionOf = (frameSectionId: number): CrossSection | undefined => {
    const sec = doc.sections.find((s) => s.frameSectionId === frameSectionId);
    if (!sec) return undefined;
    return { type: 'RECTANGULAR', yd: sec.depthMm / 1000, zd: sec.widthMm / 1000, name: sec.name };
  };

  const materials: Record<number, string> = {};
  for (const c of doc.concreteGrades) {
    materials[c.concreteGradeId] = c.name;
  }
  const materialOf = (concreteGradeId: number, fallback: string): string =>
    materials[concreteGradeId] || doc.concreteGrades[0]?.name || fallback;

  const members = new Map<number, import('@/features/model/types').Member3D>();
  const memberForces: import('@/features/model/types').MemberForceRecord[] = [];
  const designSummaries = new Map<number, MemberDesignSummary>();

  // ── Beams ──
  for (const beam of doc.beams) {
    const memberId = ids.beamId.get(beam.beamNo) ?? beam.beamNo;
    const start = nodes.get(beam.startNodeNo);
    const end = nodes.get(beam.endNodeNo);
    if (!start || !end) continue;
    const length = Math.sqrt(
      (end.x - start.x) ** 2 + (end.y - start.y) ** 2 + (end.z - start.z) ** 2
    );
    const section = sectionOf(beam.frameSectionId) ?? {
      type: 'RECTANGULAR' as const,
      yd: beam.depthMm / 1000,
      zd: beam.widthMm / 1000,
    };
    members.set(memberId, {
      id: memberId,
      startNodeId: beam.startNodeNo,
      endNodeId: beam.endNodeNo,
      length,
      classification: 'BEAM' as StructuralClassification,
      isAutoClassified: false,
      section,
      materialName: materialOf(beam.concreteGradeId, 'M25'),
      designStatus: memberStatus(beam.stations.length > 0, false, beam.envelope.maxShear !== 0),
    });

    // Station demand records from the RCDC auto-design run (per governing load comb).
    for (const st of beam.stations) {
      const loadCaseId = st.astTopLoadCombId || st.astBottomLoadCombId || st.shearLoadCombId || 0;
      memberForces.push({
        memberId,
        loadCaseId,
        sectionLocation: st.locationMm / 1000,
        axial: beam.envelope.maxAxial,
        vy: st.shear,
        vz: 0,
        torsion: st.torsion,
        my: 0,
        mz: Math.max(Math.abs(st.momentTop), Math.abs(st.momentBottom)),
      });
    }

    const fracStations = [0, 0.25, 0.5, 0.75, 1];
    const astTopSections = fracStations.map((f) => {
      const st = [...beam.stations]
        .map((s) => ({ s, d: Math.abs(s.locationMm / Math.max(1000, beam.clearSpanMm) - f) }))
        .sort((a, b) => a.d - b.d)[0];
      return st ? st.s.astTopProv : 0;
    });
    const astBottomSections = fracStations.map((f) => {
      const st = [...beam.stations]
        .map((s) => ({ s, d: Math.abs(s.locationMm / Math.max(1000, beam.clearSpanMm) - f) }))
        .sort((a, b) => a.d - b.d)[0];
      return st ? st.s.astBottomProv : 0;
    });

    const maxMoment = Math.max(
      Math.abs(beam.envelope.maxMomentMajor),
      ...beam.stations.map((s) => Math.max(Math.abs(s.momentTop), Math.abs(s.momentBottom)))
    );
    const maxTopReq = Math.max(0, ...beam.stations.map((s) => s.astTopReq));
    const maxBotReq = Math.max(0, ...beam.stations.map((s) => s.astBottomReq));
    const astTopSectionsReq = fracStations.map((f) => {
      const st = [...beam.stations]
        .map((s) => ({ s, d: Math.abs(s.locationMm / Math.max(1000, beam.clearSpanMm) - f) }))
        .sort((a, b) => a.d - b.d)[0];
      return st ? st.s.astTopReq : 0;
    });

    designSummaries.set(memberId, {
      memberId,
      classification: 'BEAM',
      sectionDimensions: `${beam.widthMm} x ${beam.depthMm} mm`,
      governingLoadCase: beam.envelope.governingLoadCombId ?? 0,
      maxAxial: beam.envelope.maxAxial,
      maxShear: beam.envelope.maxShear,
      maxMoment: round(maxMoment),
      astTopReq: round(maxTopReq),
      astBottomReq: round(maxBotReq),
      astTopSections: astTopSectionsReq,
      astBottomSections,
      status: memberStatus(beam.stations.length > 0, false, beam.envelope.maxShear !== 0),
      notes: ['Design output imported from RCDC .rcdx file'],
    });
  }

  // ── Columns ──
  for (const col of doc.columns) {
    const memberId = ids.columnId.get(col.columnNo) ?? col.columnNo;
    const start = nodes.get(col.startNodeNo);
    const end = nodes.get(col.endNodeNo);
    if (!start || !end) continue;
    const length = Math.abs(end.y - start.y) || col.unsupportedLengthMm / 1000;
    const section = sectionOf(col.frameSectionId) ?? {
      type: 'RECTANGULAR' as const,
      yd: (col.depthMm || 450) / 1000,
      zd: (col.widthMm || 300) / 1000,
    };
    const hasDesign = col.mainBars.length > 0;
    members.set(memberId, {
      id: memberId,
      startNodeId: col.startNodeNo,
      endNodeId: col.endNodeNo,
      length,
      classification: 'COLUMN' as StructuralClassification,
      isAutoClassified: false,
      section,
      materialName: materialOf(col.concreteGradeId, 'M25'),
      designStatus: memberStatus(hasDesign, col.designFail, col.envelope.maxAxial !== 0),
    });

    const locs = [0, 0.5, 1];
    for (const f of locs) {
      memberForces.push({
        memberId,
        loadCaseId: 0,
        sectionLocation: length * f,
        axial: col.envelope.maxAxial,
        vy: col.envelope.maxShear,
        vz: 0,
        torsion: col.envelope.maxTorsion,
        my: col.envelope.maxMomentMinor,
        mz: col.envelope.maxMomentMajor,
      });
    }

    designSummaries.set(memberId, {
      memberId,
      classification: 'COLUMN',
      sectionDimensions: `${col.widthMm} x ${col.depthMm} mm`,
      governingLoadCase: 0,
      maxAxial: col.envelope.maxAxial,
      maxShear: col.envelope.maxShear,
      maxMoment: round(Math.max(col.envelope.maxMomentMajor, col.envelope.maxMomentMinor)),
      status: memberStatus(hasDesign, col.designFail, col.envelope.maxAxial !== 0),
      notes: col.interactionRatio
        ? [`Interaction Ratio: ${col.interactionRatio.toFixed(2)}`]
        : ['Design output imported from RCDC .rcdx file'],
    });
  }

  // ── Slabs → plates ──
  const plates = new Map<number, import('@/features/model/types').Plate3D>();
  for (const slab of doc.slabs) {
    const nodeIds = slab.nodeNos.filter((n) => nodes.has(n));
    if (nodeIds.length >= 3) {
      plates.set(slab.panelNo, {
        id: slab.panelNo,
        nodeIds,
        thickness: slab.thicknessMm / 1000,
        materialName: slab.concreteName || 'M25',
        classification: 'SLAB',
      });
    }
  }

  const loadCases = new Map<number, LoadCase>();
  for (const lc of doc.loadCases) {
    loadCases.set(lc.loadId, {
      id: lc.loadId,
      title: lc.name,
      type: toLoadType(lc.type),
      isCombination: false,
    });
  }

  const loadCombinations = new Map<number, LoadCombination>();
  for (const c of doc.loadCombinations) {
    loadCombinations.set(c.combId, {
      id: c.combId,
      title: c.name,
      factors: c.factors
        .filter((f) => loadCases.has(f.loadCaseId))
        .map((f) => ({ loadCaseId: f.loadCaseId, factor: f.factor })),
    });
  }

  // Simple grid lines from unique node coordinates (bounded).
  const Xs = Array.from(new Set(doc.nodes.map((n) => n.x))).sort((a, b) => a - b);
  const Zs = Array.from(new Set(doc.nodes.map((n) => n.z))).sort((a, b) => a - b);
  const customGrids =
    Xs.length <= 50 && Zs.length <= 50 ? { x: Xs, z: Zs } : undefined;

  // Bounding box + statistics
  const allX = doc.nodes.map((n) => n.x);
  const allY = doc.nodes.map((n) => n.y);
  const allZ = doc.nodes.map((n) => n.z);
  const minX = allX.length ? Math.min(...allX) : 0;
  const maxX = allX.length ? Math.max(...allX) : 0;
  const minY = allY.length ? Math.min(...allY) : 0;
  const maxY = allY.length ? Math.max(...allY) : 0;
  const minZ = allZ.length ? Math.min(...allZ) : 0;
  const maxZ = allZ.length ? Math.max(...allZ) : 0;

  let totalBeams = 0;
  let totalColumns = 0;
  for (const m of members.values()) {
    if (m.classification === 'BEAM') totalBeams++;
    else if (m.classification === 'COLUMN') totalColumns++;
  }

  const model: NormalizedStructuralModel = {
    nodes,
    members,
    plates,
    supports,
    loadCases,
    loadCombinations,
    reactions: [],
    memberForces,
    designSummaries,
    storyDrifts: [],
    customGrids,
    boundingBox: { minX, maxX, minY, maxY, minZ, maxZ },
    statistics: {
      totalNodes: nodes.size,
      totalMembers: members.size,
      totalBeams,
      totalColumns,
      totalPlates: plates.size,
      totalSupports: supports.size,
      totalLoadCases: loadCases.size,
      totalCombinations: loadCombinations.size,
      maxElevation: maxY,
      baseElevation: minY,
    },
  };
  return model;
}

function round(v: number, dp = 2): number {
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}