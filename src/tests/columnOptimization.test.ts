import { describe, it, expect } from 'vitest';
import { ColumnOptimizationEngine } from '@/features/design/column/columnOptimizationEngine';
import { NormalizedStructuralModel, Member3D } from '@/features/model/types';

describe('ColumnOptimizationEngine', () => {
  it('should find the most economical passing section and rebars for a column', () => {
    const mockColumn: Member3D = {
      id: 201,
      startNodeId: 1,
      endNodeId: 2,
      length: 3.5,
      classification: 'COLUMN',
      section: {
        name: '600x750 mm', // Over-designed section
        zd: 0.60,
        yd: 0.75,
      },
    } as any;

    const mockModel: Partial<NormalizedStructuralModel> = {
      nodes: new Map([
        [1, { id: 1, x: 0, y: 0, z: 0 }],
        [2, { id: 2, x: 0, y: 3.5, z: 0 }],
      ]),
      memberForces: [
        {
          memberId: 201,
          loadCaseId: 1,
          sectionLocation: 0,
          axial: 450,
          vy: 15,
          vz: 10,
          torsion: 0,
          my: 15,
          mz: 20,
        },
      ],
    };

    const optResult = ColumnOptimizationEngine.optimizeSingleColumn(
      mockColumn,
      mockModel as NormalizedStructuralModel,
      25,
      500,
      40
    );

    expect(optResult.optimizedDesign.status).toBe('PASS');
    expect(optResult.optimizedDesign.biaxialCheck.interactionRatio).toBeLessThanOrEqual(1.0);
    expect(optResult.concreteVolumeOptimized).toBeLessThan(optResult.concreteVolumeOriginal);
    expect(optResult.optimizedCost).toBeLessThan(optResult.originalCost);
    expect(optResult.costSavingsPercent).toBeGreaterThan(0);
  });

  it('should batch optimize all columns in a structure', () => {
    const columns: Member3D[] = [
      {
        id: 101,
        startNodeId: 1,
        endNodeId: 2,
        length: 3.5,
        classification: 'COLUMN',
        section: { name: '500x600 mm', zd: 0.50, yd: 0.60 },
      } as any,
      {
        id: 102,
        startNodeId: 3,
        endNodeId: 4,
        length: 3.5,
        classification: 'COLUMN',
        section: { name: '500x600 mm', zd: 0.50, yd: 0.60 },
      } as any,
    ];

    const mockModel: Partial<NormalizedStructuralModel> = {
      nodes: new Map([
        [1, { id: 1, x: 0, y: 0, z: 0 }],
        [2, { id: 2, x: 0, y: 3.5, z: 0 }],
        [3, { id: 3, x: 5, y: 0, z: 0 }],
        [4, { id: 4, x: 5, y: 3.5, z: 0 }],
      ]),
      memberForces: [],
    };

    const summary = ColumnOptimizationEngine.optimizeAllColumns(
      columns,
      mockModel as NormalizedStructuralModel,
      25,
      500,
      40
    );

    expect(summary.totalColumns).toBe(2);
    expect(summary.passedCount).toBe(2);
    expect(summary.sectionUpdates.length).toBe(2);
    expect(summary.concreteSavedPercent).toBeGreaterThanOrEqual(0);
  });
});
