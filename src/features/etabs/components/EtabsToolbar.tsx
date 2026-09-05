import React from 'react';
import {
  Play,
  Save,
  Sparkles,
  ShieldCheck,
  FolderPlus,
  Building,
  Grid,
  Layers,
} from 'lucide-react';

export interface StoreyElevationItem {
  label: string;
  elevationY: number;
}

interface EtabsToolbarProps {
  selectedStoreyElevation: number;
  availableElevations: StoreyElevationItem[];
  onChangeStoreyElevation: (elevation: number) => void;
  storeyScope?: 'ONE_STORY' | 'ALL_STORIES';
  onChangeStoreyScope?: (scope: 'ONE_STORY' | 'ALL_STORIES') => void;
  onOpenGridSystem?: () => void;
  onOpenStoryData?: () => void;
  onNewProject: () => void;
  onRunAnalysis: () => void;
  onRunDesign: () => void;
  onOpenWizard: () => void;
  onSave: () => void;
  isAnalyzing: boolean;
}

export const EtabsToolbar: React.FC<EtabsToolbarProps> = React.memo(({
  selectedStoreyElevation,
  availableElevations,
  onChangeStoreyElevation,
  storeyScope = 'ONE_STORY',
  onChangeStoreyScope,
  onOpenGridSystem,
  onOpenStoryData,
  onNewProject,
  onRunAnalysis,
  onRunDesign,
  onOpenWizard,
  onSave,
  isAnalyzing,
}) => {
  return (
    <div className="bg-slate-800 text-slate-200 border-b border-slate-700 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs shadow-xs z-20">
      {/* Left Quick Action Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* New Project Button */}
        <button
          onClick={onNewProject}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-all shadow-xs"
          title="Create a New Structural Project"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>+ New Project</span>
        </button>

        {/* Wizard Button */}
        <button
          onClick={onOpenWizard}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold transition-all shadow-xs"
          title="Open 1-Click Building Grid Wizard"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Building Wizard</span>
        </button>

        {/* Save Button */}
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded border border-slate-600 font-semibold transition-all"
          title="Save Model"
        >
          <Save className="w-3.5 h-3.5 text-blue-400" />
          <span>Save</span>
        </button>

        <div className="h-5 w-px bg-slate-600 mx-1" />

        {/* RUN 3D FEM ANALYSIS BUTTON */}
        <button
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition-all shadow-xs ${
            isAnalyzing
              ? 'bg-emerald-900 text-emerald-300 opacity-60 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
          title="Run 3D Space Frame Direct Stiffness FEM Solver (F5)"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isAnalyzing ? 'Solving FEM...' : '▶ Run Analysis'}</span>
        </button>

        {/* RUN CONCRETE DESIGN BUTTON */}
        <button
          onClick={onRunDesign}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-all shadow-xs"
          title="Run IS 456 / IS 13920 RCC Frame Design"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Run Concrete Design</span>
        </button>

        <div className="h-5 w-px bg-slate-600 mx-1" />

        {/* Story Scope: One Story vs All Stories */}
        <div className="flex items-center bg-slate-900 rounded border border-slate-700 p-0.5" title="Story Scope: Add columns/beams across all continuous floors or active floor only">
          <button
            type="button"
            onClick={() => onChangeStoreyScope?.('ONE_STORY')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
              storeyScope === 'ONE_STORY'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            One Story
          </button>
          <button
            type="button"
            onClick={() => onChangeStoreyScope?.('ALL_STORIES')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
              storeyScope === 'ALL_STORIES'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Stories
          </button>
        </div>

        {/* Quick Modal Launchers for Grid System and Story Data */}
        {onOpenGridSystem && (
          <button
            type="button"
            onClick={onOpenGridSystem}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-sky-300 hover:text-sky-200 rounded border border-slate-600 font-bold transition-all"
            title="Edit Grids, Spacings & Add Bays"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grids</span>
          </button>
        )}

        {onOpenStoryData && (
          <button
            type="button"
            onClick={onOpenStoryData}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-emerald-300 hover:text-emerald-200 rounded border border-slate-600 font-bold transition-all"
            title="Edit Story Heights & Add Floor on Top"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Stories</span>
          </button>
        )}

        <div className="h-5 w-px bg-slate-600 mx-1" />

        {/* Storey Elevation Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded border border-slate-700">
          <Building className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[10px] text-slate-400 uppercase font-bold">Level:</span>
          <select
            value={selectedStoreyElevation}
            onChange={(e) => onChangeStoreyElevation(Number(e.target.value))}
            className="bg-transparent text-indigo-300 font-bold text-xs focus:outline-hidden cursor-pointer"
          >
            {availableElevations.map((item) => (
              <option key={item.elevationY} value={item.elevationY} className="bg-slate-800 text-white">
                {item.label} (EL. +{item.elevationY.toFixed(2)}m)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Quick Status Badges */}
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700 text-[10px]">
          Snap: <strong>Grid (0.5m)</strong>
        </span>
        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700 text-[10px] font-bold">
          IS 456 RCC Design
        </span>
      </div>
    </div>
  );
});
