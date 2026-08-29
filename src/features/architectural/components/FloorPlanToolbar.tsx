/**
 * Architectural 2D Floor Plan Interactive Toolbar
 */

import React, { useState } from 'react';
import {
  ActivePlanTool,
  ArchitecturalSettings,
} from '../types/architecturalTypes';
import {
  MousePointer,
  Square,
  DoorOpen,
  AppWindow,
  Maximize2,
  Minimize2,
  Tag,
  Ruler,
  Scissors,
  Copy,
  Undo2,
  Redo2,
  Grid,
  Magnet,
  CheckCircle2,
  HelpCircle,
  Settings2,
  Footprints,
  Sparkles,
} from 'lucide-react';

interface FloorPlanToolbarProps {
  activeTool: ActivePlanTool;
  onSelectTool: (tool: ActivePlanTool) => void;
  settings: ArchitecturalSettings;
  onUpdateSettings: (settings: Partial<ArchitecturalSettings>) => void;
  onAutoDetectRooms: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  wallThickness: number;
  onChangeWallThickness: (thk: number) => void;
  doorWidth: number;
  onChangeDoorWidth: (w: number) => void;
  windowWidth: number;
  onChangeWindowWidth: (w: number) => void;
  onPlaceDesignedStaircase?: () => void;
}

export const FloorPlanToolbar: React.FC<FloorPlanToolbarProps> = ({
  activeTool,
  onSelectTool,
  settings,
  onUpdateSettings,
  onAutoDetectRooms,
  onUndo,
  onRedo,
  onFitView,
  wallThickness,
  onChangeWallThickness,
  doorWidth,
  onChangeDoorWidth,
  windowWidth,
  onChangeWindowWidth,
  onPlaceDesignedStaircase,
}) => {
  const [isSnapMenuOpen, setIsSnapMenuOpen] = useState(false);

  const tools: { id: ActivePlanTool; label: string; shortcut: string; icon: React.ReactNode }[] = [
    { id: 'SELECT', label: 'Select / Inspect', shortcut: 'V', icon: <MousePointer className="w-4 h-4" /> },
    { id: 'WALL', label: 'Wall (BIM)', shortcut: 'W', icon: <Square className="w-4 h-4" /> },
    { id: 'STAIRCASE', label: 'Staircase (RCC)', shortcut: 'ST', icon: <Footprints className="w-4 h-4" /> },
    { id: 'DOOR', label: 'Door (Hosted)', shortcut: 'D', icon: <DoorOpen className="w-4 h-4" /> },
    { id: 'WINDOW', label: 'Window (Hosted)', shortcut: 'WIN', icon: <AppWindow className="w-4 h-4" /> },
    { id: 'OPENING', label: 'Wall Opening', shortcut: 'O', icon: <Minimize2 className="w-4 h-4" /> },
    { id: 'ROOM', label: 'Room Tag', shortcut: 'R', icon: <Tag className="w-4 h-4" /> },
    { id: 'DIMENSION', label: 'Dimension', shortcut: 'DIM', icon: <Ruler className="w-4 h-4" /> },
    { id: 'MEASURE', label: 'Measure Distance', shortcut: 'M', icon: <Ruler className="w-4 h-4" /> },
    { id: 'SPLIT_WALL', label: 'Split Wall', shortcut: 'S', icon: <Scissors className="w-4 h-4" /> },
    { id: 'OFFSET_WALL', label: 'Offset Wall', shortcut: 'F', icon: <Copy className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-700/80 flex flex-col justify-between font-mono text-xs text-slate-200 select-none shrink-0">
      {/* Top Tools Section */}
      <div className="p-3 space-y-4 overflow-y-auto">
        <div>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-2 px-1">
            BIM Modeling Tools
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {tools.map((t) => {
              const isActive = activeTool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTool(t.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all border ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500 font-bold shadow-xs'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/60'
                  }`}
                  title={`${t.label} (Hotkey: ${t.shortcut})`}
                >
                  <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>{t.icon}</span>
                  <div className="overflow-hidden">
                    <div className="truncate text-xs">{t.label.split(' ')[0]}</div>
                    <div className="text-[9px] text-slate-400">[{t.shortcut}]</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Context Parameters based on Active Tool */}
        {activeTool === 'WALL' && (
          <div className="p-2.5 bg-slate-800/90 rounded-lg border border-slate-700 space-y-2 animate-in fade-in">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              Wall Parameters
            </span>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Thickness:</label>
              <div className="grid grid-cols-2 gap-1 mb-1.5">
                <button
                  onClick={() => onChangeWallThickness(0.23)}
                  className={`px-2 py-1 rounded text-center text-xs font-bold border ${
                    wallThickness === 0.23
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  230mm (Ext)
                </button>
                <button
                  onClick={() => onChangeWallThickness(0.115)}
                  className={`px-2 py-1 rounded text-center text-xs font-bold border ${
                    wallThickness === 0.115
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  115mm (Int)
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Click & drag to draw wall. Snaps to Column Centers, Beam Centerlines, and other walls.
            </p>
          </div>
        )}

        {activeTool === 'DOOR' && (
          <div className="p-2.5 bg-slate-800/90 rounded-lg border border-slate-700 space-y-2 animate-in fade-in">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
              Door Parameters
            </span>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Door Width:</label>
              <div className="grid grid-cols-3 gap-1">
                {[0.75, 0.9, 1.0, 1.2].map((w) => (
                  <button
                    key={w}
                    onClick={() => onChangeDoorWidth(w)}
                    className={`px-1.5 py-1 rounded text-center text-[11px] font-bold border ${
                      doorWidth === w
                        ? 'bg-amber-600 text-white border-amber-400'
                        : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                    }`}
                  >
                    {Math.round(w * 1000)}mm
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Hover over any wall to host the door. Click to place.
            </p>
          </div>
        )}

        {activeTool === 'STAIRCASE' && (
          <div className="p-2.5 bg-slate-800/90 rounded-lg border border-slate-700 space-y-2 animate-in fade-in">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-1.5">
              <Footprints className="w-3.5 h-3.5 text-amber-400" />
              Staircase (IS 456 / NBC)
            </span>
            <p className="text-[10px] text-slate-300 leading-tight">
              Click anywhere on the plan canvas to place the designed dog-legged staircase.
            </p>
            {onPlaceDesignedStaircase && (
              <button
                onClick={onPlaceDesignedStaircase}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded shadow-xs transition-all text-[11px]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Place at Plan Center</span>
              </button>
            )}
          </div>
        )}

        {activeTool === 'WINDOW' && (
          <div className="p-2.5 bg-slate-800/90 rounded-lg border border-slate-700 space-y-2 animate-in fade-in">
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
              Window Parameters
            </span>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">Window Width:</label>
              <div className="grid grid-cols-3 gap-1">
                {[0.9, 1.2, 1.5, 1.8, 2.4].map((w) => (
                  <button
                    key={w}
                    onClick={() => onChangeWindowWidth(w)}
                    className={`px-1.5 py-1 rounded text-center text-[11px] font-bold border ${
                      windowWidth === w
                        ? 'bg-sky-600 text-white border-sky-400'
                        : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                    }`}
                  >
                    {Math.round(w * 1000)}mm
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Hover over any wall to place hosted window.
            </p>
          </div>
        )}

        {activeTool === 'ROOM' && (
          <div className="p-2.5 bg-slate-800/90 rounded-lg border border-slate-700 space-y-2 animate-in fade-in">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              Room Detection
            </span>
            <button
              onClick={onAutoDetectRooms}
              className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-md transition-all text-xs"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Auto-Detect All Rooms</span>
            </button>
            <p className="text-[10px] text-slate-400 leading-tight">
              Discovers enclosed wall loops, calculates area (m²), perimeter and assigns room tags.
            </p>
          </div>
        )}

        {/* Snap & Precision Controls */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
              Object Snapping
            </span>
            <button
              onClick={() => onUpdateSettings({ snapSettings: { ...settings.snapSettings, enabled: !settings.snapSettings.enabled } })}
              className={`p-1 rounded transition-colors ${
                settings.snapSettings.enabled ? 'text-emerald-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'
              }`}
              title="Toggle Master Snapping (S)"
            >
              <Magnet className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2 bg-slate-800/60 border border-slate-700/60 rounded-lg space-y-1 text-[11px]">
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Column Centers</span>
              <input
                type="checkbox"
                checked={settings.snapSettings.columnCenter}
                onChange={(e) =>
                  onUpdateSettings({ snapSettings: { ...settings.snapSettings, columnCenter: e.target.checked } })
                }
                className="accent-emerald-500 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Beam Centerlines</span>
              <input
                type="checkbox"
                checked={settings.snapSettings.beamCenterline}
                onChange={(e) =>
                  onUpdateSettings({ snapSettings: { ...settings.snapSettings, beamCenterline: e.target.checked } })
                }
                className="accent-emerald-500 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Wall Endpoints</span>
              <input
                type="checkbox"
                checked={settings.snapSettings.endpoint}
                onChange={(e) =>
                  onUpdateSettings({ snapSettings: { ...settings.snapSettings, endpoint: e.target.checked } })
                }
                className="accent-emerald-500 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Wall Midpoints</span>
              <input
                type="checkbox"
                checked={settings.snapSettings.midpoint}
                onChange={(e) =>
                  onUpdateSettings({ snapSettings: { ...settings.snapSettings, midpoint: e.target.checked } })
                }
                className="accent-emerald-500 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Wall Intersections</span>
              <input
                type="checkbox"
                checked={settings.snapSettings.intersection}
                onChange={(e) =>
                  onUpdateSettings({ snapSettings: { ...settings.snapSettings, intersection: e.target.checked } })
                }
                className="accent-emerald-500 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer hover:text-white">
              <span>Grid Points</span>
              <input
                type="checkbox"
                checked={settings.snapSettings.grid}
                onChange={(e) =>
                  onUpdateSettings({ snapSettings: { ...settings.snapSettings, grid: e.target.checked } })
                }
                className="accent-emerald-500 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Bottom Utility Bar: Undo, Redo, Fit View */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2">
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={onUndo}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            onClick={onRedo}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span>Redo</span>
          </button>
          <button
            onClick={onFitView}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition-colors"
            title="Fit Plan / Reset Pan & Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
          <span>Middle-click drag: Pan</span>
          <span>•</span>
          <span>Scroll: Zoom</span>
        </div>
      </div>
    </aside>
  );
};
