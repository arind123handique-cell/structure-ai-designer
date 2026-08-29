/**
 * Architectural Staircase 2D Placement & Parametric Geometry Engine
 * Handles 2D placement, transformations, hit testing, and CAD detail rendering
 * for RCC Dog-Legged & Open-Well staircases on the architectural plan canvas.
 */

import { ArchitecturalStaircase, Point2D } from '../types/architecturalTypes';

export interface Staircase2DComponentData {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  center: Point2D;
  enclosurePolygon: Point2D[];
  innerPolygon: Point2D[];
  flight1Polygon: Point2D[];
  flight2Polygon: Point2D[];
  floorLandingPolygon: Point2D[];
  midLandingPolygon: Point2D[];
  wellGapPolygon: Point2D[];
  flight1TreadLines: { start: Point2D; end: Point2D; index: number }[];
  flight2TreadLines: { start: Point2D; end: Point2D; index: number }[];
  flight1Arrow: { start: Point2D; end: Point2D };
  flight2Arrow: { start: Point2D; end: Point2D };
  leftDoor?: {
    opening: { start: Point2D; end: Point2D };
    leaf: { start: Point2D; end: Point2D };
    arcCenter: Point2D;
    radius: number;
    startAngle: number;
    endAngle: number;
  };
  rightDoor?: {
    opening: { start: Point2D; end: Point2D };
    leaf: { start: Point2D; end: Point2D };
    arcCenter: Point2D;
    radius: number;
    startAngle: number;
    endAngle: number;
  };
  frontDoor?: {
    opening: { start: Point2D; end: Point2D };
    leaf: { start: Point2D; end: Point2D };
    arcCenter: Point2D;
    radius: number;
    startAngle: number;
    endAngle: number;
  };
}

export class StaircasePlacementEngine {
  /**
   * Rotates a point around an origin (0,0) by given angle in degrees
   */
  private static rotatePoint(p: Point2D, angleDeg: number): Point2D {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      x: p.x * cos - p.y * sin,
      y: p.x * sin + p.y * cos,
    };
  }

  /**
   * Translates and rotates a local point to world coordinates
   */
  private static localToWorld(local: Point2D, origin: Point2D, angleDeg: number): Point2D {
    const rot = this.rotatePoint(local, angleDeg);
    return {
      x: origin.x + rot.x,
      y: origin.y + rot.y,
    };
  }

  /**
   * Transforms an array of local polygon vertices to world coordinates
   */
  private static polygonLocalToWorld(poly: Point2D[], origin: Point2D, angleDeg: number): Point2D[] {
    return poly.map((p) => this.localToWorld(p, origin, angleDeg));
  }

  /**
   * Creates a default architectural staircase instance
   */
  public static createDefaultStaircase(
    floorId: string,
    position: Point2D,
    options?: Partial<ArchitecturalStaircase>
  ): ArchitecturalStaircase {
    const roomL = options?.roomLength || 4.8;
    const roomW = options?.roomWidth || 2.4;
    const flightW = options?.flightWidth || 1.1;
    const landingD = options?.landingDepth || 1.2;
    const wellG = options?.wellGap || 0.2;
    const treadMm = options?.treadMm || 275;
    const riserMm = options?.riserMm || 160;
    const riserCount = options?.riserCount || 10;
    const treadCount = options?.treadCount || 9;

    return {
      id: options?.id || `STAIR-${Date.now().toString(36).substr(-4).toUpperCase()}`,
      floorId,
      name: options?.name || 'Main RCC Staircase',
      position,
      rotation: options?.rotation || 0,
      staircaseType: options?.staircaseType || 'DOG_LEGGED',
      roomLength: roomL,
      roomWidth: roomW,
      flightWidth: flightW,
      wellGap: wellG,
      landingDepth: landingD,
      treadMm,
      riserMm,
      riserCount,
      treadCount,
      waistThicknessMm: options?.waistThicknessMm || 160,
      wallThicknessMm: options?.wallThicknessMm || 230,
      hasEnclosureWalls: options?.hasEnclosureWalls !== undefined ? options.hasEnclosureWalls : true,
      hasLeftDoor: options?.hasLeftDoor !== undefined ? options.hasLeftDoor : true,
      leftDoorWidth: options?.leftDoorWidth || 1.0,
      hasRightDoor: options?.hasRightDoor !== undefined ? options.hasRightDoor : true,
      rightDoorWidth: options?.rightDoorWidth || 1.0,
      hasFrontDoor: options?.hasFrontDoor !== undefined ? options.hasFrontDoor : true,
      frontDoorWidth: options?.frontDoorWidth || 1.2,
      direction: options?.direction || 'UP',
      startElevation: options?.startElevation || 0.0,
      endElevation: options?.endElevation || 3.2,
      locked: false,
    };
  }

  /**
   * Computes complete 2D geometric components in world space for drawing & hit testing
   */
  public static getStaircase2DComponents(stair: ArchitecturalStaircase): Staircase2DComponentData {
    const L = stair.roomLength;
    const W = stair.roomWidth;
    const wallT = (stair.wallThicknessMm || 230) / 1000;
    const landingD = stair.landingDepth || 1.2;
    const flightW = stair.flightWidth || 1.1;
    const wellG = stair.wellGap || 0.2;
    const treadM = (stair.treadMm || 275) / 1000;
    const treadCount = stair.treadCount || 9;
    const pos = stair.position;
    const rot = stair.rotation || 0;

    // 1. Enclosure Outer & Inner Local Rectangles
    const outerLocal: Point2D[] = [
      { x: -wallT, y: -wallT },
      { x: L + wallT, y: -wallT },
      { x: L + wallT, y: W + wallT },
      { x: -wallT, y: W + wallT },
    ];

    const innerLocal: Point2D[] = [
      { x: 0, y: 0 },
      { x: L, y: 0 },
      { x: L, y: W },
      { x: 0, y: W },
    ];

    // 2. Floor Landing & Mid-Landing Local Rectangles
    const floorLandingLocal: Point2D[] = [
      { x: 0, y: 0 },
      { x: landingD, y: 0 },
      { x: landingD, y: W },
      { x: 0, y: W },
    ];

    const midLandingLocal: Point2D[] = [
      { x: L - landingD, y: 0 },
      { x: L, y: 0 },
      { x: L, y: W },
      { x: L - landingD, y: W },
    ];

    // 3. Flight 1 & Flight 2 Local Rectangles
    const goingLength = treadCount * treadM;
    const flight1Local: Point2D[] = [
      { x: landingD, y: 0 },
      { x: landingD + goingLength, y: 0 },
      { x: landingD + goingLength, y: flightW },
      { x: landingD, y: flightW },
    ];

    const flight2Local: Point2D[] = [
      { x: landingD, y: flightW + wellG },
      { x: landingD + goingLength, y: flightW + wellG },
      { x: landingD + goingLength, y: W },
      { x: landingD, y: W },
    ];

    // 4. Central Well Gap Local Rectangle
    const wellGapLocal: Point2D[] = [
      { x: landingD, y: flightW },
      { x: landingD + goingLength, y: flightW },
      { x: landingD + goingLength, y: flightW + wellG },
      { x: landingD, y: flightW + wellG },
    ];

    // 5. Flight 1 & 2 Tread Lines
    const flight1TreadsLocal: { start: Point2D; end: Point2D; index: number }[] = [];
    for (let i = 0; i <= treadCount; i++) {
      const stepX = landingD + i * treadM;
      flight1TreadsLocal.push({
        start: { x: stepX, y: 0 },
        end: { x: stepX, y: flightW },
        index: i + 1,
      });
    }

    const flight2TreadsLocal: { start: Point2D; end: Point2D; index: number }[] = [];
    for (let i = 0; i <= treadCount; i++) {
      const stepX = L - landingD - i * treadM;
      flight2TreadsLocal.push({
        start: { x: stepX, y: flightW + wellG },
        end: { x: stepX, y: W },
        index: (stair.riserCount || 10) + i,
      });
    }

    // 6. Direction Arrows
    const arrow1StartLocal = { x: landingD + 0.3, y: flightW / 2 };
    const arrow1EndLocal = { x: landingD + goingLength - 0.3, y: flightW / 2 };

    const arrow2StartLocal = { x: L - landingD - 0.3, y: flightW + wellG + flightW / 2 };
    const arrow2EndLocal = { x: landingD + 0.3, y: flightW + wellG + flightW / 2 };

    // Convert all to World Space
    const enclosurePolygon = this.polygonLocalToWorld(outerLocal, pos, rot);
    const innerPolygon = this.polygonLocalToWorld(innerLocal, pos, rot);
    const floorLandingPolygon = this.polygonLocalToWorld(floorLandingLocal, pos, rot);
    const midLandingPolygon = this.polygonLocalToWorld(midLandingLocal, pos, rot);
    const flight1Polygon = this.polygonLocalToWorld(flight1Local, pos, rot);
    const flight2Polygon = this.polygonLocalToWorld(flight2Local, pos, rot);
    const wellGapPolygon = this.polygonLocalToWorld(wellGapLocal, pos, rot);

    const flight1TreadLines = flight1TreadsLocal.map((t) => ({
      start: this.localToWorld(t.start, pos, rot),
      end: this.localToWorld(t.end, pos, rot),
      index: t.index,
    }));

    const flight2TreadLines = flight2TreadsLocal.map((t) => ({
      start: this.localToWorld(t.start, pos, rot),
      end: this.localToWorld(t.end, pos, rot),
      index: t.index,
    }));

    const flight1Arrow = {
      start: this.localToWorld(arrow1StartLocal, pos, rot),
      end: this.localToWorld(arrow1EndLocal, pos, rot),
    };

    const flight2Arrow = {
      start: this.localToWorld(arrow2StartLocal, pos, rot),
      end: this.localToWorld(arrow2EndLocal, pos, rot),
    };

    // Calculate World Bounds
    const allX = enclosurePolygon.map((p) => p.x);
    const allY = enclosurePolygon.map((p) => p.y);
    const bounds = {
      minX: Math.min(...allX),
      maxX: Math.max(...allX),
      minY: Math.min(...allY),
      maxY: Math.max(...allY),
    };

    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };

    // 7. Landing Doors in World Space
    let leftDoor: any = undefined;
    if (stair.hasLeftDoor) {
      const doorW = stair.leftDoorWidth || 1.0;
      const startX = landingD / 2 - doorW / 2;
      const dStartLocal = { x: startX, y: -wallT };
      const dEndLocal = { x: startX + doorW, y: -wallT };
      const leafEndLocal = { x: startX, y: -wallT - doorW };

      leftDoor = {
        opening: {
          start: this.localToWorld(dStartLocal, pos, rot),
          end: this.localToWorld(dEndLocal, pos, rot),
        },
        leaf: {
          start: this.localToWorld(dStartLocal, pos, rot),
          end: this.localToWorld(leafEndLocal, pos, rot),
        },
        arcCenter: this.localToWorld(dStartLocal, pos, rot),
        radius: doorW,
        startAngle: 0,
        endAngle: Math.PI / 2,
      };
    }

    let rightDoor: any = undefined;
    if (stair.hasRightDoor) {
      const doorW = stair.rightDoorWidth || 1.0;
      const startX = landingD / 2 - doorW / 2;
      const dStartLocal = { x: startX, y: W + wallT };
      const dEndLocal = { x: startX + doorW, y: W + wallT };
      const leafEndLocal = { x: startX, y: W + wallT + doorW };

      rightDoor = {
        opening: {
          start: this.localToWorld(dStartLocal, pos, rot),
          end: this.localToWorld(dEndLocal, pos, rot),
        },
        leaf: {
          start: this.localToWorld(dStartLocal, pos, rot),
          end: this.localToWorld(leafEndLocal, pos, rot),
        },
        arcCenter: this.localToWorld(dStartLocal, pos, rot),
        radius: doorW,
        startAngle: 0,
        endAngle: -Math.PI / 2,
      };
    }

    let frontDoor: any = undefined;
    if (stair.hasFrontDoor) {
      const doorW = stair.frontDoorWidth || 1.2;
      const startY = W / 2 - doorW / 2;
      const dStartLocal = { x: -wallT, y: startY };
      const dEndLocal = { x: -wallT, y: startY + doorW };
      const leafEndLocal = { x: -wallT - doorW, y: startY };

      frontDoor = {
        opening: {
          start: this.localToWorld(dStartLocal, pos, rot),
          end: this.localToWorld(dEndLocal, pos, rot),
        },
        leaf: {
          start: this.localToWorld(dStartLocal, pos, rot),
          end: this.localToWorld(leafEndLocal, pos, rot),
        },
        arcCenter: this.localToWorld(dStartLocal, pos, rot),
        radius: doorW,
        startAngle: 0,
        endAngle: Math.PI / 2,
      };
    }

    return {
      bounds,
      center,
      enclosurePolygon,
      innerPolygon,
      flight1Polygon,
      flight2Polygon,
      floorLandingPolygon,
      midLandingPolygon,
      wellGapPolygon,
      flight1TreadLines,
      flight2TreadLines,
      flight1Arrow,
      flight2Arrow,
      leftDoor,
      rightDoor,
      frontDoor,
    };
  }

  /**
   * Hit test to check if a world point lies inside the staircase bounding area
   */
  public static isPointInStaircase(point: Point2D, stair: ArchitecturalStaircase): boolean {
    const data = this.getStaircase2DComponents(stair);
    const poly = data.enclosurePolygon;

    // Ray-casting point-in-polygon
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }
}
