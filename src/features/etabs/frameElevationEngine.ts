import { NormalizedStructuralModel } from '@/features/model/types';
import { FloorPlanEngine, GridLineInfo } from '@/features/drawings/floorPlanEngine';

export interface ElevationColumnInfo {
  memberId: number;
  label: string;
  nodeBottomId: number;
  nodeTopId: number;
  h: number; // horizontal coordinate (Z if frame axis=X, X if frame axis=Z)
  yBottom: number;
  yTop: number;
  width: number; // meters (column section width zd)
  depth: number; // meters (column section depth yd)
  sectionName: string;
  maxMoment: number;
  topMoment: number;
  botMoment: number;
  maxShear: number;
}

export interface ElevationBeamInfo {
  memberId: number;
  label: string;
  nodeStartId: number;
  nodeEndId: number;
  h1: number; // start horizontal coordinate
  h2: number; // end horizontal coordinate
  y: number; // vertical elevation
  length: number;
  width: number;
  depth: number;
  sectionName: string;
  maxMoment: number;
  spanMoment: number;
  supMoment1: number;
  supMoment2: number;
  maxShear: number;
}

export interface ElevationSupportInfo {
  nodeId: number;
  h: number;
  y: number;
  type: 'FIXED' | 'PINNED' | 'ROLLER';
}

export interface ElevationStoreyDatum {
  label: string;
  y: number;
}

export interface ElevationGridDatum {
  id: string;
  label: string;
  coord: number;
}

export interface ElevationBayDimension {
  startH: number;
  endH: number;
  spanM: number;
  label: string;
}

export interface FrameElevationData {
  gridLine: GridLineInfo;
  axis: 'X' | 'Z';
  columns: ElevationColumnInfo[];
  beams: ElevationBeamInfo[];
  supports: ElevationSupportInfo[];
  intersectingGrids: ElevationGridDatum[];
  storeyElevations: ElevationStoreyDatum[];
  bayDimensions: ElevationBayDimension[];
  bounds: {
    minH: number;
    maxH: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
}

export class FrameElevationEngine {
  private static elevationCache = new WeakMap<
    NormalizedStructuralModel,
    Map<string, FrameElevationData>
  >();

  /**
   * Retrieves all available grid lines from the structural model (both along X and Z axes).
   * Extracts directly in O(N) without running heavy foundation or grade beam design engines.
   */
  public static getAvailableGrids(model: NormalizedStructuralModel | null): GridLineInfo[] {
    if (!model) return [];

    const colGridX: number[] = [];
    const colGridZ: number[] = [];

    // If custom grids exist, prioritize them
    if (model.customGrids?.x && model.customGrids.x.length > 0) {
      colGridX.push(...model.customGrids.x);
    }
    if (model.customGrids?.z && model.customGrids.z.length > 0) {
      colGridZ.push(...model.customGrids.z);
    }

    if (colGridX.length === 0 || colGridZ.length === 0) {
      // Collect column centers
      for (const m of model.members.values()) {
        if (m.classification === 'COLUMN') {
          const n1 = model.nodes.get(m.startNodeId);
          const n2 = model.nodes.get(m.endNodeId);
          if (n1) {
            const rx = parseFloat(n1.x.toFixed(2));
            const rz = parseFloat(n1.z.toFixed(2));
            if (!colGridX.some((x) => Math.abs(x - rx) < 0.45)) colGridX.push(rx);
            if (!colGridZ.some((z) => Math.abs(z - rz) < 0.45)) colGridZ.push(rz);
          }
          if (n2) {
            const rx = parseFloat(n2.x.toFixed(2));
            const rz = parseFloat(n2.z.toFixed(2));
            if (!colGridX.some((x) => Math.abs(x - rx) < 0.45)) colGridX.push(rx);
            if (!colGridZ.some((z) => Math.abs(z - rz) < 0.45)) colGridZ.push(rz);
          }
        }
      }

      // Collect ground support nodes
      for (const sup of model.supports.values()) {
        const node = model.nodes.get(sup.nodeId);
        if (node) {
          const rx = parseFloat(node.x.toFixed(2));
          const rz = parseFloat(node.z.toFixed(2));
          if (!colGridX.some((x) => Math.abs(x - rx) < 0.45)) colGridX.push(rx);
          if (!colGridZ.some((z) => Math.abs(z - rz) < 0.45)) colGridZ.push(rz);
        }
      }
    }

    colGridX.sort((a, b) => a - b);
    colGridZ.sort((a, b) => a - b);

    if (colGridX.length === 0) {
      const minX = model.boundingBox?.minX ?? 0;
      const maxX = model.boundingBox?.maxX ?? 8;
      colGridX.push(minX, maxX);
    }
    if (colGridZ.length === 0) {
      const minZ = model.boundingBox?.minZ ?? 0;
      const maxZ = model.boundingBox?.maxZ ?? 8;
      colGridZ.push(minZ, maxZ);
    }

    const xGrids: GridLineInfo[] = colGridX.map((x, i) => ({
      id: String(i + 1),
      axis: 'X',
      coord: x,
      label: `GRID ${i + 1}`,
    }));

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const zGrids: GridLineInfo[] = colGridZ.map((z, i) => ({
      id: letters[i % letters.length] || `Z${i + 1}`,
      axis: 'Z',
      coord: z,
      label: `GRID ${letters[i % letters.length] || `Z${i + 1}`}`,
    }));

    return [...xGrids, ...zGrids];
  }

  /**
   * Extracts the full 2D vertical frame geometry, members, datums, and force envelopes
   * along the specified grid line.
   */
  public static extractFrameElevation(
    model: NormalizedStructuralModel | null,
    targetGridIdOrLabel: string
  ): FrameElevationData | null {
    if (!model) return null;

    const availableGrids = this.getAvailableGrids(model);
    if (availableGrids.length === 0) return null;

    // Resolve target grid line
    const cleanTarget = targetGridIdOrLabel.trim().toUpperCase();
    let gridLine = availableGrids.find(
      (g) =>
        g.id.toUpperCase() === cleanTarget ||
        g.label.toUpperCase() === cleanTarget ||
        `${g.axis}-${g.id}`.toUpperCase() === cleanTarget
    );

    if (!gridLine) {
      // Default to first grid line
      gridLine = availableGrids[0];
    }

    let modelMap = FrameElevationEngine.elevationCache.get(model);
    if (!modelMap) {
      modelMap = new Map<string, FrameElevationData>();
      FrameElevationEngine.elevationCache.set(model, modelMap);
    }
    const cacheKey = `${gridLine.axis}_${gridLine.id}_${model.members.size}_${model.memberForces?.length || 0}`;
    const cached = modelMap.get(cacheKey);
    if (cached) return cached;

    const axis = gridLine.axis;
    const gridCoord = gridLine.coord;
    const TOLERANCE = 0.45; // meters

    // Pre-index member forces by memberId
    const forcesByMember = new Map<number, typeof model.memberForces>();
    if (model.memberForces) {
      for (let i = 0; i < model.memberForces.length; i++) {
        const mf = model.memberForces[i];
        let list = forcesByMember.get(mf.memberId);
        if (!list) {
          list = [];
          forcesByMember.set(mf.memberId, list);
        }
        list.push(mf);
      }
    }

    const columns: ElevationColumnInfo[] = [];
    const beams: ElevationBeamInfo[] = [];
    const supports: ElevationSupportInfo[] = [];

    // 1. Process Members
    let colIndex = 1;
    let beamIndex = 1;

    for (const mem of model.members.values()) {
      const n1 = model.nodes.get(mem.startNodeId);
      const n2 = model.nodes.get(mem.endNodeId);
      if (!n1 || !n2) continue;

      const isVertical =
        Math.abs(n1.y - n2.y) > 0.5 &&
        Math.abs(n1.x - n2.x) < 0.25 &&
        Math.abs(n1.z - n2.z) < 0.25;

      const isHorizontal = Math.abs(n1.y - n2.y) <= 0.35;

      if (axis === 'X') {
        // Frame lies in the Y-Z plane at X ≈ gridCoord.
        // Horizontal coordinate in elevation is Z.
        const onPlaneN1 = Math.abs(n1.x - gridCoord) <= TOLERANCE;
        const onPlaneN2 = Math.abs(n2.x - gridCoord) <= TOLERANCE;
        if (!onPlaneN1 || !onPlaneN2) continue;

        if (mem.classification === 'COLUMN' || isVertical) {
          const yBottom = Math.min(n1.y, n2.y);
          const yTop = Math.max(n1.y, n2.y);
          const h = (n1.z + n2.z) / 2;

          const forces = forcesByMember.get(mem.id);
          let maxM = 0;
          let topM = 0;
          let botM = 0;
          let maxV = 0;

          if (forces && forces.length > 0) {
            maxM = forces.reduce((max, f) => Math.max(max, Math.abs(f.mz || 0), Math.abs(f.my || 0)), 0);
            maxV = forces.reduce((max, f) => Math.max(max, Math.abs(f.vy || 0), Math.abs(f.vz || 0)), 0);
            topM = maxM * 0.85;
            botM = maxM;
          } else {
            const hStory = Math.max(1, yTop - yBottom);
            maxM = Math.max(12, 14 * hStory * 0.8);
            topM = maxM * 0.85;
            botM = maxM;
            maxV = (topM + botM) / hStory;
          }

          columns.push({
            memberId: mem.id,
            label: `C${colIndex++}`,
            nodeBottomId: n1.y <= n2.y ? n1.id : n2.id,
            nodeTopId: n1.y > n2.y ? n1.id : n2.id,
            h,
            yBottom,
            yTop,
            width: mem.section?.zd || 0.45,
            depth: mem.section?.yd || 0.45,
            sectionName: mem.section?.name || '450x450 RCC',
            maxMoment: maxM,
            topMoment: topM,
            botMoment: botM,
            maxShear: maxV,
          });
        } else if (mem.classification === 'BEAM' || isHorizontal) {
          const spanLength = Math.abs(n1.z - n2.z);
          if (spanLength < 0.3) continue; // Skip near-zero zero-length connectors

          const h1 = Math.min(n1.z, n2.z);
          const h2 = Math.max(n1.z, n2.z);
          const y = (n1.y + n2.y) / 2;

          const forces = forcesByMember.get(mem.id);
          let maxM = 0;
          let spanM = 0;
          let supM1 = 0;
          let supM2 = 0;
          let maxV = 0;

          if (forces && forces.length > 0) {
            maxM = forces.reduce((max, f) => Math.max(max, Math.abs(f.mz || 0)), 0);
            maxV = forces.reduce((max, f) => Math.max(max, Math.abs(f.vy || 0)), 0);
            spanM = maxM * 0.7;
            supM1 = maxM;
            supM2 = maxM * 0.95;
          } else {
            const wEst = 22.0; // kN/m standard gravity dead+live
            supM1 = (wEst * spanLength * spanLength) / 12;
            supM2 = supM1;
            spanM = (wEst * spanLength * spanLength) / 16;
            maxM = supM1;
            maxV = (wEst * spanLength) / 2;
          }

          beams.push({
            memberId: mem.id,
            label: `B${beamIndex++}`,
            nodeStartId: n1.z <= n2.z ? n1.id : n2.id,
            nodeEndId: n1.z > n2.z ? n1.id : n2.id,
            h1,
            h2,
            y,
            length: spanLength,
            width: mem.section?.zd || 0.3,
            depth: mem.section?.yd || 0.45,
            sectionName: mem.section?.name || '300x450 RCC',
            maxMoment: maxM,
            spanMoment: spanM,
            supMoment1: supM1,
            supMoment2: supM2,
            maxShear: maxV,
          });
        }
      } else {
        // Frame lies in the X-Y plane at Z ≈ gridCoord.
        // Horizontal coordinate in elevation is X.
        const onPlaneN1 = Math.abs(n1.z - gridCoord) <= TOLERANCE;
        const onPlaneN2 = Math.abs(n2.z - gridCoord) <= TOLERANCE;
        if (!onPlaneN1 || !onPlaneN2) continue;

        if (mem.classification === 'COLUMN' || isVertical) {
          const yBottom = Math.min(n1.y, n2.y);
          const yTop = Math.max(n1.y, n2.y);
          const h = (n1.x + n2.x) / 2;

          const forces = forcesByMember.get(mem.id);
          let maxM = 0;
          let topM = 0;
          let botM = 0;
          let maxV = 0;

          if (forces && forces.length > 0) {
            maxM = forces.reduce((max, f) => Math.max(max, Math.abs(f.mz || 0), Math.abs(f.my || 0)), 0);
            maxV = forces.reduce((max, f) => Math.max(max, Math.abs(f.vy || 0), Math.abs(f.vz || 0)), 0);
            topM = maxM * 0.85;
            botM = maxM;
          } else {
            const hStory = Math.max(1, yTop - yBottom);
            maxM = Math.max(12, 14 * hStory * 0.8);
            topM = maxM * 0.85;
            botM = maxM;
            maxV = (topM + botM) / hStory;
          }

          columns.push({
            memberId: mem.id,
            label: `C${colIndex++}`,
            nodeBottomId: n1.y <= n2.y ? n1.id : n2.id,
            nodeTopId: n1.y > n2.y ? n1.id : n2.id,
            h,
            yBottom,
            yTop,
            width: mem.section?.zd || 0.45,
            depth: mem.section?.yd || 0.45,
            sectionName: mem.section?.name || '450x450 RCC',
            maxMoment: maxM,
            topMoment: topM,
            botMoment: botM,
            maxShear: maxV,
          });
        } else if (mem.classification === 'BEAM' || isHorizontal) {
          const spanLength = Math.abs(n1.x - n2.x);
          if (spanLength < 0.3) continue;

          const h1 = Math.min(n1.x, n2.x);
          const h2 = Math.max(n1.x, n2.x);
          const y = (n1.y + n2.y) / 2;

          const forces = forcesByMember.get(mem.id);
          let maxM = 0;
          let spanM = 0;
          let supM1 = 0;
          let supM2 = 0;
          let maxV = 0;

          if (forces && forces.length > 0) {
            maxM = forces.reduce((max, f) => Math.max(max, Math.abs(f.mz || 0)), 0);
            maxV = forces.reduce((max, f) => Math.max(max, Math.abs(f.vy || 0)), 0);
            spanM = maxM * 0.7;
            supM1 = maxM;
            supM2 = maxM * 0.95;
          } else {
            const wEst = 22.0;
            supM1 = (wEst * spanLength * spanLength) / 12;
            supM2 = supM1;
            spanM = (wEst * spanLength * spanLength) / 16;
            maxM = supM1;
            maxV = (wEst * spanLength) / 2;
          }

          beams.push({
            memberId: mem.id,
            label: `B${beamIndex++}`,
            nodeStartId: n1.x <= n2.x ? n1.id : n2.id,
            nodeEndId: n1.x > n2.x ? n1.id : n2.id,
            h1,
            h2,
            y,
            length: spanLength,
            width: mem.section?.zd || 0.3,
            depth: mem.section?.yd || 0.45,
            sectionName: mem.section?.name || '300x450 RCC',
            maxMoment: maxM,
            spanMoment: spanM,
            supMoment1: supM1,
            supMoment2: supM2,
            maxShear: maxV,
          });
        }
      }
    }

    // 2. Process Supports
    for (const sup of model.supports.values()) {
      const node = model.nodes.get(sup.nodeId);
      if (!node) continue;

      const onPlane =
        axis === 'X'
          ? Math.abs(node.x - gridCoord) <= TOLERANCE
          : Math.abs(node.z - gridCoord) <= TOLERANCE;

      if (onPlane) {
        supports.push({
          nodeId: sup.nodeId,
          h: axis === 'X' ? node.z : node.x,
          y: node.y,
          type: sup.type === 'FIXED' ? 'FIXED' : 'PINNED',
        });
      }
    }

    // 3. Intersecting Grids (perpendicular grids that intersect this vertical frame)
    const intersectingGrids: ElevationGridDatum[] = [];
    const oppAxis = axis === 'X' ? 'Z' : 'X';
    const oppGrids = availableGrids.filter((g) => g.axis === oppAxis);

    for (const og of oppGrids) {
      intersectingGrids.push({
        id: og.id,
        label: og.label.replace(/^GRID\s+/i, ''),
        coord: og.coord,
      });
    }
    intersectingGrids.sort((a, b) => a.coord - b.coord);

    // 4. Storey Elevation Datum Levels
    const yLevelsSet = new Set<number>();
    yLevelsSet.add(0.0);
    columns.forEach((c) => {
      yLevelsSet.add(parseFloat(c.yBottom.toFixed(2)));
      yLevelsSet.add(parseFloat(c.yTop.toFixed(2)));
    });
    beams.forEach((b) => {
      yLevelsSet.add(parseFloat(b.y.toFixed(2)));
    });

    const sortedY = Array.from(yLevelsSet).sort((a, b) => a - b);
    const storeyElevations: ElevationStoreyDatum[] = sortedY.map((y, idx) => {
      let label = idx === 0 ? 'BASE / PLINTH' : idx === sortedY.length - 1 ? 'ROOF' : `STORY ${idx}`;
      return { label, y };
    });

    // 5. Inter-Grid Bay Dimensions
    const bayDimensions: ElevationBayDimension[] = [];
    for (let i = 0; i < intersectingGrids.length - 1; i++) {
      const g1 = intersectingGrids[i];
      const g2 = intersectingGrids[i + 1];
      const span = Math.abs(g2.coord - g1.coord);
      if (span > 0.1) {
        bayDimensions.push({
          startH: Math.min(g1.coord, g2.coord),
          endH: Math.max(g1.coord, g2.coord),
          spanM: span,
          label: `${span.toFixed(2)}m`,
        });
      }
    }

    // 6. Geometry Bounds
    let minH = Number.POSITIVE_INFINITY;
    let maxH = Number.NEGATIVE_INFINITY;
    let minY = 0;
    let maxY = 3.2;

    columns.forEach((c) => {
      minH = Math.min(minH, c.h);
      maxH = Math.max(maxH, c.h);
      minY = Math.min(minY, c.yBottom);
      maxY = Math.max(maxY, c.yTop);
    });

    beams.forEach((b) => {
      minH = Math.min(minH, b.h1, b.h2);
      maxH = Math.max(maxH, b.h1, b.h2);
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y);
    });

    intersectingGrids.forEach((g) => {
      minH = Math.min(minH, g.coord);
      maxH = Math.max(maxH, g.coord);
    });

    if (!Number.isFinite(minH) || !Number.isFinite(maxH)) {
      minH = 0;
      maxH = 8;
    }
    if (maxH - minH < 1) maxH = minH + 6;
    if (maxY - minY < 1) maxY = minY + 3.2;

    const result: FrameElevationData = {
      gridLine,
      axis,
      columns,
      beams,
      supports,
      intersectingGrids,
      storeyElevations,
      bayDimensions,
      bounds: {
        minH,
        maxH,
        minY,
        maxY,
        width: Math.max(2, maxH - minH),
        height: Math.max(2, maxY - minY),
      },
    };

    modelMap.set(cacheKey, result);
    return result;
  }
}
