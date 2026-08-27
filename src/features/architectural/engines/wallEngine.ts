/**
 * Parametric Architectural Wall Modeling and Mutation Engine
 */

import {
  ArchitecturalWall,
  Point2D,
  WallReferenceLine,
  WallType,
} from '../types/architecturalTypes';
import { ArchitecturalGeometryEngine } from './architecturalGeometryEngine';
import { ArchitecturalIdGenerator } from '../utils/idGenerator';

export interface WallCreationParams {
  id?: string;
  floorId: string;
  start: Point2D;
  end: Point2D;
  thickness?: number;
  height?: number;
  wallType?: WallType;
  referenceLine?: WallReferenceLine;
  baseElevation?: number;
  topElevation?: number;
}

export interface WallValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class WallEngine {
  /**
   * Create a new parametric wall supporting both parameter object and positional arguments
   */
  public static createWall(
    startOrParams: Point2D | WallCreationParams,
    endOrIds?: Point2D | string[],
    floorId?: string,
    existingWallIds: string[] = [],
    thickness = 0.23,
    height = 3.2,
    wallType: WallType = 'EXTERNAL'
  ): ArchitecturalWall {
    if ('start' in startOrParams && 'end' in startOrParams && 'floorId' in startOrParams) {
      // Called with WallCreationParams object
      const params = startOrParams as WallCreationParams;
      const ids = (endOrIds as string[]) || [];
      const wType = params.wallType || 'EXTERNAL';
      const defaultThickness = wType === 'INTERNAL' ? 0.115 : 0.23;
      const thk = params.thickness !== undefined ? params.thickness : defaultThickness;
      const h = params.height !== undefined ? params.height : 3.2;
      const baseElev = params.baseElevation !== undefined ? params.baseElevation : 0;
      const topElev = params.topElevation !== undefined ? params.topElevation : baseElev + h;
      const id = params.id || ArchitecturalIdGenerator.generateWallId(ids);

      return {
        id,
        floorId: params.floorId,
        start: { ...params.start },
        end: { ...params.end },
        thickness: thk,
        height: h,
        baseElevation: baseElev,
        topElevation: topElev,
        wallType: wType,
        referenceLine: params.referenceLine || 'CENTERLINE',
      };
    } else {
      // Positional arguments
      const start = startOrParams as Point2D;
      const end = endOrIds as Point2D;
      const fId = floorId || 'floor_0';
      const id = ArchitecturalIdGenerator.generateWallId(existingWallIds);

      return {
        id,
        floorId: fId,
        start: { ...start },
        end: { ...end },
        thickness,
        height,
        baseElevation: 0,
        topElevation: height,
        wallType,
        referenceLine: 'CENTERLINE',
      };
    }
  }

  /**
   * Calculate 4-point outline polygon of the wall
   */
  public static getWallOutline(wall: ArchitecturalWall): Point2D[] {
    return ArchitecturalGeometryEngine.getWallPolygon(
      wall.start,
      wall.end,
      wall.thickness,
      wall.referenceLine
    );
  }

  /**
   * Split a wall at a given point into two distinct continuous wall segments
   */
  public static splitWall(
    wall: ArchitecturalWall,
    splitPoint: Point2D,
    existingWallIds: string[] = []
  ): { wall1: ArchitecturalWall; wall2: ArchitecturalWall } | null {
    const proj = ArchitecturalGeometryEngine.projectPointToSegment(
      splitPoint,
      wall.start,
      wall.end
    );

    // Split point must be strictly inside the segment (t between 0.05 and 0.95)
    if (proj.t < 0.05 || proj.t > 0.95) {
      return null;
    }

    const midPt = proj.point;

    const wall1: ArchitecturalWall = {
      ...wall,
      end: { ...midPt },
    };

    const nextId = ArchitecturalIdGenerator.generateWallId([
      ...existingWallIds,
      wall.id,
    ]);

    const wall2: ArchitecturalWall = {
      ...wall,
      id: nextId,
      start: { ...midPt },
      end: { ...wall.end },
    };

    return { wall1, wall2 };
  }

  /**
   * Create a parallel offset wall
   */
  public static offsetWall(
    wall: ArchitecturalWall,
    offsetDistance: number,
    existingWallIds: string[] = []
  ): ArchitecturalWall {
    const offsetLine = ArchitecturalGeometryEngine.offsetLine(
      wall.start,
      wall.end,
      offsetDistance
    );
    const newId = ArchitecturalIdGenerator.generateWallId([
      ...existingWallIds,
      wall.id,
    ]);

    return {
      ...wall,
      id: newId,
      start: offsetLine.start,
      end: offsetLine.end,
    };
  }

  /**
   * Validate wall geometry parameters
   */
  public static validateWall(wall: ArchitecturalWall): WallValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const length = ArchitecturalGeometryEngine.distance(wall.start, wall.end);
    if (length < 0.1) {
      errors.push(`Wall length (${(length * 1000).toFixed(0)}mm) is below minimum threshold (100mm)`);
    }

    if (wall.thickness <= 0.02) {
      errors.push(`Wall thickness (${(wall.thickness * 1000).toFixed(0)}mm) is invalid`);
    } else if (wall.thickness > 1.5) {
      warnings.push(`Wall thickness (${(wall.thickness * 1000).toFixed(0)}mm) is unusually large`);
    }

    if (wall.height <= 0.5) {
      errors.push(`Wall height (${wall.height.toFixed(2)}m) is invalid`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
