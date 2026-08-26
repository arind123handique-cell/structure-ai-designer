import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { PileCapDesignEngine, PileCapDesignOutput } from './pileCapDesignEngine';
import { CombinedPileCapEngine, CombinedPileCapGroup } from './combinedPileCapEngine';
import { PileCapDrawingSvg } from './PileCapDrawingSvg';
import { PileCapOptimizationEngine, BatchPileCapOptimizationSummary } from './pileCapOptimizationEngine';
import { PileCapAutoDesignModal } from './PileCapAutoDesignModal';
import { PileCapEditModal } from './PileCapEditModal';
import { CombinedPileCapEditModal } from './CombinedPileCapEditModal';
import { SplitPileCapModal } from './SplitPileCapModal';
import { CalculationModal } from '@/features/calculations/CalculationModal';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { DataTable, ColumnDef } from '@/components/tables/DataTable';
import { exportToCsv } from '@/utils/exportUtils';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { PileDesignEngine, ProjectPileType } from '@/features/design/pile/pileDesignEngine';
import { UniversalRebarBar } from '@/features/design/common/UniversalRebarBar';
import { CollapsiblePanel } from '@/components/common/CollapsiblePanel';
import {
  Play,
  Box,
  FileText,
  Download,
  X,
  Sparkles,
  Edit3,
  RotateCcw,
  Save,
  CheckCircle2,
  Link2,
  Unlink,
  Layers,
  ShieldCheck,
  RotateCw,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const PileCapDesignView: React.FC = () => {
  const {
    activeModel,
    activeProject,
    projectPileTypes: storePileTypes,
    supportPileAssignments,
    customPileCapOverrides,
    customCombinedCapOverrides,
    manualMergedPileCapGroups,
    detachedCombinedCapNodeIds,
    selectedSupportNodeIds,
    selectSupportNode,
    clearSelectedSupportNodes,
    mergeSelectedPileCaps,
    unmergePileCapGroup,
    splitCombinedPileCapGroup,
    detachNodesFromCombinedPileCap,
    clearDetachedCombinedCapNodes,
    assignPileTypeToSupport,
    setCustomPileCapOverride,
    clearCustomPileCapOverride,
    setCustomCombinedCapOverride,
    clearCustomCombinedCapOverride,
    savePileCapDesigns,
  } = useProjectStore();

  const [designedCaps, setDesignedCaps] = useState<Map<number, PileCapDesignOutput>>(new Map());
  const [selectedReport, setSelectedReport] = useState<DetailedCalculationReport | null>(null);
  const [selectedDrawingCap, setSelectedDrawingCap] = useState<PileCapDesignOutput | null>(null);
  const [selectedEditCap, setSelectedEditCap] = useState<PileCapDesignOutput | null>(null);
  const [selectedEditCombinedCap, setSelectedEditCombinedCap] = useState<CombinedPileCapGroup | null>(null);
  const [selectedGroupToSplit, setSelectedGroupToSplit] = useState<CombinedPileCapGroup | null>(null);
  const [isDesigning, setIsDesigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Auto-design optimization state
  const [autoDesignSummary, setAutoDesignSummary] = useState<BatchPileCapOptimizationSummary | null>(null);
  const [isAutoDesignModalOpen, setIsAutoDesignModalOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Resolve available project pile types
  const availablePileTypes: ProjectPileType[] = useMemo(() => {
    if (storePileTypes && storePileTypes.length > 0) return storePileTypes;
    return PileDesignEngine.getDefaultProjectPileTypes();
  }, [storePileTypes]);

  // Column Support Mapping (C-1 -> Joint #1)
  const columnSupportMapping = useMemo(() => {
    return ColumnNumberingService.getColumnSupportMapping(activeModel);
  }, [activeModel]);

  // All structural support nodes
  const supportNodes = useMemo(() => {
    if (!activeModel || !activeModel.supports) return [];
    const list = Array.from(activeModel.supports.values());
    return list.sort((a, b) => {
      const slA = columnSupportMapping.get(a.nodeId)?.columnSlNo || a.nodeId;
      const slB = columnSupportMapping.get(b.nodeId)?.columnSlNo || b.nodeId;
      return slA - slB;
    });
  }, [activeModel, columnSupportMapping]);

  // Batch Pile Cap Design with Standardized Uniform Sizing per Pile Count
  const handleDesignAll = useCallback(() => {
    if (!activeModel || !activeProject || supportNodes.length === 0) return;
    setIsDesigning(true);

    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const defaultPile = availablePileTypes[0];
    const inputs: import('./pileCapDesignEngine').PileCapDesignInput[] = [];

    for (const sup of supportNodes) {
      const reactions = activeModel.reactions?.filter((r) => r.nodeId === sup.nodeId) || [];
      let maxFy = 0;
      let maxMx = 0;
      let maxMy = 0;
      let govLC = 1;

      for (const r of reactions) {
        if (Math.abs(r.fy) > maxFy) {
          maxFy = Math.abs(r.fy);
          maxMx = Math.abs(r.mx);
          maxMy = Math.abs(r.my);
          govLC = r.loadCaseId;
        }
      }

      if (maxFy <= 0 && activeModel.memberForces && activeModel.members) {
        const connectedMemberIds = new Set(
          Array.from(activeModel.members.values())
            .filter((m) => m.startNodeId === sup.nodeId || m.endNodeId === sup.nodeId)
            .map((m) => m.id)
        );
        const connectedForces = activeModel.memberForces.filter((f) => connectedMemberIds.has(f.memberId));
        for (const cf of connectedForces) {
          if (Math.abs(cf.axial) > maxFy) {
            maxFy = Math.abs(cf.axial);
            govLC = cf.loadCaseId;
          }
        }
      }

      if (maxFy <= 0) {
        maxFy = 650;
        maxMx = 45;
        maxMy = 25;
        govLC = 9;
      }

      const assignedTypeId = supportPileAssignments[sup.nodeId] || defaultPile.id;
      const assignedPile = availablePileTypes.find((p) => p.id === assignedTypeId) || defaultPile;
      const overrides = customPileCapOverrides[sup.nodeId];

      inputs.push({
        supportNodeId: sup.nodeId,
        colWidth: 450,
        colDepth: 550,
        pileDiameter: assignedPile.diameter,
        safePileCapacity: assignedPile.safeWorkingLoad,
        customPileCount: overrides?.customPileCount,
        customCapLength: overrides?.customCapLength,
        customCapWidth: overrides?.customCapWidth,
        customCapDepth: overrides?.customCapDepth,
        assignedPileTypeId: assignedPile.id,
        factoredVerticalLoad: maxFy,
        factoredMomentX: maxMx,
        factoredMomentY: maxMy,
        fck,
        fy,
        governingLoadCase: govLC,
      });
    }

    // Batch design with uniform dimensions & governing depth for each pile count category
    const standardizedMap = PileCapDesignEngine.batchDesignAndStandardize(inputs);

    setDesignedCaps(standardizedMap);
    setIsDesigning(false);
  }, [activeModel, activeProject, supportNodes, availablePileTypes, supportPileAssignments, customPileCapOverrides]);

  useEffect(() => {
    if (supportNodes.length > 0) {
      handleDesignAll();
    }
  }, [supportNodes.length, handleDesignAll]);

  // Trigger 1-Click Economical Auto-Design
  const handleTriggerAutoDesign = (allowedDiameters: number[] = [12, 16, 20, 25]) => {
    if (!activeModel) return;
    setIsOptimizing(true);

    const defaultPile = availablePileTypes[0];
    const summary = PileCapOptimizationEngine.optimizeAllPileCaps(
      activeModel,
      activeProject,
      allowedDiameters,
      defaultPile.safeWorkingLoad,
      defaultPile.diameter
    );

    setAutoDesignSummary(summary);
    setIsAutoDesignModalOpen(true);
    setIsOptimizing(false);
  };

  // Confirm and apply batch optimized pile caps
  const handleConfirmApplyAutoDesign = () => {
    if (!autoDesignSummary) return;

    const newMap = new Map<number, PileCapDesignOutput>();
    for (const res of autoDesignSummary.results) {
      newMap.set(res.supportNodeId, res.fullDesignOutput);
    }

    setDesignedCaps(newMap);
    setIsAutoDesignModalOpen(false);
  };

  // Save manual edit from PileCapEditModal
  const handleSaveManualEdit = (
    nodeId: number,
    overrides: {
      pileTypeId?: string;
      customPileCount?: number;
      customCapLength?: number;
      customCapWidth?: number;
      customCapDepth?: number;
    }
  ) => {
    if (overrides.pileTypeId) {
      assignPileTypeToSupport(nodeId, overrides.pileTypeId);
    }
    setCustomPileCapOverride(nodeId, {
      customPileCount: overrides.customPileCount,
      customCapLength: overrides.customCapLength,
      customCapWidth: overrides.customCapWidth,
      customCapDepth: overrides.customCapDepth,
    });
  };

  // Reset custom overrides to auto
  const handleResetManualEdit = (nodeId: number) => {
    clearCustomPileCapOverride(nodeId);
  };

  // Save all pile cap designs permanently
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await savePileCapDesigns();
      setSaveSuccessMessage('Pile cap designs & manual edits saved successfully to project database!');
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Failed to save pile cap designs:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Compute Combined & Shear Wall Pile Caps (IS 2911 / IS 456)
  const combinedPileCaps: CombinedPileCapGroup[] = useMemo(() => {
    if (!activeModel) return [];
    const defaultDp = availablePileTypes[0]?.diameter || 350;
    const defaultQsafe = availablePileTypes[0]?.safeWorkingLoad || 280;
    return CombinedPileCapEngine.detectAndDesignAll(
      activeModel,
      designedCaps,
      defaultDp,
      manualMergedPileCapGroups,
      detachedCombinedCapNodeIds,
      customCombinedCapOverrides,
      defaultQsafe
    );
  }, [
    activeModel,
    designedCaps,
    availablePileTypes,
    manualMergedPileCapGroups,
    detachedCombinedCapNodeIds,
    customCombinedCapOverrides,
  ]);

  // Save combined pile cap manual edit
  const handleSaveCombinedOverride = (groupId: string, override: any) => {
    setCustomCombinedCapOverride(groupId, override);
  };

  // Reset combined pile cap override
  const handleResetCombinedOverride = (groupId: string) => {
    clearCustomCombinedCapOverride(groupId);
  };

  const absorbedNodeMap = useMemo(() => {
    const map = new Map<number, CombinedPileCapGroup>();
    combinedPileCaps.forEach((grp) => {
      grp.absorbedIndividualCaps.forEach((id) => map.set(id, grp));
    });
    return map;
  }, [combinedPileCaps]);

  // Pile cap mark per pile count: 2P=PC1, 3P=PC2, 4P=PC3 (PC = pileCount -1) to match 2D plan annotation
  const { pileCountMarkMap, maxIndividualPcIndex } = useMemo(() => {
    const standaloneNodes = supportNodes.filter((s) => !absorbedNodeMap.has(s.nodeId));
    const counts = Array.from(
      new Set(
        standaloneNodes.map((s) => designedCaps.get(s.nodeId)?.pileCount || 4)
      )
    ).sort((a, b) => a - b);

    const map = new Map<number, string>();
    const used = new Set<string>();
    counts.forEach((cnt) => {
      let pcNum = Math.max(1, cnt - 1);
      while (used.has(`PC${pcNum}`)) pcNum++;
      used.add(`PC${pcNum}`);
      map.set(cnt, `PC${pcNum}`);
    });

    return {
      pileCountMarkMap: map,
      maxIndividualPcIndex: Math.max(...Array.from(map.values()).map(v => parseInt(v.replace('PC',''),10)), 1),
    };
  }, [supportNodes, absorbedNodeMap, designedCaps]);

  // Combined caps: same PC = pileCount -1 rule (e.g. 6P=PC5) so 2D plan and table match
  const combinedCapMarks = useMemo(() => {
    const map = new Map<string, string>();
    const used = new Set<string>(Array.from(pileCountMarkMap.values()));
    combinedPileCaps.forEach((grp) => {
      let pcNum = Math.max(1, grp.pileCount - 1);
      while (used.has(`PC${pcNum}`)) pcNum++;
      used.add(`PC${pcNum}`);
      map.set(grp.groupId, `PC${pcNum}`);
    });
    return map;
  }, [combinedPileCaps, pileCountMarkMap]);

  // Individual Table Rows: Excludes columns that are absorbed into combined pile caps to avoid repetition
  const rows = useMemo(() => {
    const standaloneSupportNodes = supportNodes.filter((sup) => !absorbedNodeMap.has(sup.nodeId));

    // Build flat rows first
    const flatRows = standaloneSupportNodes.map((sup) => {
      const design = designedCaps.get(sup.nodeId);
      const supInfo = columnSupportMapping.get(sup.nodeId);
      const colLabel = supInfo?.columnLabel || `C${sup.nodeId}`;
      const mark = design ? (pileCountMarkMap.get(design.pileCount) || `PC${Math.max(1, design.pileCount - 1)}`) : 'PC1';
      const defaultPile = availablePileTypes[0];
      const assignedTypeId = supportPileAssignments[sup.nodeId] || defaultPile.id;

      return {
        nodeId: sup.nodeId,
        colSlNo: supInfo?.columnSlNo || sup.nodeId,
        columnLabel: colLabel,
        mark,
        assignedTypeId,
        design,
        isCustomized: !!customPileCapOverrides[sup.nodeId],
      };
    });

    // Each pile cap displayed individually — no grouping
    const individual: {
      nodeIds: number[];
      columnLabels: string[];
      colSlNo: number;
      mark: string;
      assignedTypeId: string;
      design: any;
      count: number;
      isCustomized: boolean;
    }[] = [];

    for (const row of flatRows) {
      individual.push({
        nodeIds: [row.nodeId],
        columnLabels: [row.columnLabel],
        colSlNo: row.colSlNo,
        mark: row.mark,
        assignedTypeId: row.assignedTypeId,
        design: row.design,
        count: 1,
        isCustomized: row.isCustomized,
      });
    }

    return individual.sort((a, b) => a.colSlNo - b.colSlNo);
  }, [supportNodes, designedCaps, columnSupportMapping, availablePileTypes, supportPileAssignments, absorbedNodeMap, pileCountMarkMap, customPileCapOverrides]);

  const columns: ColumnDef<any>[] = [
    {
      header: 'SELECT',
      accessorKey: 'nodeIds',
      cell: (r) => (
        <div className="flex items-center justify-center">
          <span className="text-[9px] font-mono text-slate-500">
            {r.nodeIds.length > 1 ? `${r.nodeIds.length} caps` : `#${r.nodeIds[0]}`}
          </span>
        </div>
      ),
      width: '60px',
      align: 'center',
    },
    {
      header: 'MARK (GROUPED)',
      accessorKey: 'colSlNo',
      sortable: true,
      cell: (r) => (
        <div className="font-mono">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-xs">
              {r.mark}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {r.columnLabels.map((label: string, i: number) => (
                <span key={label} className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                  {label}
                </span>
              ))}
            </div>
          </div>
          {r.count > 1 && (
            <span className="text-[9px] text-slate-500 mt-0.5 block">
              {r.count} caps · Joints #{r.nodeIds.join(', ')}
            </span>
          )}
          {r.count === 1 && (
            <span className="text-[9px] text-slate-500 mt-0.5 block">
              Joint #{r.nodeIds[0]}
            </span>
          )}
        </div>
      ),
      width: '240px',
    },
    {
      header: 'MAX AXIAL Pu (GOV. LC)',
      align: 'right',
      cell: (r) => (
        <div className="font-mono text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="font-bold text-slate-900">
              {r.design ? `${r.design.factoredVerticalLoad.toFixed(1)} kN` : '—'}
            </span>
            <span className="px-1 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-bold">
              LC {r.design?.governingLoadCase || 1}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block">
            P_work: {r.design ? `${r.design.workingVerticalLoad.toFixed(1)} kN` : '—'}
          </span>
        </div>
      ),
      width: '180px',
    },
    {
      header: 'PILES REQ. (Pu / Qsafe)',
      align: 'center',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">—</span>;
        return (
          <div className="flex items-center justify-center gap-1">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              {r.design.pileCount}-Pile Cap ({r.mark})
            </span>
            {r.count > 1 && (
              <span className="text-[9px] px-1 bg-slate-100 text-slate-600 rounded font-mono font-bold">
                ×{r.count}
              </span>
            )}
            {r.isCustomized && (
              <span className="text-[9px] px-1 bg-amber-100 text-amber-800 rounded font-mono font-bold" title="Manually edited">
                Manual
              </span>
            )}
          </div>
        );
      },
      width: '180px',
    },
    {
      header: 'CAP SIZE (L × B × D)',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">—</span>;
        return (
          <div className="font-mono text-xs">
            <div className="flex items-center gap-1 font-bold text-slate-900">
              <span>{r.design.capLength} × {r.design.capWidth} × {r.design.capDepth}</span>
              <button
                onClick={() => setSelectedEditCap(r.design)}
                className="text-slate-400 hover:text-secondary-brand transition-colors ml-0.5"
                title="Edit Cap Dimensions"
              >
                ✎
              </button>
            </div>
            <span className="text-[10px] text-slate-500">
              d = {r.design.effectiveDepth} mm • P/pile = {r.design.loadPerPile} kN
            </span>
          </div>
        );
      },
      width: '190px',
    },
    {
      header: 'PUNCHING SHEAR',
      cell: (r) => {
        if (!r.design || !r.design.columnPunching) return <span className="text-slate-400 font-mono">—</span>;
        const p = r.design.columnPunching;
        const isSafe = p.status === 'PASS';
        return (
          <div className="font-mono text-[11px]">
            <div className="flex items-center gap-1">
              <span className={isSafe ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>
                τvp = {p.tau_vp} N/mm²
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              Cap: {p.tau_cp} N/mm²
            </span>
          </div>
        );
      },
      width: '150px',
    },
    {
      header: 'REBAR MESH (BTH / TOP)',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">—</span>;
        return (
          <div className="font-mono text-xs">
            <span className="font-bold text-orange-700 block">
              {r.design.rebarCalloutX}
            </span>
            <span className="text-[10px] text-slate-500 block">
              {r.design.topRebarCallout}
            </span>
          </div>
        );
      },
      width: '180px',
    },
    {
      header: 'STATUS',
      sortable: true,
      align: 'center',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono text-[10px]">READY</span>;
        const isPass = r.design.status === 'PASS';
        return (
          <span
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
              isPass
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}
          >
            {r.design.status}
          </span>
        );
      },
      width: '90px',
    },
    {
      header: 'ACTIONS',
      align: 'center',
      cell: (r) => (
        <div className="flex items-center gap-1 justify-center">
          <button
            onClick={() => setSelectedEditCap(r.design)}
            disabled={!r.design}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border text-[11px] font-mono shadow-2xs transition-colors disabled:opacity-40"
            title="Edit Cap Dimensions"
          >
            Edit
          </button>
          <button
            onClick={() => r.design && setSelectedReport(r.design.calculationReport)}
            disabled={!r.design}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border text-[11px] font-mono shadow-2xs transition-colors disabled:opacity-40"
            title="View Calculation Sheet"
          >
            Calc
          </button>
          <button
            onClick={() => r.design && setSelectedDrawingCap(r.design)}
            disabled={!r.design}
            className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded border border-sky-200 text-[11px] font-mono shadow-2xs transition-colors disabled:opacity-40"
            title="View Cross Section Drawing"
          >
            Draw
          </button>
        </div>
      ),
      width: '160px',
    },
  ];


  const handleExport = () => {
    exportToCsv(
      rows.map((r) => ({
        PileCapMark: r.mark,
        ColumnLabels: r.columnLabels.join(', '),
        SupportJoints: r.nodeIds.join(', '),
        AssignedPileType: r.assignedTypeId,
        FactoredAxialPu_kN: r.design?.factoredVerticalLoad || 0,
        GoverningLoadCase: r.design?.governingLoadCase || 1,
        FactoredMomentX_kNm: r.design?.factoredMomentX || 0,
        FactoredMomentY_kNm: r.design?.factoredMomentY || 0,
        WorkingAxial_kN: r.design?.workingVerticalLoad || 0,
        PileCount: r.design?.pileCount || 4,
        CapLength_mm: r.design?.capLength || 2500,
        CapWidth_mm: r.design?.capWidth || 2500,
        CapDepth_mm: r.design?.capDepth || 800,
        LoadPerPile_kN: r.design?.loadPerPile || 0,
        BottomMatRebar: r.design?.rebarCalloutX || '',
        TopMatRebar: r.design?.topRebarCallout || '',
        SideFaceRebar: r.design?.sideFaceRebarCallout || '',
        Status: r.design?.status || 'PENDING',
        GroupCount: r.count,
      })),
      'IS456_PileCap_Design_Schedule.csv'
    );
  };

  // Hide toggles for each panel group
  const [showBanner, setShowBanner] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [showCombined, setShowCombined] = useState(true);
  const [showTable, setShowTable] = useState(true);

  return (
    <div className="flex flex-col h-full space-y-4 p-5 bg-ui-background overflow-y-auto font-sans">
      {/* Global Hide / Show All */}
      <div className="flex items-center justify-end gap-1.5 -mb-1">
        <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider">Panels:</span>
        <button
          type="button"
          onClick={() => { setShowBanner(true); setShowRebar(true); setShowCombined(true); setShowTable(true); }}
          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-[11px] font-mono shadow-2xs flex items-center gap-1"
        >
          <Eye className="w-3 h-3" /> Show All
        </button>
        <button
          type="button"
          onClick={() => { setShowBanner(false); setShowRebar(false); setShowCombined(false); setShowTable(false); }}
          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-[11px] font-mono shadow-2xs flex items-center gap-1"
        >
          <EyeOff className="w-3 h-3" /> Hide All
        </button>
      </div>

      {/* Top Banner */}
      <CollapsiblePanel
        title="IS 456:2000 & SP:34 RIGID PILE CAP DESIGN ENGINE"
        icon={<Box className="w-4 h-4 text-indigo-600" />}
        storageKey="pilecap-banner"
        open={showBanner}
        onToggle={setShowBanner}
        contentClassName="p-4"
        variant="card"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              Auto-configured by single pile capacity $Q_{'{'}safe{'}'}$, two-way column & pile punching shear, flexural bottom mats, and top shrinkage grids.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* 1-Click Auto Design Button */}
            <button
              onClick={() => handleTriggerAutoDesign()}
              disabled={isOptimizing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-xs font-bold rounded shadow-2xs transition-all disabled:opacity-50"
              title="Automatically size pile cap thickness & rebars for maximum economy"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isOptimizing ? 'Optimizing...' : 'Auto Design (Economical)'}</span>
            </button>

            {designedCaps.size > 0 && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-ui-border rounded transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}

            {/* Save Pile Cap Designs Button */}
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold rounded shadow-2xs transition-all disabled:opacity-50"
              title="Save all pile cap sizes, pile assignments, and manual edits to project database and 3D model"
            >
              <Save className="w-3.5 h-3.5 text-blue-100" />
              <span>{isSaving ? 'Saving...' : '💾 Save Designs'}</span>
            </button>

            <button
              onClick={handleDesignAll}
              disabled={isDesigning}
              className="flex items-center gap-2 px-4 py-1.5 bg-secondary-brand hover:bg-blue-700 text-white font-mono text-xs font-semibold rounded shadow transition-all disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isDesigning ? 'Designing...' : 'Re-calculate All'}</span>
            </button>
          </div>
        </div>
      </CollapsiblePanel>

      {/* Universal Rebar Master Selection Toolbar */}
      <CollapsiblePanel
        title="UNIVERSAL REBAR SELECTION (Foundation Pile Cap)"
        icon={<Layers className="w-4 h-4 text-emerald-600" />}
        storageKey="pilecap-rebar"
        open={showRebar}
        onToggle={setShowRebar}
        contentClassName="p-0"
        variant="card"
      >
        <div className="p-3">
          <UniversalRebarBar moduleName="Foundation Pile Cap" />
        </div>
      </CollapsiblePanel>

      {/* Save Success Alert */}
      {saveSuccessMessage && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded font-mono text-xs shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{saveSuccessMessage}</span>
        </div>
      )}

      {/* Multi-Selection Merge Action Bar */}
      {selectedSupportNodeIds.length >= 2 && (
        <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-lg border border-indigo-500/60 shadow-xl animate-in slide-in-from-top-2 font-mono text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-md">
              <Link2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm text-indigo-100">
                {selectedSupportNodeIds.length} PILE CAPS SELECTED FOR COMBINED DESIGN
              </div>
              <div className="text-[11px] text-indigo-300 font-sans">
                Selected Joints: #{selectedSupportNodeIds.join(', #')} • Merge into a single rigid mat foundation as per IS 2911 &amp; IS 456.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => clearSelectedSupportNodes()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mergeSelectedPileCaps()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow transition-all"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Merge into Combined Pile Cap</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMBINED & SHEAR WALL PILE CAPS SECTION (IS 2911 / IS 456)                */}
      {/* ========================================================================= */}
      {combinedPileCaps.length > 0 && (
        <CollapsiblePanel
          title={`COMBINED & SHEAR WALL PILE CAPS (${combinedPileCaps.length} ACTIVE GROUPS) — IS 2911:2010 & IS 456:2000`}
          icon={<Layers className="w-4 h-4 text-rose-600" />}
          storageKey="pilecap-combined"
          open={showCombined}
          onToggle={setShowCombined}
          contentClassName="p-4"
          headerActions={
            detachedCombinedCapNodeIds.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearDetachedCombinedCapNodes();
                  handleDesignAll();
                }}
                className="text-[11px] font-mono text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline bg-white px-2 py-1 rounded border border-indigo-200"
                title="Reset all manual splits back to auto-detected combined groupings"
              >
                <RotateCw className="w-3 h-3" />
                <span>Reset ({detachedCombinedCapNodeIds.length})</span>
              </button>
            ) : undefined
          }
        >
          <div className="space-y-3 font-sans">
            <div className="flex items-center justify-between hidden">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-rose-600" />
                <h3 className="font-mono text-xs font-bold text-deep-navy">
                  COMBINED &amp; SHEAR WALL PILE CAPS ({combinedPileCaps.length} ACTIVE GROUPS)
                </h3>
                <span className="text-[10px] font-mono text-slate-500">
                  IS 2911:2010 &amp; IS 456:2000 Rigid Combined Foundation Schedules
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {combinedPileCaps.map((grp) => {
              const isShearWall = grp.reason === 'SHEAR_WALL';
              const loadPerPileWork = Math.round(grp.totalWorkingLoad / grp.pileCount);
              const isSafeCapacity = loadPerPileWork <= grp.safePileCapacity;

              return (
                <div
                  key={grp.groupId}
                  className={`p-3.5 rounded-lg border flex flex-col justify-between font-mono text-xs space-y-2.5 transition-all shadow-2xs ${
                    isShearWall
                      ? 'bg-rose-50/40 border-rose-200'
                      : 'bg-emerald-50/40 border-emerald-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-xs ${
                            isShearWall
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {combinedCapMarks.get(grp.groupId) || 'PC'}: {grp.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
                          {grp.pileCount}-Pile Mat
                        </span>
                        {grp.isCustomized && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Manual Edit
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1 font-sans">
                        Covered Supports: <strong>{grp.columnLabels.join(', ')}</strong> (Joints #{grp.nodeIds.join(', #')})
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                        isSafeCapacity
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border-rose-200'
                      }`}
                    >
                      {isSafeCapacity ? 'PASS' : 'OVERLOADED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/80 p-2.5 rounded border border-slate-200/80">
                    <div>
                      <span className="text-slate-500 block text-[10px]">CAP SIZE (L × B × D):</span>
                      <strong className="text-slate-900 font-bold">{grp.capLength} × {grp.capWidth} × {grp.capDepth} mm</strong>
                      <span className="text-[10px] text-slate-500 block">d = {grp.effectiveDepth} mm</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">TOTAL LOAD Pu / P_work:</span>
                      <strong className="text-slate-900 font-bold">{grp.totalFactoredLoad} kN (Work: {grp.totalWorkingLoad} kN)</strong>
                      <span className={`text-[10px] block ${isSafeCapacity ? 'text-slate-600' : 'text-rose-700 font-bold'}`}>
                        P/pile (Work): {loadPerPileWork} kN (Cap: {grp.safePileCapacity} kN)
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-100 text-[10px] space-y-0.5">
                      <div>Bot Rebar: <strong className="text-orange-700">{grp.botRebarCallout}</strong></div>
                      <div>Top Mesh: <span className="text-slate-700">{grp.topRebarCallout}</span> • Ties: <span className="text-emerald-700">{grp.shearWallStirrupCallout}</span></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setSelectedEditCombinedCap(grp)}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 rounded border border-indigo-200 text-[11px] font-mono shadow-2xs flex items-center gap-1 transition-all"
                      title="Manually edit pile count, cap dimensions, and safe pile load capacity"
                    >
                      <Edit3 className="w-3 h-3 text-indigo-600" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setSelectedGroupToSplit(grp)}
                      className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 rounded border border-rose-200 text-[11px] font-mono shadow-2xs flex items-center gap-1 transition-all"
                      title="Split / Detach column joints from this combined pile cap"
                    >
                      <Unlink className="w-3 h-3 text-rose-600" />
                      <span>Split</span>
                    </button>
                    <button
                      onClick={() => setSelectedReport(CombinedPileCapEngine.generateCalculationReport(grp))}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded border border-ui-border text-[11px] font-mono shadow-2xs flex items-center gap-1"
                      title="View IS 2911 Detailed Engineering Calculation Sheet"
                    >
                      <FileText className="w-3 h-3 text-slate-600" />
                      Calc Sheet
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </CollapsiblePanel>
      )}

      {/* Main Table */}
      <CollapsiblePanel
        title="RCC INDIVIDUAL & COMPONENT PILE CAP SCHEDULE"
        icon={<Layers className="w-4 h-4 text-sky-700" />}
        storageKey="pilecap-table"
        open={showTable}
        onToggle={setShowTable}
        contentClassName="p-0"
        className="flex-1 flex flex-col min-h-[420px]"
        variant="card"
      >
        <div className="flex-1 min-h-[380px] flex flex-col overflow-hidden">
        <DataTable
          data={rows}
          columns={columns}
          title="RCC INDIVIDUAL & COMPONENT PILE CAP SCHEDULE"
          searchPlaceholder="Search by Mark (e.g. PC1), Column (e.g. C1), or Joint #..."
          searchFilter={(item, q) =>
            item.columnLabels.some((l: string) => l.toLowerCase().includes(q)) ||
            item.mark.toLowerCase().includes(q) ||
            item.assignedTypeId.toLowerCase().includes(q) ||
            item.nodeIds.some((id: number) => String(id).includes(q))
          }
          onExportCsv={handleExport}
        />
        </div>
      </CollapsiblePanel>

      {/* Split Combined Pile Cap Modal */}
      <SplitPileCapModal
        group={selectedGroupToSplit}
        isOpen={selectedGroupToSplit !== null}
        onClose={() => setSelectedGroupToSplit(null)}
        model={activeModel}
        onSplit={(orig, keep, detach, newGroup) => {
          splitCombinedPileCapGroup(orig, keep, detach, newGroup);
          handleDesignAll();
        }}
        onDetachNodes={(nodeIds) => {
          detachNodesFromCombinedPileCap(nodeIds);
          handleDesignAll();
        }}
        onDisbandAll={(nodeId) => {
          unmergePileCapGroup(nodeId);
          handleDesignAll();
        }}
      />

      {/* Manual Individual Pile Cap Edit Modal */}
      <PileCapEditModal
        pileCap={selectedEditCap}
        isOpen={selectedEditCap !== null}
        onClose={() => setSelectedEditCap(null)}
        projectPileTypes={availablePileTypes}
        onSave={handleSaveManualEdit}
        onReset={handleResetManualEdit}
      />

      {/* Manual Combined & Shear Wall Pile Cap Edit Modal */}
      <CombinedPileCapEditModal
        cap={selectedEditCombinedCap}
        isOpen={selectedEditCombinedCap !== null}
        onClose={() => setSelectedEditCombinedCap(null)}
        onSave={handleSaveCombinedOverride}
        onReset={handleResetCombinedOverride}
      />

      {/* Auto-Design Optimization Modal */}
      <PileCapAutoDesignModal
        isOpen={isAutoDesignModalOpen}
        onClose={() => setIsAutoDesignModalOpen(false)}
        summary={autoDesignSummary}
        onConfirmApply={handleConfirmApplyAutoDesign}
        onReoptimizeWithDiameters={(dias) => handleTriggerAutoDesign(dias)}
        isApplying={false}
      />

      {/* Calculation Modal */}
      <CalculationModal report={selectedReport} onClose={() => setSelectedReport(null)} />

      {/* Drawing Modal */}
      {selectedDrawingCap && (
        <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-2xs z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
          <div className="w-full max-w-4xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold text-deep-navy">
                CAD PILE CAP PLAN & REBAR MESH — CAP PC-{selectedDrawingCap.supportNodeId}
              </h3>
              <button onClick={() => setSelectedDrawingCap(null)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <PileCapDrawingSvg pileCap={selectedDrawingCap} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
