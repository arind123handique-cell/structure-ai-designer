/**
 * Live Parameter Inspector and Properties Panel for Architectural Elements
 */

import React from 'react';
import {
  ArchitecturalWall,
  ArchitecturalDoor,
  ArchitecturalWindow,
  ArchitecturalOpening,
  ArchitecturalRoom,
  ArchitecturalStaircase,
  ArchitecturalDimension,
} from '../types/architecturalTypes';
import { ArchitecturalGeometryEngine } from '../engines/architecturalGeometryEngine';
import {
  Sliders,
  Trash2,
  Maximize2,
  Layers,
  Tag,
  Square,
  DoorOpen,
  AppWindow,
  Minimize2,
  Ruler,
  Info,
  RotateCw,
  Footprints,
  ExternalLink,
} from 'lucide-react';

interface PlanPropertiesPanelProps {
  selectedId: string | null;
  selectedType: 'WALL' | 'DOOR' | 'WINDOW' | 'OPENING' | 'ROOM' | 'STAIRCASE' | 'DIMENSION' | null;
  walls: Record<string, ArchitecturalWall>;
  doors: Record<string, ArchitecturalDoor>;
  windows: Record<string, ArchitecturalWindow>;
  openings: Record<string, ArchitecturalOpening>;
  rooms: Record<string, ArchitecturalRoom>;
  staircases?: Record<string, ArchitecturalStaircase>;
  dimensions: Record<string, ArchitecturalDimension>;
  onUpdateWall: (id: string, updates: Partial<ArchitecturalWall>) => void;
  onDeleteWall: (id: string) => void;
  onUpdateDoor: (id: string, updates: Partial<ArchitecturalDoor>) => void;
  onDeleteDoor: (id: string) => void;
  onUpdateWindow: (id: string, updates: Partial<ArchitecturalWindow>) => void;
  onDeleteWindow: (id: string) => void;
  onUpdateOpening: (id: string, updates: Partial<ArchitecturalOpening>) => void;
  onDeleteOpening: (id: string) => void;
  onUpdateRoom: (id: string, updates: Partial<ArchitecturalRoom>) => void;
  onDeleteRoom: (id: string) => void;
  onUpdateStaircase?: (id: string, updates: Partial<ArchitecturalStaircase>) => void;
  onDeleteStaircase?: (id: string) => void;
  onDeleteDimension: (id: string) => void;
  onOpenStaircaseDesigner?: () => void;
  onDeselect: () => void;
}

export const PlanPropertiesPanel: React.FC<PlanPropertiesPanelProps> = ({
  selectedId,
  selectedType,
  walls,
  doors,
  windows,
  openings,
  rooms,
  staircases = {},
  dimensions,
  onUpdateWall,
  onDeleteWall,
  onUpdateDoor,
  onDeleteDoor,
  onUpdateWindow,
  onDeleteWindow,
  onUpdateOpening,
  onDeleteOpening,
  onUpdateRoom,
  onDeleteRoom,
  onUpdateStaircase,
  onDeleteStaircase,
  onDeleteDimension,
  onOpenStaircaseDesigner,
  onDeselect,
}) => {
  const wall = selectedId && selectedType === 'WALL' ? walls[selectedId] : null;
  const door = selectedId && selectedType === 'DOOR' ? doors[selectedId] : null;
  const windowObj = selectedId && selectedType === 'WINDOW' ? windows[selectedId] : null;
  const opening = selectedId && selectedType === 'OPENING' ? openings[selectedId] : null;
  const room = selectedId && selectedType === 'ROOM' ? rooms[selectedId] : null;
  const staircase = selectedId && (selectedType === 'STAIRCASE' || staircases[selectedId]) ? staircases[selectedId] : null;
  const dimension = selectedId && selectedType === 'DIMENSION' ? dimensions[selectedId] : null;

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-700/80 flex flex-col font-mono text-xs text-slate-200 shrink-0">
      <div className="p-3 border-b border-slate-700/80 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white tracking-wide">Element Properties</span>
        </div>
        {selectedId && (
          <button
            onClick={onDeselect}
            className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 bg-slate-800 rounded border border-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-4">
        {/* 1. WALL PROPERTIES */}
        {wall && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-bold rounded border border-amber-500/40">
                WALL {wall.id}
              </span>
              <button
                onClick={() => onDeleteWall(wall.id)}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2 py-1 rounded border border-red-800/60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>

            {/* Wall Type */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">WALL TYPE:</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => onUpdateWall(wall.id, { wallType: 'EXTERNAL', thickness: 0.23 })}
                  className={`py-1 rounded text-center font-bold border ${
                    wall.wallType === 'EXTERNAL'
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  External (230mm)
                </button>
                <button
                  onClick={() => onUpdateWall(wall.id, { wallType: 'INTERNAL', thickness: 0.115 })}
                  className={`py-1 rounded text-center font-bold border ${
                    wall.wallType === 'INTERNAL'
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  Internal (115mm)
                </button>
              </div>
            </div>

            {/* Geometry Dimensions */}
            <div className="grid grid-cols-2 gap-2 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
              <div>
                <span className="text-[10px] text-slate-400 block">Length:</span>
                <span className="font-bold text-white text-sm">
                  {ArchitecturalGeometryEngine.distance(wall.start, wall.end).toFixed(2)} m
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Height:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={wall.height}
                    onChange={(e) => onUpdateWall(wall.id, { height: parseFloat(e.target.value) || 3.0 })}
                    className="w-16 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-white font-bold"
                  />
                  <span className="text-slate-400 text-xs">m</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Thickness:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="5"
                    value={Math.round(wall.thickness * 1000)}
                    onChange={(e) =>
                      onUpdateWall(wall.id, { thickness: (parseFloat(e.target.value) || 230) / 1000 })
                    }
                    className="w-16 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-white font-bold"
                  />
                  <span className="text-slate-400 text-xs">mm</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Base EL:</span>
                <span className="font-bold text-white text-xs">+{wall.baseElevation.toFixed(2)} m</span>
              </div>
            </div>

            {/* Start & End Coordinates */}
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Start (X, Z):</span>
                <span className="text-slate-200">
                  {wall.start.x.toFixed(2)}m, {wall.start.y.toFixed(2)}m
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">End (X, Z):</span>
                <span className="text-slate-200">
                  {wall.end.x.toFixed(2)}m, {wall.end.y.toFixed(2)}m
                </span>
              </div>
            </div>

            {/* Hosted Openings */}
            <div>
              <span className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">
                Hosted Elements
              </span>
              <div className="bg-slate-800/40 p-2 rounded border border-slate-700/50 space-y-1 text-[11px]">
                {Object.values(doors).filter((d) => d.hostWallId === wall.id).length === 0 &&
                Object.values(windows).filter((w) => w.hostWallId === wall.id).length === 0 &&
                Object.values(openings).filter((o) => o.hostWallId === wall.id).length === 0 ? (
                  <span className="text-slate-500 italic">No hosted doors or windows</span>
                ) : (
                  <>
                    {Object.values(doors)
                      .filter((d) => d.hostWallId === wall.id)
                      .map((d) => (
                        <div key={d.id} className="text-amber-400 flex items-center gap-1.5">
                          <DoorOpen className="w-3.5 h-3.5" />
                          <span>
                            Door {d.id} ({Math.round(d.width * 1000)}mm) @ {d.position.toFixed(2)}m
                          </span>
                        </div>
                      ))}
                    {Object.values(windows)
                      .filter((w) => w.hostWallId === wall.id)
                      .map((w) => (
                        <div key={w.id} className="text-sky-400 flex items-center gap-1.5">
                          <AppWindow className="w-3.5 h-3.5" />
                          <span>
                            Window {w.id} ({Math.round(w.width * 1000)}mm) @ {w.position.toFixed(2)}m
                          </span>
                        </div>
                      ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. DOOR PROPERTIES */}
        {door && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 bg-amber-600/25 text-amber-200 font-bold rounded border border-amber-500/40">
                DOOR {door.id}
              </span>
              <button
                onClick={() => onDeleteDoor(door.id)}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2 py-1 rounded border border-red-800/60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">HOST WALL:</label>
              <div className="bg-slate-800 p-2 rounded border border-slate-700 font-bold text-white">
                {door.hostWallId}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
              <div>
                <span className="text-[10px] text-slate-400 block">Width (mm):</span>
                <select
                  value={Math.round(door.width * 1000)}
                  onChange={(e) => onUpdateDoor(door.id, { width: parseInt(e.target.value, 10) / 1000 })}
                  className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white font-bold mt-0.5"
                >
                  <option value={750}>750 mm</option>
                  <option value={900}>900 mm</option>
                  <option value={1000}>1000 mm</option>
                  <option value={1200}>1200 mm</option>
                </select>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Height (mm):</span>
                <input
                  type="number"
                  value={Math.round(door.height * 1000)}
                  onChange={(e) =>
                    onUpdateDoor(door.id, { height: (parseFloat(e.target.value) || 2100) / 1000 })
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white font-bold mt-0.5"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">SWING DIRECTION:</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => onUpdateDoor(door.id, { swingDirection: 'LEFT' })}
                  className={`py-1 rounded text-center font-bold border ${
                    door.swingDirection === 'LEFT'
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Left Swing
                </button>
                <button
                  onClick={() => onUpdateDoor(door.id, { swingDirection: 'RIGHT' })}
                  className={`py-1 rounded text-center font-bold border ${
                    door.swingDirection === 'RIGHT'
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  Right Swing
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">POSITION ALONG WALL:</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={door.width / 2}
                  max={
                    walls[door.hostWallId]
                      ? ArchitecturalGeometryEngine.distance(
                          walls[door.hostWallId].start,
                          walls[door.hostWallId].end
                        ) -
                        door.width / 2
                      : 5
                  }
                  step="0.05"
                  value={door.position}
                  onChange={(e) => onUpdateDoor(door.id, { position: parseFloat(e.target.value) })}
                  className="flex-1 accent-amber-500 cursor-pointer"
                />
                <span className="text-white font-bold w-12 text-right">{door.position.toFixed(2)}m</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. WINDOW PROPERTIES */}
        {windowObj && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 bg-sky-600/25 text-sky-200 font-bold rounded border border-sky-500/40">
                WINDOW {windowObj.id}
              </span>
              <button
                onClick={() => onDeleteWindow(windowObj.id)}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2 py-1 rounded border border-red-800/60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">HOST WALL:</label>
              <div className="bg-slate-800 p-2 rounded border border-slate-700 font-bold text-white">
                {windowObj.hostWallId}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
              <div>
                <span className="text-[10px] text-slate-400 block">Width (mm):</span>
                <select
                  value={Math.round(windowObj.width * 1000)}
                  onChange={(e) =>
                    onUpdateWindow(windowObj.id, { width: parseInt(e.target.value, 10) / 1000 })
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white font-bold mt-0.5"
                >
                  <option value={900}>900 mm</option>
                  <option value={1200}>1200 mm</option>
                  <option value={1500}>1500 mm</option>
                  <option value={1800}>1800 mm</option>
                  <option value={2400}>2400 mm</option>
                </select>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Height (mm):</span>
                <input
                  type="number"
                  value={Math.round(windowObj.height * 1000)}
                  onChange={(e) =>
                    onUpdateWindow(windowObj.id, { height: (parseFloat(e.target.value) || 1200) / 1000 })
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white font-bold mt-0.5"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Sill Height:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={Math.round(windowObj.sillHeight * 1000)}
                    onChange={(e) =>
                      onUpdateWindow(windowObj.id, { sillHeight: (parseFloat(e.target.value) || 900) / 1000 })
                    }
                    className="w-16 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-white font-bold"
                  />
                  <span className="text-slate-400 text-xs">mm</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">POSITION ALONG WALL:</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={windowObj.width / 2}
                  max={
                    walls[windowObj.hostWallId]
                      ? ArchitecturalGeometryEngine.distance(
                          walls[windowObj.hostWallId].start,
                          walls[windowObj.hostWallId].end
                        ) -
                        windowObj.width / 2
                      : 5
                  }
                  step="0.05"
                  value={windowObj.position}
                  onChange={(e) => onUpdateWindow(windowObj.id, { position: parseFloat(e.target.value) })}
                  className="flex-1 accent-sky-500 cursor-pointer"
                />
                <span className="text-white font-bold w-12 text-right">{windowObj.position.toFixed(2)}m</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. ROOM PROPERTIES */}
        {room && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 bg-emerald-600/25 text-emerald-200 font-bold rounded border border-emerald-500/40">
                ROOM {room.id}
              </span>
              <button
                onClick={() => onDeleteRoom(room.id)}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2 py-1 rounded border border-red-800/60"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">ROOM NAME:</label>
              <input
                type="text"
                value={room.name}
                onChange={(e) => onUpdateRoom(room.id, { name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">ROOM TYPE / PURPOSE:</label>
              <select
                value={room.roomType}
                onChange={(e) => onUpdateRoom(room.id, { roomType: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white font-semibold focus:outline-none focus:border-emerald-500"
              >
                <option value="LIVING_OR_BEDROOM">Living Room / Bedroom</option>
                <option value="MASTER_BEDROOM">Master Bedroom</option>
                <option value="KITCHEN">Kitchen / Pantry</option>
                <option value="BATHROOM">Bathroom / WC</option>
                <option value="BALCONY">Balcony / Terrace</option>
                <option value="CORRIDOR">Corridor / Passage</option>
                <option value="LOBBY">Lobby / Foyer</option>
                <option value="STAIRCASE">Staircase Well</option>
                <option value="CUSTOM">Custom Room</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
              <div>
                <span className="text-[10px] text-slate-400 block">Carpet Area:</span>
                <span className="font-bold text-emerald-400 text-base">{room.area.toFixed(2)} m²</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Perimeter:</span>
                <span className="font-bold text-white text-base">{room.perimeter.toFixed(2)} m</span>
              </div>
            </div>
          </div>
        )}

        {/* 4.5. STAIRCASE PROPERTIES */}
        {staircase && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Footprints className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white uppercase text-xs">
                  {staircase.name || 'RCC Staircase'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    onUpdateStaircase &&
                    onUpdateStaircase(staircase.id, {
                      rotation: ((staircase.rotation || 0) + 90) % 360,
                    })
                  }
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 transition-colors"
                  title="Rotate 90° Clockwise"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteStaircase && onDeleteStaircase(staircase.id)}
                  className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded border border-rose-500/40 transition-colors"
                  title="Delete Staircase"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Position & Orientation */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">POS X (m):</label>
                <input
                  type="number"
                  step="0.1"
                  value={staircase.position.x}
                  onChange={(e) =>
                    onUpdateStaircase &&
                    onUpdateStaircase(staircase.id, {
                      position: { ...staircase.position, x: parseFloat(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">POS Y/Z (m):</label>
                <input
                  type="number"
                  step="0.1"
                  value={staircase.position.y}
                  onChange={(e) =>
                    onUpdateStaircase &&
                    onUpdateStaircase(staircase.id, {
                      position: { ...staircase.position, y: parseFloat(e.target.value) || 0 },
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">ROTATION:</label>
                <select
                  value={staircase.rotation || 0}
                  onChange={(e) =>
                    onUpdateStaircase &&
                    onUpdateStaircase(staircase.id, {
                      rotation: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-amber-300 font-bold"
                >
                  <option value={0}>0°</option>
                  <option value={90}>90°</option>
                  <option value={180}>180°</option>
                  <option value={270}>270°</option>
                </select>
              </div>
            </div>

            {/* Room Dimensions L x B */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">ROOM LENGTH L (m):</label>
                <input
                  type="number"
                  step="0.1"
                  min="3.0"
                  max="8.0"
                  value={staircase.roomLength}
                  onChange={(e) =>
                    onUpdateStaircase &&
                    onUpdateStaircase(staircase.id, {
                      roomLength: parseFloat(e.target.value) || 4.8,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">ROOM WIDTH B (m):</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.8"
                  max="5.0"
                  value={staircase.roomWidth}
                  onChange={(e) =>
                    onUpdateStaircase &&
                    onUpdateStaircase(staircase.id, {
                      roomWidth: parseFloat(e.target.value) || 2.4,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white font-bold"
                />
              </div>
            </div>

            {/* Step Parameters: Tread & Riser */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">TREAD T (mm):</label>
                <input
                  type="number"
                  step="5"
                  min="225"
                  max="350"
                  value={staircase.treadMm}
                  onChange={(e) =>
                    onUpdateStaircase &&
                    onUpdateStaircase(staircase.id, {
                      treadMm: parseInt(e.target.value, 10) || 275,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-sky-400 font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">RISER R (mm):</label>
                <input
                  type="number"
                  step="5"
                  min="125"
                  max="200"
                  value={staircase.riserMm}
                  onChange={(e) =>
                    onUpdateStaircase &&
                    onUpdateStaircase(staircase.id, {
                      riserMm: parseInt(e.target.value, 10) || 160,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-sky-400 font-bold"
                />
              </div>
            </div>

            {/* Flight Width & Landing Depth */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">FLIGHT WIDTH (m):</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.9"
                  max="2.5"
                  value={staircase.flightWidth}
                  onChange={(e) =>
                    onUpdateStaircase &&
                    onUpdateStaircase(staircase.id, {
                      flightWidth: parseFloat(e.target.value) || 1.1,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">LANDING DEPTH (m):</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.9"
                  max="2.5"
                  value={staircase.landingDepth}
                  onChange={(e) =>
                    onUpdateStaircase &&
                    onUpdateStaircase(staircase.id, {
                      landingDepth: parseFloat(e.target.value) || 1.2,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white font-bold"
                />
              </div>
            </div>

            {/* Dual-Side Landing Entries Toggles */}
            <div className="p-2 bg-slate-800/80 rounded border border-slate-700/80 space-y-2">
              <span className="text-[10px] text-slate-300 font-bold uppercase block">
                Dual-Side Landing Access
              </span>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staircase.hasLeftDoor}
                    onChange={(e) =>
                      onUpdateStaircase &&
                      onUpdateStaircase(staircase.id, { hasLeftDoor: e.target.checked })
                    }
                    className="rounded text-amber-500"
                  />
                  Left Landing Door
                </label>
                <span className="text-[10px] text-amber-300 font-bold">{staircase.leftDoorWidth}m</span>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staircase.hasRightDoor}
                    onChange={(e) =>
                      onUpdateStaircase &&
                      onUpdateStaircase(staircase.id, { hasRightDoor: e.target.checked })
                    }
                    className="rounded text-amber-500"
                  />
                  Right Landing Door
                </label>
                <span className="text-[10px] text-amber-300 font-bold">{staircase.rightDoorWidth}m</span>
              </div>
            </div>

            {/* Quick Link to IS 456 Structural Designer */}
            {onOpenStaircaseDesigner && (
              <button
                onClick={onOpenStaircaseDesigner}
                className="w-full flex items-center justify-center gap-2 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-xs transition-all text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open IS 456 Staircase Designer</span>
              </button>
            )}
          </div>
        )}

        {/* 5. NO SELECTION STATE */}
        {!selectedId && (
          <div className="text-center py-8 px-4 text-slate-400 space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
              <Info className="w-5 h-5" />
            </div>
            <div className="font-semibold text-slate-300">No Element Selected</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Click on any wall, hosted door, window, or room in the 2D plan canvas or 3D viewer to inspect and edit parameters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
