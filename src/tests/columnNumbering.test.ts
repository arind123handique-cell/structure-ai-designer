import { describe, it, expect } from 'vitest';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { NormalizedStructuralModel, Support3D } from '@/features/model/types';

describe('ColumnNumberingService', () => {
  it('should automatically arrange and number support columns matching STAAD Node IDs (Node 1 -> C1, Node 2 -> C2)', () => {
    const mockModel: Partial<NormalizedStructuralModel> = {
      nodes: new Map([
        [1, { id: 1, x: 0, y: 0, z: 0 }],
        [2, { id: 2, x: 5, y: 0, z: 0 }],
        [3, { id: 3, x: 10, y: 0, z: 0 }],
        [4, { id: 4, x: 15, y: 0, z: 0 }],
        [11, { id: 11, x: 0, y: 3.5, z: 0 }],
        [12, { id: 12, x: 5, y: 3.5, z: 0 }],
      ]),
      supports: new Map<number, Support3D>([
        [1, { nodeId: 1, type: 'PINNED', releases: { fx: false, fy: false, fz: false, mx: true, my: true, mz: true } }],
        [2, { nodeId: 2, type: 'PINNED', releases: { fx: false, fy: false, fz: false, mx: true, my: true, mz: true } }],
        [3, { nodeId: 3, type: 'PINNED', releases: { fx: false, fy: false, fz: false, mx: true, my: true, mz: true } }],
        [4, { nodeId: 4, type: 'PINNED', releases: { fx: false, fy: false, fz: false, mx: true, my: true, mz: true } }],
      ]),
      members: new Map([
        [101, { id: 101, startNodeId: 1, endNodeId: 11, length: 3.5, classification: 'COLUMN', section: { yd: 0.45, zd: 0.45 } } as any],
        [102, { id: 102, startNodeId: 2, endNodeId: 12, length: 3.5, classification: 'COLUMN', section: { yd: 0.45, zd: 0.45 } } as any],
      ]),
    };

    const supportMapping = ColumnNumberingService.getColumnSupportMapping(mockModel as NormalizedStructuralModel);
    expect(supportMapping.size).toBe(4);

    // Node 1 -> C1, PC-1
    const colNode1 = supportMapping.get(1);
    expect(colNode1?.columnSlNo).toBe(1);
    expect(colNode1?.columnLabel).toBe('C1');
    expect(colNode1?.jointLabel).toBe('C1');
    expect(colNode1?.pileCapLabel).toBe('PC-1');

    // Node 2 -> C2, PC-2
    const colNode2 = supportMapping.get(2);
    expect(colNode2?.columnSlNo).toBe(2);
    expect(colNode2?.columnLabel).toBe('C2');
    expect(colNode2?.jointLabel).toBe('C2');
    expect(colNode2?.pileCapLabel).toBe('PC-2');

    // Member mapping check: Column Member #101 at Node 1 should be C1
    const memberMapping = ColumnNumberingService.getColumnMemberMapping(mockModel as NormalizedStructuralModel);
    const colMember101 = memberMapping.get(101);
    expect(colMember101?.columnLabel).toBe('C1');
    expect(colMember101?.columnSlNo).toBe(1);

    // Column Member #102 at Node 2 should be C2
    const colMember102 = memberMapping.get(102);
    expect(colMember102?.columnLabel).toBe('C2');
    expect(colMember102?.columnSlNo).toBe(2);
  });

  it('should guarantee strictly unique non-repeating numbers across multi-story columns', () => {
    // 2 ground columns + 2 upper story columns
    const multiStoryModel: Partial<NormalizedStructuralModel> = {
      nodes: new Map([
        [1, { id: 1, x: 0, y: 0, z: 0 }],
        [2, { id: 2, x: 5, y: 0, z: 0 }],
        [11, { id: 11, x: 0, y: 3.5, z: 0 }],
        [12, { id: 12, x: 5, y: 3.5, z: 0 }],
        [21, { id: 21, x: 0, y: 7.0, z: 0 }],
        [22, { id: 22, x: 5, y: 7.0, z: 0 }],
      ]),
      supports: new Map<number, Support3D>([
        [1, { nodeId: 1, type: 'PINNED', releases: { fx: false, fy: false, fz: false, mx: true, my: true, mz: true } }],
        [2, { nodeId: 2, type: 'PINNED', releases: { fx: false, fy: false, fz: false, mx: true, my: true, mz: true } }],
      ]),
      members: new Map([
        // Ground story columns
        [65, { id: 65, startNodeId: 1, endNodeId: 11, length: 3.5, classification: 'COLUMN', section: { yd: 0.45, zd: 0.45 } } as any],
        [69, { id: 69, startNodeId: 2, endNodeId: 12, length: 3.5, classification: 'COLUMN', section: { yd: 0.45, zd: 0.45 } } as any],
        // Upper story columns directly above
        [182, { id: 182, startNodeId: 11, endNodeId: 21, length: 3.5, classification: 'COLUMN', section: { yd: 0.45, zd: 0.45 } } as any],
        [186, { id: 186, startNodeId: 12, endNodeId: 22, length: 3.5, classification: 'COLUMN', section: { yd: 0.45, zd: 0.45 } } as any],
      ]),
    };

    const mapping = ColumnNumberingService.getColumnMemberMapping(multiStoryModel as NormalizedStructuralModel);
    expect(mapping.size).toBe(4);

    const labels = Array.from(mapping.values()).map((m) => m.columnLabel);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(4);

    expect(mapping.get(65)?.columnLabel).toBe('C1');
    expect(mapping.get(69)?.columnLabel).toBe('C2');
    expect(mapping.get(182)?.columnLabel).toBe('C3');
    expect(mapping.get(186)?.columnLabel).toBe('C4');
  });
});
