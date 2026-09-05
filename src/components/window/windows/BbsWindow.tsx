import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { BbsEngine, BbsProjectOutput } from '@/features/calculations/bbsEngine';
import {
  WindowSection,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

export const BbsWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const activeProject = useProjectStore((s) => s.activeProject);

  const [rows, setRows] = useState(50);

  const bbs = useMemo<BbsProjectOutput | null>(() => {
    if (!activeModel || !activeProject) return null;
    try {
      return BbsEngine.generateBuildingBbs(activeModel, activeProject);
    } catch {
      return null;
    }
  }, [activeModel, activeProject]);

  const shown = bbs ? bbs.items.slice(0, rows) : [];

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Bar Bending Schedule">
          {!bbs && (
            <div className="text-[11px] text-slate-500">No model / project loaded. BBS requires a saved project.</div>
          )}
          {bbs && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono mb-2">
                <div className="text-slate-500">Project / Doc No.</div>
                <div className="text-right text-slate-200">{bbs.projectName} · {bbs.docNo}</div>
                <div className="text-slate-500">Total rebar length</div>
                <div className="text-right text-slate-200">{bbs.grandTotalLengthM.toFixed(1)} m</div>
                <div className="text-slate-500">Total rebar weight</div>
                <div className="text-right text-slate-200">{bbs.grandTotalWeightKg.toFixed(0)} kg ({bbs.grandTotalWeightMT.toLocaleString()} MT)</div>
                <div className="text-slate-500">Bars</div>
                <div className="text-right text-slate-200">{bbs.items.reduce((s, i) => s + i.totalCount, 0).toLocaleString()}</div>
              </div>
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700 text-left">
                    <th className="py-1 pr-2">No.</th>
                    <th className="pr-2">Elem</th>
                    <th className="pr-2">Bar</th>
                    <th className="pr-2">Dia</th>
                    <th className="pr-2">Cut Len (m)</th>
                    <th className="pr-2">Count</th>
                    <th>Total (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((i) => (
                    <tr key={i.barNo} className="border-b border-slate-800/50">
                      <td className="py-0.5 pr-2 text-slate-400">{i.barNo}</td>
                      <td className="pr-2 text-sky-300">{i.elementTag}</td>
                      <td className="pr-2 text-slate-300">{i.barDescription}</td>
                      <td className="pr-2 text-slate-400">{i.diameter}</td>
                      <td className="pr-2 text-slate-200">{i.cuttingLengthM.toFixed(2)}</td>
                      <td className="pr-2 text-slate-200">{i.totalCount}</td>
                      <td className="text-slate-200">{i.totalLengthM.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bbs.items.length > rows && (
                <div className="flex items-center justify-between mt-1">
                  <button onClick={() => setRows(rows + 100)} className="text-[10px] text-sky-400 hover:text-sky-300">
                    Show more ({bbs.items.length - rows} hidden)
                  </button>
                  <span className="text-[9px] text-slate-500">{bbs.items.length} bar items</span>
                </div>
              )}
              <div className="text-[9px] text-slate-500 mt-1">
                Cutting lengths include bend deductions and hooks per IS 2502.
              </div>
            </>
          )}
        </WindowSection>

        {!bbs && (
          <div className="mb-2"><StatusChip status="WARNING" label="Load a model and save the project first." /></div>
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