import React from 'react';
import {
  Box,
  Layers,
  TrendingUp,
  X,
  Plus,
  Trash2,
  Activity,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { Member3D, Node3D, MemberLoad, NormalizedStructuralModel } from '@/features/model/types';

interface EtabsPropertyInspectorProps {
  model: NormalizedStructuralModel | null;
  selectedMemberId: number | null;
  selectedNodeId: number | null;
  onClose: () => void;
  onOpenAssignLoads: () => void;
  onOpenAssignSection: () => void;
  onDeleteSelected: () => void;
}

export const EtabsPropertyInspector: React.FC<EtabsPropertyInspectorProps> = ({
  model,
  selectedMemberId,
  selectedNodeId,
  onClose,
  onOpenAssignLoads,
  onOpenAssignSection,
  onDeleteSelected,
}) => {
  if (!model || (!selectedMemberId && !selectedNodeId)) return null;

  const member = selectedMemberId ? model.members.get(selectedMemberId) : null;
  const node = selectedNodeId ? model.nodes.get(selectedNodeId) : null;
  const memberLoads = selectedMemberId ? model.memberLoads?.get(selectedMemberId) || [] : [];
  const support = selectedNodeId ? model.supports.get(selectedNodeId) : null;

  // Member forces from latest analysis run
  const memberForces = selectedMemberId
    ? model.memberForces.filter((mf) => mf.memberId === selectedMemberId)
    : [];
  const maxAxial = memberForces.reduce((max, f) => Math.max(max, Math.abs(f.axial || 0)), 0);
  const maxShear = memberForces.reduce((max, f) => Math.max(max, Math.abs(f.vy || 0)), 0);
  const maxMoment = memberForces.reduce((max, f) => Math.max(max, Math.abs(f.mz || 0)), 0);

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full font-mono text-xs text-slate-200 select-none shadow-2xl z-20">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
        <div className="flex items-center gap-2">
          {member ? (
            <Box className="w-4 h-4 text-sky-400" />
          ) : (
            <Layers className="w-4 h-4 text-emerald-400" />
          )}
          <span className="font-bold text-white uppercase text-[11px] tracking-wider">
            {member ? `Member ${member.classification} #${member.id}` : `Joint Node #${node?.id}`}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {member && (
          <>
            {/* Section Summary */}
            <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Cross-Section:</span>
                <button
                  onClick={onOpenAssignSection}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-bold"
                >
                  Change
                </button>
              </div>
              <div className="flex items-baseline justify-between">
                <strong className="text-white text-sm">
                  {member.section.name || `${((member.section.yd || 0.45) * 1000).toFixed(0)}x${((member.section.zd || 0.3) * 1000).toFixed(0)}`}
                </strong>
                <span className="text-[10px] text-indigo-300 font-bold px-1.5 py-0.5 bg-indigo-950/80 rounded border border-indigo-500/30">
                  {member.materialName || 'M25'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex justify-between">
                <span>Depth: {((member.section.yd || 0.45) * 1000).toFixed(0)} mm</span>
                <span>Width: {((member.section.zd || 0.3) * 1000).toFixed(0)} mm</span>
                <span>Span: {member.length.toFixed(2)} m</span>
              </div>
            </div>

            {/* Assigned Loads */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-rose-400" /> Assigned Loads ({memberLoads.length})
                </span>
                <button
                  onClick={onOpenAssignLoads}
                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Add Load
                </button>
              </div>

              {memberLoads.length === 0 ? (
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800/80 text-center text-slate-500 text-[11px]">
                  No custom loads assigned. (Self-weight active)
                </div>
              ) : (
                <div className="space-y-1">
                  {memberLoads.map((l, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-slate-800/70 border border-slate-700/60 rounded flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-amber-300 block">
                          {l.type === 'UNIFORM' ? `UDL: ${l.w1.toFixed(1)} kN/m` : `Point: ${l.w1.toFixed(1)} kN`}
                        </span>
                        <span className="text-[10px] text-slate-400">{l.loadPattern} • {l.direction}</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 bg-rose-950 text-rose-300 rounded border border-rose-800">
                        ACTIVE
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FEM Internal Forces (from Analysis) */}
            <div className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" /> Solved Internal Forces
                </span>
                <span className="text-[9px] text-emerald-400 font-bold">FEM Solved</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">Axial (Pu)</span>
                  <strong className="text-sky-300 font-mono text-xs">{maxAxial.toFixed(1)} kN</strong>
                </div>
                <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">Shear (Vy)</span>
                  <strong className="text-emerald-300 font-mono text-xs">{maxShear.toFixed(1)} kN</strong>
                </div>
                <div className="p-1.5 bg-slate-900 rounded border border-slate-800">
                  <span className="text-slate-400 block text-[9px]">Bending (Mz)</span>
                  <strong className="text-amber-300 font-mono text-xs">{maxMoment.toFixed(1)} kNm</strong>
                </div>
              </div>
            </div>
          </>
        )}

        {node && (
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/60 space-y-2">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Joint Node Coordinates:</span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-1.5 bg-slate-900 rounded">
                <span className="text-slate-500 block text-[10px]">X:</span>
                <strong className="text-white font-mono">{node.x.toFixed(2)}m</strong>
              </div>
              <div className="p-1.5 bg-slate-900 rounded">
                <span className="text-slate-500 block text-[10px]">Y (El.):</span>
                <strong className="text-white font-mono">+{node.y.toFixed(2)}m</strong>
              </div>
              <div className="p-1.5 bg-slate-900 rounded">
                <span className="text-slate-500 block text-[10px]">Z:</span>
                <strong className="text-white font-mono">{node.z.toFixed(2)}m</strong>
              </div>
            </div>
            {support && (
              <div className="p-2 bg-emerald-950/40 border border-emerald-500/40 rounded text-emerald-300 font-bold text-center mt-2">
                Boundary Restraint: {support.type} SUPPORT
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Action Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/70">
        <button
          onClick={onDeleteSelected}
          className="w-full py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-700/50 text-red-300 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete Element
        </button>
      </div>
    </div>
  );
};
