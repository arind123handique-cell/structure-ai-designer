import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  WindowField,
  NumField,
  SelField,
  WindowBtn,
  WindowFooterBar,
} from '../WindowUI';

/**
 * DEFINE → SLAB SECTION PROPERTY
 *
 * Edits the thickness of slab plates in the model and shows their geometry.
 */
export const SlabSectionWindow: React.FC<WindowContentProps> = ({ close, setDirty }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const batchUpdatePlateThicknesses = useProjectStore((s) => s.batchUpdatePlateThicknesses);

  const slabs = useMemo(
    () => (activeModel ? Array.from(activeModel.plates.values()).filter((p) => p.classification === 'SLAB') : []),
    [activeModel]
  );

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = slabs.find((s) => s.id === selectedId) || null;
  const [thickness, setThickness] = useState<string>('125');

  const selectSlab = (id: number) => {
    setSelectedId(id);
    const slab = slabs.find((s) => s.id === id);
    if (slab) setThickness(String(Math.round(slab.thickness * 1000)));
  };

  const applyAll = async (doClose: boolean) => {
    await batchUpdatePlateThicknesses(
      slabs.map((s) => ({ plateId: s.id, thicknessMeters: (parseFloat(thickness) || 125) / 1000 }))
    );
    setDirty(false);
    if (doClose) close();
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Slab Panels">
          {slabs.length === 0 ? (
            <span className="text-slate-500 text-[10px]">No slab panels defined in the model.</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {slabs.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSlab(s.id)}
                  className={`px-2 py-1 rounded border text-[10px] font-mono ${
                    s.id === selectedId
                      ? 'bg-sky-700 border-sky-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  S{s.id} · {Math.round(s.thickness * 1000)}mm
                </button>
              ))}
            </div>
          )}
        </WindowSection>

        <WindowSection title="Section Definition">
          <NumField label="Slab Thickness" unit="mm" value={thickness} onChange={setThickness} />
          <WindowField label="Type">
            <span className="text-slate-300 text-xs">Shell Thin (membrane + plate, IS 456 two-way)</span>
          </WindowField>
          {selected && (
            <div className="text-[10px] text-slate-400">
              Selected S{selected.id}: {selected.nodeIds.length} nodes, level{' '}
              {activeModel?.nodes.get(selected.nodeIds[0])?.y.toFixed(2) ?? '?'} m
            </div>
          )}
        </WindowSection>
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Cancel
        </WindowBtn>
        <WindowBtn variant="primary" onClick={() => applyAll(false)}>
          Apply to All Slabs
        </WindowBtn>
        <WindowBtn variant="success" onClick={() => applyAll(true)}>
          OK
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};