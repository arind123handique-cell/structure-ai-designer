import React, { useState } from 'react';
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

const ZONES = [
  { value: 'II', label: 'Zone II (0.10)' },
  { value: 'III', label: 'Zone III (0.16)' },
  { value: 'IV', label: 'Zone IV (0.24)' },
  { value: 'V', label: 'Zone V (0.36)' },
];

const SOILS = [
  { value: 'I_ROCK', label: 'I — Rock / hard soil' },
  { value: 'II_MEDIUM', label: 'II — Medium soil' },
  { value: 'III_SOFT', label: 'III — Soft soil' },
];

const ZONE_Z: Record<string, number> = { II: 0.1, III: 0.16, IV: 0.24, V: 0.36 };

export const SeismicLoadWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeProject = useProjectStore((s) => s.activeProject);
  const runSeismicAnalysis = useProjectStore((s) => s.runSeismicAnalysis);

  const settings = activeProject?.metadata.designSettings;
  const [zone, setZone] = useState<string>(settings?.seismicZone || 'IV');
  const [soil, setSoil] = useState<string>(settings?.soilType || 'II_MEDIUM');
  const [r, setR] = useState(String(settings?.responseReductionFactor ?? 5));
  const [i, setI] = useState(String(settings?.importanceFactor ?? 1));
  const [infill, setInfill] = useState(false);
  const [status, setStatus] = useState<'idle' | 'applied' | 'error'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const z = ZONE_Z[zone] ?? 0.16;
  const rVal = parseFloat(r) || 5;
  const iVal = parseFloat(i) || 1;

  const apply = async () => {
    setBusy(true);
    setStatus('idle');
    try {
      await runSeismicAnalysis({
        seismicZone: zone as 'II' | 'III' | 'IV' | 'V',
        zoneFactorZ: z,
        soilType: soil as 'I_ROCK' | 'II_MEDIUM' | 'III_SOFT',
        responseReductionFactorR: rVal,
        importanceFactorI: iVal,
        hasBrickInfill: infill,
      });
      setStatus('applied');
    } catch {
      setStatus('error');
      setError('Seismic analysis failed. Ensure the frame is supported and load patterns EQX/EQZ exist.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="IS 1893:2016 Seismic Parameters">
          <SelField label="Seismic Zone" value={zone} onChange={setZone} options={ZONES} />
          <div className="flex items-center justify-between text-[10px] mb-2">
            <span className="text-slate-500">Zone factor (Z)</span>
            <span className="font-mono text-sky-300">{z.toFixed(2)}</span>
          </div>
          <SelField
            label="Soil Type"
            value={soil}
            onChange={setSoil}
            options={SOILS}
          />
          <NumField label="Response Reduction Factor (R)" value={r} onChange={setR} />
          <div className="text-[9px] text-slate-500 -mt-1 mb-2">5.0 SMRF · 3.0 OMRF</div>
          <NumField label="Importance Factor (I)" value={i} onChange={setI} />
          <div className="text-[9px] text-slate-500 -mt-1 mb-2">1.0 residential · 1.5 post-quake</div>
          <div className="mb-2">
            <label className="flex items-center gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={infill}
                onChange={(e) => setInfill(e.target.checked)}
                className="accent-sky-500"
              />
              Stiff masonry infill present (overstrength factor)
            </label>
          </div>
        </WindowSection>

        <WindowSection title="What happens">
          <div className="text-[10px] text-slate-400 leading-relaxed">
            Computes the equivalent static seismic base shear (IS 1893:2016 Cl. 6.3), distributes storey
            forces to the frame as EQX / EQZ nodal loads, and re-runs the FEM analysis. Load patterns
            &ldquo;Seismic Load X (EQX)&rdquo; and &ldquo;Seismic Load Z (EQZ)&rdquo; must exist.
          </div>
        </WindowSection>

        {status === 'applied' && (
          <div className="mb-2">
            <StatusChip status="PASS" label="Seismic loads applied and analysis re-run" />
          </div>
        )}
        {status === 'error' && (
          <div className="mb-2">
            <StatusChip status="FAIL" label={error} />
          </div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
        <WindowBtn variant="success" disabled={busy} onClick={apply}>
          {busy ? 'Computing…' : 'Apply Seismic Loads'}
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};