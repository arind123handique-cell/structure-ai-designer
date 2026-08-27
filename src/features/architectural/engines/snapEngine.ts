/**
 * Professional CAD/BIM Snapping Engine
 */

import {
  Point2D,
  SnapResult,
  SnapSettings,
  GridSettings,
  ArchitecturalWall,
} from '../types/architecturalTypes';
import { ArchitecturalGeometryEngine } from './architecturalGeometryEngine';
import { NormalizedStructuralModel } from '@/features/model/types';
import { FloorPlanLevel } from '@/features/drawings/floorPlanEngine';

export class SnapEngine {
  /**
   * Finds the best snap point given a raw cursor location in plan coordinates
   */
  public static findSnapPoint(
    rawPoint: Point2D,
    walls: ArchitecturalWall[],
    settings: SnapSettings,
    activeFloorPlan: FloorPlanLevel | null,
    model: NormalizedStructuralModel | null = null,
    ignoredWallId?: string
  ): SnapResult {
    if (!settings.enabled) {
      return { point: rawPoint, type: 'NONE' };
    }

    const snapTolerance = settings.tolerance || 0.25; // meters
    let bestSnap: SnapResult = { point: rawPoint, type: 'NONE' };
    let minDistance = snapTolerance;
    let isPointSnap = false;

    // 1. Structural Column Centers and Column Faces (High Priority Point Snap)
    if (activeFloorPlan && activeFloorPlan.columns) {
      for (const col of activeFloorPlan.columns) {
        // Column center
        if (settings.columnCenter) {
          const colCenter: Point2D = { x: col.x, y: col.z };
          const dist = ArchitecturalGeometryEngine.distance(rawPoint, colCenter);
          if (dist < minDistance) {
            minDistance = dist;
            isPointSnap = true;
            bestSnap = {
              point: colCenter,
              type: 'COLUMN_CENTER',
              targetId: col.columnSlNo,
              description: `Column ${col.label || 'C'} Center`,
            };
          }
        }

        // Column corner / face points
        if (settings.columnFace) {
          const halfW = (col.width || 0.45) / 2;
          const halfD = (col.depth || 0.55) / 2;
          const corners: Point2D[] = [
            { x: col.x - halfW, y: col.z - halfD },
            { x: col.x + halfW, y: col.z - halfD },
            { x: col.x + halfW, y: col.z + halfD },
            { x: col.x - halfW, y: col.z + halfD },
          ];
          for (const corner of corners) {
            const dist = ArchitecturalGeometryEngine.distance(rawPoint, corner);
            if (dist < minDistance) {
              minDistance = dist;
              isPointSnap = true;
              bestSnap = {
                point: corner,
                type: 'COLUMN_FACE',
                targetId: col.columnSlNo,
                description: `Column ${col.label || 'C'} Face`,
              };
            }
          }
        }
      }
    }

    // 2. Wall Endpoints and Midpoints (High Priority Point Snap)
    for (const wall of walls) {
      if (ignoredWallId && wall.id === ignoredWallId) continue;

      // Endpoints
      if (settings.endpoint) {
        const distStart = ArchitecturalGeometryEngine.distance(rawPoint, wall.start);
        if (distStart < minDistance) {
          minDistance = distStart;
          isPointSnap = true;
          bestSnap = {
            point: { ...wall.start },
            type: 'ENDPOINT',
            targetId: wall.id,
            targetElementId: wall.id,
            description: `Wall ${wall.id} Endpoint`,
          };
        }

        const distEnd = ArchitecturalGeometryEngine.distance(rawPoint, wall.end);
        if (distEnd < minDistance) {
          minDistance = distEnd;
          isPointSnap = true;
          bestSnap = {
            point: { ...wall.end },
            type: 'ENDPOINT',
            targetId: wall.id,
            targetElementId: wall.id,
            description: `Wall ${wall.id} Endpoint`,
          };
        }
      }

      // Midpoint
      if (settings.midpoint) {
        const mid: Point2D = {
          x: (wall.start.x + wall.end.x) / 2,
          y: (wall.start.y + wall.end.y) / 2,
        };
        const distMid = ArchitecturalGeometryEngine.distance(rawPoint, mid);
        if (distMid < minDistance) {
          minDistance = distMid;
          isPointSnap = true;
          bestSnap = {
            point: mid,
            type: 'MIDPOINT',
            targetId: wall.id,
            targetElementId: wall.id,
            description: `Wall ${wall.id} Midpoint`,
          };
        }
      }
    }

    // 3. Wall-to-Wall Intersections (Point Snap)
    if (settings.intersection && walls.length >= 2) {
      for (let i = 0; i < walls.length; i++) {
        for (let j = i + 1; j < walls.length; j++) {
          const w1 = walls[i];
          const w2 = walls[j];
          const inter = ArchitecturalGeometryEngine.lineIntersection(w1.start, w1.end, w2.start, w2.end);
          if (inter) {
            const dist = ArchitecturalGeometryEngine.distance(rawPoint, inter);
            if (dist < minDistance) {
              minDistance = dist;
              isPointSnap = true;
              bestSnap = {
                point: inter,
                type: 'INTERSECTION',
                targetId: `${w1.id}-${w2.id}`,
                targetElementId: w1.id,
                description: `Intersection ${w1.id} & ${w2.id}`,
              };
            }
          }
        }
      }
    }

    // 4. Structural Beam Endpoints and Beam Centerlines (Line Projection only if no close point snap)
    if (activeFloorPlan && activeFloorPlan.beams && settings.beamCenterline) {
      for (const beam of activeFloorPlan.beams) {
        const startPt: Point2D = { x: beam.startX, y: beam.startZ };
        const endPt: Point2D = { x: beam.endX, y: beam.endZ };

        // Beam Start & End
        const distStart = ArchitecturalGeometryEngine.distance(rawPoint, startPt);
        if (distStart < minDistance) {
          minDistance = distStart;
          isPointSnap = true;
          bestSnap = {
            point: startPt,
            type: 'BEAM_CENTERLINE',
            targetId: beam.memberId,
            description: `Beam ${beam.label || 'B'} Node`,
          };
        }

        const distEnd = ArchitecturalGeometryEngine.distance(rawPoint, endPt);
        if (distEnd < minDistance) {
          minDistance = distEnd;
          isPointSnap = true;
          bestSnap = {
            point: endPt,
            type: 'BEAM_CENTERLINE',
            targetId: beam.memberId,
            description: `Beam ${beam.label || 'B'} Node`,
          };
        }

        // Beam Centerline Projection (Only if not already snapped to a discrete point within tolerance)
        if (!isPointSnap) {
          const proj = ArchitecturalGeometryEngine.projectPointToSegment(rawPoint, startPt, endPt);
          if (proj.distance < minDistance) {
            minDistance = proj.distance;
            bestSnap = {
              point: proj.point,
              type: 'BEAM_CENTERLINE',
              targetId: beam.memberId,
              description: `Beam ${beam.label || 'B'} Centerline`,
            };
          }
        }
      }
    }

    // 5. Wall Centerline Projection (Only if not snapped to a discrete point)
    if (!isPointSnap && settings.nearest) {
      for (const wall of walls) {
        if (ignoredWallId && wall.id === ignoredWallId) continue;
        const proj = ArchitecturalGeometryEngine.projectPointToSegment(rawPoint, wall.start, wall.end);
        if (proj.distance < minDistance) {
          minDistance = proj.distance;
          bestSnap = {
            point: proj.point,
            type: 'WALL_CENTERLINE',
            targetId: wall.id,
            targetElementId: wall.id,
            description: `Wall ${wall.id} Line`,
          };
        }
      }
    }

    return bestSnap;
  }

  public static findBestSnapPoint(
    rawPoint: Point2D,
    walls: ArchitecturalWall[],
    activeFloorPlan: FloorPlanLevel | null,
    settings: SnapSettings,
    gridSettings?: GridSettings,
    model: NormalizedStructuralModel | null = null
  ): SnapResult {
    const snap = this.findSnapPoint(rawPoint, walls, settings, activeFloorPlan, model);
    if (snap.type !== 'NONE') return snap;

    // Optional Grid Snapping fallback
    if (settings.grid && gridSettings?.enabled && gridSettings.spacing) {
      const spacing = gridSettings.spacing;
      const snapX = Math.round(rawPoint.x / spacing) * spacing;
      const snapY = Math.round(rawPoint.y / spacing) * spacing;
      const gridPt = { x: parseFloat(snapX.toFixed(3)), y: parseFloat(snapY.toFixed(3)) };
      const dist = ArchitecturalGeometryEngine.distance(rawPoint, gridPt);

      if (dist < (settings.tolerance || 0.25)) {
        return {
          point: gridPt,
          type: 'GRID',
          description: `Grid (${gridPt.x.toFixed(2)}m, ${gridPt.y.toFixed(2)}m)`,
        };
      }
    }

    return { point: rawPoint, type: 'NONE', description: '' };
  }
}
