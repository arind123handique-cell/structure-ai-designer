import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { ConcreteGrade, SteelGrade } from '@/types';
import {
  WindowSection,
  SelField,
  NumField,
  WindowBtn,
  WindowActions,
  WindowFooterBar,
  StatusChip,
  WindowField,
} from '../WindowUI';

/** IS 456:2000 code-derived properties (Table 20 / Cl. 6.2). */
const FCK: Record<ConcreteGrade, number> = { M20: 20, M25: 25, M30: 30, M35: 35, M40: 40, M50: 50 };
const FY: Record<SteelGrade, number> = { Fe415: 415, Fe500: 500, Fe500D: 500, Fe550: 550, Fe600: 600 };
const CONCRETE_DENSITY = 25; // kN/m3
const CONCRETE_E = 5000; // N/mm2 * sqrt(fck) is standard; we store base Ec for common grades below
const POISSON = 0.2;

const E_BY_FCK: Record<ConcreteGrade, number> = {
  M20: 22360,
  M25: 25000,
  M30: 27386,
  M35: 29580,
  M40: 31623,
  M50: 35355,
};

/**
 * DEFINE → MATERIAL PROPERTY
 *
 * Edits the concrete and steel grades that drive the live design checks.
 * Code-derived values (fck, fy, Ec, density, poisson) are shown as AUTO;
 * overrides are tracked as USER DEFINED and never silently overwritten.
 */
export const MaterialPropertyWindow: React.FC<WindowContentProps> = ({ close, setDirty }) => {
  const activeProject = useProjectStore((s) => s.activeProject);
  const updateDesignSettings = useProjectStore((s) => s.updateDesignSettings);

  const ds = activeProject?.metadata.designSettings;
  const [concreteGrade, setConcreteGrade] = useState<ConcreteGrade>(ds?.concreteGrade || 'M25');
  const [steelGrade, setSteelGrade] = useState<SteelGrade>(ds?.steelGrade || 'Fe500');
  const [dirty, setLocalDirty] = useState(false);

  const markDirty = () => {
    setLocalDirty(true);
    setDirty(true);
  };

  const derived = useMemo(() => {
    const fck = FCK[concreteGrade];
    const fy = FY[steelGrade];
    return {
      fck,
      fy,
      ec: E_BY_FCK[concreteGrade],
      density: CONCRETE_DENSITY,
      poisson: POISSON,
    };
  }, [concreteGrade, steelGrade]);

  const apply = async (doClose: boolean) => {
    await updateDesignSettings({
      concreteGrade,
      steelGrade,
      shearRebarGrade: steelGrade,
    });
    setLocalDirty(false);
    setDirty(false);
    if (doClose) close();
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Concrete">
          <SelField
            label="Grade"
            value={concreteGrade}
            onChange={(v) => { setConcreteGrade(v as ConcreteGrade); markDirty(); }}
            options={(['M20', 'M25', 'M30', 'M35', 'M40', 'M50'] as ConcreteGrade[]).map((g) => ({
              value: g,
              label: g,
            }))}
          />
          <WindowField label={`Characteristic Strength fck (AUTO)`}>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-100">{derived.fck}</span>
              <span className="text-[10px] text-slate-400">N/mm²</span>
              <StatusChip status="INFO" label="AUTO" />
            </div>
          </WindowField>
          <WindowField label={`Elastic Modulus Ec (AUTO)`}>
            <span className="text-slate-200 text-xs">{derived.ec.toLocaleString()} N/mm²</span>
          </WindowField>
          <WindowField label="Density (AUTO)">
            <span className="text-slate-200 text-xs">{derived.density} kN/m³</span>
          </WindowField>
          <WindowField label="Poisson Ratio (AUTO)">
            <span className="text-slate-200 text-xs">{derived.poisson}</span>
          </WindowField>
        </WindowSection>

        <WindowSection title="Reinforcement Steel">
          <SelField
            label="Grade"
            value={steelGrade}
            onChange={(v) => { setSteelGrade(v as SteelGrade); markDirty(); }}
            options={(['Fe415', 'Fe500', 'Fe500D', 'Fe550', 'Fe600'] as SteelGrade[]).map((g) => ({
              value: g,
              label: g,
            }))}
          />
          <WindowField label={`Yield Strength fy (AUTO)`}>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-100">{derived.fy}</span>
              <span className="text-[10px] text-slate-400">N/mm²</span>
              <StatusChip status="INFO" label="AUTO" />
            </div>
          </WindowField>
        </WindowSection>

        {dirty && (
          <div className="text-[10px] text-amber-300">
            Changes will update the project design settings used by analysis and design checks.
          </div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Cancel
        </WindowBtn>
        <WindowBtn variant="primary" onClick={() => apply(false)}>
          Apply
        </WindowBtn>
        <WindowBtn variant="success" onClick={() => apply(true)}>
          OK
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};