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

const ALLOWABLE_DRIFT = 0.004; // IS 1893:2016 Cl. 7.11.1 storey drift limit

export const StoryDriftWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);

  const drifts = useMemo(() => activeModel?.storyDrifts ?? [], [activeModel]);
  const lcIds = useMemo(() => Array.from(new Set(drifts.map((d) => d.loadCaseId))).sort((a, b) => a - b), [drifts]);
  const [lcId, setLcId] = useState<string>('');

  const rows = lcId ? drifts.filter((d) => d.loadCaseId === Number(lcId)) : drifts;

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Story Drifts">
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
            <div className="text-[11px] text-slate-500">No drift data. Run analysis first.</div>
          )}
          {rows.length > 0 && (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700 text-left">
                  <th className="py-1 pr-2">Storey</th>
                  <th className="pr-2">LC</th>
                  <th className="pr-2">H (m)</th>
                  <th className="pr-2">Δavg (cm)</th>
                  <th className="pr-2">Drift (cm)</th>
                  <th className="pr-2">Ratio</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d, i) => {
                  const ratio = d.height > 0 ? d.driftCm / (d.height * 100) : 0;
                  const pass = ratio <= ALLOWABLE_DRIFT;
                  return (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-0.5 pr-2 text-slate-200">{d.storyName}</td>
                      <td className="pr-2 text-slate-400">{d.loadCaseId}</td>
                      <td className="pr-2 text-slate-400">{d.height.toFixed(2)}</td>
                      <td className="pr-2 text-slate-200">{d.avgDispCm.toFixed(2)}</td>
                      <td className="pr-2 text-slate-200">{d.driftCm.toFixed(2)}</td>
                      <td className={'pr-2 ' + (pass ? 'text-emerald-300' : 'text-rose-400')}>
                        {ratio.toFixed(4)}
                      </td>
                      <td>
                        {pass ? (
                          <StatusChip status="PASS" label="OK" />
                        ) : (
                          <StatusChip status="FAIL" label="EXCEEDS" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {rows.length > 0 && (
            <div className="text-[9px] text-slate-500 mt-1">
              Allowable storey drift = {ALLOWABLE_DRIFT} × storey height (IS 1893:2016 Cl. 7.11.1)
            </div>
          )}
        </WindowSection>

        {rows.length === 0 && (
          <div className="mb-2"><StatusChip status="WARNING" label="Run analysis to populate story drifts." /></div>
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