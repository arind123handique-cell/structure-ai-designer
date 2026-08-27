import React, { useState } from 'react';
import { useProjectStore, ViewTab } from '@/features/projects/projectStore';
import {
  LayoutDashboard,
  Box,
  FileSpreadsheet,
  Building,
  Layers,
  Settings,
  ShieldAlert,
  Upload,
  Compass,
  FileText,
  Workflow,
  EyeOff,
  Eye,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  Grid,
  Layout,
} from 'lucide-react';

interface SidebarProps {
  onHide?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({ onHide }) => {
  const activeView = useProjectStore(s => s.activeView);
  const setActiveView = useProjectStore(s => s.setActiveView);
  const setImportModalOpen = useProjectStore(s => s.setImportModalOpen);
  const warningsCount = useProjectStore(s => s.activeProject?.warnings.length ?? 0);
  const engineerName = useProjectStore(s => s.activeProject?.metadata.engineer);

  // Collapsible navigation sections (persisted)
  const [analysisOpen, setAnalysisOpen] = useState(() => {
    try { return localStorage.getItem('sidebar:analysisOpen') !== '0'; } catch { return true; }
  });
  const [isCodeOpen, setIsCodeOpen] = useState(() => {
    try { return localStorage.getItem('sidebar:isCodeOpen') !== '0'; } catch { return true; }
  });
  // Sync to localStorage
  React.useEffect(() => { try { localStorage.setItem('sidebar:analysisOpen', analysisOpen ? '1' : '0'); } catch {} }, [analysisOpen]);
  React.useEffect(() => { try { localStorage.setItem('sidebar:isCodeOpen', isCodeOpen ? '1' : '0'); } catch {} }, [isCodeOpen]);

  const navItems: { label: string; view: ViewTab; icon: React.FC<{ className?: string }>; badge?: string; isPhase2?: boolean }[] = [
    { label: 'Project Dashboard', view: 'dashboard', icon: LayoutDashboard },
    { label: '3D Structural Model', view: '3d-model', icon: Box },
    { label: 'Member Forces', view: 'member-forces', icon: FileSpreadsheet },
    { label: 'Support Reactions', view: 'joint-reactions', icon: Building },
    { label: 'Load Cases & Comb.', view: 'load-cases', icon: Workflow },
    { label: 'Elements & Building Details', view: 'elements', icon: Layers },
    { label: 'Model Warnings', view: 'warnings', icon: ShieldAlert, badge: warningsCount ? String(warningsCount) : undefined },
  ];

  const phase2Items: { label: string; view: ViewTab; icon: React.FC<{ className?: string }> }[] = [
    { label: 'Beam Design', view: 'beams-design', icon: Compass },
    { label: 'Column Design', view: 'columns-design', icon: Layers },
    { label: 'Pile Design', view: 'piles-design', icon: Building },
    { label: 'Pile Cap Design', view: 'pilecaps-design', icon: Box },
    { label: 'Grade Beam Design', view: 'gradebeams-design', icon: Compass },
    { label: 'Footing Design', view: 'footings-design', icon: Building },
    { label: 'Slab Design', view: 'slabs-design', icon: Grid },
    { label: '2D Architectural Plan', view: 'architectural-plan', icon: Layout },
    { label: '2D Structural GA Plans', view: 'floor-plans', icon: Layers },
    { label: 'CAD Drawing Sheets', view: 'drawings', icon: FileText },
    { label: 'Reports & BOQ Export', view: 'reports', icon: FileSpreadsheet },
  ];

  return (
    <aside className="w-64 bg-deep-navy border-r border-slate-800 flex flex-col h-screen text-slate-300 font-sans z-30 select-none">
      {/* Brand Header with hide */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-secondary-brand flex items-center justify-center text-white shadow-md">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-mono text-sm font-bold text-white tracking-tight leading-tight">
              StructureAI
            </h1>
            <p className="font-mono text-[10px] text-slate-400">V2.4 Enterprise • STAAD</p>
          </div>
        </div>
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
            title="Hide Navigation Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Primary CTA */}
      <div className="p-3">
        <button
          onClick={() => setImportModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-secondary-container hover:bg-secondary-brand text-white transition-all py-2 px-3 rounded text-xs font-mono font-semibold shadow-sm active:scale-95"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import .ANL / .STD</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5 text-xs">
        {/* Section 1: Analysis & Model — hideable */}
        <div>
          <div className="flex items-center justify-between px-2">
            <span className="font-mono text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
              Analysis & Geometry
            </span>
            <button
              type="button"
              onClick={() => setAnalysisOpen(!analysisOpen)}
              className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200 transition-colors flex items-center gap-1"
              title={analysisOpen ? 'Hide section' : 'Show section'}
            >
              {analysisOpen ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {analysisOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {analysisOpen && (
            <ul className="mt-1.5 space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.view;
                return (
                  <li key={item.view}>
                    <button
                      onClick={() => setActiveView(item.view)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-all font-mono text-[12px] ${
                        isActive
                          ? 'bg-secondary-brand text-white font-semibold border-l-2 border-white'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold border border-amber-500/30">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Section 2: IS Code Design Modules (Phase 2) — hideable */}
        <div>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                IS Code Design
              </span>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-800/60 font-semibold">
                IS 456 / IS 13920
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCodeOpen(!isCodeOpen)}
              className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200 transition-colors flex items-center gap-1"
              title={isCodeOpen ? 'Hide section' : 'Show section'}
            >
              {isCodeOpen ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {isCodeOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {isCodeOpen && (
            <ul className="mt-1.5 space-y-0.5">
              {phase2Items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.view;
                const isImplemented = true;
                return (
                  <li key={item.view}>
                    <button
                      onClick={() => setActiveView(item.view)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-all font-mono text-[12px] ${
                        isActive
                          ? 'bg-secondary-brand text-white font-semibold border-l-2 border-white'
                          : isImplemented
                          ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                          : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {isImplemented && !isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom Settings & User */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        <button
          onClick={() => setActiveView('settings')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded font-mono text-[12px] transition-colors ${
            activeView === 'settings'
              ? 'bg-secondary-brand text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Design Settings</span>
        </button>

        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded bg-slate-900/80 border border-slate-800">
          <div className="w-7 h-7 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-mono text-xs font-bold border border-slate-600">
            ER
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono text-xs text-white truncate">
              {engineerName || 'Er. E. Rogers'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Lead Struct. Eng</span>
          </div>
        </div>
      </div>
    </aside>
  );
});
Sidebar.displayName = 'Sidebar';
