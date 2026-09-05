import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { RunAnalysisWindow } from '../components/window/windows/RunAnalysisWindow';
import { useProjectStore } from '../features/projects/projectStore';
import { NormalizedStructuralModel, Node3D, Member3D, Support3D } from '../features/model/types';

describe('RunAnalysisWindow — Lifecycle and Completion Verification', () => {
  const mockModel: NormalizedStructuralModel = {
    nodes: new Map<number, Node3D>([
      [1, { id: 1, x: 0, y: 0, z: 0, isSupport: true }],
      [2, { id: 2, x: 0, y: 3.5, z: 0 }],
      [3, { id: 3, x: 4, y: 3.5, z: 0 }],
      [4, { id: 4, x: 4, y: 0, z: 0, isSupport: true }],
    ]),
    members: new Map<number, Member3D>([
      [
        1,
        {
          id: 1,
          startNodeId: 1,
          endNodeId: 2,
          length: 3.5,
          classification: 'COLUMN',
          isAutoClassified: false,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.45, name: 'C450x450' },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
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
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3, name: 'B300x450' },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
        },
      ],
      [
        3,
        {
          id: 3,
          startNodeId: 4,
          endNodeId: 3,
          length: 3.5,
          classification: 'COLUMN',
          isAutoClassified: false,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.45, name: 'C450x450' },
          materialName: 'CONCRETE',
          designStatus: 'NOT_DESIGNED',
        },
      ],
    ]),
    plates: new Map(),
    supports: new Map<number, Support3D>([
      [1, { nodeId: 1, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [4, { nodeId: 4, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
    ]),
    loadCases: new Map([
      [1, { id: 1, title: 'Dead Load (DL)', type: 'DEAD', isCombination: false }],
      [2, { id: 2, title: 'Live Load (LL)', type: 'LIVE', isCombination: false }],
    ]),
    loadCombinations: new Map([
      [101, { id: 101, title: '1.5(DL + LL)', factors: [{ loadCaseId: 1, factor: 1.5 }, { loadCaseId: 2, factor: 1.5 }] }],
    ]),
    reactions: [],
    memberForces: [],
    storyDrifts: [],
    nodeDisplacements: new Map(),
    boundingBox: { minX: 0, maxX: 4, minY: 0, maxY: 3.5, minZ: 0, maxZ: 0 },
    statistics: {
      totalNodes: 4,
      totalMembers: 3,
      totalBeams: 1,
      totalColumns: 2,
      totalPlates: 0,
      totalSupports: 2,
      totalLoadCases: 2,
      totalCombinations: 1,
      maxElevation: 3.5,
      baseElevation: 0,
    },
  };

  const dummyInstance = {
    instanceId: 'w1',
    windowId: 'runAnalysis',
    placement: { x: 0, y: 0, width: 460, height: 440 },
    zIndex: 1,
    minimized: false,
    dirty: false,
    modal: false,
    restoredHeight: 440,
  };

  beforeEach(() => {
    useProjectStore.setState({
      activeModel: mockModel,
      activeProject: null,
      isLoading: false,
    });
  });

  it('renders initial config view with member and node counts', () => {
    render(
      <RunAnalysisWindow
        instance={dummyInstance}
        close={() => {}}
        setDirty={() => {}}
      />
    );
    expect(screen.getByText('Analysis Options')).toBeDefined();
    expect(screen.getByText('Model Summary')).toBeDefined();
    expect(screen.getByText('Run Analysis')).toBeDefined();
  });

  it('executes analysis and transitions smoothly to Analysis Complete without hanging on Step 8', async () => {
    render(
      <RunAnalysisWindow
        instance={dummyInstance}
        close={() => {}}
        setDirty={() => {}}
      />
    );

    const runBtn = screen.getByText('Run Analysis');
    await act(async () => {
      fireEvent.click(runBtn);
    });

    // Await completion (which now finishes in < 1.5 seconds instead of hanging or waiting 12s)
    await waitFor(
      () => {
        expect(screen.getByText('Analysis Complete')).toBeDefined();
      },
      { timeout: 3000 }
    );

    // Verify results were populated into the store
    const finalModel = useProjectStore.getState().activeModel!;
    expect(finalModel.memberForces.length).toBeGreaterThan(0);
    expect(finalModel.reactions.length).toBeGreaterThan(0);
    expect(finalModel.nodeDisplacements).toBeDefined();
    expect(finalModel.nodeDisplacements!.size).toBeGreaterThan(0);
  });
});
