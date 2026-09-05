import React, { useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { GlobalAutoDesignService, GlobalAutoDesignSummary } from '@/features/design/common/globalAutoDesignService';
import { GlobalAutoDesignModal } from '@/features/design/common/GlobalAutoDesignModal';
import { FirestoreProjectStorage } from '@/lib/firebase/firestore';
import { useAuth } from '@/lib/firebase/AuthContext';
import {
  Upload,
  FolderOpen,
  FileSpreadsheet,
  Play,
  ArrowRight,
  Layers,
  Minus,
  Columns as ViewColumn,
  AlignJustify,
  Square,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Building,
  Trash2,
  X,
  Zap,
  Share2,
  Link2,
  Check,
  Box,
  HardHat,
  FolderPlus,
} from 'lucide-react';
import { ConcreteVolumeEngine } from '@/features/calculations/concreteVolumeEngine';

export const ProjectDashboard: React.FC = () => {
  const {
    activeProject,
    activeModel,
    projects,
    openProject,
    deleteProject,
    deleteInactiveProjects,
    setActiveView,
    setImportModalOpen,
    setNewProjectModalOpen,
    batchUpdateSections,
  } = useProjectStore();
  const { user } = useAuth();

  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isClearingInactive, setIsClearingInactive] = useState(false);
  const [globalSummary, setGlobalSummary] = useState<GlobalAutoDesignSummary | null>(null);
  const [isApplyingAutoFix, setIsApplyingAutoFix] = useState(false);
  const [sharingProjectId, setSharingProjectId] = useState<string | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState<string | null>(null);

  const handleShare = async (project: any) => {
    if (!user) {
      alert('Please sign in to share projects.');
      return;
    }
    setSharingProjectId(project.metadata.id);
    try {
      const token = await FirestoreProjectStorage.createShareLink(user.uid, project);
      const link = `${window.location.origin}/?share=${token}`;
      await navigator.clipboard.writeText(link);
      setShareLinkCopied(project.metadata.id);
      setTimeout(() => setShareLinkCopied(null), 3000);
    } catch (e) {
      console.error('Share failed:', e);
      alert('Failed to create share link. Please ensure you are connected to the internet.');
    } finally {
      setSharingProjectId(null);
    }
  };

  const handleRunGlobalAutoFix = () => {
    if (!activeModel) return;
    const concreteGrade = activeProject?.metadata.designSettings.concreteGrade || 'M25';
    const steelGrade = activeProject?.metadata.designSettings.steelGrade || 'Fe500D';
    const summary = GlobalAutoDesignService.runGlobalAutoDesign(activeModel, concreteGrade, steelGrade, 450, 500);
    setGlobalSummary(summary);
  };

  const handleConfirmApplyAutoFix = async () => {
    if (!globalSummary) return;
    setIsApplyingAutoFix(true);
    const allUpdates = [...globalSummary.beamUpdates, ...globalSummary.columnUpdates];
    await batchUpdateSections(allUpdates);
    setIsApplyingAutoFix(false);
    setGlobalSummary(null);
  };

  const stats = activeModel?.statistics || {
    totalNodes: 0,
    totalMembers: 0,
    totalBeams: 0,
    totalColumns: 0,
    totalPlates: 0,
    totalSupports: 0,
  };

  const warnings = activeProject?.warnings || [];
  const criticalCount = warnings.filter((w) => w.severity === 'CRITICAL').length;
  const warningCount = warnings.filter((w) => w.severity === 'WARNING').length;

  const concreteSummary = React.useMemo(() => {
    if (!activeModel) return null;
    return ConcreteVolumeEngine.calculateBuildingConcreteSummary(
      activeModel,
      activeProject?.metadata,
      {
        savedColumnDesigns: activeProject?.savedColumnDesigns,
        savedBeamDesigns: activeProject?.savedBeamDesigns,
        savedShearWallDesigns: activeProject?.savedShearWallDesigns,
        savedGradeBeamDesigns: activeProject?.savedGradeBeamDesigns,
        savedFootingDesigns: activeProject?.savedFootingDesigns,
        savedSlabDesigns: activeProject?.savedSlabDesigns,
        manualMergedPileCapGroups: activeProject?.manualMergedPileCapGroups,
        detachedCombinedCapNodeIds: activeProject?.detachedCombinedCapNodeIds,
        customCombinedCapOverrides: activeProject?.customCombinedCapOverrides,
        projectPileTypes: activeProject?.projectPileTypes,
      }
    );
  }, [activeModel, activeProject]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-ui-background font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Project Status & Actions Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-mono text-xs rounded font-semibold border border-slate-200">
                {activeProject?.metadata.code || 'PRJ-2026-6MILE'}
              </span>
              <span className="px-2 py-0.5 bg-slate-900 text-cyan-300 font-mono text-[11px] rounded font-bold">
                STAAD Model Loaded
              </span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 font-mono text-[11px] rounded border border-blue-200 font-semibold">
                Phase 1 Active
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {activeProject?.metadata.name || 'G+4 RCC Residential Building (6 MILES)'}
            </h1>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Engineer: {activeProject?.metadata.engineer || 'Structural Engineer'} • Location:{' '}
              {activeProject?.metadata.location || '6 Miles Site, Phase II'} • Last updated: Today
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setNewProjectModalOpen(true)}
              className="fx-glow-btn flex items-center gap-1.5 px-3.5 py-1.5 font-mono text-xs font-bold rounded transition-all"
              title="Create a New Structural Project"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ New Project</span>
            </button>

            {activeModel && (
              <button
                onClick={handleRunGlobalAutoFix}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-mono text-xs font-bold rounded shadow-sm transition-all"
                title="1-Click Auto-Fix & Optimize All RCC Beams, Columns, and Foundations as per IS Code"
              >
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>Auto-Fix All Designs</span>
              </button>
            )}

            <button
              onClick={() => setImportModalOpen(true)}
              className="fx-ghost-btn flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-semibold rounded transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Import ANL
            </button>

            {activeProject && (
              <button
                onClick={() => handleShare(activeProject)}
                disabled={sharingProjectId === activeProject.metadata.id}
                className="fx-ghost-btn flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-semibold rounded transition-all disabled:opacity-50"
                title="Copy share link to clipboard"
              >
                {shareLinkCopied === activeProject.metadata.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveView('3d-model')}
              className="fx-glow-btn flex items-center gap-1.5 px-4 py-1.5 font-mono text-xs font-semibold rounded transition-all"
            >
              <span>View 3D Model</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* KPI & Structural Element Bento Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Elements KPI Row */}
          <div className="col-span-12 lg:col-span-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Total Elements */}
            <div
              onClick={() => setActiveView('elements')}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-blue-400 hover:shadow-xs cursor-pointer transition-all relative overflow-hidden"
            >
              <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ELEMENTS</span>
              <div className="flex items-end justify-between mt-3">
                <span className="font-mono text-2xl font-bold text-slate-900 leading-none">
                  {stats.totalMembers}
                </span>
                <Layers className="w-5 h-5 text-slate-400" />
              </div>
            </div>

            {/* Beams */}
            <div
              onClick={() => setActiveView('member-forces')}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-blue-400 hover:shadow-xs cursor-pointer transition-all relative overflow-hidden"
            >
              <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider">BEAMS</span>
              <div className="flex items-end justify-between mt-3">
                <span className="font-mono text-2xl font-bold text-sky-600 leading-none">
                  {stats.totalBeams}
                </span>
                <span className="w-4 h-1 bg-sky-500 rounded-full mb-1.5" />
              </div>
            </div>

            {/* Columns */}
            <div
              onClick={() => setActiveView('member-forces')}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-blue-400 hover:shadow-xs cursor-pointer transition-all relative overflow-hidden"
            >
              <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider">COLUMNS</span>
              <div className="flex items-end justify-between mt-3">
                <span className="font-mono text-2xl font-bold text-emerald-600 leading-none">
                  {stats.totalColumns}
                </span>
                <span className="w-1.5 h-4 bg-emerald-500 rounded-full mb-1" />
              </div>
            </div>

            {/* Plates / Slabs */}
            <div
              onClick={() => setActiveView('3d-model')}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-blue-400 hover:shadow-xs cursor-pointer transition-all relative overflow-hidden"
            >
              <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider">PLATES</span>
              <div className="flex items-end justify-between mt-3">
                <span className="font-mono text-2xl font-bold text-indigo-600 leading-none">
                  {stats.totalPlates}
                </span>
                <Square className="w-4 h-4 text-indigo-400" />
              </div>
            </div>

            {/* Supports / Footings */}
            <div
              onClick={() => setActiveView('joint-reactions')}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-blue-400 hover:shadow-xs cursor-pointer transition-all relative overflow-hidden"
            >
              <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider">SUPPORTS</span>
              <div className="flex items-end justify-between mt-3">
                <span className="font-mono text-2xl font-bold text-slate-700 leading-none">
                  {stats.totalSupports}
                </span>
                <span className="w-3 h-3 bg-red-500 rotate-45 mb-1" />
              </div>
            </div>
          </div>

          {/* Model Health / Warnings Summary */}
          <div
            onClick={() => setActiveView('warnings')}
            className="col-span-12 lg:col-span-4 bg-surface-card/70 backdrop-blur-sm border border-ui-border rounded-lg p-4 flex flex-col justify-between shadow-sm cursor-pointer hover:border-secondary-brand/50 transition-all fx-scanlines relative overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-ui-border pb-2">
              <h3 className="font-mono text-xs font-bold text-on-surface uppercase flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Model Validation Status
              </h3>
              <span className="text-[11px] font-mono text-cyan-400 hover:underline">Details →</span>
            </div>

            <div className="space-y-2.5 my-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 fx-dot"></span>
                  <span className="text-on-surface-variant">Nodes & Members Integrity</span>
                </div>
                <span className="text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                  PASS
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-on-surface-variant">Analysis Warnings</span>
                </div>
                <span className="text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded font-bold border border-amber-500/30">
                  {warningCount} Logged
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span className="text-on-surface-variant">Critical Geometry Errors</span>
                </div>
                <span className="text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded font-bold border border-rose-500/30">
                  {criticalCount}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 flex rounded-full overflow-hidden bg-slate-800 mt-1">
              <div className="bg-emerald-500 h-full" style={{ width: '85%' }}></div>
              <div className="bg-amber-500 h-full" style={{ width: '15%' }}></div>
            </div>
          </div>
        </div>

        {/* Concrete Volume Schedule by Structure Part */}
        {concreteSummary && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden p-5 space-y-3 font-sans">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-600" />
                <h3 className="font-mono text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Concrete Volume by Structure Part (Separately Calculated)
                </h3>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="text-slate-600">Total: <strong className="text-slate-900 text-sm">{concreteSummary.grandTotalConcreteM3} m³</strong></span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-700">Substructure: <strong>{concreteSummary.substructureConcreteM3} m³ ({concreteSummary.substructurePercent}%)</strong></span>
                <span className="text-slate-400">•</span>
                <span className="text-sky-700">Superstructure: <strong>{concreteSummary.superstructureConcreteM3} m³ ({concreteSummary.superstructurePercent}%)</strong></span>
                <button
                  type="button"
                  onClick={() => setActiveView('reports')}
                  className="text-blue-600 hover:underline font-semibold ml-2"
                >
                  Full BOQ Report →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {concreteSummary.components.map((comp) => (
                <div
                  key={comp.id}
                  onClick={() => {
                    if (comp.id === 'columns') setActiveView('columns-design');
                    else if (comp.id === 'beams') setActiveView('beams-design');
                    else if (comp.id === 'slabs') setActiveView('slabs-design');
                    else if (comp.id === 'staircases') setActiveView('staircase-design');
                    else if (comp.id === 'shearwalls') setActiveView('shearwalls-design');
                    else if (comp.id === 'gradebeams') setActiveView('gradebeams-design');
                    else if (comp.id === 'pilecaps') setActiveView('pilecaps-design');
                    else if (comp.id === 'piles') setActiveView('piles-design');
                    else if (comp.id === 'footings') setActiveView('footings-design');
                    else setActiveView('reports');
                  }}
                  className="bg-white hover:bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-2xs transition-all cursor-pointer flex flex-col justify-between"
                  title={`Click to open ${comp.component} Design`}
                >
                  <div>
                    <span className="font-mono text-[11px] font-bold text-slate-800 block truncate">
                      {comp.component}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 block">
                      {comp.count} elements
                    </span>
                  </div>

                  <div className="mt-2 font-mono">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-bold text-sky-700">{comp.concreteM3} m³</span>
                      <span className="text-[10px] font-semibold text-slate-500">{comp.percentageShare}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full ${comp.category === 'SUPERSTRUCTURE' ? 'bg-sky-600' : 'bg-amber-600'}`}
                        style={{ width: `${Math.min(100, comp.percentageShare)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Access to Key Modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => setActiveView('3d-model')}
            className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-xs transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  3D Model Space
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Orbit, inspect members, toggle layers
                </p>
              </div>
            </div>
          </div>

          <div
            onClick={() => setActiveView('member-forces')}
            className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-xs transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                  Member Forces
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Axial Pu, shear Vy, bending moments
                </p>
              </div>
            </div>
          </div>

          <div
            onClick={() => setActiveView('warnings')}
            className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-xs transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                  Model Integrity Warnings
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Zero-length members, duplicate nodes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="bg-surface-card border border-ui-border rounded-md shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-ui-border flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold text-deep-navy uppercase">
              LOCAL PROJECTS ({projects.length})
            </h3>
            {projects.length > 1 && (
              <button
                type="button"
                onClick={() => setIsClearingInactive(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-rose-600 hover:text-rose-700 bg-rose-50/60 hover:bg-rose-100/80 rounded border border-rose-200 transition-colors shadow-sm"
                title="Delete all project copies except the currently active one"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Inactive ({projects.length - 1})</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-ui-border">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">
                No local projects found. Click &quot;Import ANL&quot; above to load a STAAD model.
              </div>
            ) : (
              projects.map((prj) => {
                const isCurrent = prj.metadata.id === activeProject?.metadata.id;
                return (
                  <div
                    key={prj.metadata.id}
                    onClick={() => openProject(prj.metadata.id)}
                    className={`p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group ${
                      isCurrent ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="space-y-1 flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-deep-navy group-hover:text-secondary-brand transition-colors">
                          {prj.metadata.name}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 bg-secondary-brand text-white rounded text-[10px] font-mono">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {prj.metadata.code} • {prj.metadata.location} • File: {prj.metadata.anlFileName || 'STD 6MILES.ANL'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
                      <div className="hidden sm:flex items-center gap-2">
                        <span>{prj.model.nodes.length} Nodes</span>
                        <span>•</span>
                        <span>{prj.model.members.length} Members</span>
                      </div>

                      {/* Share Project Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(prj);
                        }}
                        disabled={sharingProjectId === prj.metadata.id}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded border border-transparent hover:border-indigo-200 transition-all disabled:opacity-50"
                        title={`Share "${prj.metadata.name}" via link`}
                      >
                        {shareLinkCopied === prj.metadata.id ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Share2 className="w-4 h-4" />
                        )}
                      </button>

                      {/* Delete Project Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete({ id: prj.metadata.id, name: prj.metadata.name });
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200 transition-all"
                        title={`Delete "${prj.metadata.name}"`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Delete Single Project Confirmation Modal */}
        {projectToDelete && (
          <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-card w-full max-w-md rounded-lg border border-ui-border shadow-2xl overflow-hidden p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-600 rounded-full flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-mono text-sm font-bold text-deep-navy">Delete Project</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Are you sure you want to permanently delete <strong className="text-slate-900">{projectToDelete.name}</strong> from local storage?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-ui-border">
                <button
                  type="button"
                  onClick={() => setProjectToDelete(null)}
                  className="px-3 py-1.5 text-xs font-mono text-slate-600 hover:bg-slate-100 rounded border border-ui-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteProject(projectToDelete.id);
                    setProjectToDelete(null);
                  }}
                  className="px-3 py-1.5 text-xs font-mono font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Project</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear All Inactive Confirmation Modal */}
        {isClearingInactive && (
          <div className="fixed inset-0 bg-deep-navy/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-card w-full max-w-md rounded-lg border border-ui-border shadow-2xl overflow-hidden p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-rose-100 text-rose-600 rounded-full flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-mono text-sm font-bold text-deep-navy">Delete All Inactive Projects</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    This will delete all <strong className="text-slate-900">{projects.length - 1} inactive projects</strong> from local storage, keeping only your currently active project (<strong className="text-slate-900">{activeProject?.metadata.name}</strong>).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-ui-border">
                <button
                  type="button"
                  onClick={() => setIsClearingInactive(false)}
                  className="px-3 py-1.5 text-xs font-mono text-slate-600 hover:bg-slate-100 rounded border border-ui-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteInactiveProjects();
                    setIsClearingInactive(false);
                  }}
                  className="px-3 py-1.5 text-xs font-mono font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete All Inactive</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1-Click Global Auto-Fix & Rebar Optimizer Modal */}
        <GlobalAutoDesignModal
          summary={globalSummary}
          isOpen={globalSummary !== null}
          onClose={() => setGlobalSummary(null)}
          onConfirmApply={handleConfirmApplyAutoFix}
          isApplying={isApplyingAutoFix}
        />
      </div>
    </div>
  );
};
