// @ts-nocheck
import React, { useState } from 'react';
import { RenderMode, ConceptColorMode } from './Structural3DTypes';
import { NormalizedStructuralModel } from '@/features/model/types';
import {
  Palette,
  Layers,
  Box,
  SlidersHorizontal,
  X,
  Eye,
  EyeOff,
  Camera,
  RotateCcw,
  Sparkles,
  Flame,
  Zap,
  Filter,
  CheckSquare,
  Square,
  Search,
  Activity,
  ChevronDown,
  ChevronRight,
  Maximize2,
} from 'lucide-react';

interface Structural3DStudioPanelProps {
  isOpen: boolean;
  onClose: () => void;
  renderMode: RenderMode;
  onSetRenderMode: (mode: RenderMode) => void;
  conceptColor: ConceptColorMode;
  onSetConceptColor: (mode: ConceptColorMode) => void;
  rebarEnabled: boolean;
  onToggleRebar: (enabled: boolean) => void;
  rebarShowColumnBars: boolean;
  onToggleColBars: (show: boolean) => void;
  rebarShowBeamBars: boolean;
  onToggleBeamBars: (show: boolean) => void;
  rebarShowColumnTies: boolean;
  onToggleColTies: (show: boolean) => void;
  rebarShowBeamStirrups: boolean;
  onToggleBeamStirrups: (show: boolean) => void;
  storyElevations: number[];
  selectedStoryElevation: 'ALL' | number;
  onSelectStoryElevation: (elevation: 'ALL' | number) => void;
  model: StructuralModel | null;
  filterLayers: {
    showColumns: boolean;
    showBeams: boolean;
    showSlabs: boolean;
    showShearWalls: boolean;
    showFootings: boolean;
  };
  onToggleFilterLayer: (layer: string) => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  onSelectAllColumns: () => void;
  onSelectAllBeams: () => void;
  onClearSelection: () => void;
  onFitView: () => void;
  onTakeSnapshot: () => void;
  onSelectMember: (id: number) => void;
  selectedMemberId: number | null;
}

export const Structural3DStudioPanel: React.FC<Structural3DStudioPanelProps> = ({
  isOpen,
  onClose,
  renderMode,
  onSetRenderMode,
  conceptColor,
  onSetConceptColor,
  rebarEnabled,
  onToggleRebar,
  rebarShowColumnBars,
  onToggleColBars,
  rebarShowBeamBars,
  onToggleBeamBars,
  rebarShowColumnTies,
  onToggleColTies,
  rebarShowBeamStirrups,
  onToggleBeamStirrups,
  storyElevations,
  selectedStoryElevation,
  onSelectStoryElevation,
  model,
  filterLayers,
  onToggleFilterLayer,
  showLabels,
  onToggleLabels,
  onSelectAllColumns,
  onSelectAllBeams,
  onClearSelection,
  onFitView,
  onTakeSnapshot,
  onSelectMember,
  selectedMemberId,
}) => {
  const [activeTab, setActiveTab] = useState<'DISPLAY' | 'EXPLORER' | 'TOOLS'>('DISPLAY');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStory, setExpandedStory] = useState<string | null>('ALL');

  if (!isOpen) return null;

  // Filtered members for explorer
  const memberList = React.useMemo(() => {
    if (!model) return [];
    const list: Array<{ id: number; isCol: boolean; length: number; sectionName: string }> = [];
    model.members.forEach((m) => {
      const isCol = m.classification === 'COLUMN';
      const b = Math.round((m.section.zd || (isCol ? 0.45 : 0.3)) * 1000);
      const D = Math.round((m.section.yd || (isCol ? 0.55 : 0.45)) * 1000);
      list.push({
        id: m.id,
        isCol,
        length: m.length,
        sectionName: `${b}×${D} mm`,
      });
    });
    return list;
  }, [model]);

  const filteredMembers = React.useMemo(() => {
    if (!searchQuery.trim()) return memberList.slice(0, 40);
    const q = searchQuery.toLowerCase();
    return memberList.filter(
      (m) =>
        m.id.toString().includes(q) ||
        (m.isCol ? 'column' : 'beam').includes(q) ||
        m.sectionName.toLowerCase().includes(q)
    );
  }, [memberList, searchQuery]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-80 md:w-88 bg-slate-900/95 backdrop-blur-md border-r border-slate-700/80 flex flex-col h-full shadow-2xl z-30 font-sans text-slate-200 select-none animate-in slide-in-from-left duration-200"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-indigo-600/30 text-indigo-400 border border-indigo-500/40">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-mono text-xs font-bold text-slate-100 tracking-wider">3D MODEL STUDIO</h3>
            <p className="text-[10px] text-slate-400 font-mono">Render & Display Controls</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
          title="Collapse Studio Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 font-mono text-xs">
        <button
          onClick={() => setActiveTab('DISPLAY')}
          className={`flex-1 py-2 px-2 text-center flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'DISPLAY'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Display</span>
        </button>
        <button
          onClick={() => setActiveTab('EXPLORER')}
          className={`flex-1 py-2 px-2 text-center flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'EXPLORER'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Explorer</span>
        </button>
        <button
          onClick={() => setActiveTab('TOOLS')}
          className={`flex-1 py-2 px-2 text-center flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'TOOLS'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Tools</span>
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 font-mono text-xs">
        {activeTab === 'DISPLAY' && (
          <>
            {/* 1. RENDER MODES */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5" />
                <span>3D Render Mode</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'SOLID', label: 'Solid Shaded', desc: 'Extruded 3D with edges' },
                  { id: 'WIREFRAME', label: 'Wireframe', desc: 'Stick frame + nodes' },
                  { id: 'ANALYTICAL', label: 'Analytical Stick', desc: 'Centerline FEM axis' },
                  { id: 'XRAY', label: 'X-Ray Ghost', desc: 'Glass concrete + Rebar' },
                  { id: 'CLAY', label: 'Clay Studio', desc: 'Architectural matte' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSetRenderMode(item.id as RenderMode)}
                    className={`p-2 text-left rounded border transition-all ${
                      renderMode === item.id
                        ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold shadow-xs'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div className="text-[9px] text-slate-400 font-sans">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. CONCEPT COLOUR OPTIONS */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <label className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>Concept Colouring</span>
              </label>
              <div className="space-y-1">
                {[
                  { id: 'TYPE', label: 'By Member Type', desc: 'Columns, Beams, Slabs, Walls' },
                  { id: 'SECTION', label: 'By Section Size', desc: 'Color-coded by b×D dimensions' },
                  { id: 'STORY', label: 'By Storey / Elevation', desc: 'Distinct colors per floor level' },
                  { id: 'MATERIAL', label: 'By Material Grade', desc: 'M25, M30, M35, Fe500' },
                  { id: 'UTILIZATION', label: 'IS 456 DCR Stress Heatmap', desc: 'Safe < 0.70 to Overstressed > 1.0' },
                  { id: 'CYBERPUNK', label: 'Cyberpunk Neon AI', desc: 'High-contrast glowing wireframes' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => onSetConceptColor(opt.id as ConceptColorMode)}
                    className={`w-full p-2 text-left rounded border flex items-center justify-between transition-all ${
                      conceptColor === opt.id
                        ? 'bg-sky-600/30 border-sky-500 text-white font-bold'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[9px] text-slate-400 font-sans">{opt.desc}</div>
                    </div>
                    {conceptColor === opt.id && (
                      <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. STOREY ISOLATION FILTER */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Storey Isolation</span>
                </span>
                {selectedStoryElevation !== 'ALL' && (
                  <button
                    onClick={() => onSelectStoryElevation('ALL')}
                    className="text-[10px] text-amber-300 underline font-normal"
                  >
                    Reset (Show All)
                  </button>
                )}
              </label>
              <select
                value={selectedStoryElevation}
                onChange={(e) => {
                  const val = e.target.value;
                  onSelectStoryElevation(val === 'ALL' ? 'ALL' : parseFloat(val));
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Show All Storeys</option>
                {storyElevations.map((elv, idx) => (
                  <option key={elv} value={elv}>
                    {elv === 0 ? 'Plinth / Base' : `Storey ${idx} (EL. +${elv.toFixed(1)}m)`}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. 3D REINFORCEMENT DETAILING */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>3D Rebar Detailing</span>
                </label>
                <button
                  onClick={() => onToggleRebar(!rebarEnabled)}
                  className={`px-2 py-0.5 text-[10px] rounded font-bold transition-colors ${
                    rebarEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {rebarEnabled ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              {rebarEnabled && (
                <div className="space-y-1.5 bg-slate-850 p-2 rounded border border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={rebarShowColumnBars}
                      onChange={(e) => onToggleColBars(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <span>Column Main Bars</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={rebarShowColumnTies}
                      onChange={(e) => onToggleColTies(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <span>Column Ties / Lateral Links</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={rebarShowBeamBars}
                      onChange={(e) => onToggleBeamBars(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <span>Beam Top / Bottom Rebar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={rebarShowBeamStirrups}
                      onChange={(e) => onToggleBeamStirrups(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <span>Beam Shear Stirrups</span>
                  </label>
                </div>
              )}
            </div>

            {/* 5. VISIBILITY & LABELS */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Annotation Labels
              </label>
              <button
                onClick={onToggleLabels}
                className={`w-full p-2 rounded border flex items-center justify-between text-xs transition-colors ${
                  showLabels
                    ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold'
                    : 'bg-slate-800/40 border-slate-700 text-slate-300'
                }`}
              >
                <span>Column ID & Dimensions</span>
                {showLabels ? <Eye className="w-3.5 h-3.5 text-indigo-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
              </button>
            </div>
          </>
        )}

        {activeTab === 'EXPLORER' && (
          <>
            {/* Category Toggles */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                Structural Layers
              </label>
              <div className="space-y-1">
                {[
                  { key: 'showColumns', label: 'Columns', count: model?.statistics.totalColumns || 0 },
                  { key: 'showBeams', label: 'Beams', count: model?.statistics.totalBeams || 0 },
                  { key: 'showSlabs', label: 'Slabs', count: model?.statistics.totalSlabs || 0 },
                  { key: 'showShearWalls', label: 'Shear Walls', count: model?.statistics.totalShearWalls || 0 },
                  { key: 'showFootings', label: 'Footings & Piles', count: model?.statistics.totalSupports || 0 },
                ].map((layer) => (
                  <div
                    key={layer.key}
                    className="flex items-center justify-between p-2 rounded bg-slate-800/50 border border-slate-700/60"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleFilterLayer(layer.key)}
                        className="text-slate-400 hover:text-white"
                      >
                        {(filterLayers as any)[layer.key] ? (
                          <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </button>
                      <span className="font-semibold text-xs">{layer.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded">
                      {layer.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Member Finder & Quick Selection */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                  Member Selector
                </label>
                <span className="text-[10px] text-slate-400 font-mono">{memberList.length} total</span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Member ID / size..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1 pt-1">
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onSelectMember(m.id)}
                    className={`w-full p-1.5 rounded flex items-center justify-between text-[11px] border transition-colors ${
                      selectedMemberId === m.id
                        ? 'bg-amber-600/30 border-amber-500 text-amber-200 font-bold'
                        : 'bg-slate-800/40 border-slate-700/40 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          m.isCol ? 'bg-emerald-400' : 'bg-sky-400'
                        }`}
                      />
                      <span>{m.isCol ? `COL #${m.id}` : `BEAM #${m.id}`}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{m.sectionName}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'TOOLS' && (
          <div className="space-y-3">
            {/* Quick Bulk Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                Quick Selection
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={onSelectAllColumns}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-semibold text-emerald-400 text-left transition-colors"
                >
                  Select All Columns
                </button>
                <button
                  onClick={onSelectAllBeams}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-semibold text-sky-400 text-left transition-colors"
                >
                  Select All Beams
                </button>
              </div>
              <button
                onClick={onClearSelection}
                className="w-full p-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Clear Selection
              </button>
            </div>

            {/* View Actions */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <label className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                Viewport Actions
              </label>
              <button
                onClick={onFitView}
                className="w-full p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded flex items-center justify-between text-xs text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Fit Model to Screen</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Center View</span>
              </button>

              <button
                onClick={onTakeSnapshot}
                className="w-full p-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/60 rounded flex items-center justify-between text-xs text-indigo-200 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Export HD Snapshot</span>
                </span>
                <span className="text-[10px] bg-indigo-500/40 px-1.5 py-0.5 rounded text-indigo-200">PNG</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
