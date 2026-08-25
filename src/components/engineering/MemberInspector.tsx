import React, { useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { X, Layers, Activity, Ruler, Cpu, Sparkles, ArrowRight, FileText } from 'lucide-react';
import { BeamDesignEngine } from '@/features/design/beam/beamDesignEngine';
import { ColumnDesignEngine } from '@/features/design/column/columnDesignEngine';
import { CalculationModal } from '@/features/calculations/CalculationModal';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { SectionEditModal } from '@/features/design/common/SectionEditModal';
import { IS13920WeakBeamStrongColumn } from '@/features/codes/is13920/weakBeamStrongColumn';

import { ColumnNumberingService } from '@/features/model/columnNumbering';

export const MemberInspector: React.FC = () => {
  const { activeModel, selectedMemberId, selectMember, activeProject } = useProjectStore();
  const [calculationReport, setCalculationReport] = useState<DetailedCalculationReport | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (!activeModel || !selectedMemberId) return null;

  const member = activeModel.members.get(selectedMemberId);
  if (!member) return null;

  const columnMapping = ColumnNumberingService.getColumnMemberMapping(activeModel);
  const colInfo = columnMapping.get(member.id);

  const nodes = activeModel.nodes;
  const startNode = nodes.get(member.startNodeId);
  const endNode = nodes.get(member.endNodeId);

  // Find governing force for this member
  const forces = activeModel.memberForces.filter((f) => f.memberId === selectedMemberId);
  const maxForce = forces.reduce(
    (max, curr) => (Math.abs(curr.mz) > Math.abs(max.mz) ? curr : max),
    forces[0] || { axial: 0, vy: 0, vz: 0, my: 0, mz: 0, loadCaseId: 1 }
  );

  const isBeam = member.classification === 'BEAM';
  const isCol = member.classification === 'COLUMN';

  const widthMm = Math.round((member.section.zd || (isCol ? 0.45 : 0.3)) * 1000);
  const depthMm = Math.round((member.section.yd || (isCol ? 0.55 : 0.45)) * 1000);
  const fck = activeProject?.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
  const fy = activeProject?.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;

  // WBSC check
  const wbsc = isCol
    ? IS13920WeakBeamStrongColumn.evaluateForColumn(widthMm, depthMm, fck, fy, 850, 300, 450)
    : IS13920WeakBeamStrongColumn.evaluateForColumn(450, 550, fck, fy, 850, widthMm, depthMm);

  // Run on-the-fly design calculation
  const handleOpenCalculation = () => {
    if (isBeam) {
      const result = BeamDesignEngine.design({
        memberId: member.id,
        b: widthMm,
        D: depthMm,
        spanLength: member.length,
        fck,
        fy,
        cover: activeProject?.metadata.designSettings.clearCoverBeam || 30,
        Mu_top: Math.max(35, Math.abs(maxForce.mz)),
        Mu_bottom: Math.max(25, Math.abs(maxForce.mz) * 0.7),
        Vu: Math.max(25, Math.abs(maxForce.vy)),
        governingLoadCase: maxForce.loadCaseId,
      });
      setCalculationReport(result.calculationReport);
    } else if (isCol) {
      const result = ColumnDesignEngine.design({
        memberId: member.id,
        b: widthMm,
        D: depthMm,
        unsupportedHeight: member.length || 3.5,
        fck,
        fy,
        cover: activeProject?.metadata.designSettings.clearCoverColumn || 40,
        Pu: Math.max(500, Math.abs(maxForce.axial)),
        Mux: Math.max(35, Math.abs(maxForce.mz)),
        Muy: Math.max(20, Math.abs(maxForce.my)),
        governingLoadCase: maxForce.loadCaseId,
      });
      setCalculationReport(result.calculationReport);
    }
  };

  return (
    <>
      <div className="w-80 md:w-96 bg-surface-card border-l border-ui-border flex flex-col h-full shadow-xl z-20 font-sans overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-ui-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${isCol ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-mono text-sm font-bold text-deep-navy">
                  {colInfo ? `COLUMN ${colInfo.columnLabel}` : `MEMBER #${member.id}`}
                </h3>
                {colInfo && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    (Mem #{member.id})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                <span>{member.classification}</span>
                {colInfo && (
                  <>
                    <span>•</span>
                    <span className="text-sky-700 font-semibold">Joint {colInfo.jointLabel}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">{colInfo.pileCapLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => selectMember(null)}
            className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inspector Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {/* Section 1: Geometry */}
          <div className="space-y-2">
            <h4 className="font-mono text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5" /> Geometry & Coordinates
            </h4>
            <div className="bg-slate-50 border border-ui-border rounded p-3 space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Span Length:</span>
                <span className="font-bold text-slate-800">{member.length.toFixed(3)} m</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/70 pt-1.5">
                <span className="text-slate-500">Start Joint #{member.startNodeId}:</span>
                <span className="text-slate-800">
                  ({startNode?.x.toFixed(2)}, {startNode?.y.toFixed(2)}, {startNode?.z.toFixed(2)})
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200/70 pt-1.5">
                <span className="text-slate-500">End Joint #{member.endNodeId}:</span>
                <span className="text-slate-800">
                  ({endNode?.x.toFixed(2)}, {endNode?.y.toFixed(2)}, {endNode?.z.toFixed(2)})
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Cross Section Properties & Interactive Edit */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> Cross Section & Material
              </h4>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="text-[11px] font-mono text-secondary-brand hover:underline font-bold"
              >
                ✎ Modify Section
              </button>
            </div>
            <div className="bg-slate-50 border border-ui-border rounded p-3 space-y-2 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Dimensions:</span>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="font-bold text-slate-800 hover:text-secondary-brand underline"
                >
                  {widthMm} × {depthMm} mm
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Concrete Grade:</span>
                <span className="text-slate-800 font-semibold">{activeProject?.metadata.designSettings.concreteGrade || 'M25'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Main Steel Grade:</span>
                <span className="text-slate-800 font-semibold">{activeProject?.metadata.designSettings.steelGrade || 'Fe500D'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Clear Cover:</span>
                <span className="text-slate-800">
                  {isBeam
                    ? activeProject?.metadata.designSettings.clearCoverBeam
                    : activeProject?.metadata.designSettings.clearCoverColumn || 30}{' '}
                  mm
                </span>
              </div>
            </div>
          </div>

          {/* Weak Beam Strong Column (WBSC) Box */}
          <div className="space-y-2">
            <h4 className="font-mono text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> IS 13920 WBSC Hierarchy
            </h4>
            <div className={`border rounded p-3 space-y-1.5 ${wbsc.isCompliant ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <div className="flex justify-between items-center font-mono">
                <span className="text-slate-700 font-bold">Ratio (∑Mc / ∑Mb):</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${wbsc.isCompliant ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                  {wbsc.ratio} ({wbsc.status})
                </span>
              </div>
              <p className="text-[10px] font-sans text-slate-600 leading-tight">{wbsc.suggestion}</p>
            </div>
          </div>

          {/* Section 3: Governing Analysis Forces */}
          <div className="space-y-2">
            <h4 className="font-mono text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Governing Analysis Forces
            </h4>
            <div className="bg-slate-50 border border-ui-border rounded p-3 space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Governing Load Case:</span>
                <span className="font-bold text-secondary-brand">LC #{maxForce.loadCaseId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Axial Load (Pu):</span>
                <span className="font-semibold text-slate-800">{maxForce.axial.toFixed(2)} kN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Major Shear (Vy):</span>
                <span className="font-semibold text-slate-800">{maxForce.vy.toFixed(2)} kN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bending Moment (Mz):</span>
                <span className="font-bold text-slate-900">{maxForce.mz.toFixed(2)} kNm</span>
              </div>
            </div>
          </div>

          {/* Section 4: IS Code Design Actions */}
          <div className="bg-emerald-50/70 border border-emerald-300 rounded p-3 space-y-2">
            <div className="flex items-center justify-between text-emerald-950 font-mono text-[11px] font-bold">
              <span>IS 456 & IS 13920 DESIGN ENGINE</span>
              <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded text-[9px]">ACTIVE</span>
            </div>
            <p className="text-[11px] text-emerald-900/80 font-sans">
              Instant calculation sheet with symbolic formulas, code citations, and pass/fail audit.
            </p>
            <button
              onClick={handleOpenCalculation}
              className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-mono text-xs font-semibold shadow-xs transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>Open Step-by-Step Calculation Sheet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Math Sheet Modal */}
      <CalculationModal report={calculationReport} onClose={() => setCalculationReport(null)} />

      {/* Section Edit Modal */}
      <SectionEditModal
        memberId={selectedMemberId}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </>
  );
};
