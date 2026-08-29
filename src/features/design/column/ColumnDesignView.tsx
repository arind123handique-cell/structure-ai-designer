import React, { useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { ColumnDesignEngine, ColumnDesignOutput } from './columnDesignEngine';
import { ColumnDrawingSvg } from './ColumnDrawingSvg';
import { PMDiagramCanvas } from './PMDiagramCanvas';
import { CalculationModal } from '@/features/calculations/CalculationModal';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { DataTable, ColumnDef } from '@/components/tables/DataTable';
import { exportToCsv } from '@/utils/exportUtils';
import { SectionEditModal } from '@/features/design/common/SectionEditModal';
import { ColumnRebarEditModal } from './ColumnRebarEditModal';
import { ColumnAutoDesignModal } from './ColumnAutoDesignModal';
import { UniversalRebarBar } from '@/features/design/common/UniversalRebarBar';
import { CollapsiblePanel } from '@/components/common/CollapsiblePanel';
import {
  ColumnOptimizationEngine,
  BatchColumnOptimizationSummary,
} from './columnOptimizationEngine';
import { WarningFixModal } from '@/features/warnings/WarningFixModal';
import { ColumnAutoFixEngine } from './columnAutoFixEngine';
import { IS13920WeakBeamStrongColumn } from '@/features/codes/is13920/weakBeamStrongColumn';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { ColumnBarArrangement, ColumnRebarOption } from './barArrangement';
import { CalculationPdfService } from '@/features/calculations/calculationPdfService';
import {
  Play,
  Layers,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Activity,
  X,
  Sparkles,
  Wrench,
  Sliders,
  Zap,
  RotateCw,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';

const QUICK_COL_SIZES = [
  { label: '300 × 450 mm', zd: 0.30, yd: 0.45 },
  { label: '450 × 300 mm (Rotated)', zd: 0.45, yd: 0.30 },
  { label: '300 × 600 mm', zd: 0.30, yd: 0.60 },
  { label: '600 × 300 mm (Rotated)', zd: 0.60, yd: 0.30 },
  { label: '450 × 450 mm', zd: 0.45, yd: 0.45 },
  { label: '450 × 550 mm', zd: 0.45, yd: 0.55 },
  { label: '550 × 450 mm (Rotated)', zd: 0.55, yd: 0.45 },
  { label: '450 × 600 mm', zd: 0.45, yd: 0.60 },
  { label: '600 × 450 mm (Rotated)', zd: 0.60, yd: 0.45 },
  { label: '500 × 600 mm', zd: 0.50, yd: 0.60 },
  { label: '600 × 500 mm (Rotated)', zd: 0.60, yd: 0.50 },
  { label: '500 × 750 mm', zd: 0.50, yd: 0.75 },
  { label: '750 × 500 mm (Rotated)', zd: 0.75, yd: 0.50 },
  { label: '600 × 900 mm', zd: 0.60, yd: 0.90 },
];

export const ColumnDesignView: React.FC = () => {
  const {
    activeModel,
    activeProject,
    updateMemberSection,
    batchUpdateSections,
    allowedColumnRebarDiameters,
    setAllowedColumnRebarDiameters,
    rotateColumnOrientation,
    autoOrientAllColumns,
    saveColumnDesigns,
  } = useProjectStore();

  const [designedColumns, setDesignedColumns] = useState<Map<number, ColumnDesignOutput>>(new Map());
  const [customRebarOverrides, setCustomRebarOverrides] = useState<Map<number, ColumnRebarOption>>(() => {
    if (activeProject?.customColumnRebarOverrides) {
      return new Map(Object.entries(activeProject.customColumnRebarOverrides).map(([k, v]) => [Number(k), v as ColumnRebarOption]));
    }
    return new Map();
  });
  const [selectedReport, setSelectedReport] = useState<DetailedCalculationReport | null>(null);
  const [selectedDrawingColumn, setSelectedDrawingColumn] = useState<ColumnDesignOutput | null>(null);
  const [selectedPMColumn, setSelectedPMColumn] = useState<ColumnDesignOutput | null>(null);
  const [selectedFixColumn, setSelectedFixColumn] = useState<ColumnDesignOutput | null>(null);
  const [selectedRebarEditColumn, setSelectedRebarEditColumn] = useState<ColumnDesignOutput | null>(null);
  const [autoDesignSummary, setAutoDesignSummary] = useState<BatchColumnOptimizationSummary | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PASS' | 'WARNING' | 'FAIL'>('ALL');
  const [isDesigning, setIsDesigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isAutoDesigning, setIsAutoDesigning] = useState(false);
  const [isApplyingAutoDesign, setIsApplyingAutoDesign] = useState(false);
  const [isAutoOrienting, setIsAutoOrienting] = useState(false);
  const [editMemberId, setEditMemberId] = useState<number | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [showTable, setShowTable] = useState(true);

  const columnMapping = useMemo(() => {
    return ColumnNumberingService.getColumnMemberMapping(activeModel);
  }, [activeModel]);

  // Ground-level support columns only — one row per support node (excluding lift core / shear wall)
  const groundColumns = useMemo(() => {
    if (!activeModel) return [];

    const supportNodeIds = Array.from(activeModel.supports.keys());
    const supportInfo: { nodeId: number; x: number; z: number }[] = [];
    for (const nodeId of supportNodeIds) {
      const node = activeModel.nodes.get(nodeId);
      if (node) supportInfo.push({ nodeId, x: node.x, z: node.z });
    }

    // Lift core supports = any support node that has a WALL-classification plate sitting on it
    const liftCoreNodeIds = new Set<number>();
    if (activeModel.plates) {
      for (const plate of activeModel.plates.values()) {
        if ((plate as any).classification !== 'WALL') continue;
        const plateNodeIds = (plate as any).nodeIds || (plate as any).nodes || [];
        for (const nid of plateNodeIds) {
          if (supportInfo.some((s) => s.nodeId === nid)) {
            liftCoreNodeIds.add(nid);
          }
        }
      }
    }

    // For each non-lift-core support, find the ground column member connected to it
    const cols = Array.from(activeModel.members.values()).filter(
      (m) => m.classification === 'COLUMN'
    );

    const result: typeof cols = [];
    for (const sup of supportInfo) {
      if (liftCoreNodeIds.has(sup.nodeId)) continue;

      const groundCol = cols.find(
        (c) => c.startNodeId === sup.nodeId || c.endNodeId === sup.nodeId
      );
      if (groundCol && !result.some((r) => r.id === groundCol.id)) {
        result.push(groundCol);
      }
    }

    return result.sort((a, b) => {
      const slA = columnMapping.get(a.id)?.columnSlNo || a.id;
      const slB = columnMapping.get(b.id)?.columnSlNo || b.id;
      return slA - slB;
    });
  }, [activeModel, columnMapping]);

  // All columns (for design engine — still needs all floors to find governing load)
  const allColumns = useMemo(() => {
    if (!activeModel) return [];
    const cols = Array.from(activeModel.members.values()).filter((m) => m.classification === 'COLUMN');
    return cols.sort((a, b) => {
      const slA = columnMapping.get(a.id)?.columnSlNo || a.id;
      const slB = columnMapping.get(b.id)?.columnSlNo || b.id;
      return slA - slB;
    });
  }, [activeModel, columnMapping]);

  // Run Batch Column Design — ONE column type (section + rebar) per column line from GL to top
  const handleDesignAll = useCallback(() => {
    if (!activeModel || !activeProject) return;
    setIsDesigning(true);

    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const cover = activeProject.metadata.designSettings.clearCoverColumn || 40;
    const allowed = allowedColumnRebarDiameters || [12, 16, 20, 25];

    // Design each column individually with its own section and forces
    const newMap = new Map<number, ColumnDesignOutput>();

    for (const col of allColumns) {
      const memberHeight = col.length || 3.5;
      let memberPu = 0;
      let memberMux = 0;
      let memberMuy = 0;
      let memberGovLC = 1;

      const forces = activeModel.memberForces.filter((f) => f.memberId === col.id);
      for (const f of forces) {
        if (Math.abs(f.axial) > memberPu) {
          memberPu = Math.abs(f.axial);
          memberGovLC = f.loadCaseId;
        }
        if (Math.abs(f.mz) > memberMux) memberMux = Math.abs(f.mz);
        if (Math.abs(f.my) > memberMuy) memberMuy = Math.abs(f.my);
      }

      const startSup = activeModel.supports.get(col.startNodeId);
      const endSup = activeModel.supports.get(col.endNodeId);
      const supNodeId = startSup ? col.startNodeId : endSup ? col.endNodeId : null;
      if (supNodeId) {
        const reactions = activeModel.reactions.filter((r) => r.nodeId === supNodeId);
        for (const r of reactions) {
          if (r.fy > memberPu) {
            memberPu = r.fy;
            memberGovLC = r.loadCaseId;
          }
        }
      }
      if (memberPu <= 0) {
        const colInfo = columnMapping.get(col.id);
        if (colInfo?.supportNodeId) {
          const reactions = activeModel.reactions.filter((r) => r.nodeId === colInfo.supportNodeId);
          for (const r of reactions) {
            if (r.fy > memberPu) {
              memberPu = r.fy;
              memberGovLC = r.loadCaseId;
            }
          }
        }
      }
      if (memberPu <= 0) memberPu = 650;

      const b = Math.round((col.section.zd || 0.45) * 1000);
      const D = Math.round((col.section.yd || 0.55) * 1000);

      let memberDesign = ColumnDesignEngine.design({
        memberId: col.id,
        b,
        D,
        unsupportedHeight: memberHeight,
        fck,
        fy,
        cover,
        Pu: memberPu,
        Mux: memberMux,
        Muy: memberMuy,
        governingLoadCase: memberGovLC,
        allowedDiameters: allowed,
      });

      // Check if user has a custom rebar override for this specific member
      const memberCustomRebar = customRebarOverrides.get(col.id);
      if (memberCustomRebar) {
        memberDesign = {
          ...memberDesign,
          rebar: memberCustomRebar,
          calculationReport: ColumnDesignEngine.rebuildReportWithRebar(memberDesign, memberCustomRebar),
        };
      }

      newMap.set(col.id, memberDesign);
    }

    setDesignedColumns(newMap);
    setIsDesigning(false);
  }, [activeModel, activeProject, allColumns, customRebarOverrides, allowedColumnRebarDiameters, columnMapping]);

  // Auto-run if empty or on column update
  React.useEffect(() => {
    if (allColumns.length > 0) {
      handleDesignAll();
    }
  }, [allColumns, handleDesignAll]);

  // 1-Click Economical Auto-Design Engine for Columns
  const handleRunAutoDesign = () => {
    if (!activeModel || !activeProject || allColumns.length === 0) return;
    setIsAutoDesigning(true);

    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const cover = activeProject.metadata.designSettings.clearCoverColumn || 40;
    const allowed = allowedColumnRebarDiameters || [12, 16, 20, 25];

    const summary = ColumnOptimizationEngine.optimizeAllColumns(allColumns, activeModel, fck, fy, cover, allowed);
    setAutoDesignSummary(summary);
    setIsAutoDesigning(false);
  };

  // Re-run batch optimization with user-selected rebar diameters
  const handleReoptimizeWithDiameters = (allowedDiameters: number[]) => {
    if (!activeModel || !activeProject || allColumns.length === 0) return;
    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const cover = activeProject.metadata.designSettings.clearCoverColumn || 40;

    const summary = ColumnOptimizationEngine.optimizeAllColumns(
      allColumns,
      activeModel,
      fck,
      fy,
      cover,
      allowedDiameters
    );
    setAutoDesignSummary(summary);
  };

  // Confirm and apply all optimized column sections & rebars in 1 click
  const handleConfirmApplyAutoDesign = async () => {
    if (!autoDesignSummary) return;
    setIsApplyingAutoDesign(true);

    // Apply batch section size updates to STAAD model
    await batchUpdateSections(autoDesignSummary.sectionUpdates);

    // Sync optimized rebar layouts
    const newOverrides = new Map(customRebarOverrides);
    for (const res of autoDesignSummary.results) {
      newOverrides.set(res.memberId, res.optimizedDesign.rebar);
    }

    setCustomRebarOverrides(newOverrides);
    setIsApplyingAutoDesign(false);
    setAutoDesignSummary(null);
    handleDesignAll();
  };

  const handleSaveDesigns = async () => {
    if (designedColumns.size === 0) return;
    setIsSaving(true);
    try {
      await saveColumnDesigns(designedColumns, customRebarOverrides);
      setSaveSuccessMsg(`Successfully saved ${designedColumns.size} Column designs to project!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // 1-Click Auto-Orient All Columns (Rotate 90 degrees if it reduces steel ratio)
  const handleAutoOrientAll = async () => {
    setIsAutoOrienting(true);
    try {
      await autoOrientAllColumns();
      setCustomRebarOverrides(new Map());
      handleDesignAll();
    } finally {
      setIsAutoOrienting(false);
    }
  };

  // Rotate single column 90 degrees
  const handleRotateSingleColumn = async (memberId: number) => {
    const nextOverrides = new Map(customRebarOverrides);
    nextOverrides.delete(memberId);
    setCustomRebarOverrides(nextOverrides);
    await rotateColumnOrientation(memberId);
    handleDesignAll();
  };

  // Apply custom rebar from ColumnRebarEditModal
  const handleApplyCustomRebar = (memberId: number, customRebar: ColumnRebarOption, applyAll: boolean) => {
    const newOverrides = new Map(customRebarOverrides);
    if (applyAll) {
      for (const col of allColumns) {
        newOverrides.set(col.id, customRebar);
      }
    } else {
      newOverrides.set(memberId, customRebar);
    }
    setCustomRebarOverrides(newOverrides);
  };

  // Quick Preset Batch Applicator
  const handleApplyBatchPreset = (cornerDia: number, faceDia: number, nX: number, nY: number) => {
    const newOverrides = new Map(customRebarOverrides);
    for (const col of allColumns) {
      const b = Math.round((col.section.zd || 0.45) * 1000);
      const D = Math.round((col.section.yd || 0.55) * 1000);
      const opt = ColumnBarArrangement.createCustomRebarOption(cornerDia, faceDia, nX, nY, b, D, 40);
      newOverrides.set(col.id, opt);
    }
    setCustomRebarOverrides(newOverrides);
  };

  // 1-Click Auto-Configure Practical Rebar for All Columns
  const handleAutoPracticalRebarAll = () => {
    const newOverrides = new Map<number, ColumnRebarOption>();
    for (const col of allColumns) {
      const b = Math.round((col.section.zd || 0.45) * 1000);
      const D = Math.round((col.section.yd || 0.55) * 1000);
      const Ag = b * D;
      const Asc_req = 0.008 * Ag;
      const opt = ColumnBarArrangement.selectBars(Asc_req, b, D, 40, allowedColumnRebarDiameters);
      newOverrides.set(col.id, opt);
    }
    setCustomRebarOverrides(newOverrides);
  };

  // Auto-Fix all column errors & warnings
  const handleAutoFixAllWarnings = async () => {
    if (!activeModel || !activeProject || allColumns.length === 0) return;
    setIsAutoDesigning(true);

    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const cover = activeProject.metadata.designSettings.clearCoverColumn || 40;
    const allowed = allowedColumnRebarDiameters || [12, 16, 20, 25];

    const { sectionUpdates, rebarOverrides } = ColumnAutoFixEngine.autoFixAllNonPassingColumns(
      allColumns,
      activeModel,
      designedColumns,
      fck,
      fy,
      cover,
      allowed
    );

    if (sectionUpdates.length > 0) {
      await batchUpdateSections(sectionUpdates);
      const nextOverrides = new Map(customRebarOverrides);
      rebarOverrides.forEach((opt, memId) => nextOverrides.set(memId, opt));
      setCustomRebarOverrides(nextOverrides);
    }

    setIsAutoDesigning(false);
    handleDesignAll();
  };

  // Quick inline column section changer
  const handleQuickChangeColumnSection = async (memberId: number, zd: number, yd: number) => {
    const nextOverrides = new Map(customRebarOverrides);
    nextOverrides.delete(memberId);
    setCustomRebarOverrides(nextOverrides);

    const name = `${Math.round(zd * 1000)}x${Math.round(yd * 1000)} mm`;
    await updateMemberSection(memberId, yd, zd, name);
  };

  const handleSectionSaved = (memberId?: number) => {
    if (memberId) {
      const nextOverrides = new Map(customRebarOverrides);
      nextOverrides.delete(memberId);
      setCustomRebarOverrides(nextOverrides);
    } else {
      setCustomRebarOverrides(new Map());
    }
    handleDesignAll();
  };

  const warningCount = useMemo(() => {
    return Array.from(designedColumns.values()).filter(
      (c) => c.status !== 'PASS' || c.biaxialCheck.interactionRatio > 0.95 || c.rebar.pt_prov > 2.2
    ).length;
  }, [designedColumns]);

  // Count of designed ground columns for the filter badges
  const groundDesignedCount = useMemo(() => {
    return groundColumns.filter((c) => designedColumns.has(c.id)).length;
  }, [groundColumns, designedColumns]);

  const rows = useMemo(() => {
    const allRows = groundColumns.map((col) => {
      const design = designedColumns.get(col.id);
      const mapping = columnMapping.get(col.id);
      const colLabel = mapping?.columnLabel || `C-${col.id}`;
      const colSlNo = mapping?.columnSlNo || col.id;

      const b_mm = Math.round((col.section.zd || 0.45) * 1000);
      const D_mm = Math.round((col.section.yd || 0.55) * 1000);
      const fck = activeProject?.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
      const fy = activeProject?.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
      const wbsc = IS13920WeakBeamStrongColumn.evaluateForColumn(b_mm, D_mm, fck, fy, 850, 300, 450);

      return {
        memberId: col.id,
        columnSlNo: colSlNo,
        columnLabel: colLabel,
        dimensions: col.section.name || `${b_mm}x${D_mm} mm`,
        height: col.length,
        wbsc,
        design,
        b_mm,
        D_mm,
        rebarCallout: design?.rebar.callout || '',
      };
    });

    // Each column displayed individually — no grouping
    const individual: {
      memberIds: number[];
      columnLabels: string[];
      columnSlNo: number;
      dimensions: string;
      height: number;
      wbsc: any;
      design: any;
      count: number;
    }[] = [];

    for (const row of allRows) {
      individual.push({
        memberIds: [row.memberId],
        columnLabels: [row.columnLabel],
        columnSlNo: row.columnSlNo,
        dimensions: row.dimensions,
        height: row.height,
        wbsc: row.wbsc,
        design: row.design,
        count: 1,
      });
    }

    return individual
      .sort((a, b) => a.columnSlNo - b.columnSlNo)
      .filter((r) => {
        if (filterStatus === 'ALL') return true;
        return r.design?.status === filterStatus;
      });
  }, [groundColumns, designedColumns, filterStatus, activeProject, columnMapping]);

  const columns: ColumnDef<any>[] = [
    {
      header: 'COLUMNS (GROUPED)',
      accessorKey: 'columnSlNo',
      sortable: true,
      cell: (r) => (
        <div className="font-mono">
          <div className="flex items-center gap-1.5 flex-wrap">
            {r.columnLabels.map((label: string, i: number) => (
              <span key={label} className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                {label}
              </span>
            ))}
          </div>
          {r.count > 1 && (
            <span className="text-[9px] text-slate-500 mt-0.5 block">
              {r.count} cols · Mem #{r.memberIds.join(', ')}
            </span>
          )}
          {r.count === 1 && (
            <span className="text-[9px] text-slate-500 mt-0.5 block">
              Mem #{r.memberIds[0]}
            </span>
          )}
        </div>
      ),
      width: '200px',
    },
    {
      header: 'SIZE (b × D)',
      accessorKey: 'dimensions',
      cell: (r) => {
        const representativeId = r.memberIds[0];
        const col = allColumns.find((c) => c.id === representativeId);
        const curZd = col?.section.zd || 0.45;
        const curYd = col?.section.yd || 0.55;

        return (
          <div className="flex items-center gap-1">
            <select
              value={`${curZd.toFixed(2)}_${curYd.toFixed(2)}`}
              onChange={(e) => {
                const [zd, yd] = e.target.value.split('_').map(Number);
                // Apply to ALL members in the group
                for (const mid of r.memberIds) {
                  handleQuickChangeColumnSection(mid, zd, yd);
                }
              }}
              className="px-1.5 py-0.5 bg-white border border-ui-border rounded text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-secondary-brand shadow-2xs hover:border-slate-400"
            >
              {QUICK_COL_SIZES.map((opt) => (
                <option key={`${opt.zd}_${opt.yd}`} value={`${opt.zd.toFixed(2)}_${opt.yd.toFixed(2)}`}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                for (const mid of r.memberIds) handleRotateSingleColumn(mid);
              }}
              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title="Rotate 90° (Swap width and depth)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditMemberId(representativeId)}
              className="p-1 text-slate-400 hover:text-secondary-brand rounded hover:bg-slate-100 transition-colors"
              title="Custom Dimensions & WBSC Sizing"
            >
              ✎
            </button>
          </div>
        );
      },
      width: '210px',
    },
    {
      header: 'WBSC RATIO',
      align: 'center',
      cell: (r) => {
        const wbsc = r.wbsc;
        return (
          <span
            className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${
              wbsc.isCompliant ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
            title={wbsc.suggestion}
          >
            {wbsc.ratio} ({wbsc.isCompliant ? 'Ductile' : 'Weak'})
          </span>
        );
      },
      width: '115px',
    },
    {
      header: 'HEIGHT (m)',
      accessorKey: 'height',
      sortable: true,
      align: 'right',
      cell: (r) => <span className="font-mono">{r.height.toFixed(2)}</span>,
      width: '85px',
    },
    {
      header: 'CONCRETE (m³)',
      sortable: true,
      align: 'right',
      cell: (r) => {
        const vol = (r.b_mm / 1000) * (r.D_mm / 1000) * r.height * (r.count || 1);
        return (
          <span className="font-mono font-bold text-sky-700">
            {vol.toFixed(3)} m³
          </span>
        );
      },
      width: '110px',
    },
    {
      header: 'AXIAL Pu (kN)',
      align: 'right',
      cell: (r) => (
        <div className="font-mono text-right">
          <span className="font-bold text-slate-900 block">
            {r.design ? `${r.design.factoredDemandPu.toFixed(1)} kN` : '—'}
          </span>
          <span className="text-[10px] text-slate-500">
            Cap: {r.design ? `${Math.round(r.design.axialCheck.Pu_cap_short)} kN` : '—'}
          </span>
        </div>
      ),
      width: '130px',
    },
    {
      header: 'BIAXIAL IR',
      align: 'center',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">—</span>;
        const ir = r.design.biaxialCheck.interactionRatio;
        return (
          <span
            className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${
              ir <= 0.85
                ? 'bg-emerald-100 text-emerald-800'
                : ir <= 1.0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {ir.toFixed(3)}
          </span>
        );
      },
      width: '95px',
    },
    {
      header: 'MAIN STEEL (Asc & CONFINEMENT)',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">Pending</span>;
        const rebar = r.design.rebar;
        const isEco = rebar.pt_prov <= 1.25;
        return (
          <button
            type="button"
            onClick={() => setSelectedRebarEditColumn(r.design)}
            className="font-mono text-left group hover:bg-slate-50 p-1 rounded transition-colors w-full"
            title="Click to customize column rebar"
          >
            <div className="flex items-center gap-1.5">
              <span className={`font-bold ${isEco ? 'text-emerald-700' : rebar.pt_prov <= 2.0 ? 'text-amber-700' : 'text-rose-700'} group-hover:underline`}>
                {rebar.callout}
              </span>
              {rebar.isMixed && (
                <span className="px-1 py-0.2 bg-sky-100 text-sky-800 rounded text-[9px] font-bold">
                  Mixed
                </span>
              )}
              <span className="text-[10px] text-slate-400 group-hover:text-emerald-700">✎</span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{rebar.totalArea} mm² (pt = <strong className={isEco ? 'text-emerald-600' : 'text-amber-600'}>{rebar.pt_prov}%</strong>)</span>
              <span className="text-slate-600">
                sx:{rebar.spacingX} sy:{rebar.spacingY}mm
              </span>
            </div>
          </button>
        );
      },
      width: '240px',
    },
    {
      header: 'DUCTILE TIES (IS 13920)',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">Pending</span>;
        return <span className="font-mono text-[11px] text-emerald-800">{r.design.ductility.recommendedTieCallout}</span>;
      },
    },
    {
      header: 'STATUS',
      sortable: true,
      align: 'center',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono text-[10px]">READY</span>;
        const isPass = r.design.status === 'PASS';
        const isWarn = r.design.status === 'WARNING';
        return (
          <button
            type="button"
            onClick={() => setSelectedFixColumn(r.design)}
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer transition-all hover:scale-105 flex items-center gap-1 ${
              isPass
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                : isWarn
                ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 animate-pulse'
                : 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
            }`}
            title="Click to view Code Diagnostics & Auto-Fix"
          >
            <span>{r.design.status}</span>
            {!isPass && <Wrench className="w-2.5 h-2.5 inline" />}
          </button>
        );
      },
      width: '95px',
    },
    {
      header: 'ACTIONS',
      align: 'center',
      cell: (r) => (
        <div className="flex items-center gap-1 justify-center">
          <button
            onClick={() => {
              for (const mid of r.memberIds) handleRotateSingleColumn(mid);
            }}
            className="p-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded text-[10px] font-mono shadow-xs transition-colors flex items-center gap-0.5"
            title="Rotate 90° orientation"
          >
            <RotateCw className="w-3 h-3" />
            <span>90°</span>
          </button>
          <button
            onClick={() => setSelectedRebarEditColumn(r.design)}
            className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded border border-sky-200 text-[11px] font-mono shadow-xs transition-colors"
            title="Customize Rebar Configuration"
          >
            Rebar
          </button>

          {r.design && r.design.status !== 'PASS' ? (
            <button
              onClick={() => setSelectedFixColumn(r.design)}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-mono font-bold shadow-xs transition-colors flex items-center gap-1"
              title="1-Click Auto-Fix & Diagnostics"
            >
              <Wrench className="w-3 h-3" />
              <span>Fix</span>
            </button>
          ) : (
            <button
              onClick={() => setEditMemberId(r.memberIds[0])}
              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-200 text-[11px] font-mono shadow-xs transition-colors"
              title="Modify Section Size / WBSC Optimization"
            >
              Edit
            </button>
          )}

          <button
            onClick={() => r.design && setSelectedReport(r.design.calculationReport)}
            disabled={!r.design}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border text-[11px] font-mono shadow-xs transition-colors disabled:opacity-40"
            title="View Calculation Sheet"
          >
            Calc
          </button>
          <button
            onClick={() => r.design && setSelectedPMColumn(r.design)}
            disabled={!r.design}
            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-200 text-[11px] font-mono shadow-xs transition-colors disabled:opacity-40"
            title="View P-M Interaction Diagram"
          >
            P-M
          </button>
          <button
            onClick={() => r.design && setSelectedDrawingColumn(r.design)}
            disabled={!r.design}
            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-ui-border text-[11px] font-mono shadow-xs transition-colors disabled:opacity-40"
            title="View Cross Section Drawing"
          >
            Draw
          </button>
        </div>
      ),
      width: '235px',
    },
  ];

  const handleExport = () => {
    exportToCsv(
      rows.map((r) => ({
        Columns: r.columnLabels.join(', '),
        MemberIds: r.memberIds.join(', '),
        Size: r.dimensions,
        Height_m: r.height,
        InteractionRatio: r.design?.biaxialCheck.interactionRatio || 0,
        MainRebar: r.design?.rebar.callout || '',
        SteelPercentage_pt: r.design?.rebar.pt_prov || 0,
        Ties: r.design?.ductility.recommendedTieCallout || '',
        Status: r.design?.status || 'PENDING',
      })),
      'IS456_IS13920_Column_Design_Schedule.csv'
    );
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 p-5 bg-ui-background overflow-y-auto font-sans">
      {/* Global hide bar */}
      <div className="flex items-center justify-end gap-1.5 -mb-1">
        <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider">Panels:</span>
        <button
          type="button"
          onClick={() => { setShowBanner(true); setShowRebar(true); setShowFilters(true); setShowTable(true); }}
          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-[11px] font-mono shadow-2xs flex items-center gap-1"
        >
          <Eye className="w-3 h-3" /> Show All
        </button>
        <button
          type="button"
          onClick={() => { setShowBanner(false); setShowRebar(false); setShowFilters(false); setShowTable(false); }}
          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-[11px] font-mono shadow-2xs flex items-center gap-1"
        >
          <EyeOff className="w-3 h-3" /> Hide All
        </button>
      </div>

      <CollapsiblePanel
        title="IS 456:2000 & IS 13920:2016 RCC COLUMN DESIGN ENGINE"
        icon={<Layers className="w-5 h-5 text-emerald-600" />}
        storageKey="column-banner"
        open={showBanner}
        onToggle={setShowBanner}
        variant="card"
        contentClassName="p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 mt-0.5">
              Biaxial bending interaction (Bresler method), 1-click economical auto-designer, mixed rebar (4-T16 + 4-T12, 4-T20 + 4-T16), 90° orientation optimization, P-M curves, and ductile confining ties.
            </p>
          </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* ⚡ 1-Click Auto-Design All Columns Button */}
          <button
            onClick={handleRunAutoDesign}
            disabled={isAutoDesigning || allColumns.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold rounded shadow transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            title="Automatically optimize cross sections and rebars to be as economical as possible (target 0.8% - 1.2% pt)"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>{isAutoDesigning ? 'Optimizing All Columns...' : '⚡ 1-Click Auto-Design All Columns'}</span>
          </button>

          {/* Quick Apply Rebar to All */}
          <select
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'PRACTICAL_AUTO') handleAutoPracticalRebarAll();
              else if (val === '8T20') handleApplyBatchPreset(20, 20, 1, 1);
              else if (val === '4T20_4T16') handleApplyBatchPreset(20, 16, 1, 1);
              else if (val === '8T16') handleApplyBatchPreset(16, 16, 1, 1);
              else if (val === '4T16_4T12') handleApplyBatchPreset(16, 12, 1, 1);
              else if (val === '10T16') handleApplyBatchPreset(16, 16, 2, 1);
              else if (val === '12T16') handleApplyBatchPreset(16, 16, 2, 2);
              else if (val === '4T20_8T16') handleApplyBatchPreset(20, 16, 2, 2);
              e.target.value = '';
            }}
            defaultValue=""
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-emerald-800 font-bold focus:outline-hidden"
          >
            <option value="" disabled>
              ⚡ Apply Rebar Pattern to All...
            </option>
            <option value="PRACTICAL_AUTO">⚡ Auto-Configure Most Economical (0.8% - 1.0% pt)</option>
            <option value="4T16_4T12">Set all to 4-T16 + 4-T12 (8 bars, 1256 mm² · ~0.93% pt)</option>
            <option value="8T16">Set all to 8-T16 (8 bars, 1608 mm² · ~1.19% pt)</option>
            <option value="4T20_4T16">Set all to 4-T20 + 4-T16 (8 bars, 2061 mm²)</option>
            <option value="8T20">Set all to 8-T20 (8 bars, 2513 mm²)</option>
            <option value="10T16">Set all to 10-T16 (10 bars, 2011 mm²)</option>
            <option value="12T16">Set all to 12-T16 (12 bars, 2413 mm²)</option>
            <option value="4T20_8T16">Set all to 4-T20 + 8-T16 (12 bars, 2865 mm²)</option>
          </select>

          {warningCount > 0 && (
            <button
              onClick={handleAutoFixAllWarnings}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-mono text-xs font-bold rounded shadow transition-all animate-bounce"
              title="1-Click Auto-Fix all column warnings"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ Auto-Fix All ({warningCount}) Warnings</span>
            </button>
          )}

          {designedColumns.size > 0 && (
            <>
              <button
                onClick={() => {
                  if (activeModel && activeProject) {
                    CalculationPdfService.exportColumnsCalculationsPdf(activeModel, activeProject);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors shadow-2xs font-semibold"
                title="Export Detailed Step-by-Step Column Calculations PDF (IS 456 & IS 13920)"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Calculations PDF
              </button>

              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-ui-border rounded transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </>
          )}

          <button
            onClick={handleSaveDesigns}
            disabled={isSaving || designedColumns.size === 0}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-mono text-xs font-bold rounded shadow transition-all disabled:opacity-50"
            title="Save designed columns and custom rebar configurations to project"
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
            <span>{isDesigning ? 'Designing...' : 'Re-calculate'}</span>
          </button>
        </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="UNIVERSAL REBAR SELECTION (RCC Column)"
        icon={<Layers className="w-4 h-4 text-emerald-600" />}
        storageKey="column-rebar"
        open={showRebar}
        onToggle={setShowRebar}
        variant="card"
        contentClassName="p-3"
      >
        <UniversalRebarBar
          moduleName="RCC Column"
          showOrientationTool={true}
          onAutoOrient90={handleAutoOrientAll}
          isAutoOrienting={isAutoOrienting}
        />
      </CollapsiblePanel>

      {/* Save Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      <CollapsiblePanel
        title="Filter by Status"
        storageKey="column-filters"
        open={showFilters}
        onToggle={setShowFilters}
        variant="card"
        contentClassName="p-3"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 font-semibold uppercase">Filter Status:</span>
            {(['ALL', 'PASS', 'WARNING', 'FAIL'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
                  filterStatus === st
                    ? 'bg-deep-navy text-white border-deep-navy shadow-sm'
                    : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
                }`}
              >
                {st} (                {st === 'ALL' ? groundColumns.length : Array.from(designedColumns.values()).filter((c) => c.status === st && groundColumns.some((gc) => gc.id === c.memberId)).length})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 font-mono text-xs bg-slate-100 px-3 py-1 rounded border border-ui-border">
            <span className="text-slate-500 font-semibold">Total Columns Concrete:</span>
            <span className="font-bold text-sky-700">
              {rows.reduce((sum: number, r: any) => sum + (r.b_mm / 1000) * (r.D_mm / 1000) * r.height * (r.count || 1), 0).toFixed(2)} m³
            </span>
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="RCC COLUMN SCHEDULE & BIAXIAL INTERACTION RATIOS"
        icon={<Layers className="w-4 h-4 text-sky-700" />}
        storageKey="column-table"
        open={showTable}
        onToggle={setShowTable}
        variant="card"
        className="flex-1 flex flex-col min-h-[420px]"
        contentClassName="p-0"
      >
        <div className="flex-1 min-h-[380px] flex flex-col overflow-hidden">
          <DataTable
            data={rows}
            columns={columns}
            title="RCC COLUMN SCHEDULE & BIAXIAL INTERACTION RATIOS"
            searchPlaceholder="Search by column # (e.g. C-1), member #, or size..."
            searchFilter={(item, q) =>
              item.columnLabels.some((l: string) => l.toLowerCase().includes(q)) ||
              item.memberIds.some((id: number) => String(id).includes(q)) ||
              item.dimensions.toLowerCase().includes(q) ||
              String(item.design?.rebar.callout || '').toLowerCase().includes(q)
            }
            onExportCsv={handleExport}
          />
        </div>
      </CollapsiblePanel>

      {/* Calculation Modal */}
      <CalculationModal report={selectedReport} onClose={() => setSelectedReport(null)} />

      {/* P-M Diagram Modal */}
      {selectedPMColumn && (
        <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
          <div className="w-full max-w-2xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold text-deep-navy">
                P-M INTERACTION ENVELOPE — COLUMN C-{selectedPMColumn.memberId}
              </h3>
              <button onClick={() => setSelectedPMColumn(null)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <PMDiagramCanvas column={selectedPMColumn} />
            </div>
          </div>
        </div>
      )}

      {/* IS 13920 Longitudinal Elevation & Cross Section Drawing Modal */}
      {selectedDrawingColumn && (
        <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
          <div className="w-full max-w-3xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold text-deep-navy">
                CROSS SECTION & ELEVATION DETAILING — COLUMN C-{selectedDrawingColumn.memberId}
              </h3>
              <button onClick={() => setSelectedDrawingColumn(null)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <ColumnDrawingSvg column={selectedDrawingColumn} />
            </div>
          </div>
        </div>
      )}

      {/* Warning Diagnostics & Auto-Fix Modal */}
      {selectedFixColumn && (
        <WarningFixModal
          columnDesign={selectedFixColumn}
          isOpen={true}
          onClose={() => {
            setSelectedFixColumn(null);
            handleDesignAll();
          }}
          onAutoFixApplied={() => {
            handleDesignAll();
          }}
        />
      )}

      {/* Interactive Custom Rebar Layout Modal */}
      {selectedRebarEditColumn && (
        <ColumnRebarEditModal
          column={selectedRebarEditColumn}
          isOpen={true}
          onClose={() => setSelectedRebarEditColumn(null)}
          onApplyRebar={handleApplyCustomRebar}
          allowedDiameters={allowedColumnRebarDiameters}
        />
      )}

      {/* 1-Click Auto-Design Optimization Summary Modal */}
      <ColumnAutoDesignModal
        summary={autoDesignSummary}
        isOpen={autoDesignSummary !== null}
        onClose={() => setAutoDesignSummary(null)}
        onConfirmApply={handleConfirmApplyAutoDesign}
        onReoptimizeWithDiameters={handleReoptimizeWithDiameters}
        isApplying={isApplyingAutoDesign}
      />

      {/* Section Edit Modal for Custom Dimensions */}
      <SectionEditModal
        memberId={editMemberId}
        isOpen={editMemberId !== null}
        onClose={() => setEditMemberId(null)}
        onSaved={handleSectionSaved}
      />
    </div>
  );
};
