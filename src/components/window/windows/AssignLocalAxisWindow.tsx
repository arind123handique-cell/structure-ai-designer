import React, { useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  WindowSection,
  NumField,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

const ANGLES = ['0', '45', '90', '135', '180'];

export const AssignLocalAxisWindow: React.FC<WindowContentProps> = ({ close }) => {
  const selectedMemberId = useProjectStore((s) => s.selectedMemberId);
  const activeModel = useProjectStore((s) => s.activeModel);
  const assignMemberLocalAxis = useProjectStore((s) => s.assignMemberLocalAxis);

  const selectedMember = selectedMemberId !== undefined && selectedMemberId !== null
    ? activeModel?.members.get(selectedMemberId) ?? null
    : null;

  const currentAngle = String(selectedMember?.betaAngle ?? 0);
  const [angle, setAngle] = useState(currentAngle);
  const [status, setStatus] = useState<'idle' | 'assigned'>('idle');
  const [busy, setBusy] = useState(false);

  const degrees = parseFloat(angle) || 0;

  const apply = async (doClose: boolean) => {
    if (!selectedMember) return;
    setBusy(true);
    try {
      await assignMemberLocalAxis([selectedMember.id], (degrees * Math.PI) / 180);
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
                Current beta angle: {Math.round((selectedMember.betaAngle ?? 0) * 180 / Math.PI)}°
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-400">
              No member selected. Select a member in the 3D/Plan view first.
            </div>
          )}
        </WindowSection>

        <WindowSection title="Local Axis Rotation (Beta)">
          <div className="flex gap-2 mb-2">
            {ANGLES.map((a) => (
              <button
                key={a}
                onClick={() => setAngle(a)}
                className={`px-2 py-1 text-[10px] font-mono border rounded ${
                  angle === a
                    ? 'bg-sky-700 border-sky-500 text-white'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {a}°
              </button>
            ))}
          </div>
          <NumField label="Custom Beta" unit="degrees" value={angle} onChange={setAngle} />
          <div className="text-[10px] text-slate-500 mt-1">
            Rotates the member's local 2-3 axes about its own 1-axis before the global stiffness is formed. Honored by the FEM solver ({degrees.toFixed(0)}°).
          </div>
        </WindowSection>

        {status === 'assigned' && (
          <div className="mb-2">
            <StatusChip status="PASS" label={`Beta = ${degrees.toFixed(0)}° assigned`} />
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