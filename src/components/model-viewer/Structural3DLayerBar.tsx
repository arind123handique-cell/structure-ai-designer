import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Layers,
  Box,
  DoorOpen,
  AppWindow,
  Tag,
  Footprints,
  Pin,
  PinOff,
  GripHorizontal,
  ArrowUpToLine,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';

export interface Structural3DLayerBarProps {
  // Structural layers
  showBeams: boolean;
  onToggleBeams: () => void;
  showColumns: boolean;
  onToggleColumns: () => void;
  showSupports: boolean;
  onToggleSupports: () => void;

  // Architectural layers
  showArchWalls: boolean;
  onToggleArchWalls: () => void;
  archWallsCount: number;

  showArchDoors: boolean;
  onToggleArchDoors: () => void;
  archDoorsCount: number;

  showArchWindows: boolean;
  onToggleArchWindows: () => void;
  archWindowsCount: number;

  showArchRooms: boolean;
  onToggleArchRooms: () => void;

  showArchStaircases: boolean;
  onToggleArchStaircases: () => void;
  archStaircasesCount: number;

  // External open/close toggle from upper toolbar
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

export const Structural3DLayerBar: React.FC<Structural3DLayerBarProps> = ({
  showBeams,
  onToggleBeams,
  showColumns,
  onToggleColumns,
  showSupports,
  onToggleSupports,
  showArchWalls,
  onToggleArchWalls,
  archWallsCount,
  showArchDoors,
  onToggleArchDoors,
  archDoorsCount,
  showArchWindows,
  onToggleArchWindows,
  archWindowsCount,
  showArchRooms,
  onToggleArchRooms,
  showArchStaircases,
  onToggleArchStaircases,
  archStaircasesCount,
  isVisible = true,
  onToggleVisibility,
}) => {
  // Persistent or state-based dock & autohide settings
  const [isDocked, setIsDocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('3d_layers_docked') === 'true';
    } catch {
      return false;
    }
  });

  const [isAutoHide, setIsAutoHide] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('3d_layers_autohide');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isHovered, setIsHovered] = useState(false);
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);

  // Draggable position { x, y }
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('3d_layers_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return { x: 16, y: 72 };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isNearTopSnap, setIsNearTopSnap] = useState(false);
  const dragStartOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const barRef = useRef<HTMLDivElement | null>(null);

  // Save preferences
  useEffect(() => {
    try {
      localStorage.setItem('3d_layers_docked', String(isDocked));
    } catch {}
  }, [isDocked]);

  useEffect(() => {
    try {
      localStorage.setItem('3d_layers_autohide', String(isAutoHide));
    } catch {}
  }, [isAutoHide]);

  useEffect(() => {
    try {
      localStorage.setItem('3d_layers_pos', JSON.stringify(position));
    } catch {}
  }, [position]);

  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // ignore clicks on buttons
    e.preventDefault();
    setIsDragging(true);
    dragStartOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(12, Math.min(window.innerWidth - 220, e.clientX - dragStartOffset.current.x));
      const newY = Math.max(12, Math.min(window.innerHeight - 100, e.clientY - dragStartOffset.current.y));
      setPosition({ x: newX, y: newY });
      setIsNearTopSnap(newY < 60);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (isNearTopSnap) {
        setIsDocked(true);
        setIsNearTopSnap(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isNearTopSnap]);

  // Count active layers
  const activeCount = [
    showBeams,
    showColumns,
    showSupports,
    showArchWalls,
    showArchDoors,
    showArchWindows,
    showArchRooms,
    showArchStaircases,
  ].filter(Boolean).length;

  const totalCount = 8;

  const isExpanded = !isManuallyCollapsed && (!isAutoHide || isHovered || isDragging);

  if (!isVisible) return null;

  // Render layer buttons
  const renderButtons = (horizontal: boolean) => (
    <div className={`flex ${horizontal ? 'flex-row items-center gap-1.5 flex-wrap' : 'flex-col gap-1'}`}>
      <button
        onClick={onToggleBeams}
        className={`flex items-center justify-between gap-2 px-2.5 py-1 text-xs rounded transition-colors ${
          showBeams
            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
        title="Toggle Beams Visibility"
      >
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${showBeams ? 'bg-sky-400 shadow-xs' : 'bg-slate-600'}`} />
          <span>Beams</span>
        </div>
        {showBeams && <span className="text-[10px] text-sky-400 font-mono">ON</span>}
      </button>

      <button
        onClick={onToggleColumns}
        className={`flex items-center justify-between gap-2 px-2.5 py-1 text-xs rounded transition-colors ${
          showColumns
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
        title="Toggle Columns Visibility"
      >
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${showColumns ? 'bg-emerald-400 shadow-xs' : 'bg-slate-600'}`} />
          <span>Columns</span>
        </div>
        {showColumns && <span className="text-[10px] text-emerald-400 font-mono">ON</span>}
      </button>

      <button
        onClick={onToggleSupports}
        className={`flex items-center justify-between gap-2 px-2.5 py-1 text-xs rounded transition-colors ${
          showSupports
            ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
        title="Toggle Supports & Pile Caps Visibility"
      >
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${showSupports ? 'bg-red-400 shadow-xs' : 'bg-slate-600'}`} />
          <span>Supports</span>
        </div>
        {showSupports && <span className="text-[10px] text-red-400 font-mono">ON</span>}
      </button>

      <div className={horizontal ? 'w-[1px] h-4 bg-slate-700/80 mx-0.5' : 'h-[1px] w-full bg-slate-800 my-0.5'} />

      <button
        onClick={onToggleArchWalls}
        className={`flex items-center justify-between gap-2 px-2.5 py-1 text-xs rounded transition-colors ${
          showArchWalls
            ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50 font-medium shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
        title="Toggle 3D Architectural Walls"
      >
        <div className="flex items-center gap-1.5">
          <Box className={`w-3.5 h-3.5 ${showArchWalls ? 'text-amber-400' : 'text-slate-500'}`} />
          <span>Arch Walls</span>
        </div>
        {archWallsCount > 0 && (
          <span className="text-[10px] px-1 bg-amber-500/20 text-amber-300 rounded font-mono">
            {archWallsCount}
          </span>
        )}
      </button>

      <button
        onClick={onToggleArchDoors}
        className={`flex items-center justify-between gap-2 px-2.5 py-1 text-xs rounded transition-colors ${
          showArchDoors
            ? 'bg-amber-600/20 text-amber-200 border border-amber-600/50 font-medium shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
        title="Toggle 3D Hosted Doors"
      >
        <div className="flex items-center gap-1.5">
          <DoorOpen className={`w-3.5 h-3.5 ${showArchDoors ? 'text-amber-400' : 'text-slate-500'}`} />
          <span>Doors</span>
        </div>
        {archDoorsCount > 0 && (
          <span className="text-[10px] px-1 bg-amber-600/20 text-amber-300 rounded font-mono">
            {archDoorsCount}
          </span>
        )}
      </button>

      <button
        onClick={onToggleArchWindows}
        className={`flex items-center justify-between gap-2 px-2.5 py-1 text-xs rounded transition-colors ${
          showArchWindows
            ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50 font-medium shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
        title="Toggle 3D Hosted Windows"
      >
        <div className="flex items-center gap-1.5">
          <AppWindow className={`w-3.5 h-3.5 ${showArchWindows ? 'text-sky-400' : 'text-slate-500'}`} />
          <span>Windows</span>
        </div>
        {archWindowsCount > 0 && (
          <span className="text-[10px] px-1 bg-sky-500/20 text-sky-300 rounded font-mono">
            {archWindowsCount}
          </span>
        )}
      </button>

      <button
        onClick={onToggleArchRooms}
        className={`flex items-center justify-between gap-2 px-2.5 py-1 text-xs rounded transition-colors ${
          showArchRooms
            ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50 font-medium shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
        title="Toggle 3D Room Badges"
      >
        <div className="flex items-center gap-1.5">
          <Tag className={`w-3.5 h-3.5 ${showArchRooms ? 'text-emerald-400' : 'text-slate-500'}`} />
          <span>Rooms</span>
        </div>
        {showArchRooms && <span className="text-[10px] text-emerald-400 font-mono">ON</span>}
      </button>

      <button
        onClick={onToggleArchStaircases}
        className={`flex items-center justify-between gap-2 px-2.5 py-1 text-xs rounded transition-colors ${
          showArchStaircases
            ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50 font-medium shadow-xs'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
        }`}
        title="Toggle 3D RCC Staircases"
      >
        <div className="flex items-center gap-1.5">
          <Footprints className={`w-3.5 h-3.5 ${showArchStaircases ? 'text-amber-400' : 'text-slate-500'}`} />
          <span>Staircases</span>
        </div>
        {archStaircasesCount > 0 && (
          <span className="text-[10px] px-1 bg-amber-500/20 text-amber-300 rounded font-mono">
            {archStaircasesCount}
          </span>
        )}
      </button>
    </div>
  );

  // ==========================================
  // 1. DOCKED TO UPPER TOOLBAR
  // ==========================================
  if (isDocked) {
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="absolute top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-auto transition-all duration-200"
      >
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-lg shadow-2xl p-1.5 font-mono text-xs text-slate-200 flex items-center gap-2">
          {/* Header pill with Undock and Auto-Hide controls */}
          <div className="flex items-center gap-1 border-r border-slate-700/80 pr-1.5 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-bold text-[11px] text-slate-300">
              Layers ({activeCount}/{totalCount})
            </span>

            {/* Auto-Hide Toggle */}
            <button
              onClick={() => setIsAutoHide(!isAutoHide)}
              className={`p-1 rounded transition-colors ${
                isAutoHide ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-slate-200'
              }`}
              title={isAutoHide ? 'Auto-Hide: ON (Click to Pin)' : 'Auto-Hide: OFF (Pinned)'}
            >
              {isAutoHide ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>

            {/* Float / Undock Button */}
            <button
              onClick={() => setIsDocked(false)}
              className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors"
              title="Float / Undock into Draggable Panel"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Layer toggles rendered horizontally */}
          {(!isAutoHide || isHovered) ? (
            renderButtons(true)
          ) : (
            <div className="text-[11px] text-slate-400 cursor-pointer px-1 py-0.5">
              Hover to expand layers
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. FLOATING DRAGGABLE PANEL (WITH AUTOHIDE)
  // ==========================================
  return (
    <>
      {/* Top snap dock guideline when dragging near top */}
      {isNearTopSnap && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-80 h-10 border-2 border-dashed border-sky-400/80 bg-sky-500/10 rounded-lg z-30 flex items-center justify-center text-xs font-mono text-sky-300 pointer-events-none animate-pulse">
          Release to dock to upper toolbar
        </div>
      )}

      <div
        ref={barRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: 'none',
        }}
        className={`absolute z-20 pointer-events-auto font-mono text-xs transition-shadow duration-150 select-none ${
          isDragging ? 'opacity-90 shadow-2xl scale-[1.02]' : 'shadow-xl'
        }`}
      >
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-2 text-slate-200 min-w-[200px] max-w-xs">
          {/* Draggable Title Bar */}
          <div
            onMouseDown={handleMouseDown}
            className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800 cursor-grab active:cursor-grabbing text-slate-400"
            title="Drag to reposition or drag to top toolbar to dock"
          >
            <div className="flex items-center gap-1.5">
              <GripHorizontal className="w-4 h-4 text-slate-500 hover:text-slate-300" />
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-bold text-[11px] text-slate-200">
                Layers ({activeCount}/{totalCount})
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Dock to upper toolbar button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDocked(true);
                }}
                className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors"
                title="Dock to Upper Toolbar"
              >
                <ArrowUpToLine className="w-3.5 h-3.5" />
              </button>

              {/* Auto-Hide Toggle Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAutoHide(!isAutoHide);
                }}
                className={`p-1 rounded transition-colors ${
                  isAutoHide ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isAutoHide ? 'Auto-Hide: ON (Click to Pin)' : 'Auto-Hide: OFF (Pinned)'}
              >
                {isAutoHide ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>

              {/* Manual Collapse / Expand Chevron */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsManuallyCollapsed(!isManuallyCollapsed);
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Expanded Layer Items */}
          {isExpanded ? (
            <div className="space-y-1">
              {renderButtons(false)}

              {/* Quick toggle footer */}
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-800 text-[10px] text-slate-400">
                <span className="text-slate-500">
                  {isAutoHide ? '• Auto-hides on leave' : '• Pinned visible'}
                </span>
                <button
                  onClick={() => {
                    if (onToggleVisibility) onToggleVisibility();
                    else setIsManuallyCollapsed(true);
                  }}
                  className="hover:text-slate-200"
                >
                  Collapse
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsManuallyCollapsed(false)}
              className="py-1 text-center text-[10px] text-slate-400 cursor-pointer hover:text-slate-200"
            >
              Hover or click to expand
            </div>
          )}
        </div>
      </div>
    </>
  );
};
