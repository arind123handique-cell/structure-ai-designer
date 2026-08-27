/**
 * End-to-End Architectural BIM & Structural Verification Test Suite
 * Tests multi-story structural model integration, snapping, parametric modeling,
 * room cycle detection, quantity takeoff formulas, and 3D mesh generation.
 */

import { describe, it, expect } from 'vitest';
import { NormalizedStructuralModel, Member3D, Node3D } from '@/features/model/types';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';
import { SnapEngine } from '@/features/architectural/engines/snapEngine';
import { WallEngine } from '@/features/architectural/engines/wallEngine';
import { DoorEngine } from '@/features/architectural/engines/doorEngine';
import { WindowEngine } from '@/features/architectural/engines/windowEngine';
import { OpeningEngine } from '@/features/architectural/engines/openingEngine';
import { RoomEngine } from '@/features/architectural/engines/roomEngine';
import { ArchitecturalTakeoffEngine } from '@/features/architectural/engines/architecturalTakeoffEngine';
import { Architectural3DLayer } from '@/features/architectural/3d/Architectural3DLayer';
import { CoordinateTransform } from '@/features/architectural/utils/coordinateTransform';
import {
  ArchitecturalWall,
  ArchitecturalDoor,
  ArchitecturalWindow,
  ArchitecturalOpening,
  SnapSettings,
} from '@/features/architectural/types/architecturalTypes';

// Helper to construct a parametric multi-story structural model
function createMultiStoryStructuralModel(): NormalizedStructuralModel {
  const nodes = new Map<number, Node3D>();
  const members = new Map<number, Member3D>();

  // 3x2 Column Grid: X in [0, 6, 12], Z in [0, 8]
  // Levels: Ground (Y=0), Level 1 (Y=3.2), Roof (Y=6.4)
  const xCoords = [0, 6, 12];
  const zCoords = [0, 8];
  const yElevs = [0, 3.2, 6.4];

  let nodeCounter = 1;
  const gridNodeMap = new Map<string, number>();

  yElevs.forEach((y, lvlIdx) => {
    xCoords.forEach((x, xi) => {
      zCoords.forEach((z, zi) => {
        const id = nodeCounter++;
        nodes.set(id, {
          id,
          x,
          y,
          z,
          isSupport: lvlIdx === 0,
        });
        gridNodeMap.set(`${lvlIdx}_${xi}_${zi}`, id);
      });
    });
  });

  let memberCounter = 1;

  // Vertical Columns
  for (let lvl = 0; lvl < 2; lvl++) {
    xCoords.forEach((_, xi) => {
      zCoords.forEach((_, zi) => {
        const bottomNode = gridNodeMap.get(`${lvl}_${xi}_${zi}`)!;
        const topNode = gridNodeMap.get(`${lvl + 1}_${xi}_${zi}`)!;
        const mId = memberCounter++;
        members.set(mId, {
          id: mId,
          startNodeId: bottomNode,
          endNodeId: topNode,
          length: 3.2,
          classification: 'COLUMN',
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.5, zd: 0.4, name: '400x500 mm' },
          materialName: 'CONCRETE',
          designStatus: 'PASS',
        });
      });
    });
  }

  // Horizontal Beams along X and Z at Level 1 & Roof
  for (let lvl = 1; lvl <= 2; lvl++) {
    // Beams along X
    zCoords.forEach((_, zi) => {
      for (let xi = 0; xi < xCoords.length - 1; xi++) {
        const n1 = gridNodeMap.get(`${lvl}_${xi}_${zi}`)!;
        const n2 = gridNodeMap.get(`${lvl}_${xi + 1}_${zi}`)!;
        const mId = memberCounter++;
        members.set(mId, {
          id: mId,
          startNodeId: n1,
          endNodeId: n2,
          length: 6.0,
          classification: 'BEAM',
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.23, name: '230x450 mm' },
          materialName: 'CONCRETE',
          designStatus: 'PASS',
        });
      }
    });

    // Beams along Z
    xCoords.forEach((_, xi) => {
      const n1 = gridNodeMap.get(`${lvl}_${xi}_0`)!;
      const n2 = gridNodeMap.get(`${lvl}_${xi}_1`)!;
      const mId = memberCounter++;
      members.set(mId, {
        id: mId,
        startNodeId: n1,
        endNodeId: n2,
        length: 8.0,
        classification: 'BEAM',
        isAutoClassified: true,
        section: { type: 'RECTANGULAR', yd: 0.5, zd: 0.23, name: '230x500 mm' },
        materialName: 'CONCRETE',
        designStatus: 'PASS',
      });
    });
  }

  return {
    nodes,
    members,
    plates: new Map(),
    supports: new Map<number, any>([
      [1, { nodeId: 1, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [2, { nodeId: 2, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [3, { nodeId: 3, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [4, { nodeId: 4, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [5, { nodeId: 5, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [6, { nodeId: 6, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
    ]),
    loadCases: new Map(),
    loadCombinations: new Map(),
    memberForces: [],
    reactions: [],
    storyDrifts: [],
    boundingBox: { minX: 0, maxX: 12, minY: 0, maxY: 6.4, minZ: 0, maxZ: 8 },
    statistics: {
      totalNodes: nodes.size,
      totalMembers: members.size,
      totalBeams: Array.from(members.values()).filter((m) => m.classification === 'BEAM').length,
      totalColumns: Array.from(members.values()).filter((m) => m.classification === 'COLUMN').length,
      totalPlates: 0,
      totalSupports: 6,
      totalLoadCases: 0,
      totalCombinations: 0,
      maxElevation: 6.4,
      baseElevation: 0,
    },
  };
}

describe('End-to-End Architectural BIM & Structural Verification Suite', () => {
  const model = createMultiStoryStructuralModel();

  it('Step 1: Discovers and extracts multi-story floor framing plans', () => {
    const floorPlans = FloorPlanEngine.extractFloorPlans(model);
    expect(floorPlans.length).toBeGreaterThanOrEqual(2);

    const groundFloor = floorPlans[0];
    expect(groundFloor.elevationY).toBeCloseTo(0);
    expect(groundFloor.columns.length).toBe(6);

    const firstFloor = floorPlans[1];
    expect(firstFloor.elevationY).toBeCloseTo(3.2);
    expect(firstFloor.beams.length).toBe(7); // 4 beams along X + 3 beams along Z
  });

  it('Step 2: CAD Snapping accurately targets structural columns, faces, and beam lines', () => {
    const floorPlans = FloorPlanEngine.extractFloorPlans(model);
    const firstFloor = floorPlans[1];

    const snapSettings: SnapSettings = {
      enabled: true,
      endpoint: true,
      midpoint: true,
      intersection: true,
      center: true,
      perpendicular: true,
      parallel: true,
      nearest: true,
      columnCenter: true,
      columnFace: true,
      beamCenterline: true,
      grid: true,
      tolerance: 0.35, // 350mm snap radius
    };

    // 1. Snap near Column at (6, 0)
    const snapCol = SnapEngine.findSnapPoint(
      { x: 6.12, y: 0.08 },
      [],
      snapSettings,
      firstFloor,
      model
    );
    expect(snapCol.type).toBe('COLUMN_CENTER');
    expect(snapCol.point.x).toBeCloseTo(6.0);
    expect(snapCol.point.y).toBeCloseTo(0.0);

    // 2. Snap near Beam midpoint between (0,0) and (6,0) -> (3, 0)
    const snapBeam = SnapEngine.findSnapPoint(
      { x: 3.05, y: 0.1 },
      [],
      snapSettings,
      firstFloor,
      model
    );
    expect(snapBeam.type).toBe('BEAM_CENTERLINE');
    expect(snapBeam.point.x).toBeCloseTo(3.05);
    expect(snapBeam.point.y).toBeCloseTo(0.0);
  });

  it('Step 3: Creates complete 2D architectural building floor plan with envelope and partitions', () => {
    const walls: Record<string, ArchitecturalWall> = {};

    // External 230mm Envelope: 12m x 8m (Area = 96 m²)
    const w1 = WallEngine.createWall({ x: 0, y: 0 }, { x: 12, y: 0 }, 'floor_1', [], 0.23, 3.2, 'EXTERNAL');
    const w2 = WallEngine.createWall({ x: 12, y: 0 }, { x: 12, y: 8 }, 'floor_1', [w1.id], 0.23, 3.2, 'EXTERNAL');
    const w3 = WallEngine.createWall({ x: 12, y: 8 }, { x: 0, y: 8 }, 'floor_1', [w1.id, w2.id], 0.23, 3.2, 'EXTERNAL');
    const w4 = WallEngine.createWall({ x: 0, y: 8 }, { x: 0, y: 0 }, 'floor_1', [w1.id, w2.id, w3.id], 0.23, 3.2, 'EXTERNAL');

    // Internal 115mm Partitions:
    // Vertical partition at X = 7.0m from Y=0 to Y=8
    const w5 = WallEngine.createWall({ x: 7, y: 0 }, { x: 7, y: 8 }, 'floor_1', [w1.id, w2.id, w3.id, w4.id], 0.115, 3.2, 'INTERNAL');
    // Horizontal partition at Y = 4.5m from X=0 to X=7
    const w6 = WallEngine.createWall({ x: 0, y: 4.5 }, { x: 7, y: 4.5 }, 'floor_1', [w1.id, w2.id, w3.id, w4.id, w5.id], 0.115, 3.2, 'INTERNAL');
    // Horizontal partition at Y = 3.5m from X=7 to X=12
    const w7 = WallEngine.createWall({ x: 7, y: 3.5 }, { x: 12, y: 3.5 }, 'floor_1', [w1.id, w2.id, w3.id, w4.id, w5.id, w6.id], 0.115, 3.2, 'INTERNAL');

    [w1, w2, w3, w4, w5, w6, w7].forEach((w) => {
      walls[w.id] = w;
    });

    expect(Object.keys(walls).length).toBe(7);

    // Step 4: Host Doors, Windows, and Openings
    const doors: Record<string, ArchitecturalDoor> = {};
    const windows: Record<string, ArchitecturalWindow> = {};
    const openings: Record<string, ArchitecturalOpening> = {};

    // Main Entrance Door in Wall 1 (1.2m x 2.1m)
    const d1 = DoorEngine.createDoor(w1, { x: 3.5, y: 0 }, 'floor_1', [], 1.2, 2.1, 'SINGLE', 'RIGHT');
    doors[d1.id] = d1;

    // Bedroom Door in Wall 6 (0.9m x 2.1m)
    const d2 = DoorEngine.createDoor(w6, { x: 3.5, y: 4.5 }, 'floor_1', [d1.id], 0.9, 2.1, 'SINGLE', 'LEFT');
    doors[d2.id] = d2;

    // Kitchen Door in Wall 5 (0.9m x 2.1m)
    const d3 = DoorEngine.createDoor(w5, { x: 7, y: 2.0 }, 'floor_1', [d1.id, d2.id], 0.9, 2.1, 'SINGLE', 'RIGHT');
    doors[d3.id] = d3;

    // Windows in Exterior Walls
    const win1 = WindowEngine.createWindow(w1, { x: 9.5, y: 0 }, 'floor_1', [], 1.5, 1.2, 0.9, 'CASEMENT');
    const win2 = WindowEngine.createWindow(w3, { x: 3.5, y: 8 }, 'floor_1', [win1.id], 1.5, 1.2, 0.9, 'CASEMENT');
    const win3 = WindowEngine.createWindow(w3, { x: 9.5, y: 8 }, 'floor_1', [win1.id, win2.id], 1.5, 1.2, 0.9, 'CASEMENT');
    windows[win1.id] = win1;
    windows[win2.id] = win2;
    windows[win3.id] = win3;

    // Opening (Archway) in Wall 7 (1.2m x 2.1m)
    const op1 = OpeningEngine.createOpening(w7, { x: 9.5, y: 3.5 }, 'floor_1', [], 1.2, 2.1, 0, 'ARCHWAY');
    openings[op1.id] = op1;

    expect(Object.keys(doors).length).toBe(3);
    expect(Object.keys(windows).length).toBe(3);
    expect(Object.keys(openings).length).toBe(1);

    // Step 5: Automatic Planar Graph Room Cycle Detection
    const detectedRooms = RoomEngine.detectRoomsFromWalls(Object.values(walls), 'floor_1', []);
    expect(detectedRooms.length).toBe(4);

    // Total detected area should sum up close to the 12m x 8m rectangle (96 m²)
    const totalRoomArea = detectedRooms.reduce((sum, r) => sum + r.area, 0);
    expect(totalRoomArea).toBeCloseTo(96.0, 0);

    // Step 6: Transparent Mathematical Quantity Takeoff Verification
    const takeoff = ArchitecturalTakeoffEngine.calculateBuildingTakeoff(
      walls,
      doors,
      windows,
      openings,
      {},
      [{
        levelIndex: 1,
        levelName: '1st Floor',
        sheetNumber: 'ARCH-101',
        elevationY: 3.2,
        isFoundationLevel: false,
        beams: [],
        columns: [],
        gradeBeams: [],
        slabs: [],
        gridLinesX: [],
        gridLinesZ: [],
        combinedPileCaps: [],
        absorbedCombinedCapNodeIds: new Set(),
        bounds: { minX: 0, maxX: 12, minZ: 0, maxZ: 8, width: 12, height: 8 },
        metrics: { totalBeams: 0, totalColumns: 0, totalSlabs: 0, totalConcreteM3: 0, totalSteelKg: 0, totalFloorAreaM2: 96 },
      }]
    );

    // Gross External Envelope Volume: (12+8+12+8) * 0.23 * 3.2 = 40 * 0.736 = 29.44 m³
    // Gross Internal Partitions: (8 + 7 + 5) * 0.115 * 3.2 = 20 * 0.368 = 7.36 m³
    // Total Gross Masonry = 29.44 + 7.36 = 36.80 m³
    expect(takeoff.grandTotalGrossMasonryM3).toBeCloseTo(36.80, 1);

    // Deductions:
    // Door 1 (Ext): 1.2 * 2.1 * 0.23 = 0.5796 m³
    // Door 2 (Int): 0.9 * 2.1 * 0.115 = 0.21735 m³
    // Door 3 (Int): 0.9 * 2.1 * 0.115 = 0.21735 m³
    // Window 1 (Ext): 1.5 * 1.2 * 0.23 = 0.414 m³
    // Window 2 (Ext): 1.5 * 1.2 * 0.23 = 0.414 m³
    // Window 3 (Ext): 1.5 * 1.2 * 0.23 = 0.414 m³
    // Opening 1 (Int): 1.2 * 2.1 * 0.115 = 0.2898 m³
    // Total Deductions = 0.5796 + 0.21735 + 0.21735 + 0.414*3 + 0.2898 = 2.5461 m³
    // Net Masonry = 36.80 - 2.5461 = 34.25 m³
    expect(takeoff.grandTotalNetMasonryM3).toBeCloseTo(34.25, 1);
    expect(takeoff.grandTotalDoors).toBe(3);
    expect(takeoff.grandTotalWindows).toBe(3);
    expect(takeoff.grandTotalOpenings).toBe(1);

    // Plastering Surfaces (Gross 128 m² minus Door 1 (2.52 m²) and 3 Windows (5.4 m²) = 120.08 m²)
    expect(takeoff.grandTotalInternalPlasterM2).toBeGreaterThan(150);
    expect(takeoff.grandTotalExternalPlasterM2).toBeCloseTo(40 * 3.2 - (1.2 * 2.1 + 3 * 1.5 * 1.2), 1);

    // Step 7: Live 3D BIM Mesh Generation
    const layer = new Architectural3DLayer();
    layer.update(walls, doors, windows, openings, {}, null);

    const threeGroup = layer.getGroup();
    expect(threeGroup.children.length).toBeGreaterThan(0);

    // Mesh count includes walls, segmented openings, door panels, and glass panes
    expect(threeGroup.children.length).toBeGreaterThanOrEqual(7);

    // Verify clean disposal and zero memory leaks
    layer.dispose();
    expect(threeGroup.children.length).toBe(0);
  });
});
