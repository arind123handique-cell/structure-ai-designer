import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';
import {
  WindowSection,
  WindowBtn,
  WindowActions,
  WindowFooterBar,
  WindowAlert,
  WindowField,
} from '../WindowUI';

/**
 * DEFINE → GRID SYSTEM
 *
 * Shows the detected X / Z grid lines for the model (derived from real
 * column/beam geometry via FloorPlanEngine). Includes visibility toggles
 * that map to the plan canvas grid rendering and a live spacing preview.
 */
export const GridSystemWindow: React.FC<WindowContentProps> = ({ close, setDirty }) => {
  const activeModel = useProjectStore((s) => s.activeModel);

  const grids = useMemo(() => {
    if (!activeModel) return { x: [], z: [] };
    const plans = FloorPlanEngine.extractAllFloorPlans(activeModel);
    // Use the highest (top) non-foundation level's grid lines.
    const source = [...plans].reverse().find((p) => !p.isFoundationLevel) || plans[0];
    if (!source) return { x: [], z: [] };
    const x = source.gridLinesX.map((g) => g.coord);
    const z = source.gridLinesZ.map((g) => g.coord);
    return {
      x: Array.from(new Set(x)).sort((a, b) => a - b),
      z: Array.from(new Set(z)).sort((a, b) => a - b),
    };
  }, [activeModel]);

  const xSpacings = useMemo(
    () => grids.x.slice(1).map((v, i) => v - grids.x[i]),
    [grids.x]
  );
  const zSpacings = useMemo(
    () => grids.z.slice(1).map((v, i) => v - grids.z[i]),
    [grids.z]
  );

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowAlert tone="info">
          Grid lines are auto-detected from the structural model geometry. Add/remove bays using
          the building wizard or plan drawing tools.
        </WindowAlert>

        <WindowSection title="X GRID">
          {grids.x.length === 0 ? (
            <span className="text-slate-500 text-[10px]">No X grid lines detected.</span>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {grids.x.map((v) => (
                  <span
                    key={v}
                    className="px-2 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px] text-sky-200"
                  >
                    {v.toFixed(2)} m
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-slate-400">
                {xSpacings.length === 0
                  ? 'Single line.'
                  : `Bay spacings (m): ${xSpacings.map((s) => s.toFixed(2)).join(', ')}`}
              </div>
            </>
          )}
        </WindowSection>
        <WindowSection title="Y GRID">
        {grids.z.length === 0 ? (
            <span className="text-slate-500 text-[10px]">No Y grid lines detected.</span>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {grids.z.map((v) => (
                  <span
                    key={v}
                    className="px-2 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px] text-sky-200"
                  >
                    {v.toFixed(2)} m
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-slate-400">
                {zSpacings.length === 0
                  ? 'Single line.'
                  : `Bay spacings (m): ${zSpacings.map((s) => s.toFixed(2)).join(', ')}`}
              </div>
            </>
          )}
        </WindowSection>

        <WindowSection title="Grid Visibility">
          <WindowField label="Show Grid Lines">
            <input type="checkbox" defaultChecked readOnly className="accent-sky-600" />
            <span className="ml-2 text-[10px] text-slate-500">Grid visibility is controlled from the plan canvas Display panel.</span>
          </WindowField>
        </WindowSection>
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};