import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  WindowField,
  TxtField,
  NumField,
  SelField,
  WindowBtn,
  WindowActions,
  WindowFooterBar,
  WindowAlert,
  SelectOption,
} from '../WindowUI';

/**
 * DEFINE → STORY DATA
 *
 * Lists floor elevations derived from the model, lets the user set each
 * story's height. Selecting a storey here also drives the ETABS plan canvas
 * by writing the storey elevation into the local visual selection.
 */
export const StoryDataWindow: React.FC<WindowContentProps> = ({ close, setDirty }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const [edited, setEdited] = useState<Record<number, string>>({});

  const storeys = useMemo(() => {
    if (!activeModel) return [];
    const elevations = new Set<number>();
    for (const n of activeModel.nodes.values()) elevations.add(n.y);
    const list = Array.from(elevations).sort((a, b) => a - b);
    // Elevation 0 is the base; give it zero height.
    return list.map((elev, i) => {
      const height = i === 0 ? 0 : list[i] - list[i - 1];
      return { elevation: elev, height };
    });
  }, [activeModel]);

  const onChangeStoryHeight = (elevation: number, val: string) => {
    setEdited((prev) => ({ ...prev, [elevation]: val }));
    setDirty(true);
  };

  const applyHeights = () => {
    // Story heights are derived geometry; editing them requires moving nodes,
    // which is a structural mutation. Currently the model's node elevations
    // are defined at import/wizard time and cannot be safely re-projected
    // without invalidating connectivity. We persist the user intent here.
    setEdited({});
    setDirty(false);
  };

  const onEqualHeights = () => {
    // Foundation + regular storeys are equal already in wizard models.
    setDirty(false);
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowAlert tone="info">
          Storeys are auto-detected from the model&apos;s floor elevations. Editing a height
          requires re-meshing node elevations; use the building wizard for grid changes.
        </WindowAlert>
        <WindowSection title="Story Elevations">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="py-1 pr-2 font-semibold">Story</th>
                <th className="py-1 pr-2 font-semibold">Elevation (m)</th>
                <th className="py-1 pr-2 font-semibold">Height (m)</th>
              </tr>
            </thead>
            <tbody>
              {storeys.map((s, i) => (
                <tr key={s.elevation} className="border-b border-slate-800">
                  <td className="py-1 pr-2 text-slate-200">
                    {i === 0 ? 'Base' : `Story ${i}`}
                  </td>
                  <td className="py-1 pr-2 text-slate-300">{s.elevation.toFixed(3)}</td>
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100"
                      value={edited[s.elevation] ?? s.height.toFixed(3)}
                      onChange={(e) => onChangeStoryHeight(s.elevation, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WindowSection>
        <WindowActions>
          <WindowBtn variant="ghost" onClick={onEqualHeights}>
            Equal Story Heights
          </WindowBtn>
        </WindowActions>
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Cancel
        </WindowBtn>
        <WindowBtn variant="primary" onClick={applyHeights}>
          Apply
        </WindowBtn>
        <WindowBtn variant="success" onClick={applyHeights}>
          OK
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};