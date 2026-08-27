/**
 * Precision 2D/3D BIM Geometry Engine for Architectural Modeling
 */

import { Point2D } from '../types/architecturalTypes';

const EPSILON = 1e-6;

export class ArchitecturalGeometryEngine {
  /**
   * Euclidean distance between two points in meters
   */
  public static distance(p1: Point2D, p2: Point2D): number {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  /**
   * Angle in radians from p1 to p2 (-PI to +PI)
   */
  public static angle(p1: Point2D, p2: Point2D): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }

  /**
   * Convert radians to degrees
   */
  public static radiansToDegrees(rad: number): number {
    return (rad * 180) / Math.PI;
  }

  /**
   * Convert degrees to radians
   */
  public static degreesToRadians(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /**
   * Angle in degrees from p1 to p2 (0 to 360)
   */
  public static angleDegrees(p1: Point2D, p2: Point2D): number {
    const rad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }

  /**
   * Check if two points are equal within tolerance (meters)
   */
  public static pointEquals(p1: Point2D, p2: Point2D, tolerance = 0.001): boolean {
    return Math.abs(p1.x - p2.x) <= tolerance && Math.abs(p1.y - p2.y) <= tolerance;
  }

  /**
   * Project a point onto a line segment. Returns closest point on the segment and parameterized t (0..1)
   */
  public static projectPointToSegment(
    point: Point2D,
    lineStart: Point2D,
    lineEnd: Point2D
  ): { point: Point2D; projection: Point2D; t: number; distance: number; isInsideSegment: boolean } {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq < EPSILON) {
      return {
        point: { ...lineStart },
        projection: { ...lineStart },
        t: 0,
        distance: this.distance(point, lineStart),
        isInsideSegment: true,
      };
    }

    const tRaw = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
    const t = Math.max(0, Math.min(1, tRaw));
    const projected: Point2D = {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy,
    };

    return {
      point: projected,
      projection: projected,
      t,
      distance: this.distance(point, projected),
      isInsideSegment: tRaw >= -EPSILON && tRaw <= 1 + EPSILON,
    };
  }

  public static projectPointOnSegment(
    point: Point2D,
    lineStart: Point2D,
    lineEnd: Point2D
  ) {
    return this.projectPointToSegment(point, lineStart, lineEnd);
  }

  /**
   * Project a point onto an infinite line
   */
  public static projectPointToInfiniteLine(
    point: Point2D,
    lineStart: Point2D,
    lineEnd: Point2D
  ): Point2D {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq < EPSILON) return { ...lineStart };

    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
    return {
      x: lineStart.x + t * dx,
      y: lineStart.y + t * dy,
    };
  }

  /**
   * Intersection between two finite line segments (p1-p2 and p3-p4)
   */
  public static lineIntersection(
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    p4: Point2D
  ): Point2D | null {
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;

    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < EPSILON) return null; // parallel or collinear

    const dx = p3.x - p1.x;
    const dy = p3.y - p1.y;

    const t1 = (dx * d2y - dy * d2x) / cross;
    const t2 = (dx * d1y - dy * d1x) / cross;

    if (t1 >= -EPSILON && t1 <= 1 + EPSILON && t2 >= -EPSILON && t2 <= 1 + EPSILON) {
      return {
        x: p1.x + t1 * d1x,
        y: p1.y + t1 * d1y,
      };
    }

    return null;
  }

  /**
   * Intersection between two infinite lines
   */
  public static infiniteLineIntersection(
    p1: Point2D,
    p2: Point2D,
    p3: Point2D,
    p4: Point2D
  ): Point2D | null {
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;
    const d2x = p4.x - p3.x;
    const d2y = p4.y - p3.y;

    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < EPSILON) return null;

    const dx = p3.x - p1.x;
    const dy = p3.y - p1.y;
    const t1 = (dx * d2y - dy * d2x) / cross;

    return {
      x: p1.x + t1 * d1x,
      y: p1.y + t1 * d1y,
    };
  }

  /**
   * Offset a line segment parallel to itself by offsetDistance in meters.
   * Positive = offset to the right of direction (start -> end), Negative = left
   */
  public static offsetLine(
    start: Point2D,
    end: Point2D,
    offsetDistance: number
  ): { start: Point2D; end: Point2D } {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len < EPSILON) return { start: { ...start }, end: { ...end } };

    // Normal vector perpendicular to (dx, dy)
    const nx = -dy / len;
    const ny = dx / len;

    return {
      start: {
        x: start.x + nx * offsetDistance,
        y: start.y + ny * offsetDistance,
      },
      end: {
        x: end.x + nx * offsetDistance,
        y: end.y + ny * offsetDistance,
      },
    };
  }

  /**
   * Compute 4 boundary vertices of a wall polygon given centerline, thickness, and reference line
   */
  public static getWallPolygon(
    start: Point2D,
    end: Point2D,
    thickness: number,
    referenceLine: 'CENTERLINE' | 'INSIDE_FACE' | 'OUTSIDE_FACE' = 'CENTERLINE'
  ): Point2D[] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len < EPSILON) return [];

    const nx = -dy / len;
    const ny = dx / len;

    let offset1 = thickness / 2;
    let offset2 = -thickness / 2;

    if (referenceLine === 'INSIDE_FACE') {
      offset1 = thickness;
      offset2 = 0;
    } else if (referenceLine === 'OUTSIDE_FACE') {
      offset1 = 0;
      offset2 = -thickness;
    }

    return [
      { x: start.x + nx * offset1, y: start.y + ny * offset1 },
      { x: end.x + nx * offset1, y: end.y + ny * offset1 },
      { x: end.x + nx * offset2, y: end.y + ny * offset2 },
      { x: start.x + nx * offset2, y: start.y + ny * offset2 },
    ];
  }

  /**
   * Calculate polygon area using Shoelace formula (m²)
   */
  public static polygonArea(vertices: Point2D[]): number {
    const n = vertices.length;
    if (n < 3) return 0;

    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
    }
    return Math.abs(area) / 2;
  }

  /**
   * Calculate polygon perimeter in meters
   */
  public static polygonPerimeter(vertices: Point2D[]): number {
    const n = vertices.length;
    if (n < 2) return 0;

    let perimeter = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      perimeter += this.distance(vertices[i], vertices[j]);
    }
    return perimeter;
  }

  /**
   * Calculate centroid of a 2D polygon
   */
  public static polygonCentroid(vertices: Point2D[]): Point2D {
    const n = vertices.length;
    if (n === 0) return { x: 0, y: 0 };
    if (n === 1) return { ...vertices[0] };
    if (n === 2) return { x: (vertices[0].x + vertices[1].x) / 2, y: (vertices[0].y + vertices[1].y) / 2 };

    let cx = 0;
    let cy = 0;
    let signedArea = 0;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const factor = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
      cx += (vertices[i].x + vertices[j].x) * factor;
      cy += (vertices[i].y + vertices[j].y) * factor;
      signedArea += factor;
    }

    signedArea *= 0.5;
    if (Math.abs(signedArea) < EPSILON) {
      const avgX = vertices.reduce((sum, v) => sum + v.x, 0) / n;
      const avgY = vertices.reduce((sum, v) => sum + v.y, 0) / n;
      return { x: avgX, y: avgY };
    }

    cx /= 6 * signedArea;
    cy /= 6 * signedArea;
    return { x: cx, y: cy };
  }

  /**
   * Test if a point is inside a polygon using ray casting
   */
  public static isPointInsidePolygon(point: Point2D, polygon: Point2D[]): boolean {
    const n = polygon.length;
    if (n < 3) return false;

    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  public static isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
    return this.isPointInsidePolygon(point, polygon);
  }

  /**
   * Snap an angle to nearest increments (e.g. 0, 45, 90, 180, etc.)
   */
  public static snapAngle(angleRadOrDeg: number, increment = 45, threshold = 5): number {
    // If input is small (< 2*PI + 0.1), treat as radians
    const isRadians = Math.abs(angleRadOrDeg) <= 2 * Math.PI + 0.1;
    const angleDeg = isRadians ? this.radiansToDegrees(angleRadOrDeg) : angleRadOrDeg;

    const normalized = (angleDeg % 360 + 360) % 360;
    const remainder = normalized % increment;

    let snappedDeg = normalized;
    if (remainder <= threshold) {
      snappedDeg = normalized - remainder;
    } else if (remainder >= increment - threshold) {
      snappedDeg = (normalized - remainder + increment) % 360;
    }

    return isRadians ? this.degreesToRadians(snappedDeg) : snappedDeg;
  }
}
