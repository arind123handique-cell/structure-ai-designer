/**
 * Architectural BIM Quantity Surveying and Takeoff Engine
 * Performs exact L × B × H calculations, opening deductions, masonry, plaster, doors/windows schedules.
 */

import {
  ArchitecturalWall,
  ArchitecturalDoor,
  ArchitecturalWindow,
  ArchitecturalOpening,
  ArchitecturalRoom,
  WallTakeoffItem,
  DoorTakeoffItem,
  WindowTakeoffItem,
  OpeningTakeoffItem,
  FloorTakeoffSummary,
  BuildingArchitecturalTakeoff,
} from '../types/architecturalTypes';
import { ArchitecturalGeometryEngine } from './architecturalGeometryEngine';
import { FloorPlanLevel } from '@/features/drawings/floorPlanEngine';

export class ArchitecturalTakeoffEngine {
  /**
   * Calculates comprehensive architectural takeoff for all floors in the building
   */
  public static calculateBuildingTakeoff(
    walls: Record<string, ArchitecturalWall>,
    doors: Record<string, ArchitecturalDoor>,
    windows: Record<string, ArchitecturalWindow>,
    openings: Record<string, ArchitecturalOpening>,
    rooms: Record<string, ArchitecturalRoom>,
    floorPlans: FloorPlanLevel[]
  ): BuildingArchitecturalTakeoff {
    const wallList = Object.values(walls);
    const doorList = Object.values(doors);
    const windowList = Object.values(windows);
    const openingList = Object.values(openings);
    const roomList = Object.values(rooms);

    // Group elements by floorId
    const floorIds = new Set<string>();
    floorPlans.forEach((fp, idx) => floorIds.add(`floor_${idx}`));
    wallList.forEach((w) => floorIds.add(w.floorId));
    doorList.forEach((d) => floorIds.add(d.floorId));
    windowList.forEach((w) => floorIds.add(w.floorId));
    roomList.forEach((r) => floorIds.add(r.floorId));

    const floorSummaries: FloorTakeoffSummary[] = [];

    // Sort floors by index if possible
    const sortedFloorIds = Array.from(floorIds).sort();

    for (const fId of sortedFloorIds) {
      const floorIdx = parseInt(fId.replace('floor_', ''), 10);
      const fpMatch = !isNaN(floorIdx) && floorPlans[floorIdx] ? floorPlans[floorIdx] : null;
      const floorName = fpMatch ? fpMatch.levelName : `Floor ${fId}`;
      const elevationY = fpMatch ? fpMatch.elevationY : 0;

      const floorWalls = wallList.filter((w) => w.floorId === fId);
      const floorDoors = doorList.filter((d) => d.floorId === fId);
      const floorWindows = windowList.filter((w) => w.floorId === fId);
      const floorOpenings = openingList.filter((o) => o.floorId === fId);
      const floorRooms = roomList.filter((r) => r.floorId === fId);

      const wallTakeoffItems: WallTakeoffItem[] = [];

      let floorGrossMasonry = 0;
      let floorNetMasonry = 0;
      let floorInternalPlaster = 0;
      let floorExternalPlaster = 0;

      for (const wall of floorWalls) {
        const length = parseFloat(ArchitecturalGeometryEngine.distance(wall.start, wall.end).toFixed(2));
        const thickness = wall.thickness;
        const height = wall.height;
        const grossVol = parseFloat((length * thickness * height).toFixed(3));

        // Find doors hosted by this wall
        const hostedDoors = floorDoors.filter((d) => d.hostWallId === wall.id);
        const doorDeductions = hostedDoors.map((d) => {
          const vol = parseFloat((d.width * thickness * d.height).toFixed(3));
          return {
            doorId: d.id,
            width: d.width,
            height: d.height,
            volume: vol,
          };
        });

        // Find windows hosted by this wall
        const hostedWindows = floorWindows.filter((w) => w.hostWallId === wall.id);
        const windowDeductions = hostedWindows.map((w) => {
          const vol = parseFloat((w.width * thickness * w.height).toFixed(3));
          return {
            windowId: w.id,
            width: w.width,
            height: w.height,
            volume: vol,
          };
        });

        // Find openings hosted by this wall
        const hostedOpenings = floorOpenings.filter((o) => o.hostWallId === wall.id);
        const openingDeductions = hostedOpenings.map((o) => {
          const vol = parseFloat((o.width * thickness * o.height).toFixed(3));
          return {
            openingId: o.id,
            width: o.width,
            height: o.height,
            volume: vol,
          };
        });

        const totalDeductionVol = parseFloat(
          (
            doorDeductions.reduce((sum, d) => sum + d.volume, 0) +
            windowDeductions.reduce((sum, w) => sum + w.volume, 0) +
            openingDeductions.reduce((sum, o) => sum + o.volume, 0)
          ).toFixed(3)
        );

        const netVol = parseFloat(Math.max(0, grossVol - totalDeductionVol).toFixed(3));

        // Plaster calculations (m²)
        const wallFaceArea = length * height;
        const totalOpeningFaceArea =
          hostedDoors.reduce((sum, d) => sum + d.width * d.height, 0) +
          hostedWindows.reduce((sum, w) => sum + w.width * w.height, 0) +
          hostedOpenings.reduce((sum, o) => sum + o.width * o.height, 0);

        // Standard IS 1200 plaster deduction rules:
        // Area > 0.5m²: deduct one face or deduct net opening with reveal jambs added
        const netFacePlasterArea = Math.max(0, wallFaceArea - totalOpeningFaceArea);
        const internalPlaster = parseFloat((netFacePlasterArea * (wall.wallType === 'EXTERNAL' ? 1.0 : 2.0)).toFixed(2));
        const externalPlaster = parseFloat((wall.wallType === 'EXTERNAL' ? netFacePlasterArea : 0).toFixed(2));

        wallTakeoffItems.push({
          wallId: wall.id,
          floorId: fId,
          wallType: wall.wallType,
          length,
          thickness,
          height,
          grossVolume: grossVol,
          doorDeductions,
          windowDeductions,
          openingDeductions,
          totalOpeningVolume: totalDeductionVol,
          netMasonryVolume: netVol,
          internalPlasterArea: internalPlaster,
          externalPlasterArea: externalPlaster,
        });

        floorGrossMasonry += grossVol;
        floorNetMasonry += netVol;
        floorInternalPlaster += internalPlaster;
        floorExternalPlaster += externalPlaster;
      }

      // Door schedule
      const doorTakeoffItems: DoorTakeoffItem[] = floorDoors.map((d) => ({
        doorId: d.id,
        floorId: fId,
        type: d.doorType,
        width: Math.round(d.width * 1000),
        height: Math.round(d.height * 1000),
        area: parseFloat((d.width * d.height).toFixed(2)),
        quantity: 1,
      }));

      // Window schedule
      const windowTakeoffItems: WindowTakeoffItem[] = floorWindows.map((w) => ({
        windowId: w.id,
        floorId: fId,
        type: w.windowType,
        width: Math.round(w.width * 1000),
        height: Math.round(w.height * 1000),
        sillHeight: Math.round(w.sillHeight * 1000),
        area: parseFloat((w.width * w.height).toFixed(2)),
        quantity: 1,
      }));

      // Opening schedule
      const openingTakeoffItems: OpeningTakeoffItem[] = floorOpenings.map((o) => ({
        openingId: o.id,
        floorId: fId,
        type: o.openingType,
        width: Math.round(o.width * 1000),
        height: Math.round(o.height * 1000),
        area: parseFloat((o.width * o.height).toFixed(2)),
        quantity: 1,
      }));

      const floorTotalArea = floorRooms.reduce((sum, r) => sum + r.area, 0);

      floorSummaries.push({
        floorId: fId,
        floorName,
        elevationY,
        walls: wallTakeoffItems,
        doors: doorTakeoffItems,
        windows: windowTakeoffItems,
        openings: openingTakeoffItems,
        rooms: floorRooms,
        totalGrossMasonryM3: parseFloat(floorGrossMasonry.toFixed(3)),
        totalNetMasonryM3: parseFloat(floorNetMasonry.toFixed(3)),
        totalInternalPlasterM2: parseFloat(floorInternalPlaster.toFixed(2)),
        totalExternalPlasterM2: parseFloat(floorExternalPlaster.toFixed(2)),
        totalDoorCount: floorDoors.length,
        totalWindowCount: floorWindows.length,
        totalOpeningCount: floorOpenings.length,
        totalFloorAreaM2: parseFloat(floorTotalArea.toFixed(2)),
      });
    }

    const grandTotalNetMasonry = floorSummaries.reduce((sum, f) => sum + f.totalNetMasonryM3, 0);
    const grandTotalGrossMasonry = floorSummaries.reduce((sum, f) => sum + f.totalGrossMasonryM3, 0);
    const grandTotalInternalPlaster = floorSummaries.reduce((sum, f) => sum + f.totalInternalPlasterM2, 0);
    const grandTotalExternalPlaster = floorSummaries.reduce((sum, f) => sum + f.totalExternalPlasterM2, 0);
    const grandTotalDoors = floorSummaries.reduce((sum, f) => sum + f.totalDoorCount, 0);
    const grandTotalWindows = floorSummaries.reduce((sum, f) => sum + f.totalWindowCount, 0);
    const grandTotalOpenings = floorSummaries.reduce((sum, f) => sum + f.totalOpeningCount, 0);
    const grandTotalFloorArea = floorSummaries.reduce((sum, f) => sum + f.totalFloorAreaM2, 0);

    return {
      floorSummaries,
      grandTotalNetMasonryM3: parseFloat(grandTotalNetMasonry.toFixed(3)),
      grandTotalGrossMasonryM3: parseFloat(grandTotalGrossMasonry.toFixed(3)),
      grandTotalInternalPlasterM2: parseFloat(grandTotalInternalPlaster.toFixed(2)),
      grandTotalExternalPlasterM2: parseFloat(grandTotalExternalPlaster.toFixed(2)),
      grandTotalDoors,
      grandTotalWindows,
      grandTotalOpenings,
      grandTotalFloorAreaM2: parseFloat(grandTotalFloorArea.toFixed(2)),
    };
  }
}
