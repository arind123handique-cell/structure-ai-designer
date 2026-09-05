import { describe, it, expect, beforeEach } from 'vitest';
import { CommandManager } from '@/features/commands/commandManager';
import {
  AddNodeCommand,
  AddMemberCommand,
  AssignSectionCommand,
  AssignSupportCommand,
  BatchTransactionCommand,
} from '@/features/commands/structuralCommands';
import { NormalizedStructuralModel } from '@/features/model/types';

describe('Command & Transaction Architecture (STAAD.Pro Architecture Sections 26 & 27)', () => {
  let model: NormalizedStructuralModel;
  let cmdMgr: CommandManager;

  beforeEach(() => {
    CommandManager.resetInstance();
    cmdMgr = CommandManager.getInstance();

    model = {
      nodes: new Map(),
      members: new Map(),
      plates: new Map(),
      supports: new Map(),
      loadCases: new Map(),
      loadCombinations: new Map(),
      reactions: [],
      memberForces: [],
      storyDrifts: [],
      boundingBox: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10 },
      statistics: {
        totalNodes: 0,
        totalMembers: 0,
        totalBeams: 0,
        totalColumns: 0,
        totalPlates: 0,
        totalSupports: 0,
        totalLoadCases: 0,
        totalCombinations: 0,
        maxElevation: 10,
        baseElevation: 0,
      },
    };
  });

  it('correctly executes AddNodeCommand and supports Undo/Redo', async () => {
    const nodeCmd = new AddNodeCommand(model, { id: 101, x: 0, y: 0, z: 0 });
    await cmdMgr.execute(nodeCmd);

    expect(model.nodes.has(101)).toBe(true);
    expect(model.statistics.totalNodes).toBe(1);
    expect(cmdMgr.canUndo()).toBe(true);
    expect(cmdMgr.canRedo()).toBe(false);

    // Undo
    const undone = await cmdMgr.undo();
    expect(undone).toBe(true);
    expect(model.nodes.has(101)).toBe(false);
    expect(model.statistics.totalNodes).toBe(0);
    expect(cmdMgr.canUndo()).toBe(false);
    expect(cmdMgr.canRedo()).toBe(true);

    // Redo
    const redone = await cmdMgr.redo();
    expect(redone).toBe(true);
    expect(model.nodes.has(101)).toBe(true);
    expect(model.statistics.totalNodes).toBe(1);
  });

  it('handles member addition and section modification with undo/redo', async () => {
    const addMemberCmd = new AddMemberCommand(model, {
      id: 50,
      startNodeId: 1,
      endNodeId: 2,
      length: 4.0,
      classification: 'COLUMN',
      isAutoClassified: false,
      section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
      materialName: 'CONCRETE',
      designStatus: 'PASS',
    });

    await cmdMgr.execute(addMemberCmd);
    expect(model.members.get(50)?.classification).toBe('COLUMN');
    expect(model.statistics.totalColumns).toBe(1);

    // Assign new section
    const assignSecCmd = new AssignSectionCommand(model, 50, {
      type: 'RECTANGULAR',
      yd: 0.6,
      zd: 0.45,
      name: '450x600',
    });
    await cmdMgr.execute(assignSecCmd);
    expect(model.members.get(50)?.section.yd).toBe(0.6);

    // Undo section assignment
    await cmdMgr.undo();
    expect(model.members.get(50)?.section.yd).toBe(0.45);

    // Undo member addition
    await cmdMgr.undo();
    expect(model.members.has(50)).toBe(false);
  });

  it('supports atomic BatchTransactionCommand', async () => {
    const batch = new BatchTransactionCommand('Create Portal Frame Bay', [
      new AddNodeCommand(model, { id: 1, x: 0, y: 0, z: 0 }),
      new AddNodeCommand(model, { id: 2, x: 0, y: 3.5, z: 0 }),
      new AddNodeCommand(model, { id: 3, x: 5, y: 3.5, z: 0 }),
      new AddNodeCommand(model, { id: 4, x: 5, y: 0, z: 0 }),
      new AddMemberCommand(model, {
        id: 1,
        startNodeId: 1,
        endNodeId: 2,
        length: 3.5,
        classification: 'COLUMN',
        isAutoClassified: false,
        section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
        materialName: 'CONCRETE',
        designStatus: 'PASS',
      }),
      new AddMemberCommand(model, {
        id: 2,
        startNodeId: 2,
        endNodeId: 3,
        length: 5.0,
        classification: 'BEAM',
        isAutoClassified: false,
        section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.25 },
        materialName: 'CONCRETE',
        designStatus: 'PASS',
      }),
      new AssignSupportCommand(model, 1, {
        nodeId: 1,
        type: 'FIXED',
        releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
      }),
    ]);

    await cmdMgr.execute(batch);
    expect(model.nodes.size).toBe(4);
    expect(model.members.size).toBe(2);
    expect(model.supports.size).toBe(1);

    // Undoing the batch reverts all atomic sub-operations in reverse order
    await cmdMgr.undo();
    expect(model.nodes.size).toBe(0);
    expect(model.members.size).toBe(0);
    expect(model.supports.size).toBe(0);

    // Redoing restores entire batch
    await cmdMgr.redo();
    expect(model.nodes.size).toBe(4);
    expect(model.members.size).toBe(2);
    expect(model.supports.size).toBe(1);
  });
});
