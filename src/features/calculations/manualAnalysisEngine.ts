import { NormalizedStructuralModel, Member3D, MemberForceRecord } from '@/features/model/types';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';

export interface ManualReviewRow {
  memberId: number;
  memberType: 'COLUMN' | 'BEAM';
  section: string;
  length: number;
  effectiveSpan: number; // For segmented beams: full continuous span
  isSegmented: boolean;
  storeyLevel: string;
  elevationY: number;
  tributaryAreaM2: number; // m2 for column, or trib width m for beam
  floorsAbove: number;
  // STAAD ANL Results
  anlAxial: number;
  anlShear: number;
  anlMoment: number;
  anlGravityAxial: number;
  anlGravityMoment: number;
  governingLoadCase: number;
  gravityLoadCase: number;
  // Manual Hand Calculations
  manualAxial: number;   // P_u = Sum(A_trib * q_floor) + SelfWeight
  manualShear: number;   // V_u = w_u * L / 2
  manualMoment: number;  // M_u = w_u * L^2 / 10
  manualUDLKnM: number;  // w_u applied
  // Deviations (%)
  devAxial: number;
  devShear: number;
  devMoment: number;
  primaryDev: number; // For column: devAxial; for beam: devMoment
  status: 'MATCH' | 'CLOSE' | 'REVIEW';
  methodNote: string;
}

export interface ManualAnalysisSummary {
  totalColumns: number;
  totalBeams: number;
  totalMembers: number;
  matchedCount: number;
  closeCount: number;
  reviewCount: number;
  totalManualBaseGravityKn: number;
  totalAnlBaseReactionKn: number;
  baseEquilibriumDevPct: number;
  gravityLoadCaseName: string;
  rows: ManualReviewRow[];
}

export class ManualAnalysisEngine {
  /**
   * Fast, zero-RAM manual analysis check comparing STAAD ANL file results
   * against IS 456 / SP 16 tributary area and static equilibrium hand calculations.
   */
  public static computeReview(
    model: NormalizedStructuralModel | null,
    mode: 'GRAVITY_COMBO' | 'MAX_ENVELOPE' = 'GRAVITY_COMBO'
  ): ManualAnalysisSummary {
    if (!model || model.members.size === 0) {
      return {
        totalColumns: 0,
        totalBeams: 0,
        totalMembers: 0,
        matchedCount: 0,
        closeCount: 0,
        reviewCount: 0,
        totalManualBaseGravityKn: 0,
        totalAnlBaseReactionKn: 0,
        baseEquilibriumDevPct: 0,
        gravityLoadCaseName: 'None',
        rows: [],
      };
    }

    // 1. Identify Gravity Load Combination (e.g. 1.5 DL + 1.5 LL)
    let gravityLcId = 9; // Standard default in STAAD
    let gravityLcName = 'Load Comb 9 (1.5 DL + 1.5 LL)';

    if (model.loadCombinations && model.loadCombinations.size > 0) {
      for (const [id, comb] of model.loadCombinations) {
        const title = (comb.title || '').toLowerCase();
        if (
          (title.includes('dead') || title.includes('dl')) &&
          (title.includes('live') || title.includes('ll')) &&
          !title.includes('wind') &&
          !title.includes('seismic') &&
          !title.includes('eq')
        ) {
          gravityLcId = id;
          gravityLcName = comb.title || `Load Comb ${id}`;
          break;
        }
      }
    }

    // 2. Map ANL forces: separate tracking for Gravity case vs Max Envelope
    const anlGravityMap = new Map<number, { axial: number; shear: number; moment: number }>();
    const anlEnvelopeMap = new Map<number, { maxAxial: number; maxShear: number; maxMoment: number; maxLc: number }>();

    if (model.memberForces && model.memberForces.length > 0) {
      for (const f of model.memberForces) {
        const absAx = Math.abs(f.axial);
        const absV = Math.max(Math.abs(f.vy), Math.abs(f.vz));
        const absM = Math.max(Math.abs(f.mz), Math.abs(f.my));

        // Track gravity combo
        if (f.loadCaseId === gravityLcId) {
          const prevG = anlGravityMap.get(f.memberId);
          if (!prevG || absAx > prevG.axial || absM > prevG.moment) {
            anlGravityMap.set(f.memberId, { axial: absAx, shear: absV, moment: absM });
          }
        }

        // Track global envelope independently for axial, shear, and moment
        const prevE = anlEnvelopeMap.get(f.memberId);
        if (!prevE) {
          anlEnvelopeMap.set(f.memberId, { maxAxial: absAx, maxShear: absV, maxMoment: absM, maxLc: f.loadCaseId });
        } else {
          if (absAx > prevE.maxAxial) prevE.maxAxial = absAx;
          if (absV > prevE.maxShear) prevE.maxShear = absV;
          if (absM > prevE.maxMoment) {
            prevE.maxMoment = absM;
            prevE.maxLc = f.loadCaseId;
          }
        }
      }
    }

    // Fallback: if gravity case had no records, use envelope or design summaries
    if (anlGravityMap.size === 0 && anlEnvelopeMap.size > 0) {
      for (const [mid, env] of anlEnvelopeMap) {
        anlGravityMap.set(mid, { axial: env.maxAxial, shear: env.maxShear, moment: env.maxMoment });
      }
    }

    // Fallback 2: designSummaries
    if (model.designSummaries && model.designSummaries.size > 0) {
      for (const [mid, ds] of model.designSummaries) {
        if (!anlEnvelopeMap.has(mid)) {
          anlEnvelopeMap.set(mid, {
            maxAxial: ds.maxAxial || 0,
            maxShear: ds.maxShear || 0,
            maxMoment: ds.maxMoment || 0,
            maxLc: ds.governingLoadCase || 1,
          });
        }
        if (!anlGravityMap.has(mid)) {
          anlGravityMap.set(mid, {
            axial: ds.maxAxial || 0,
            shear: ds.maxShear || 0,
            moment: ds.maxMoment || 0,
          });
        }
      }
    }

    // 3. Extract TRUE building floor levels using FloorPlanEngine clustering
    const floorPlans = FloorPlanEngine.extractAllFloorPlans(model);
    const storeys: { levelName: string; elevationY: number }[] = [];

    if (floorPlans && floorPlans.length > 0) {
      floorPlans.forEach((fp) => {
        storeys.push({
          levelName: fp.levelName || `L${fp.levelIndex} (${fp.elevationY.toFixed(1)}m)`,
          elevationY: fp.elevationY,
        });
      });
    } else {
      // Robust fallback: cluster elevations with >= 2.2m spacing
      const candY = new Set<number>();
      for (const m of model.members.values()) {
        const n1 = model.nodes.get(m.startNodeId);
        const n2 = model.nodes.get(m.endNodeId);
        if (n1 && n2) {
          if (m.classification === 'COLUMN') {
            candY.add(Math.round(n1.y * 10) / 10);
            candY.add(Math.round(n2.y * 10) / 10);
          } else if (m.classification === 'BEAM' && Math.abs(n1.y - n2.y) < 0.2) {
            candY.add(Math.round(n1.y * 10) / 10);
          }
        }
      }
      const sortedY = Array.from(candY).sort((a, b) => a - b);
      for (const y of sortedY) {
        if (storeys.length === 0 || y - storeys[storeys.length - 1].elevationY >= 2.0) {
          storeys.push({
            levelName: `L${storeys.length + 1} (${y.toFixed(1)}m)`,
            elevationY: y,
          });
        }
      }
    }

    if (storeys.length === 0) {
      storeys.push({ levelName: 'Ground', elevationY: 0 });
    }

    const groundY = storeys[0].elevationY;
    const totalStoreyCount = storeys.length;

    // 4. Separate columns and beams
    const columns: Member3D[] = [];
    const beams: Member3D[] = [];

    for (const m of model.members.values()) {
      if (m.classification === 'COLUMN') columns.push(m);
      else beams.push(m);
    }

    // Grid coordinates in X and Z
    const colCoordsX = new Set<number>();
    const colCoordsZ = new Set<number>();
    for (const col of columns) {
      const n1 = model.nodes.get(col.startNodeId);
      if (n1) {
        colCoordsX.add(Math.round(n1.x * 10) / 10);
        colCoordsZ.add(Math.round(n1.z * 10) / 10);
      }
    }
    const sortedX = Array.from(colCoordsX).sort((a, b) => a - b);
    const sortedZ = Array.from(colCoordsZ).sort((a, b) => a - b);

    // Typical bay span
    let avgSpanX = 4.2;
    if (sortedX.length > 1) {
      let diffSum = 0;
      for (let i = 1; i < sortedX.length; i++) diffSum += sortedX[i] - sortedX[i - 1];
      avgSpanX = Math.max(2.5, Math.min(8.0, diffSum / (sortedX.length - 1)));
    }
    let avgSpanZ = 4.2;
    if (sortedZ.length > 1) {
      let diffSum = 0;
      for (let i = 1; i < sortedZ.length; i++) diffSum += sortedZ[i] - sortedZ[i - 1];
      avgSpanZ = Math.max(2.5, Math.min(8.0, diffSum / (sortedZ.length - 1)));
    }

    // Unit factored gravity load per floor per m² (IS 456 / IS 875):
    // DL (125mm slab + finishes + beams) ~ 5.5 kN/m² + LL (3.0 kN/m²) * 1.5 ~ 11.5 - 12.0 kN/m²
    const factoredFloorLoadKnM2 = 11.8;

    const rows: ManualReviewRow[] = [];
    let totalManualBaseGravityKn = 0;

    // ── A. PROCESS COLUMNS (Tributary Area Method) ──────────────────────────
    for (const col of columns) {
      const n1 = model.nodes.get(col.startNodeId);
      const n2 = model.nodes.get(col.endNodeId);
      if (!n1 || !n2) continue;

      const topY = Math.max(n1.y, n2.y);
      const btmY = Math.min(n1.y, n2.y);

      // Locate storey index in the real clustered storeys
      const storeyIdx = storeys.findIndex((s) => Math.abs(s.elevationY - topY) < 0.6);
      const storeyLabel = storeyIdx >= 0 ? storeys[storeyIdx].levelName : `${topY.toFixed(1)}m`;

      // Real floors above this column (NOT 80!)
      const floorsAbove = Math.max(1, storeys.filter((s) => s.elevationY >= topY - 0.2).length);

      // Tributary area from adjacent column grids
      const posX = Math.round(((n1.x + n2.x) / 2) * 10) / 10;
      const posZ = Math.round(((n1.z + n2.z) / 2) * 10) / 10;

      let distLeft = avgSpanX / 2;
      let distRight = avgSpanX / 2;
      let distFront = avgSpanZ / 2;
      let distBack = avgSpanZ / 2;

      const idxX = sortedX.indexOf(posX);
      if (idxX > 0) distLeft = Math.min(avgSpanX, (posX - sortedX[idxX - 1]) / 2);
      if (idxX >= 0 && idxX < sortedX.length - 1) distRight = Math.min(avgSpanX, (sortedX[idxX + 1] - posX) / 2);

      const idxZ = sortedZ.indexOf(posZ);
      if (idxZ > 0) distBack = Math.min(avgSpanZ, (posZ - sortedZ[idxZ - 1]) / 2);
      if (idxZ >= 0 && idxZ < sortedZ.length - 1) distFront = Math.min(avgSpanZ, (sortedZ[idxZ + 1] - posZ) / 2);

      const tribArea = Math.max(2.0, (distLeft + distRight) * (distFront + distBack));

      // Column self-weight
      const colB = col.section.zd || (col.section.type === 'CIRCULAR' ? col.section.yd || 0.4 : 0.4);
      const colD = col.section.yd || 0.4;
      const colHeight = Math.max(2.5, col.length);
      const colSelfWeightPerFloor = colB * colD * colHeight * 25 * 1.5; // ~15-25 kN per floor

      // Manual Axial Force P_u = (Floors × Area × FloorLoad) + (Floors × ColSW)
      const floorLoadTotal = floorsAbove * tribArea * factoredFloorLoadKnM2;
      const colSWTotal = floorsAbove * colSelfWeightPerFloor;
      const manualAxial = parseFloat((floorLoadTotal + colSWTotal).toFixed(1));

      // ANL values: use gravity combo if in GRAVITY_COMBO mode, else envelope
      const grav = anlGravityMap.get(col.id);
      const env = anlEnvelopeMap.get(col.id);

      const anlAxial = mode === 'GRAVITY_COMBO' ? (grav?.axial || env?.maxAxial || 0) : (env?.maxAxial || 0);
      const anlShear = mode === 'GRAVITY_COMBO' ? (grav?.shear || env?.maxShear || 0) : (env?.maxShear || 0);
      const anlMoment = mode === 'GRAVITY_COMBO' ? (grav?.moment || env?.maxMoment || 0) : (env?.maxMoment || 0);

      const refAx = Math.max(anlAxial, manualAxial, 0.001);
      const devAx = (Math.abs(anlAxial - manualAxial) / refAx) * 100;

      // Acceptance thresholds: <= 12% MATCH, <= 22% CLOSE
      const status: ManualReviewRow['status'] = devAx <= 12 ? 'MATCH' : devAx <= 22 ? 'CLOSE' : 'REVIEW';

      if (btmY <= groundY + 0.5) {
        totalManualBaseGravityKn += manualAxial;
      }

      rows.push({
        memberId: col.id,
        memberType: 'COLUMN',
        section: col.section.name || `${Math.round(colB * 1000)}x${Math.round(colD * 1000)} mm`,
        length: parseFloat(col.length.toFixed(2)),
        effectiveSpan: parseFloat(col.length.toFixed(2)),
        isSegmented: false,
        storeyLevel: storeyLabel,
        elevationY: parseFloat(topY.toFixed(2)),
        tributaryAreaM2: parseFloat(tribArea.toFixed(2)),
        floorsAbove,
        anlAxial: parseFloat(anlAxial.toFixed(1)),
        anlShear: parseFloat(anlShear.toFixed(1)),
        anlMoment: parseFloat(anlMoment.toFixed(1)),
        anlGravityAxial: parseFloat((grav?.axial || 0).toFixed(1)),
        anlGravityMoment: parseFloat((grav?.moment || 0).toFixed(1)),
        governingLoadCase: env?.maxLc || 1,
        gravityLoadCase: gravityLcId,
        manualAxial,
        manualShear: 0,
        manualMoment: 0,
        manualUDLKnM: factoredFloorLoadKnM2,
        devAxial: parseFloat(devAx.toFixed(1)),
        devShear: 0,
        devMoment: 0,
        primaryDev: parseFloat(devAx.toFixed(1)),
        status,
        methodNote: `P_u = ${floorsAbove} flrs × ${tribArea.toFixed(1)}m² × ${factoredFloorLoadKnM2}kN/m² + Col SW (${colSWTotal.toFixed(0)}kN)`,
      });
    }

    // ── B. PROCESS BEAMS (Yield-Line & Continuity Statics) ──────────────────
    for (const bm of beams) {
      const n1 = model.nodes.get(bm.startNodeId);
      const n2 = model.nodes.get(bm.endNodeId);
      if (!n1 || !n2) continue;

      const midY = (n1.y + n2.y) / 2;
      const storeyIdx = storeys.findIndex((s) => Math.abs(s.elevationY - midY) < 0.6);
      const storeyLabel = storeyIdx >= 0 ? storeys[storeyIdx].levelName : `${midY.toFixed(1)}m`;

      const rawSpan = Math.max(0.3, bm.length);

      // Detect if this is an internal segmented element (e.g. 0.5m - 1.5m stub)
      const isSegmented = rawSpan < 1.8;
      // If segmented, the continuous bay flexural span is typically the bay grid span
      const effectiveSpan = isSegmented ? Math.max(3.5, Math.min(avgSpanX, avgSpanZ)) : rawSpan;

      // Beam section
      const bmB = bm.section.zd || 0.3;
      const bmD = bm.section.yd || 0.45;
      const bmSelfWeight = bmB * bmD * 25 * 1.5; // ~5 kN/m

      // Tributary slab width supported by beam
      const tribWidth = Math.max(1.0, Math.min(3.5, (avgSpanX + avgSpanZ) / 4));

      // Factored slab load on beam (45° yield-line trapezoidal/triangular average)
      const slabLoadPerM = tribWidth * 11.5 * 0.55; // ~20-25 kN/m
      // Wall load (200mm brick wall, 3.0m storey)
      const wallLoadPerM = 0.2 * Math.max(1.2, 3.0 - bmD) * 19 * 1.5 * 0.6; // ~10-15 kN/m

      const totalUDL = bmSelfWeight + slabLoadPerM + wallLoadPerM; // ~25-35 kN/m
      const manualUDLKnM = parseFloat(totalUDL.toFixed(1));

      // Moment for continuous frame beam: M_u = w * L^2 / 10 (IS 456 Table 12)
      const manualMoment = parseFloat(((totalUDL * Math.pow(effectiveSpan, 2)) / 10).toFixed(1));
      // Shear: V_u = 0.6 * w * L
      const manualShear = parseFloat((0.6 * totalUDL * effectiveSpan).toFixed(1));

      // ANL values
      const grav = anlGravityMap.get(bm.id);
      const env = anlEnvelopeMap.get(bm.id);

      const anlAxial = mode === 'GRAVITY_COMBO' ? (grav?.axial || env?.maxAxial || 0) : (env?.maxAxial || 0);
      const anlShear = mode === 'GRAVITY_COMBO' ? (grav?.shear || env?.maxShear || 0) : (env?.maxShear || 0);
      const anlMoment = mode === 'GRAVITY_COMBO' ? (grav?.moment || env?.maxMoment || 0) : (env?.maxMoment || 0);

      const refM = Math.max(anlMoment, manualMoment, 0.001);
      const devM = (Math.abs(anlMoment - manualMoment) / refM) * 100;

      const refV = Math.max(anlShear, manualShear, 0.001);
      const devV = (Math.abs(anlShear - manualShear) / refV) * 100;

      const primaryDev = parseFloat(devM.toFixed(1));
      const status: ManualReviewRow['status'] = primaryDev <= 15 ? 'MATCH' : primaryDev <= 30 ? 'CLOSE' : 'REVIEW';

      rows.push({
        memberId: bm.id,
        memberType: 'BEAM',
        section: bm.section.name || `${Math.round(bmB * 1000)}x${Math.round(bmD * 1000)} mm`,
        length: parseFloat(rawSpan.toFixed(2)),
        effectiveSpan: parseFloat(effectiveSpan.toFixed(2)),
        isSegmented,
        storeyLevel: storeyLabel,
        elevationY: parseFloat(midY.toFixed(2)),
        tributaryAreaM2: parseFloat(tribWidth.toFixed(2)),
        floorsAbove: 1,
        anlAxial: parseFloat(anlAxial.toFixed(1)),
        anlShear: parseFloat(anlShear.toFixed(1)),
        anlMoment: parseFloat(anlMoment.toFixed(1)),
        anlGravityAxial: parseFloat((grav?.axial || 0).toFixed(1)),
        anlGravityMoment: parseFloat((grav?.moment || 0).toFixed(1)),
        governingLoadCase: env?.maxLc || 1,
        gravityLoadCase: gravityLcId,
        manualAxial: 0,
        manualShear,
        manualMoment,
        manualUDLKnM,
        devAxial: 0,
        devShear: parseFloat(devV.toFixed(1)),
        devMoment: primaryDev,
        primaryDev,
        status,
        methodNote: isSegmented
          ? `M_u = wL_eff²/10 (${manualUDLKnM}kN/m × ${effectiveSpan.toFixed(1)}m² / 10) [Mesh Segment: ${rawSpan}m]`
          : `M_u = wL²/10 (${manualUDLKnM}kN/m × ${rawSpan.toFixed(1)}m² / 10), V_u = 0.6wL`,
      });
    }

    // ── C. GLOBAL EQUILIBRIUM CHECK ──────────────────────────────────────────
    let totalAnlBaseReactionKn = 0;
    if (model.reactions && model.reactions.length > 0) {
      // Find reactions for the gravity case
      const gravReactions = model.reactions.filter((r) => r.loadCaseId === gravityLcId);
      const targetReactions = gravReactions.length > 0 ? gravReactions : model.reactions;

      for (const r of targetReactions) {
        totalAnlBaseReactionKn += Math.abs(r.fy);
      }
      if (gravReactions.length === 0) {
        const numLc = Math.max(1, new Set(model.reactions.map((r) => r.loadCaseId)).size);
        totalAnlBaseReactionKn = totalAnlBaseReactionKn / numLc;
      }
    }

    const refBase = Math.max(totalManualBaseGravityKn, totalAnlBaseReactionKn, 0.001);
    const baseEquilibriumDevPct = totalAnlBaseReactionKn > 0
      ? parseFloat(((Math.abs(totalManualBaseGravityKn - totalAnlBaseReactionKn) / refBase) * 100).toFixed(1))
      : 0;

    const matchedCount = rows.filter((r) => r.status === 'MATCH').length;
    const closeCount = rows.filter((r) => r.status === 'CLOSE').length;
    const reviewCount = rows.filter((r) => r.status === 'REVIEW').length;

    return {
      totalColumns: columns.length,
      totalBeams: beams.length,
      totalMembers: rows.length,
      matchedCount,
      closeCount,
      reviewCount,
      totalManualBaseGravityKn: parseFloat(totalManualBaseGravityKn.toFixed(0)),
      totalAnlBaseReactionKn: parseFloat(totalAnlBaseReactionKn.toFixed(0)),
      baseEquilibriumDevPct,
      gravityLoadCaseName: gravityLcName,
      rows,
    };
  }
}
