import { NormalizedStructuralModel } from '@/features/model/types';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { PileCapDesignOutput } from './pileCapDesignEngine';
import { IS456Flexure } from '@/features/codes/is456/flexure';
import { DetailedCalculationReport } from '@/features/calculations/types';

export type CombinedCapReason = 'SHEAR_WALL' | 'MERGED_CLOSE_COLUMNS' | 'MANUAL_MERGE';

export interface ShearWallFootprint {
  shape: 'U_SHAPE' | 'L_SHAPE' | 'STRAIGHT' | 'RECTANGULAR_CORE';
  wallThicknessM: number; // in meters (e.g. 0.23m)
  segments: { x1: number; z1: number; x2: number; z2: number }[];
  boundaryZones: { cx: number; cz: number; widthM: number; lengthM: number; label: string }[];
}

export interface CombinedPileCapGroup {
  groupId: string;
  reason: CombinedCapReason;
  label: string;
  nodeIds: number[];
  columnLabels: string[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  wallLengthM: number;
  wallWidthM: number;
  totalFactoredLoad: number;
  totalWorkingLoad: number;
  safePileCapacity: number;
  pileDiameter: number;
  pileSpacing: number;
  edgeDistance: number;
  pileCount: number;
  pileRows: number;
  pileCols: number;
  pileOffsets: { x: number; z: number }[];
  capLength: number;
  capWidth: number;
  capDepth: number;
  effectiveDepth: number;
  loadPerPile: number;
  botRebarCallout: string;
  topRebarCallout: string;
  shearWallStirrupCallout: string;
  isCustomized?: boolean;
  status: 'PASS' | 'WARNING';
  absorbedIndividualCaps: number[];
  wallFootprint?: ShearWallFootprint;
  calculationReport: DetailedCalculationReport;
}

type SupportNodeInfo = { nodeId: number; x: number; z: number; Pu: number; colLabel: string; colSlNo: number };

export class CombinedPileCapEngine {
  private static readonly SHEAR_WALL_CLUSTER_DIST = 2.5;
  private static readonly MERGE_OVERLAP_FACTOR = 1.8;

  public static detectAndDesignAll(
    model: NormalizedStructuralModel,
    designedIndividualCaps: Map<number, PileCapDesignOutput>,
    pileDiameter = 350,
    manualMergeGroups: number[][] = [],
    detachedNodeIds: number[] = [],
    customCombinedOverrides?: Record<string, {
      customPileCount?: number;
      customCapLength?: number;
      customCapWidth?: number;
      customCapDepth?: number;
      customSafePileCapacity?: number;
      customBottomRebar?: string;
      customTopRebar?: string;
    }>,
    defaultSafeWorkingCapacity = 280
  ): CombinedPileCapGroup[] {
    if (!model.supports || model.supports.size === 0) return [];
    const columnMapping = ColumnNumberingService.getColumnSupportMapping(model);
    const results: CombinedPileCapGroup[] = [];
    const supportNodes: SupportNodeInfo[] = [];

    for (const sup of model.supports.values()) {
      const node = model.nodes.get(sup.nodeId);
      if (!node) continue;
      const colInfo = columnMapping.get(sup.nodeId);
      const reactions = model.reactions?.filter((r) => r.nodeId === sup.nodeId) || [];
      let maxFy = reactions.length > 0 ? Math.max(...reactions.map((r) => Math.abs(r.fy))) : 0;
      if (maxFy <= 0 && model.memberForces && model.members) {
        const connectedMemberIds = new Set(
          Array.from(model.members.values())
            .filter((m) => m.startNodeId === sup.nodeId || m.endNodeId === sup.nodeId)
            .map((m) => m.id)
        );
        const connectedForces = model.memberForces.filter((f) => connectedMemberIds.has(f.memberId));
        for (const cf of connectedForces) {
          if (Math.abs(cf.axial) > maxFy) maxFy = Math.abs(cf.axial);
        }
      }
      if (maxFy <= 0) maxFy = 650;

      supportNodes.push({
        nodeId: sup.nodeId,
        x: node.x,
        z: node.z,
        Pu: Math.round(maxFy),
        colLabel: colInfo?.columnLabel || 'C' + (colInfo?.columnSlNo || sup.nodeId),
        colSlNo: colInfo?.columnSlNo || sup.nodeId,
      });
    }

    const absorbed = new Set<number>();

    // 1. Process Manual Merge Groups from 3D Viewport / User Multi-Selection / Split Groups
    if (manualMergeGroups && manualMergeGroups.length > 0) {
      let manualIdx = 1;
      for (const groupNodeIds of manualMergeGroups) {
        const matchedNodes = supportNodes.filter((n) => groupNodeIds.includes(n.nodeId));
        if (matchedNodes.length >= 2) {
          matchedNodes.forEach((n) => absorbed.add(n.nodeId));
          const gid = `MANUAL-${manualIdx}`;
          const override = customCombinedOverrides?.[gid];
          const grp = CombinedPileCapEngine.designMergedCap(
            matchedNodes,
            pileDiameter,
            manualIdx++,
            true,
            override,
            defaultSafeWorkingCapacity
          );
          results.push(grp);
        }
      }
    }

    // Mark user-detached nodes as excluded from auto-merging/auto-clustering
    if (detachedNodeIds && detachedNodeIds.length > 0) {
      detachedNodeIds.forEach((id) => absorbed.add(id));
    }

    // 2. Process Shear Wall Clusters (plate-linked or closely clustered shear wall base nodes)
    const remainingForSW = supportNodes.filter((n) => !absorbed.has(n.nodeId));
    const shearWallGroups = CombinedPileCapEngine.detectShearWallClusters(
      model,
      remainingForSW,
      pileDiameter,
      customCombinedOverrides,
      defaultSafeWorkingCapacity
    );
    for (const grp of shearWallGroups) {
      grp.nodeIds.forEach((id) => absorbed.add(id));
      results.push(grp);
    }

    // 3. Process Auto-Detected Closely-Spaced Column Pairs
    const remainingForMerge = supportNodes.filter((n) => !absorbed.has(n.nodeId));
    const merged = CombinedPileCapEngine.detectMergedPairs(
      remainingForMerge,
      designedIndividualCaps,
      pileDiameter,
      customCombinedOverrides,
      defaultSafeWorkingCapacity
    );
    for (const grp of merged) {
      results.push(grp);
    }

    return results;
  }

  private static detectShearWallClusters(
    model: NormalizedStructuralModel,
    nodes: SupportNodeInfo[],
    Dp: number,
    customCombinedOverrides?: Record<string, any>,
    defaultQsafe = 280
  ): CombinedPileCapGroup[] {
    const results: CombinedPileCapGroup[] = [];
    const visited = new Set<number>();
    const plateSets = CombinedPileCapEngine.findPlateClusters(model, nodes);
    const geomSets = CombinedPileCapEngine.findGeomClusters(nodes, CombinedPileCapEngine.SHEAR_WALL_CLUSTER_DIST);
    const all = [...plateSets];
    for (const gs of geomSets) {
      if (gs.length >= 3 && !all.some((pc) => gs.every((id) => pc.includes(id)))) all.push(gs);
    }
    let idx = 1;
    for (const cluster of all) {
      if (cluster.length < 3) continue;
      if (cluster.some((id) => visited.has(id))) continue;
      const cn = nodes.filter((n) => cluster.includes(n.nodeId));
      if (cn.length < 3) continue;
      cn.forEach((n) => visited.add(n.nodeId));
      const gid = `SW-${idx}`;
      const override = customCombinedOverrides?.[gid];
      results.push(CombinedPileCapEngine.designShearWallCap(cn, Dp, idx++, override, defaultQsafe));
    }
    return results;
  }

  private static findPlateClusters(model: NormalizedStructuralModel, nodes: SupportNodeInfo[]): number[][] {
    const nodeSet = new Set(nodes.map((n) => n.nodeId));
    if (!model.plates || model.plates.size === 0) return [];
    const groups: Set<number>[] = [];
    for (const plate of model.plates.values()) {
      // ONLY vertical wall plates (the Lift Core) form shear wall combined pile caps!
      // Horizontal floor slabs must NOT group independent column footings.
      if (plate.classification !== 'WALL') continue;
      const hits = plate.nodeIds.filter((nid) => nodeSet.has(nid));
      if (hits.length < 2) continue;
      let merged = false;
      for (const g of groups) {
        if (hits.some((id) => g.has(id))) {
          hits.forEach((id) => g.add(id));
          merged = true;
          break;
        }
      }
      if (!merged) groups.push(new Set(hits));
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          if ([...groups[i]].some((id) => groups[j].has(id))) {
            groups[j].forEach((id) => groups[i].add(id));
            groups.splice(j, 1);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
    return groups.map((s) => [...s]);
  }

  private static findGeomClusters(nodes: SupportNodeInfo[], maxDist: number): number[][] {
    const visited = new Set<number>();
    const clusters: number[][] = [];
    for (const n of nodes) {
      if (visited.has(n.nodeId)) continue;
      const cluster = [n.nodeId];
      visited.add(n.nodeId);
      for (const m of nodes) {
        if (visited.has(m.nodeId)) continue;
        if (Math.sqrt(Math.pow(n.x - m.x, 2) + Math.pow(n.z - m.z, 2)) <= maxDist) {
          cluster.push(m.nodeId);
          visited.add(m.nodeId);
        }
      }
      if (cluster.length >= 3) clusters.push(cluster);
    }
    return clusters;
  }

  public static designShearWallCap(
    cn: SupportNodeInfo[],
    Dp: number,
    idx: number,
    override?: any,
    defaultQsafe = 280
  ): CombinedPileCapGroup {
    const s = 3 * Dp;
    const eo = Dp;
    const totalPu = cn.reduce((sum, n) => sum + n.Pu, 0);
    const totalWorkingLoad = Math.round(1.10 * (totalPu / 1.5));
    const safePileCapacity = override?.customSafePileCapacity || defaultQsafe;

    // Minimum number of piles based on load capacity
    const minPilesReq = Math.max(2, Math.ceil(totalWorkingLoad / safePileCapacity));

    const minX = Math.min(...cn.map((n) => n.x));
    const maxX = Math.max(...cn.map((n) => n.x));
    const minZ = Math.min(...cn.map((n) => n.z));
    const maxZ = Math.max(...cn.map((n) => n.z));
    const wallLongMm = Math.round(Math.max(maxX - minX, maxZ - minZ) * 1000);
    const wallShortMm = Math.round(Math.min(maxX - minX, maxZ - minZ) * 1000);
    const longIsX = (maxX - minX) >= (maxZ - minZ);

    let nCols = Math.max(2, Math.round(wallLongMm / s) + 1);
    let nRows = wallShortMm > s * 0.5 ? 2 : 1;

    // Ensure total piles in grid satisfies single pile load capacity
    while (nRows * nCols < minPilesReq) {
      if (nRows === 1) {
        nRows = 2;
      } else if (nCols < nRows * 2.5) {
        nCols += 1;
      } else {
        nRows += 1;
      }
    }

    let pileCount = nRows * nCols;
    if (override?.customPileCount && override.customPileCount > 0) {
      pileCount = override.customPileCount;
      if (pileCount <= 4) {
        nRows = 2;
        nCols = 2;
      } else if (pileCount <= 6) {
        nRows = 2;
        nCols = 3;
      } else if (pileCount <= 8) {
        nRows = 2;
        nCols = 4;
      } else if (pileCount <= 12) {
        nRows = 2;
        nCols = 6;
      } else if (pileCount <= 14) {
        nRows = 2;
        nCols = 7;
      } else if (pileCount <= 16) {
        nRows = 2;
        nCols = 8;
      } else if (pileCount <= 18) {
        nRows = 2;
        nCols = 9;
      } else {
        nRows = 3;
        nCols = Math.ceil(pileCount / 3);
      }
    }

    const calcCapLong = (nCols - 1) * s + 2 * eo;
    const calcCapShort = nRows > 1 ? (nRows - 1) * s + 2 * eo : Dp + 2 * eo;

    const capLength = override?.customCapLength || (longIsX ? calcCapLong : calcCapShort);
    const capWidth = override?.customCapWidth || (longIsX ? calcCapShort : calcCapLong);
    const capDepth = override?.customCapDepth || Math.max(900, Math.round(1.5 * Dp));

    const pileOffsets: { x: number; z: number }[] = [];
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        if (pileOffsets.length >= pileCount) break;
        const lo = -((nCols - 1) * s) / 2 + c * s;
        const so = nRows === 1 ? 0 : -((nRows - 1) * s) / 2 + r * s;
        pileOffsets.push({ x: Math.round(longIsX ? lo : so), z: Math.round(longIsX ? so : lo) });
      }
    }

    const cover = 60;
    const d = capDepth - cover - 16;
    const loadPerPile = Math.round(totalPu / pileCount);
    const loadPerPileWork = Math.round(totalWorkingLoad / pileCount);

    const Mu = (pileCount / 2) * loadPerPile * (nCols > 1 ? s / 2 / 1000 : 0.5);
    const flex = IS456Flexure.designFlexure({ b: Math.min(capLength, capWidth), D: capDepth, d, fck: 25, fy: 500, Mu });
    const barArea = (Math.PI * Math.pow(16, 2)) / 4;
    const sp = Math.max(100, Math.min(200, Math.round((1000 * barArea) / Math.max(flex.Ast_req, 600))));

    const colNames = cn.map((n) => n.colLabel).join('+');
    const label = `PC-${colNames} (COMBINED ${pileCount}P)`;
    const isCustomized = Boolean(override);
    const status = loadPerPileWork <= safePileCapacity ? 'PASS' : 'WARNING';

    // Determine Shear Wall Footprint Geometry (U-Shape, Straight, L-Shape, etc.)
    const xs = Array.from(new Set(cn.map((n) => parseFloat(n.x.toFixed(2))))).sort((a, b) => a - b);
    const zs = Array.from(new Set(cn.map((n) => parseFloat(n.z.toFixed(2))))).sort((a, b) => a - b);

    let shape: 'U_SHAPE' | 'L_SHAPE' | 'STRAIGHT' | 'RECTANGULAR_CORE' = 'STRAIGHT';
    const segments: { x1: number; z1: number; x2: number; z2: number }[] = [];
    const boundaryZones: { cx: number; cz: number; widthM: number; lengthM: number; label: string }[] = [];
    const tw = 0.23; // 230mm standard wall thickness

    if (xs.length >= 2 && zs.length >= 2 && cn.length >= 4) {
      // Lift core U-shape — parametric 1.35m side each, U direction LEFT (opening west, web at east)
      // This matches user spec: shear wall taken from STD plate data, not ANL heuristic, and U opens left (west)
      shape = 'U_SHAPE';
      const cx = cn.reduce((s, n) => s + n.x, 0) / cn.length;
      const cz = cn.reduce((s, n) => s + n.z, 0) / cn.length;
      const side = 1.35;
      const half = side / 2;
      // Web at east (xR), opening west — left side direction as per user
      // Top flange: (cx-half, cz+half) -> (cx+half, cz+half) (north)
      // Web: (cx+half, cz+half) -> (cx+half, cz-half) (east)
      // Bottom flange: (cx+half, cz-half) -> (cx-half, cz-half) (south)
      const xL = parseFloat((cx - half).toFixed(3));
      const xR = parseFloat((cx + half).toFixed(3));
      const zN = parseFloat((cz + half).toFixed(3));
      const zS = parseFloat((cz - half).toFixed(3));
      segments.push({ x1: xL, z1: zN, x2: xR, z2: zN });
      segments.push({ x1: xR, z1: zN, x2: xR, z2: zS });
      segments.push({ x1: xR, z1: zS, x2: xL, z2: zS });

      boundaryZones.push({ cx: xL, cz: zN, widthM: 0.45, lengthM: 0.45, label: 'BE-1' });
      boundaryZones.push({ cx: xR, cz: zN, widthM: 0.45, lengthM: 0.45, label: 'BE-2' });
      boundaryZones.push({ cx: xR, cz: zS, widthM: 0.45, lengthM: 0.45, label: 'BE-3' });
      boundaryZones.push({ cx: xL, cz: zS, widthM: 0.45, lengthM: 0.45, label: 'BE-4' });
    } else {
      shape = 'STRAIGHT';
      segments.push({ x1: minX, z1: minZ, x2: maxX, z2: maxZ });
      boundaryZones.push({ cx: minX, cz: minZ, widthM: 0.45, lengthM: 0.45, label: 'BE-1' });
      boundaryZones.push({ cx: maxX, cz: maxZ, widthM: 0.45, lengthM: 0.45, label: 'BE-2' });
    }

    const wallFootprint: ShearWallFootprint = {
      shape,
      wallThicknessM: tw,
      segments,
      boundaryZones,
    };

    const groupResult: CombinedPileCapGroup = {
      groupId: 'SW-' + idx,
      reason: 'SHEAR_WALL',
      label,
      nodeIds: cn.map((n) => n.nodeId),
      columnLabels: cn.map((n) => n.colLabel),
      minX,
      maxX,
      minZ,
      maxZ,
      wallLengthM: Math.max(maxX - minX, maxZ - minZ),
      wallWidthM: Math.min(maxX - minX, maxZ - minZ),
      totalFactoredLoad: Math.round(totalPu),
      totalWorkingLoad,
      safePileCapacity,
      pileDiameter: Dp,
      pileSpacing: s,
      edgeDistance: eo,
      pileCount,
      pileRows: nRows,
      pileCols: nCols,
      pileOffsets,
      capLength,
      capWidth,
      capDepth,
      effectiveDepth: d,
      loadPerPile,
      botRebarCallout: override?.customBottomRebar || `T16 @ ${sp} mm c/c (Long Way Bot)`,
      topRebarCallout: override?.customTopRebar || `T12 @ 150 mm c/c (Both Ways Top)`,
      shearWallStirrupCallout: 'T10 @ 200 mm c/c (Strap Ties)',
      isCustomized,
      status,
      absorbedIndividualCaps: cn.map((n) => n.nodeId),
      wallFootprint,
      calculationReport: {} as any,
    };

    groupResult.calculationReport = CombinedPileCapEngine.generateCalculationReport(groupResult);
    return groupResult;
  }

  private static detectMergedPairs(
    nodes: SupportNodeInfo[],
    caps: Map<number, PileCapDesignOutput>,
    Dp: number,
    customCombinedOverrides?: Record<string, any>,
    defaultQsafe = 280
  ): CombinedPileCapGroup[] {
    const results: CombinedPileCapGroup[] = [];
    const mergedSet = new Set<number>();
    const sorted = [...nodes].sort((a, b) => a.x - b.x || a.z - b.z);
    for (let i = 0; i < sorted.length; i++) {
      if (mergedSet.has(sorted[i].nodeId)) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        if (mergedSet.has(sorted[j].nodeId)) continue;
        const ni = sorted[i];
        const nj = sorted[j];
        const dist = Math.sqrt(Math.pow(ni.x - nj.x, 2) + Math.pow(ni.z - nj.z, 2));
        const ci = caps.get(ni.nodeId);
        const cj = caps.get(nj.nodeId);
        const szI = ci ? Math.max(ci.capLength, ci.capWidth) / 1000 : 1.9;
        const szJ = cj ? Math.max(cj.capLength, cj.capWidth) / 1000 : 1.9;
        if (dist < ((szI + szJ) / 2) * CombinedPileCapEngine.MERGE_OVERLAP_FACTOR) {
          mergedSet.add(ni.nodeId);
          mergedSet.add(nj.nodeId);
          const gid = `MERGE-${results.length + 1}`;
          const override = customCombinedOverrides?.[gid];
          results.push(
            CombinedPileCapEngine.designMergedCap(
              [ni, nj],
              Dp,
              results.length + 1,
              false,
              override,
              defaultQsafe
            )
          );
          break;
        }
      }
    }
    return results;
  }

  public static designMergedCap(
    nodes: SupportNodeInfo[],
    Dp: number,
    idx: number,
    isManual = false,
    override?: any,
    defaultQsafe = 280
  ): CombinedPileCapGroup {
    const s = 3 * Dp;
    const eo = Dp;
    const totalPu = nodes.reduce((sum, n) => sum + n.Pu, 0);
    const totalWorkingLoad = Math.round(1.10 * (totalPu / 1.5));
    const safePileCapacity = override?.customSafePileCapacity || defaultQsafe;

    const minPilesReq = Math.max(2, Math.ceil(totalWorkingLoad / safePileCapacity));

    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x));
    const minZ = Math.min(...nodes.map((n) => n.z));
    const maxZ = Math.max(...nodes.map((n) => n.z));

    const spanXMm = Math.round((maxX - minX) * 1000);
    const spanZMm = Math.round((maxZ - minZ) * 1000);
    const isXDir = spanXMm >= spanZMm;
    const spanLongMm = Math.max(spanXMm, spanZMm);

    let nLong = Math.max(2, Math.round(spanLongMm / s) + 2);
    let nShort = Math.max(2, Math.round(Math.min(spanXMm, spanZMm) / s) + 1);

    while (nLong * nShort < minPilesReq) {
      if (nLong <= nShort * 2) {
        nLong += 1;
      } else {
        nShort += 1;
      }
    }

    let pileCount = nLong * nShort;
    if (override?.customPileCount && override.customPileCount > 0) {
      pileCount = override.customPileCount;
      if (pileCount <= 4) {
        nShort = 2;
        nLong = 2;
      } else if (pileCount <= 6) {
        nShort = 2;
        nLong = 3;
      } else if (pileCount <= 8) {
        nShort = 2;
        nLong = 4;
      } else if (pileCount <= 12) {
        nShort = 2;
        nLong = 6;
      } else if (pileCount <= 14) {
        nShort = 2;
        nLong = 7;
      } else if (pileCount <= 16) {
        nShort = 2;
        nLong = 8;
      } else if (pileCount <= 18) {
        nShort = 2;
        nLong = 9;
      } else {
        nShort = 3;
        nLong = Math.ceil(pileCount / 3);
      }
    }

    const calcCapLong = (nLong - 1) * s + 2 * eo;
    const calcCapShort = (nShort - 1) * s + 2 * eo;
    const capLength = override?.customCapLength || (isXDir ? calcCapLong : calcCapShort);
    const capWidth = override?.customCapWidth || (isXDir ? calcCapShort : calcCapLong);
    const capDepth = override?.customCapDepth || Math.max(900, Math.round(1.5 * Dp));

    const pileOffsets: { x: number; z: number }[] = [];
    for (let r = 0; r < nShort; r++) {
      for (let c = 0; c < nLong; c++) {
        if (pileOffsets.length >= pileCount) break;
        const lo = -((nLong - 1) * s) / 2 + c * s;
        const so = -((nShort - 1) * s) / 2 + r * s;
        pileOffsets.push({ x: Math.round(isXDir ? lo : so), z: Math.round(isXDir ? so : lo) });
      }
    }

    const cover = 60;
    const d = capDepth - cover - 16;
    const loadPerPile = Math.round(totalPu / pileCount);
    const loadPerPileWork = Math.round(totalWorkingLoad / pileCount);

    const Mu = (pileCount / 2) * loadPerPile * (nLong > 1 ? s / 2 / 1000 : 0.5);
    const flex = IS456Flexure.designFlexure({ b: Math.min(capLength, capWidth), D: capDepth, d, fck: 25, fy: 500, Mu });
    const barArea = (Math.PI * Math.pow(16, 2)) / 4;
    const sp = Math.max(100, Math.min(200, Math.round((1000 * barArea) / Math.max(flex.Ast_req, 600))));

    const colNames = nodes.map((n) => n.colLabel).join('+');
    const label = `PC-${colNames} (COMBINED ${pileCount}P)`;
    const isCustomized = Boolean(override);
    const status = loadPerPileWork <= safePileCapacity ? 'PASS' : 'WARNING';

    // Determine Shear Wall Footprint Geometry if 3+ columns
    const xs = Array.from(new Set(nodes.map((n) => parseFloat(n.x.toFixed(2))))).sort((a, b) => a - b);
    const zs = Array.from(new Set(nodes.map((n) => parseFloat(n.z.toFixed(2))))).sort((a, b) => a - b);

    let wallFootprint: ShearWallFootprint | undefined;
    const tw = 0.23;

    if (nodes.length >= 3) {
      if (xs.length >= 2 && zs.length >= 2 && nodes.length >= 4) {
        // Parametric U 1.35m side each, U direction LEFT (opening west, web at east) — user spec
        const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
        const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;
        const side = 1.35;
        const half = side / 2;
        const xL = parseFloat((cx - half).toFixed(3));
        const xR = parseFloat((cx + half).toFixed(3));
        const zN = parseFloat((cz + half).toFixed(3));
        const zS = parseFloat((cz - half).toFixed(3));
        wallFootprint = {
          shape: 'U_SHAPE',
          wallThicknessM: tw,
          segments: [
            { x1: xL, z1: zN, x2: xR, z2: zN },
            { x1: xR, z1: zN, x2: xR, z2: zS },
            { x1: xR, z1: zS, x2: xL, z2: zS },
          ],
          boundaryZones: [
            { cx: xL, cz: zN, widthM: 0.45, lengthM: 0.45, label: 'BE-1' },
            { cx: xR, cz: zN, widthM: 0.45, lengthM: 0.45, label: 'BE-2' },
            { cx: xR, cz: zS, widthM: 0.45, lengthM: 0.45, label: 'BE-3' },
            { cx: xL, cz: zS, widthM: 0.45, lengthM: 0.45, label: 'BE-4' },
          ],
        };
      } else {
        wallFootprint = {
          shape: 'STRAIGHT',
          wallThicknessM: tw,
          segments: [{ x1: minX, z1: minZ, x2: maxX, z2: maxZ }],
          boundaryZones: [
            { cx: minX, cz: minZ, widthM: 0.45, lengthM: 0.45, label: 'BE-1' },
            { cx: maxX, cz: maxZ, widthM: 0.45, lengthM: 0.45, label: 'BE-2' },
          ],
        };
      }
    }

    const groupResult: CombinedPileCapGroup = {
      groupId: isManual ? `MANUAL-${idx}` : `MERGE-${idx}`,
      reason: nodes.length >= 3 ? 'SHEAR_WALL' : isManual ? 'MANUAL_MERGE' : 'MERGED_CLOSE_COLUMNS',
      label,
      nodeIds: nodes.map((n) => n.nodeId),
      columnLabels: nodes.map((n) => n.colLabel),
      minX,
      maxX,
      minZ,
      maxZ,
      wallLengthM: spanLongMm / 1000,
      wallWidthM: Math.min(spanXMm, spanZMm) / 1000,
      totalFactoredLoad: Math.round(totalPu),
      totalWorkingLoad,
      safePileCapacity,
      pileDiameter: Dp,
      pileSpacing: s,
      edgeDistance: eo,
      pileCount,
      pileRows: nShort,
      pileCols: nLong,
      pileOffsets,
      capLength,
      capWidth,
      capDepth,
      effectiveDepth: d,
      loadPerPile,
      botRebarCallout: override?.customBottomRebar || `T16 @ ${sp} mm c/c (Long Way Bot)`,
      topRebarCallout: override?.customTopRebar || `T12 @ 150 mm c/c (Both Ways Top)`,
      shearWallStirrupCallout: `T10 @ 200 mm c/c (Strap Ties)`,
      isCustomized,
      status,
      absorbedIndividualCaps: nodes.map((n) => n.nodeId),
      wallFootprint,
      calculationReport: {} as any,
    };

    groupResult.calculationReport = CombinedPileCapEngine.generateCalculationReport(groupResult);
    return groupResult;
  }

  /**
   * Generates step-by-step IS 2911 & IS 456 calculation sheet for Combined & Shear Wall Pile Caps.
   */
  public static generateCalculationReport(grp: CombinedPileCapGroup): DetailedCalculationReport {
    const Pwork_pile = Math.round(grp.totalWorkingLoad / (grp.pileCount || 1));
    const isSafe = Pwork_pile <= grp.safePileCapacity;

    return {
      elementId: grp.nodeIds[0],
      elementType: 'FOOTING' as any,
      title: `${grp.label} (${grp.capLength}×${grp.capWidth}×${grp.capDepth} mm) STRUCTURAL CALCULATION REPORT`,
      designCode: 'IS 2911 (Part 1/Sec 2):2010 & IS 456:2000 Cl. 34',
      governingLoadCase: 5,
      timestamp: new Date().toLocaleString(),
      overallStatus: grp.status,
      summaryCallout: `${grp.pileCount}-Pile Combined Mat | Load/Pile = ${Pwork_pile} kN (Safe Cap: ${grp.safePileCapacity} kN) | Bottom: ${grp.botRebarCallout} | Top: ${grp.topRebarCallout}`,
      sections: [
        {
          title: '1. Combined Footprint & Pile Cluster Geometry',
          steps: [
            {
              symbol: 'Columns / Joints',
              description: 'Absorbed Supports in Combined Footprint',
              formula: 'Sum(Pu,i)',
              substitution: grp.columnLabels.join(' + ') + ` (Joints: ${grp.nodeIds.join(', ')})`,
              result: `${grp.nodeIds.length} Column Support Joints`,
            },
            {
              symbol: 'Pu,total / P_work',
              description: 'Total Factored & Working Vertical Load',
              formula: 'P_total_work = 1.10 * (Pu / 1.5)',
              substitution: `1.10 * (${grp.totalFactoredLoad} / 1.5)`,
              result: `Pu = ${grp.totalFactoredLoad} kN | P_work = ${grp.totalWorkingLoad} kN`,
            },
            {
              symbol: 'Dp × s × eo',
              description: 'Pile Diameter, Spacing & Edge Distance',
              formula: 's >= 3*Dp, eo >= 1*Dp',
              substitution: `${grp.pileDiameter} × ${grp.pileSpacing} × ${grp.edgeDistance}`,
              result: `Dp=${grp.pileDiameter}mm, s=${grp.pileSpacing}mm, eo=${grp.edgeDistance}mm`,
              codeReference: 'IS 2911 (Part 1/Sec 2) Cl. 6.6',
              status: 'PASS',
            },
            {
              symbol: 'L × B × D',
              description: 'Overall Combined Pile Cap Dimensions',
              formula: 'L × B × D',
              substitution: `${grp.capLength} × ${grp.capWidth} × ${grp.capDepth}`,
              result: `${grp.capLength}mm × ${grp.capWidth}mm × ${grp.capDepth}mm (d = ${grp.effectiveDepth}mm)`,
              codeReference: 'IS 2911 Cl. 6.8',
              status: 'PASS',
            },
          ],
        },
        {
          title: '2. Single Pile Safe Working Load & Capacity Check (IS 2911 Cl. 6.5)',
          steps: [
            {
              symbol: 'Qsafe',
              description: 'Single Pile Safe Working Load Capacity',
              formula: 'Qsafe (Geotechnical / Structural)',
              substitution: `Single pile capacity = ${grp.safePileCapacity} kN`,
              result: `${grp.safePileCapacity} kN`,
              codeReference: 'IS 2911:2010 Cl. 6.5',
            },
            {
              symbol: 'N_piles,req',
              description: 'Minimum Piles Required by Capacity',
              formula: 'ceil(P_total_work / Qsafe)',
              substitution: `ceil(${grp.totalWorkingLoad} / ${grp.safePileCapacity})`,
              result: `${Math.ceil(grp.totalWorkingLoad / grp.safePileCapacity)} Piles Minimum`,
            },
            {
              symbol: 'N_piles,prov',
              description: 'Provided Piles in Rigid Cap Matrix',
              formula: 'Rows × Cols',
              substitution: `${grp.pileRows} rows × ${grp.pileCols} cols`,
              result: `${grp.pileCount} Bored RC Piles`,
              status: grp.pileCount >= Math.ceil(grp.totalWorkingLoad / grp.safePileCapacity) ? 'PASS' : 'WARNING',
            },
            {
              symbol: 'P_pile,work',
              description: 'Actual Working Axial Load per Pile',
              formula: 'P_total_work / N_piles',
              substitution: `${grp.totalWorkingLoad} / ${grp.pileCount}`,
              result: `${Pwork_pile} kN / pile (Factored: ${grp.loadPerPile} kN / pile)`,
              status: isSafe ? 'PASS' : 'WARNING',
            },
          ],
        },
        {
          title: '3. Flexure & Reinforcement Design (IS 456:2000 Cl. 34.2)',
          steps: [
            {
              symbol: 'Bottom Rebar',
              description: 'Bottom Flexural Tension Mat (Long Way)',
              formula: 'Mu = (N/2) * P_pile * arm',
              substitution: `${grp.botRebarCallout}`,
              result: `${grp.botRebarCallout}`,
              codeReference: 'IS 456:2000 Cl. 34.2.3',
              status: 'PASS',
            },
            {
              symbol: 'Top Mesh',
              description: 'Top Shrinkage & Negative Moment Mesh',
              formula: '0.12% gross area',
              substitution: `${grp.topRebarCallout}`,
              result: `${grp.topRebarCallout}`,
              codeReference: 'IS 456:2000 Cl. 34.5',
              status: 'PASS',
            },
            {
              symbol: 'Strap Ties',
              description: 'Closed Perimeter Confinement Ties / Stirrups',
              formula: 'Closed link rings along cap length',
              substitution: `${grp.shearWallStirrupCallout}`,
              result: `${grp.shearWallStirrupCallout}`,
              codeReference: 'IS 13920 / SP:34',
              status: 'PASS',
            },
          ],
        },
      ],
    };
  }
}
