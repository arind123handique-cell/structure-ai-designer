import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { GeneralNotesSvg } from './GeneralNotesSvg';
import { BeamDrawingSvg } from '@/features/design/beam/BeamDrawingSvg';
import { ColumnDrawingSvg } from '@/features/design/column/ColumnDrawingSvg';
import { PileCapDrawingSvg } from '@/features/design/pilecap/PileCapDrawingSvg';
import { GradeBeamDrawingSvg } from '@/features/design/gradebeam/GradeBeamDrawingSvg';
import { FootingDrawingSvg } from '@/features/design/footing/FootingDrawingSvg';
import { ShearWallDrawingSvg } from '@/features/design/shearwall/ShearWallDrawingSvg';
import { BeamDesignEngine } from '@/features/design/beam/beamDesignEngine';
import { ColumnDesignEngine } from '@/features/design/column/columnDesignEngine';
import { PileCapDesignEngine } from '@/features/design/pilecap/pileCapDesignEngine';
import { GradeBeamDesignEngine } from '@/features/design/gradebeam/gradeBeamEngine';
import { FootingDesignEngine } from '@/features/design/footing/footingDesignEngine';
import { ShearWallEngine } from '@/features/design/shearwall/shearWallEngine';
import { FloorPlanViewer } from './FloorPlanViewer';
import { BbsTableView } from './BbsTableView';
import { FileText, Compass, Layers, Box, Building, Printer, Download, Sparkles, FileSpreadsheet } from 'lucide-react';

export const DrawingsView: React.FC = React.memo(() => {
  const activeProject = useProjectStore(s => s.activeProject);
  const [activeSheet, setActiveSheet] = useState<'FLOOR_PLANS' | 'BBS' | 'NOTES' | 'BEAMS' | 'COLUMNS' | 'FOUNDATIONS' | 'GRADEBEAMS' | 'WALLS'>('BBS');

  const fck = activeProject?.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
  const fy = activeProject?.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;

  // Memoize sample designs - only recompute when fck/fy change and lazily per sheet
  const sampleBeam = useMemo(() => BeamDesignEngine.design({
    memberId: 1,
    b: 300,
    D: 450,
    spanLength: 4.5,
    fck,
    fy,
    Mu_top: 110,
    Mu_bottom: 75,
    Vu: 85,
  }), [fck, fy]);

  const sampleColumn = useMemo(() => ColumnDesignEngine.design({
    memberId: 53,
    b: 450,
    D: 550,
    unsupportedHeight: 3.5,
    fck,
    fy,
    Pu: 850,
    Mux: 55,
    Muy: 30,
  }), [fck, fy]);

  const samplePileCap = useMemo(() => PileCapDesignEngine.design({
    supportNodeId: 1,
    colWidth: 450,
    colDepth: 550,
    pileDiameter: 500,
    safePileCapacity: 450,
    factoredVerticalLoad: 1600,
    fck,
    fy,
  }), [fck, fy]);

  const sampleFooting = useMemo(() => FootingDesignEngine.design({
    supportNodeId: 2,
    colWidth: 450,
    colDepth: 550,
    factoredVerticalLoad: 750,
    SBC: 200,
    fck,
    fy,
  }), [fck, fy]);

  const sampleGradeBeam = useMemo(() => GradeBeamDesignEngine.design({
    gradeBeamId: 'GB-1-2',
    startNodeId: 1,
    endNodeId: 2,
    startColumnLabel: 'C1',
    endColumnLabel: 'C2',
    startPileCapLabel: 'PC-1',
    endPileCapLabel: 'PC-2',
    spanLength: 5.4,
    b: 300,
    D: 450,
    fck,
    fy,
    factoredPu1: 1316.5,
    factoredPu2: 1528.9,
  }), [fck, fy]);

  const sampleWall = useMemo(() => ShearWallEngine.design({
    wallId: 101,
    length: 3.2,
    thickness: 230,
    height: 3.5,
    fck,
    fy,
    Pu: 1200,
    Vu: 220,
    Mu: 450,
  }), [fck, fy]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-6 bg-ui-background overflow-y-auto font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card p-4 rounded-md border border-ui-border shadow-sm">
        <div>
          <h2 className="font-mono text-base font-bold text-deep-navy flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-secondary-brand" />
            CAD REINFORCEMENT DRAWING SHEETS &amp; BAR BENDING SCHEDULE (BBS)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-generated IS 2502 Bar Bending Schedule (BBS), 2D CAD floor plans, cross-sections, and IS 13920 detailing sheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-ui-border rounded transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Active Sheet
          </button>
        </div>
      </div>

      {/* Sheet Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ui-border pb-2">
        {[
          { id: 'BBS', label: 'STR-BBS: Bar Bending Schedule (All Members)', icon: FileSpreadsheet },
          { id: 'FLOOR_PLANS', label: 'STR-100: 2D Floor Framing & Foundation Plans', icon: Layers },
          { id: 'NOTES', label: 'STR-001: General Structural Notes', icon: FileText },
          { id: 'BEAMS', label: 'STR-002: Beam Reinforcement Elevations', icon: Compass },
          { id: 'COLUMNS', label: 'STR-003: Column Cross-Sections & Ties', icon: Layers },
          { id: 'FOUNDATIONS', label: 'STR-004: Pile Caps & Footings Layout', icon: Box },
          { id: 'GRADEBEAMS', label: 'STR-005: Foundation Grade Tie Beams', icon: Compass },
          { id: 'WALLS', label: 'STR-006: Ductile Shear Walls Detailing', icon: Building },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSheet === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSheet(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded border transition-all ${
                isActive
                  ? 'bg-deep-navy text-white border-deep-navy font-bold shadow-sm'
                  : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active CAD Drawing Sheet Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-2">
        {activeSheet === 'BBS' && (
          <div className="w-full h-full">
            <BbsTableView />
          </div>
        )}

        {activeSheet === 'FLOOR_PLANS' && (
          <div className="w-full h-full">
            <FloorPlanViewer />
          </div>
        )}

        {activeSheet === 'NOTES' && (
          <GeneralNotesSvg
            projectName={activeProject?.metadata.name}
            engineerName={activeProject?.metadata.engineer}
          />
        )}

        {activeSheet === 'BEAMS' && (
          <div className="space-y-4 w-full flex flex-col items-center">
            <BeamDrawingSvg beam={sampleBeam} width={880} height={380} />
          </div>
        )}

        {activeSheet === 'COLUMNS' && (
          <div className="space-y-4 w-full flex flex-col items-center">
            <ColumnDrawingSvg column={sampleColumn} width={650} height={380} />
          </div>
        )}

        {activeSheet === 'FOUNDATIONS' && (
          <div className="grid grid-cols-1 gap-6 w-full max-w-5xl">
            <PileCapDrawingSvg pileCap={samplePileCap} width={800} height={360} />
            <FootingDrawingSvg footing={sampleFooting} width={800} height={360} />
          </div>
        )}

        {activeSheet === 'GRADEBEAMS' && (
          <div className="space-y-4 w-full flex flex-col items-center">
            <GradeBeamDrawingSvg gradeBeam={sampleGradeBeam} width={880} height={420} />
          </div>
        )}

        {activeSheet === 'WALLS' && (
          <div className="space-y-4 w-full flex flex-col items-center">
            <ShearWallDrawingSvg wall={sampleWall} width={850} height={380} />
          </div>
        )}
      </div>
    </div>
  );
});
DrawingsView.displayName = 'DrawingsView';
