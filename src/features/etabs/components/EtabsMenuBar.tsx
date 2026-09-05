import React, { useState } from 'react';
import {
  FolderPlus,
  Save,
  Play,
  Sparkles,
  Layers,
  Box,
  Sliders,
  Download,
  TrendingUp,
  ShieldCheck,
  RotateCw,
} from 'lucide-react';

interface EtabsMenuBarProps {
  onNewModel: () => void;
  onOpenWizard: () => void;
  onRunAnalysis: () => void;
  onRunDesign: () => void;
  onSave: () => void;
  onExportCsv: () => void;
  onToggle3D: () => void;
  onTogglePlan: () => void;
  onToggleSplit: () => void;
  onOpenSectionsModal: () => void;
  onOpenLoadsModal: () => void;
  onOpenDiaphragmsModal: () => void;
  onOpenAssignLoads: () => void;
  onOpenAssignSection: () => void;
  onOpenAssignRestraints: () => void;
  onOpenReplicateModal: () => void;
  onOpenAutoSeismic: () => void;
  onOpenTributaryLoads: () => void;
  onOpenWindow: (windowId: string) => string;
  isAnalyzing: boolean;
}

export const EtabsMenuBar: React.FC<EtabsMenuBarProps> = ({
  onNewModel,
  onOpenWizard,
  onRunAnalysis,
  onRunDesign,
  onSave,
  onExportCsv,
  onToggle3D,
  onTogglePlan,
  onToggleSplit,
  onOpenSectionsModal,
  onOpenLoadsModal,
  onOpenDiaphragmsModal,
  onOpenAssignLoads,
  onOpenAssignSection,
  onOpenAssignRestraints,
  onOpenReplicateModal,
  onOpenAutoSeismic,
  onOpenTributaryLoads,
  onOpenWindow,
  isAnalyzing,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const handleMenuClick = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleClose = () => setActiveMenu(null);

  return (
    <div className="bg-slate-900 text-slate-200 border-b border-slate-700 text-xs font-mono select-none flex items-center justify-between px-2 py-1 z-30 relative">
      {/* Left Menu Items */}
      <div className="flex items-center space-x-1">
        {/* App Brand Tag */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 mr-2 bg-indigo-700 text-white rounded font-bold text-[11px] tracking-wide">
          <Layers className="w-3.5 h-3.5" />
          <span>ETABS SA STUDIO</span>
        </div>

        {/* File Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('File')}
            className={`px-2.5 py-1 rounded hover:bg-slate-800 ${activeMenu === 'File' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300'}`}
          >
            File
          </button>
          {activeMenu === 'File' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-56 bg-slate-800 border border-slate-700 rounded shadow-xl py-1 z-50 text-slate-200"
              onMouseLeave={handleClose}
            >
              <button
                onClick={() => { onNewModel(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><FolderPlus className="w-3.5 h-3.5 text-indigo-400" /> New Project Setup...</span>
                <span className="text-[10px] text-slate-400">Ctrl+N</span>
              </button>
              <button
                onClick={() => { onOpenWizard(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-amber-400" /> Quick Building Wizard...</span>
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={() => { onSave(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><Save className="w-3.5 h-3.5 text-blue-400" /> Save Project Model</span>
                <span className="text-[10px] text-slate-400">Ctrl+S</span>
              </button>
              <button
                onClick={() => { onExportCsv(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Export Schedule CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('Edit')}
            className={`px-2.5 py-1 rounded hover:bg-slate-800 ${activeMenu === 'Edit' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300'}`}
          >
            Edit
          </button>
          {activeMenu === 'Edit' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-56 bg-slate-800 border border-slate-700 rounded shadow-xl py-1 z-50 text-slate-200"
              onMouseLeave={handleClose}
            >
              <button
                onClick={() => { onOpenReplicateModal(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" /> Replicate / Multi-Storey Copy...
              </button>
              <button
                onClick={() => { onOpenWizard(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Parametric Frame Generator...
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('View')}
            className={`px-2.5 py-1 rounded hover:bg-slate-800 ${activeMenu === 'View' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300'}`}
          >
            View
          </button>
          {activeMenu === 'View' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-52 bg-slate-800 border border-slate-700 rounded shadow-xl py-1 z-50 text-slate-200"
              onMouseLeave={handleClose}
            >
              <button
                onClick={() => { onToggle3D(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
              >
                Set 3D Space Frame View
              </button>
              <button
                onClick={() => { onTogglePlan(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
              >
                Set 2D Story Plan View
              </button>
              <button
                onClick={() => { onToggleSplit(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white font-bold text-amber-300"
              >
                Split Screen (3D + 2D Plan)
              </button>
            </div>
          )}
        </div>

        {/* Define Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('Define')}
            className={`px-2.5 py-1 rounded hover:bg-slate-800 ${activeMenu === 'Define' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300'}`}
          >
            Define
          </button>
          {activeMenu === 'Define' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-60 bg-slate-800 border border-slate-700 rounded shadow-xl py-1 z-50 text-slate-200"
              onMouseLeave={handleClose}
            >
              <button
                onClick={() => { onOpenSectionsModal(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Box className="w-3.5 h-3.5 text-sky-400" /> Frame Section Properties...
              </button>
              <button
                onClick={() => { onOpenAutoSeismic(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2 font-bold text-amber-300"
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Auto Seismic Loads (IS 1893:2016)...
              </button>
              <button
                onClick={() => { onOpenDiaphragmsModal(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Rigid Floor Diaphragms...
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={() => { onOpenWindow('loadPattern'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-slate-300" /> Load Patterns (Window)...
              </button>
              <button
                onClick={() => { onOpenWindow('loadCombination'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" /> Load Combinations (IS 456 Auto)...
              </button>
              <button
                onClick={() => { onOpenWindow('seismicLoad'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Seismic Load (Window)...
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={() => { onOpenWindow('project'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <FolderPlus className="w-3.5 h-3.5 text-sky-400" /> Project Information...
              </button>
              <button
                onClick={() => { onOpenWindow('storyData'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" /> Story Data...
              </button>
              <button
                onClick={() => { onOpenWindow('gridSystem'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Box className="w-3.5 h-3.5 text-sky-400" /> Grid System...
              </button>
              <button
                onClick={() => { onOpenWindow('materialProperties'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Box className="w-3.5 h-3.5 text-emerald-400" /> Material Properties...
              </button>
              <button
                onClick={() => { onOpenWindow('slabSection'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-slate-300" /> Slab Section Properties...
              </button>
              <button
                onClick={() => { onOpenWindow('wallSection'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Box className="w-3.5 h-3.5 text-slate-300" /> Wall Section Properties...
              </button>
              <button
                onClick={() => { onOpenWindow('foundationProperty'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" /> Foundation Properties...
              </button>
            </div>
          )}
        </div>

        {/* Assign Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('Assign')}
            className={`px-2.5 py-1 rounded hover:bg-slate-800 ${activeMenu === 'Assign' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300'}`}
          >
            Assign
          </button>
          {activeMenu === 'Assign' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-64 bg-slate-800 border border-slate-700 rounded shadow-xl py-1 z-50 text-slate-200"
              onMouseLeave={handleClose}
            >
              <button
                onClick={() => { onOpenAssignSection(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Box className="w-3.5 h-3.5 text-sky-400" /> Frame -&gt; Section Property...
              </button>
              <button
                onClick={() => { onOpenAssignLoads(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> Frame Loads -&gt; Distributed (UDL)...
              </button>
              <button
                onClick={() => { onOpenTributaryLoads(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2 text-emerald-300 font-bold"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" /> Shell Loads -&gt; 45° Tributary UDLs...
              </button>
              <button
                onClick={() => { onOpenAssignRestraints(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Joint -&gt; Restraints (Supports)...
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={() => { onOpenWindow('assignSection'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Box className="w-3.5 h-3.5 text-sky-400" /> Frame -&gt; Section (window)...
              </button>
              <button
                onClick={() => { onOpenWindow('assignMaterial'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Box className="w-3.5 h-3.5 text-amber-400" /> Frame -&gt; Material...
              </button>
              <button
                onClick={() => { onOpenWindow('assignLoad'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> Frame Loads -&gt; Member Loads...
              </button>
              <button
                onClick={() => { onOpenWindow('assignLocalAxis'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <RotateCw className="w-3.5 h-3.5 text-indigo-400" /> Frame -&gt; Local Axis (Beta)...
              </button>
              <button
                onClick={() => { onOpenWindow('assignSupport'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Joint -&gt; Support (window)...
              </button>
            </div>
          )}
        </div>

        {/* Analyze Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('Analyze')}
            className={`px-2.5 py-1 rounded hover:bg-slate-800 ${activeMenu === 'Analyze' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300'}`}
          >
            Analyze
          </button>
          {activeMenu === 'Analyze' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-64 bg-slate-800 border border-slate-700 rounded shadow-xl py-1 z-50 text-slate-200"
              onMouseLeave={handleClose}
            >
              <button
                onClick={() => { onRunAnalysis(); handleClose(); }}
                disabled={isAnalyzing}
                className="w-full px-3 py-2 text-left hover:bg-emerald-600 hover:text-white font-bold text-emerald-400 flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><Play className="w-3.5 h-3.5 fill-current" /> Run 3D FEM Analysis</span>
                <span className="text-[10px] text-slate-400">F5</span>
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={() => { onOpenWindow('runAnalysis'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-emerald-600 hover:text-white flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" /> Run Analysis (Window)...
              </button>
              <button
                onClick={() => { onOpenWindow('memberForces'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <TrendingUp className="w-3.5 h-3.5 text-sky-400" /> Member Forces...
              </button>
              <button
                onClick={() => { onOpenWindow('jointReactions'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Joint Reactions...
              </button>
              <button
                onClick={() => { onOpenWindow('jointDisplacement'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" /> Joint Displacements...
              </button>
              <button
                onClick={() => { onOpenWindow('storyDrift'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-rose-400" /> Story Drift...
              </button>
            </div>
          )}
        </div>

        {/* Design Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('Design')}
            className={`px-2.5 py-1 rounded hover:bg-slate-800 ${activeMenu === 'Design' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300'}`}
          >
            Design
          </button>
          {activeMenu === 'Design' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-64 bg-slate-800 border border-slate-700 rounded shadow-xl py-1 z-50 text-slate-200"
              onMouseLeave={handleClose}
            >
              <button
                onClick={() => { onRunDesign(); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white font-bold text-sky-300 flex items-center gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> Concrete Frame Design (IS 456)
              </button>
              <button
                onClick={() => { onOpenWindow('designSummary'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Design Summary (Window)...
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={() => { onOpenWindow('pileType'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" /> Pile Types (IS 2911:2010)...
              </button>
              <button
                onClick={() => { onOpenWindow('foundationProperty'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" /> Foundation Properties...
              </button>
            </div>
          )}
        </div>

        {/* Output / Audit Menu */}
        <div className="relative">
          <button
            onClick={() => handleMenuClick('Output')}
            className={`px-2.5 py-1 rounded hover:bg-slate-800 ${activeMenu === 'Output' ? 'bg-slate-800 text-white font-bold' : 'text-slate-300'}`}
          >
            Output
          </button>
          {activeMenu === 'Output' && (
            <div
              className="absolute left-0 top-full mt-0.5 w-64 bg-slate-800 border border-slate-700 rounded shadow-xl py-1 z-50 text-slate-200"
              onMouseLeave={handleClose}
            >
              <button
                onClick={() => { onOpenWindow('audit'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Design Audit...
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={() => { onOpenWindow('quantityTakeoff'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" /> Quantity Takeoff (Concrete)...
              </button>
              <button
                onClick={() => { onOpenWindow('bbs'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" /> Bar Bending Schedule...
              </button>
              <div className="border-t border-slate-700 my-1" />
              <button
                onClick={() => { onOpenWindow('reports'); handleClose(); }}
                className="w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" /> Reports / Calculation Book (PDF)...
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Quick Status Badges */}
      <div className="flex items-center gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <strong className="text-slate-200">STANDALONE SA SOLVER READY</strong>
        </span>
        <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-bold">
          Units: kN, m, °C
        </span>
      </div>
    </div>
  );
};
