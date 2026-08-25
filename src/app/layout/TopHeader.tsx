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
  PanelTopClose,
} from 'lucide-react';

interface TopHeaderProps {
  onHide?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = React.memo(({ onHide }) => {
  const activeProject = useProjectStore(s => s.activeProject);
  const activeModel = useProjectStore(s => s.activeModel);
  const setImportModalOpen = useProjectStore(s => s.setImportModalOpen);
  const setActiveView = useProjectStore(s => s.setActiveView);
  const batchUpdateSections = useProjectStore(s => s.batchUpdateSections);
  const universalRebarSelection = useProjectStore(s => s.universalRebarSelection);
  const setUniversalRebarModalOpen = useProjectStore(s => s.setUniversalRebarModalOpen);

  const [globalSummary, setGlobalSummary] = useState<GlobalAutoDesignSummary | null>(null);
  const [isApplying, setIsApplying] = useState(false);

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
      <header className="h-14 bg-surface-card border-b border-ui-border flex items-center justify-between px-5 w-full flex-shrink-0 z-10 font-sans shadow-sm">
        {/* Left: Project Title & Breadcrumb */}
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-sm font-bold text-deep-navy truncate max-w-xs sm:max-w-md">
            {activeProject?.metadata.name || 'G+4 RCC Residential Building'}
          </h2>
          {stats && (
            <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
              <span>•</span>
              <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                {stats.totalMembers} Members
              </span>
              <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                {stats.totalNodes} Nodes
              </span>
              <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
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
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded transition-all shadow-xs border ${
                longDias.length === 0
                  ? 'bg-red-500/20 text-red-700 border-red-500 animate-pulse'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
              title="Configure Universal Allowed Rebar Diameters (Enforced Across All Design Engines)"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Rebars: {longDias.length > 0 ? longDias.map((d) => `T${d}`).join(', ') : 'NONE (LOCKED)'}
              </span>
            </button>
          )}

          {activeModel && (
            <button
              onClick={handleRunGlobalAutoFix}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded transition-all shadow-xs"
              title="1-Click Auto-Fix & Optimize All RCC Beams, Columns, and Pile Caps"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>Auto-Fix All Designs</span>
            </button>
          )}

          <button
            onClick={() => setActiveView('3d-model')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-ui-border rounded transition-colors shadow-sm"
          >
            <Box className="w-3.5 h-3.5 text-secondary-brand" />
            <span className="hidden sm:inline">3D View</span>
          </button>

          <button
            onClick={() => setActiveView('member-forces')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-ui-border rounded transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">Forces</span>
          </button>

          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-white bg-secondary-brand hover:bg-blue-700 rounded transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import ANL</span>
          </button>

          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 border border-transparent hover:border-ui-border transition-colors"
              title="Hide Top Header"
            >
              <PanelTopClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

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
