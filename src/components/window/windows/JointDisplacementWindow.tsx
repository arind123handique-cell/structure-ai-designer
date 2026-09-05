import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  SelField,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

const DIRS = ['UX', 'UY', 'UZ', 'RX', 'RY', 'RZ'];

export const JointDisplacementWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);

  const nodeDisplacements = activeModel?.nodeDisplacements ?? new Map();

  const lcIds = useMemo(() => {
    const set = new Set<number>();
    for (const m of nodeDisplacements.values()) for (const k of Object.keys(m)) set.add(Number(k));
    return Array.from(set).sort((a, b) => a - b);
  }, [nodeDisplacements]);

  const [lcId, setLcId] = useState<string>('');
  const [showCombos, setShowCombos] = useState(true);

  const rows = useMemo(() => {
    const out: { nodeId: number; lcId: number; d: [number, number, number, number, number, number] }[] = [];
    for (const [nodeId, m] of nodeDisplacements.entries()) {
      for (const k of Object.keys(m)) {
        const id = Number(k);
        if (lcId && id !== Number(lcId)) continue;
        if (!showCombos) continue;
        out.push({ nodeId: Number(nodeId), lcId: id, d: m[Number(k)] });
      }
    }
    return out.sort((a, b) => a.nodeId - b.nodeId || a.lcId - b.lcId);
  }, [nodeDisplacements, lcId, showCombos]);

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Joint Displacements (m / rad)">
          {lcIds.length > 0 && (
            <div className="mb-2">
              <SelField
                label="Load case / combination"
                value={lcId}
                onChange={setLcId}
                options={[{ value: '', label: 'All cases' }, ...lcIds.map((id) => ({ value: String(id), label: `LoadCase ${id}` }))]}
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-300 mt-1">
                <input type="checkbox" checked={showCombos} onChange={(e) => setShowCombos(e.target.checked)} className="accent-sky-500" />
                Include combinations (linear superposition)
              </label>
            </div>
          )}
          {rows.length === 0 && (
            <div className="text-[11px] text-slate-500">
              {nodeDisplacements.size === 0
                ? 'No displacement data. Run analysis first.'
                : 'No rows match the filter.'}
            </div>
          )}
          {rows.length > 0 && (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700 text-left">
                  <th className="py-1 pr-2">Node</th>
                  <th className="pr-2">LC</th>
                  {DIRS.map((d) => <th key={d} className="pr-2">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-0.5 pr-2 text-sky-300">{r.nodeId}</td>
                    <td className="pr-2 text-slate-400">{r.lcId}</td>
                    {r.d.map((v, k) => (
                      <td key={k} className={'pr-2 ' + (Math.abs(v) > 0.02 ? 'text-amber-300' : 'text-slate-300')}>
                        {v === 0 ? '0' : v.toExponential(3)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > 0 && (
            <div className="text-[9px] text-slate-500 mt-1">
              UX/UY/UZ in metres; RX/RY/RZ in radians. Values above 2 cm appear amber.
            </div>
          )}
        </WindowSection>

        {nodeDisplacements.size === 0 && (
          <div className="mb-2"><StatusChip status="WARNING" label="Run analysis to populate displacements." /></div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};