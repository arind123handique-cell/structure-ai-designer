import React, { Suspense, lazy, useState, useEffect } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { ANLImportModal } from '@/features/anl/ANLImportModal';
import { NewProjectModal } from '@/features/projects/NewProjectModal';
import { UniversalRebarModal } from '@/features/design/common/UniversalRebarModal';
import { Loader2, PanelLeftOpen, PanelTopOpen, Eye, EyeOff, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/firebase/AuthContext';
import { WindowHost } from '@/components/window/WindowHost';
import { FuturisticBackdrop } from '@/components/futuristic/FuturisticBackdrop';
import { useThemeStore } from '@/features/theme/themeStore';

const ProjectDashboard = lazy(() => import('@/features/projects/ProjectDashboard').then(m => ({ default: m.ProjectDashboard })));
const EtabsStudioView = lazy(() => import('@/features/etabs/EtabsStudioView').then(m => ({ default: m.EtabsStudioView })));
const Structural3DViewer = lazy(() => import('@/components/model-viewer/Structural3DViewer').then(m => ({ default: m.Structural3DViewer })));
const MemberForcesTable = lazy(() => import('@/components/tables/MemberForcesTable').then(m => ({ default: m.MemberForcesTable })));
const JointReactionsTable = lazy(() => import('@/components/tables/JointReactionsTable').then(m => ({ default: m.JointReactionsTable })));
const LoadCasesTable = lazy(() => import('@/components/tables/LoadCasesTable').then(m => ({ default: m.LoadCasesTable })));
const ElementsTable = lazy(() => import('@/components/tables/ElementsTable').then(m => ({ default: m.ElementsTable })));
const WarningViewer = lazy(() => import('@/components/engineering/WarningViewer').then(m => ({ default: m.WarningViewer })));
const MemberInspector = lazy(() => import('@/components/engineering/MemberInspector').then(m => ({ default: m.MemberInspector })));
const ProjectSettings = lazy(() => import('@/features/projects/ProjectSettings').then(m => ({ default: m.ProjectSettings })));
const BeamDesignView = lazy(() => import('@/features/design/beam/BeamDesignView').then(m => ({ default: m.BeamDesignView })));
const ColumnDesignView = lazy(() => import('@/features/design/column/ColumnDesignView').then(m => ({ default: m.ColumnDesignView })));
const PileDesignView = lazy(() => import('@/features/design/pile/PileDesignView').then(m => ({ default: m.PileDesignView })));
const PileCapDesignView = lazy(() => import('@/features/design/pilecap/PileCapDesignView').then(m => ({ default: m.PileCapDesignView })));
const GradeBeamDesignView = lazy(() => import('@/features/design/gradebeam/GradeBeamDesignView').then(m => ({ default: m.GradeBeamDesignView })));
const FootingDesignView = lazy(() => import('@/features/design/footing/FootingDesignView').then(m => ({ default: m.FootingDesignView })));
const ShearWallDesignView = lazy(() => import('@/features/design/shearwall/ShearWallDesignView').then(m => ({ default: m.ShearWallDesignView })));
const SlabDesignView = lazy(() => import('@/features/design/slab/SlabDesignView').then(m => ({ default: m.SlabDesignView })));
const StaircaseDesignView = lazy(() => import('@/features/design/staircase/StaircaseDesignView').then(m => ({ default: m.StaircaseDesignView })));
const FloorPlanViewer = lazy(() => import('@/features/drawings/FloorPlanViewer').then(m => ({ default: m.FloorPlanViewer })));
const ArchitecturalPlanView = lazy(() => import('@/features/architectural/components/ArchitecturalPlanView').then(m => ({ default: m.ArchitecturalPlanView })));
const DrawingsView = lazy(() => import('@/features/drawings/DrawingsView').then(m => ({ default: m.DrawingsView })));
const ReportsView = lazy(() => import('@/features/reports/ReportsView').then(m => ({ default: m.ReportsView })));

const ViewFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 font-mono gap-3">
    <Loader2 className="w-6 h-6 animate-spin text-secondary-brand" />
    <span className="text-xs font-semibold tracking-wider">LOADING MODULE...</span>
  </div>
);

export const AppLayout: React.FC = () => {
  const activeView = useProjectStore(s => s.activeView);
  const selectedMemberId = useProjectStore(s => s.selectedMemberId);
  const { user } = useAuth();

  // Navigation panel visibility (persisted)
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    try { return localStorage.getItem('nav:sidebarVisible') !== '0'; } catch { return true; }
  });
  const [headerVisible, setHeaderVisible] = useState(() => {
    try { return localStorage.getItem('nav:headerVisible') !== '0'; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem('nav:sidebarVisible', sidebarVisible ? '1' : '0'); } catch {} }, [sidebarVisible]);
  useEffect(() => { try { localStorage.setItem('nav:headerVisible', headerVisible ? '1' : '0'); } catch {} }, [headerVisible]);

  const renderMainView = () => {
    switch (activeView) {
      case 'dashboard':
        return <ProjectDashboard />;
      case 'etabs-studio':
        return <EtabsStudioView />;
      case '3d-model':
        return <Structural3DViewer />;
      case 'member-forces':
        return <MemberForcesTable />;
      case 'joint-reactions':
        return <JointReactionsTable />;
      case 'load-cases':
        return <LoadCasesTable />;
      case 'elements':
        return <ElementsTable />;
      case 'warnings':
        return <WarningViewer />;
      case 'settings':
        return <ProjectSettings />;
      case 'beams-design':
        return <BeamDesignView />;
      case 'columns-design':
        return <ColumnDesignView />;
      case 'piles-design':
        return <PileDesignView />;
      case 'pilecaps-design':
        return <PileCapDesignView />;
      case 'gradebeams-design':
        return <GradeBeamDesignView />;
      case 'footings-design':
        return <FootingDesignView />;
      case 'shearwalls-design':
        return <ShearWallDesignView />;
      case 'slabs-design':
        return <SlabDesignView />;
      case 'staircase-design':
        return <StaircaseDesignView />;
      case 'architectural-plan':
        return <ArchitecturalPlanView />;
      case 'floor-plans':
        return <FloorPlanViewer />;
      case 'drawings':
        return <DrawingsView />;
      case 'reports':
        return <ReportsView />;
      default:
        return <ProjectDashboard />;
    }
  };

  const theme = useThemeStore((s) => s.theme);

  return (
    <div className={`${theme === 'dark' ? 'theme-dark' : 'theme-light'} flex h-screen w-screen overflow-hidden bg-ui-background text-on-surface`}>
      {/* Left Sidebar — hideable */}
      {sidebarVisible ? (
        <Sidebar onHide={() => setSidebarVisible(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setSidebarVisible(true)}
          className="fixed left-2 top-3 z-40 p-2 bg-deep-navy hover:bg-slate-800 text-white rounded-md shadow-lg border border-slate-700 flex items-center gap-1.5 text-xs font-mono"
          title="Show Navigation Sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
          <span className="hidden md:inline">Nav</span>
        </button>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {headerVisible ? (
          <TopHeader onHide={() => setHeaderVisible(false)} />
        ) : (
          <div className="h-8 bg-surface-card border-b border-ui-border flex items-center justify-between px-3 shrink-0">
            <span className="text-[10px] font-mono text-slate-400">Header hidden</span>
            <div className="flex items-center gap-2">
              {user && (
                <span className="text-[10px] font-mono text-emerald-600 flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[7px] font-bold">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  SYNCED
                </span>
              )}
              <button
                type="button"
                onClick={() => { setSidebarVisible(true); setHeaderVisible(true); }}
                className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-[11px] font-mono shadow-2xs"
                title="Show Top Header"
              >
                <PanelTopOpen className="w-3.5 h-3.5" /> Show Header
              </button>
            </div>
          </div>
        )}

        {/* Global hide/show for navigation */}
        {!sidebarVisible || !headerVisible ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-ui-border text-[11px] font-mono text-slate-500">
            <EyeOff className="w-3 h-3 text-slate-400" />
            <span>Navigation hidden:</span>
            {!sidebarVisible && <span className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 font-semibold">Sidebar</span>}
            {!headerVisible && <span className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700 font-semibold">Header</span>}
            <button
              type="button"
              onClick={() => { setSidebarVisible(true); setHeaderVisible(true); }}
              className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-slate-100 border border-ui-border rounded text-[11px] font-mono"
            >
              <Eye className="w-3 h-3" /> Show All Nav
            </button>
          </div>
        ) : null}

        <div className="flex-1 flex overflow-hidden relative">
          {/* Futuristic video-like ambience (canvas + animated grid) behind content */}
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-white via-ui-background to-sky-50/60">
            <FuturisticBackdrop className="absolute inset-0 w-full h-full opacity-40" />
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  'linear-gradient(#0051d5 1px, transparent 1px), linear-gradient(90deg, #0051d5 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />
          </div>

          {/* Main View Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
            <Suspense fallback={<ViewFallback />}>{renderMainView()}</Suspense>
          </div>

          {/* Member Inspector Panel (if a member is selected) */}
          {selectedMemberId && (
            <Suspense fallback={null}><MemberInspector /></Suspense>
          )}
        </div>
      </div>

      {/* ANL Import Modal */}
      <ANLImportModal />

      {/* New Project Modal */}
      <NewProjectModal />

      {/* Universal Rebar Master Selection Modal */}
      <UniversalRebarModal />

      {/* Global engineering window system */}
      <WindowHost />
    </div>
  );
};
