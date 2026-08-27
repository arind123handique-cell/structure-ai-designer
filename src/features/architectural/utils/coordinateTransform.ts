/**
 * Coordinate Transformation and Engineering Measurement Utilities
 */

import { Point2D } from '../types/architecturalTypes';

export interface ViewportTransform {
  zoom: number;
  panX: number; // in pixels
  panY: number; // in pixels
}

export class CoordinateTransform {
  /**
   * Converts 3D Structural World Coordinate (x, y=elevation, z) to 2D Plan (x, y)
   * Plan X = World X (meters)
   * Plan Y = World Z (meters)
   */
  public static worldToPlan(worldX: number, worldZ: number): Point2D {
    return { x: worldX, y: worldZ };
  }

  public static world3DToPlan2D(world3D: { x: number; y: number; z: number }): Point2D {
    return { x: world3D.x, y: world3D.z };
  }

  /**
   * Converts 2D Plan Coordinate (x, y) + elevation (yElev) to 3D World (x, y, z)
   */
  public static planToWorld(plan: Point2D, elevationY: number = 0): { x: number; y: number; z: number } {
    return {
      x: plan.x,
      y: elevationY,
      z: plan.y,
    };
  }

  public static plan2DToWorld3D(plan: Point2D, elevationY: number = 0): { x: number; y: number; z: number } {
    return {
      x: plan.x,
      y: elevationY,
      z: plan.y,
    };
  }

  /**
   * Direct screen transform with panX, panY, and zoom
   */
  public static world2DToScreen(worldPt: Point2D, panX: number, panY: number, zoom: number): { x: number; y: number } {
    return {
      x: panX + worldPt.x * zoom,
      y: panY - worldPt.y * zoom, // Canvas Y is inverted
    };
  }

  public static screenToWorld2D(screenPt: { x: number; y: number }, panX: number, panY: number, zoom: number): Point2D {
    return {
      x: (screenPt.x - panX) / zoom,
      y: (panY - screenPt.y) / zoom,
    };
  }

  /**
   * Converts 2D Plan World Meters to Screen Canvas Pixels (ViewportTransform)
   */
  public static planToScreen(
    plan: Point2D,
    transform: ViewportTransform,
    canvasCenter: { width: number; height: number }
  ): { x: number; y: number } {
    const scale = transform.zoom;
    return {
      x: canvasCenter.width / 2 + transform.panX + plan.x * scale,
      y: canvasCenter.height / 2 + transform.panY - plan.y * scale,
    };
  }

  /**
   * Converts Screen Canvas Pixels to 2D Plan World Meters (ViewportTransform)
   */
  public static screenToPlan(
    screenX: number,
    screenY: number,
    transform: ViewportTransform,
    canvasCenter: { width: number; height: number }
  ): Point2D {
    const scale = transform.zoom;
    return {
      x: (screenX - canvasCenter.width / 2 - transform.panX) / scale,
      y: (canvasCenter.height / 2 + transform.panY - screenY) / scale,
    };
  }

  /**
   * Format engineering length in millimeters or meters
   */
  public static formatLength(meters: number, preferMm: boolean = true): string {
    if (preferMm) {
      return `${Math.round(meters * 1000)} mm`;
    }
    return `${meters.toFixed(2)} m`;
  }

  /**
   * Format engineering area in m²
   */
  public static formatArea(m2: number): string {
    return `${m2.toFixed(2)} m²`;
  }

  /**
   * Format volume in m³
   */
  public static formatVolume(m3: number): string {
    return `${m3.toFixed(3)} m³`;
  }
}
