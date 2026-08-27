/**
 * Parametric Architectural Window Engine (Wall-Hosted)
 */

import {
  ArchitecturalWindow,
  ArchitecturalWall,
  WindowType,
  Point2D,
} from '../types/architecturalTypes';
import { ArchitecturalGeometryEngine } from './architecturalGeometryEngine';
import { ArchitecturalIdGenerator } from '../utils/idGenerator';

export interface WindowCreationParams {
  id?: string;
  floorId: string;
  hostWallId: string;
  position: number; // distance from host wall start in meters
  width?: number; // window width in meters
  height?: number; // window height in meters
  sillHeight?: number; // sill elevation above floor level in meters
  windowType?: WindowType;
}

export class WindowEngine {
  /**
   * Create a new wall-hosted window
   */
  public static createWindow(
    hostWallOrParams: ArchitecturalWall | WindowCreationParams,
    clickPointOrFloorId?: Point2D | string,
    floorIdOrExistingIds?: string | string[],
    existingWinIds: string[] = [],
    width = 1.2,
    height = 1.2,
    sillHeight = 0.9,
    windowType: WindowType = 'CASEMENT'
  ): ArchitecturalWindow {
    if ('hostWallId' in hostWallOrParams && 'position' in hostWallOrParams) {
      // Params object
      const params = hostWallOrParams as WindowCreationParams;
      const ids = (floorIdOrExistingIds as string[]) || [];
      const id = params.id || ArchitecturalIdGenerator.generateWindowId(ids);

      return {
        id,
        floorId: params.floorId,
        hostWallId: params.hostWallId,
        position: params.position,
        width: params.width || 1.2,
        height: params.height || 1.2,
        sillHeight: params.sillHeight !== undefined ? params.sillHeight : 0.9,
        windowType: params.windowType || 'CASEMENT',
      };
    } else {
      // Positional args
      const hostWall = hostWallOrParams as ArchitecturalWall;
      const clickPoint = clickPointOrFloorId as Point2D;
      const fId = (typeof floorIdOrExistingIds === 'string' ? floorIdOrExistingIds : hostWall.floorId) || 'floor_0';
      const wallLen = ArchitecturalGeometryEngine.distance(hostWall.start, hostWall.end);
      const proj = ArchitecturalGeometryEngine.projectPointToSegment(
        clickPoint,
        hostWall.start,
        hostWall.end
      );

      // Clamp position
      const halfW = width / 2;
      const clampedPosition = Math.max(halfW, Math.min(wallLen - halfW, proj.t * wallLen));
      const id = ArchitecturalIdGenerator.generateWindowId(existingWinIds);

      return {
        id,
        floorId: fId,
        hostWallId: hostWall.id,
        position: clampedPosition,
        width,
        height,
        sillHeight,
        windowType,
      };
    }
  }

  /**
   * Calculate 2D center point of the window in plan coordinates
   */
  public static getWindowCenter(wall: ArchitecturalWall, win: ArchitecturalWindow): Point2D {
    const wallLen = ArchitecturalGeometryEngine.distance(wall.start, wall.end);
    if (wallLen < 1e-4) return { ...wall.start };

    const t = Math.max(0, Math.min(1, win.position / wallLen));
    return {
      x: wall.start.x + t * (wall.end.x - wall.start.x),
      y: wall.start.y + t * (wall.end.y - wall.start.y),
    };
  }

  /**
   * Calculate 2D opening line segment (cutout in the host wall)
   */
  public static getWindowOpeningSegment(
    wall: ArchitecturalWall,
    win: ArchitecturalWindow
  ): { start: Point2D; end: Point2D } {
    const wallLen = ArchitecturalGeometryEngine.distance(wall.start, wall.end);
    if (wallLen < 1e-4) return { start: { ...wall.start }, end: { ...wall.end } };

    const halfW = win.width / 2;
    const t1 = Math.max(0, (win.position - halfW) / wallLen);
    const t2 = Math.min(1, (win.position + halfW) / wallLen);

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;

    return {
      start: { x: wall.start.x + t1 * dx, y: wall.start.y + t1 * dy },
      end: { x: wall.start.x + t2 * dx, y: wall.start.y + t2 * dy },
    };
  }
}
