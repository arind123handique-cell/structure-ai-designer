import React, { useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  SelField,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

const CONCRETE_GRADES = [
  { value: 'M20', label: 'M20 (fck 20 N/mm²)' },
  { value: 'M25', label: 'M25 (fck 25 N/mm²)' },
  { value: 'M30', label: 'M30 (fck 30 N/mm²)' },
  { value: 'M35', label: 'M35 (fck 35 N/mm²)' },
  { value: 'M40', label: 'M40 (fck 40 N/mm²)' },
];

export const AssignMaterialWindow: React.FC<WindowContentProps> = ({ close }) => {
  const selectedMemberId = useProjectStore((s) => s.selectedMemberId);
  const activeModel = useProjectStore((s) => s.activeModel);
  const updateMemberMaterial = useProjectStore((s) => s.updateMemberMaterial);

  const selectedMember = selectedMemberId !== undefined && selectedMemberId !== null
    ? activeModel?.members.get(selectedMemberId) ?? null
    : null;

  const [concrete, setConcrete] = useState('M25');
  const [status, setStatus] = useState<'idle' | 'assigned'>('idle');
  const [busy, setBusy] = useState(false);

  const targetAll = selectedMember ? [selectedMember.id] : [];

  const apply = async (doClose: boolean) => {
    if (targetAll.length === 0) return;
    setBusy(true);
    try {
      for (const id of targetAll) {
        await updateMemberMaterial(id, concrete);
      }
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
                Current material: {selectedMember.materialName || 'M25'}
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-400">
              No member selected. Select a member in the 3D/Plan view first.
            </div>
          )}
        </WindowSection>

        <WindowSection title="Material Grade">
          <SelField label="Concrete Grade" value={concrete} onChange={setConcrete} options={CONCRETE_GRADES} />
          <div className="text-[10px] text-slate-500 mt-1">
            Assigns the concrete grade to the selected element. Rebar grade is controlled from Project → Material Properties.
          </div>
        </WindowSection>

        {status === 'assigned' && (
          <div className="mb-2">
            <StatusChip status="PASS" label={`Material assigned (${concrete})`} />
          </div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
        <WindowBtn variant="success" disabled={busy || targetAll.length === 0} onClick={() => apply(false)}>
          {busy ? 'Applying…' : 'Apply'}
        </WindowBtn>
        <WindowBtn variant="primary" disabled={busy || targetAll.length === 0} onClick={() => apply(true)}>
          {busy ? 'Applying…' : 'Apply & Close'}
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};