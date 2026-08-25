import React, { Suspense, lazy } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { ANLImportModal } from '@/features/anl/ANLImportModal';
import { UniversalRebarModal } from '@/features/design/common/UniversalRebarModal';
import { Loader2 } from 'lucide-react';

const ProjectDashboard = lazy(() => import('@/features/projects/ProjectDashboard').then(m => ({ default: m.ProjectDashboard })));
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
const FloorPlanViewer = lazy(() => import('@/features/drawings/FloorPlanViewer').then(m => ({ default: m.FloorPlanViewer })));
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

  const renderMainView = () => {
    switch (activeView) {
      case 'dashboard':
        return <ProjectDashboard />;
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ui-background text-on-surface">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TopHeader />

        <div className="flex-1 flex overflow-hidden relative">
          {/* Main View Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
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

      {/* Universal Rebar Master Selection Modal */}
      <UniversalRebarModal />
    </div>
  );
};
