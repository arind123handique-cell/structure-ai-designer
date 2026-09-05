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

export const JointReactionsWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);

  const reactions = useMemo(() => activeModel?.reactions ?? [], [activeModel]);
  const lcIds = useMemo(
    () => Array.from(new Set(reactions.map((r) => r.loadCaseId))).sort((a, b) => a - b),
    [reactions]
  );
  const [lcId, setLcId] = useState<string>('');

  const rows = lcId ? reactions.filter((r) => r.loadCaseId === Number(lcId)) : reactions;

  const maxCompression = useMemo(
    () => rows.reduce((m, r) => (r.fy < m ? r.fy : m), Infinity),
    [rows]
  );

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Support Reactions">
          {lcIds.length > 0 && (
            <div className="mb-2">
              <SelField
                label="Load case"
                value={lcId}
                onChange={setLcId}
                options={[{ value: '', label: 'All load cases' }, ...lcIds.map((id) => ({ value: String(id), label: `LoadCase ${id}` }))]}
              />
            </div>
          )}
          {rows.length === 0 && (
            <div className="text-[11px] text-slate-500">No reactions available. Run analysis first.</div>
          )}
          {rows.length > 0 && (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700 text-left">
                  <th className="py-1 pr-2">Node</th>
                  <th className="pr-2">LC</th>
                  <th className="pr-2">FX</th>
                  <th className="pr-2">FY</th>
                  <th className="pr-2">FZ</th>
                  <th className="pr-2">MX</th>
                  <th className="pr-2">MY</th>
                  <th>MZ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-0.5 pr-2 text-sky-300">{r.nodeId}</td>
                    <td className="pr-2 text-slate-400">{r.loadCaseId}</td>
                    <td className="pr-2 text-slate-200">{r.fx.toFixed(2)}</td>
                    <td className={'pr-2 ' + (r.fy === maxCompression ? 'text-rose-400 font-bold' : 'text-slate-200')}>
                      {r.fy.toFixed(2)}
                    </td>
                    <td className="pr-2 text-slate-200">{r.fz.toFixed(2)}</td>
                    <td className="pr-2 text-slate-400">{r.mx.toFixed(2)}</td>
                    <td className="pr-2 text-slate-400">{r.my.toFixed(2)}</td>
                    <td className="text-slate-400">{r.mz.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > 0 && maxCompression !== Infinity && (
            <div className="text-[9px] text-slate-500 mt-1">
              Max compression on node = {maxCompression.toFixed(2)} kN (negative = downward)
            </div>
          )}
        </WindowSection>

        {rows.length === 0 && (
          <div className="mb-2"><StatusChip status="WARNING" label="Run analysis to populate reactions." /></div>
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