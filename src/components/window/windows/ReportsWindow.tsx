import React, { useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { CalculationPdfService, CalculationPdfOptions } from '@/features/calculations/calculationPdfService';
import {
  WindowSection,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

export const ReportsWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const activeProject = useProjectStore((s) => s.activeProject);

  const [includeColumns, setIncludeColumns] = useState(true);
  const [includeBeams, setIncludeBeams] = useState(true);
  const [includePiles, setIncludePiles] = useState(true);
  const [includePileCaps, setIncludePileCaps] = useState(true);
  const [status, setStatus] = useState<'idle' | 'generated'>('idle');

  const generate = () => {
    if (!activeModel || !activeProject) return;
    const options: CalculationPdfOptions = { includeColumns, includeBeams, includePiles, includePileCaps };
    CalculationPdfService.exportAllDesignCalculationsPdf(activeModel, activeProject, options);
    setStatus('generated');
  };

  const toggle = (cur: boolean, set: (v: boolean) => void) => () => set(!cur);

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Structural Design Calculation Book">
          <div className="text-[10px] text-slate-400 leading-relaxed mb-2">
            Export a complete, multi-page A4 calculation book covering all columns, beams, piles and pile
            caps to IS 456:2000, IS 13920:2016 and IS 2911:2010. Generated client-side via jsPDF.
          </div>
          {[
            { label: 'Columns (P-M interaction, slenderness)', v: includeColumns, s: setIncludeColumns },
            { label: 'Beams (flexure, shear, deflection)', v: includeBeams, s: setIncludeBeams },
            { label: 'Piles (IS 2911 axial/lateral)', v: includePiles, s: setIncludePiles },
            { label: 'Pile caps (strut & tie)', v: includePileCaps, s: setIncludePileCaps },
          ].map((o) => (
            <label key={o.label} className="flex items-center gap-2 text-[11px] text-slate-300 mb-1.5">
              <input type="checkbox" checked={o.v} onChange={toggle(o.v, o.s)} className="accent-sky-500" />
              {o.label}
            </label>
          ))}
        </WindowSection>

        {!activeModel || !activeProject ? (
          <div className="mb-2"><StatusChip status="WARNING" label="Load a model and save the project first." /></div>
        ) : (
          <div className="text-[10px] text-slate-500">
            Model: {activeModel.members.size} members · Project: {activeProject.metadata.name}
          </div>
        )}

        {status === 'generated' && (
          <div className="mb-2">
            <StatusChip status="PASS" label="Calculation book generated — check your downloads." />
          </div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
        <WindowBtn variant="success" disabled={!activeModel || !activeProject} onClick={generate}>
          Export Calculation PDF
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};