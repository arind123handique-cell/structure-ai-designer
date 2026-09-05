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

export const DesignSummaryWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const runAllDesignChecks = useProjectStore((s) => s.runAllDesignChecks);

  const summaries = useMemo(
    () => (activeModel?.designSummaries ? Array.from(activeModel.designSummaries.values()) : []),
    [activeModel]
  );

  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = filter
    ? summaries.filter((s) => s.classification === filter)
    : summaries;

  const passCount = summaries.filter((s) => s.status === 'PASS').length;

  const run = async () => {
    setBusy(true);
    try {
      await runAllDesignChecks();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Design Summary (IS 456)">
          <div className="flex items-center justify-between mb-2">
            <SelField
              label="Element type"
              value={filter}
              onChange={setFilter}
              options={[
                { value: '', label: 'All element types' },
                { value: 'BEAM', label: 'Beams' },
                { value: 'COLUMN', label: 'Columns' },
              ]}
            />
          </div>
          {summaries.length === 0 && (
            <div className="text-[11px] text-slate-500 mb-2">
              No design summaries yet. Run design checks to populate.
            </div>
          )}
          {rows.length > 0 && (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700 text-left">
                  <th className="py-1 pr-2">Member</th>
                  <th className="pr-2">Type</th>
                  <th className="pr-2">Section</th>
                  <th className="pr-2">LC</th>
                  <th className="pr-2">Axial</th>
                  <th className="pr-2">Shear</th>
                  <th className="pr-2">Moment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.memberId} className="border-b border-slate-800/50">
                    <td className="py-0.5 pr-2 text-sky-300">{s.memberId}</td>
                    <td className="pr-2 text-slate-400">{s.classification}</td>
                    <td className="pr-2 text-slate-300">{s.sectionDimensions}</td>
                    <td className="pr-2 text-slate-400">{s.governingLoadCase}</td>
                    <td className={'pr-2 ' + (s.maxAxial < 0 ? 'text-rose-400' : 'text-slate-300')}>{s.maxAxial.toFixed(1)}</td>
                    <td className="pr-2 text-slate-300">{s.maxShear.toFixed(1)}</td>
                    <td className="pr-2 text-slate-300">{s.maxMoment.toFixed(1)}</td>
                    <td>
                      <StatusChip
                        status={s.status === 'PASS' ? 'PASS' : s.status === 'WARNING' ? 'WARNING' : 'FAIL'}
                        label={s.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {summaries.length > 0 && (
            <div className="text-[9px] text-slate-500 mt-1">
              {passCount} of {summaries.length} elements within design capacity
            </div>
          )}
        </WindowSection>

        {summaries.length === 0 && (
          <div className="mb-2"><StatusChip status="WARNING" label="Run Concrete Frame Design to populate summaries." /></div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
        <WindowBtn variant="success" disabled={busy} onClick={run}>
          {busy ? 'Designing…' : 'Run Design Checks'}
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};