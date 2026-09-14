import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Structural3DInspectorPanel } from '@/components/model-viewer/Structural3DInspectorPanel';
import {
  BeamProjectionSVG,
  ColumnProjectionSVG,
  PileCapProjectionSVG,
  PileProjectionSVG,
} from '@/components/model-viewer/ElementProjectionSVG';
import { ElementRebar3DCanvas } from '@/components/model-viewer/ElementRebar3DCanvas';

// Mock Three.js WebGLRenderer in test environment
vi.mock('three', async () => {
  const actual = await vi.importActual('three') as any;
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement('canvas'),
      shadowMap: { enabled: false },
    })),
  };
});

describe('Structural3DInspectorPanel & 2D/3D Rebar Views', () => {
  const mockModel = {
    statistics: {
      totalColumns: 4,
      totalBeams: 6,
      totalSlabs: 2,
      totalSupports: 4,
    },
    members: new Map([
      [
        1,
        {
          id: 1,
          classification: 'COLUMN',
          startNodeId: 1,
          endNodeId: 2,
          length: 3.5,
          section: { zd: 0.45, yd: 0.55 },
        },
      ],
      [
        2,
        {
          id: 2,
          classification: 'BEAM',
          startNodeId: 2,
          endNodeId: 3,
          length: 5.0,
          section: { zd: 0.3, yd: 0.45 },
        },
      ],
    ]),
    nodes: new Map([
      [1, { id: 1, x: 0, y: 0, z: 0 }],
      [2, { id: 2, x: 0, y: 3.5, z: 0 }],
      [3, { id: 3, x: 5, y: 3.5, z: 0 }],
    ]),
    reactions: [{ nodeId: 1, fy: 650, fx: 25, fz: 18, mx: 35, my: 0, mz: 42 }],
    memberForces: [
      { memberId: 1, loadCaseId: 1, axial: -650, vy: 35, vz: 10, mz: 48, my: 25 },
      { memberId: 2, loadCaseId: 1, axial: 0, vy: 45, vz: 0, mz: 65, my: 0 },
    ],
    memberLoads: new Map(),
    plates: new Map(),
  };

  it('renders structural overview when nothing is selected', () => {
    render(
      <Structural3DInspectorPanel
        isOpen={true}
        onClose={vi.fn()}
        model={mockModel as any}
        selectedMemberId={null}
        selectedNodeId={null}
        selectedPlateId={null}
        selectedSupportNodeIds={new Set()}
        selectedGradeBeamId={null}
        onSelectMember={vi.fn()}
        onSelectNode={vi.fn()}
        onOpenAssignLoads={vi.fn()}
        onOpenAssignSection={vi.fn()}
        onDeleteSelected={vi.fn()}
        onOpenCalculationModal={vi.fn()}
      />
    );

    expect(screen.getByText('STRUCTURAL 3D INSPECTOR')).toBeDefined();
    expect(screen.getByText('Structural Summary')).toBeDefined();
    expect(screen.getByText('Quick Element Finder')).toBeDefined();
  });

  it('renders beam properties, loads, and switches to 2D projection and 3D rebar tabs', () => {
    render(
      <Structural3DInspectorPanel
        isOpen={true}
        onClose={vi.fn()}
        model={mockModel as any}
        selectedMemberId={2}
        selectedNodeId={null}
        selectedPlateId={null}
        selectedSupportNodeIds={new Set()}
        selectedGradeBeamId={null}
        onSelectMember={vi.fn()}
        onSelectNode={vi.fn()}
        onOpenAssignLoads={vi.fn()}
        onOpenAssignSection={vi.fn()}
        onDeleteSelected={vi.fn()}
        onOpenCalculationModal={vi.fn()}
      />
    );

    expect(screen.getByText(/BEAM MEMBER #2/i)).toBeDefined();
    expect(screen.getByText('300 × 450 mm')).toBeDefined();

    // Switch to 2D Projection
    fireEvent.click(screen.getByText('2D CAD Projection'));
    expect(screen.getByText(/2D ENGINEERING PROJECTION · BEAM #2/i)).toBeDefined();

    // Switch to 3D Rebar Inside
    fireEvent.click(screen.getByText('3D Rebar Inside'));
    expect(screen.getByText(/BEAM #2/i)).toBeDefined();
    expect(screen.getByText('Ghost X-Ray')).toBeDefined();
  });

  it('renders column properties, WBSC check, and switches to 2D projection', () => {
    render(
      <Structural3DInspectorPanel
        isOpen={true}
        onClose={vi.fn()}
        model={mockModel as any}
        selectedMemberId={1}
        selectedNodeId={null}
        selectedPlateId={null}
        selectedSupportNodeIds={new Set()}
        selectedGradeBeamId={null}
        onSelectMember={vi.fn()}
        onSelectNode={vi.fn()}
        onOpenAssignLoads={vi.fn()}
        onOpenAssignSection={vi.fn()}
        onDeleteSelected={vi.fn()}
        onOpenCalculationModal={vi.fn()}
      />
    );

    expect(screen.getByText(/COLUMN C1/i)).toBeDefined();
    expect(screen.getByText('450 × 550 mm')).toBeDefined();
    expect(screen.getByText(/IS 13920 WBSC Ductility/i)).toBeDefined();

    // Switch to 2D CAD projection
    fireEvent.click(screen.getByText('2D CAD Projection'));
    expect(screen.getByText(/2D ENGINEERING PROJECTION · C1/i)).toBeDefined();
  });

  it('renders foundation pile cap and switches to individual pile view', () => {
    render(
      <Structural3DInspectorPanel
        isOpen={true}
        onClose={vi.fn()}
        model={mockModel as any}
        selectedMemberId={null}
        selectedNodeId={null}
        selectedPlateId={null}
        selectedSupportNodeIds={new Set([1])}
        selectedGradeBeamId={null}
        onSelectMember={vi.fn()}
        onSelectNode={vi.fn()}
        onOpenAssignLoads={vi.fn()}
        onOpenAssignSection={vi.fn()}
        onDeleteSelected={vi.fn()}
        onOpenCalculationModal={vi.fn()}
      />
    );

    expect(screen.getByText(/PILE CAP PC-1/i)).toBeDefined();
    expect(screen.getByText('Pile Cap Geometry')).toBeDefined();

    // Switch to individual pile view
    fireEvent.click(screen.getByText('Individual Pile'));
    expect(screen.getByText(/Pile Geometry & Geotech/i)).toBeDefined();
    expect(screen.getByText('IS 2911:2010')).toBeDefined();

    // Switch to 2D Projection for pile
    fireEvent.click(screen.getByText('2D CAD Projection'));
    expect(screen.getByText(/2D RC BORED PILE PROJECTION/i)).toBeDefined();
  });
});
