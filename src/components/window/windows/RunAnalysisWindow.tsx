import React, { useEffect, useRef, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';
import { openRegisteredWindow } from '../WindowRegistry';
import { Loader2, CheckCircle2, AlertCircle, ChevronsRight, Play } from 'lucide-react';

const STEPS: { title: string; detail: string }[] = [
  { title: 'Reading model geometry', detail: 'nodes, members, supports and sections' },
  { title: 'Assembling global stiffness matrix', detail: '6-DOF element matrices per member' },
  { title: 'Mapping load cases', detail: 'applying uniform / point / trapezoidal loads' },
  { title: 'Solving for displacements', detail: 'direct stiffness elimination (k·u = f)' },
  { title: 'Extracting member forces', detail: 'axial, shear and moment envelope per section' },
  { title: 'Computing support reactions', detail: 'end forces at restrained joints' },
  { title: 'Computing story drifts', detail: 'IS 1893:2016 Cl. 7.11.1 storey drift ratio' },
  { title: 'Storing results in model', detail: 'forces, reactions, drifts and displacements' },
];

type Phase = 'config' | 'running' | 'done' | 'error';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const RunAnalysisWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const runFemAnalysis = useProjectStore((s) => s.runFemAnalysis);

  const [showDiagrams, setShowDiagrams] = useState(true);
  const [phase, setPhase] = useState<Phase>('config');
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [statusLine, setStatusLine] = useState('');

  const cancelledRef = useRef(false);

  useEffect(() => () => { cancelledRef.current = true; }, []);

  const members = activeModel?.members.size ?? 0;
  const nodes = activeModel?.nodes.size ?? 0;
  const supports = activeModel?.supports.size ?? 0;
  const cases = activeModel?.loadCases.size ?? 0;
  const forces = activeModel?.memberForces.length ?? 0;
  const reactions = activeModel?.reactions.length ?? 0;
  const drifts = activeModel?.storyDrifts.length ?? 0;

  const run = async () => {
    setPhase('running');
    setStepIdx(0);
    setProgress(0);
    cancelledRef.current = false;
    const t0 = performance.now();

    const advance = (i: number) => {
      if (cancelledRef.current) return;
      if (i > STEPS.length) return;
      setStepIdx(i);
      const pct = Math.min(100, Math.round((i / STEPS.length) * 100));
      setProgress(pct);
      setStatusLine(STEPS[i - 1]?.detail ?? '');
      window.setTimeout(() => advance(i + 1), 60);
    };
    advance(1);

    // Yield to the browser to ensure the running state and progress bar paint immediately
    await sleep(40);

    let solveErr: unknown = null;
    try {
      await runFemAnalysis();
    } catch (e) {
      console.error('RunAnalysis failed:', e);
      solveErr = e;
    }

    const elapsedMs = performance.now() - t0;
    const remaining = Math.max(0, 500 - elapsedMs);
    await sleep(remaining);

    cancelledRef.current = true;
    setStepIdx(STEPS.length + 1);
    setProgress(100);
    setStatusLine('analysis complete');
    setElapsed(Math.round(performance.now() - t0));

    if (solveErr) {
      setPhase('error');
    } else {
      await sleep(250);
      setPhase('done');
    }
  };

  const openOutput = () => {
    openRegisteredWindow('analysisOutput', undefined, { modal: false });
  };

  const loading = (
    <div className="p-4 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        {/* Progress banner */}
        <div className="mb-4 bg-slate-950 border border-slate-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-sky-300">
              Running 3D FEM Analysis
            </span>
            <span className="ml-auto font-mono text-sm font-bold text-sky-300">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-600 to-cyan-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1.5 h-4 font-mono text-[10px] text-slate-400 flex items-center gap-1">
            <ChevronsRight className="w-3 h-3 text-slate-500" />
            <span>{statusLine || 'initializing…'}</span>
          </div>
        </div>

        {/* Step checklist */}
        <WindowSection title="Solver Status">
          <div className="space-y-1">
            {STEPS.map((s, i) => {
              const stateIdx = i + 1;
              const done = stateIdx < stepIdx || phase === 'done';
              const active = stateIdx === stepIdx;
              return (
                <div
                  key={s.title}
                  className={`flex items-center gap-2.5 rounded px-1.5 py-1 transition-colors ${
                    active ? 'bg-sky-950/40' : ''
                  }`}
                >
                  <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : active ? (
                      <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-700" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div
                      className={`text-[11px] font-mono ${
                        done ? 'text-slate-300' : active ? 'text-sky-200 font-semibold' : 'text-slate-500'
                      }`}
                    >
                      {s.title}
                    </div>
                    <div className="text-[9px] text-slate-600 truncate">{s.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </WindowSection>
      </div>

      <WindowFooterBar>
        <WindowBtn variant="ghost" disabled>Running…</WindowBtn>
      </WindowFooterBar>
    </div>
  );

  const completed = (
    <div className="p-4 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="flex items-start gap-3 bg-emerald-950/40 border border-emerald-700 rounded-lg p-3 mb-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <div className="text-sm font-bold text-emerald-300">Analysis Complete</div>
            <div className="text-[10px] text-emerald-500">
              Direct stiffness 3D FEM (6-DOF) · finished in {elapsed} ms
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="bg-slate-950 border border-slate-700 rounded p-2">
            <div className="text-[9px] uppercase text-slate-500">Nodes</div>
            <div className="font-mono text-sm font-bold text-slate-100">{nodes}</div>
          </div>
          <div className="bg-slate-950 border border-slate-700 rounded p-2">
            <div className="text-[9px] uppercase text-slate-500">Members</div>
            <div className="font-mono text-sm font-bold text-slate-100">{members}</div>
          </div>
          <div className="bg-slate-950 border border-slate-700 rounded p-2">
            <div className="text-[9px] uppercase text-slate-500">Reactions</div>
            <div className="font-mono text-sm font-bold text-slate-100">{reactions}</div>
          </div>
          <div className="bg-slate-950 border border-slate-700 rounded p-2">
            <div className="text-[9px] uppercase text-slate-500">Story drifts</div>
            <div className="font-mono text-sm font-bold text-slate-100">{drifts}</div>
          </div>
        </div>

        <WindowSection title="Results Stored">
          <div className="space-y-1 text-[10px] font-mono text-slate-300">
            <div className="flex justify-between"><span>Member forces</span><span className="text-sky-300">{forces} records</span></div>
            <div className="flex justify-between"><span>Support reactions</span><span className="text-sky-300">{reactions} records</span></div>
            <div className="flex justify-between"><span>Story drifts</span><span className="text-sky-300">{drifts} records</span></div>
          </div>
        </WindowSection>

        <div className="text-[10px] text-slate-500">
          Open the Analysis Output window to review support reactions, member-force envelopes, story drift and joint displacements. {showDiagrams && 'BMD/SFD diagrams are available from the member force diagrams view.'}
        </div>
      </div>

      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>Close</WindowBtn>
        <WindowBtn variant="success" onClick={openOutput}>
          Analysis Output
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );

  const failed = (
    <div className="p-4 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="flex items-start gap-3 bg-red-950/40 border border-red-700 rounded-lg p-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
          <div>
            <div className="text-sm font-bold text-red-300">Analysis Failed</div>
            <div className="text-[10px] text-red-500">Check model supports and load definitions.</div>
          </div>
        </div>
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>Close</WindowBtn>
        <WindowBtn variant="primary" onClick={() => { setPhase('config'); }}>Back</WindowBtn>
      </WindowFooterBar>
    </div>
  );

  const config = (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Analysis Options">
          <label className="flex items-center gap-2 text-[11px] text-slate-300 mb-2">
            <input type="checkbox" checked={showDiagrams} onChange={(e) => setShowDiagrams(e.target.checked)} className="accent-sky-500" />
            Show BMD / SFD diagrams after analysis
          </label>
        </WindowSection>

        <WindowSection title="Model Summary">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
            <div className="text-slate-500">Nodes</div><div className="text-right text-slate-200">{nodes}</div>
            <div className="text-slate-500">Members</div><div className="text-right text-slate-200">{members}</div>
            <div className="text-slate-500">Supports</div><div className="text-right text-slate-200">{supports}</div>
            <div className="text-slate-500">Load patterns</div><div className="text-right text-slate-200">{cases}</div>
            <div className="text-slate-500">Force stations stored</div><div className="text-right text-slate-200">{forces}</div>
            <div className="text-slate-500">Reactions stored</div><div className="text-right text-slate-200">{reactions}</div>
          </div>
          {activeModel && activeModel.members.size === 0 && (
            <div className="text-[10px] text-amber-400 mt-1">Model is empty — nothing to analyze.</div>
          )}
        </WindowSection>
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>Close</WindowBtn>
        <WindowBtn variant="success" disabled={members === 0} onClick={run}>
          <Play className="w-3 h-3 mr-1 inline" /> Run Analysis
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );

  return (
    <div className="h-full bg-slate-900">
      {phase === 'config' && config}
      {phase === 'running' && loading}
      {phase === 'done' && completed}
      {phase === 'error' && failed}
    </div>
  );
};
