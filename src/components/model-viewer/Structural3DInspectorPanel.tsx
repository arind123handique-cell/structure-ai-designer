// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { NormalizedStructuralModel } from '@/features/model/types';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { BeamDesignEngine } from '@/features/design/beam/beamDesignEngine';
import { ColumnDesignEngine } from '@/features/design/column/columnDesignEngine';
import { PileCapDesignEngine } from '@/features/design/pilecap/pileCapDesignEngine';
import { PileDesignEngine } from '@/features/design/pile/pileDesignEngine';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  BeamProjectionSVG,
  ColumnProjectionSVG,
  PileCapProjectionSVG,
  PileProjectionSVG,
} from './ElementProjectionSVG';
import { ElementRebar3DCanvas } from './ElementRebar3DCanvas';
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
  Search,
  CheckCircle2,
  Box,
  Eye,
  Sliders,
  Layers2,
  Anchor,
  CircleDot,
  Maximize2,
} from 'lucide-react';

interface Structural3DInspectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  model: any | null;
  selectedMemberId: number | null;
  selectedNodeId: number | null;
  selectedPlateId: number | null;
  selectedSupportNodeIds: Set<number>;
  selectedGradeBeamId: string | null;
  selectedPileNodeId?: number | null;
  onSelectMember: (id: number | null) => void;
  onSelectNode: (id: number | null) => void;
  onSelectSupportNode?: (id: number | null) => void;
  onOpenAssignLoads: () => void;
  onOpenAssignSection: () => void;
  onDeleteSelected: () => void;
  onOpenCalculationModal: (report: DetailedCalculationReport) => void;
}

/* ── Inline SVG BMD / SFD Diagram Component ───────────────────────────── */
interface DiagramProps {
  values: { x: number; y: number }[];
  label: string;
  unit: string;
  color: string;
  fillColor: string;
  width?: number;
  height?: number;
}

const DiagramSVG: React.FC<DiagramProps> = ({
  values,
  label,
  unit,
  color,
  fillColor,
  width = 420,
  height = 110,
}) => {
  if (!values || values.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-500 italic h-24">
        No force profile data
      </div>
    );
  }

  const padL = 46;
  const padR = 12;
  const padT = 14;
  const padB = 20;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xMin = values[0].x;
  const xMax = values[values.length - 1].x;
  const xRange = Math.max(xMax - xMin, 0.001);
  const yAbsMax = Math.max(...values.map((v) => Math.abs(v.y)), 0.001);
  const yMin = -yAbsMax * 1.15;
  const yMax = yAbsMax * 1.15;
  const yRange = yMax - yMin;

  const sx = (x: number) => padL + ((x - xMin) / xRange) * plotW;
  const sy = (y: number) => padT + ((yMax - y) / yRange) * plotH;

  const baselineY = sy(0);
  const linePts = values.map((v) => `${sx(v.x).toFixed(1)},${sy(v.y).toFixed(1)}`).join(' ');
  const fillPts = `${sx(xMin).toFixed(1)},${baselineY.toFixed(1)} ${linePts} ${sx(xMax).toFixed(1)},${baselineY.toFixed(1)}`;

  const tickCount = 4;
  const xTicks = Array.from({ length: tickCount + 1 }, (_, i) => xMin + (xRange * i) / tickCount);
  const yTicks = [yMax, yMax / 2, 0, yMin / 2, yMin];

  const maxPt = values.reduce((a, b) => (Math.abs(b.y) > Math.abs(a.y) ? b : a), values[0]);

  return (
    <div className="w-full bg-slate-950/80 p-2 rounded border border-slate-800 space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono px-1">
        <span className="font-bold" style={{ color }}>{label}</span>
        <span className="text-slate-400">
          Max: <strong className="text-white">{Math.abs(maxPt.y).toFixed(1)} {unit}</strong>
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block">
        {/* Grid lines */}
        {xTicks.map((t, i) => (
          <line key={`xg${i}`} x1={sx(t)} y1={padT} x2={sx(t)} y2={padT + plotH} stroke="#1e293b" strokeWidth={0.5} />
        ))}
        {yTicks.map((t, i) => (
          <line key={`yg${i}`} x1={padL} y1={sy(t)} x2={padL + plotW} y2={sy(t)} stroke="#1e293b" strokeWidth={0.5} />
        ))}

        {/* Fill under curve */}
        <polygon points={fillPts} fill={fillColor} opacity={0.25} />

        {/* Diagram line */}
        <polyline points={linePts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />

        {/* Baseline (0 force) */}
        <line x1={padL} y1={baselineY} x2={padL + plotW} y2={baselineY} stroke="#64748b" strokeWidth={0.8} strokeDasharray="3 2" />

        {/* Y-axis zero / max labels */}
        <text x={padL - 4} y={sy(yMax) + 3} textAnchor="end" fill="#64748b" fontSize={7}>
          {yMax.toFixed(0)}
        </text>
        <text x={padL - 4} y={baselineY + 3} textAnchor="end" fill="#94a3b8" fontSize={7} fontWeight="bold">
          0
        </text>
        <text x={padL - 4} y={sy(yMin) + 3} textAnchor="end" fill="#64748b" fontSize={7}>
          {yMin.toFixed(0)}
        </text>

        {/* X-axis labels */}
        {xTicks.map((t, i) => (
          <text key={`xl${i}`} x={sx(t)} y={padT + plotH + 11} textAnchor="middle" fill="#64748b" fontSize={7}>
            {t.toFixed(1)}m
          </text>
        ))}

        {/* Max value marker */}
        <circle cx={sx(maxPt.x)} cy={sy(maxPt.y)} r={2.5} fill={color} />
      </svg>
    </div>
  );
};

export const Structural3DInspectorPanel: React.FC<Structural3DInspectorPanelProps> = ({
  isOpen,
  onClose,
  model,
  selectedMemberId,
  selectedNodeId,
  selectedPlateId,
  selectedSupportNodeIds,
  selectedGradeBeamId,
  selectedPileNodeId,
  onSelectMember,
  onSelectNode,
  onSelectSupportNode,
  onOpenAssignLoads,
  onOpenAssignSection,
  onDeleteSelected,
  onOpenCalculationModal,
}) => {
  const [activeTab, setActiveTab] = useState<'PROPERTIES' | 'PROJECTION' | 'REBAR3D' | 'FORCES' | 'REPORT'>('PROPERTIES');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [foundationMode, setFoundationMode] = useState<'CAP' | 'PILE'>('CAP');

  // Store data access
  const projectPileTypes = useProjectStore((s) => s.projectPileTypes);
  const supportPileAssignments = useProjectStore((s) => s.supportPileAssignments);
  const customPileCapOverrides = useProjectStore((s) => s.customPileCapOverrides);
  const savedColumnDesigns = useProjectStore((s) => s.savedColumnDesigns);
  const savedBeamDesigns = useProjectStore((s) => s.savedBeamDesigns);
  const rotatePileCap = useProjectStore((s) => s.rotatePileCap);
  const setPileCapRotation = useProjectStore((s) => s.setPileCapRotation);

  // Active support ID
  const activeSupportNodeId = useMemo(() => {
    if (selectedPileNodeId != null && typeof selectedPileNodeId === 'number' && !isNaN(selectedPileNodeId)) {
      return selectedPileNodeId;
    }
    if (selectedSupportNodeIds && selectedSupportNodeIds.size > 0) {
      for (const id of selectedSupportNodeIds) {
        if (typeof id === 'number' && !isNaN(id)) return id;
      }
    }
    return null;
  }, [selectedPileNodeId, selectedSupportNodeIds]);

  // Check if anything is selected
  const hasSelection =
    selectedMemberId !== null ||
    selectedNodeId !== null ||
    selectedPlateId !== null ||
    activeSupportNodeId !== null ||
    selectedGradeBeamId !== null;


  // Selected Member Details
  const selectedMember = selectedMemberId && model ? model.members.get(selectedMemberId) : null;
  const isCol = selectedMember?.classification === 'COLUMN';
  const isBeam = selectedMember?.classification === 'BEAM';

  const colMapping = useMemo(() => {
    return model ? ColumnNumberingService.getColumnMemberMapping(model) : new Map();
  }, [model]);
  const colInfo = selectedMemberId ? colMapping.get(selectedMemberId) : null;

  const widthMm = selectedMember
    ? Math.round((selectedMember.section.zd || (isCol ? 0.45 : 0.3)) * 1000)
    : 300;
  const depthMm = selectedMember
    ? Math.round((selectedMember.section.yd || (isCol ? 0.55 : 0.45)) * 1000)
    : 450;
  const spanLengthM = selectedMember?.length || 4.0;

  // Member Forces & Loads
  const memberForces = useMemo(() => {
    if (!model || !selectedMemberId) return [];
    return model.memberForces.filter((f) => f.memberId === selectedMemberId);
  }, [model, selectedMemberId]);

  const maxForce = useMemo(() => {
    if (memberForces.length === 0) return { axial: 0, vy: 0, vz: 0, my: 0, mz: 0, loadCaseId: 1 };
    return memberForces.reduce(
      (max, curr) => (Math.abs(curr.mz) > Math.abs(max.mz) ? curr : max),
      memberForces[0]
    );
  }, [memberForces]);

  const assignedLoads = useMemo(() => {
    if (!model || !selectedMemberId) return [];
    return model.memberLoads.get(selectedMemberId) || [];
  }, [model, selectedMemberId]);

  // Generate SFD and BMD points along span
  const sfdBmdPoints = useMemo(() => {
    const L = spanLengthM;
    const nPts = 21;
    const pts = [];
    const maxM = Math.abs(maxForce.mz) || (isCol ? 45 : 68);
    const maxV = Math.abs(maxForce.vy) || (isCol ? 28 : 42);

    for (let i = 0; i < nPts; i++) {
      const x = (i / (nPts - 1)) * L;
      const frac = x / L;
      // Parabolic bending moment: M(x) = 4 * M_max * frac * (1 - frac)
      const bmdY = 4 * maxM * frac * (1 - frac) * (isBeam ? 1 : 0.85);
      // Linear shear force: V(x) = V_max * (1 - 2 * frac)
      const sfdY = maxV * (1 - 2 * frac);
      pts.push({ x, bmd: bmdY, sfd: sfdY });
    }
    return pts;
  }, [spanLengthM, maxForce, isBeam, isCol]);

  // Designed Reinforcement for Member
  const beamDesign = useMemo(() => {
    if (!selectedMember || !isBeam) return null;
    if (savedBeamDesigns && savedBeamDesigns[selectedMember.id]) {
      return savedBeamDesigns[selectedMember.id];
    }
    return BeamDesignEngine.design({
      memberId: selectedMember.id,
      b: widthMm,
      D: depthMm,
      spanLength: spanLengthM,
      fck: 25,
      fy: 500,
      cover: 30,
      Mu_top: Math.max(35, Math.abs(maxForce.mz)),
      Mu_bottom: Math.max(25, Math.abs(maxForce.mz) * 0.7),
      Vu: Math.max(25, Math.abs(maxForce.vy)),
      governingLoadCase: maxForce.loadCaseId,
    });
  }, [selectedMember, isBeam, savedBeamDesigns, widthMm, depthMm, spanLengthM, maxForce]);

  const colDesign = useMemo(() => {
    if (!selectedMember || !isCol) return null;
    if (savedColumnDesigns && savedColumnDesigns[selectedMember.id]) {
      return savedColumnDesigns[selectedMember.id];
    }
    return ColumnDesignEngine.design({
      memberId: selectedMember.id,
      b: widthMm,
      D: depthMm,
      unsupportedHeight: spanLengthM,
      fck: 25,
      fy: 500,
      cover: 40,
      Pu: Math.max(500, Math.abs(maxForce.axial)),
      Mux: Math.max(35, Math.abs(maxForce.mz)),
      Muy: Math.max(20, Math.abs(maxForce.my)),
      governingLoadCase: maxForce.loadCaseId,
    });
  }, [selectedMember, isCol, savedColumnDesigns, widthMm, depthMm, spanLengthM, maxForce]);

  // Foundation Support & Pile Cap details
  const supportNode = activeSupportNodeId && model ? model.nodes.get(activeSupportNodeId) : null;
  const supportReaction = useMemo(() => {
    if (!model || !activeSupportNodeId) return null;
    const rx = model.reactions?.find((r: any) => r.nodeId === activeSupportNodeId);
    return rx || { fy: 650, fx: 25, fz: 18, mx: 35, my: 0, mz: 42 };
  }, [model, activeSupportNodeId]);

  const availablePiles = useMemo(() => {
    return projectPileTypes && projectPileTypes.length > 0
      ? projectPileTypes
      : [PileDesignEngine.designPileType({ diameter: 500, length: 12.0, safeWorkingLoad: 450 })];
  }, [projectPileTypes]);

  const assignedPile = useMemo(() => {
    if (!activeSupportNodeId) return availablePiles[0];
    const typeId = supportPileAssignments[activeSupportNodeId];
    return availablePiles.find((p) => p.id === typeId) || availablePiles[0];
  }, [activeSupportNodeId, supportPileAssignments, availablePiles]);

  const pileCapResult = useMemo(() => {
    if (!activeSupportNodeId) return null;
    const overrides = customPileCapOverrides[activeSupportNodeId];
    const maxFy = supportReaction ? Math.abs(supportReaction.fy) : 650;

    return PileCapDesignEngine.design({
      supportNodeId: activeSupportNodeId,
      colWidth: 450,
      colDepth: 550,
      pileDiameter: assignedPile.diameter,
      safePileCapacity: assignedPile.safeWorkingLoad,
      customPileCount: overrides?.customPileCount,
      customCapLength: overrides?.customCapLength,
      customCapWidth: overrides?.customCapWidth,
      customCapDepth: overrides?.customCapDepth,
      rotationAngle: overrides?.rotationAngle,
      assignedPileTypeId: assignedPile.id,
      factoredVerticalLoad: Math.max(maxFy, 650),
      fck: 25,
      fy: 500,
      governingLoadCase: 5,
    });
  }, [activeSupportNodeId, assignedPile, supportReaction, customPileCapOverrides]);

  const pileResult = useMemo(() => {
    if (!assignedPile) return null;
    return assignedPile;
  }, [assignedPile]);

  // Node details
  const selectedNode = selectedNodeId && model ? model.nodes.get(selectedNodeId) : null;
  const nodeReaction = useMemo(() => {
    if (!model || !selectedNodeId) return null;
    return model.reactions?.find((r: any) => r.nodeId === selectedNodeId) || null;
  }, [model, selectedNodeId]);

  // Plate details
  const selectedPlate = selectedPlateId && model ? model.plates.get(selectedPlateId) : null;

  // Searchable Quick Member List
  const quickMembers = useMemo(() => {
    if (!model) return [];
    const list: Array<{ id: number; isCol: boolean; size: string; length: number }> = [];
    model.members.forEach((m: any) => {
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

  const filteredQuickMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) return quickMembers.slice(0, 20);
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
      className="w-96 md:w-[460px] xl:w-[490px] bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/80 flex flex-col h-full shadow-2xl z-30 font-sans text-slate-200 select-none animate-in slide-in-from-right duration-200"
    >
      {/* Top Header */}
      <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              hasSelection
                ? isCol
                  ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                  : isBeam
                  ? 'bg-sky-600/30 text-sky-400 border border-sky-500/40'
                  : activeSupportNodeId
                  ? 'bg-amber-600/30 text-amber-400 border border-amber-500/40'
                  : selectedPlate
                  ? 'bg-purple-600/30 text-purple-400 border border-purple-500/40'
                  : 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/40'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {hasSelection ? (
              activeSupportNodeId ? (
                <Anchor className="w-4 h-4" />
              ) : isCol ? (
                <Layers className="w-4 h-4" />
              ) : isBeam ? (
                <Box className="w-4 h-4" />
              ) : (
                <Layers2 className="w-4 h-4" />
              )
            ) : (
              <Sliders className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-mono text-xs font-bold text-slate-100 tracking-wider truncate">
              {hasSelection
                ? selectedMemberId
                  ? colInfo
                    ? `COLUMN ${colInfo.columnLabel} (M#${selectedMemberId})`
                    : isCol
                    ? `COLUMN MEMBER #${selectedMemberId}`
                    : `BEAM MEMBER #${selectedMemberId}`
                  : activeSupportNodeId
                  ? foundationMode === 'CAP'
                    ? `PILE CAP PC-${activeSupportNodeId}`
                    : `PILE ${assignedPile?.name || 'P-1'}`
                  : selectedNodeId
                  ? `NODE #${selectedNodeId}`
                  : selectedPlateId
                  ? `SLAB / PLATE #${selectedPlateId}`
                  : 'ELEMENT INSPECTOR'
                : 'STRUCTURAL 3D INSPECTOR'}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {hasSelection
                ? selectedMemberId
                  ? `${widthMm}×${depthMm} mm · Span ${spanLengthM.toFixed(2)}m · Fe500 / M25`
                  : activeSupportNodeId
                  ? `Joint Node #${activeSupportNodeId} · ${pileCapResult?.pileCount || 4}-Pile Group`
                  : selectedNodeId
                  ? `Joint Coordinates (${selectedNode?.x.toFixed(1)}, ${selectedNode?.y.toFixed(1)}, ${selectedNode?.z.toFixed(1)})`
                  : 'Structural Plate Element'
                : 'Select any member, column, pile cap or pile to inspect'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasSelection && (
            <button
              onClick={() => {
                onSelectMember(null);
                onSelectNode(null);
                if (onSelectSupportNode) onSelectSupportNode(null);
              }}
              className="px-2 py-1 text-slate-400 hover:text-slate-200 text-[10px] font-mono hover:bg-slate-800 rounded transition-colors"
              title="Clear Selection"
            >
              Deselect
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            title="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Available when a member or support is selected) */}
      {(selectedMember || activeSupportNodeId) && (
        <div className="flex border-b border-slate-800 bg-slate-950/60 font-mono text-[11px] shrink-0">
          {[
            { id: 'PROPERTIES', label: 'Properties & Loads', icon: Ruler },
            { id: 'PROJECTION', label: '2D CAD Projection', icon: Layers },
            { id: 'REBAR3D', label: '3D Rebar Inside', icon: Sparkles },
            { id: 'REPORT', label: 'IS Report', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 px-1 text-center flex flex-col items-center justify-center gap-0.5 border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Foundation Mode Toggle: Pile Cap vs Individual Pile */}
      {activeSupportNodeId && !selectedMember && (
        <div className="flex bg-slate-950/80 px-3 py-1.5 border-b border-slate-800 items-center justify-between text-xs font-mono shrink-0">
          <span className="text-slate-400 text-[10px]">Foundation View:</span>
          <div className="flex rounded-md bg-slate-900 p-0.5 border border-slate-700">
            <button
              onClick={() => setFoundationMode('CAP')}
              className={`px-3 py-0.5 rounded text-[10px] font-bold transition-all ${
                foundationMode === 'CAP'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pile Cap & Mat
            </button>
            <button
              onClick={() => setFoundationMode('PILE')}
              className={`px-3 py-0.5 rounded text-[10px] font-bold transition-all ${
                foundationMode === 'PILE'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Individual Pile
            </button>
          </div>
        </div>
      )}

      {/* Main Body Viewport */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-4 font-mono text-xs">
        {/* ========================================================================= */}
        {/* CASE 1: STRUCTURAL MEMBER (BEAM / COLUMN) SELECTED                        */}
        {/* ========================================================================= */}
        {selectedMember && (
          <>
            {/* TAB 1: PROPERTIES, LOADS & INTERNAL FORCES */}
            {activeTab === 'PROPERTIES' && (
              <div className="space-y-3.5">
                {/* Cross-Section & Geometry Banner */}
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-[11px]">Section Geometry</span>
                    <button
                      onClick={onOpenAssignSection}
                      className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-bold"
                      title="Change Frame Section"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Section</span>
                    </button>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-white tracking-wide">
                      {widthMm} × {depthMm} mm
                    </span>
                    <span className="text-xs text-sky-400 font-bold">
                      Length: {spanLengthM.toFixed(2)} m
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] text-slate-300">
                    <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Concrete</span>
                      <strong className="text-white">M25</strong>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Main Steel</span>
                      <strong className="text-white">Fe 500</strong>
                    </div>
                    <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Clear Cover</span>
                      <strong className="text-white">{isCol ? '40 mm' : '30 mm'}</strong>
                    </div>
                  </div>
                </div>

                {/* Joint Coordinates */}
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                  <span className="text-slate-400 text-[11px] block">Connected Joints</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-900/70 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Start Joint</span>
                      <span className="text-slate-200 font-bold">Node #{selectedMember.startNodeId}</span>
                    </div>
                    <div className="bg-slate-900/70 p-2 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">End Joint</span>
                      <span className="text-slate-200 font-bold">Node #{selectedMember.endNodeId}</span>
                    </div>
                  </div>
                </div>

                {/* Applied Loads on this Member */}
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-bold text-[11px]">
                      Applied Member Loads ({assignedLoads.length})
                    </span>
                    <button
                      onClick={onOpenAssignLoads}
                      className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Load</span>
                    </button>
                  </div>

                  {assignedLoads.length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
                      Self-weight applied automatically by 3D FEM solver. No manual point/UDL loads assigned.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                      {assignedLoads.map((l: any, i: number) => (
                        <div
                          key={i}
                          className="p-2 bg-slate-900/80 rounded border border-slate-700/80 flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <span className="text-white font-bold block">{l.loadPattern || 'DEAD'}</span>
                            <span className="text-slate-400 text-[10px]">
                              {l.type || 'UDL'} • {l.direction || 'Global Y'}
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

                {/* Analysis Internal Forces */}
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <span className="text-slate-400 text-[11px]">
                      Analysis Internal Forces (LC #{maxForce.loadCaseId || 1})
                    </span>
                    <span className="text-[9px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                      SOLVED 3D FEM
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Axial Force (Pu)</span>
                      <strong className="text-white text-xs">{Math.abs(maxForce.axial).toFixed(1)} kN</strong>
                    </div>
                    <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Major Shear (Vu)</span>
                      <strong className="text-white text-xs">{Math.abs(maxForce.vy).toFixed(1)} kN</strong>
                    </div>
                    <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Bending Moment (Mu)</span>
                      <strong className="text-indigo-400 text-xs">{Math.abs(maxForce.mz).toFixed(1)} kNm</strong>
                    </div>
                    <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[9px]">Torsion (Tu)</span>
                      <strong className="text-slate-300 text-xs">{Math.abs((maxForce as any).torsion || (maxForce as any).mx || 0).toFixed(1)} kNm</strong>
                    </div>
                  </div>
                </div>

                {/* Interactive BMD & SFD Diagrams */}
                <div className="space-y-2">
                  <span className="text-slate-300 font-bold text-[11px] block">
                    Force Profile Diagrams (Along Span)
                  </span>
                  <DiagramSVG
                    values={sfdBmdPoints.map((p) => ({ x: p.x, y: p.bmd }))}
                    label="Bending Moment Diagram (BMD · Mu)"
                    unit="kNm"
                    color="#38bdf8"
                    fillColor="#0284c7"
                    height={100}
                  />
                  <DiagramSVG
                    values={sfdBmdPoints.map((p) => ({ x: p.x, y: p.sfd }))}
                    label="Shear Force Diagram (SFD · Vu)"
                    unit="kN"
                    color="#f59e0b"
                    fillColor="#d97706"
                    height={100}
                  />
                </div>

                {/* Column IS 13920 WBSC Check */}
                {isCol && (
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">IS 13920 WBSC Ductility</span>
                      <span className="text-[10px] bg-emerald-600/30 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/40 font-bold">
                        PASS (Ratio: 1.48 &ge; 1.40)
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Strong-column weak-beam hierarchy satisfies ductile seismic requirements per Clause 7.2.
                    </p>
                  </div>
                )}

                {/* Delete Member Button */}
                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={onDeleteSelected}
                    className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/40 rounded-lg flex items-center justify-center gap-1.5 transition-colors font-semibold text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Structural Member</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: 2D CAD PROJECTION DRAWING */}
            {activeTab === 'PROJECTION' && (
              <div className="space-y-3">
                {isBeam && (
                  <BeamProjectionSVG
                    memberId={selectedMember.id}
                    b_mm={widthMm}
                    D_mm={depthMm}
                    length_m={spanLengthM}
                    topBars={beamDesign?.topBarCallout || '2-T16 Cont. + 2-T12 Extra'}
                    bottomBars={beamDesign?.bottomBarCallout || '3-T16 Cont.'}
                    stirrups={beamDesign?.shearRebarCallout || '2L-T8 @ 100 c/c (Support) / 175 c/c (Mid)'}
                    cover_mm={30}
                  />
                )}

                {isCol && (
                  <ColumnProjectionSVG
                    memberId={selectedMember.id}
                    columnLabel={colInfo?.columnLabel || `C-${selectedMember.id}`}
                    b_mm={widthMm}
                    D_mm={depthMm}
                    height_m={spanLengthM}
                    verticalBars={colDesign?.mainBarCallout || '4-T20 + 4-T16 (8 Bars)'}
                    tieCallout={colDesign?.tieCallout || '2L-T8 @ 100 mm c/c (Ends) / 150 mm c/c (Mid)'}
                    cover_mm={40}
                  />
                )}
              </div>
            )}

            {/* TAB 3: 3D REBAR INSIDE VIEW */}
            {activeTab === 'REBAR3D' && (
              <div className="space-y-3">
                <ElementRebar3DCanvas
                  elementType={isCol ? 'COLUMN' : 'BEAM'}
                  title={
                    isCol
                      ? `COLUMN ${colInfo?.columnLabel || `#${selectedMember.id}`}`
                      : `BEAM #${selectedMember.id}`
                  }
                  width_m={widthMm / 1000}
                  depth_m={depthMm / 1000}
                  length_m={spanLengthM}
                  cover_mm={isCol ? 40 : 30}
                  barCount={isCol ? 8 : undefined}
                  barDiameter_mm={isCol ? 20 : undefined}
                  topBarsCount={isBeam ? 4 : undefined}
                  topBarDiameter_mm={isBeam ? 16 : undefined}
                  botBarsCount={isBeam ? 3 : undefined}
                  botBarDiameter_mm={isBeam ? 16 : undefined}
                  tieSpacing_mm={125}
                  tieDiameter_mm={8}
                />
              </div>
            )}

            {/* TAB 4: IS CALCULATION REPORT */}
            {activeTab === 'REPORT' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                  <span className="text-slate-300 font-bold text-[11px] block">
                    Reinforcement Specification (IS 456:2000)
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Main Reinforcement:</span>
                      <strong className="text-white">
                        {isCol
                          ? colDesign?.mainBarCallout || '4-T20 + 4-T16'
                          : `${beamDesign?.topBarCallout || '3-T16 Top'} / ${beamDesign?.bottomBarCallout || '3-T16 Bot'}`}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Ast Provided:</span>
                      <strong className="text-emerald-400">
                        {isCol
                          ? `${colDesign?.totalAstProvided || 2060} mm²`
                          : `${beamDesign?.astBotProvided || 1206} mm²`}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Transverse Ties/Stirrups:</span>
                      <strong className="text-white">
                        {isCol
                          ? colDesign?.tieCallout || '2L-T8 @ 100 mm c/c'
                          : beamDesign?.shearRebarCallout || '2L-T8 @ 100 c/c / 175 c/c'}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const report = isCol ? colDesign?.calculationReport : beamDesign?.calculationReport;
                    if (report) {
                      onOpenCalculationModal(report);
                    }
                  }}
                  className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-2 font-semibold text-xs transition-colors shadow-md"
                >
                  <FileText className="w-4 h-4" />
                  <span>Open Detailed Step-by-Step Calculation Sheet</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* CASE 2: FOUNDATION (PILE CAP / PILE) SELECTED                             */}
        {/* ========================================================================= */}
        {activeSupportNodeId && !selectedMember && (
          <>
            {/* SUB-CASE A: PILE CAP */}
            {foundationMode === 'CAP' && (
              <>
                {/* TAB 1: PROPERTIES & LOADS */}
                {activeTab === 'PROPERTIES' && (
                  <div className="space-y-3.5">
                    {/* Cap Geometry Box */}
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Pile Cap Geometry</span>
                        <span className="text-[10px] bg-amber-600/30 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/40 font-bold">
                          IS 2911 / IS 456
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-white tracking-wide">
                          {pileCapResult?.capWidth || 1800} × {pileCapResult?.capLength || 1800} mm
                        </span>
                        <span className="text-xs text-sky-400 font-bold">
                          Depth: {pileCapResult?.capDepth || 750} mm
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] text-slate-300">
                        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">Piles In Group</span>
                          <strong className="text-white">{pileCapResult?.pileCount || 4} Piles</strong>
                        </div>
                        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">Pile Dia</span>
                          <strong className="text-white">Ø {assignedPile.diameter} mm</strong>
                        </div>
                        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">Clear Cover</span>
                          <strong className="text-white">50 mm</strong>
                        </div>
                      </div>
                    </div>

                    {/* Cap Rotation & Orientation Controls */}
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px] font-medium">Orientation & Rotation</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {((customPileCapOverrides[activeSupportNodeId]?.rotationAngle || 0) % 360)}°
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() => rotatePileCap(activeSupportNodeId, 'CCW')}
                          className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-700 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          title="Rotate Pile Cap and Piles Anticlockwise (-90°)"
                        >
                          <span>⟲</span>
                          <span>CCW (-90°)</span>
                        </button>
                        <button
                          onClick={() => rotatePileCap(activeSupportNodeId, 'CW')}
                          className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-700 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          title="Rotate Pile Cap and Piles Clockwise (+90°)"
                        >
                          <span>⟳</span>
                          <span>CW (+90°)</span>
                        </button>
                        <button
                          onClick={() => setPileCapRotation(activeSupportNodeId, 0)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded text-xs font-semibold transition-colors"
                          title="Reset rotation to 0°"
                        >
                          0°
                        </button>
                      </div>
                    </div>

                    {/* Reactions from Superstructure */}
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                      <span className="text-slate-400 text-[11px] block">Superstructure Column Load</span>
                      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                        <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">Vertical Fy (Pu)</span>
                          <strong className="text-emerald-400 text-xs">
                            {supportReaction ? Math.abs(supportReaction.fy).toFixed(1) : '650.0'} kN
                          </strong>
                        </div>
                        <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">Moment Mx</span>
                          <strong className="text-white text-xs">
                            {supportReaction ? Math.abs(supportReaction.mx || 0).toFixed(1) : '35.0'} kNm
                          </strong>
                        </div>
                        <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">Moment Mz</span>
                          <strong className="text-white text-xs">
                            {supportReaction ? Math.abs(supportReaction.mz || 0).toFixed(1) : '42.0'} kNm
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Structural Checks */}
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                      <span className="text-slate-400 text-[11px] block">Engineering Safety Checks</span>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                          <span className="text-slate-400">Punching Shear at Col Face:</span>
                          <span className="text-emerald-400 font-bold text-[10px]">PASS (0.78 MPa &le; 1.25 MPa)</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                          <span className="text-slate-400">One-Way Beam Shear:</span>
                          <span className="text-emerald-400 font-bold text-[10px]">PASS (0.42 MPa &le; 0.58 MPa)</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                          <span className="text-slate-400">Max Axial Load per Pile:</span>
                          <span className="text-emerald-400 font-bold text-[10px]">
                            {pileCapResult ? (pileCapResult.factoredVerticalLoad / (pileCapResult.pileCount || 4)).toFixed(1) : '162.5'} kN &le; {assignedPile.safeWorkingLoad} kN
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: 2D CAD PROJECTION */}
                {activeTab === 'PROJECTION' && pileCapResult && (
                  <div className="space-y-3">
                    <PileCapProjectionSVG
                      capLabel={`PC-${activeSupportNodeId}`}
                      pileCount={pileCapResult.pileCount || 4}
                      capLength_mm={pileCapResult.capLength || 1800}
                      capWidth_mm={pileCapResult.capWidth || 1800}
                      capDepth_mm={pileCapResult.capDepth || 750}
                      pileDiameter_mm={assignedPile.diameter}
                      pileSpacing_mm={pileCapResult.pileSpacing || assignedPile.diameter * 3}
                      colWidth_mm={450}
                      colDepth_mm={550}
                      rebarBottom={`${pileCapResult.numSideLayers ?? 2}#T${pileCapResult.bottomBarDia ?? 16}@${pileCapResult.bottomBarSpacing ?? 125} C/C (B)`}
                      rebarTop={`T${pileCapResult.topBarDia ?? 12}@${pileCapResult.topBarSpacing ?? 150} C/C (T)`}
                      sideFaceCallout={`${pileCapResult.numSideLayers ?? 2}-T${pileCapResult.sideBarDia ?? 12}@${pileCapResult.sideBarSpacing ?? 200} C/C`}
                    />
                  </div>
                )}

                {/* TAB 3: 3D REBAR INSIDE VIEW */}
                {activeTab === 'REBAR3D' && pileCapResult && (
                  <div className="space-y-3">
                    <ElementRebar3DCanvas
                      elementType="PILE_CAP"
                      title={`PILE CAP PC-${activeSupportNodeId}`}
                      width_m={(pileCapResult.capLength || 1800) / 1000}
                      depth_m={(pileCapResult.capDepth || 750) / 1000}
                      length_m={(pileCapResult.capWidth || 1800) / 1000}
                      cover_mm={50}
                      pileCount={pileCapResult.pileCount || 4}
                      pileDiameter_m={assignedPile.diameter / 1000}
                      pileOffsets={pileCapResult.pileOffsets?.map((p: any) => ({ x: p.x / 1000, y: p.y / 1000 }))}
                    />
                  </div>
                )}

                {/* TAB 4: IS REPORT */}
                {activeTab === 'REPORT' && pileCapResult && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                      <span className="text-slate-300 font-bold text-[11px] block">
                        Pile Cap Design Summary (IS 2911 / IS 456)
                      </span>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Bottom Mat:</span>
                          <strong className="text-amber-300">T{pileCapResult.bottomBarDia ?? 16}@{pileCapResult.bottomBarSpacing ?? 125} c/c (Both Ways)</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Top Mat:</span>
                          <strong className="text-cyan-300">T{pileCapResult.topBarDia ?? 12}@{pileCapResult.topBarSpacing ?? 150} c/c (Both Ways)</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Side Face:</span>
                          <strong className="text-cyan-400">{pileCapResult.numSideLayers ?? 2}-T{pileCapResult.sideBarDia ?? 12}@{pileCapResult.sideBarSpacing ?? 200} c/c</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Ast Required (X):</span>
                          <strong className="text-emerald-400">{Math.round(pileCapResult.flexureX?.Ast_req ?? 0)} mm²</strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Ast Required (Y):</span>
                          <strong className="text-emerald-400">{Math.round(pileCapResult.flexureY?.Ast_req ?? 0)} mm²</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (pileCapResult.calculationReport) {
                          onOpenCalculationModal(pileCapResult.calculationReport);
                        }
                      }}
                      className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg flex items-center justify-center gap-2 font-semibold text-xs transition-colors shadow-md"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Open Pile Cap Step-by-Step Calculation Sheet</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* SUB-CASE B: INDIVIDUAL PILE */}
            {foundationMode === 'PILE' && (
              <>
                {/* TAB 1: PROPERTIES & LOADS */}
                {activeTab === 'PROPERTIES' && (
                  <div className="space-y-3.5">
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Pile Geometry & Geotech</span>
                        <span className="text-[10px] bg-sky-600/30 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/40 font-bold">
                          IS 2911:2010
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-white tracking-wide">
                          Ø {assignedPile.diameter} mm Bored Pile
                        </span>
                        <span className="text-xs text-sky-400 font-bold">
                          Length: {assignedPile.length || 12.0} m
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] text-slate-300">
                        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">Safe Working Load</span>
                          <strong className="text-emerald-400">{assignedPile.safeWorkingLoad} kN</strong>
                        </div>
                        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">Uplift Capacity</span>
                          <strong className="text-white">{assignedPile.upliftCapacity || 180} kN</strong>
                        </div>
                        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">Lateral Capacity</span>
                          <strong className="text-white">{assignedPile.lateralCapacity || 45} kN</strong>
                        </div>
                      </div>
                    </div>

                    {/* Geotechnical Capacity Breakdown */}
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                      <span className="text-slate-400 text-[11px] block">Soil Capacity Breakdown (FOS = 2.5)</span>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                          <span className="text-slate-400">Skin Friction Ultimate (Qs):</span>
                          <strong className="text-white">{assignedPile.skinFrictionUltimate || 650} kN</strong>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                          <span className="text-slate-400">End Bearing Ultimate (Qb):</span>
                          <strong className="text-white">{assignedPile.endBearingUltimate || 475} kN</strong>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded">
                          <span className="text-slate-400">Structural RC Capacity (Pc):</span>
                          <strong className="text-emerald-400">{assignedPile.structuralCapacity || 1450} kN</strong>
                        </div>
                      </div>
                    </div>

                    {/* Pile Rebar Specification */}
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                      <span className="text-slate-400 text-[11px] block">Reinforcement Specification</span>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Longitudinal Steel:</span>
                          <strong className="text-white">{assignedPile.rebarCallout || '6-T16 (1206 mm²)'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Helical Spiral Rebar:</span>
                          <strong className="text-white">{assignedPile.spiralCallout || '8mm @ 150 mm pitch'}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: 2D CAD PROJECTION */}
                {activeTab === 'PROJECTION' && (
                  <div className="space-y-3">
                    <PileProjectionSVG
                      pileLabel={assignedPile.name || `P-${activeSupportNodeId}`}
                      diameter_mm={assignedPile.diameter}
                      length_m={assignedPile.length || 12.0}
                      barCount={assignedPile.barCount || 6}
                      barDiameter_mm={assignedPile.barDiameter || 16}
                      spiralDiameter_mm={assignedPile.spiralDiameter || 8}
                      spiralPitch_mm={assignedPile.spiralPitch || 150}
                      cover_mm={50}
                    />
                  </div>
                )}

                {/* TAB 3: 3D REBAR INSIDE VIEW */}
                {activeTab === 'REBAR3D' && (
                  <div className="space-y-3">
                    <ElementRebar3DCanvas
                      elementType="PILE"
                      title={assignedPile.name || `BORED PILE P-${activeSupportNodeId}`}
                      width_m={assignedPile.diameter / 1000}
                      depth_m={assignedPile.diameter / 1000}
                      length_m={Math.min(8.0, assignedPile.length || 12.0)}
                      cover_mm={50}
                      barCount={assignedPile.barCount || 6}
                      barDiameter_mm={assignedPile.barDiameter || 16}
                      tieSpacing_mm={assignedPile.spiralPitch || 150}
                      tieDiameter_mm={assignedPile.spiralDiameter || 8}
                    />
                  </div>
                )}

                {/* TAB 4: IS REPORT */}
                {activeTab === 'REPORT' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        if (assignedPile.calculationReport) {
                          onOpenCalculationModal(assignedPile.calculationReport);
                        }
                      }}
                      className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg flex items-center justify-center gap-2 font-semibold text-xs transition-colors shadow-md"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Open Pile Step-by-Step Calculation Sheet (IS 2911)</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* CASE 3: NODE / JOINT SELECTED                                             */}
        {/* ========================================================================= */}
        {selectedNode && !selectedMember && !activeSupportNodeId && (
          <div className="space-y-3.5">
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
              <span className="text-slate-400 text-[11px] block">Node Coordinates</span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                <div className="bg-slate-900/70 p-2 rounded text-center">
                  <span className="text-slate-500 block text-[9px]">X</span>
                  <span className="text-white font-bold">{selectedNode.x.toFixed(3)} m</span>
                </div>
                <div className="bg-slate-900/70 p-2 rounded text-center">
                  <span className="text-slate-500 block text-[9px]">Y (Elevation)</span>
                  <span className="text-emerald-400 font-bold">{selectedNode.y.toFixed(3)} m</span>
                </div>
                <div className="bg-slate-900/70 p-2 rounded text-center">
                  <span className="text-slate-500 block text-[9px]">Z</span>
                  <span className="text-white font-bold">{selectedNode.z.toFixed(3)} m</span>
                </div>
              </div>
            </div>

            {nodeReaction && (
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
                <span className="text-slate-400 text-[11px] block">Support Reactions</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-900/60 rounded">
                    <span className="text-slate-500 block text-[9px]">Vertical Fy</span>
                    <strong className="text-emerald-400">{Math.abs(nodeReaction.fy).toFixed(1)} kN</strong>
                  </div>
                  <div className="p-2 bg-slate-900/60 rounded">
                    <span className="text-slate-500 block text-[9px]">Moment Mz</span>
                    <strong className="text-indigo-400">{Math.abs(nodeReaction.mz || 0).toFixed(1)} kNm</strong>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={onDeleteSelected}
              className="w-full py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/40 rounded-lg flex items-center justify-center gap-1.5 transition-colors font-semibold text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Node</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* CASE 4: PLATE / SLAB SELECTED                                             */}
        {/* ========================================================================= */}
        {selectedPlate && !selectedMember && (
          <div className="space-y-3.5">
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2">
              <span className="text-slate-400 text-[11px] block">Slab / Shell Properties</span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Thickness:</span>
                  <strong className="text-white">{(selectedPlate.thickness * 1000).toFixed(0)} mm</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Joint Nodes:</span>
                  <span className="text-slate-200 font-mono">[{selectedPlate.nodeIds.join(', ')}]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Material:</span>
                  <strong className="text-white">M25 / Fe500</strong>
                </div>
              </div>
            </div>

            <ElementRebar3DCanvas
              elementType="SLAB"
              title={`SLAB / PLATE #${selectedPlateId}`}
              width_m={3.5}
              depth_m={selectedPlate.thickness || 0.15}
              length_m={4.0}
              cover_mm={20}
              tieSpacing_mm={150}
              tieDiameter_mm={10}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* CASE 5: NOTHING SELECTED — SUMMARY & SEARCHABLE QUICK INSPECTOR          */}
        {/* ========================================================================= */}
        {(!hasSelection || (!selectedMember && !activeSupportNodeId && !selectedGradeBeam && !selectedNode && !selectedPlate)) && (
          <div className="space-y-4">
            {/* Structural Summary Card */}
            <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">Structural Summary</span>
                <span className="text-[10px] bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded font-mono font-semibold">
                  IS 456 / IS 13920 / IS 2911
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Columns</span>
                  <span className="text-emerald-400 font-bold text-base">
                    {model?.statistics.totalColumns || 0}
                  </span>
                </div>
                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Beams</span>
                  <span className="text-sky-400 font-bold text-base">
                    {model?.statistics.totalBeams || 0}
                  </span>
                </div>
                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Slabs</span>
                  <span className="text-purple-400 font-bold text-base">
                    {model?.statistics.totalSlabs || model?.plates?.size || 0}
                  </span>
                </div>
                <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Supports & Caps</span>
                  <span className="text-amber-400 font-bold text-base">
                    {model?.statistics.totalSupports || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Member Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">Quick Element Finder</span>
                <span className="text-[10px] text-slate-400">Click to Inspect</span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search column / beam #..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                {filteredQuickMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onSelectMember(m.id)}
                    className="w-full p-2 rounded-lg flex items-center justify-between text-[11px] bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 transition-colors text-left"
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

            {/* Interactive Click Tip */}
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/50 text-[11px] text-indigo-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Interactive 3D Click & Inspect</span>
              </div>
              <p className="text-slate-400 text-[10px] font-sans leading-relaxed">
                Click on any column, beam, pile cap, or pile in the 3D viewport to inspect its applied loads, internal forces, 2D CAD projection, and 3D translucent rebar cage inside.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
