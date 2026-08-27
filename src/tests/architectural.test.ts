/**
 * Comprehensive Architectural BIM Engine & Takeoff Vitest Test Suite
 */

import { describe, it, expect } from 'vitest';
import { ArchitecturalIdGenerator } from '../features/architectural/utils/idGenerator';
import { CoordinateTransform } from '../features/architectural/utils/coordinateTransform';
import { ArchitecturalGeometryEngine } from '../features/architectural/engines/architecturalGeometryEngine';
import { SnapEngine } from '../features/architectural/engines/snapEngine';
import { WallEngine } from '../features/architectural/engines/wallEngine';
import { DoorEngine } from '../features/architectural/engines/doorEngine';
import { WindowEngine } from '../features/architectural/engines/windowEngine';
import { OpeningEngine } from '../features/architectural/engines/openingEngine';
import { RoomEngine } from '../features/architectural/engines/roomEngine';
import { ArchitecturalTakeoffEngine } from '../features/architectural/engines/architecturalTakeoffEngine';
import { Architectural3DLayer } from '../features/architectural/3d/Architectural3DLayer';
import {
  ArchitecturalWall,
  ArchitecturalDoor,
  ArchitecturalWindow,
  ArchitecturalOpening,
  ArchitecturalRoom,
} from '../features/architectural/types/architecturalTypes';

describe('Architectural BIM Engine Suite', () => {
  describe('ArchitecturalIdGenerator', () => {
    it('generates sequential and collision-free IDs', () => {
      expect(ArchitecturalIdGenerator.generateWallId([])).toBe('W-001');
      expect(ArchitecturalIdGenerator.generateWallId(['W-001', 'W-002'])).toBe('W-003');
      expect(ArchitecturalIdGenerator.generateDoorId([])).toBe('D-001');
      expect(ArchitecturalIdGenerator.generateDoorId(['D-001', 'D-005'])).toBe('D-006');
      expect(ArchitecturalIdGenerator.generateWindowId([])).toBe('WIN-001');
      expect(ArchitecturalIdGenerator.generateOpeningId([])).toBe('O-001');
      expect(ArchitecturalIdGenerator.generateRoomId([])).toBe('R-001');
      expect(ArchitecturalIdGenerator.generateDimensionId([])).toBe('DIM-001');
    });
  });

  describe('CoordinateTransform', () => {
    it('converts 2D plan to 3D world coordinates correctly', () => {
      const planPt = { x: 5.0, y: 8.5 };
      const world3D = CoordinateTransform.plan2DToWorld3D(planPt, 3.2);
      expect(world3D.x).toBe(5.0);
      expect(world3D.y).toBe(3.2);
      expect(world3D.z).toBe(8.5);

      const backPlan = CoordinateTransform.world3DToPlan2D(world3D);
      expect(backPlan.x).toBe(5.0);
      expect(backPlan.y).toBe(8.5);
    });

    it('transforms between world 2D and screen canvas pixels with pan and zoom', () => {
      const worldPt = { x: 10, y: 5 };
      const panX = 200;
      const panY = 300;
      const zoom = 20;

      const screen = CoordinateTransform.world2DToScreen(worldPt, panX, panY, zoom);
      expect(screen.x).toBe(200 + 10 * 20); // 400
      expect(screen.y).toBe(300 - 5 * 20); // 200

      const backWorld = CoordinateTransform.screenToWorld2D(screen, panX, panY, zoom);
      expect(backWorld.x).toBeCloseTo(10, 5);
      expect(backWorld.y).toBeCloseTo(5, 5);
    });
  });

  describe('ArchitecturalGeometryEngine', () => {
    it('computes distance, angles, and angle snapping', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(ArchitecturalGeometryEngine.distance(p1, p2)).toBe(5);

      const rad = ArchitecturalGeometryEngine.angle(p1, p2);
      expect(ArchitecturalGeometryEngine.radiansToDegrees(rad)).toBeCloseTo(53.13, 1);

      // Snap angle to 45 deg increments
      const snapped45 = ArchitecturalGeometryEngine.snapAngle(Math.PI / 4 + 0.05, 45);
      expect(ArchitecturalGeometryEngine.radiansToDegrees(snapped45)).toBe(45);
    });

    it('computes line segment intersections and point projection', () => {
      const a1 = { x: 0, y: 5 };
      const a2 = { x: 10, y: 5 };
      const b1 = { x: 5, y: 0 };
      const b2 = { x: 5, y: 10 };

      const inter = ArchitecturalGeometryEngine.lineIntersection(a1, a2, b1, b2);
      expect(inter).not.toBeNull();
      expect(inter?.x).toBeCloseTo(5);
      expect(inter?.y).toBeCloseTo(5);

      // Point projection
      const proj = ArchitecturalGeometryEngine.projectPointOnSegment({ x: 5, y: 7 }, a1, a2);
      expect(proj.projection.x).toBeCloseTo(5);
      expect(proj.projection.y).toBeCloseTo(5);
      expect(proj.distance).toBeCloseTo(2);
      expect(proj.isInsideSegment).toBe(true);
    });

    it('calculates polygon area using Shoelace formula and polygon centroid', () => {
      // 5m x 4m rectangle = 20 m²
      const poly = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ];

      expect(ArchitecturalGeometryEngine.polygonArea(poly)).toBeCloseTo(20);
      expect(ArchitecturalGeometryEngine.polygonPerimeter(poly)).toBeCloseTo(18);

      const centroid = ArchitecturalGeometryEngine.polygonCentroid(poly);
      expect(centroid.x).toBeCloseTo(2.5);
      expect(centroid.y).toBeCloseTo(2.0);

      expect(ArchitecturalGeometryEngine.isPointInPolygon({ x: 2.5, y: 2.0 }, poly)).toBe(true);
      expect(ArchitecturalGeometryEngine.isPointInPolygon({ x: 10, y: 10 }, poly)).toBe(false);
    });
  });

  describe('WallEngine', () => {
    it('creates parametric wall and computes outline polygon', () => {
      const wall = WallEngine.createWall(
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        'floor_0',
        [],
        0.23,
        3.2,
        'EXTERNAL'
      );

      expect(wall.id).toBe('W-001');
      expect(wall.thickness).toBe(0.23);
      expect(wall.height).toBe(3.2);

      const outline = WallEngine.getWallOutline(wall);
      expect(outline.length).toBe(4);
      // Area of 5m x 0.23m = 1.15 m²
      expect(ArchitecturalGeometryEngine.polygonArea(outline)).toBeCloseTo(1.15, 2);
    });

    it('splits a wall into two connected wall segments', () => {
      const originalWall = WallEngine.createWall(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        'floor_0',
        [],
        0.23,
        3.2
      );

      const split = WallEngine.splitWall(originalWall, { x: 4, y: 0 }, []);
      expect(split).not.toBeNull();
      expect(split?.wall1.start).toEqual({ x: 0, y: 0 });
      expect(split?.wall1.end.x).toBeCloseTo(4);
      expect(split?.wall2.start.x).toBeCloseTo(4);
      expect(split?.wall2.end).toEqual({ x: 10, y: 0 });
      expect(split?.wall2.id).toBe('W-002');
    });

    it('offsets a wall by a given distance', () => {
      const wall = WallEngine.createWall(
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        'floor_0',
        [],
        0.23
      );

      const offsetWall = WallEngine.offsetWall(wall, 3.0, []);
      expect(offsetWall.id).toBe('W-002');
      expect(offsetWall.start.y).toBeCloseTo(3.0);
      expect(offsetWall.end.y).toBeCloseTo(3.0);
    });
  });

  describe('DoorEngine & WindowEngine', () => {
    it('creates hosted door and calculates 2D opening cutout segments', () => {
      const wall = WallEngine.createWall(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        'floor_0',
        [],
        0.23
      );

      const door = DoorEngine.createDoor(
        wall,
        { x: 3, y: 0 },
        'floor_0',
        [],
        0.9,
        2.1,
        'SINGLE_SWING',
        'RIGHT'
      );

      expect(door.id).toBe('D-001');
      expect(door.hostWallId).toBe(wall.id);
      expect(door.position).toBeCloseTo(3.0);
      expect(door.width).toBe(0.9);

      const center = DoorEngine.getDoorCenter(wall, door);
      expect(center.x).toBeCloseTo(3.0);
      expect(center.y).toBeCloseTo(0);

      const seg = DoorEngine.getDoorOpeningSegment(wall, door);
      expect(seg.start.x).toBeCloseTo(2.55);
      expect(seg.end.x).toBeCloseTo(3.45);
    });

    it('creates hosted window and respects position along host wall', () => {
      const wall = WallEngine.createWall(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        'floor_0',
        [],
        0.23
      );

      const win = WindowEngine.createWindow(
        wall,
        { x: 6, y: 0 },
        'floor_0',
        [],
        1.5,
        1.2,
        0.9
      );

      expect(win.id).toBe('WIN-001');
      expect(win.hostWallId).toBe(wall.id);
      expect(win.position).toBeCloseTo(6.0);
      expect(win.width).toBe(1.5);
      expect(win.sillHeight).toBe(0.9);
    });
  });

  describe('RoomEngine', () => {
    it('detects enclosed rooms formed by intersecting walls', () => {
      // Create 4 intersecting walls forming a 5m x 4m room (20 m²)
      const walls: ArchitecturalWall[] = [
        WallEngine.createWall({ x: 0, y: 0 }, { x: 5, y: 0 }, 'floor_0', ['W-001'], 0.23),
        WallEngine.createWall({ x: 5, y: 0 }, { x: 5, y: 4 }, 'floor_0', ['W-001', 'W-002'], 0.23),
        WallEngine.createWall({ x: 5, y: 4 }, { x: 0, y: 4 }, 'floor_0', ['W-001', 'W-002', 'W-003'], 0.23),
        WallEngine.createWall({ x: 0, y: 4 }, { x: 0, y: 0 }, 'floor_0', ['W-001', 'W-002', 'W-003', 'W-004'], 0.23),
      ];

      const detectedRooms = RoomEngine.detectRoomsFromWalls(walls, 'floor_0', []);
      expect(detectedRooms.length).toBe(1);
      expect(detectedRooms[0]).toBeDefined();
      if (detectedRooms[0] && detectedRooms[0].labelPosition) {
        expect(detectedRooms[0].area).toBeCloseTo(20, 1);
        expect(detectedRooms[0].perimeter).toBeCloseTo(18, 1);
        expect(detectedRooms[0].labelPosition.x).toBeCloseTo(2.5, 1);
        expect(detectedRooms[0].labelPosition.y).toBeCloseTo(2.0, 1);
      }
    });
  });

  describe('ArchitecturalTakeoffEngine', () => {
    it('performs transparent L x B x H takeoff with opening deductions', () => {
      const wall1: ArchitecturalWall = {
        id: 'W-001',
        floorId: 'floor_0',
        start: { x: 0, y: 0 },
        end: { x: 6, y: 0 }, // 6m long
        thickness: 0.23, // 230mm
        height: 3.0, // 3.0m high -> Gross = 6 * 0.23 * 3.0 = 4.14 m³
        wallType: 'EXTERNAL',
        baseElevation: 0,
        topElevation: 3.0,
      };

      // Hosted door: 1.0m x 2.1m -> Deduction = 1.0 * 0.23 * 2.1 = 0.483 m³
      const door1: ArchitecturalDoor = {
        id: 'D-001',
        floorId: 'floor_0',
        hostWallId: 'W-001',
        position: 2.0,
        width: 1.0,
        height: 2.1,
        doorType: 'SINGLE_SWING',
        swingDirection: 'RIGHT',
        sillHeight: 0,
      };

      // Hosted window: 1.2m x 1.2m -> Deduction = 1.2 * 0.23 * 1.2 = 0.3312 m³
      const win1: ArchitecturalWindow = {
        id: 'WIN-001',
        floorId: 'floor_0',
        hostWallId: 'W-001',
        position: 4.5,
        width: 1.2,
        height: 1.2,
        sillHeight: 0.9,
        windowType: 'CASEMENT',
      };

      const wallsMap = { 'W-001': wall1 };
      const doorsMap = { 'D-001': door1 };
      const windowsMap = { 'WIN-001': win1 };
      const openingsMap = {};
      const roomsMap = {};

      const takeoff = ArchitecturalTakeoffEngine.calculateBuildingTakeoff(
        wallsMap,
        doorsMap,
        windowsMap,
        openingsMap,
        roomsMap,
        [{
          levelName: 'Ground Floor',
          elevationY: 0,
          elevationMm: 0,
          beams: [],
          columns: [],
          shearWalls: [],
          slabs: [],
          gridLines: [],
          boundingBox: { minX: 0, maxX: 10, minZ: 0, maxZ: 10, width: 10, height: 10 },
          metrics: { totalBeams: 0, totalColumns: 0, totalSlabs: 0, totalConcreteM3: 0, totalSteelKg: 0, totalFloorAreaM2: 0 },
        } as any]
      );

      expect(takeoff.grandTotalGrossMasonryM3).toBeCloseTo(4.14, 2);
      // Total deduction = 0.483 + 0.3312 = 0.8142 m³
      // Net volume = 4.14 - 0.8142 = 3.3258 m³
      expect(takeoff.grandTotalNetMasonryM3).toBeCloseTo(3.326, 2);
      expect(takeoff.grandTotalDoors).toBe(1);
      expect(takeoff.grandTotalWindows).toBe(1);
    });
  });

  describe('Architectural3DLayer', () => {
    it('initializes and generates 3D meshes without errors', () => {
      const layer = new Architectural3DLayer();
      expect(layer.getGroup()).toBeDefined();

      const walls: Record<string, ArchitecturalWall> = {
        'W-001': {
          id: 'W-001',
          floorId: 'floor_0',
          start: { x: 0, y: 0 },
          end: { x: 5, y: 0 },
          thickness: 0.23,
          height: 3.0,
          wallType: 'EXTERNAL',
          baseElevation: 0,
          topElevation: 3.0,
        },
      };

      const doors: Record<string, ArchitecturalDoor> = {
        'D-001': {
          id: 'D-001',
          floorId: 'floor_0',
          hostWallId: 'W-001',
          position: 2.0,
          width: 0.9,
          height: 2.1,
          doorType: 'SINGLE_SWING',
          swingDirection: 'RIGHT',
          sillHeight: 0,
        },
      };

      const windows: Record<string, ArchitecturalWindow> = {};
      const openings: Record<string, ArchitecturalOpening> = {};
      const rooms: Record<string, ArchitecturalRoom> = {};

      layer.update(walls, doors, windows, openings, rooms, null);
      expect(layer.getGroup().children.length).toBeGreaterThan(0);

      layer.dispose();
      expect(layer.getGroup().children.length).toBe(0);
    });
  });
});
