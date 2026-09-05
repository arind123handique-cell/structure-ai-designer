import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Structural3DLayerBar } from '../components/model-viewer/Structural3DLayerBar';

describe('Structural3DLayerBar Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const defaultProps = {
    showBeams: true,
    onToggleBeams: vi.fn(),
    showColumns: true,
    onToggleColumns: vi.fn(),
    showSupports: true,
    onToggleSupports: vi.fn(),
    showArchWalls: true,
    onToggleArchWalls: vi.fn(),
    archWallsCount: 4,
    showArchDoors: true,
    onToggleArchDoors: vi.fn(),
    archDoorsCount: 2,
    showArchWindows: true,
    onToggleArchWindows: vi.fn(),
    archWindowsCount: 3,
    showArchRooms: false,
    onToggleArchRooms: vi.fn(),
    showArchStaircases: true,
    onToggleArchStaircases: vi.fn(),
    archStaircasesCount: 1,
    isVisible: true,
    onToggleVisibility: vi.fn(),
  };

  it('renders correctly when visible', () => {
    render(<Structural3DLayerBar {...defaultProps} />);
    expect(screen.getByText(/Layers/i)).toBeTruthy();
  });

  it('does not render when isVisible is false', () => {
    const { container } = render(<Structural3DLayerBar {...defaultProps} isVisible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('expands when hovered in autohide mode and triggers layer toggles', () => {
    const { container } = render(<Structural3DLayerBar {...defaultProps} />);

    // Initially autohide is on, shows collapsed prompt
    expect(screen.getByText(/Hover or click to expand/i)).toBeTruthy();

    // Mouse enter triggers expand
    const wrapper = container.querySelector('.font-mono') as HTMLElement;
    fireEvent.mouseEnter(wrapper);

    // Now layer buttons are visible
    expect(screen.getByText('4')).toBeTruthy(); // walls count
    expect(screen.getByText('2')).toBeTruthy(); // doors count
    expect(screen.getByText('3')).toBeTruthy(); // windows count
    expect(screen.getByText('1')).toBeTruthy(); // staircases count

    // Click Beams
    const beamsBtn = screen.getByTitle('Toggle Beams Visibility');
    fireEvent.click(beamsBtn);
    expect(defaultProps.onToggleBeams).toHaveBeenCalledTimes(1);

    // Click Columns
    const columnsBtn = screen.getByTitle('Toggle Columns Visibility');
    fireEvent.click(columnsBtn);
    expect(defaultProps.onToggleColumns).toHaveBeenCalledTimes(1);

    // Click Arch Walls
    const wallsBtn = screen.getByTitle('Toggle 3D Architectural Walls');
    fireEvent.click(wallsBtn);
    expect(defaultProps.onToggleArchWalls).toHaveBeenCalledTimes(1);
  });

  it('allows docking to upper toolbar and undocking', () => {
    render(<Structural3DLayerBar {...defaultProps} />);

    // Find Dock to Upper Toolbar button in floating mode
    const dockBtn = screen.getByTitle('Dock to Upper Toolbar');
    expect(dockBtn).toBeTruthy();
    fireEvent.click(dockBtn);

    // Now in docked mode, it should have the float/undock button
    const undockBtn = screen.getByTitle('Float / Undock into Draggable Panel');
    expect(undockBtn).toBeTruthy();

    // Click undock
    fireEvent.click(undockBtn);
    expect(screen.getByTitle('Dock to Upper Toolbar')).toBeTruthy();
  });

  it('toggles autohide / pin mode', () => {
    render(<Structural3DLayerBar {...defaultProps} />);
    const autoHideBtn = screen.getByTitle(/Auto-Hide/i);
    expect(autoHideBtn).toBeTruthy();

    // Toggle autohide to pinned
    fireEvent.click(autoHideBtn);
    expect(screen.getByTitle('Auto-Hide: OFF (Pinned)')).toBeTruthy();

    // When pinned, layer items are visible without needing hover
    expect(screen.getByTitle('Toggle Beams Visibility')).toBeTruthy();
  });
});
