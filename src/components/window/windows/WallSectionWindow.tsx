import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  WindowField,
  NumField,
  WindowBtn,
  WindowFooterBar,
} from '../WindowUI';

/**
 * DEFINE → WALL SECTION PROPERTY
 *
 * Edits the thickness of wall plates (shear walls) and shows pier/spandrel
 * design readiness from the model.
 */
export const WallSectionWindow: React.FC<WindowContentProps> = ({ close, setDirty }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const batchUpdatePlateThicknesses = useProjectStore((s) => s.batchUpdatePlateThicknesses);

  const walls = useMemo(
    () => (activeModel ? Array.from(activeModel.plates.values()).filter((p) => p.classification === 'WALL') : []),
    [activeModel]
  );

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = walls.find((s) => s.id === selectedId) || null;
  const [thickness, setThickness] = useState<string>('200');

  const selectWall = (id: number) => {
    setSelectedId(id);
    const wall = walls.find((w) => w.id === id);
    if (wall) setThickness(String(Math.round(wall.thickness * 1000)));
  };

  const applyAll = async (doClose: boolean) => {
    await batchUpdatePlateThicknesses(
      walls.map((w) => ({ plateId: w.id, thicknessMeters: (parseFloat(thickness) || 200) / 1000 }))
    );
    setDirty(false);
    if (doClose) close();
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Shear Walls">
          {walls.length === 0 ? (
            <span className="text-slate-500 text-[10px]">
              No wall panels defined. Walls are modeled as vertical plates.
            </span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {walls.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => selectWall(w.id)}
                  className={`px-2 py-1 rounded border text-[10px] font-mono ${
                    w.id === selectedId
                      ? 'bg-sky-700 border-sky-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  W{w.id} · {Math.round(w.thickness * 1000)}mm
                </button>
              ))}
            </div>
          )}
        </WindowSection>
        <WindowSection title="Section Definition">
          <NumField label="Wall Thickness" unit="mm" value={thickness} onChange={setThickness} />
          {selected && (
            <div className="text-[10px] text-slate-400">
              Selected W{selected.id}: {selected.nodeIds.length} nodes
            </div>
          )}
        </WindowSection>
        <WindowSection title="Pier / Spandrel Design">
          <WindowField label="Status">
            <span className="text-slate-300 text-xs">
              Pier &amp; spandrel design runs per wall in the Shear Wall Design view (IS 13920:2016).
            </span>
          </WindowField>
        </WindowSection>
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Cancel
        </WindowBtn>
        <WindowBtn variant="primary" onClick={() => applyAll(false)}>
          Apply to All Walls
        </WindowBtn>
        <WindowBtn variant="success" onClick={() => applyAll(true)}>
          OK
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};