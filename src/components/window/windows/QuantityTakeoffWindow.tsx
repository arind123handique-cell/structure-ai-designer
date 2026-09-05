import React, { useMemo, useState } from 'react';
import { WindowContentProps } from '../Window';
import { useProjectStore } from '@/features/projects/projectStore';
import { ConcreteVolumeEngine, BuildingConcreteSummary } from '@/features/calculations/concreteVolumeEngine';
import {
  WindowSection,
  WindowBtn,
  WindowFooterBar,
  StatusChip,
} from '../WindowUI';

export const QuantityTakeoffWindow: React.FC<WindowContentProps> = ({ close }) => {
  const activeModel = useProjectStore((s) => s.activeModel);
  const activeProject = useProjectStore((s) => s.activeProject);

  const summary = useMemo<BuildingConcreteSummary | null>(() => {
    if (!activeModel) return null;
    try {
      return ConcreteVolumeEngine.calculateBuildingConcreteSummary(
        activeModel,
        activeProject?.metadata ?? undefined
      );
    } catch {
      return null;
    }
  }, [activeModel, activeProject]);

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <WindowSection title="Concrete & Material Takeoff (IS 456 / IS 10262)">
          {!summary && (
            <div className="text-[11px] text-slate-500">
              No model loaded, or takeoff could not be computed.
            </div>
          )}
          {summary && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono mb-2">
                <div className="text-slate-500">Grand total concrete</div>
                <div className="text-right text-slate-200">{summary.grandTotalConcreteM3.toFixed(1)} m³</div>
                <div className="text-slate-500">Substructure</div>
                <div className="text-right text-slate-200">{summary.substructureConcreteM3.toFixed(1)} m³ ({summary.substructurePercent.toFixed(0)}%)</div>
                <div className="text-slate-500">Superstructure</div>
                <div className="text-right text-slate-200">{summary.superstructureConcreteM3.toFixed(1)} m³ ({summary.superstructurePercent.toFixed(0)}%)</div>
                <div className="text-slate-500">Formwork</div>
                <div className="text-right text-slate-200">{summary.totalFormworkM2.toFixed(0)} m²</div>
                <div className="text-slate-500">Cement (50 kg bags)</div>
                <div className="text-right text-slate-200">{summary.totalCementBags.toFixed(0)} bags</div>
                <div className="text-slate-500">Sand</div>
                <div className="text-right text-slate-200">{summary.totalSandM3.toFixed(1)} m³</div>
                <div className="text-slate-500">Coarse aggregate</div>
                <div className="text-right text-slate-200">{summary.totalAggregateM3.toFixed(1)} m³</div>
                <div className="text-slate-500">Water</div>
                <div className="text-right text-slate-200">{summary.totalWaterLiters.toFixed(0)} L</div>
              </div>

              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-1 mb-1">
                Component breakdown
              </div>
              <table className="w-full text-[10px] font-mono">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700 text-left">
                    <th className="py-1 pr-2">Component</th>
                    <th className="pr-2">Concrete (m³)</th>
                    <th className="pr-2">Formwork (m²)</th>
                    <th className="pr-2">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.components.map((c, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="py-0.5 pr-2 text-slate-300">{c.component}</td>
                      <td className="pr-2 text-slate-200">{c.concreteM3.toFixed(1)}</td>
                      <td className="pr-2 text-slate-200">{c.formworkM2.toFixed(0)}</td>
                      <td className="text-slate-500">{c.percentageShare.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[9px] text-slate-500 mt-1">
                {summary.floorBreakdown.length} floors/substructures included in breakdown.
              </div>
            </>
          )}
        </WindowSection>

        {!summary && (
          <div className="mb-2"><StatusChip status="WARNING" label="Load a model to compute quantities." /></div>
        )}
      </div>
      <WindowFooterBar>
        <WindowBtn variant="ghost" onClick={close}>
          Close
        </WindowBtn>
      </WindowFooterBar>
    </div>
  );
};