import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { MemberLoad } from '@/features/model/types';
import {
  WindowSection,
  SelField,
  NumField,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

const LOAD_TYPES: { value: MemberLoad['type']; label: string }[] = [
  { value: 'UNIFORM', label: 'Uniform (kN/m)' },
  { value: 'POINT', label: 'Point load (kN)' },
  { value: 'TRAPEZOIDAL', label: 'Trapezoidal (kN/m)' },
];

const DIRECTIONS: { value: MemberLoad['direction']; label: string }[] = [
  { value: 'GLOBAL_Y', label: 'Global Y (vertical, -Y)' },
  { value: 'GLOBAL_X', label: 'Global X (horizontal)' },
  { value: 'GLOBAL_Z', label: 'Global Z (horizontal)' },
  { value: 'LOCAL_Y', label: 'Local Y (member axis)' },
];

export const AssignLoadWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const selectedMemberId = useProjectStore((s) => s.selectedMemberId);
  const assignFrameLoads = useProjectStore((s) => s.assignFrameLoads);

  const selectedMember = selectedMemberId !== undefined && selectedMemberId !== null
    ? activeModel?.members.get(selectedMemberId) ?? null
    : null;

  const loadPatterns = useMemo(() => {
    if (!activeModel) return [];
    return Array.from(activeModel.loadCases.entries())
      .filter(([, lc]) => !lc.isCombination)
      .map(([, lc]) => ({ value: lc.title, label: `${lc.title} (${lc.type})` }));
  }, [activeModel]);

  const [pattern, setPattern] = useState('DEAD');
  const [type, setType] = useState<MemberLoad['type']>('UNIFORM');
  const [direction, setDirection] = useState<MemberLoad['direction']>('GLOBAL_Y');
  const [w1, setW1] = useState('10');
  const [w2, setW2] = useState('5');
  const [d1, setD1] = useState('0.5');
  const [d2, setD2] = useState('2.5');
  const [status, setStatus] = useState<'idle' | 'assigned'>('idle');
  const [busy, setBusy] = useState(false);

  const apply = async (doClose: boolean) => {
    if (!selectedMember) return;
    setBusy(true);
    try {
      const load: MemberLoad = {
        memberId: selectedMember.id,
        loadPattern: pattern,
        type,
        direction,
        w1: parseFloat(w1) || 0,
        w2: type === 'TRAPEZOIDAL' ? parseFloat(w2) || 0 : undefined,
        d1: type === 'POINT' || type === 'TRAPEZOIDAL' ? parseFloat(d1) || 0 : undefined,
        d2: type === 'TRAPEZOIDAL' ? parseFloat(d2) || 0 : undefined,
      };
      await assignFrameLoads([selectedMember.id], load);
      setStatus('assigned');
      if (doClose) close();
    } finally {
      setBusy(false);
    }
  };

  const existingLoads = selectedMember ? activeModel?.memberLoads?.get(selectedMember.id) || [] : [];

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Target Member">
          {selectedMember ? (
            <div className="text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sky-300">M-{selectedMember.id}</span>
                <StatusChip status="PASS" label={selectedMember.classification} />
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                L = {selectedMember.length.toFixed(2)} m
                {existingLoads.length > 0 && <> · {existingLoads.length} load(s) defined</>}
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-400">
              No member selected. Select a member in the 3D/Plan view first.
            </div>
          )}
        </WindowSection>

        <WindowSection title="Load Definition">
          <SelField
            label="Load Pattern"
            value={pattern}
            onChange={setPattern}
            options={loadPatterns.length > 0 ? loadPatterns : [{ value: 'DEAD', label: 'DEAD' }]}
          />
          <SelField
            label="Load Type"
            value={type}
            onChange={(v) => setType(v as MemberLoad['type'])}
            options={LOAD_TYPES}
          />
          <SelField
            label="Direction"
            value={direction}
            onChange={(v) => setDirection(v as MemberLoad['direction'])}
            options={DIRECTIONS}
          />
          <NumField label={type === 'POINT' ? 'Magnitude' : 'Magnitude w1'} unit={type === 'POINT' ? 'kN' : 'kN/m'} value={w1} onChange={setW1} />
          {type === 'TRAPEZOIDAL' && <NumField label="Magnitude w2" unit="kN/m" value={w2} onChange={setW2} />}
          {type === 'POINT' && <NumField label="Position from start" unit="m" value={d1} onChange={setD1} />}
          {type === 'TRAPEZOIDAL' && <NumField label="Start distance" unit="m" value={d1} onChange={setD1} />}
          {type === 'TRAPEZOIDAL' && <NumField label="End distance" unit="m" value={d2} onChange={setD2} />}
        </WindowSection>

        {existingLoads.length > 0 && (
          <WindowSection title="Existing Loads on Member">
            <table className="w-full text-[10px] font-mono">
              <tbody>
                {existingLoads.map((l) => (
                  <tr key={l.id} className="border-t border-slate-800">
                    <td className="py-1 text-slate-300">{l.loadPattern}</td>
                    <td className="text-slate-500">{l.type}</td>
                    <td className="text-right text-slate-400">{l.w1}</td>
                    <td className="text-right text-slate-500">{l.direction.replace('GLOBAL_', 'G')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[10px] text-slate-500 mt-1">
              Applying a load of the same pattern replaces the existing entry.
            </div>
          </WindowSection>
        )}

        {status === 'assigned' && (
          <div className="mb-2">
            <StatusChip status="PASS" label={`Load assigned (${pattern})`} />
          </div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
        <WindowBtn variant="success" disabled={busy || !selectedMember} onClick={() => apply(false)}>
          {busy ? 'Applying…' : 'Apply'}
        </WindowBtn>
        <WindowBtn variant="primary" disabled={busy || !selectedMember} onClick={() => apply(true)}>
          {busy ? 'Applying…' : 'Apply & Close'}
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};