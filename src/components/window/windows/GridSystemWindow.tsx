import React, { useMemo, useState, useEffect } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';
import {
  WindowSection,
  WindowBtn,
  WindowActions,
  WindowFooterBar,
  WindowAlert,
} from '../WindowUI';
import { Plus, Trash2, RotateCcw, Check } from 'lucide-react';

/**
 * DEFINE → GRID SYSTEM
 *
 * Interactive Grid System Editor:
 * Allows adding, editing coordinates, adding bays, deleting grid lines in X and Z,
 * and synchronizing directly into the model and 2D ETABS canvas.
 */
export const GridSystemWindow: React.FC<WindowContentProps> = ({ close, setDirty }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const updateGridSystem = useProjectStore((s) => s.updateGridSystem);

  // Extract base detected grids from model
  const detectedGrids = useMemo(() => {
    if (!activeModel) return { x: [0, 4, 8], z: [0, 4, 8] };
    const plans = FloorPlanEngine.extractAllFloorPlans(activeModel);
    const source = [...plans].reverse().find((p) => !p.isFoundationLevel) || plans[0];
    if (!source) return { x: [0, 4, 8], z: [0, 4, 8] };
    const x = source.gridLinesX.map((g) => g.coord);
    const z = source.gridLinesZ.map((g) => g.coord);
    return {
      x: Array.from(new Set(x)).sort((a, b) => a - b),
      z: Array.from(new Set(z)).sort((a, b) => a - b),
    };
  }, [activeModel]);

  // Initial grid lines from model.customGrids or detected
  const [gridX, setGridX] = useState<number[]>(() => {
    if (activeModel?.customGrids?.x && activeModel.customGrids.x.length > 0) {
      return [...activeModel.customGrids.x].sort((a, b) => a - b);
    }
    return detectedGrids.x.length > 0 ? detectedGrids.x : [0, 4, 8];
  });

  const [gridZ, setGridZ] = useState<number[]>(() => {
    if (activeModel?.customGrids?.z && activeModel.customGrids.z.length > 0) {
      return [...activeModel.customGrids.z].sort((a, b) => a - b);
    }
    return detectedGrids.z.length > 0 ? detectedGrids.z : [0, 4, 8];
  });

  const [newXCoord, setNewXCoord] = useState<string>('');
  const [newZCoord, setNewZCoord] = useState<string>('');
  const [appliedNotice, setAppliedNotice] = useState(false);

  // Sync if model changed from outside
  useEffect(() => {
    if (activeModel?.customGrids?.x) {
      setGridX([...activeModel.customGrids.x].sort((a, b) => a - b));
    }
    if (activeModel?.customGrids?.z) {
      setGridZ([...activeModel.customGrids.z].sort((a, b) => a - b));
    }
  }, [activeModel?.customGrids]);

  const handleUpdateX = (index: number, val: number) => {
    const next = [...gridX];
    next[index] = val;
    setGridX(next);
    setDirty(true);
  };

  const handleUpdateZ = (index: number, val: number) => {
    const next = [...gridZ];
    next[index] = val;
    setGridZ(next);
    setDirty(true);
  };

  const handleDeleteX = (index: number) => {
    if (gridX.length <= 1) return;
    setGridX(gridX.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleDeleteZ = (index: number) => {
    if (gridZ.length <= 1) return;
    setGridZ(gridZ.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleAddX = () => {
    const val = parseFloat(newXCoord);
    if (!isNaN(val) && !gridX.includes(val)) {
      const next = [...gridX, val].sort((a, b) => a - b);
      setGridX(next);
      setNewXCoord('');
      setDirty(true);
    }
  };

  const handleAddZ = () => {
    const val = parseFloat(newZCoord);
    if (!isNaN(val) && !gridZ.includes(val)) {
      const next = [...gridZ, val].sort((a, b) => a - b);
      setGridZ(next);
      setNewZCoord('');
      setDirty(true);
    }
  };

  const handleAddBayX = (spacing = 4.0) => {
    const last = gridX.length > 0 ? gridX[gridX.length - 1] : 0;
    const next = [...gridX, parseFloat((last + spacing).toFixed(2))].sort((a, b) => a - b);
    setGridX(next);
    setDirty(true);
  };

  const handleAddBayZ = (spacing = 4.0) => {
    const last = gridZ.length > 0 ? gridZ[gridZ.length - 1] : 0;
    const next = [...gridZ, parseFloat((last + spacing).toFixed(2))].sort((a, b) => a - b);
    setGridZ(next);
    setDirty(true);
  };

  const handleResetDetected = () => {
    setGridX(detectedGrids.x.length > 0 ? detectedGrids.x : [0, 4, 8]);
    setGridZ(detectedGrids.z.length > 0 ? detectedGrids.z : [0, 4, 8]);
    setDirty(true);
  };

  const applyGrids = async () => {
    await updateGridSystem(gridX, gridZ);
    setDirty(false);
    setAppliedNotice(true);
    setTimeout(() => setAppliedNotice(false), 2000);
  };

  const handleOk = async () => {
    await applyGrids();
    close();
  };

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  return (
    <div className="p-3 h-full flex flex-col font-mono text-xs select-none">
      <div className="flex-1 overflow-auto space-y-4">
        <WindowAlert tone="info">
          Modify grid coordinates and bay spacings. Changes update the 2D CAD plan canvas, snap engine,
          and drawing aids instantly.
        </WindowAlert>

        {appliedNotice && (
          <div className="bg-emerald-950 border border-emerald-600 px-3 py-1.5 rounded flex items-center gap-2 text-emerald-300">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Grid system updated and synchronized!</span>
          </div>
        )}

        {/* X Grids (Vertical Grid Lines) */}
        <WindowSection title="X Grid Lines (Vertical)">
          <div className="space-y-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-1 pr-2 w-16">Grid ID</th>
                  <th className="py-1 pr-2">Coord (m)</th>
                  <th className="py-1 pr-2 w-24">Bay (m)</th>
                  <th className="py-1 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {gridX.map((x, i) => {
                  const bay = i > 0 ? (x - gridX[i - 1]).toFixed(2) : '-';
                  return (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-1 text-sky-400 font-bold">GRID {i + 1}</td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          step="0.1"
                          value={x}
                          onChange={(e) => handleUpdateX(i, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono"
                        />
                      </td>
                      <td className="py-1 pr-2 text-slate-400">{bay}</td>
                      <td className="py-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteX(i)}
                          disabled={gridX.length <= 1}
                          className="text-red-400 hover:text-red-300 disabled:opacity-30 p-0.5"
                          title="Delete Grid Line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Add X Line and Bay */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <input
                type="number"
                step="0.5"
                placeholder="X (m)"
                value={newXCoord}
                onChange={(e) => setNewXCoord(e.target.value)}
                className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100"
              />
              <button
                type="button"
                onClick={handleAddX}
                className="px-2 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add X</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBayX(4.0)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-600 rounded font-bold"
              >
                + Bay (4.0m)
              </button>
              <button
                type="button"
                onClick={() => handleAddBayX(5.0)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-600 rounded font-bold"
              >
                + Bay (5.0m)
              </button>
            </div>
          </div>
        </WindowSection>

        {/* Z Grids (Horizontal Grid Lines) */}
        <WindowSection title="Z / Y Grid Lines (Horizontal)">
          <div className="space-y-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="py-1 pr-2 w-16">Grid ID</th>
                  <th className="py-1 pr-2">Coord (m)</th>
                  <th className="py-1 pr-2 w-24">Bay (m)</th>
                  <th className="py-1 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {gridZ.map((z, i) => {
                  const label = letters[i % letters.length] || `Z${i + 1}`;
                  const bay = i > 0 ? (z - gridZ[i - 1]).toFixed(2) : '-';
                  return (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-1 text-indigo-400 font-bold">GRID {label}</td>
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          step="0.1"
                          value={z}
                          onChange={(e) => handleUpdateZ(i, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono"
                        />
                      </td>
                      <td className="py-1 pr-2 text-slate-400">{bay}</td>
                      <td className="py-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteZ(i)}
                          disabled={gridZ.length <= 1}
                          className="text-red-400 hover:text-red-300 disabled:opacity-30 p-0.5"
                          title="Delete Grid Line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Add Z Line and Bay */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <input
                type="number"
                step="0.5"
                placeholder="Z (m)"
                value={newZCoord}
                onChange={(e) => setNewZCoord(e.target.value)}
                className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100"
              />
              <button
                type="button"
                onClick={handleAddZ}
                className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded font-bold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Z</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBayZ(4.0)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-600 rounded font-bold"
              >
                + Bay (4.0m)
              </button>
              <button
                type="button"
                onClick={() => handleAddBayZ(5.0)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-600 rounded font-bold"
              >
                + Bay (5.0m)
              </button>
            </div>
          </div>
        </WindowSection>

        <WindowActions>
          <WindowBtn variant="ghost" onClick={handleResetDetected}>
            <RotateCcw className="w-3.5 h-3.5 mr-1 inline" />
            Reset to Detected Grids
          </WindowBtn>
        </WindowActions>
      </div>

      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Cancel
        </WindowBtn>
        <WindowBtn variant="primary" onClick={applyGrids}>
          Apply
        </WindowBtn>
        <WindowBtn variant="success" onClick={handleOk}>
          OK
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};