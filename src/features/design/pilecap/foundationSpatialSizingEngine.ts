/**
 * Foundation Spatial Sizing Engine — IS 2911:2010 & SP:34
 *
 * Automatically sizes and arranges combined and individual pile caps based on:
 * 1. Column Spacing & Proximity: Detects physical collisions and clearances between adjacent
 *    pile caps, automatically merging closely spaced columns into combined pile caps.
 * 2. Neighbor Clearance & Auto-Orientation: Automatically rotates individual rectangular caps
 *    (e.g. 2-pile, 3-pile, 6-pile) to align with axes of greater column clearance.
 * 3. Plot Boundary Compliance: Ensures neither concrete cap slabs nor bored pile shafts
 *    cross outside the property line defined by PlotSite (World X / World Z).
 */

import { NormalizedStructuralModel } from '@/features/model/types';
import { PlotSite } from '@/features/plot/plotTypes';
import { PileCapDesignOutput } from './pileCapDesignEngine';
import { CombinedPileCapGroup } from './combinedPileCapEngine';

export interface CapFootprint2D {
  id: string | number; // nodeId or groupId
  label: string;
  isCombined: boolean;
  centerX: number; // meters
  centerZ: number; // meters
  minX: number;    // meters
  maxX: number;    // meters
  minZ: number;    // meters
  maxZ: number;    // meters
  dimX: number;    // mm
  dimZ: number;    // mm
  rotationAngle: number;
}

export interface PlotBoundaryLimits {
  minX: number; // meters
  maxX: number; // meters
  minZ: number; // meters
  maxZ: number; // meters
  lengthM: number;
  widthM: number;
}

export interface CollisionPair {
  capA: string;
  capB: string;
  nodeIdsA: number[];
  nodeIdsB: number[];
  distCentersM: number;
  overlapXM: number;
  overlapZM: number;
  clearGapM: number;
}

export interface PlotViolation {
  id: string | number;
  label: string;
  isCombined: boolean;
  protrusionXM: number;
  protrusionZM: number;
  boundarySide: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT';
  message: string;
}

export interface SpatialAuditReport {
  totalIndividualCaps: number;
  totalCombinedCaps: number;
  collisions: CollisionPair[];
  plotViolations: PlotViolation[];
  hasCollisions: boolean;
  hasPlotViolations: boolean;
  isFullyCompliant: boolean;
  plotLimits: PlotBoundaryLimits | null;
}

export class FoundationSpatialSizingEngine {
  /** Minimum clear physical gap between two distinct pile caps in meters (150mm standard) */
  public static readonly MIN_CLEAR_GAP_M = 0.15;

  /**
   * Extract 2D World bounding box footprint for an individual pile cap
   */
  public static getIndividualCapFootprint(
    nodeId: number,
    cap: PileCapDesignOutput,
    model: NormalizedStructuralModel
  ): CapFootprint2D | null {
    const node = model.nodes.get(nodeId);
    if (!node) return null;

    const rot = (cap.rotationAngle || 0) % 360;
    const isRotated90 = rot === 90 || rot === 270;

    // Dimension in world coordinates along X and Z
    const dimX = isRotated90 ? cap.capWidth : cap.capLength;
    const dimZ = isRotated90 ? cap.capLength : cap.capWidth;

    const halfX = dimX / 2000;
    const halfZ = dimZ / 2000;

    return {
      id: nodeId,
      label: `PC-${nodeId}`,
      isCombined: false,
      centerX: node.x,
      centerZ: node.z,
      minX: node.x - halfX,
      maxX: node.x + halfX,
      minZ: node.z - halfZ,
      maxZ: node.z + halfZ,
      dimX,
      dimZ,
      rotationAngle: rot,
    };
  }

  /**
   * Extract 2D World bounding box footprint for a combined pile cap
   */
  public static getCombinedCapFootprint(
    group: CombinedPileCapGroup,
    model: NormalizedStructuralModel
  ): CapFootprint2D | null {
    const matchedNodes = group.nodeIds.map((id) => model.nodes.get(id)).filter(Boolean);
    if (matchedNodes.length === 0) return null;

    const cx = matchedNodes.reduce((sum, n) => sum + n!.x, 0) / matchedNodes.length;
    const cz = matchedNodes.reduce((sum, n) => sum + n!.z, 0) / matchedNodes.length;

    const rot = (group.rotationAngle || 0) % 360;
    const isRotated90 = rot === 90 || rot === 270;

    const dimX = isRotated90 ? group.capWidth : group.capLength;
    const dimZ = isRotated90 ? group.capLength : group.capWidth;

    const halfX = dimX / 2000;
    const halfZ = dimZ / 2000;

    return {
      id: group.groupId,
      label: group.label,
      isCombined: true,
      centerX: cx,
      centerZ: cz,
      minX: cx - halfX,
      maxX: cx + halfX,
      minZ: cz - halfZ,
      maxZ: cz + halfZ,
      dimX,
      dimZ,
      rotationAngle: rot,
    };
  }

  /**
   * Extract plot limits in World (X, Z) coordinates
   */
  public static getPlotLimits(plotSite?: PlotSite | null): PlotBoundaryLimits | null {
    if (!plotSite || plotSite.plotLength <= 0 || plotSite.plotWidth <= 0) return null;

    const ox = plotSite.plotOriginX || 0;
    const oz = plotSite.plotOriginZ || 0;

    return {
      minX: ox,
      maxX: ox + plotSite.plotLength,
      minZ: oz,
      maxZ: oz + plotSite.plotWidth,
      lengthM: plotSite.plotLength,
      widthM: plotSite.plotWidth,
    };
  }

  /**
   * Checks if two 2D footprints collide or violate the minimum clear gap
   */
  public static checkCollision(
    a: CapFootprint2D,
    b: CapFootprint2D,
    minGapM = FoundationSpatialSizingEngine.MIN_CLEAR_GAP_M
  ): CollisionPair | null {
    const distCenters = Math.hypot(a.centerX - b.centerX, a.centerZ - b.centerZ);

    const overlapX = (a.maxX + minGapM) - b.minX > 0 && (b.maxX + minGapM) - a.minX > 0;
    const overlapZ = (a.maxZ + minGapM) - b.minZ > 0 && (b.maxZ + minGapM) - a.minZ > 0;

    if (overlapX && overlapZ) {
      // Calculate actual clear gap (negative means interpenetration)
      const gapX = Math.max(0, b.minX - a.maxX, a.minX - b.maxX);
      const gapZ = Math.max(0, b.minZ - a.maxZ, a.minZ - b.maxZ);
      const clearGap = Math.hypot(gapX, gapZ);

      return {
        capA: a.label,
        capB: b.label,
        nodeIdsA: typeof a.id === 'number' ? [a.id] : [],
        nodeIdsB: typeof b.id === 'number' ? [b.id] : [],
        distCentersM: parseFloat(distCenters.toFixed(3)),
        overlapXM: parseFloat((Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)).toFixed(3)),
        overlapZM: parseFloat((Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ)).toFixed(3)),
        clearGapM: parseFloat(clearGap.toFixed(3)),
      };
    }
    return null;
  }

  /**
   * Evaluates if a footprint extends outside the plot boundaries
   */
  public static checkPlotViolations(
    fp: CapFootprint2D,
    limits: PlotBoundaryLimits
  ): PlotViolation[] {
    const violations: PlotViolation[] = [];
    const tol = 0.005; // 5mm tolerance for numeric precision

    if (fp.minX < limits.minX - tol) {
      const protrusion = limits.minX - fp.minX;
      violations.push({
        id: fp.id,
        label: fp.label,
        isCombined: fp.isCombined,
        protrusionXM: parseFloat(protrusion.toFixed(3)),
        protrusionZM: 0,
        boundarySide: 'FRONT',
        message: `${fp.label} extends ${protrusion.toFixed(2)}m past the front plot boundary line (X=${limits.minX.toFixed(2)}m)`,
      });
    }

    if (fp.maxX > limits.maxX + tol) {
      const protrusion = fp.maxX - limits.maxX;
      violations.push({
        id: fp.id,
        label: fp.label,
        isCombined: fp.isCombined,
        protrusionXM: parseFloat(protrusion.toFixed(3)),
        protrusionZM: 0,
        boundarySide: 'REAR',
        message: `${fp.label} extends ${protrusion.toFixed(2)}m past the rear plot boundary line (X=${limits.maxX.toFixed(2)}m)`,
      });
    }

    if (fp.minZ < limits.minZ - tol) {
      const protrusion = limits.minZ - fp.minZ;
      violations.push({
        id: fp.id,
        label: fp.label,
        isCombined: fp.isCombined,
        protrusionXM: 0,
        protrusionZM: parseFloat(protrusion.toFixed(3)),
        boundarySide: 'LEFT',
        message: `${fp.label} extends ${protrusion.toFixed(2)}m past the left plot boundary line (Z=${limits.minZ.toFixed(2)}m)`,
      });
    }

    if (fp.maxZ > limits.maxZ + tol) {
      const protrusion = fp.maxZ - limits.maxZ;
      violations.push({
        id: fp.id,
        label: fp.label,
        isCombined: fp.isCombined,
        protrusionXM: 0,
        protrusionZM: parseFloat(protrusion.toFixed(3)),
        boundarySide: 'RIGHT',
        message: `${fp.label} extends ${protrusion.toFixed(2)}m past the right plot boundary line (Z=${limits.maxZ.toFixed(2)}m)`,
      });
    }

    return violations;
  }

  /**
   * Runs a complete spatial audit across all foundation elements
   */
  public static auditAll(
    model: NormalizedStructuralModel,
    individualCaps: Map<number, PileCapDesignOutput>,
    combinedCaps: CombinedPileCapGroup[],
    plotSite?: PlotSite | null
  ): SpatialAuditReport {
    const limits = this.getPlotLimits(plotSite);
    const footprints: CapFootprint2D[] = [];

    // Collect all absorbed individual node IDs
    const absorbedNodes = new Set<number>();
    for (const grp of combinedCaps) {
      grp.nodeIds.forEach((id) => absorbedNodes.add(id));
      grp.absorbedIndividualCaps.forEach((id) => absorbedNodes.add(id));
      const fp = this.getCombinedCapFootprint(grp, model);
      if (fp) footprints.push(fp);
    }

    // Collect standalone individual caps
    for (const [nodeId, cap] of individualCaps.entries()) {
      if (absorbedNodes.has(nodeId)) continue;
      const fp = this.getIndividualCapFootprint(nodeId, cap, model);
      if (fp) footprints.push(fp);
    }

    // Pairwise collision checks
    const collisions: CollisionPair[] = [];
    for (let i = 0; i < footprints.length; i++) {
      for (let j = i + 1; j < footprints.length; j++) {
        const col = this.checkCollision(footprints[i], footprints[j]);
        if (col) collisions.push(col);
      }
    }

    // Plot boundary violation checks
    const plotViolations: PlotViolation[] = [];
    if (limits) {
      for (const fp of footprints) {
        const vios = this.checkPlotViolations(fp, limits);
        plotViolations.push(...vios);
      }
    }

    return {
      totalIndividualCaps: footprints.filter((f) => !f.isCombined).length,
      totalCombinedCaps: footprints.filter((f) => f.isCombined).length,
      collisions,
      plotViolations,
      hasCollisions: collisions.length > 0,
      hasPlotViolations: plotViolations.length > 0,
      isFullyCompliant: collisions.length === 0 && plotViolations.length === 0,
      plotLimits: limits,
    };
  }

  /**
   * Spatial Auto-Clustering: Automatically finds connected components of columns whose
   * individual pile caps collide or are closer than minGapM, grouping them for Combined Pile Caps.
   */
  public static findCollisionClusters(
    model: NormalizedStructuralModel,
    nodes: { nodeId: number; x: number; z: number; Pu: number }[],
    preliminaryCaps: Map<number, PileCapDesignOutput>,
    detachedNodeIds: number[] = [],
    minGapM = FoundationSpatialSizingEngine.MIN_CLEAR_GAP_M
  ): number[][] {
    const detachedSet = new Set(detachedNodeIds);
    const activeNodes = nodes.filter((n) => !detachedSet.has(n.nodeId));
    if (activeNodes.length < 2) return [];

    // Build footprints for each active node
    const nodeFpMap = new Map<number, CapFootprint2D>();
    for (const n of activeNodes) {
      const cap = preliminaryCaps.get(n.nodeId);
      if (cap) {
        const fp = this.getIndividualCapFootprint(n.nodeId, cap, model);
        if (fp) nodeFpMap.set(n.nodeId, fp);
      } else {
        // Fallback default footprint (~2.0m x 2.0m)
        nodeFpMap.set(n.nodeId, {
          id: n.nodeId,
          label: `C${n.nodeId}`,
          isCombined: false,
          centerX: n.x,
          centerZ: n.z,
          minX: n.x - 1.0,
          maxX: n.x + 1.0,
          minZ: n.z - 1.0,
          maxZ: n.z + 1.0,
          dimX: 2000,
          dimZ: 2000,
          rotationAngle: 0,
        });
      }
    }

    // Build adjacency graph of colliding/overlapping caps
    const adj = new Map<number, Set<number>>();
    for (const n of activeNodes) {
      adj.set(n.nodeId, new Set());
    }

    for (let i = 0; i < activeNodes.length; i++) {
      const idA = activeNodes[i].nodeId;
      const fpA = nodeFpMap.get(idA);
      if (!fpA) continue;

      for (let j = i + 1; j < activeNodes.length; j++) {
        const idB = activeNodes[j].nodeId;
        const fpB = nodeFpMap.get(idB);
        if (!fpB) continue;

        if (this.checkCollision(fpA, fpB, minGapM)) {
          adj.get(idA)!.add(idB);
          adj.get(idB)!.add(idA);
        }
      }
    }

    // Find connected components via BFS
    const visited = new Set<number>();
    const clusters: number[][] = [];

    for (const n of activeNodes) {
      if (visited.has(n.nodeId)) continue;
      const neighbors = adj.get(n.nodeId);
      if (!neighbors || neighbors.size === 0) continue;

      const cluster: number[] = [];
      const queue: number[] = [n.nodeId];
      visited.add(n.nodeId);

      while (queue.length > 0) {
        const cur = queue.shift()!;
        cluster.push(cur);

        const curNeighbors = adj.get(cur);
        if (curNeighbors) {
          for (const neighbor of curNeighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
      }

      if (cluster.length >= 2) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Auto-size and auto-orient individual pile caps to:
   * 1. Clear neighbor columns
   * 2. Fit strictly within plot site boundary
   */
  public static getOptimalIndividualOrientation(
    nodeId: number,
    cap: PileCapDesignOutput,
    model: NormalizedStructuralModel,
    allSupports: { nodeId: number; x: number; z: number }[],
    plotSite?: PlotSite | null
  ): { recommendedRotation: number; isPlotConstrained: boolean } {
    const node = model.nodes.get(nodeId);
    if (!node) return { recommendedRotation: 0, isPlotConstrained: false };

    // Square caps (e.g. 4-pile) are identical at 0° and 90°
    if (Math.abs(cap.capLength - cap.capWidth) < 50) {
      return { recommendedRotation: 0, isPlotConstrained: false };
    }

    const limits = this.getPlotLimits(plotSite);

    const isTriangular = cap.capShape === 'TRIANGULAR';
    const anglesToTest = isTriangular ? [0, 90, 180, 270] : [0, 90];
    let bestAngle = (cap.rotationAngle || 0) % (isTriangular ? 360 : 180);
    let bestScore = Infinity;
    let plotConstrained = false;

    for (const angle of anglesToTest) {
      const isRotated90 = angle === 90 || angle === 270;
      const dimX = isRotated90 ? cap.capWidth : cap.capLength;
      const dimZ = isRotated90 ? cap.capLength : cap.capWidth;

      const halfX = dimX / 2000;
      const halfZ = dimZ / 2000;

      const minX = node.x - halfX;
      const maxX = node.x + halfX;
      const minZ = node.z - halfZ;
      const maxZ = node.z + halfZ;

      let penalty = 0;

      // 1. Strict Plot Boundary Compliance Check
      if (limits) {
        if (minX < limits.minX) penalty += (limits.minX - minX) * 20000;
        if (maxX > limits.maxX) penalty += (maxX - limits.maxX) * 20000;
        if (minZ < limits.minZ) penalty += (limits.minZ - minZ) * 20000;
        if (maxZ > limits.maxZ) penalty += (maxZ - limits.maxZ) * 20000;
      }

      // 2. Neighbor Column Physical Clearance Check
      for (const other of allSupports) {
        if (other.nodeId === nodeId) continue;
        const dx = Math.abs(node.x - other.x);
        const dz = Math.abs(node.z - other.z);

        // If neighbor is along X, narrower halfX provides more clearance
        if (dx > 0 && dx < 3.5) {
          const edgeClearanceX = dx - halfX;
          if (edgeClearanceX < 0.15) {
            penalty += (0.15 - edgeClearanceX) * 5000;
          } else {
            penalty += (halfX / dx) * 10;
          }
        }
        // If neighbor is along Z, narrower halfZ provides more clearance
        if (dz > 0 && dz < 3.5) {
          const edgeClearanceZ = dz - halfZ;
          if (edgeClearanceZ < 0.15) {
            penalty += (0.15 - edgeClearanceZ) * 5000;
          } else {
            penalty += (halfZ / dz) * 10;
          }
        }
      }

      // Slight tie-breaker preference for current angle
      if (angle === (cap.rotationAngle || 0)) {
        penalty -= 0.1;
      }

      if (penalty < bestScore) {
        bestScore = penalty;
        bestAngle = angle;
      }
    }

    if (limits && bestScore > 0) {
      plotConstrained = true;
    }

    return { recommendedRotation: bestAngle, isPlotConstrained: plotConstrained };
  }

  /**
   * Spatial Auto-Sizing Master Method:
   * 1. Evaluates all individual pile caps and recommends optimal rotations (0° vs 90°)
   *    to clear neighbors and stay strictly within the plot site boundary.
   * 2. Detects remaining collision clusters (< 150mm clear gap) and groups them into
   *    multi-column Combined Pile Caps.
   * 3. Audits before and after to verify compliance.
   */
  public static autoSizeAll(
    model: NormalizedStructuralModel,
    individualCaps: Map<number, PileCapDesignOutput>,
    existingManualGroups: number[][] = [],
    detachedNodeIds: number[] = [],
    plotSite?: PlotSite | null,
    minGapM = FoundationSpatialSizingEngine.MIN_CLEAR_GAP_M
  ): {
    recommendedRotations: Record<number, number>;
    newCombinedGroups: number[][];
    mergedNodeCount: number;
    rotatedCapCount: number;
    auditBefore: SpatialAuditReport;
    auditAfter: SpatialAuditReport;
  } {
    const recommendedRotations: Record<number, number> = {};
    const allSupports: { nodeId: number; x: number; z: number }[] = [];
    if (model.supports) {
      for (const sup of model.supports.values()) {
        const n = model.nodes?.get(sup.nodeId);
        if (n) allSupports.push({ nodeId: sup.nodeId, x: n.x, z: n.z });
      }
    }

    const alreadyMergedSet = new Set<number>();
    existingManualGroups.forEach((grp) => grp.forEach((id) => alreadyMergedSet.add(id)));

    // Audit before
    const auditBefore = this.auditAll(
      model,
      individualCaps,
      [],
      plotSite
    );

    // Step 1: Optimize orientations for standalone individual caps
    const updatedCaps = new Map<number, PileCapDesignOutput>();
    let rotatedCapCount = 0;

    for (const [nodeId, cap] of individualCaps.entries()) {
      if (alreadyMergedSet.has(nodeId)) {
        updatedCaps.set(nodeId, cap);
        continue;
      }

      const opt = this.getOptimalIndividualOrientation(nodeId, cap, model, allSupports, plotSite);
      const currentRot = cap.rotationAngle || 0;

      if (opt.recommendedRotation !== currentRot) {
        recommendedRotations[nodeId] = opt.recommendedRotation;
        rotatedCapCount++;

        const is90 = opt.recommendedRotation === 90 || opt.recommendedRotation === 270;
        const was90 = currentRot === 90 || currentRot === 270;
        let capLen = cap.capLength;
        let capWid = cap.capWidth;
        if (is90 !== was90 && cap.capShape === 'RECTANGULAR') {
          capLen = cap.capWidth;
          capWid = cap.capLength;
        }

        updatedCaps.set(nodeId, {
          ...cap,
          rotationAngle: opt.recommendedRotation,
          capLength: capLen,
          capWidth: capWid,
        });
      } else {
        updatedCaps.set(nodeId, cap);
      }
    }

    // Step 2: Detect collisions among remaining support nodes
    const remainingSupports: { nodeId: number; x: number; z: number; Pu: number }[] = [];
    for (const sup of allSupports) {
      if (alreadyMergedSet.has(sup.nodeId)) continue;
      const cap = updatedCaps.get(sup.nodeId);
      remainingSupports.push({
        nodeId: sup.nodeId,
        x: sup.x,
        z: sup.z,
        Pu: cap ? cap.factoredVerticalLoad : 650,
      });
    }

    const clusters = this.findCollisionClusters(
      model,
      remainingSupports,
      updatedCaps,
      detachedNodeIds,
      minGapM
    );

    // Merge new clusters into existing manual groups without duplicating
    const newCombinedGroups: number[][] = existingManualGroups.map((g) => [...g]);
    let mergedNodeCount = 0;

    for (const cluster of clusters) {
      if (cluster.length >= 2) {
        const unassigned = cluster.filter((id) => !alreadyMergedSet.has(id));
        if (unassigned.length >= 2) {
          newCombinedGroups.push(unassigned);
          unassigned.forEach((id) => alreadyMergedSet.add(id));
          mergedNodeCount += unassigned.length;
        }
      }
    }

    // Audit after
    const auditAfter = this.auditAll(
      model,
      updatedCaps,
      [],
      plotSite
    );

    return {
      recommendedRotations,
      newCombinedGroups,
      mergedNodeCount,
      rotatedCapCount,
      auditBefore,
      auditAfter,
    };
  }
}
