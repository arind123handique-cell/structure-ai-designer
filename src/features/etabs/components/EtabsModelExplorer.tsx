import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Building,
  Layers,
  Box,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Sparkles,
} from 'lucide-react';
import { NormalizedStructuralModel } from '@/features/model/types';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';

interface EtabsModelExplorerProps {
  model: NormalizedStructuralModel | null;
  selectedStoreyElevation: number;
  onSelectStoreyElevation: (elev: number) => void;
  onOpenWizard: () => void;
  onRunAnalysis: () => void;
}

export const EtabsModelExplorer: React.FC<EtabsModelExplorerProps> = ({
  model,
  selectedStoreyElevation,
  onSelectStoreyElevation,
  onOpenWizard,
  onRunAnalysis,
}) => {
  const [activeTab, setActiveTab] = useState<'MODEL' | 'DISPLAY' | 'TABLES'>('MODEL');

  // Tree expanded states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    structure: true,
    properties: true,
    objects: true,
    loads: true,
    results: true,
  });

  const toggleSection = (sec: string) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Extract true floor plans and storey elevations using FloorPlanEngine
  const floorPlans = useMemo(() => {
    return FloorPlanEngine.extractAllFloorPlans(model);
  }, [model]);

  const totalCols = model ? Array.from(model.members.values()).filter((m) => m.classification === 'COLUMN').length : 0;
  const totalBeams = model ? Array.from(model.members.values()).filter((m) => m.classification === 'BEAM').length : 0;
  const totalPlates = model?.plates.size ?? 0;
  const totalSupports = model ? model.supports.size : 0;
  const totalMembers = model?.members.size ?? 0;
  const totalNodes = model?.nodes.size ?? 0;
  const hasResults = (model?.memberForces.length || 0) > 0;

  const loadCases = model?.loadCases ? Array.from(model.loadCases.values()) : [];
  const loadCombos = model?.loadCombinations ? Array.from(model.loadCombinations.values()) : [];
  const memberLoads = model?.memberLoads
    ? Array.from(model.memberLoads.entries()).flatMap(([, loads]) => loads)
    : [];
  const reactions = model?.reactions ?? [];
  const designSummaries = model?.designSummaries ? Array.from(model.designSummaries.values()) : [];
  const designFail = designSummaries.filter((s) => s.status === 'FAIL').length;
  const designPass = designSummaries.filter((s) => s.status === 'PASS').length;
  const driftRecords = model?.storyDrifts ?? [];
  const maxDrift = driftRecords.length > 0
    ? Math.max(...driftRecords.map((d) => Number(d?.driftRatio ?? 0)))
    : null;

  const sumReactionsFy = Math.abs(reactions.reduce((acc, r) => acc + (r.fy || 0), 0));

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col text-xs font-mono select-none shrink-0 h-full shadow-md">
      {/* Model Explorer Header Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950">
        <button
          onClick={() => setActiveTab('MODEL')}
          className={`flex-1 py-2 text-center font-bold text-[11px] border-b-2 transition-colors ${
            activeTab === 'MODEL' ? 'border-indigo-500 text-white bg-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Model
        </button>
        <button
          onClick={() => setActiveTab('DISPLAY')}
          className={`flex-1 py-2 text-center font-bold text-[11px] border-b-2 transition-colors ${
            activeTab === 'DISPLAY' ? 'border-indigo-500 text-white bg-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Display
        </button>
        <button
          onClick={() => setActiveTab('TABLES')}
          className={`flex-1 py-2 text-center font-bold text-[11px] border-b-2 transition-colors ${
            activeTab === 'TABLES' ? 'border-indigo-500 text-white bg-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Tables
        </button>
      </div>

      {/* Explorer Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 text-slate-300 text-[11px]">
        {activeTab === 'DISPLAY' && (
          <div className="space-y-2">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Display Options</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Nodes', totalNodes],
                  ['Members', totalMembers],
                  ['Columns', totalCols],
                  ['Beams', totalBeams],
                  ['Slabs/Plates', totalPlates],
                  ['Supports', totalSupports],
                  ['Load Cases', loadCases.length],
                  ['Load Combos', loadCombos.length],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex items-center justify-between bg-slate-900 rounded border border-slate-700 px-2 py-1.5">
                    <span className="text-slate-400">{label}</span>
                    <strong className="text-white">{val}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Table Query</span>
              <div className="flex items-center justify-between text-slate-400">
                <span>Member Forces Records:</span>
                <strong className="text-sky-300">{model?.memberForces.length ?? 0}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Joint Reaction Records:</span>
                <strong className="text-emerald-300">{reactions.length}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Storey Drift Records:</span>
                <strong className="text-amber-300">{driftRecords.length}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Design Summary Rows:</span>
                <strong className="text-indigo-300">{designSummaries.length}</strong>
              </div>
            </div>

            <button
              onClick={onRunAnalysis}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[10px] transition-colors"
            >
              Run / Refresh Analysis
            </button>
          </div>
        )}

        {activeTab === 'TABLES' && (
          <div className="space-y-2">
            {/* Load Patterns & Load Cases */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3 space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Load Patterns &amp; Cases</span>
              {loadCases.length === 0 && <span className="text-slate-500 text-[10px]">No load cases.</span>}
              {loadCases.map((lc) => (
                <div key={lc.id} className="flex items-center justify-between text-slate-300">
                  <span>LC {lc.id} — {lc.title}</span>
                  <span className="text-slate-500 text-[9px]">Raw Case</span>
                </div>
              ))}
              {loadCombos.map((lc) => (
                <div key={lc.id} className="flex items-center justify-between text-slate-300">
                  <span className="font-bold text-amber-300">COMBO {lc.id} — {lc.title}</span>
                  <span className="text-[9px] text-slate-500">
                    {lc.factors.map((f) => `${f.factor}·${f.loadCaseId}`).join(', ')}
                  </span>
                </div>
              ))}
            </div>

            {/* Joint Reactions */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Joint Reactions (ΣFy)</span>
              <div className="flex items-center justify-between text-slate-300">
                <span>Total Base Reaction:</span>
                <strong className="text-emerald-300">{sumReactionsFy.toFixed(1)} kN</strong>
              </div>
              <div className="text-[9px] text-slate-500">{reactions.length} reaction records</div>
            </div>

            {/* Storey Drift */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Storey Drifts (IS 1893)</span>
              {maxDrift === null ? (
                <span className="text-slate-500 text-[10px]">Run analysis to populate.</span>
              ) : (
                <div className="flex items-center justify-between text-slate-300">
                  <span>Max Drift Index:</span>
                  <strong className={maxDrift <= 0.004 ? 'text-emerald-300' : 'text-amber-400'}>
                    {maxDrift.toFixed(4)} / {maxDrift <= 0.004 ? 'PASS' : 'OVER 0.004'}
                  </strong>
                </div>
              )}
            </div>

            {/* Design Check */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Design Checks</span>
              {designSummaries.length === 0 ? (
                <span className="text-slate-500 text-[10px]">Run concrete design to populate.</span>
              ) : (
                <div className="flex items-center justify-between text-slate-300">
                  <span>PASS / FAIL:</span>
                  <strong className={designFail > 0 ? 'text-amber-400' : 'text-emerald-300'}>{designPass} / {designFail}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {(activeTab === 'MODEL') && <>
        {/* Tree Section: Structure Layout / Stories */}
        <div>
          <button
            onClick={() => toggleSection('structure')}
            className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800 text-left font-bold text-slate-200"
          >
            {expandedSections.structure ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            <Building className="w-3.5 h-3.5 text-sky-400" />
            <span>Structure Layout</span>
          </button>
          {expandedSections.structure && (
            <div className="pl-4 space-y-1 mt-1 border-l border-slate-800 ml-3">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Storey Diaphragms:</span>
              {floorPlans.map((fp) => {
                const isSelected = Math.abs(selectedStoreyElevation - fp.elevationY) < 0.2;
                return (
                  <button
                    key={fp.levelIndex}
                    onClick={() => onSelectStoreyElevation(fp.elevationY)}
                    className={`w-full text-left px-2 py-1.5 rounded text-[10px] flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="truncate pr-1">{fp.levelName.split('PLAN')[0].trim() || `Level ${fp.levelIndex}`}</span>
                    <span className="text-[9px] font-mono opacity-80 shrink-0">+{fp.elevationY.toFixed(2)}m</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tree Section: Frame Sections & Properties */}
        <div>
          <button
            onClick={() => toggleSection('properties')}
            className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800 text-left font-bold text-slate-200"
          >
            {expandedSections.properties ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            <Box className="w-3.5 h-3.5 text-amber-400" />
            <span>Section Properties</span>
          </button>
          {expandedSections.properties && (
            <div className="pl-4 space-y-1 mt-1 border-l border-slate-800 ml-3 text-[10px] text-slate-400">
              <div className="flex items-center justify-between py-0.5">
                <span>Columns:</span>
                <strong className="text-sky-300">C450x450 (M25)</strong>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>Beams:</span>
                <strong className="text-indigo-300">B300x450 (M25)</strong>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>Slabs:</span>
                <strong className="text-amber-300">S125 (125mm)</strong>
              </div>
            </div>
          )}
        </div>

        {/* Tree Section: Structural Objects */}
        <div>
          <button
            onClick={() => toggleSection('objects')}
            className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800 text-left font-bold text-slate-200"
          >
            {expandedSections.objects ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Structural Objects</span>
          </button>
          {expandedSections.objects && (
            <div className="pl-4 space-y-1 mt-1 border-l border-slate-800 ml-3 text-[10px] text-slate-400">
              <div className="flex items-center justify-between py-0.5">
                <span>Total Columns:</span>
                <strong className="text-white">{totalCols}</strong>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>Total Beams:</span>
                <strong className="text-white">{totalBeams}</strong>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span>Base Supports:</span>
                <strong className="text-emerald-400">{totalSupports} Fixed</strong>
              </div>
            </div>
          )}
        </div>

        {/* Tree Section: Loads & Diaphragms */}
        <div>
          <button
            onClick={() => toggleSection('loads')}
            className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800 text-left font-bold text-slate-200"
          >
            {expandedSections.loads ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
            <span>Loads &amp; Diaphragms</span>
          </button>
          {expandedSections.loads && (
            <div className="pl-4 space-y-1 mt-1 border-l border-slate-800 ml-3 text-[10px] text-slate-400">
              {loadCases.length === 0 && <div className="text-slate-500">No load cases defined.</div>}
              {loadCases.map((lc) => (
                <div key={lc.id} className="text-slate-300">• LC {lc.id}: {lc.title}</div>
              ))}
              {loadCombos.map((lc) => (
                <div key={lc.id} className="text-amber-300">• Combo {lc.id}: {lc.title}</div>
              ))}
              <div className="text-slate-300">
                • {memberLoads.length} member load{memberLoads.length === 1 ? '' : 's'} applied
              </div>
            </div>
          )}
        </div>

        {/* Tree Section: Analysis & Design Status */}
        <div>
          <button
            onClick={() => toggleSection('results')}
            className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800 text-left font-bold text-slate-200"
          >
            {expandedSections.results ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Analysis &amp; Design</span>
          </button>
          {expandedSections.results && (
            <div className="pl-4 space-y-1 mt-1 border-l border-slate-800 ml-3 text-[10px]">
              <div className="flex items-center gap-1.5 py-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-slate-200">3D FEM Analysis: {hasResults ? 'SOLVED' : 'PENDING'}</span>
              </div>
              <div className="flex items-center gap-1.5 py-0.5">
                {designSummaries.length === 0 ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-400">IS 456 RCC Design: NOT RUN</span>
                  </>
                ) : designFail > 0 ? (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-300">RCC Design: {designPass} Pass / {designFail} Fail</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">IS 456 RCC Design: PASS ({designPass})</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        </>}
      </div>

      {/* Explorer Footer Quick Action */}
      <div className="p-2 border-t border-slate-800 bg-slate-950">
        <button
          onClick={onOpenWizard}
          className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold text-[10px] transition-colors border border-slate-700 text-center flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Building Grid Wizard...</span>
        </button>
      </div>
    </div>
  );
};
