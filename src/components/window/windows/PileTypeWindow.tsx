import React, { useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { PileDesignEngine, ProjectPileType, ProjectPileTypeInput } from '@/features/design/pile/pileDesignEngine';
import {
  WindowSection,
  NumField,
  SelField,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

export const PileTypeWindow: React.FC<WindowContentProps> = ({ close }) => {
  const projectPileTypes = useProjectStore((s) => s.projectPileTypes) as ProjectPileType[];
  const setProjectPileTypes = useProjectStore((s) => s.setProjectPileTypes);

  const [selId, setSelId] = useState(projectPileTypes[0]?.id || '');
  const selected = projectPileTypes.find((p) => p.id === selId);

  const [diameter, setDiameter] = useState(selected?.diameter?.toString() || '500');
  const [length, setLength] = useState(selected?.length?.toString() || '12');
  const [soil, setSoil] = useState<string>(selected?.soilType || 'COHESIVE_CLAY');
  const [cu, setCu] = useState(selected?.cu?.toString() || '55');
  const [barCount, setBarCount] = useState(selected?.barCount?.toString() || '6');
  const [barDia, setBarDia] = useState(selected?.barDiameter?.toString() || '16');
  const [status, setStatus] = useState<'idle' | 'designed'>('idle');

  const selectType = (id: string) => {
    setSelId(id);
    const p = projectPileTypes.find((x) => x.id === id);
    if (p) {
      setDiameter(String(p.diameter));
      setLength(String(p.length));
      setSoil(p.soilType);
      setCu(String(p.cu));
      setBarCount(String(p.barCount));
      setBarDia(String(p.barDiameter));
    }
  };

  const designAndSave = () => {
    const input: ProjectPileTypeInput = {
      id: selected?.id || `P-${projectPileTypes.length + 1}`,
      diameter: parseFloat(diameter) || 500,
      length: parseFloat(length) || 12,
      soilType: soil as ProjectPileType['soilType'],
      cu: parseFloat(cu) || 55,
      barCount: parseInt(barCount) || 6,
      barDiameter: parseInt(barDia) || 16,
    };
    const designed = PileDesignEngine.designPileType(input);
    if (selected) {
      useProjectStore.getState().updateProjectPileType(designed);
    } else {
      setProjectPileTypes([...projectPileTypes, designed]);
    }
    setStatus('designed');
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Pile Types (IS 2911:2010)">
          {projectPileTypes.length === 0 && (
            <div className="text-[11px] text-slate-500 mb-2">
              No pile types defined. Configure the parameters below and "Design Pile" to create one.
            </div>
          )}
          {projectPileTypes.length > 0 && (
            <SelField
              label="Existing pile types"
              value={selId}
              onChange={selectType}
              options={projectPileTypes.map((p) => ({ value: p.id, label: `${p.id} — ${p.name}` }))}
            />
          )}
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-slate-500">{selected ? 'Editing ' + selected.id : 'New pile type'}</span>
            <button
              onClick={() => { setSelId(''); }}
              className="text-sky-400 hover:text-sky-300"
            >
              + New Type
            </button>
          </div>
        </WindowSection>

        <WindowSection title="Geometric & Ground Parameters">
          <NumField label="Diameter" unit="mm" value={diameter} onChange={setDiameter} />
          <NumField label="Length" unit="m" value={length} onChange={setLength} />
          <SelField
            label="Soil Type"
            value={soil}
            onChange={setSoil}
            options={[
              { value: 'COHESIVE_CLAY', label: 'Cohesive (clay)' },
              { value: 'COHESIONLESS_SAND', label: 'Cohesionless (sand)' },
            ]}
          />
          <NumField label="Undrained cohesion cu" unit="kN/m²" value={cu} onChange={setCu} />
          <NumField label="Longitudinal bars" value={barCount} onChange={setBarCount} />
          <NumField label="Bar diameter" unit="mm" value={barDia} onChange={setBarDia} />
        </WindowSection>

        {selected && (
          <WindowSection title="Current Design">
            <div className="text-[10px] font-mono text-slate-300">
              <div className="text-slate-500">Safe working load</div>
              <div className="text-slate-200">{selected.safeWorkingLoad} kN</div>
              <div className="text-slate-500 mt-1">Uplift / lateral</div>
              <div className="text-slate-200">{selected.upliftCapacity} / {selected.lateralCapacity} kN</div>
              <div className="text-slate-500 mt-1">Rebar</div>
              <div className="text-slate-200">{selected.rebarCallout} · pt {selected.steelPercentage}%</div>
              <div className="flex items-center mt-1 gap-2">
                <span className="text-slate-500">Status</span>
                <StatusChip status={selected.status === 'PASS' ? 'PASS' : selected.status === 'FAIL' ? 'FAIL' : 'WARNING'} label={selected.status} />
              </div>
            </div>
          </WindowSection>
        )}

        {status === 'designed' && (
          <div className="mb-2">
            <StatusChip status="PASS" label="Pile type designed and saved to project" />
          </div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
        <WindowBtn variant="success" onClick={designAndSave}>
          Design Pile
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};