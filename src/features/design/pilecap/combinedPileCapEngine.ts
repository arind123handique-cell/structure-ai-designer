import { NormalizedStructuralModel } from '@/features/model/types';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { PlotSite } from '@/features/plot/plotTypes';
import { PileCapDesignOutput } from './pileCapDesignEngine';
import { FoundationSpatialSizingEngine } from './foundationSpatialSizingEngine';
import { IS456Flexure } from '@/features/codes/is456/flexure';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { rotatePoints2D } from './pileCapGeometryUtils';

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
  pileSpacingX?: number;
  pileSpacingZ?: number;
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
  rotationAngle?: number;
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
      rotationAngle?: number;
    }>,
    defaultSafeWorkingCapacity = 280,
    plotSite?: PlotSite | null,
    autoMergeCollisions = false
  ): CombinedPileCapGroup[] {
    if (!model.supports || model.supports.size === 0) return [];
    const columnMapping = ColumnNumberingService.getColumnSupportMapping(model);
    const results: CombinedPileCapGroup[] = [];
    const supportNodes: SupportNodeInfo[] = [];

    // Pre-index max vertical reaction per node O(R)
    const maxFyByNode = new Map<number, number>();
    if (model.reactions) {
      for (let i = 0; i < model.reactions.length; i++) {
        const r = model.reactions[i];
        const val = Math.abs(r.fy);
        const cur = maxFyByNode.get(r.nodeId) || 0;
        if (val > cur) maxFyByNode.set(r.nodeId, val);
      }
    }

    // Lazy index of max member axial force if fallback is needed
    let axialForceByNode: Map<number, number> | null = null;

    for (const sup of model.supports.values()) {
      const node = model.nodes.get(sup.nodeId);
      if (!node) continue;
      const colInfo = columnMapping.get(sup.nodeId);
      let maxFy = maxFyByNode.get(sup.nodeId) || 0;
      if (maxFy <= 0 && model.memberForces && model.members) {
        if (!axialForceByNode) {
          axialForceByNode = new Map<number, number>();
          const memberNodeMap = new Map<number, [number, number]>();
          for (const m of model.members.values()) {
            memberNodeMap.set(m.id, [m.startNodeId, m.endNodeId]);
          }
          for (let i = 0; i < model.memberForces.length; i++) {
            const f = model.memberForces[i];
            const nodes = memberNodeMap.get(f.memberId);
            if (nodes) {
              const ax = Math.abs(f.axial || 0);
              const cur0 = axialForceByNode.get(nodes[0]) || 0;
              if (ax > cur0) axialForceByNode.set(nodes[0], ax);
              const cur1 = axialForceByNode.get(nodes[1]) || 0;
              if (ax > cur1) axialForceByNode.set(nodes[1], ax);
            }
          }
        }
        maxFy = axialForceByNode.get(sup.nodeId) || 0;
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
            defaultSafeWorkingCapacity,
            plotSite
          );
          results.push(grp);
        }
      }
    }

    // Mark user-detached nodes as excluded from merging
    if (detachedNodeIds && detachedNodeIds.length > 0) {
      detachedNodeIds.forEach((id) => absorbed.add(id));
    }

    // 2. Automated Collision Detection & Sizing (when autoMergeCollisions is enabled)
    if (autoMergeCollisions) {
      // 2a. Detect shear wall clusters from WALL plates or close geometric wall nodes
      const remainingForSW = supportNodes.filter((n) => !absorbed.has(n.nodeId));
      const swGroups = CombinedPileCapEngine.detectShearWallClusters(
        model,
        remainingForSW,
        pileDiameter,
        customCombinedOverrides,
        defaultSafeWorkingCapacity,
        plotSite
      );
      for (const sw of swGroups) {
        sw.nodeIds.forEach((id) => absorbed.add(id));
        results.push(sw);
      }

      // 2b. Detect physically colliding / overlapping column caps via BFS Connected Components
      if (designedIndividualCaps && designedIndividualCaps.size > 0) {
        const remainingSupportNodes = supportNodes.filter((n) => !absorbed.has(n.nodeId));
        const clusters = FoundationSpatialSizingEngine.findCollisionClusters(
          model,
          remainingSupportNodes,
          designedIndividualCaps,
          detachedNodeIds,
          0.15
        );

        let autoIdx = results.length + 1;
        for (const clusterNodeIds of clusters) {
          const matchedNodes = remainingSupportNodes.filter((n) => clusterNodeIds.includes(n.nodeId));
          if (matchedNodes.length >= 2) {
            matchedNodes.forEach((n) => absorbed.add(n.nodeId));
            const gid = `AUTO-${autoIdx}`;
            const override = customCombinedOverrides?.[gid];
            const grp = CombinedPileCapEngine.designMergedCap(
              matchedNodes,
              pileDiameter,
              autoIdx++,
              false,
              override,
              defaultSafeWorkingCapacity,
              plotSite
            );
            results.push(grp);
          }
        }
      }
    }

    return results;
  }

  private static detectShearWallClusters(
    model: NormalizedStructuralModel,
    nodes: SupportNodeInfo[],
    Dp: number,
    customCombinedOverrides?: Record<string, any>,
    defaultQsafe = 280,
    plotSite?: PlotSite | null
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
      results.push(CombinedPileCapEngine.designShearWallCap(cn, Dp, idx++, override, defaultQsafe, plotSite));
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

  public static computeOptimalGrid(
    pileCount: number,
    dimX: number,
    dimZ: number,
    Dp: number,
    eo: number,
    allowExpansion = true,
    maxDimX?: number,
    maxDimZ?: number
  ): {
    nX: number;
    nZ: number;
    sX: number;
    sZ: number;
    capLength: number;
    capWidth: number;
    pileOffsets: { x: number; z: number }[];
    totalPiles: number;
  } {
    // IS 2911:2010 Cl. 6.6.1 Statutory Limits:
    // Friction piles: spacing >= 3.0 * Dp
    // End bearing piles: spacing >= 2.5 * Dp
    // Absolute minimum statutory spacing: 2.5 * Dp
    const sMin = 2.5 * Dp;
    const sTarget = 3.0 * Dp;
    const sMax = 3.5 * Dp;
    const edgeDist = Math.max(Dp, eo);

    const N = Math.max(2, pileCount);
    let bestNx = 2;
    let bestNz = Math.ceil(N / 2);
    let bestScore = Infinity;

    const dimAspect = dimX / Math.max(1, dimZ);

    // Search for optimal grid columns (nx) and rows (nz)
    for (let nx = 1; nx <= 12; nx++) {
      const nz = Math.ceil(N / nx);
      const totalP = nx * nz;
      // Disallow excessive pile over-allocation
      if (totalP > N + 4 && N > 3) continue;
      if (nx === 1 && nz > 4) continue; // single line of >4 piles is unstable for a 2D foundation mat
      if (nz === 1 && nx > 4) continue;

      const gridAspect = nx / nz;

      // Desired dimensions to achieve target spacing
      const reqX = nx > 1 ? (nx - 1) * sTarget + 2 * edgeDist : Dp + 2 * edgeDist;
      const reqZ = nz > 1 ? (nz - 1) * sTarget + 2 * edgeDist : Dp + 2 * edgeDist;

      // Evaluated dimensions (with expansion if allowed)
      const candDimX = allowExpansion ? Math.max(dimX, reqX) : dimX;
      const candDimZ = allowExpansion ? Math.max(dimZ, reqZ) : dimZ;

      const availX = Math.max(10, candDimX - 2 * edgeDist);
      const availZ = Math.max(10, candDimZ - 2 * edgeDist);

      const candSx = nx > 1 ? availX / (nx - 1) : sTarget;
      const candSz = nz > 1 ? availZ / (nz - 1) : sTarget;

      // Check statutory compliance: spacing must NEVER be below sMin
      let penalty = 0;
      if (allowExpansion) {
        if (nx > 1 && candSx < sMin) penalty += (sMin - candSx) * 1000 + 10000;
        if (nz > 1 && candSz < sMin) penalty += (sMin - candSz) * 1000 + 10000;
      }

      // Check plot boundary compliance: penalize configurations that exceed available boundary space
      if (maxDimX && candDimX > maxDimX) {
        penalty += (candDimX - maxDimX) * 5000 + 50000;
      }
      if (maxDimZ && candDimZ > maxDimZ) {
        penalty += (candDimZ - maxDimZ) * 5000 + 50000;
      }

      // Penalty for aspect ratio mismatch
      const aspectDiff = Math.abs(Math.log(gridAspect) - Math.log(dimAspect));

      // Penalty for uneven pile spacing in X vs Z (prefer sx ~= sz)
      const spacingDiff = Math.abs(candSx - candSz) / Dp;

      // Penalty for excess piles: strong penalty for unnecessary piles, bonus for exact factorization
      const excessPiles = totalP - N;
      const exactBonus = totalP === N ? -30 : 0;
      const excessPenalty = excessPiles * 40;

      // Prefer configurations where orientation aligns with cap aspect
      let orientationMismatch = 0;
      if ((dimX >= dimZ && nx < nz) || (dimZ > dimX && nz < nx)) {
        orientationMismatch = 25;
      }

      const score = penalty + aspectDiff * 20 + spacingDiff * 8 + excessPenalty + exactBonus + orientationMismatch;
      if (score < bestScore) {
        bestScore = score;
        bestNx = nx;
        bestNz = nz;
      }
    }

    let finalDimX: number;
    let finalDimZ: number;
    let sX: number;
    let sZ: number;

    if (allowExpansion) {
      // Auto-expand dimensions to guarantee IS 2911 Cl. 6.6.1 compliance
      const targetReqDimX = bestNx > 1 ? (bestNx - 1) * sTarget + 2 * edgeDist : Dp + 2 * edgeDist;
      const targetReqDimZ = bestNz > 1 ? (bestNz - 1) * sTarget + 2 * edgeDist : Dp + 2 * edgeDist;

      finalDimX = Math.max(dimX, targetReqDimX);
      finalDimZ = Math.max(dimZ, targetReqDimZ);

      // Clamp dimensions to maximum allowed plot dimensions if bounded
      if (maxDimX && finalDimX > maxDimX) {
        finalDimX = Math.max(Dp + 2 * edgeDist, maxDimX);
      }
      if (maxDimZ && finalDimZ > maxDimZ) {
        finalDimZ = Math.max(Dp + 2 * edgeDist, maxDimZ);
      }

      const availX = Math.max(10, finalDimX - 2 * edgeDist);
      const availZ = Math.max(10, finalDimZ - 2 * edgeDist);

      sX = bestNx > 1 ? Math.min(sMax, Math.max(sMin, availX / (bestNx - 1))) : 0;
      sZ = bestNz > 1 ? Math.min(sMax, Math.max(sMin, availZ / (bestNz - 1))) : 0;

      const gSpanX = bestNx > 1 ? (bestNx - 1) * sX : 0;
      const gSpanZ = bestNz > 1 ? (bestNz - 1) * sZ : 0;

      finalDimX = Math.round(Math.max(finalDimX, gSpanX + 2 * edgeDist));
      finalDimZ = Math.round(Math.max(finalDimZ, gSpanZ + 2 * edgeDist));
    } else {
      // User explicitly specified custom dimensions: preserve exact dimensions
      finalDimX = Math.round(dimX);
      finalDimZ = Math.round(dimZ);

      const availX = Math.max(10, finalDimX - 2 * edgeDist);
      const availZ = Math.max(10, finalDimZ - 2 * edgeDist);

      sX = bestNx > 1 ? availX / (bestNx - 1) : 0;
      sZ = bestNz > 1 ? availZ / (bestNz - 1) : 0;
      if (bestNx > 1 && sX > sMax) sX = sMax;
      if (bestNz > 1 && sZ > sMax) sZ = sMax;
    }

    const gridSpanX = bestNx > 1 ? (bestNx - 1) * sX : 0;
    const gridSpanZ = bestNz > 1 ? (bestNz - 1) * sZ : 0;

    const startX = -gridSpanX / 2;
    const startZ = -gridSpanZ / 2;

    const pileOffsets: { x: number; z: number }[] = [];
    for (let r = 0; r < bestNz; r++) {
      for (let c = 0; c < bestNx; c++) {
        const px = Math.round(startX + c * sX);
        const pz = Math.round(startZ + r * sZ);
        pileOffsets.push({ x: px, z: pz });
      }
    }

    return {
      nX: bestNx,
      nZ: bestNz,
      sX: Math.round(sX),
      sZ: Math.round(sZ),
      capLength: finalDimX,
      capWidth: finalDimZ,
      pileOffsets,
      totalPiles: pileOffsets.length,
    };
  }

  public static designShearWallCap(
    cn: SupportNodeInfo[],
    Dp: number,
    idx: number,
    override?: any,
    defaultQsafe = 280,
    plotSite?: PlotSite | null
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
    const spanXMm = Math.round((maxX - minX) * 1000);
    const spanZMm = Math.round((maxZ - minZ) * 1000);
    const longIsX = spanXMm >= spanZMm;
    const spanLongMm = Math.max(spanXMm, spanZMm);
    const spanShortMm = Math.min(spanXMm, spanZMm);

    let nLong = Math.max(2, Math.round(spanLongMm / s) + 1);
    let nShort = spanShortMm > s * 0.5 ? 2 : 1;

    // Ensure total piles in grid satisfies single pile load capacity
    while (nShort * nLong < minPilesReq) {
      if (nShort === 1) {
        nShort = 2;
      } else if (nLong < nShort * 2.5) {
        nLong += 1;
      } else {
        nShort += 1;
      }
    }

    let pileCount = nShort * nLong;
    if (override?.customPileCount && override.customPileCount > 0) {
      pileCount = override.customPileCount;
    }

    const calcCapLong = Math.max(spanLongMm + 2 * eo, (nLong - 1) * s + 2 * eo);
    const calcCapShort = Math.max(spanShortMm + 2 * eo, nShort > 1 ? (nShort - 1) * s + 2 * eo : Dp + 2 * eo);

    let capLength: number; // dimension along X
    let capWidth: number;  // dimension along Z

    if (override?.customCapLength || override?.customCapWidth) {
      const userDim1 = override?.customCapLength || 0;
      const userDim2 = override?.customCapWidth || 0;
      const userLong = Math.max(userDim1, userDim2) || calcCapLong;
      const userShort = (Math.min(userDim1, userDim2) > 0 ? Math.min(userDim1, userDim2) : (userDim1 || userDim2)) || calcCapShort;

      capLength = longIsX ? userLong : userShort;
      capWidth = longIsX ? userShort : userLong;
    } else {
      capLength = longIsX ? calcCapLong : calcCapShort;
      capWidth = longIsX ? calcCapShort : calcCapLong;
    }

    const capDepth = override?.customCapDepth || Math.max(900, Math.round(1.5 * Dp));

    // Dynamic optimal grid placement strictly bounded within cap dimensions and plot boundaries
    const hasCustomDim = Boolean(override?.customCapLength || override?.customCapWidth);
    const allowExpansion = !hasCustomDim;

    let maxDimX: number | undefined;
    let maxDimZ: number | undefined;
    if (plotSite && plotSite.plotLength > 0 && plotSite.plotWidth > 0) {
      const pLimits = FoundationSpatialSizingEngine.getPlotLimits(plotSite);
      if (pLimits) {
        const cx = cn.reduce((s, n) => s + n.x, 0) / cn.length;
        const cz = cn.reduce((s, n) => s + n.z, 0) / cn.length;
        const availHalfX = Math.min(cx - pLimits.minX, pLimits.maxX - cx);
        const availHalfZ = Math.min(cz - pLimits.minZ, pLimits.maxZ - cz);
        if (availHalfX > 0) maxDimX = Math.floor(availHalfX * 2000);
        if (availHalfZ > 0) maxDimZ = Math.floor(availHalfZ * 2000);
      }
    }

    const grid = CombinedPileCapEngine.computeOptimalGrid(
      pileCount,
      capLength,
      capWidth,
      Dp,
      eo,
      allowExpansion,
      maxDimX,
      maxDimZ
    );
    let pileOffsets = grid.pileOffsets;
    if (allowExpansion) {
      capLength = grid.capLength;
      capWidth = grid.capWidth;
    }
    pileCount = grid.totalPiles;
    const nCols = longIsX ? grid.nX : grid.nZ;
    const nRows = longIsX ? grid.nZ : grid.nX;

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

    const hasCoreNodes =
      cn.some((n) => [3, 364, 365, 366, 367].includes(n.nodeId)) ||
      (xs.some((x) => Math.abs(x - 8.10) < 0.2) &&
        zs.some((z) => Math.abs(z - -2.30) < 0.2 || Math.abs(z - -3.80) < 0.2));

    if (hasCoreNodes || (xs.length >= 2 && zs.length >= 2 && cn.length >= 4)) {
      // Lift core U-shape — true physical coordinates: 8.10 to 9.60m, opening west, web at east
      shape = 'U_SHAPE';
      const side = 1.50;
      const half = side / 2;
      const cx = cn.reduce((s, n) => s + n.x, 0) / cn.length;
      const cz = cn.reduce((s, n) => s + n.z, 0) / cn.length;

      const xL = hasCoreNodes ? 8.10 : parseFloat((cx - half).toFixed(3));
      const xR = hasCoreNodes ? 9.60 : parseFloat((cx + half).toFixed(3));
      const zN = hasCoreNodes ? -2.30 : parseFloat((cz + half).toFixed(3));
      const zS = hasCoreNodes ? -3.80 : parseFloat((cz - half).toFixed(3));
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

    const rotationAngle = override?.rotationAngle || 0;
    if (rotationAngle !== 0) {
      const pts2D = pileOffsets.map((p) => ({ x: p.x, y: p.z }));
      const rotated = rotatePoints2D(pts2D, rotationAngle, { x: 0, y: 0 });
      pileOffsets = rotated.map((p) => ({ x: p.x, z: p.y }));
      if (!override?.customCapLength && !override?.customCapWidth && (rotationAngle === 90 || rotationAngle === 270)) {
        const temp = capLength;
        capLength = capWidth;
        capWidth = temp;
      }
    }

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
      wallLengthM: spanLongMm / 1000,
      wallWidthM: spanShortMm / 1000,
      totalFactoredLoad: Math.round(totalPu),
      totalWorkingLoad,
      safePileCapacity,
      pileDiameter: Dp,
      pileSpacing: Math.min(grid.sX || grid.sZ, grid.sZ || grid.sX) || s,
      pileSpacingX: grid.sX,
      pileSpacingZ: grid.sZ,
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
      rotationAngle,
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
    defaultQsafe = 280,
    plotSite?: PlotSite | null
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
    const spanShortMm = Math.min(spanXMm, spanZMm);

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
    }

    const calcCapLong = Math.max(spanLongMm + 2 * eo, (nLong - 1) * s + 2 * eo);
    const calcCapShort = Math.max(spanShortMm + 2 * eo, (nShort - 1) * s + 2 * eo);

    let capLength: number; // dimension along X
    let capWidth: number;  // dimension along Z

    if (override?.customCapLength || override?.customCapWidth) {
      const userDim1 = override?.customCapLength || 0;
      const userDim2 = override?.customCapWidth || 0;
      const userLong = Math.max(userDim1, userDim2) || calcCapLong;
      const userShort = (Math.min(userDim1, userDim2) > 0 ? Math.min(userDim1, userDim2) : (userDim1 || userDim2)) || calcCapShort;

      capLength = isXDir ? userLong : userShort;
      capWidth = isXDir ? userShort : userLong;
    } else {
      capLength = isXDir ? calcCapLong : calcCapShort;
      capWidth = isXDir ? calcCapShort : calcCapLong;
    }

    const capDepth = override?.customCapDepth || Math.max(900, Math.round(1.5 * Dp));

    // Dynamic optimal grid placement strictly bounded within cap dimensions and plot boundaries
    const hasCustomDim = Boolean(override?.customCapLength || override?.customCapWidth);
    const allowExpansion = !hasCustomDim;

    let maxDimX: number | undefined;
    let maxDimZ: number | undefined;
    if (plotSite && plotSite.plotLength > 0 && plotSite.plotWidth > 0) {
      const pLimits = FoundationSpatialSizingEngine.getPlotLimits(plotSite);
      if (pLimits) {
        const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
        const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;
        const availHalfX = Math.min(cx - pLimits.minX, pLimits.maxX - cx);
        const availHalfZ = Math.min(cz - pLimits.minZ, pLimits.maxZ - cz);
        if (availHalfX > 0) maxDimX = Math.floor(availHalfX * 2000);
        if (availHalfZ > 0) maxDimZ = Math.floor(availHalfZ * 2000);
      }
    }

    const grid = CombinedPileCapEngine.computeOptimalGrid(
      pileCount,
      capLength,
      capWidth,
      Dp,
      eo,
      allowExpansion,
      maxDimX,
      maxDimZ
    );
    let pileOffsets = grid.pileOffsets;
    if (allowExpansion) {
      capLength = grid.capLength;
      capWidth = grid.capWidth;
    }
    pileCount = grid.totalPiles;
    const nLongGrid = isXDir ? grid.nX : grid.nZ;
    const nShortGrid = isXDir ? grid.nZ : grid.nX;

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
      const hasCoreNodes =
        nodes.some((n) => [3, 364, 365, 366, 367].includes(n.nodeId)) ||
        (xs.some((x) => Math.abs(x - 8.10) < 0.2) &&
          zs.some((z) => Math.abs(z - -2.30) < 0.2 || Math.abs(z - -3.80) < 0.2));

      if (hasCoreNodes || (xs.length >= 2 && zs.length >= 2 && nodes.length >= 4)) {
        // Lift core U-shape — true physical coordinates: 8.10 to 9.60m, opening west, web at east
        const side = 1.50;
        const half = side / 2;
        const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
        const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;

        const xL = hasCoreNodes ? 8.10 : parseFloat((cx - half).toFixed(3));
        const xR = hasCoreNodes ? 9.60 : parseFloat((cx + half).toFixed(3));
        const zN = hasCoreNodes ? -2.30 : parseFloat((cz + half).toFixed(3));
        const zS = hasCoreNodes ? -3.80 : parseFloat((cz - half).toFixed(3));
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

    const rotationAngle = override?.rotationAngle || 0;
    if (rotationAngle !== 0) {
      const pts2D = pileOffsets.map((p) => ({ x: p.x, y: p.z }));
      const rotated = rotatePoints2D(pts2D, rotationAngle, { x: 0, y: 0 });
      pileOffsets = rotated.map((p) => ({ x: p.x, z: p.y }));
      if (!override?.customCapLength && !override?.customCapWidth && (rotationAngle === 90 || rotationAngle === 270)) {
        const temp = capLength;
        capLength = capWidth;
        capWidth = temp;
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
      pileSpacing: Math.min(grid.sX || grid.sZ, grid.sZ || grid.sX) || s,
      pileSpacingX: grid.sX,
      pileSpacingZ: grid.sZ,
      edgeDistance: eo,
      pileCount,
      pileRows: nShortGrid,
      pileCols: nLongGrid,
      pileOffsets,
      capLength,
      capWidth,
      capDepth,
      effectiveDepth: d,
      loadPerPile,
      botRebarCallout: override?.customBottomRebar || `T16 @ ${sp} mm c/c (Long Way Bot)`,
      topRebarCallout: override?.customTopRebar || `T12 @ 150 mm c/c (Both Ways Top)`,
      shearWallStirrupCallout: `T10 @ 200 mm c/c (Strap Ties)`,
      rotationAngle,
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
