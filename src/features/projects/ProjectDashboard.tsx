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
} from 'lucide-react';

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

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-ui-background font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Project Status & Actions Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-slate-200 text-deep-navy font-mono text-xs rounded font-semibold border border-ui-border">
                {activeProject?.metadata.code || 'PRJ-2026-04A'}
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-white font-mono text-[11px] rounded">
                STAAD Model Loaded
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 font-mono text-[11px] rounded border border-blue-200">
                Phase 1 Active
              </span>
            </div>
            <h1 className="text-xl font-headline font-bold text-deep-navy">
              {activeProject?.metadata.name || 'G+4 RCC Residential Building'}
            </h1>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Engineer: {activeProject?.metadata.engineer || 'Lead Engineer'} • Location:{' '}
              {activeProject?.metadata.location || 'Sector 12, Phase II'} • Last updated: Today
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-ui-border hover:bg-slate-50 text-slate-800 font-mono text-xs font-semibold rounded shadow-sm transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              Import ANL
            </button>

            {activeProject && (
              <button
                onClick={() => handleShare(activeProject)}
                disabled={sharingProjectId === activeProject.metadata.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-mono text-xs font-semibold rounded shadow-sm transition-colors disabled:opacity-50"
                title="Copy share link to clipboard"
              >
                {shareLinkCopied === activeProject.metadata.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
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
              className="flex items-center gap-1.5 px-4 py-1.5 bg-secondary-brand hover:bg-blue-700 text-white font-mono text-xs font-semibold rounded shadow transition-colors"
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
              className="bg-surface-card border border-ui-border rounded-md p-3.5 flex flex-col justify-between hover:border-slate-400 cursor-pointer transition-all shadow-sm"
            >
              <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase">ELEMENTS</span>
              <div className="flex items-end justify-between mt-3">
                <span className="font-mono text-2xl font-bold text-deep-navy leading-none">
                  {stats.totalMembers}
                </span>
                <Layers className="w-5 h-5 text-slate-400" />
              </div>
            </div>

            {/* Beams */}
            <div
              onClick={() => setActiveView('member-forces')}
              className="bg-surface-card border border-ui-border rounded-md p-3.5 flex flex-col justify-between hover:border-slate-400 cursor-pointer transition-all shadow-sm"
            >
              <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase">BEAMS</span>
              <div className="flex items-end justify-between mt-3">
                <span className="font-mono text-2xl font-bold text-sky-700 leading-none">
                  {stats.totalBeams}
                </span>
                <span className="w-4 h-1 bg-sky-500 rounded-full mb-1.5" />
              </div>
            </div>

            {/* Columns */}
            <div
              onClick={() => setActiveView('member-forces')}
              className="bg-surface-card border border-ui-border rounded-md p-3.5 flex flex-col justify-between hover:border-slate-400 cursor-pointer transition-all shadow-sm"
            >
              <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase">COLUMNS</span>
              <div className="flex items-end justify-between mt-3">
                <span className="font-mono text-2xl font-bold text-emerald-700 leading-none">
                  {stats.totalColumns}
                </span>
                <span className="w-1.5 h-4 bg-emerald-500 rounded-full mb-1" />
              </div>
            </div>

            {/* Plates / Slabs */}
            <div
              onClick={() => setActiveView('3d-model')}
              className="bg-surface-card border border-ui-border rounded-md p-3.5 flex flex-col justify-between hover:border-slate-400 cursor-pointer transition-all shadow-sm"
            >
              <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase">PLATES</span>
              <div className="flex items-end justify-between mt-3">
                <span className="font-mono text-2xl font-bold text-indigo-700 leading-none">
                  {stats.totalPlates}
                </span>
                <Square className="w-4 h-4 text-indigo-400" />
              </div>
            </div>

            {/* Supports / Footings */}
            <div
              onClick={() => setActiveView('joint-reactions')}
              className="bg-surface-card border border-ui-border rounded-md p-3.5 flex flex-col justify-between hover:border-slate-400 cursor-pointer transition-all shadow-sm"
            >
              <span className="font-mono text-[11px] font-semibold text-slate-500 uppercase">SUPPORTS</span>
              <div className="flex items-end justify-between mt-3">
                <span className="font-mono text-2xl font-bold text-red-700 leading-none">
                  {stats.totalSupports}
                </span>
                <span className="w-3 h-3 bg-red-500 rotate-45 mb-1" />
              </div>
            </div>
          </div>

          {/* Model Health / Warnings Summary */}
          <div
            onClick={() => setActiveView('warnings')}
            className="col-span-12 lg:col-span-4 bg-surface-card border border-ui-border rounded-md p-4 flex flex-col justify-between shadow-sm cursor-pointer hover:border-slate-400 transition-all"
          >
            <div className="flex items-center justify-between border-b border-ui-border pb-2">
              <h3 className="font-mono text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Model Validation Status
              </h3>
              <span className="text-[11px] font-mono text-secondary-brand hover:underline">Details →</span>
            </div>

            <div className="space-y-2.5 my-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-700">Nodes & Members Integrity</span>
                </div>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                  PASS
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="text-slate-700">Analysis Warnings</span>
                </div>
                <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-200">
                  {warningCount} Logged
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-slate-700">Critical Geometry Errors</span>
                </div>
                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-bold border border-slate-200">
                  {criticalCount}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 flex rounded-full overflow-hidden bg-slate-200 mt-1">
              <div className="bg-emerald-600 h-full" style={{ width: '85%' }}></div>
              <div className="bg-amber-500 h-full" style={{ width: '15%' }}></div>
            </div>
          </div>
        </div>

        {/* Quick Access to Key Modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => setActiveView('3d-model')}
            className="p-4 bg-surface-card border border-ui-border rounded-md hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 text-secondary-brand rounded group-hover:bg-secondary-brand group-hover:text-white transition-colors">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-mono text-sm font-bold text-deep-navy">3D Model Space</h4>
                <p className="text-xs text-slate-500">Orbit, inspect members, toggle layers</p>
              </div>
            </div>
          </div>

          <div
            onClick={() => setActiveView('member-forces')}
            className="p-4 bg-surface-card border border-ui-border rounded-md hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-100 text-sky-700 rounded group-hover:bg-sky-700 group-hover:text-white transition-colors">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-mono text-sm font-bold text-deep-navy">Member Forces</h4>
                <p className="text-xs text-slate-500">Axial Pu, shear Vy, bending moment Mz</p>
              </div>
            </div>
          </div>

          <div
            onClick={() => setActiveView('joint-reactions')}
            className="p-4 bg-surface-card border border-ui-border rounded-md hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded group-hover:bg-red-700 group-hover:text-white transition-colors">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-mono text-sm font-bold text-deep-navy">Support Reactions</h4>
                <p className="text-xs text-slate-500">Vertical loads, pile demands & moments</p>
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
