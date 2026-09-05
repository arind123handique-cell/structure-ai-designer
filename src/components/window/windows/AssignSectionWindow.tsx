import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  SelField,
  NumField,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

const PRESETS: { name: string; yd: number; zd: number; kind: 'BEAM' | 'COLUMN' }[] = [
  { name: 'B230x450', yd: 0.45, zd: 0.23, kind: 'BEAM' },
  { name: 'B300x450', yd: 0.45, zd: 0.3, kind: 'BEAM' },
  { name: 'B300x600', yd: 0.6, zd: 0.3, kind: 'BEAM' },
  { name: 'B230x500', yd: 0.5, zd: 0.23, kind: 'BEAM' },
  { name: 'C300x300', yd: 0.3, zd: 0.3, kind: 'COLUMN' },
  { name: 'C450x450', yd: 0.45, zd: 0.45, kind: 'COLUMN' },
  { name: 'C500x500', yd: 0.5, zd: 0.5, kind: 'COLUMN' },
  { name: 'C600x600', yd: 0.6, zd: 0.6, kind: 'COLUMN' },
];

export const AssignSectionWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const selectedMemberId = useProjectStore((s) => s.selectedMemberId);
  const assignMemberSection = useProjectStore((s) => s.assignMemberSection);

  const selectedMember = selectedMemberId !== undefined && selectedMemberId !== null
    ? activeModel?.members.get(selectedMemberId) ?? null
    : null;

  const [preset, setPreset] = useState('B300x450');
  const [custom, setCustom] = useState(false);
  const [ydMm, setYdMm] = useState('450');
  const [zdMm, setZdMm] = useState('300');
  const [status, setStatus] = useState<'idle' | 'assigned'>('idle');
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    const ym = parseFloat(ydMm) || 0;
    const zm = parseFloat(zdMm) || 0;
    if (custom) {
      const yd = ym / 1000;
      const zd = zm / 1000;
      return {
        name: `${Math.round(zm)}x${Math.round(ym)} mm`,
        yd,
        zd,
        area: yd * zd,
        iy: (zd * yd * yd * yd) / 12,
        iz: (yd * zd * zd * zd) / 12,
      };
    }
    const p = PRESETS.find((x) => x.name === preset) || PRESETS[0];
    return {
      name: p.name,
      yd: p.yd,
      zd: p.zd,
      area: p.yd * p.zd,
      iy: (p.zd * p.yd * p.yd * p.yd) / 12,
      iz: (p.yd * p.zd * p.zd * p.zd) / 12,
    };
  }, [custom, preset, ydMm, zdMm]);

  const apply = async (doClose: boolean) => {
    if (!activeModel || !selectedMember) return;
    setBusy(true);
    try {
      await assignMemberSection([selectedMember.id], {
        type: 'RECTANGULAR',
        yd: preview.yd,
        zd: preview.zd,
        name: preview.name,
      });
      setStatus('assigned');
      if (doClose) close();
    } finally {
      setBusy(false);
    }
  };

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
                Current: {selectedMember.section?.name || `${Math.round((selectedMember.section?.zd || 0) * 1000)}x${Math.round((selectedMember.section?.yd || 0) * 1000)}`}
                {' '}· Material: {selectedMember.materialName || 'M25'}
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-400">
              No member selected. Select a member in the 3D/Plan view first.
            </div>
          )}
        </WindowSection>

        <WindowSection title="Section Source">
          <SelField
            label="Preset"
            value={custom ? '' : preset}
            onChange={(v) => { setPreset(v); setCustom(false); }}
            options={PRESETS.map((p) => ({ value: p.name, label: `${p.name}  (${p.kind})` }))}
          />
          <WindowBtn variant="ghost" onClick={() => setCustom(!custom)}>
            {custom ? 'Use Preset Section' : 'Use Custom Size...'}
          </WindowBtn>
        </WindowSection>

        {custom && (
          <WindowSection title="Custom Section (mm)">
            <NumField label="Depth Y (mm)" value={ydMm} onChange={setYdMm} />
            <NumField label="Width Z (mm)" value={zdMm} onChange={setZdMm} />
          </WindowSection>
        )}

        <WindowSection title="Section Preview">
          <div className="flex items-end justify-between p-2 bg-slate-950 border border-slate-800 rounded">
            <div className="w-8 h-20 bg-sky-800/50 border border-sky-400 rounded-sm" />
            <div className="text-right text-[10px] font-mono text-slate-300">
              <div>{preview.name}</div>
              <div className="text-slate-500">A = {(preview.area * 1e6).toFixed(0)} mm²</div>
              <div className="text-slate-500">Iy = {(preview.iy * 1e9).toFixed(1)} mm⁴</div>
              <div className="text-slate-500">Iz = {(preview.iz * 1e9).toFixed(1)} mm⁴</div>
            </div>
          </div>
        </WindowSection>

        {status === 'assigned' && (
          <div className="mb-2">
            <StatusChip status="PASS" label="Section assigned to member" />
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