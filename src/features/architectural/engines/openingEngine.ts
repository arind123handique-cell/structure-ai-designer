/**
 * Parametric Architectural Wall Opening Engine (Passages, Archways, Shafts)
 */

import {
  ArchitecturalOpening,
  ArchitecturalWall,
  OpeningType,
  Point2D,
} from '../types/architecturalTypes';
import { ArchitecturalGeometryEngine } from './architecturalGeometryEngine';
import { ArchitecturalIdGenerator } from '../utils/idGenerator';

export interface OpeningCreationParams {
  id?: string;
  floorId: string;
  hostWallId: string;
  position: number;
  width?: number;
  height?: number;
  sillHeight?: number;
  openingType?: OpeningType;
}

export class OpeningEngine {
  /**
   * Create a new wall-hosted opening
   */
  public static createOpening(
    hostWallOrParams: ArchitecturalWall | OpeningCreationParams,
    clickPointOrFloorId?: Point2D | string,
    floorIdOrExistingIds?: string | string[],
    existingOpIds: string[] = [],
    width = 1.0,
    height = 2.1,
    sillHeight = 0,
    openingType: OpeningType = 'PASSAGE'
  ): ArchitecturalOpening {
    if ('hostWallId' in hostWallOrParams && 'position' in hostWallOrParams) {
      const params = hostWallOrParams as OpeningCreationParams;
      const ids = (floorIdOrExistingIds as string[]) || [];
      const id = params.id || ArchitecturalIdGenerator.generateOpeningId(ids);

      return {
        id,
        floorId: params.floorId,
        hostWallId: params.hostWallId,
        position: params.position,
        width: params.width || 1.0,
        height: params.height || 2.1,
        sillHeight: params.sillHeight || 0,
        openingType: params.openingType || 'PASSAGE',
      };
    } else {
      const hostWall = hostWallOrParams as ArchitecturalWall;
      const clickPoint = clickPointOrFloorId as Point2D;
      const fId = (typeof floorIdOrExistingIds === 'string' ? floorIdOrExistingIds : hostWall.floorId) || 'floor_0';
      const wallLen = ArchitecturalGeometryEngine.distance(hostWall.start, hostWall.end);
      const proj = ArchitecturalGeometryEngine.projectPointToSegment(
        clickPoint,
        hostWall.start,
        hostWall.end
      );

      const halfW = width / 2;
      const clampedPosition = Math.max(halfW, Math.min(wallLen - halfW, proj.t * wallLen));
      const id = ArchitecturalIdGenerator.generateOpeningId(existingOpIds);

      return {
        id,
        floorId: fId,
        hostWallId: hostWall.id,
        position: clampedPosition,
        width,
        height,
        sillHeight,
        openingType,
      };
    }
  }

  /**
   * Calculate 2D center point of opening in plan coordinates
   */
  public static getOpeningCenter(wall: ArchitecturalWall, op: ArchitecturalOpening): Point2D {
    const wallLen = ArchitecturalGeometryEngine.distance(wall.start, wall.end);
    if (wallLen < 1e-4) return { ...wall.start };

    const t = Math.max(0, Math.min(1, op.position / wallLen));
    return {
      x: wall.start.x + t * (wall.end.x - wall.start.x),
      y: wall.start.y + t * (wall.end.y - wall.start.y),
    };
  }

  /**
   * Calculate 2D opening line segment
   */
  public static getOpeningSegment(
    wall: ArchitecturalWall,
    op: ArchitecturalOpening
  ): { start: Point2D; end: Point2D } {
    const wallLen = ArchitecturalGeometryEngine.distance(wall.start, wall.end);
    if (wallLen < 1e-4) return { start: { ...wall.start }, end: { ...wall.end } };

    const halfW = op.width / 2;
    const t1 = Math.max(0, (op.position - halfW) / wallLen);
    const t2 = Math.min(1, (op.position + halfW) / wallLen);

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;

    return {
      start: { x: wall.start.x + t1 * dx, y: wall.start.y + t1 * dy },
      end: { x: wall.start.x + t2 * dx, y: wall.start.y + t2 * dy },
    };
  }
}
