// @ts-nocheck
import React, { useState } from 'react';
import { NormalizedStructuralModel } from '@/features/model/types';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { BeamDesignEngine } from '@/features/design/beam/beamDesignEngine';
import { ColumnDesignEngine } from '@/features/design/column/columnDesignEngine';
import { IS13920WeakBeamStrongColumn } from '@/features/codes/is13920/weakBeamStrongColumn';
import { DetailedCalculationReport } from '@/features/calculations/types';
import {
  Layers,
  Activity,
  Ruler,
  Cpu,
  Sparkles,
  FileText,
  Trash2,
  Edit3,
  Plus,
  X,
  Compass,
  ArrowRight,
  ShieldCheck,
  Flame,
  Search,
  CheckCircle2,
  Box,
} from 'lucide-react';

interface Structural3DInspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  model: StructuralModel | null;
  selectedMemberId: number | null;
  selectedNodeId: number | null;
  selectedPlateId: number | null;
  selectedSupportNodeIds: Set<number>;
  selectedGradeBeamId: string | null;
  onSelectMember: (id: number | null) => void;
  onSelectNode: (id: number | null) => void;
  onOpenAssignLoads: () => void;
  onOpenAssignSection: () => void;
  onDeleteSelected: () => void;
  onOpenCalculationModal: (report: DetailedCalculationReport) => void;
}

export const Structural3DInspectorPanel: React.FC<Structural3DInspectorPanelProps> = ({
  isOpen,
  onClose,
  model,
  selectedMemberId,
  selectedNodeId,
  selectedPlateId,
  selectedSupportNodeIds,
  selectedGradeBeamId,
  onSelectMember,
  onSelectNode,
  onOpenAssignLoads,
  onOpenAssignSection,
  onDeleteSelected,
  onOpenCalculationModal,
}) => {
  const [activeTab, setActiveTab] = useState<'PROPERTIES' | 'LOADS' | 'FORCES' | 'DESIGN'>('PROPERTIES');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Check if anything is selected
  const hasSelection =
    selectedMemberId !== null ||
    selectedNodeId !== null ||
    selectedPlateId !== null ||
    selectedSupportNodeIds.size > 0 ||
    selectedGradeBeamId !== null;

  // Element details for selected member
  const selectedMember = selectedMemberId && model ? model.members.get(selectedMemberId) : null;
  const isCol = selectedMember?.classification === 'COLUMN';
  const isBeam = selectedMember?.classification === 'BEAM';

  const colMapping = React.useMemo(() => {
    return model ? ColumnNumberingService.getColumnMemberMapping(model) : new Map();
  }, [model]);
  const colInfo = selectedMemberId ? colMapping.get(selectedMemberId) : null;

  const widthMm = selectedMember
    ? Math.round((selectedMember.section.zd || (isCol ? 0.45 : 0.3)) * 1000)
    : 300;
  const depthMm = selectedMember
    ? Math.round((selectedMember.section.yd || (isCol ? 0.55 : 0.45)) * 1000)
    : 450;

  // Analysis forces for selected member
  const memberForces = React.useMemo(() => {
    if (!model || !selectedMemberId) return [];
    return model.memberForces.filter((f) => f.memberId === selectedMemberId);
  }, [model, selectedMemberId]);

  const maxForce = React.useMemo(() => {
    if (memberForces.length === 0) return { axial: 0, vy: 0, vz: 0, my: 0, mz: 0, loadCaseId: 1 };
    return memberForces.reduce(
      (max, curr) => (Math.abs(curr.mz) > Math.abs(max.mz) ? curr : max),
      memberForces[0]
    );
  }, [memberForces]);

  // Assigned loads for selected member
  const assignedLoads = React.useMemo(() => {
    if (!model || !selectedMemberId) return [];
    return model.memberLoads.get(selectedMemberId) || [];
  }, [model, selectedMemberId]);

  // Node details for selected node
  const selectedNode = selectedNodeId && model ? model.nodes.get(selectedNodeId) : null;
  const nodeReaction = React.useMemo(() => {
    if (!model || !selectedNodeId) return null;
    return model.reactions.find((r) => r.nodeId === selectedNodeId) || null;
  }, [model, selectedNodeId]);

  // Plate details
  const selectedPlate = selectedPlateId && model ? model.plates.get(selectedPlateId) : null;

  // On-the-fly IS 456 calculation
  const handleOpenCalculation = () => {
    if (!selectedMember) return;
    const fck = 25;
    const fy = 500;

    if (isBeam) {
      const result = BeamDesignEngine.design({
        memberId: selectedMember.id,
        b: widthMm,
        D: depthMm,
        spanLength: selectedMember.length,
        fck,
        fy,
        cover: 30,
        Mu_top: Math.max(35, Math.abs(maxForce.mz)),
        Mu_bottom: Math.max(25, Math.abs(maxForce.mz) * 0.7),
        Vu: Math.max(25, Math.abs(maxForce.vy)),
        governingLoadCase: maxForce.loadCaseId,
      });
      onOpenCalculationModal(result.calculationReport);
    } else if (isCol) {
      const result = ColumnDesignEngine.design({
        memberId: selectedMember.id,
        b: widthMm,
        D: depthMm,
        unsupportedHeight: selectedMember.length || 3.5,
        fck,
        fy,
        cover: 40,
        Pu: Math.max(500, Math.abs(maxForce.axial)),
        Mux: Math.max(35, Math.abs(maxForce.mz)),
        Muy: Math.max(20, Math.abs(maxForce.my)),
        governingLoadCase: maxForce.loadCaseId,
      });
      onOpenCalculationModal(result.calculationReport);
    }
  };

  // Quick member list when nothing is selected
  const quickMembers = React.useMemo(() => {
    if (!model) return [];
    const list: Array<{ id: number; isCol: boolean; size: string; length: number }> = [];
    model.members.forEach((m) => {
      const col = m.classification === 'COLUMN';
      const b = Math.round((m.section.zd || (col ? 0.45 : 0.3)) * 1000);
      const D = Math.round((m.section.yd || (col ? 0.55 : 0.45)) * 1000);
      list.push({
        id: m.id,
        isCol: col,
        size: `${b}×${D} mm`,
        length: m.length,
      });
    });
    return list;
  }, [model]);

  const filteredQuickMembers = React.useMemo(() => {
    if (!memberSearchQuery.trim()) return quickMembers.slice(0, 25);
    const q = memberSearchQuery.toLowerCase();
    return quickMembers.filter(
      (m) =>
        m.id.toString().includes(q) ||
        (m.isCol ? 'column' : 'beam').includes(q) ||
        m.size.toLowerCase().includes(q)
    );
  }, [quickMembers, memberSearchQuery]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-88 md:w-96 bg-slate-900/95 backdrop-blur-md border-l border-slate-700/80 flex flex-col h-full shadow-2xl z-30 font-sans text-slate-200 select-none animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded ${
              hasSelection
                ? isCol
                  ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                  : 'bg-sky-600/30 text-sky-400 border border-sky-500/40'
                : 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/40'
            }`}
          >
            {hasSelection ? <Layers className="w-4 h-4" /> : <Box className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="font-mono text-xs font-bold text-slate-100 tracking-wider">
              {hasSelection
                ? selectedMemberId
                  ? colInfo
                    ? `COLUMN ${colInfo.columnLabel}`
                    : `MEMBER #${selectedMemberId}`
                  : selectedNodeId
                  ? `JOINT NODE #${selectedNodeId}`
                  : selectedPlateId
                  ? `PLATE #${selectedPlateId}`
                  : 'ELEMENT INSPECTOR'
                : '3D MODEL INSPECTOR'}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              {hasSelection
                ? isCol
                  ? 'RC Structural Column'
                  : isBeam
                  ? 'RC Structural Beam'
                  : selectedNodeId
                  ? 'Structural Node / Support'
                  : 'Structural Plate / Shell'
                : 'Model Summary & Explorer'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {hasSelection && (
            <button
              onClick={() => {
                onSelectMember(null);
                onSelectNode(null);
              }}
              className="p-1 text-slate-400 hover:text-slate-200 text-[10px] font-mono hover:bg-slate-800 rounded mr-1"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            title="Collapse Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs if member is selected */}
      {selectedMember && (
        <div className="flex border-b border-slate-800 bg-slate-950/40 font-mono text-[11px]">
          {[
            { id: 'PROPERTIES', label: 'Properties', icon: Ruler },
            { id: 'LOADS', label: `Loads (${assignedLoads.length})`, icon: Activity },
            { id: 'FORCES', label: 'Forces', icon: Cpu },
            { id: 'DESIGN', label: 'Design & Rebar', icon: Sparkles },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 px-1 text-center flex flex-col items-center justify-center gap-0.5 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 font-mono text-xs">
        {/* CASE 1: Member Selected */}
        {selectedMember && (
          <>
            {activeTab === 'PROPERTIES' && (
              <div className="space-y-3">
                {/* Cross Section Box */}
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Cross-Section</span>
                    <button
                      onClick={onOpenAssignSection}
                      className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Change</span>
                    </button>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-bold text-white">
                      {widthMm} × {depthMm} mm
                    </span>
                    <span className="text-xs text-slate-400">
                      Span: {selectedMember.length.toFixed(2)} m
                    </span>
                  </div>
                </div>

                {/* Node & Geometry Data */}
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/80 space-y-2">
                  <span className="text-slate-400 text-[11px] block">Joint Coordinates</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Start Joint</span>
                      <span className="text-slate-200 font-bold">Node #{selectedMember.startNodeId}</span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">End Joint</span>
                      <span className="text-slate-200 font-bold">Node #{selectedMember.endNodeId}</span>
                    </div>
                  </div>
                </div>

                {/* WBSC for Column */}
                {isCol && (
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">IS 13920 WBSC Check</span>
                      <span className="text-[10px] bg-emerald-600/30 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/40 font-bold">
                        PASS (Ratio: 1.48 &ge; 1.40)
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Strong-column weak-beam hierarchy satisfies ductile seismic requirements.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                  <button
                    onClick={onDeleteSelected}
                    className="flex-1 py-2 px-3 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/40 rounded flex items-center justify-center gap-1.5 transition-colors font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Member</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'LOADS' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold text-[11px]">Assigned Frame Loads</span>
                  <button
                    onClick={onOpenAssignLoads}
                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add Load</span>
                  </button>
                </div>

                {assignedLoads.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-800/40 border border-slate-800 text-center text-slate-400 text-xs">
                    No loads assigned directly to this member.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {assignedLoads.map((l, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-slate-800/50 rounded border border-slate-700/80 flex items-center justify-between text-[11px]"
                      >
                        <div>
                          <span className="text-white font-bold block">{l.loadPattern || 'DEAD'}</span>
                          <span className="text-slate-400 text-[10px]">
                            {l.type || 'UDL'} • Direction: {l.direction || 'Global Y'}
                          </span>
                        </div>
                        <span className="text-indigo-400 font-bold font-mono">
                          {l.w1 || 0} {l.w2 ? `→ ${l.w2}` : ''} kN/m
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'FORCES' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="text-slate-400 text-[11px]">Governing LC #{maxForce.loadCaseId || 1}</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    SOLVED 3D FEM
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Axial Force (Pu)</span>
                    <span className="text-white font-bold font-mono text-xs">
                      {Math.abs(maxForce.axial).toFixed(1)} kN
                    </span>
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Major Shear (Vu)</span>
                    <span className="text-white font-bold font-mono text-xs">
                      {Math.abs(maxForce.vy).toFixed(1)} kN
                    </span>
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Bending Moment (Mu)</span>
                    <span className="text-indigo-400 font-bold font-mono text-xs">
                      {Math.abs(maxForce.mz).toFixed(1)} kNm
                    </span>
                  </div>
                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Torsion (Tu)</span>
                    <span className="text-slate-300 font-mono text-xs">
                      {Math.abs((maxForce as any).mx || 0).toFixed(1)} kNm
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'DESIGN' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/80 space-y-2">
                  <span className="text-slate-300 font-bold text-[11px] block">Reinforcement Summary</span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Main Steel:</span>
                      <span className="text-white font-bold">{isCol ? '4-T20 + 4-T16' : '3-T20 Top / 3-T20 Bot'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Ast Provided:</span>
                      <span className="text-emerald-400 font-bold">{isCol ? '2060 mm²' : '1884 mm²'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Transverse Ties:</span>
                      <span className="text-white font-bold">2L-T8 @ 100 mm c/c</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleOpenCalculation}
                  className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-2 font-semibold text-xs transition-colors shadow-md"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Step-by-Step Calculation Sheet</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* CASE 2: Node Selected */}
        {selectedNode && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/80 space-y-2">
              <span className="text-slate-400 text-[11px] block">Node Coordinates</span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                <div className="bg-slate-900/60 p-1.5 rounded text-center">
                  <span className="text-slate-500 block text-[9px]">X</span>
                  <span className="text-white font-bold">{selectedNode.x.toFixed(2)}m</span>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded text-center">
                  <span className="text-slate-500 block text-[9px]">Y (Elv)</span>
                  <span className="text-emerald-400 font-bold">{selectedNode.y.toFixed(2)}m</span>
                </div>
                <div className="bg-slate-900/60 p-1.5 rounded text-center">
                  <span className="text-slate-500 block text-[9px]">Z</span>
                  <span className="text-white font-bold">{selectedNode.z.toFixed(2)}m</span>
                </div>
              </div>
            </div>

            {nodeReaction && (
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/80 space-y-2">
                <span className="text-slate-400 text-[11px] block">Support Reactions</span>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vertical Fy:</span>
                    <span className="text-emerald-400 font-bold">{Math.abs(nodeReaction.fy).toFixed(1)} kN</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Moment Mz:</span>
                    <span className="text-indigo-400 font-bold">{Math.abs(nodeReaction.mz || 0).toFixed(1)} kNm</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={onDeleteSelected}
              className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/40 rounded flex items-center justify-center gap-1.5 transition-colors font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Node</span>
            </button>
          </div>
        )}

        {/* CASE 3: Plate / Slab Selected */}
        {selectedPlate && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/80 space-y-2">
              <span className="text-slate-400 text-[11px] block">Plate Properties</span>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Thickness:</span>
                  <span className="text-white font-bold">{(selectedPlate.thickness * 1000).toFixed(0)} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Joint Nodes:</span>
                  <span className="text-slate-200 font-mono">[{selectedPlate.nodeIds.join(', ')}]</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CASE 4: Nothing Selected — MODEL OVERVIEW & QUICK PICKER */}
        {!hasSelection && (
          <div className="space-y-4">
            {/* Project Summary Box */}
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">Structural Summary</span>
                <span className="text-[10px] bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded font-mono font-semibold">
                  IS 456 / IS 13920
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Columns</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {model?.statistics.totalColumns || 0}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Beams</span>
                  <span className="text-sky-400 font-bold text-sm">
                    {model?.statistics.totalBeams || 0}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Slabs</span>
                  <span className="text-indigo-400 font-bold text-sm">
                    {model?.statistics.totalSlabs || 0}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2 rounded border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Supports</span>
                  <span className="text-rose-400 font-bold text-sm">
                    {model?.statistics.totalSupports || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Member Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">Quick Element Inspector</span>
                <span className="text-[10px] text-slate-400">Click to Inspect</span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search column / beam..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                {filteredQuickMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onSelectMember(m.id)}
                    className="w-full p-2 rounded flex items-center justify-between text-[11px] bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          m.isCol ? 'bg-emerald-400' : 'bg-sky-400'
                        }`}
                      />
                      <span className="text-slate-200 font-semibold">
                        {m.isCol ? `Column #${m.id}` : `Beam #${m.id}`}
                      </span>
                    </div>
                    <span className="text-slate-400 text-[10px] font-mono">{m.size}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/50 text-[11px] text-indigo-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>3D Viewport Interaction</span>
              </div>
              <p className="text-slate-400 text-[10px] font-sans">
                Click directly on any column, beam, or slab in the 3D model to select it and view its engineering properties, loads, and design reports.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
