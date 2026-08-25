import { describe, it, expect } from 'vitest';
import { ANLValidator } from '@/features/anl/validation/anlValidator';
import { Node3D, Member3D, Support3D, Plate3D, JointReaction } from '@/features/model/types';

describe('ANLValidator', () => {
  it('should detect zero-length members', () => {
    const nodes = new Map<number, Node3D>([
      [1, { id: 1, x: 0, y: 0, z: 0 }],
      [2, { id: 2, x: 0, y: 0, z: 0 }],
    ]);
    const members = new Map<number, Member3D>([
      [
        1,
        {
          id: 1,
          startNodeId: 1,
          endNodeId: 2,
          length: 0,
          classification: 'BEAM',
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
        },
      ],
    ]);

    const warnings = ANLValidator.validate(nodes, members, new Map(), new Map(), []);
    expect(warnings.some((w) => w.id.includes('val_zerolen'))).toBe(true);
  });

  it('should detect missing start/end nodes in members', () => {
    const nodes = new Map<number, Node3D>([[1, { id: 1, x: 0, y: 0, z: 0 }]]);
    const members = new Map<number, Member3D>([
      [
        1,
        {
          id: 1,
          startNodeId: 1,
          endNodeId: 999, // Missing
          length: 4.0,
          classification: 'BEAM',
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
        },
      ],
    ]);

    const warnings = ANLValidator.validate(nodes, members, new Map(), new Map(), []);
    expect(warnings.some((w) => w.id.includes('val_missing_end_1'))).toBe(true);
  });
});
