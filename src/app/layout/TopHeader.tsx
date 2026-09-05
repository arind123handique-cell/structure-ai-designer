import React, { useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { GlobalAutoDesignService, GlobalAutoDesignSummary } from '@/features/design/common/globalAutoDesignService';
import { GlobalAutoDesignModal } from '@/features/design/common/GlobalAutoDesignModal';
import {
  Search,
  Upload,
  Layers,
  Box,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Sparkles,
  Zap,
  Sliders,
  EyeOff,
  FolderPlus,
  Radio,
  Volume2,
  VolumeX,
  Video,
  PanelTopClose,
  Sun,
  Moon,
  Undo2,
  Redo2,
  Download,
} from 'lucide-react';
import { useVideoStore } from '@/features/video/videoStore';
import { DroneStreamModal } from '@/features/video/components/DroneStreamModal';
import { useThemeStore } from '@/features/theme/themeStore';
import { CommandManager } from '@/features/commands/commandManager';
import { exportToStd } from '@/utils/exportUtils';

interface TopHeaderProps {
  onHide?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = React.memo(({ onHide }) => {
  const activeProject = useProjectStore(s => s.activeProject);
  const activeModel = useProjectStore(s => s.activeModel);
  const setImportModalOpen = useProjectStore(s => s.setImportModalOpen);
  const setNewProjectModalOpen = useProjectStore(s => s.setNewProjectModalOpen);
  const setActiveView = useProjectStore(s => s.setActiveView);
  const batchUpdateSections = useProjectStore(s => s.batchUpdateSections);
  const universalRebarSelection = useProjectStore(s => s.universalRebarSelection);
  const setUniversalRebarModalOpen = useProjectStore(s => s.setUniversalRebarModalOpen);

  const setStreamModalOpen = useVideoStore(s => s.setStreamModalOpen);
  const isStreamActive = useVideoStore(s => s.isStreamActive);
  const isSoundMuted = useVideoStore(s => s.isSoundMuted);
  const toggleMute = useVideoStore(s => s.toggleMute);

  const theme = useThemeStore(s => s.theme);
  const toggleTheme = useThemeStore(s => s.toggleTheme);

  const [globalSummary, setGlobalSummary] = useState<GlobalAutoDesignSummary | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const [cmdState, setCmdState] = useState(() => ({
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
  }));

  React.useEffect(() => {
    const cmdMgr = CommandManager.getInstance();
    const unsubscribe = cmdMgr.subscribe((st) => {
      setCmdState({
        canUndo: st.canUndo,
        canRedo: st.canRedo,
        undoCount: st.undoStackLength,
        redoCount: st.redoStackLength,
      });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          cmdMgr.redo();
        } else {
          cmdMgr.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        cmdMgr.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const stats = activeModel?.statistics;
  const longDias = universalRebarSelection?.longitudinalDiameters || [];

  const handleRunGlobalAutoFix = () => {
    if (!activeModel) return;
    const concreteGrade = activeProject?.metadata.designSettings.concreteGrade || 'M25';
    const steelGrade = activeProject?.metadata.designSettings.steelGrade || 'Fe500D';
    const summary = GlobalAutoDesignService.runGlobalAutoDesign(activeModel, concreteGrade, steelGrade, 450, 500);
    setGlobalSummary(summary);
  };

  const handleConfirmApply = async () => {
    if (!globalSummary) return;
    setIsApplying(true);
    const allUpdates = [...globalSummary.beamUpdates, ...globalSummary.columnUpdates];
    await batchUpdateSections(allUpdates);
    setIsApplying(false);
    setGlobalSummary(null);
  };

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 w-full flex-shrink-0 z-10 font-sans shadow-xs">
        {/* Left: Project Title & Breadcrumb */}
        <div className="flex items-center gap-3">
          <h2 className="font-sans text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
            {activeProject?.metadata.name || 'G+4 RCC Residential Building (6 MILES)'}
          </h2>
          {stats && (
            <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
              <span>•</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                {stats.totalMembers} Members
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                {stats.totalNodes} Nodes
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                {stats.totalSupports} Supports
              </span>
            </div>
          )}
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Universal Rebar Selector Button */}
          {activeModel && (
            <button
              onClick={() => setUniversalRebarModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-all shadow-xs border ${
                longDias.length === 0
                  ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
              title="Configure Universal Allowed Rebar Diameters"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Rebars: {longDias.length > 0 ? longDias.map((d) => `T${d}`).join(', ') : 'NONE'}
              </span>
            </button>
          )}

          {activeModel && (
            <button
              onClick={handleRunGlobalAutoFix}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-all shadow-xs"
              title="1-Click Auto-Fix & Optimize All RCC Beams, Columns, and Pile Caps"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>Auto-Fix All</span>
            </button>
          )}

          {/* Drone Video Stream Launcher */}
          <button
            onClick={() => {
              setActiveView('3d-model');
              setStreamModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-md transition-all shadow-xs border ${
              isStreamActive
                ? 'bg-red-50 border-red-300 text-red-600 animate-pulse'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
            title="Open Drone / Site Video Stream Feed"
          >
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <span>{isStreamActive ? 'DRONE LIVE' : 'DRONE FEED'}</span>
          </button>

          {/* Audio Telemetry Mute Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className={`p-1.5 rounded-md border transition-colors ${
              !isSoundMuted
                ? 'bg-slate-50 text-blue-600 border-slate-200'
                : 'bg-slate-100 text-slate-400 border-slate-200'
            }`}
            title={!isSoundMuted ? 'Mute Audio' : 'Unmute Audio'}
          >
            {!isSoundMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Light / Dark Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border font-mono text-xs font-semibold transition-all shadow-xs ${
              theme === 'light'
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-700'
            }`}
            title={theme === 'light' ? 'Switch to Dark / Cyberpunk Mode' : 'Switch to Clean Studio Theme'}
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            )}
          </button>

          {/* Undo / Redo Command History */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => CommandManager.getInstance().undo()}
              disabled={!cmdState.canUndo}
              className={`px-1.5 py-1 rounded flex items-center gap-1 transition-all text-xs font-mono ${
                cmdState.canUndo
                  ? 'text-slate-700 hover:bg-white hover:shadow-xs cursor-pointer'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Undo Last Operation (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              {cmdState.undoCount > 0 && <span className="text-[10px] font-bold">{cmdState.undoCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => CommandManager.getInstance().redo()}
              disabled={!cmdState.canRedo}
              className={`px-1.5 py-1 rounded flex items-center gap-1 transition-all text-xs font-mono ${
                cmdState.canRedo
                  ? 'text-slate-700 hover:bg-white hover:shadow-xs cursor-pointer'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Redo Operation (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
              {cmdState.redoCount > 0 && <span className="text-[10px] font-bold">{cmdState.redoCount}</span>}
            </button>
          </div>

          {/* Export Bentley STAAD.Pro .STD Command File */}
          {activeModel && (
            <button
              type="button"
              onClick={() =>
                exportToStd(
                  activeModel,
                  `${activeProject?.metadata.name || 'STRUCTURE_MODEL'}.STD`,
                  {
                    engineer: activeProject?.metadata.engineer,
                    jobName: activeProject?.metadata.code,
                  }
                )
              }
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors shadow-xs"
              title="Export Full Structural Model as Bentley STAAD.Pro .STD Input Script"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export .STD</span>
            </button>
          )}

          <button
            onClick={() => setActiveView('3d-model')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors shadow-xs"
          >
            <Box className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">3D View</span>
          </button>

          <button
            onClick={() => setActiveView('member-forces')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">Forces</span>
          </button>

          <button
            onClick={() => setNewProjectModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-sm transition-all"
            title="Create a New Structural Design Project"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>+ New Project</span>
          </button>

          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import ANL</span>
          </button>

          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 border border-transparent hover:border-slate-200 transition-colors"
              title="Hide Top Header"
            >
              <PanelTopClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Drone Stream Selection Modal */}
      <DroneStreamModal />

      {/* 1-Click Global Auto-Fix & Rebar Optimizer Modal */}
      <GlobalAutoDesignModal
        summary={globalSummary}
        isOpen={globalSummary !== null}
        onClose={() => setGlobalSummary(null)}
        onConfirmApply={handleConfirmApply}
        isApplying={isApplying}
      />
    </>
  );
});
TopHeader.displayName = 'TopHeader';
