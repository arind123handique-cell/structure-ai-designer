/**
 * Parametric Architectural Door Engine (Wall-Hosted)
 */

import {
  ArchitecturalDoor,
  ArchitecturalWall,
  DoorSwingDirection,
  DoorType,
  Point2D,
} from '../types/architecturalTypes';
import { ArchitecturalGeometryEngine } from './architecturalGeometryEngine';
import { ArchitecturalIdGenerator } from '../utils/idGenerator';

export interface DoorCreationParams {
  id?: string;
  floorId: string;
  hostWallId: string;
  position: number; // distance from host wall start in meters
  width?: number; // door width in meters
  height?: number; // door height in meters
  doorType?: DoorType;
  swingDirection?: DoorSwingDirection;
  sillHeight?: number;
}

export class DoorEngine {
  /**
   * Create a new wall-hosted door
   */
  public static createDoor(
    hostWallOrParams: ArchitecturalWall | DoorCreationParams,
    clickPointOrFloorId?: Point2D | string,
    floorIdOrExistingIds?: string | string[],
    existingDoorIds: string[] = [],
    width = 0.9,
    height = 2.1,
    doorType: DoorType = 'SINGLE_SWING',
    swingDirection: DoorSwingDirection = 'RIGHT',
    sillHeight = 0
  ): ArchitecturalDoor {
    if ('hostWallId' in hostWallOrParams && 'position' in hostWallOrParams) {
      // Called with params object
      const params = hostWallOrParams as DoorCreationParams;
      const ids = (floorIdOrExistingIds as string[]) || [];
      const id = params.id || ArchitecturalIdGenerator.generateDoorId(ids);

      return {
        id,
        floorId: params.floorId,
        hostWallId: params.hostWallId,
        position: params.position,
        width: params.width || 0.9,
        height: params.height || 2.1,
        doorType: params.doorType || 'SINGLE_SWING',
        swingDirection: params.swingDirection || 'RIGHT',
        sillHeight: params.sillHeight || 0,
      };
    } else {
      // Called with (hostWall, clickPoint, floorId, existingDoorIds, width, height...)
      const hostWall = hostWallOrParams as ArchitecturalWall;
      const clickPoint = clickPointOrFloorId as Point2D;
      const fId = (typeof floorIdOrExistingIds === 'string' ? floorIdOrExistingIds : hostWall.floorId) || 'floor_0';
      const wallLen = ArchitecturalGeometryEngine.distance(hostWall.start, hostWall.end);
      const proj = ArchitecturalGeometryEngine.projectPointToSegment(
        clickPoint,
        hostWall.start,
        hostWall.end
      );

      // Clamp position so opening does not extend beyond wall endpoints
      const halfW = width / 2;
      const clampedPosition = Math.max(halfW, Math.min(wallLen - halfW, proj.t * wallLen));
      const id = ArchitecturalIdGenerator.generateDoorId(existingDoorIds);

      return {
        id,
        floorId: fId,
        hostWallId: hostWall.id,
        position: clampedPosition,
        width,
        height,
        doorType,
        swingDirection,
        sillHeight,
      };
    }
  }

  /**
   * Calculate 2D center point of the door in plan coordinates
   */
  public static getDoorCenter(wall: ArchitecturalWall, door: ArchitecturalDoor): Point2D {
    const wallLen = ArchitecturalGeometryEngine.distance(wall.start, wall.end);
    if (wallLen < 1e-4) return { ...wall.start };

    const t = Math.max(0, Math.min(1, door.position / wallLen));
    return {
      x: wall.start.x + t * (wall.end.x - wall.start.x),
      y: wall.start.y + t * (wall.end.y - wall.start.y),
    };
  }

  /**
   * Calculate 2D opening line segment (cutout in the host wall)
   */
  public static getDoorOpeningSegment(
    wall: ArchitecturalWall,
    door: ArchitecturalDoor
  ): { start: Point2D; end: Point2D } {
    const wallLen = ArchitecturalGeometryEngine.distance(wall.start, wall.end);
    if (wallLen < 1e-4) return { start: { ...wall.start }, end: { ...wall.end } };

    const halfW = door.width / 2;
    const t1 = Math.max(0, (door.position - halfW) / wallLen);
    const t2 = Math.min(1, (door.position + halfW) / wallLen);

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;

    return {
      start: { x: wall.start.x + t1 * dx, y: wall.start.y + t1 * dy },
      end: { x: wall.start.x + t2 * dx, y: wall.start.y + t2 * dy },
    };
  }

  /**
   * Flip door swing direction (Left <-> Right)
   */
  public static flipSwing(door: ArchitecturalDoor): ArchitecturalDoor {
    return {
      ...door,
      swingDirection: door.swingDirection === 'LEFT' ? 'RIGHT' : 'LEFT',
    };
  }
}
