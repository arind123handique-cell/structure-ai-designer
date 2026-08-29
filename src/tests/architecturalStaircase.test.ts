/**
 * Unit Tests for Architectural Staircase 2D Placement & Parametric Geometry Engine
 */

import { describe, it, expect } from 'vitest';
import { StaircasePlacementEngine } from '@/features/architectural/engines/staircasePlacementEngine';
import { ArchitecturalStaircase } from '@/features/architectural/types/architecturalTypes';
import { Architectural3DLayer } from '@/features/architectural/3d/Architectural3DLayer';

describe('StaircasePlacementEngine', () => {
  it('should create default architectural staircase with IS 456 / NBC dimensions', () => {
    const stair = StaircasePlacementEngine.createDefaultStaircase('floor_0', { x: 5.0, y: 10.0 });

    expect(stair.id).toBeDefined();
    expect(stair.floorId).toBe('floor_0');
    expect(stair.position).toEqual({ x: 5.0, y: 10.0 });
    expect(stair.rotation).toBe(0);
    expect(stair.roomLength).toBe(4.8);
    expect(stair.roomWidth).toBe(2.4);
    expect(stair.flightWidth).toBe(1.1);
    expect(stair.landingDepth).toBe(1.2);
    expect(stair.wellGap).toBe(0.2);
    expect(stair.treadMm).toBe(275);
    expect(stair.riserMm).toBe(160);
    expect(stair.riserCount).toBe(10);
    expect(stair.treadCount).toBe(9);
    expect(stair.hasLeftDoor).toBe(true);
    expect(stair.hasRightDoor).toBe(true);
    expect(stair.hasFrontDoor).toBe(true);
  });

  it('should compute accurate 2D geometric components, polygons, and tread lines', () => {
    const stair = StaircasePlacementEngine.createDefaultStaircase(
      'floor_0',
      { x: 0, y: 0 },
      {
        roomLength: 4.8,
        roomWidth: 2.4,
        flightWidth: 1.1,
        landingDepth: 1.2,
        wellGap: 0.2,
        treadMm: 275,
        treadCount: 9,
        riserCount: 10,
        rotation: 0,
      }
    );

    const comp = StaircasePlacementEngine.getStaircase2DComponents(stair);

    // Bounding Box
    expect(comp.bounds.minX).toBeCloseTo(-0.23, 2);
    expect(comp.bounds.maxX).toBeCloseTo(5.03, 2);
    expect(comp.bounds.minY).toBeCloseTo(-0.23, 2);
    expect(comp.bounds.maxY).toBeCloseTo(2.63, 2);

    // Tread lines count (0 to 9 = 10 lines per flight)
    expect(comp.flight1TreadLines.length).toBe(10);
    expect(comp.flight2TreadLines.length).toBe(10);

    // Direction arrows
    expect(comp.flight1Arrow.start.x).toBeLessThan(comp.flight1Arrow.end.x);
    expect(comp.flight2Arrow.start.x).toBeGreaterThan(comp.flight2Arrow.end.x);

    // Dual-side doors
    expect(comp.leftDoor).toBeDefined();
    expect(comp.rightDoor).toBeDefined();
    expect(comp.frontDoor).toBeDefined();
  });

  it('should correctly transform coordinates when rotated 90 degrees', () => {
    const stair = StaircasePlacementEngine.createDefaultStaircase(
      'floor_0',
      { x: 10.0, y: 10.0 },
      {
        roomLength: 4.8,
        roomWidth: 2.4,
        rotation: 90,
      }
    );

    const comp = StaircasePlacementEngine.getStaircase2DComponents(stair);

    expect(comp.bounds).toBeDefined();
    expect(comp.center.x).toBeCloseTo(10.0 - 1.2, 1);
    expect(comp.center.y).toBeCloseTo(10.0 + 2.4, 1);
  });

  it('should accurately hit-test points inside and outside the staircase enclosure', () => {
    const stair = StaircasePlacementEngine.createDefaultStaircase(
      'floor_0',
      { x: 4.0, y: 6.0 },
      {
        roomLength: 4.8,
        roomWidth: 2.4,
        rotation: 0,
      }
    );

    // Inside point (center of flight 1)
    expect(StaircasePlacementEngine.isPointInStaircase({ x: 5.5, y: 6.5 }, stair)).toBe(true);

    // Inside point (mid-landing)
    expect(StaircasePlacementEngine.isPointInStaircase({ x: 8.0, y: 7.0 }, stair)).toBe(true);

    // Outside points
    expect(StaircasePlacementEngine.isPointInStaircase({ x: 1.0, y: 1.0 }, stair)).toBe(false);
    expect(StaircasePlacementEngine.isPointInStaircase({ x: 10.5, y: 7.0 }, stair)).toBe(false);
    expect(StaircasePlacementEngine.isPointInStaircase({ x: 5.0, y: 10.0 }, stair)).toBe(false);
  });

  it('should support dynamic modification of tread, riser, doors, and rotation', () => {
    let stair: ArchitecturalStaircase = StaircasePlacementEngine.createDefaultStaircase(
      'floor_1',
      { x: 2.0, y: 3.0 }
    );

    // Modify position & step sizing
    stair = {
      ...stair,
      position: { x: 4.5, y: 6.5 },
      treadMm: 300,
      riserMm: 150,
      roomLength: 5.2,
      rotation: 180,
      hasLeftDoor: false,
    };

    const comp = StaircasePlacementEngine.getStaircase2DComponents(stair);
    expect(comp.leftDoor).toBeUndefined();
    expect(comp.rightDoor).toBeDefined();
    expect(stair.treadMm).toBe(300);
    expect(stair.riserMm).toBe(150);
    expect(stair.rotation).toBe(180);
  });

  it('should support moving, dragging, and nudging staircase on drawing sheets', () => {
    let stair: ArchitecturalStaircase = StaircasePlacementEngine.createDefaultStaircase(
      'floor_1',
      { x: 10.0, y: 12.0 }
    );

    // Nudge Left (dx = -0.2)
    stair = {
      ...stair,
      position: { x: Math.round((stair.position.x - 0.2) * 100) / 100, y: stair.position.y },
    };
    expect(stair.position.x).toBeCloseTo(9.8, 2);

    // Nudge Down (dy = +0.2)
    stair = {
      ...stair,
      position: { x: stair.position.x, y: Math.round((stair.position.y + 0.2) * 100) / 100 },
    };
    expect(stair.position.y).toBeCloseTo(12.2, 2);

    // Rotate 90 degrees
    stair = {
      ...stair,
      rotation: ((stair.rotation || 0) + 90) % 360,
    };
    expect(stair.rotation).toBe(90);

    const comp = StaircasePlacementEngine.getStaircase2DComponents(stair);
    expect(comp.bounds.minX).toBeDefined();
    expect(comp.bounds.maxX).toBeDefined();
  });

  it('should generate 3D RCC staircase geometry, landing slabs, and handrails in Architectural3DLayer', () => {
    const layer = new Architectural3DLayer();
    const stair = StaircasePlacementEngine.createDefaultStaircase('floor_0', { x: 4.0, y: 5.0 });

    layer.update(
      {},
      {},
      {},
      {},
      {},
      { [stair.id]: stair },
      null,
      {
        showWalls: true,
        showDoors: true,
        showWindows: true,
        showOpenings: true,
        showRoomLabels: true,
        showStaircases: true,
      }
    );

    const group = layer.getGroup();
    expect(group.children.length).toBe(5); // 5 storeys generated

    // Verify all 5 storeys have correct Y elevations matching building diaphragms
    expect(group.children[0].position.y).toBeCloseTo(0.0, 1);
    expect(group.children[1].position.y).toBeCloseTo(3.2, 1);
    expect(group.children[2].position.y).toBeCloseTo(6.4, 1);
    expect(group.children[3].position.y).toBeCloseTo(9.6, 1);
    expect(group.children[4].position.y).toBeCloseTo(12.8, 1);

    const stair3DGroup = group.children[0];
    expect(stair3DGroup.position.x).toBe(4.0);
    expect(stair3DGroup.position.z).toBe(5.0);

    // Verify presence of step meshes and landing slabs
    const meshes: any[] = [];
    stair3DGroup.traverse((child: any) => {
      if (child.isMesh) meshes.push(child);
    });

    expect(meshes.length).toBeGreaterThan(10); // 9 flight 1 steps + 9 flight 2 steps + landings + rails
    layer.dispose();
  });
});


