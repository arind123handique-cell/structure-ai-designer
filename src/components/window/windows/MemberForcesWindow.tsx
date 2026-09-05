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

export const MemberForcesWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const selectedMemberId = useProjectStore((s) => s.selectedMemberId);

  const member = selectedMemberId !== undefined && selectedMemberId !== null
    ? activeModel?.members.get(selectedMemberId) ?? null
    : null;

  const forceRows = useMemo(() => {
    if (!activeModel || !member) return [];
    return activeModel.memberForces
      .filter((mf) => mf.memberId === member.id)
      .map((mf) => ({
        lcId: mf.loadCaseId,
        x: mf.sectionLocation,
        axial: mf.axial,
        vy: mf.vy,
        vz: mf.vz,
        torsion: mf.torsion,
        my: mf.my,
        mz: mf.mz,
      }))
      .sort((a, b) => a.x - b.x);
  }, [activeModel, member]);

  const lcIds = useMemo(() => Array.from(new Set(forceRows.map((r) => r.lcId))).sort(), [forceRows]);
  const [lcId, setLcId] = useState<string>('');

  const rows = lcId ? forceRows.filter((r) => r.lcId === Number(lcId)) : forceRows;

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Target Member">
          {member ? (
            <div className="text-xs text-slate-300 flex items-center gap-2">
              <span className="font-mono text-sky-300">M-{member.id}</span>
              <span className="text-[10px] text-slate-500">L = {member.length.toFixed(2)} m</span>
            </div>
          ) : (
            <div className="text-xs text-amber-400">No member selected. Select one in the 3D/Plan view.</div>
          )}
        </WindowSection>

        <WindowSection title="Force Stations (per load case)">
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
            <div className="text-[11px] text-slate-500">
              No forces available. Run analysis first.
            </div>
          )}
          {rows.length > 0 && (
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700 text-left">
                  <th className="py-1 pr-2">LC</th>
                  <th className="pr-2">x/L</th>
                  <th className="pr-2">Axial</th>
                  <th className="pr-2">Vy</th>
                  <th className="pr-2">Vz</th>
                  <th className="pr-2">Tors</th>
                  <th className="pr-2">My</th>
                  <th>Mz</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-0.5 pr-2 text-slate-400">{r.lcId}</td>
                    <td className="pr-2 text-slate-400">{r.x.toFixed(2)}</td>
                    <td className={'pr-2 ' + (r.axial < 0 ? 'text-rose-400' : 'text-slate-200')}>{r.axial.toFixed(2)}</td>
                    <td className="pr-2 text-slate-200">{r.vy.toFixed(2)}</td>
                    <td className="pr-2 text-slate-200">{r.vz.toFixed(2)}</td>
                    <td className="pr-2 text-slate-400">{r.torsion.toFixed(2)}</td>
                    <td className="pr-2 text-slate-200">{r.my.toFixed(2)}</td>
                    <td className="text-slate-200">{r.mz.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </WindowSection>

        {rows.length === 0 && member && (
          <div className="mb-2"><StatusChip status="WARNING" label="Run analysis to populate member forces." /></div>
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