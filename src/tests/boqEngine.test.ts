import { describe, it, expect } from 'vitest';
import { BoqEngine } from '@/features/calculations/boqEngine';
import { NormalizedStructuralModel } from '@/features/model/types';

describe('Quantity Takeoff & BOQ Engine (Architecture Sections 29 & 30)', () => {
  const model: NormalizedStructuralModel = {
    nodes: new Map([
      [1, { id: 1, x: 0, y: 0, z: 0, isSupport: true }],
      [2, { id: 2, x: 0, y: 3.2, z: 0 }],
      [3, { id: 3, x: 4, y: 3.2, z: 0 }],
      [4, { id: 4, x: 4, y: 0, z: 0, isSupport: true }],
    ]),
    members: new Map([
      [
        1,
        {
          id: 1,
          startNodeId: 1,
          endNodeId: 2,
          length: 3.2,
          classification: 'COLUMN',
          isAutoClassified: false,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
          materialName: 'CONCRETE',
          designStatus: 'PASS',
        },
      ],
      [
        2,
        {
          id: 2,
          startNodeId: 2,
          endNodeId: 3,
          length: 4.0,
          classification: 'BEAM',
          isAutoClassified: false,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.25 },
          materialName: 'CONCRETE',
          designStatus: 'PASS',
        },
      ],
      [
        3,
        {
          id: 3,
          startNodeId: 4,
          endNodeId: 3,
          length: 3.2,
          classification: 'COLUMN',
          isAutoClassified: false,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
          materialName: 'CONCRETE',
          designStatus: 'PASS',
        },
      ],
    ]),
    plates: new Map(),
    supports: new Map([
      [1, { nodeId: 1, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [4, { nodeId: 4, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
    ]),
    loadCases: new Map(),
    loadCombinations: new Map(),
    reactions: [],
    memberForces: [],
    storyDrifts: [],
    boundingBox: { minX: 0, maxX: 4, minY: 0, maxY: 3.2, minZ: 0, maxZ: 0 },
    statistics: {
      totalNodes: 4,
      totalMembers: 3,
      totalBeams: 1,
      totalColumns: 2,
      totalPlates: 0,
      totalSupports: 2,
      totalLoadCases: 0,
      totalCombinations: 0,
      maxElevation: 3.2,
      baseElevation: 0,
    },
  };

  it('generates itemized L × B × H measurement sheets with CPWD rates', () => {
    const boq = BoqEngine.generateBuildingBoq(model);

    expect(boq.measurementSheet.length).toBeGreaterThanOrEqual(6);
    expect(boq.grandTotalAmountInr).toBeGreaterThan(0);

    const earthwork = boq.measurementSheet.find((item) => item.itemNo === '1.0');
    expect(earthwork).toBeDefined();
    expect(earthwork?.quantity).toBeGreaterThan(0);
    expect(earthwork?.unit).toBe('m3');
    expect(earthwork?.lengthM).toBeGreaterThan(0);
    expect(earthwork?.breadthM).toBeGreaterThan(0);
    expect(earthwork?.heightOrDepthM).toBeGreaterThan(0);

    const columnsItem = boq.measurementSheet.find((item) => item.itemNo === '4.0');
    expect(columnsItem).toBeDefined();
    expect(columnsItem?.quantity).toBeGreaterThan(0);
  });

  it('produces diameter-wise steel reinforcement takeoff in metric tonnes', () => {
    const boq = BoqEngine.generateBuildingBoq(model);

    expect(boq.totalRebarWeightMt).toBeGreaterThan(0);
    expect(boq.rebarTakeoffMt[8]).toBeGreaterThan(0);
    expect(boq.rebarTakeoffMt[12]).toBeGreaterThan(0);
    expect(boq.rebarTakeoffMt[16]).toBeGreaterThan(0);
  });
});
