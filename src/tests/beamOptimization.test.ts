import { describe, it, expect } from 'vitest';
import { BeamOptimizationEngine } from '@/features/design/beam/beamOptimizationEngine';
import { NormalizedStructuralModel, Member3D } from '@/features/model/types';

describe('BeamOptimizationEngine', () => {
  it('should find the most economical passing section and rebars for a beam', () => {
    const mockBeam: Member3D = {
      id: 101,
      startNodeId: 1,
      endNodeId: 2,
      length: 4.5,
      classification: 'BEAM',
      section: {
        name: '350x750 mm', // Over-designed section
        zd: 0.35,
        yd: 0.75,
      },
    } as any;

    const mockModel: Partial<NormalizedStructuralModel> = {
      nodes: new Map([
        [1, { id: 1, x: 0, y: 3.5, z: 0 }],
        [2, { id: 2, x: 4.5, y: 3.5, z: 0 }],
      ]),
      memberForces: [
        {
          memberId: 101,
          loadCaseId: 1,
          sectionLocation: 0,
          axial: 0,
          vy: 30,
          vz: 0,
          torsion: 0,
          my: 0,
          mz: 45,
        },
      ],
    };

    const optResult = BeamOptimizationEngine.optimizeSingleBeam(
      mockBeam,
      mockModel as NormalizedStructuralModel,
      25,
      500,
      30
    );

    // Optimized section should be smaller and more economical than 350x750 mm (e.g. 230x350 or 230x400)
    expect(optResult.optimizedDesign.status).toBe('PASS');
    expect(optResult.concreteVolumeOptimized).toBeLessThan(optResult.concreteVolumeOriginal);
    expect(optResult.optimizedCost).toBeLessThan(optResult.originalCost);
    expect(optResult.costSavingsPercent).toBeGreaterThan(0);
  });

  it('should batch optimize all beams in a structure', () => {
    const beams: Member3D[] = [
      {
        id: 1,
        startNodeId: 1,
        endNodeId: 2,
        length: 4.0,
        classification: 'BEAM',
        section: { name: '300x600 mm', zd: 0.30, yd: 0.60 },
      } as any,
      {
        id: 2,
        startNodeId: 2,
        endNodeId: 3,
        length: 5.0,
        classification: 'BEAM',
        section: { name: '300x600 mm', zd: 0.30, yd: 0.60 },
      } as any,
    ];

    const mockModel: Partial<NormalizedStructuralModel> = {
      nodes: new Map([
        [1, { id: 1, x: 0, y: 3.5, z: 0 }],
        [2, { id: 2, x: 4.0, y: 3.5, z: 0 }],
        [3, { id: 3, x: 9.0, y: 3.5, z: 0 }],
      ]),
      memberForces: [],
    };

    const summary = BeamOptimizationEngine.optimizeAllBeams(
      beams,
      mockModel as NormalizedStructuralModel,
      25,
      500,
      30
    );

    expect(summary.totalBeams).toBe(2);
    expect(summary.passedCount).toBe(2);
    expect(summary.sectionUpdates.length).toBe(2);
    expect(summary.concreteSavedPercent).toBeGreaterThanOrEqual(0);
  });
});
