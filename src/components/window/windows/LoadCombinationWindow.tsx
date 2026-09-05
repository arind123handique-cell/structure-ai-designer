import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { LoadCombination } from '@/features/model/types';
import { buildLoadCombinationsFromModel } from '@/features/windows/combos';
import {
  WindowSection,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

export const LoadCombinationWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const updateLoadCombinations = useProjectStore((s) => s.updateLoadCombinations);

  const loadCases = useMemo(() => (activeModel ? Array.from(activeModel.loadCases.values()) : []), [activeModel]);

  const [combos, setCombos] = useState<LoadCombination[]>(() =>
    activeModel ? Array.from(activeModel.loadCombinations.values()) : []
  );
  const [status, setStatus] = useState<'idle' | 'generated' | 'saved'>('idle');
  const [busy, setBusy] = useState(false);

  const generate = () => {
    const generated = buildLoadCombinationsFromModel(loadCases);
    setCombos(generated);
    setStatus('generated');
  };

  const addManual = () => {
    const maxId = combos.reduce((m, c) => (c.id > m ? c.id : m), 0);
    setCombos([
      ...combos,
      {
        id: maxId + 1,
        title: `Manual ${maxId + 1}`,
        factors: loadCases.slice(0, 2).map((lc) => ({ loadCaseId: lc.id, factor: 1 })),
      },
    ]);
  };

  const removeCombo = (id: number) => setCombos((cs) => cs.filter((c) => c.id !== id));

  const apply = async (doClose?: boolean) => {
    setBusy(true);
    try {
      await updateLoadCombinations(combos);
      setStatus('saved');
      if (doClose) close();
    } finally {
      setBusy(false);
    }
  };

  const lcTitle = (id: number) => loadCases.find((lc) => lc.id === id)?.title ?? `LoadCase ${id}`;

  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex-1 overflow-auto">
        <WindowSection
          title="Load Combinations"
          actions={
            <div className="flex gap-1">
              <button onClick={generate} className="text-[10px] text-emerald-400 hover:text-emerald-300">
                IS 456 Auto
              </button>
              <button onClick={addManual} className="text-[10px] text-sky-400 hover:text-sky-300">
                + Manual
              </button>
            </div>
          }
        >
          {status === 'generated' && (
            <div className="mb-2">
              <StatusChip status="PASS" label="Standard IS 456 / IS 1893 combinations generated from defined patterns" />
            </div>
          )}
          {combos.length === 0 && (
            <div className="text-[11px] text-slate-500 mb-2">
              No combinations yet. Use "IS 456 Auto" to generate standard combos from your load patterns.
            </div>
          )}
          {combos.map((c) => (
            <div key={c.id} className="mb-1.5 p-2 bg-slate-950 border border-slate-800 rounded">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-sky-300">{c.title}</span>
                <button onClick={() => removeCombo(c.id)} className="text-[10px] text-rose-400 hover:text-rose-300 px-1">
                  ✕
                </button>
              </div>
              <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                {c.factors.map((f, i) => (
                  <span key={i}>
                    {i > 0 && ' + '}
                    <span className={f.factor < 0 ? 'text-rose-400' : ''}>
                      {f.factor.toLocaleString()} × {lcTitle(f.loadCaseId)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </WindowSection>

        {loadCases.length === 0 && (
          <div className="mb-2">
            <StatusChip status="WARNING" label="No load patterns — define Load Patterns first." />
          </div>
        )}

        {status === 'saved' && (
          <div className="mb-2">
            <StatusChip status="PASS" label={`${combos.length} combinations saved`} />
          </div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
        <WindowBtn variant="success" disabled={busy} onClick={() => apply(false)}>
          {busy ? 'Saving…' : 'Apply'}
        </WindowBtn>
        <WindowBtn variant="primary" disabled={busy} onClick={() => apply(true)}>
          {busy ? 'Saving…' : 'Apply & Close'}
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};