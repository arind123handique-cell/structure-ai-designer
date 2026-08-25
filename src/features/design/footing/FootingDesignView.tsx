import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { FootingDesignEngine, FootingDesignOutput } from './footingDesignEngine';
import { FootingDrawingSvg } from './FootingDrawingSvg';
import { CalculationModal } from '@/features/calculations/CalculationModal';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { DataTable, ColumnDef } from '@/components/tables/DataTable';
import { exportToCsv } from '@/utils/exportUtils';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { UniversalRebarBar } from '@/features/design/common/UniversalRebarBar';
import { Play, Building, FileText, Download, X, Save, CheckCircle2 } from 'lucide-react';

export const FootingDesignView: React.FC = () => {
  const { activeModel, activeProject, saveFootingDesigns } = useProjectStore();

  const [designedFootings, setDesignedFootings] = useState<Map<number, FootingDesignOutput>>(() => {
    if (activeProject?.savedFootingDesigns) {
      return new Map(Object.entries(activeProject.savedFootingDesigns).map(([k, v]) => [Number(k), v as FootingDesignOutput]));
    }
    return new Map();
  });
  const [selectedReport, setSelectedReport] = useState<DetailedCalculationReport | null>(null);
  const [selectedDrawingFooting, setSelectedDrawingFooting] = useState<FootingDesignOutput | null>(null);
  const [sbc, setSbc] = useState<number>(200); // kN/m2
  const [isDesigning, setIsDesigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const handleSaveDesigns = async () => {
    if (designedFootings.size === 0) return;
    setIsSaving(true);
    try {
      await saveFootingDesigns(designedFootings);
      setSaveSuccessMsg(`Successfully saved ${designedFootings.size} Footing designs to project!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const columnMapping = useMemo(() => {
    return ColumnNumberingService.getColumnSupportMapping(activeModel);
  }, [activeModel]);

  const supportNodes = useMemo(() => {
    if (!activeModel) return [];
    const list = Array.from(activeModel.supports.values());
    return list.sort((a, b) => {
      const slA = columnMapping.get(a.nodeId)?.columnSlNo || a.nodeId;
      const slB = columnMapping.get(b.nodeId)?.columnSlNo || b.nodeId;
      return slA - slB;
    });
  }, [activeModel, columnMapping]);

  const handleDesignAll = () => {
    if (!activeModel || !activeProject) return;
    setIsDesigning(true);

    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;

    const newMap = new Map<number, FootingDesignOutput>();

    for (const sup of supportNodes) {
      const reactions = activeModel.reactions.filter((r) => r.nodeId === sup.nodeId);
      let maxFy = 650;
      let maxMx = 25;
      let maxMy = 15;
      let govLC = 1;

      if (reactions.length > 0) {
        for (const r of reactions) {
          if (r.fy > maxFy) {
            maxFy = r.fy;
            maxMx = r.mx;
            maxMy = r.my;
            govLC = r.loadCaseId;
          }
        }
      }

      const result = FootingDesignEngine.design({
        supportNodeId: sup.nodeId,
        colWidth: 450,
        colDepth: 550,
        factoredVerticalLoad: maxFy,
        factoredMomentX: maxMx,
        factoredMomentY: maxMy,
        SBC: sbc,
        fck,
        fy,
        governingLoadCase: govLC,
      });

      newMap.set(sup.nodeId, result);
    }

    setDesignedFootings(newMap);
    setIsDesigning(false);
  };

  React.useEffect(() => {
    if (designedFootings.size === 0 && supportNodes.length > 0) {
      handleDesignAll();
    }
  }, [supportNodes.length, sbc]);

  const rows = useMemo(() => {
    return supportNodes.map((sup) => {
      const design = designedFootings.get(sup.nodeId);
      const colInfo = columnMapping.get(sup.nodeId);
      const slNo = colInfo?.columnSlNo || sup.nodeId;
      return {
        nodeId: sup.nodeId,
        columnSlNo: slNo,
        columnLabel: colInfo?.columnLabel || `C${slNo}`,
        footingLabel: colInfo?.footingLabel || `F-${slNo}`,
        gridLabel: colInfo?.gridLabel,
        design,
      };
    });
  }, [supportNodes, designedFootings, columnMapping]);

  const columns: ColumnDef<any>[] = [
    {
      header: 'FOOTING # (COLUMN / JOINT)',
      accessorKey: 'columnSlNo',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-1.5 font-mono">
          <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs shadow-2xs">
            {r.footingLabel}
          </span>
          <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
            {r.columnLabel}
          </span>
          <span className="text-[11px] text-slate-500 font-normal" title={r.gridLabel}>
            (Joint #{r.nodeId})
          </span>
        </div>
      ),
      width: '230px',
    },
    {
      header: 'FOOTING SIZE (L × B × D)',
      cell: (r) => (
        <span className="font-mono text-slate-800">
          {r.design ? `${r.design.length.toFixed(2)}m × ${r.design.width.toFixed(2)}m × ${r.design.thickness}mm` : '—'}
        </span>
      ),
      width: '210px',
    },
    {
      header: 'MAX BASE PRESSURE',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">—</span>;
        const q = r.design.soilPressure;
        return (
          <span className="font-mono text-[11px] text-slate-800 font-semibold">
            {q.q_max} kN/m² (SBC: {sbc})
          </span>
        );
      },
      width: '180px',
    },
    {
      header: 'PUNCHING SHEAR',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">—</span>;
        const p = r.design.punchingShear;
        return (
          <span className="font-mono text-[11px] text-slate-700">
            {p.tau_vp} N/mm² (Cap: {p.tau_cp})
          </span>
        );
      },
      width: '160px',
    },
    {
      header: 'BOTTOM REBAR MESH',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">Pending</span>;
        return <span className="font-mono text-orange-600 font-semibold">{r.design.rebarCalloutX.split(' (')[0]}</span>;
      },
    },
    {
      header: 'STATUS',
      sortable: true,
      align: 'center',
      cell: (r) => (
        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          {r.design ? r.design.status : 'READY'}
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
            onClick={() => r.design && setSelectedReport(r.design.calculationReport)}
            disabled={!r.design}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border text-[11px] font-mono shadow-xs transition-colors disabled:opacity-40"
            title="View Calculation Sheet"
          >
            Calc
          </button>
          <button
            onClick={() => r.design && setSelectedDrawingFooting(r.design)}
            disabled={!r.design}
            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-200 text-[11px] font-mono shadow-xs transition-colors disabled:opacity-40"
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
      rows.map((r) => ({
        SupportJoint: r.nodeId,
        Length_m: r.design?.length || 2.0,
        Width_m: r.design?.width || 2.0,
        Thickness_mm: r.design?.thickness || 500,
        MaxBasePressure_kNm2: r.design?.soilPressure.q_max || 0,
        AllowableSBC_kNm2: sbc,
        PunchingShear_Nmm2: r.design?.punchingShear.tau_vp || 0,
        BottomRebar: r.design?.rebarCalloutX || '',
        Status: r.design?.status || 'PENDING',
      })),
      'IS456_Isolated_Footing_Schedule.csv'
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-5 bg-ui-background overflow-hidden font-sans">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card p-4 rounded-md border border-ui-border shadow-sm">
        <div>
          <h2 className="font-mono text-base font-bold text-deep-navy flex items-center gap-2">
            <Building className="w-5 h-5 text-amber-600" />
            IS 456:2000 ISOLATED & COMBINED PAD FOOTING DESIGN ENGINE
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Allowable soil bearing capacity, no-tension eccentricity checks, two-way punching shear, one-way beam shear, and orthogonal bottom reinforcement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded border border-ui-border">
            <span>SBC:</span>
            <input
              type="number"
              value={sbc}
              onChange={(e) => setSbc(Number(e.target.value))}
              className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-right font-bold text-deep-navy"
            />
            <span>kN/m²</span>
          </div>

          {designedFootings.size > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-ui-border rounded transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export Schedule CSV
            </button>
          )}

          <button
            onClick={handleSaveDesigns}
            disabled={isSaving || designedFootings.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded font-mono text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            title="Save designed footings to project"
          >
            <Save className="w-3.5 h-3.5 text-blue-200" />
            <span>{isSaving ? 'Saving...' : '💾 Save Designs'}</span>
          </button>

          <button
            onClick={handleDesignAll}
            disabled={isDesigning}
            className="flex items-center gap-2 px-4 py-1.5 bg-secondary-brand hover:bg-blue-700 text-white font-mono text-xs font-semibold rounded shadow transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isDesigning ? 'Designing Footings...' : 'Re-calculate All Footings'}</span>
          </button>
        </div>
      </div>

      {/* Universal Rebar Master Selection Toolbar */}
      <UniversalRebarBar moduleName="Pad Footing" />

      {/* Save Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Main Table */}
      <div className="flex-1 overflow-hidden">
        <DataTable
          data={rows}
          columns={columns}
          title="RCC ISOLATED FOOTING SCHEDULE & BASE PRESSURE CHECKS"
          searchPlaceholder="Search by Joint #..."
          searchFilter={(item, q) => String(item.nodeId).includes(q)}
          onExportCsv={handleExport}
        />
      </div>

      {/* Calculation Modal */}
      <CalculationModal report={selectedReport} onClose={() => setSelectedReport(null)} />

      {/* Drawing Modal */}
      {selectedDrawingFooting && (
        <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
          <div className="w-full max-w-4xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold text-deep-navy">
                CAD FOOTING PLAN & SOIL PRESSURE — FOOTING F-{selectedDrawingFooting.supportNodeId}
              </h3>
              <button onClick={() => setSelectedDrawingFooting(null)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <FootingDrawingSvg footing={selectedDrawingFooting} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
