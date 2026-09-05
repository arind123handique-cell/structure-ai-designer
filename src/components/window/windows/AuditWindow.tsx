import React, { useMemo } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

const ALLOWABLE_DRIFT = 0.004;

export const AuditWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const projectPileTypes = useProjectStore((s) => s.projectPileTypes);

  const audit = useMemo(() => {
    const summaries = activeModel?.designSummaries ? Array.from(activeModel.designSummaries.values()) : [];
    const drifts = activeModel?.storyDrifts ?? [];
    const piles = (projectPileTypes || []) as { status?: string; id?: string }[];

    const designPass = summaries.filter((s) => s.status === 'PASS').length;
    const designWarn = summaries.filter((s) => s.status === 'WARNING').length;
    const designFail = summaries.filter((s) => s.status === 'FAIL' || s.status === 'NOT_DESIGNED').length;

    const driftExceed = drifts.filter((d) => {
      const ratio = d.height > 0 ? d.driftCm / (d.height * 100) : 0;
      return ratio > ALLOWABLE_DRIFT;
    }).length;

    const pileFail = piles.filter((p) => p.status === 'FAIL').length;

    const memberCount = activeModel?.members.size ?? 0;
    const supportCount = activeModel?.supports.size ?? 0;
    const stable = memberCount > 0 && supportCount > 0;

    return { designPass, designWarn, designFail, driftExceed, pileFail, piles, memberCount, supportCount, stable, totals: summaries.length, driftTotal: drifts.length };
  }, [activeModel, projectPileTypes]);

  const overall: 'PASS' | 'WARNING' | 'FAIL' =
    audit.designFail > 0 || audit.driftExceed > 0 ? 'FAIL' : audit.designWarn > 0 || audit.designPass === 0 ? 'WARNING' : 'PASS';

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Overall Audit">
          <div className="flex items-center gap-2">
            <StatusChip status={overall} label={`Overall: ${overall}`} />
            <span className="text-[10px] text-slate-500">{audit.memberCount} members · {audit.supportCount} supports</span>
          </div>
          {!audit.stable && (
            <div className="text-[10px] text-amber-400 mt-1">
              Model is unstable or empty — add bays via the grid wizard and define supports.
            </div>
          )}
        </WindowSection>

        <WindowSection title="Design Checks (IS 456)">
          {audit.totals === 0 ? (
            <div className="text-[11px] text-slate-500">Run Concrete Frame Design to populate design checks.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-emerald-900/30 border border-emerald-700/50 rounded">
                <div className="text-lg font-mono text-emerald-300">{audit.designPass}</div>
                <div className="text-[9px] text-slate-400">PASS</div>
              </div>
              <div className="p-2 bg-amber-900/30 border border-amber-700/50 rounded">
                <div className="text-lg font-mono text-amber-300">{audit.designWarn}</div>
                <div className="text-[9px] text-slate-400">WARNING</div>
              </div>
              <div className="p-2 bg-rose-900/30 border border-rose-700/50 rounded">
                <div className="text-lg font-mono text-rose-300">{audit.designFail}</div>
                <div className="text-[9px] text-slate-400">FAIL / NOT DESIGNED</div>
              </div>
            </div>
          )}
        </WindowSection>

        <WindowSection title="Lateral Stability (IS 1893)">
          {audit.driftTotal === 0 ? (
            <div className="text-[11px] text-slate-500">Run seismic or FEM analysis to populate drift data.</div>
          ) : (
            <>
              <StatusChip status={audit.driftExceed > 0 ? 'FAIL' : 'PASS'}
                label={`${audit.driftExceed} of ${audit.driftTotal} storey-drift records exceed ${ALLOWABLE_DRIFT}×h`} />
              <div className="text-[10px] text-slate-500 mt-1">Allowable storey drift per IS 1893:2016 Cl. 7.11.1.</div>
            </>
          )}
        </WindowSection>

        <WindowSection title="Foundation (IS 2911)">
          {audit.piles && audit.piles?.length === 0 ? (
            <div className="text-[11px] text-slate-500">No pile types defined. Define pile types from Design → Pile Types.</div>
          ) : (
            <StatusChip status={audit.pileFail > 0 ? 'FAIL' : 'PASS'} label={`${(audit.piles || []).length} pile types · ${audit.pileFail} failing`} />
          )}
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