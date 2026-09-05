import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { WindowSection, WindowBtn, WindowFooterBar, StatusChip } from '../WindowUI';

type Tab = 'overview' | 'reactions' | 'forces' | 'drift' | 'displacement';

const ALLOWABLE_DRIFT = 0.004;

const TabBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1.5 rounded font-mono text-[10px] uppercase tracking-wide transition-colors border ${
      active
        ? 'bg-sky-600 border-sky-500 text-white font-bold'
        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
    }`}
  >
    {children}
  </button>
);

const Stat: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-slate-100' }) => (
  <div className="bg-slate-950 border border-slate-700 rounded p-2">
    <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-sm font-bold font-mono mt-0.5 ${tone}`}>{value}</div>
  </div>
);

export const AnalysisOutputWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const [tab, setTab] = useState<Tab>('overview');

  const reactions = useMemo(() => activeModel?.reactions ?? [], [activeModel]);
  const forces = useMemo(() => activeModel?.memberForces ?? [], [activeModel]);
  const drifts = useMemo(() => activeModel?.storyDrifts ?? [], [activeModel]);
  const nodes = activeModel?.nodes.size ?? 0;
  const members = activeModel?.members.size ?? 0;
  const supports = activeModel?.supports.size ?? 0;

  const hasResults = reactions.length > 0 || forces.length > 0 || drifts.length > 0;

  const reactionLCs = useMemo(
    () => Array.from(new Set(reactions.map((r) => r.loadCaseId))).sort((a, b) => a - b),
    [reactions]
  );

  const memberSummary = useMemo(() => {
    const byMember = new Map<number, { axial: number; shear: number; moment: number }>();
    for (const f of forces) {
      const cur = byMember.get(f.memberId) || { axial: 0, shear: 0, moment: 0 };
      cur.axial = Math.max(cur.axial, Math.abs(f.axial || 0));
      cur.shear = Math.max(cur.shear, Math.abs(f.vy || 0), Math.abs(f.vz || 0));
      cur.moment = Math.max(cur.moment, Math.abs(f.my || 0), Math.abs(f.mz || 0));
      byMember.set(f.memberId, cur);
    }
    return Array.from(byMember.entries()).sort((a, b) => a[0] - b[0]);
  }, [forces]);

  const forcesLCs = useMemo(
    () => Array.from(new Set(forces.map((f) => f.loadCaseId))).sort((a, b) => a - b),
    [forces]
  );

  const displacementSummary = useMemo(() => {
    const nd = activeModel?.nodeDisplacements;
    if (!nd) return null;
    let max = 0;
    let maxNode = 0;
    const rows: { nodeId: number; max: number }[] = [];
    const iterable = nd instanceof Map ? Array.from(nd.entries()) : (nd as any[]);
    for (const [nodeId, byLc] of iterable) {
      let nodeMax = 0;
      const values = byLc instanceof Map ? Array.from(byLc.values()) : Object.values(byLc || {});
      for (const d of values) {
        if (Array.isArray(d) && d.length >= 3) {
          const mag = Math.sqrt((d[0] || 0) ** 2 + (d[1] || 0) ** 2 + (d[2] || 0) ** 2);
          if (mag > nodeMax) nodeMax = mag;
        } else if (d && typeof d === 'object') {
          const dd = d as any;
          const mag = Math.sqrt((dd.dx || 0) ** 2 + (dd.dy || 0) ** 2 + (dd.dz || 0) ** 2);
          if (mag > nodeMax) nodeMax = mag;
        }
      }
      if (nodeMax > 0) {
        rows.push({ nodeId: Number(nodeId), max: nodeMax });
        if (nodeMax > max) {
          max = nodeMax;
          maxNode = Number(nodeId);
        }
      }
    }
    return { rows: rows.sort((a, b) => b.max - a.max), max, maxNode };
  }, [activeModel]);

  const maxDrift = useMemo(() => {
    let worst: { _ratio: number } & (typeof drifts)[number] | undefined;
    for (const d of drifts) {
      const ratio = d.height > 0 ? d.driftCm / (d.height * 100) : d.driftRatio;
      if (!worst || ratio > worst._ratio) worst = { ...d, _ratio: ratio };
    }
    return worst;
  }, [drifts]);

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="mb-3 flex flex-wrap gap-1.5">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
        <TabBtn active={tab === 'reactions'} onClick={() => setTab('reactions')}>Reactions</TabBtn>
        <TabBtn active={tab === 'forces'} onClick={() => setTab('forces')}>Member Forces</TabBtn>
        <TabBtn active={tab === 'drift'} onClick={() => setTab('drift')}>Story Drift</TabBtn>
        <TabBtn active={tab === 'displacement'} onClick={() => setTab('displacement')}>Displacements</TabBtn>
      </div>

      <div className="flex-1 overflow-auto">
        {!hasResults && (
          <WindowSection title="No Results">
            <StatusChip status="WARNING" label="No analysis results yet. Run analysis first." />
          </WindowSection>
        )}

        {hasResults && tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              <Stat label="Nodes" value={String(nodes)} />
              <Stat label="Members" value={String(members)} />
              <Stat label="Supports" value={String(supports)} />
              <Stat label="Reaction records" value={String(reactions.length)} />
              <Stat label="Force records" value={String(forces.length)} />
              <Stat label="Story drifts" value={String(drifts.length)} />
            </div>
            <WindowSection title="Max Story Drift">
              {maxDrift ? (
                <div className="flex items-center justify-between bg-slate-950 border border-slate-700 rounded p-2">
                  <span className="font-mono text-[11px] text-slate-200">
                    {maxDrift.storyName} · LC {maxDrift.loadCaseId} · ratio {maxDrift._ratio.toFixed(4)}
                  </span>
                  <StatusChip status={maxDrift._ratio <= ALLOWABLE_DRIFT ? 'PASS' : 'FAIL'} label={maxDrift._ratio <= ALLOWABLE_DRIFT ? 'OK' : 'EXCEEDS'} />
                </div>
              ) : (
                <div className="text-[10px] text-slate-500">No drift data.</div>
              )}
            </WindowSection>
            <WindowSection title="Max Joint Displacement">
              {displacementSummary && displacementSummary.max > 0 ? (
                <div className="font-mono text-[11px] text-slate-200">
                  Node {displacementSummary.maxNode} · max resultant{' '}
                  <span className="text-sky-300">{(displacementSummary.max * 1000).toFixed(2)} mm</span>
                </div>
              ) : (
                <div className="text-[10px] text-slate-500">No displacement data.</div>
              )}
            </WindowSection>
          </>
        )}

        {tab === 'reactions' && (
          <WindowSection title="Support Reactions">
            {reactions.length === 0 && <StatusChip status="WARNING" label="No reactions stored." />}
            {reactions.length > 0 && reactionLCs.length > 0 && (
              <div className="mb-2 text-[9px] text-slate-500">
                Load cases: {reactionLCs.map((id) => `#${id}`).join(', ')}
              </div>
            )}
            {reactions.length > 0 && (
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700 text-left">
                    <th className="py-1 pr-2">Node</th><th className="pr-2">LC</th>
                    <th className="pr-2">FX</th><th className="pr-2">FY</th><th className="pr-2">FZ</th>
                    <th className="pr-2">MX</th><th className="pr-2">MY</th><th>MZ</th>
                  </tr>
                </thead>
                <tbody>
                  {reactions.slice(0, 500).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-0.5 pr-2 text-sky-300">{r.nodeId}</td>
                      <td className="pr-2 text-slate-400">{r.loadCaseId}</td>
                      <td className="pr-2 text-slate-200">{r.fx.toFixed(2)}</td>
                      <td className="pr-2 text-slate-200">{r.fy.toFixed(2)}</td>
                      <td className="pr-2 text-slate-200">{r.fz.toFixed(2)}</td>
                      <td className="pr-2 text-slate-400">{r.mx.toFixed(2)}</td>
                      <td className="pr-2 text-slate-400">{r.my.toFixed(2)}</td>
                      <td className="text-slate-400">{r.mz.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {reactions.length > 500 && (
              <div className="text-[9px] text-slate-500 mt-1">Showing first 500 of {reactions.length} rows.</div>
            )}
          </WindowSection>
        )}

        {tab === 'forces' && (
          <WindowSection title="Member Forces Summary (envelope)">
            {memberSummary.length === 0 && <StatusChip status="WARNING" label="No force data stored." />}
            {memberSummary.length > 0 && forcesLCs.length > 0 && (
              <div className="mb-2 text-[9px] text-slate-500">
                Load cases: {forcesLCs.map((id) => `#${id}`).join(', ')} · max |values| across sections
              </div>
            )}
            {memberSummary.length > 0 && (
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700 text-left">
                    <th className="py-1 pr-2">Member</th>
                    <th className="pr-2">|Axial| (kN)</th>
                    <th className="pr-2">|Shear| (kN)</th>
                    <th>|Moment| (kNm)</th>
                  </tr>
                </thead>
                <tbody>
                  {memberSummary.map(([mid, s]) => (
                    <tr key={mid} className="border-b border-slate-800/50">
                      <td className="py-0.5 pr-2 text-sky-300">{mid}</td>
                      <td className="pr-2 text-slate-200">{s.axial.toFixed(2)}</td>
                      <td className="pr-2 text-slate-200">{s.shear.toFixed(2)}</td>
                      <td className="text-slate-200">{s.moment.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </WindowSection>
        )}

        {tab === 'drift' && (
          <WindowSection title="Story Drifts (IS 1893:2016 Cl. 7.11.1)">
            {drifts.length === 0 && <StatusChip status="WARNING" label="No story drift data." />}
            {drifts.length > 0 && (
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700 text-left">
                    <th className="py-1 pr-2">Storey</th><th className="pr-2">LC</th><th className="pr-2">H (m)</th>
                    <th className="pr-2">Drift (cm)</th><th className="pr-2">Ratio</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drifts.map((d, i) => {
                    const ratio = d.height > 0 ? d.driftCm / (d.height * 100) : d.driftRatio;
                    const pass = ratio <= ALLOWABLE_DRIFT;
                    return (
                      <tr key={i} className="border-b border-slate-800/50">
                        <td className="py-0.5 pr-2 text-slate-200">{d.storyName}</td>
                        <td className="pr-2 text-slate-400">{d.loadCaseId}</td>
                        <td className="pr-2 text-slate-400">{d.height.toFixed(2)}</td>
                        <td className="pr-2 text-slate-200">{d.driftCm.toFixed(2)}</td>
                        <td className={'pr-2 ' + (pass ? 'text-emerald-300' : 'text-rose-400')}>{ratio.toFixed(4)}</td>
                        <td><StatusChip status={pass ? 'PASS' : 'FAIL'} label={pass ? 'OK' : 'EXCEEDS'} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </WindowSection>
        )}

        {tab === 'displacement' && (
          <WindowSection title="Joint Displacements (top 50)">
            {!displacementSummary || displacementSummary.rows.length === 0 ? (
              <StatusChip status="WARNING" label="No displacement data stored." />
            ) : (
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700 text-left">
                    <th className="py-1 pr-2">Node</th><th>Max resultant (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {displacementSummary.rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-0.5 pr-2 text-sky-300">{r.nodeId}</td>
                      <td className="text-slate-200">{(r.max * 1000).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </WindowSection>
        )}
      </div>

      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>Close</WindowBtn>
      </WindowFooterBar>
    </div>
  );
};
