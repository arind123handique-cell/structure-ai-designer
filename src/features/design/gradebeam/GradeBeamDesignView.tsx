import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { GradeBeamDesignEngine, GradeBeamDesignOutput } from './gradeBeamEngine';
import { GradeBeamDrawingSvg } from './GradeBeamDrawingSvg';
import { CalculationModal } from '@/features/calculations/CalculationModal';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { DataTable, ColumnDef } from '@/components/tables/DataTable';
import { exportToCsv } from '@/utils/exportUtils';
import { UniversalRebarBar } from '@/features/design/common/UniversalRebarBar';
import { Play, Compass, FileText, Download, X, Layers, ShieldCheck, Activity, Save, CheckCircle2 } from 'lucide-react';

export const GradeBeamDesignView: React.FC = () => {
  const { activeModel, activeProject, saveGradeBeamDesigns } = useProjectStore();

  const [designedGradeBeams, setDesignedGradeBeams] = useState<GradeBeamDesignOutput[]>(() => activeProject?.savedGradeBeamDesigns || []);
  const [selectedReport, setSelectedReport] = useState<DetailedCalculationReport | null>(null);
  const [selectedDrawingBeam, setSelectedDrawingBeam] = useState<GradeBeamDesignOutput | null>(null);
  const [isDesigning, setIsDesigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleDesignAll = () => {
    if (!activeModel || !activeProject) return;
    setIsDesigning(true);

    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;

    const results = GradeBeamDesignEngine.discoverAndDesignAll(activeModel, fck, fy);
    setDesignedGradeBeams(results);
    setIsDesigning(false);
  };

  const handleSaveDesigns = async () => {
    if (designedGradeBeams.length === 0) return;
    setIsSaving(true);
    try {
      await saveGradeBeamDesigns(designedGradeBeams);
      setSaveSuccessMsg(`Successfully saved ${designedGradeBeams.length} Grade Beam designs to project!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  React.useEffect(() => {
    if (designedGradeBeams.length === 0 && activeModel) {
      handleDesignAll();
    }
  }, [activeModel]);

  const columns: ColumnDef<GradeBeamDesignOutput>[] = [
    {
      header: 'GRADE BEAM #',
      accessorKey: 'gradeBeamId',
      sortable: true,
      cell: (r) => (
        <span className="font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-xs font-mono shadow-2xs">
          {r.gradeBeamId}
        </span>
      ),
      width: '130px',
    },
    {
      header: 'CONNECTED PILE CAPS (COLUMNS)',
      cell: (r) => (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
            {r.startPileCapLabel} ({r.startColumnLabel})
          </span>
          <span className="text-slate-400">↔</span>
          <span className="font-semibold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
            {r.endPileCapLabel} ({r.endColumnLabel})
          </span>
        </div>
      ),
      width: '240px',
    },
    {
      header: 'SPAN (m)',
      accessorKey: 'spanLength',
      sortable: true,
      align: 'right',
      cell: (r) => (
        <span className="font-mono font-bold text-slate-800">
          {r.spanLength.toFixed(2)} m
        </span>
      ),
      width: '95px',
    },
    {
      header: 'SECTION (b × D)',
      cell: (r) => (
        <span className="font-mono font-bold text-slate-900">
          {r.b} × {r.D} mm
        </span>
      ),
      width: '135px',
    },
    {
      header: 'TIE FORCE (P_tie)',
      sortable: true,
      accessorKey: 'factoredTensionTiePu',
      align: 'right',
      cell: (r) => (
        <div className="font-mono text-right">
          <span className="font-bold text-emerald-800 block text-xs">
            {r.factoredTensionTiePu} kN
          </span>
          <span className="text-[10px] text-slate-500">IS 13920 Cl. 11.2</span>
        </div>
      ),
      width: '140px',
    },
    {
      header: 'DESIGN MOMENT (Mu)',
      align: 'right',
      cell: (r) => (
        <span className="font-mono font-semibold text-slate-800">
          {r.factoredDesignMomentMu} kNm
        </span>
      ),
      width: '145px',
    },
    {
      header: 'TOP REBAR',
      cell: (r) => (
        <span className="font-mono font-bold text-red-600 block text-xs">
          {r.topRebarCallout.split(' (')[0]}
        </span>
      ),
      width: '110px',
    },
    {
      header: 'BOTTOM REBAR',
      cell: (r) => (
        <span className="font-mono font-bold text-orange-600 block text-xs">
          {r.bottomRebarCallout.split(' (')[0]}
        </span>
      ),
      width: '110px',
    },
    {
      header: 'CONFINEMENT TIES (IS 13920)',
      cell: (r) => (
        <span className="font-mono text-[11px] text-slate-700">
          {r.stirrupCallout}
        </span>
      ),
      width: '240px',
    },
    {
      header: 'STATUS',
      sortable: true,
      align: 'center',
      cell: (r) => (
        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          {r.status}
        </span>
      ),
      width: '90px',
    },
    {
      header: 'ACTIONS',
      align: 'center',
      cell: (r) => (
        <div className="flex items-center gap-1.5 justify-center">
          <button
            onClick={() => setSelectedReport(r.calculationReport)}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border text-[11px] font-mono shadow-xs transition-colors"
            title="View Calculation Sheet"
          >
            Calc
          </button>
          <button
            onClick={() => setSelectedDrawingBeam(r)}
            className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded border border-sky-200 text-[11px] font-mono shadow-xs transition-colors"
            title="View CAD Drawing"
          >
            Draw
          </button>
        </div>
      ),
      width: '120px',
    },
  ];

  const handleExport = () => {
    exportToCsv(
      designedGradeBeams.map((r) => ({
        GradeBeamId: r.gradeBeamId,
        StartPileCap: r.startPileCapLabel,
        EndPileCap: r.endPileCapLabel,
        StartColumn: r.startColumnLabel,
        EndColumn: r.endColumnLabel,
        SpanLength_m: r.spanLength,
        Width_mm: r.b,
        Depth_mm: r.D,
        AxialTieForce_kN: r.factoredTensionTiePu,
        DesignMoment_kNm: r.factoredDesignMomentMu,
        DesignShear_kN: r.factoredDesignShearVu,
        AstRequired_mm2: r.astReqTotal,
        TopRebar: r.topRebarCallout,
        BottomRebar: r.bottomRebarCallout,
        ConfinementTies: r.stirrupCallout,
        Status: r.status,
      })),
      'IS13920_Grade_Beam_Schedule.csv'
    );
  };

  const totalTies = designedGradeBeams.length;
  const maxTieForce = Math.max(...designedGradeBeams.map((g) => g.factoredTensionTiePu), 0);

  return (
    <div className="flex flex-col h-full space-y-4 p-5 bg-ui-background overflow-hidden font-sans">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card p-4 rounded-md border border-ui-border shadow-xs">
        <div>
          <h2 className="font-mono text-base font-bold text-deep-navy flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-600" />
            IS 13920:2016 & IS 2911 FOUNDATION GRADE / TIE BEAM DESIGN ENGINE
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ductile seismic foundation ties connecting pile caps for differential settlement, axial tension (10% Pu), plinth brick wall loads, and 2D end confinement zones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDesigns}
            disabled={isSaving || designedGradeBeams.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded font-mono text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            title="Save designed grade beams to project"
          >
            <Save className="w-3.5 h-3.5 text-blue-200" />
            <span>{isSaving ? 'Saving...' : '💾 Save Designs'}</span>
          </button>
          <button
            onClick={handleDesignAll}
            disabled={isDesigning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-mono text-xs font-semibold shadow-xs transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Re-Calculate Grade Beams</span>
          </button>
          <button
            onClick={handleExport}
            disabled={designedGradeBeams.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border font-mono text-xs font-semibold shadow-xs transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Schedule</span>
          </button>
        </div>
      </div>

      {/* Universal Rebar Master Selection Toolbar */}
      <UniversalRebarBar moduleName="Plinth & Grade Beam" />

      {/* Save Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-surface-card border border-ui-border rounded p-3 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            Total Grade Ties
          </span>
          <span className="text-lg font-bold text-slate-900">{totalTies} Beams</span>
        </div>
        <div className="bg-surface-card border border-ui-border rounded p-3 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            Max Axial Tie Force (P_tie)
          </span>
          <span className="text-lg font-bold text-emerald-700">{maxTieForce.toFixed(1)} kN</span>
        </div>
        <div className="bg-surface-card border border-ui-border rounded p-3 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-indigo-600" />
            Standard Sizing
          </span>
          <span className="text-lg font-bold text-indigo-900">300 × 450 mm</span>
        </div>
        <div className="bg-surface-card border border-ui-border rounded p-3 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            Seismic Detailing
          </span>
          <span className="text-lg font-bold text-slate-900">IS 13920 Cl. 11.2 (2D zone)</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-surface-card rounded-md border border-ui-border shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={designedGradeBeams}
          searchPlaceholder="Search by Grade Beam (e.g. GB-1-2) or Pile Cap (e.g. PC-1)..."
        />
      </div>

      {/* Calculation Modal */}
      {selectedReport && (
        <CalculationModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}

      {/* CAD Drawing Modal */}
      {selectedDrawingBeam && (
        <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col font-mono animate-in fade-in">
            <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-xs tracking-wide">
                  CAD ELEVATION & CROSS-SECTION — {selectedDrawingBeam.gradeBeamId} (IS 13920)
                </span>
              </div>
              <button
                onClick={() => setSelectedDrawingBeam(null)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[80vh] flex justify-center bg-slate-950">
              <GradeBeamDrawingSvg gradeBeam={selectedDrawingBeam} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
