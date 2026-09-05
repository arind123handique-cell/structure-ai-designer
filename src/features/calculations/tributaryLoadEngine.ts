import { NormalizedStructuralModel, Member3D, MemberLoad } from '@/features/model/types';
import { FloorPlanEngine, FloorPlanLevel } from '@/features/drawings/floorPlanEngine';

export interface TributaryBay {
  id: string;
  levelY: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  lx: number; // short/long span
  lz: number;
  area: number; // m2
  isTwoWay: boolean;
  aspectRatio: number;
  boundaryBeamIds: number[];
}

export interface TributaryDistributionResult {
  totalBays: number;
  totalFloorAreaM2: number;
  totalFloorLoadKn: number;
  assignedLoads: MemberLoad[];
  bays: TributaryBay[];
}

export class TributaryLoadEngine {
  /**
   * Automatically calculates and distributes 45-degree yield-line slab loads to framing beams
   */
  public static computeTributaryLoads(
    model: NormalizedStructuralModel | null,
    levelY?: number,
    deadFloorFinishKnM2: number = 1.5,
    liveLoadKnM2: number = 3.0
  ): TributaryDistributionResult {
    if (!model || model.members.size === 0) {
      return {
        totalBays: 0,
        totalFloorAreaM2: 0,
        totalFloorLoadKn: 0,
        assignedLoads: [],
        bays: [],
      };
    }

    const floorPlans = FloorPlanEngine.extractAllFloorPlans(model);
    const targetLevels = levelY !== undefined
      ? floorPlans.filter((fp) => Math.abs(fp.elevationY - levelY) < 0.2)
      : floorPlans.filter((fp) => fp.beams.length > 0);

    const totalAssignedLoads: MemberLoad[] = [];
    const detectedBays: TributaryBay[] = [];
    let totalFloorArea = 0;
    let totalFloorLoad = 0;

    targetLevels.forEach((fp) => {
      // Find grid bounds and beam connectivity
      const beams = fp.beams;
      const xCoords = Array.from(new Set(fp.columns.map((c) => Math.round(c.x * 100) / 100))).sort((a, b) => a - b);
      const zCoords = Array.from(new Set(fp.columns.map((c) => Math.round(c.z * 100) / 100))).sort((a, b) => a - b);

      for (let i = 0; i < xCoords.length - 1; i++) {
        for (let j = 0; j < zCoords.length - 1; j++) {
          const x1 = xCoords[i];
          const x2 = xCoords[i + 1];
          const z1 = zCoords[j];
          const z2 = zCoords[j + 1];

          const lx = Math.abs(x2 - x1);
          const lz = Math.abs(z2 - z1);
          if (lx < 1.0 || lz < 1.0) continue;

          const area = lx * lz;
          totalFloorArea += area;

          const lShort = Math.min(lx, lz);
          const lLong = Math.max(lx, lz);
          const r = lLong / lShort;
          const isTwoWay = r <= 2.0;

          // Find boundary beams for this bay
          const bayBeamIds: number[] = [];

          beams.forEach((b) => {
            const bMidX = (b.startX + b.endX) / 2;
            const bMidZ = (b.startZ + b.endZ) / 2;

            const isNorthOrSouth = Math.abs(bMidZ - z1) < 0.15 || Math.abs(bMidZ - z2) < 0.15;
            const isEastOrWest = Math.abs(bMidX - x1) < 0.15 || Math.abs(bMidX - x2) < 0.15;

            if ((isNorthOrSouth && bMidX >= x1 - 0.1 && bMidX <= x2 + 0.1) ||
                (isEastOrWest && bMidZ >= z1 - 0.1 && bMidZ <= z2 + 0.1)) {
              bayBeamIds.push(b.memberId);

              // Calculate equivalent UDL on this beam:
              const isShortSpanBeam = Math.abs(b.length - lShort) < 0.5;

              // Dead Load (Floor finish)
              let weqDead = 0;
              let weqLive = 0;

              if (isTwoWay) {
                if (isShortSpanBeam) {
                  // Triangular load: weq = q * Lx / 3
                  weqDead = (deadFloorFinishKnM2 * lShort) / 3;
                  weqLive = (liveLoadKnM2 * lShort) / 3;
                } else {
                  // Trapezoidal load: weq = (q * Lx / 2) * (1 - 1/(3*r^2))
                  const factor = 1 - 1 / (3 * r * r);
                  weqDead = ((deadFloorFinishKnM2 * lShort) / 2) * factor;
                  weqLive = ((liveLoadKnM2 * lShort) / 2) * factor;
                }
              } else {
                // One-way slab: loads transfer only to long span beams
                if (!isShortSpanBeam) {
                  weqDead = (deadFloorFinishKnM2 * lShort) / 2;
                  weqLive = (liveLoadKnM2 * lShort) / 2;
                }
              }

              if (weqDead > 0.05) {
                totalAssignedLoads.push({
                  id: `trib_dead_${b.memberId}_${Date.now()}_${Math.random()}`,
                  memberId: b.memberId,
                  loadPattern: 'SDL',
                  type: 'UNIFORM',
                  w1: parseFloat(weqDead.toFixed(2)),
                  direction: 'GLOBAL_Y',
                });
              }

              if (weqLive > 0.05) {
                totalAssignedLoads.push({
                  id: `trib_live_${b.memberId}_${Date.now()}_${Math.random()}`,
                  memberId: b.memberId,
                  loadPattern: 'LIVE',
                  type: 'UNIFORM',
                  w1: parseFloat(weqLive.toFixed(2)),
                  direction: 'GLOBAL_Y',
                });
              }
            }
          });

          const bayLoad = area * (deadFloorFinishKnM2 + liveLoadKnM2);
          totalFloorLoad += bayLoad;

          detectedBays.push({
            id: `bay_${fp.levelIndex}_${i}_${j}`,
            levelY: fp.elevationY,
            minX: x1,
            maxX: x2,
            minZ: z1,
            maxZ: z2,
            lx,
            lz,
            area,
            isTwoWay,
            aspectRatio: r,
            boundaryBeamIds: bayBeamIds,
          });
        }
      }
    });

    return {
      totalBays: detectedBays.length,
      totalFloorAreaM2: totalFloorArea,
      totalFloorLoadKn: totalFloorLoad,
      assignedLoads: totalAssignedLoads,
      bays: detectedBays,
    };
  }
}
