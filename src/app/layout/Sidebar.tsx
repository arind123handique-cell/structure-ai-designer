import React, { useState, useEffect, useMemo } from 'react';
import { useProjectStore, ViewTab } from '@/features/projects/projectStore';
import {
  Box,
  FileSpreadsheet,
  LayoutDashboard,
  Building,
  Layers,
  Settings,
  ShieldAlert,
  Upload,
  Compass,
  FileText,
  Workflow,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  Grid,
  Layout,
  Footprints,
  Sparkles,
  Sun,
  Moon,
  UserCog,
  Database,
  Columns2,
  GitCompare,
  Map,
  DoorOpen,
  PenTool,
  ChevronsUpDown,
} from 'lucide-react';
import { cyberAudio } from '@/features/video/audio/cyberAudioSynthesizer';
import { useVideoStore } from '@/features/video/videoStore';
import { useThemeStore } from '@/features/theme/themeStore';
import { useWindowStore } from '@/components/window/WindowStore';
import { useAuth } from '@/lib/firebase/AuthContext';
import { useUserProfileStore } from '@/features/auth/userProfileStore';
import { PipelineStepper } from '@/components/pipeline/PipelineStepper';
import { PIPELINE_STAGES, getStageForView } from '@/features/pipeline/pipelineStages';

interface SidebarProps {
  onHide?: () => void;
}

interface NavItem {
  label: string;
  view: ViewTab;
  icon: React.FC<{ className?: string }>;
  badge?: string;
  stageId?: string;
}

interface StageSection {
  id: string;
  stageIndex: number;
  stageId: string;
  title: string;
  shortTitle: string;
  badge?: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({ onHide }) => {
  const activeView = useProjectStore(s => s.activeView);
  const setActiveView = useProjectStore(s => s.setActiveView);
  const setImportModalOpen = useProjectStore(s => s.setImportModalOpen);
  const setRcdxImportModalOpen = useProjectStore(s => s.setRcdxImportModalOpen);
  const warningsCount = useProjectStore(s => s.activeProject?.warnings.length ?? 0);
  const engineerName = useProjectStore(s => s.activeProject?.metadata.engineer);
  const isStreamActive = useVideoStore(s => s.isStreamActive);
  const pipelineStageId = useProjectStore(s => s.pipelineStageId);
  const setPipelineStageId = useProjectStore(s => s.setPipelineStageId);

  const theme = useThemeStore(s => s.theme);
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  const openWindow = useWindowStore(s => s.openWindow);
  const { user } = useAuth();
  const profile = useUserProfileStore();

  // Navigation mode: 'stage' (focus on current stage tabs) | 'all' (show all stages in accordion)
  const [navMode, setNavMode] = useState<'stage' | 'all'>(() => {
    try {
      return (localStorage.getItem('sidebar:navMode') as 'stage' | 'all') || 'stage';
    } catch {
      return 'stage';
    }
  });

  // Independent accordion state for 'all' mode
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sidebar:openSections');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { 'stage-1': true, 'stage-3': true, 'stage-4': true };
  });

  useEffect(() => {
    try {
      localStorage.setItem('sidebar:navMode', navMode);
    } catch {}
  }, [navMode]);

  useEffect(() => {
    try {
      localStorage.setItem('sidebar:openSections', JSON.stringify(openSections));
    } catch {}
  }, [openSections]);

  const handleNavClick = (view: ViewTab, stageId?: string) => {
    cyberAudio.playSelectChirp();
    if (stageId) {
      setPipelineStageId(stageId);
    }
    setActiveView(view);
  };

  // Stage sections definition mapped directly to the 6-stage engineering pipeline
  const stageSections: StageSection[] = useMemo(() => [
    {
      id: 'stage-1',
      stageIndex: 1,
      stageId: 'plot',
      title: 'STAGE 1 · PLOT & SITE',
      shortTitle: 'Plot & Site',
      items: [
        { label: 'Plot & Site Area', view: 'plot-area', icon: Map, stageId: 'plot' },
        { label: 'Site + 3D Model', view: 'site-3d', icon: Columns2, badge: 'SPLIT', stageId: 'plot' },
      ],
    },
    {
      id: 'stage-2',
      stageIndex: 2,
      stageId: 'architectural',
      title: 'STAGE 2 · ARCHITECTURAL',
      shortTitle: 'Architectural Plan',
      items: [
        { label: 'Architectural Plan', view: 'architectural-plan', icon: PenTool, stageId: 'architectural' },
      ],
    },
    {
      id: 'stage-3',
      stageIndex: 3,
      stageId: 'model-analysis',
      title: 'STAGE 3 · MODEL & ANALYSIS',
      shortTitle: 'Model & Analysis',
      items: [
        { label: 'Manual Structural Analysis', view: 'etabs-studio', icon: Sparkles, badge: 'SA', stageId: 'model-analysis' },
        { label: '3D Structural Model', view: '3d-model', icon: Box, badge: isStreamActive ? 'AR LIVE' : undefined, stageId: 'model-analysis' },
        { label: 'Member Forces', view: 'member-forces', icon: FileSpreadsheet, stageId: 'model-analysis' },
        { label: 'Analysis Review', view: 'analysis-review', icon: GitCompare, badge: 'NEW', stageId: 'model-analysis' },
        { label: 'Support Reactions', view: 'joint-reactions', icon: Building, stageId: 'model-analysis' },
        { label: 'Load Cases & Comb.', view: 'load-cases', icon: Workflow, stageId: 'model-analysis' },
        { label: 'Elements & Building Details', view: 'elements', icon: Layers, stageId: 'model-analysis' },
        { label: 'Model Warnings', view: 'warnings', icon: ShieldAlert, badge: warningsCount ? String(warningsCount) : undefined, stageId: 'model-analysis' },
      ],
    },
    {
      id: 'stage-4',
      stageIndex: 4,
      stageId: 'design',
      title: 'STAGE 4 · IS CODE DESIGN',
      shortTitle: 'Design (IS 456)',
      badge: 'IS 456',
      items: [
        { label: 'Beam Design', view: 'beams-design', icon: Compass, stageId: 'design' },
        { label: 'Column Design', view: 'columns-design', icon: Layers, stageId: 'design' },
        { label: 'Pile Design', view: 'piles-design', icon: Building, stageId: 'design' },
        { label: 'Pile Cap Design', view: 'pilecaps-design', icon: Box, stageId: 'design' },
        { label: 'Slab Design', view: 'slabs-design', icon: Grid, stageId: 'design' },
        { label: 'Staircase Design', view: 'staircase-design', icon: Footprints, stageId: 'design' },
        { label: 'Shear Wall Design', view: 'shearwalls-design', icon: Layout, stageId: 'design' },
        { label: 'Grade Beam Design', view: 'gradebeams-design', icon: Compass, stageId: 'design' },
        { label: 'Footing Design', view: 'footings-design', icon: Building, stageId: 'design' },
        { label: 'RCDC Design Results', view: 'rcdc-design', icon: Database, stageId: 'design' },
      ],
    },
    {
      id: 'stage-5',
      stageIndex: 5,
      stageId: 'detailing',
      title: 'STAGE 5 · DETAILING',
      shortTitle: 'Detailing',
      items: [
        { label: 'Walls, Doors & Windows', view: 'architectural-plan', icon: DoorOpen, stageId: 'detailing' },
      ],
    },
    {
      id: 'stage-6',
      stageIndex: 6,
      stageId: 'outputs',
      title: 'STAGE 6 · DRAWINGS & OUTPUTS',
      shortTitle: 'Outputs & Reports',
      items: [
        { label: '2D Structural GA Plans', view: 'floor-plans', icon: Layers, stageId: 'outputs' },
        { label: 'CAD Drawing Sheets + BBS', view: 'drawings', icon: FileText, stageId: 'outputs' },
        { label: 'Reports & BOQ Export', view: 'reports', icon: FileSpreadsheet, stageId: 'outputs' },
      ],
    },
  ], [isStreamActive, warningsCount]);

  // Determine which stage is currently active
  const activeStage = useMemo(() => {
    if (pipelineStageId) {
      const found = stageSections.find(s => s.stageId === pipelineStageId);
      if (found) return found;
    }
    const stageInfo = getStageForView(activeView);
    if (stageInfo) {
      const found = stageSections.find(s => s.stageId === stageInfo.id);
      if (found) return found;
    }
    return stageSections[2]; // Default to Stage 3 (Model & Analysis)
  }, [pipelineStageId, activeView, stageSections]);

  // Auto-expand the active stage in 'all' mode
  useEffect(() => {
    if (activeStage) {
      setOpenSections(prev => {
        if (prev[activeStage.id]) return prev;
        return { ...prev, [activeStage.id]: true };
      });
    }
  }, [activeStage]);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleAllSections = () => {
    const allOpen = stageSections.every(s => openSections[s.id]);
    const newState: Record<string, boolean> = {};
    stageSections.forEach(s => {
      newState[s.id] = !allOpen;
    });
    setOpenSections(newState);
  };

  const renderNavList = (items: NavItem[], isDesignStage?: boolean) => (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        // In detailing vs architectural, check both view and stageId
        const isActive = activeView === item.view && (!item.stageId || pipelineStageId === item.stageId || (!pipelineStageId && activeStage.stageId === item.stageId));
        return (
          <li key={`${item.stageId || ''}-${item.view}-${item.label}`}>
            <button
              onClick={() => handleNavClick(item.view, item.stageId)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all font-mono text-[11.5px] group ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge ? (
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${
                  item.badge === 'AR LIVE' || item.badge === 'NEW' || item.badge === 'SPLIT' || item.badge === 'SA'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {item.badge}
                </span>
              ) : isDesignStage ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] shrink-0" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="w-64 bg-[#0B132B] border-r border-slate-800 flex flex-col h-screen text-slate-300 font-sans z-30 select-none relative shadow-xs">
      {/* Brand Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-sans text-xs font-bold text-white tracking-tight leading-tight truncate">
              StructureAI
            </h1>
            <p className="font-mono text-[9px] text-slate-400 tracking-wider truncate">V2.4 Enterprise • STAAD</p>
          </div>
        </div>
        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors shrink-0"
            title="Hide Navigation Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Primary Actions: Compact 2-Column Grid */}
      <div className="px-3 pt-2 pb-1.5 grid grid-cols-2 gap-1.5 shrink-0">
        <button
          onClick={() => setImportModalOpen(true)}
          className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-[11px] font-semibold py-1.5 px-2 rounded-md shadow-xs transition-all active:scale-95"
          title="Import STAAD / ANL File"
        >
          <Upload className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">.ANL / .STD</span>
        </button>
        <button
          onClick={() => setRcdxImportModalOpen(true)}
          className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[11px] font-semibold py-1.5 px-2 rounded-md shadow-xs transition-all active:scale-95"
          title="Import RCDC / RCDX Design File"
        >
          <Database className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">.RCDX</span>
        </button>
      </div>

      {/* Project Dashboard Trigger */}
      <div className="px-3 pb-1.5 shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick('dashboard')}
          className={`w-full flex items-center gap-2 px-2.5 py-1 rounded-md transition-all font-mono text-[11px] font-semibold border ${
            activeView === 'dashboard'
              ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 border-slate-700/80 hover:text-white'
          }`}
          title="Project Dashboard & Recent Projects"
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="truncate">Project Dashboard</span>
        </button>
      </div>

      {/* Guided Pipeline Stepper */}
      <div className="px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/40 shrink-0">
        <PipelineStepper />
      </div>

      {/* Navigation Mode Switcher: Focus Stage vs All Stages */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/60 bg-[#080e22] text-[10px] font-mono shrink-0">
        <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded border border-slate-800">
          <button
            type="button"
            onClick={() => {
              cyberAudio.playSelectChirp();
              setNavMode('stage');
            }}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              navMode === 'stage'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Show tabs for the active stage (fits completely on screen)"
          >
            Active Stage
          </button>
          <button
            type="button"
            onClick={() => {
              cyberAudio.playSelectChirp();
              setNavMode('all');
            }}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              navMode === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Show all pipeline stages with collapsible sections"
          >
            All Stages
          </button>
        </div>

        {navMode === 'all' && (
          <button
            type="button"
            onClick={toggleAllSections}
            className="text-[9.5px] text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-0.5"
            title="Expand or collapse all sections"
          >
            <ChevronsUpDown className="w-3 h-3" />
            <span>Toggle</span>
          </button>
        )}

        {navMode === 'stage' && (
          <span className="text-[9px] text-emerald-400 font-semibold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
            S{activeStage.stageIndex} of 6
          </span>
        )}
      </div>

      {/* Navigation Scrollable Body */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2.5 py-2 space-y-3 text-xs scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {navMode === 'stage' ? (
          /* FOCUS MODE: Shows only the active stage's tabs so 100% are visible */
          <div>
            <div className="flex items-center justify-between px-1.5 mb-1.5">
              <span className="font-mono text-[10px] text-slate-400 uppercase font-semibold tracking-wider truncate">
                {activeStage.title}
              </span>
              {activeStage.badge && (
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60 font-semibold shrink-0">
                  {activeStage.badge}
                </span>
              )}
            </div>
            {renderNavList(activeStage.items, activeStage.stageId === 'design')}
          </div>
        ) : (
          /* ALL STAGES MODE: Independent accordion sections that auto-expand active stage */
          stageSections.map((section) => {
            const isOpen = Boolean(openSections[section.id]);
            const isCurrent = section.id === activeStage.id;
            return (
              <div key={section.id} className="border-b border-slate-800/50 pb-2 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-1.5 py-1 rounded hover:bg-slate-800/60 transition-colors text-left group"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isOpen ? (
                      <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-white shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0" />
                    )}
                    <span className={`font-mono text-[10px] uppercase font-semibold tracking-wider truncate ${
                      isCurrent ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}>
                      {section.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {section.badge && (
                      <span className="text-[8.5px] font-mono text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-800/50">
                        {section.badge}
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-slate-500">
                      ({section.items.length})
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-1 pl-1">
                    {renderNavList(section.items, section.stageId === 'design')}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Settings, Telemetry & User */}
      <div className="p-2.5 border-t border-slate-800 bg-[#080d1e] space-y-1.5 shrink-0">
        {/* Cyber Telemetry Status Bar */}
        <div className="px-2 py-1 rounded bg-slate-900/90 border border-slate-800 font-mono text-[9.5px] flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </span>
          <span className="text-cyan-400 font-bold">{isStreamActive ? 'AR LIVE' : 'SYNCED'}</span>
          <span className="text-slate-500">60 FPS</span>
        </div>

        {/* User Profile & Quick Actions */}
        <div className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
          <div
            onClick={() => {
              cyberAudio.playSelectChirp();
              openWindow('userSettings');
            }}
            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer group"
            title="Click to open User Settings & Profile"
          >
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-mono text-[10px] font-bold border border-blue-500 shrink-0">
              {profile.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'ER'}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-mono text-[11px] text-white truncate group-hover:text-blue-400 transition-colors leading-tight">
                {profile.displayName || engineerName || user?.email?.split('@')[0] || 'Structural Eng.'}
              </span>
              <span className="text-[9px] text-slate-400 font-mono truncate leading-tight">
                {profile.designation || 'Lead Engineer'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => handleNavClick('settings')}
              className={`p-1.5 rounded hover:bg-slate-800 transition-colors ${
                activeView === 'settings' ? 'text-blue-400 bg-slate-800' : 'text-slate-400 hover:text-white'
              }`}
              title="Project Design Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                cyberAudio.playSelectChirp();
                openWindow('userSettings');
              }}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="User Account & Profile Settings"
            >
              <UserCog className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
});
Sidebar.displayName = 'Sidebar';
