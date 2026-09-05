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
  Footprints,
  Sparkles,
  FolderPlus,
  Radio,
  Sun,
  Moon,
  UserCog,
} from 'lucide-react';
import { cyberAudio } from '@/features/video/audio/cyberAudioSynthesizer';
import { useVideoStore } from '@/features/video/videoStore';
import { useThemeStore } from '@/features/theme/themeStore';
import { useWindowStore } from '@/components/window/WindowStore';
import { useAuth } from '@/lib/firebase/AuthContext';
import { useUserProfileStore } from '@/features/auth/userProfileStore';

interface SidebarProps {
  onHide?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({ onHide }) => {
  const activeView = useProjectStore(s => s.activeView);
  const setActiveView = useProjectStore(s => s.setActiveView);
  const setImportModalOpen = useProjectStore(s => s.setImportModalOpen);
  const setNewProjectModalOpen = useProjectStore(s => s.setNewProjectModalOpen);
  const warningsCount = useProjectStore(s => s.activeProject?.warnings.length ?? 0);
  const engineerName = useProjectStore(s => s.activeProject?.metadata.engineer);
  const isStreamActive = useVideoStore(s => s.isStreamActive);

  const theme = useThemeStore(s => s.theme);
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  const openWindow = useWindowStore(s => s.openWindow);
  const { user } = useAuth();
  const profile = useUserProfileStore();

  // Collapsible navigation sections (persisted)
  const [analysisOpen, setAnalysisOpen] = useState(() => {
    try { return localStorage.getItem('sidebar:analysisOpen') !== '0'; } catch { return true; }
  });
  const [isCodeOpen, setIsCodeOpen] = useState(() => {
    try { return localStorage.getItem('sidebar:isCodeOpen') !== '0'; } catch { return true; }
  });
  const [outputsOpen, setOutputsOpen] = useState(() => {
    try { return localStorage.getItem('sidebar:outputsOpen') !== '0'; } catch { return true; }
  });
  // Sync to localStorage
  React.useEffect(() => { try { localStorage.setItem('sidebar:analysisOpen', analysisOpen ? '1' : '0'); } catch {} }, [analysisOpen]);
  React.useEffect(() => { try { localStorage.setItem('sidebar:isCodeOpen', isCodeOpen ? '1' : '0'); } catch {} }, [isCodeOpen]);
  React.useEffect(() => { try { localStorage.setItem('sidebar:outputsOpen', outputsOpen ? '1' : '0'); } catch {} }, [outputsOpen]);

  const handleNavClick = (view: ViewTab) => {
    cyberAudio.playSelectChirp();
    setActiveView(view);
  };

  const navItems: { label: string; view: ViewTab; icon: React.FC<{ className?: string }>; badge?: string; isPhase2?: boolean }[] = [
    { label: 'Project Dashboard', view: 'dashboard', icon: LayoutDashboard },
    { label: '3D Structural Model', view: '3d-model', icon: Box, badge: isStreamActive ? 'AR LIVE' : undefined },
    { label: 'Member Forces', view: 'member-forces', icon: FileSpreadsheet },
    { label: 'Support Reactions', view: 'joint-reactions', icon: Building },
    { label: 'Load Cases & Comb.', view: 'load-cases', icon: Workflow },
    { label: 'Elements & Building Details', view: 'elements', icon: Layers },
    { label: 'Model Warnings', view: 'warnings', icon: ShieldAlert, badge: warningsCount ? String(warningsCount) : undefined },
    { label: 'Manual Structural Analysis', view: 'etabs-studio', icon: Sparkles, badge: 'SA' },
  ];

  const phase2Items: { label: string; view: ViewTab; icon: React.FC<{ className?: string }> }[] = [
    { label: 'Beam Design', view: 'beams-design', icon: Compass },
    { label: 'Column Design', view: 'columns-design', icon: Layers },
    { label: 'Pile Design', view: 'piles-design', icon: Building },
    { label: 'Pile Cap Design', view: 'pilecaps-design', icon: Box },
    { label: 'Slab Design', view: 'slabs-design', icon: Grid },
    { label: 'Staircase Design', view: 'staircase-design', icon: Footprints },
    { label: 'Shear Wall Design', view: 'shearwalls-design', icon: Layout },
    { label: 'Grade Beam Design', view: 'gradebeams-design', icon: Compass },
    { label: 'Footing Design', view: 'footings-design', icon: Building },
  ];

  const outputItems: { label: string; view: ViewTab; icon: React.FC<{ className?: string }> }[] = [
    { label: '2D Architectural Plan', view: 'architectural-plan', icon: Layout },
    { label: '2D Structural GA Plans', view: 'floor-plans', icon: Layers },
    { label: 'CAD Drawing Sheets', view: 'drawings', icon: FileText },
    { label: 'Reports & BOQ Export', view: 'reports', icon: FileSpreadsheet },
  ];

  return (
    <aside className="w-64 bg-[#0B132B] border-r border-slate-800 flex flex-col h-screen text-slate-300 font-sans z-30 select-none relative shadow-xs">
      {/* Brand Header with hide */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-sans text-sm font-bold text-white tracking-tight leading-tight">
              StructureAI
            </h1>
            <p className="font-mono text-[10px] text-slate-400 tracking-wider">V2.4 Enterprise • STAAD</p>
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

      {/* Primary CTA: Import ANL */}
      <div className="p-3">
        <button
          onClick={() => setImportModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold py-2.5 px-3 rounded-md shadow-sm transition-all active:scale-95"
        >
          <Upload className="w-4 h-4" />
          <span>Import .ANL / .STD</span>
        </button>
      </div>

      {/* Navigation Sections */}
      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5 text-xs">
        {/* Section 1: Analysis & Geometry — hideable */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="font-mono text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
              ANALYSIS & GEOMETRY
            </span>
            <button
              type="button"
              onClick={() => setAnalysisOpen(!analysisOpen)}
              className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
              title={analysisOpen ? 'Hide section' : 'Show section'}
            >
              {analysisOpen ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {analysisOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {analysisOpen && (
            <ul className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.view;
                return (
                  <li key={item.view}>
                    <button
                      onClick={() => handleNavClick(item.view)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-all font-mono text-[12px] ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 bg-slate-800 text-cyan-300 rounded text-[10px] font-bold border border-slate-700">
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

        {/* Section 2: IS Code Design Modules — hideable */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                IS CODE DESIGN
              </span>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60 font-semibold">
                IS 456 / IS 13920
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCodeOpen(!isCodeOpen)}
              className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
              title={isCodeOpen ? 'Hide section' : 'Show section'}
            >
              {isCodeOpen ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {isCodeOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {isCodeOpen && (
            <ul className="space-y-0.5">
              {phase2Items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.view;
                return (
                  <li key={item.view}>
                    <button
                      onClick={() => handleNavClick(item.view)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-all font-mono text-[12px] ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Section 3: Deliverables & Exports — hideable */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="font-mono text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
              DELIVERABLES & EXPORTS
            </span>
            <button
              type="button"
              onClick={() => setOutputsOpen(!outputsOpen)}
              className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
              title={outputsOpen ? 'Hide section' : 'Show section'}
            >
              {outputsOpen ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {outputsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {outputsOpen && (
            <ul className="space-y-0.5">
              {outputItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.view;
                return (
                  <li key={item.view}>
                    <button
                      onClick={() => handleNavClick(item.view)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-all font-mono text-[12px] ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom Settings, Telemetry & User */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        {/* Cyber Telemetry Status Bar */}
        <div className="px-2.5 py-1.5 rounded bg-cyber-void/90 border border-cyber-cyan/30 font-mono text-[10px] flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-1.5 text-cyber-matrix">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-matrix animate-pulse" />
            ONLINE
          </span>
          <span className="text-cyber-cyan font-bold">{isStreamActive ? 'AR LIVE' : 'TELEMETRY OK'}</span>
          <span className="text-slate-500">60 FPS</span>
        </div>

        {/* User Account & Profile Settings Trigger */}
        <button
          type="button"
          onClick={() => {
            cyberAudio.playSelectChirp();
            openWindow('userSettings');
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded font-mono text-[12px] text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800/80 hover:border-slate-700 shadow-2xs"
          title="Open User Profile, Password & Account Settings Window"
        >
          <div className="flex items-center gap-2.5">
            <UserCog className="w-4 h-4 text-sky-400" />
            <span>Account & Settings</span>
          </div>
          <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded text-[9px] font-bold font-mono">
            {user ? 'SYNCED' : 'LOCAL'}
          </span>
        </button>

        <button
          onClick={() => handleNavClick('settings')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded font-mono text-[12px] transition-colors ${
            activeView === 'settings'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Design Settings</span>
        </button>

        {/* User Profile Card (Clickable to open settings window) */}
        <button
          type="button"
          onClick={() => {
            cyberAudio.playSelectChirp();
            openWindow('userSettings');
          }}
          className="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer group"
          title="Click to open User Settings & Profile"
        >
          <div className="w-7 h-7 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center font-mono text-xs font-bold border border-slate-600 shrink-0">
            {profile.displayName?.[0]?.toUpperCase() || 'ER'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-mono text-xs text-white truncate group-hover:text-blue-400 transition-colors">
              {profile.displayName || engineerName || 'Structural Engineer'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono truncate">
              {profile.designation || 'Lead Struct. Eng'}
            </span>
          </div>
        </button>
      </div>
    </aside>
  );
});
Sidebar.displayName = 'Sidebar';
