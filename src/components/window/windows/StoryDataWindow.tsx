import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  WindowBtn,
  WindowActions,
  WindowFooterBar,
  WindowAlert,
} from '../WindowUI';
import { Plus, Trash2, Check, ArrowUpRight } from 'lucide-react';

/**
 * DEFINE → STORY DATA
 *
 * Interactive Floor & Story Manager:
 * - Dynamically modify individual story heights (auto-adjusts model nodes and column lengths)
 * - "Add Floor on Top" with optional framing & slab replication
 * - Delete upper story levels
 * - Equalize story heights (3.0m, 3.2m, 3.5m)
 */
export const StoryDataWindow: React.FC<WindowContentProps> = ({ close, setDirty }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const updateStoryHeights = useProjectStore((s) => s.updateStoryHeights);
  const addStoryOnTop = useProjectStore((s) => s.addStoryOnTop);
  const deleteStoryLevel = useProjectStore((s) => s.deleteStoryLevel);

  const [editedHeights, setEditedHeights] = useState<Record<number, string>>({});
  const [newFloorHeight, setNewFloorHeight] = useState<string>('3.2');
  const [replicateFraming, setReplicateFraming] = useState<boolean>(true);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  // Extract distinct floor levels from model
  const storeys = useMemo(() => {
    if (!activeModel) return [];
    const elevations = new Set<number>();
    for (const n of activeModel.nodes.values()) {
      elevations.add(Math.round(n.y * 100) / 100);
    }
    const list = Array.from(elevations).sort((a, b) => a - b);
    return list.map((elev, i) => {
      const height = i === 0 ? 0 : Math.round((list[i] - list[i - 1]) * 100) / 100;
      return {
        elevation: elev,
        height,
        isBase: i === 0 || elev <= 0.05,
      };
    });
  }, [activeModel]);

  const onChangeHeight = (elevation: number, val: string) => {
    setEditedHeights((prev) => ({ ...prev, [elevation]: val }));
    setDirty(true);
  };

  const handleApplyHeights = async () => {
    if (storeys.length === 0) return;
    setIsApplying(true);

    try {
      // Calculate updated elevations cumulatively from heights
      let currentElev = storeys[0].elevation;
      const mappings: { oldElev: number; newElev: number }[] = [
        { oldElev: storeys[0].elevation, newElev: currentElev },
      ];

      for (let i = 1; i < storeys.length; i++) {
        const s = storeys[i];
        const hVal = parseFloat(editedHeights[s.elevation] ?? String(s.height));
        const height = isNaN(hVal) || hVal <= 0.1 ? s.height : hVal;
        currentElev = Math.round((currentElev + height) * 1000) / 1000;
        mappings.push({ oldElev: s.elevation, newElev: currentElev });
      }

      await updateStoryHeights(mappings);
      setEditedHeights({});
      setDirty(false);
      setAppliedNotice('Story heights updated successfully!');
      setTimeout(() => setAppliedNotice(null), 2500);
    } finally {
      setIsApplying(false);
    }
  };

  const handleAddFloor = async () => {
    const h = parseFloat(newFloorHeight);
    if (isNaN(h) || h < 1.0) return;

    setIsApplying(true);
    try {
      await addStoryOnTop(h, replicateFraming);
      setAppliedNotice(`Added new floor (+${h.toFixed(2)}m) on top!`);
      setTimeout(() => setAppliedNotice(null), 2500);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDeleteStory = async (elev: number) => {
    if (storeys.length <= 2) return;
    setIsApplying(true);
    try {
      await deleteStoryLevel(elev);
      setAppliedNotice(`Deleted story at elevation +${elev.toFixed(2)}m.`);
      setTimeout(() => setAppliedNotice(null), 2500);
    } finally {
      setIsApplying(false);
    }
  };

  const handleEqualize = (height: number) => {
    const newEdits: Record<number, string> = {};
    for (let i = 1; i < storeys.length; i++) {
      newEdits[storeys[i].elevation] = height.toFixed(2);
    }
    setEditedHeights(newEdits);
    setDirty(true);
  };

  const handleOk = async () => {
    if (Object.keys(editedHeights).length > 0) {
      await handleApplyHeights();
    }
    close();
  };

  return (
    <div className="p-3 h-full flex flex-col font-mono text-xs select-none">
      <div className="flex-1 overflow-auto space-y-4">
        <WindowAlert tone="info">
          Manage building storey heights and floor diaphragm elevations. Modifying heights shifts
          upper floor joints and column lengths automatically while maintaining full frame connectivity.
        </WindowAlert>

        {appliedNotice && (
          <div className="bg-emerald-950 border border-emerald-600 px-3 py-1.5 rounded flex items-center gap-2 text-emerald-300">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{appliedNotice}</span>
          </div>
        )}

        {/* Story Elevations Table */}
        <WindowSection title="Story Elevations & Heights">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-1 pr-2 w-28">Story Level</th>
                <th className="py-1 pr-2 w-24">Elevation (m)</th>
                <th className="py-1 pr-2">Height (m)</th>
                <th className="py-1 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {storeys.map((s, i) => (
                <tr key={s.elevation} className="border-b border-slate-800">
                  <td className="py-1.5 pr-2 font-bold text-slate-200">
                    {s.isBase ? 'Base / Ground' : `Story ${i} (L${i})`}
                  </td>
                  <td className="py-1.5 pr-2 text-sky-400 font-bold">
                    +{s.elevation.toFixed(2)} m
                  </td>
                  <td className="py-1.5 pr-2">
                    {s.isBase ? (
                      <span className="text-slate-500 italic">0.00 (Base)</span>
                    ) : (
                      <input
                        type="number"
                        step="0.05"
                        className="w-24 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono"
                        value={editedHeights[s.elevation] ?? s.height.toFixed(2)}
                        onChange={(e) => onChangeHeight(s.elevation, e.target.value)}
                      />
                    )}
                  </td>
                  <td className="py-1.5 text-center">
                    {!s.isBase && storeys.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStory(s.elevation)}
                        disabled={isApplying}
                        className="text-red-400 hover:text-red-300 disabled:opacity-30 p-0.5"
                        title="Delete Story Level"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Equalize Heights Presets */}
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <span className="text-slate-400 text-[11px]">Equalize Heights:</span>
            <button
              type="button"
              onClick={() => handleEqualize(3.0)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px]"
            >
              3.00 m
            </button>
            <button
              type="button"
              onClick={() => handleEqualize(3.2)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px]"
            >
              3.20 m
            </button>
            <button
              type="button"
              onClick={() => handleEqualize(3.5)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px]"
            >
              3.50 m
            </button>
          </div>
        </WindowSection>

        {/* Add Floor on Top */}
        <WindowSection title="Add Floor on Top">
          <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5">
                <span className="text-slate-400">Story Height:</span>
                <input
                  type="number"
                  step="0.1"
                  value={newFloorHeight}
                  onChange={(e) => setNewFloorHeight(e.target.value)}
                  className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white"
                />
                <span className="text-slate-400">m</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={replicateFraming}
                  onChange={(e) => setReplicateFraming(e.target.checked)}
                  className="accent-indigo-600 rounded"
                />
                <span>Replicate framing beams &amp; slabs from top floor</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleAddFloor}
              disabled={isApplying}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Floor on Top</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </WindowSection>
      </div>

      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Cancel
        </WindowBtn>
        <WindowBtn variant="primary" onClick={handleApplyHeights} disabled={isApplying}>
          Apply
        </WindowBtn>
        <WindowBtn variant="success" onClick={handleOk} disabled={isApplying}>
          OK
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};