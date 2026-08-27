/**
 * Interactive Floor Level Selector & Underlay Controls
 */

import React, { useState } from 'react';
import { FloorPlanLevel } from '@/features/drawings/floorPlanEngine';
import {
  Layers,
  Copy,
  ChevronDown,
  Eye,
  EyeOff,
  Sliders,
  Check,
  Building,
} from 'lucide-react';

interface FloorSelectorProps {
  floorPlans: FloorPlanLevel[];
  activeFloorIndex: number;
  onSelectFloor: (index: number) => void;
  showStructuralUnderlay: boolean;
  onToggleStructuralUnderlay: () => void;
  showPreviousFloorUnderlay: boolean;
  onTogglePreviousFloorUnderlay: () => void;
  previousFloorOpacity: number;
  onChangePreviousFloorOpacity: (opacity: number) => void;
  onCopyFloorPlan: (sourceFloorId: string, targetFloorId: string) => Promise<void>;
}

export const FloorSelector: React.FC<FloorSelectorProps> = ({
  floorPlans,
  activeFloorIndex,
  onSelectFloor,
  showStructuralUnderlay,
  onToggleStructuralUnderlay,
  showPreviousFloorUnderlay,
  onTogglePreviousFloorUnderlay,
  previousFloorOpacity,
  onChangePreviousFloorOpacity,
  onCopyFloorPlan,
}) => {
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceFloor, setCopySourceFloor] = useState<string>('');
  const [copyTargetFloor, setCopyTargetFloor] = useState<string>('');
  const [isCopying, setIsCopying] = useState(false);

  const activeFloor = floorPlans[activeFloorIndex] || floorPlans[0] || {
    levelName: 'Level 1',
    elevationY: 0,
  };

  const handleOpenCopyModal = () => {
    const currentFloorId = `floor_${activeFloorIndex}`;
    setCopySourceFloor(currentFloorId);
    const nextIdx = (activeFloorIndex + 1) % Math.max(1, floorPlans.length);
    setCopyTargetFloor(`floor_${nextIdx}`);
    setIsCopyModalOpen(true);
  };

  const handleExecuteCopy = async () => {
    if (!copySourceFloor || !copyTargetFloor || copySourceFloor === copyTargetFloor) return;
    setIsCopying(true);
    try {
      await onCopyFloorPlan(copySourceFloor, copyTargetFloor);
      setIsCopyModalOpen(false);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 font-mono text-xs shadow-md">
      {/* Active Floor Dropdown */}
      <div className="flex items-center gap-2">
        <Building className="w-4 h-4 text-emerald-400" />
        <span className="text-slate-400 font-semibold">Story / Level:</span>
        <select
          value={activeFloorIndex}
          onChange={(e) => onSelectFloor(parseInt(e.target.value, 10))}
          className="bg-slate-800 border border-slate-600 rounded px-2.5 py-1 text-slate-100 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          {floorPlans.map((fp, idx) => (
            <option key={idx} value={idx}>
              {fp.levelName} (+{fp.elevationY.toFixed(2)}m)
            </option>
          ))}
        </select>
      </div>

      <div className="w-[1px] h-5 bg-slate-700 mx-1" />

      {/* Structural Underlay Toggle */}
      <button
        onClick={onToggleStructuralUnderlay}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
          showStructuralUnderlay
            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
            : 'text-slate-400 hover:text-slate-200 border border-transparent'
        }`}
        title="Toggle Column & Beam Structural Underlay on 2D Plan"
      >
        <Layers className="w-3.5 h-3.5 text-sky-400" />
        <span>Columns & Beams Grid</span>
      </button>

      {/* Previous Floor Underlay Toggle */}
      <button
        onClick={onTogglePreviousFloorUnderlay}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
          showPreviousFloorUnderlay
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
            : 'text-slate-400 hover:text-slate-200 border border-transparent'
        }`}
        title="Toggle Ghost Underlay of Floor Below"
      >
        {showPreviousFloorUnderlay ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span>Lower Story Ghost</span>
      </button>

      {showPreviousFloorUnderlay && (
        <div className="flex items-center gap-1 pl-1">
          <span className="text-[10px] text-slate-400">Opacity:</span>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.05"
            value={previousFloorOpacity}
            onChange={(e) => onChangePreviousFloorOpacity(parseFloat(e.target.value))}
            className="w-16 accent-amber-500 cursor-pointer h-1"
          />
          <span className="text-[10px] text-amber-400 w-6">
            {Math.round(previousFloorOpacity * 100)}%
          </span>
        </div>
      )}

      <div className="w-[1px] h-5 bg-slate-700 mx-1" />

      {/* Copy Floor Plan Button */}
      <button
        onClick={handleOpenCopyModal}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-600 transition-colors"
        title="Copy all walls, doors and windows from one floor to another"
      >
        <Copy className="w-3.5 h-3.5 text-emerald-400" />
        <span>Copy Story</span>
      </button>

      {/* Copy Floor Plan Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl font-mono text-slate-200">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <Copy className="w-4 h-4 text-emerald-400" />
              Duplicate Floor Plan Layout
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Copy all architectural walls, hosted doors, windows, and room boundaries from source story to target story.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">SOURCE FLOOR:</label>
                <select
                  value={copySourceFloor}
                  onChange={(e) => setCopySourceFloor(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {floorPlans.map((fp, idx) => (
                    <option key={idx} value={`floor_${idx}`}>
                      {fp.levelName} (+{fp.elevationY.toFixed(2)}m)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">TARGET STORY / LEVEL:</label>
                <select
                  value={copyTargetFloor}
                  onChange={(e) => setCopyTargetFloor(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {floorPlans.map((fp, idx) => (
                    <option key={idx} value={`floor_${idx}`}>
                      {fp.levelName} (+{fp.elevationY.toFixed(2)}m)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteCopy}
                disabled={isCopying || copySourceFloor === copyTargetFloor}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded text-xs transition-all shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isCopying ? 'Copying...' : 'Execute Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
