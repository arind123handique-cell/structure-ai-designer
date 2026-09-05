import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { LoadCase, LoadType } from '@/features/model/types';
import {
  WindowSection,
  TxtField,
  SelField,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

export interface LoadPatternRow {
  id: number;
  title: string;
  type: LoadType;
  direction?: LoadCase['direction'];
}

const DIRECTIONS: { value: string; label: string }[] = [
  { value: '', label: 'None (global)' },
  { value: 'X', label: 'X' },
  { value: '-X', label: '-X' },
  { value: 'Y', label: 'Y' },
  { value: '-Y', label: '-Y' },
  { value: 'Z', label: 'Z' },
  { value: '-Z', label: '-Z' },
];

export const LoadPatternWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const updateLoadPatterns = useProjectStore((s) => s.updateLoadPatterns);

  const [rows, setRows] = useState<LoadPatternRow[]>(() =>
    activeModel
      ? Array.from(activeModel.loadCases.values()).filter((lc) => !lc.isCombination)
      : []
  );
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');
  const [busy, setBusy] = useState(false);

  const duplicates = useMemo(() => {
    const titles = new Set<string>();
    return rows.filter((r) => {
      const t = r.title.trim().toUpperCase();
      if (titles.has(t)) return true;
      titles.add(t);
      return false;
    });
  }, [rows]);

  const updateRow = (id: number, patch: Partial<LoadPatternRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const maxId = rows.reduce((m, r) => (r.id > m ? r.id : m), 0);
    setRows([...rows, { id: maxId + 1, title: `Pattern ${maxId + 1}`, type: 'OTHER' }]);
  };

  const removeRow = (id: number) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const apply = async (doClose?: () => void) => {
    setBusy(true);
    try {
      await updateLoadPatterns(
        rows.map((r) => ({
          id: r.id,
          title: r.title.trim() || `Pattern ${r.id}`,
          type: r.type,
          direction: r.direction || undefined,
          isCombination: false,
        }))
      );
      setStatus('saved');
      doClose?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex-1 overflow-auto">
        <WindowSection
          title="Load Patterns"
          actions={
            <button onClick={addRow} className="text-[10px] text-sky-400 hover:text-sky-300">
              + Add
            </button>
          }
        >
          {rows.length === 0 && (
            <div className="text-[11px] text-slate-500">No load patterns defined.</div>
          )}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-1 mb-1">
              <span className="text-[9px] font-mono text-slate-500 w-6">#{r.id}</span>
              <input
                value={r.title}
                onChange={(e) => updateRow(r.id, { title: e.target.value })}
                className="flex-1 min-w-0 px-1.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 outline-none focus:border-sky-500"
              />
              <select
                value={r.type}
                onChange={(e) => updateRow(r.id, { type: e.target.value as LoadType })}
                className="w-24 px-1 py-1 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-200 outline-none"
              >
                {(['DEAD','LIVE','WIND','SEISMIC','MASS','TEMPERATURE','OTHER'] as LoadType[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={r.direction || ''}
                onChange={(e) => updateRow(r.id, { direction: e.target.value as LoadCase['direction'] })}
                className="w-14 px-1 py-1 bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-200 outline-none"
              >
                {DIRECTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <button
                onClick={() => removeRow(r.id)}
                disabled={rows.length <= 1}
                className="text-[10px] text-rose-400 hover:text-rose-300 disabled:opacity-30 px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </WindowSection>

        {duplicates.length > 0 && (
          <div className="mb-2">
            <StatusChip status="WARNING" label={`Duplicate pattern names: ${duplicates.map((d) => d.title).join(', ')}`} />
          </div>
        )}
        {status === 'saved' && (
          <div className="mb-2">
            <StatusChip status="PASS" label={`${rows.length} load patterns saved`} />
          </div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
        <WindowBtn variant="success" disabled={busy} onClick={() => apply()}>
          {busy ? 'Saving…' : 'Apply'}
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};