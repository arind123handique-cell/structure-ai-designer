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

const RESTRAINTS: { value: 'FIXED' | 'PINNED' | 'ROLLER'; label: string; desc: string }[] = [
  { value: 'FIXED', label: 'Fixed', desc: 'All translations + rotations restrained' },
  { value: 'PINNED', label: 'Pinned', desc: 'Translations restrained, rotations released' },
  { value: 'ROLLER', label: 'Roller', desc: 'Vertical restrained, horizontal (X) + rotations released' },
];

export const AssignSupportWindow: React.FC<WindowContentProps> = ({ close }) => {
  const selectedNodeId = useProjectStore((s) => s.selectedNodeId);
  const activeModel = useProjectStore((s) => s.activeModel);
  const assignSupportRestraint = useProjectStore((s) => s.assignSupportRestraint);

  const selectedNode = selectedNodeId !== undefined && selectedNodeId !== null
    ? activeModel?.nodes.get(selectedNodeId) ?? null
    : null;

  const currentSupport = selectedNode ? activeModel?.supports.get(selectedNode.id) : undefined;

  const [type, setType] = useState<'FIXED' | 'PINNED' | 'ROLLER'>('FIXED');
  const [status, setStatus] = useState<'idle' | 'assigned'>('idle');
  const [busy, setBusy] = useState(false);

  const restraintInfo = useMemo(() => RESTRAINTS.find((r) => r.value === type), [type]);

  const apply = async (doClose: boolean) => {
    if (!selectedNode) return;
    setBusy(true);
    try {
      await assignSupportRestraint([selectedNode.id], type);
      setStatus('assigned');
      if (doClose) close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Target Joint">
          {selectedNode ? (
            <div className="text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sky-300">N-{selectedNode.id}</span>
                {currentSupport && <StatusChip status="WARNING" label={`${currentSupport.type} support`} />}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Coords (m): X {selectedNode.x.toFixed(2)} · Y {selectedNode.y.toFixed(2)} · Z {selectedNode.z.toFixed(2)}
                {currentSupport && (
                  <> · Releases: FX{' '}
                    {currentSupport.releases.fx ? 'FREE' : 'FIX'} · FY {currentSupport.releases.fy ? 'FREE' : 'FIX'} · FZ{' '}
                    {currentSupport.releases.fz ? 'FREE' : 'FIX'}</>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-400">
              No joint selected. Select a joint in the 3D/Plan view first.
            </div>
          )}
        </WindowSection>

        <WindowSection title="Restraint">
          <SelField
            label="Support Type"
            value={type}
            onChange={(v) => setType(v as 'FIXED' | 'PINNED' | 'ROLLER')}
            options={RESTRAINTS.map((r) => ({ value: r.value, label: r.label }))}
          />
          <div className="text-[10px] text-slate-500 mt-1">{restraintInfo?.desc}</div>
        </WindowSection>

        {status === 'assigned' && (
          <div className="mb-2">
            <StatusChip status="PASS" label={`Support assigned (${type})`} />
          </div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
        <WindowBtn variant="success" disabled={busy || !selectedNode} onClick={() => apply(false)}>
          {busy ? 'Applying…' : 'Apply'}
        </WindowBtn>
        <WindowBtn variant="primary" disabled={busy || !selectedNode} onClick={() => apply(true)}>
          {busy ? 'Applying…' : 'Apply & Close'}
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};