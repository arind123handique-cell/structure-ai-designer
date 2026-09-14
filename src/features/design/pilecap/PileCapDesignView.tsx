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
import { exportToCsv, exportPileCapDrawingsPdf } from '@/utils/exportUtils';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { PileDesignEngine, ProjectPileType } from '@/features/design/pile/pileDesignEngine';
import { UniversalRebarBar } from '@/features/design/common/UniversalRebarBar';
import { CollapsiblePanel } from '@/components/common/CollapsiblePanel';
import { CalculationPdfService } from '@/features/calculations/calculationPdfService';
import { ManualAnalysisEngine } from '@/features/calculations/manualAnalysisEngine';
import { AnalysisSourceToggle } from '@/components/common/AnalysisSourceToggle';
import { FoundationSpatialSizingEngine } from './foundationSpatialSizingEngine';
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
  Sliders,
  Filter,
  AlertTriangle,
  Zap,
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
    rotatePileCap,
    setPileCapRotation,
    setCustomCombinedCapOverride,
    clearCustomCombinedCapOverride,
    rotateCombinedPileCap,
    setCombinedCapRotation,
    savedPileCapDesigns,
    savePileCapDesigns,
    getSectionAnalysisSource,
    sectionAnalysisSources,
    designAnalysisSource,
    plotSite,
    autoSizeAllFoundations,
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

  // Filter states
  const [filterPileGroup, setFilterPileGroup] = useState<'ALL' | number | 'COMBINED'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PASS' | 'WARNING' | 'FAIL'>('ALL');
  const [showFilters, setShowFilters] = useState(true);

  // Auto-design optimization state
  const [autoDesignSummary, setAutoDesignSummary] = useState<BatchPileCapOptimizationSummary | null>(null);
  const [isAutoDesignModalOpen, setIsAutoDesignModalOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAutoSizing, setIsAutoSizing] = useState(false);
  const [autoSizeFeedback, setAutoSizeFeedback] = useState<string | null>(null);

  // Drawing PDF export state
  const [dimFontSize, setDimFontSize] = useState(1);
  const [selectedDrawingCaps, setSelectedDrawingCaps] = useState<Set<number>>(new Set());
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const drawingContainerRef = React.useRef<HTMLDivElement>(null);
  const batchRenderRef = React.useRef<HTMLDivElement>(null);

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

    const analysisSource = getSectionAnalysisSource('pilecaps');
    const manualSummary = analysisSource === 'MANUAL' ? ManualAnalysisEngine.computeReview(activeModel, 'GRAVITY_COMBO') : null;

    // Pre-map column to support node
    const supToColMap = new Map<number, number>();
    for (const m of activeModel.members.values()) {
      if (m.classification === 'COLUMN') {
        if (activeModel.supports.has(m.startNodeId)) supToColMap.set(m.startNodeId, m.id);
        if (activeModel.supports.has(m.endNodeId)) supToColMap.set(m.endNodeId, m.id);
      }
    }

    for (const sup of supportNodes) {
      let maxFy = 0;
      let maxMx = 0;
      let maxMy = 0;
      let govLC = 1;

      if (analysisSource === 'MANUAL') {
        const colId = supToColMap.get(sup.nodeId);
        const mRow = colId ? manualSummary?.rows.find((r) => r.memberId === colId) : null;
        maxFy = mRow ? mRow.manualAxial : 650;
        maxMx = Math.max(25, parseFloat((0.03 * maxFy).toFixed(1)));
        maxMy = Math.max(15, parseFloat((0.02 * maxFy).toFixed(1)));
        govLC = 9; // Manual Statics (1.5 DL + 1.5 LL)
      } else {
        const reactions = activeModel.reactions?.filter((r) => r.nodeId === sup.nodeId) || [];
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
        rotationAngle: overrides?.rotationAngle || 0,
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
  }, [activeModel, activeProject, supportNodes, availablePileTypes, supportPileAssignments, customPileCapOverrides, getSectionAnalysisSource, sectionAnalysisSources, designAnalysisSource]);

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

  // Quick pile count override handler (dropdown in table)
  const handleQuickPileCountChange = useCallback(
    (nodeId: number, newPileCount: number) => {
      const currentOverrides = customPileCapOverrides[nodeId] || {};
      setCustomPileCapOverride(nodeId, {
        ...currentOverrides,
        customPileCount: newPileCount,
      });
      // Re-design this specific cap after override is applied
      setTimeout(() => handleDesignAll(), 50);
    },
    [customPileCapOverrides, setCustomPileCapOverride, handleDesignAll]
  );

  // Save manual edit from PileCapEditModal
  const handleSaveManualEdit = (
    nodeId: number,
    overrides: {
      pileTypeId?: string;
      customPileCount?: number;
      customCapLength?: number;
      customCapWidth?: number;
      customCapDepth?: number;
      rotationAngle?: number;
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
      rotationAngle: overrides.rotationAngle,
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
      await savePileCapDesigns(designedCaps, combinedPileCaps);
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
      defaultQsafe,
      plotSite,
      false
    );
  }, [
    activeModel,
    designedCaps,
    availablePileTypes,
    manualMergedPileCapGroups,
    detachedCombinedCapNodeIds,
    customCombinedCapOverrides,
    plotSite,
  ]);

  // Spatial Foundation Audit (Plot Boundary & Clear Spacing IS 2911)
  const spatialAudit = useMemo(() => {
    if (!activeModel) return null;
    return FoundationSpatialSizingEngine.auditAll(
      activeModel,
      designedCaps,
      combinedPileCaps,
      plotSite
    );
  }, [activeModel, designedCaps, combinedPileCaps, plotSite]);

  // Handle Auto-Size to Spacing & Plot Boundary
  const handleAutoSizeToSpacingAndPlot = () => {
    if (!activeModel || designedCaps.size === 0) return;
    setIsAutoSizing(true);
    try {
      const result = autoSizeAllFoundations(designedCaps);
      if (result) {
        const parts: string[] = [];
        if (result.rotatedCapCount > 0) {
          parts.push(`${result.rotatedCapCount} individual cap(s) auto-rotated to clear boundaries/neighbors`);
        }
        const initialCombined = manualMergedPileCapGroups.length;
        const newCombined = result.newCombinedGroups.length;
        if (newCombined > initialCombined) {
          parts.push(`${newCombined - initialCombined} colliding cluster(s) merged into combined pile caps`);
        }
        if (parts.length === 0) {
          setAutoSizeFeedback('All foundation pile caps already fully compliant with plot boundaries and column spacing!');
        } else {
          setAutoSizeFeedback(`Spatial auto-sizing complete: ${parts.join('; ')}. All caps now 100% compliant.`);
        }
        setTimeout(() => setAutoSizeFeedback(null), 6000);
      }
    } catch (err) {
      console.error('Failed to auto-size foundations:', err);
    } finally {
      setIsAutoSizing(false);
    }
  };

  // Save combined pile cap manual edit
  const handleSaveCombinedOverride = (groupId: string, override: any) => {
    setCustomCombinedCapOverride(groupId, override);
  };

  // Reset combined pile cap override
  const handleResetCombinedOverride = (groupId: string) => {
    clearCustomCombinedCapOverride(groupId);
  };

  // Auto-size single combined pile cap without overlapping neighboring pile caps
  const handleAutoSizeSingleCombined = (grp: CombinedPileCapGroup) => {
    if (!activeModel) return;
    const result = FoundationSpatialSizingEngine.autoSizeSingleCombinedCap(
      grp,
      activeModel,
      designedCaps,
      combinedPileCaps,
      plotSite
    );
    if (!result) return;

    setCustomCombinedCapOverride(grp.groupId, {
      customPileCount: result.recommendedPileCount,
      customCapLength: result.recommendedLength,
      customCapWidth: result.recommendedWidth,
      customCapDepth: grp.capDepth,
      customSafePileCapacity: grp.safePileCapacity,
      customBottomRebar: grp.botRebarCallout,
      customTopRebar: grp.topRebarCallout,
      rotationAngle: grp.rotationAngle,
    });

    setAutoSizeFeedback(`[${grp.groupId}] ${result.summaryMessage}`);
    setTimeout(() => setAutoSizeFeedback(null), 6000);
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

  // Unique Pile Count Groups present in project (ensuring standard 2, 3, 4, 5, 6 plus any combined counts)
  const pileGroupOptions = useMemo(() => {
    const presentCounts = new Set<number>();
    rows.forEach((r) => {
      if (r.design?.pileCount) presentCounts.add(r.design.pileCount);
    });
    [2, 3, 4, 5, 6].forEach((c) => presentCounts.add(c));
    combinedPileCaps.forEach((grp) => {
      if (grp.pileCount) presentCounts.add(grp.pileCount);
    });
    return Array.from(presentCounts).sort((a, b) => a - b);
  }, [rows, combinedPileCaps]);

  // Filtered Standalone Pile Cap Rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Pile Group Filter
      if (filterPileGroup === 'COMBINED') {
        return false;
      }
      if (typeof filterPileGroup === 'number') {
        if (r.design?.pileCount !== filterPileGroup) return false;
      }

      // Status Filter
      if (filterStatus !== 'ALL') {
        if (r.design?.status !== filterStatus) return false;
      }

      return true;
    });
  }, [rows, filterPileGroup, filterStatus]);

  // Filtered Combined Pile Caps
  const filteredCombinedPileCaps = useMemo(() => {
    return combinedPileCaps.filter((grp) => {
      // Pile Group Filter
      if (typeof filterPileGroup === 'number') {
        if (grp.pileCount !== filterPileGroup) return false;
      }
      // Status Filter
      if (filterStatus !== 'ALL') {
        const loadPerPileWork = Math.round(grp.totalWorkingLoad / grp.pileCount);
        const isSafe = loadPerPileWork <= grp.safePileCapacity;
        const status = isSafe ? 'PASS' : 'WARNING';
        if (status !== filterStatus) return false;
      }
      return true;
    });
  }, [combinedPileCaps, filterPileGroup, filterStatus]);

  // Dynamic Table Title with Active Filters
  const tableTitle = useMemo(() => {
    let title = 'RCC INDIVIDUAL & COMPONENT PILE CAP SCHEDULE';
    if (filterPileGroup !== 'ALL') {
      if (typeof filterPileGroup === 'number') {
        title += ` — ${filterPileGroup}-PILE CAPS (${filteredRows.length} CAPS)`;
      } else {
        title += ` — COMBINED CAPS`;
      }
    } else {
      title += ` (${filteredRows.length} CAPS)`;
    }
    if (filterStatus !== 'ALL') {
      title += ` [STATUS: ${filterStatus}]`;
    }
    return title;
  }, [filterPileGroup, filterStatus, filteredRows.length]);

  const columns: ColumnDef<any>[] = [
    {
      header: 'SEL',
      accessorKey: 'nodeIds',
      cell: (r) => {
        const nodeId = r.nodeIds[0];
        const isChecked = selectedDrawingCaps.has(nodeId);
        return (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleDrawingCapSelection(nodeId)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
              title={isChecked ? 'Deselect for Drawing PDF' : 'Select for Drawing PDF'}
            />
          </div>
        );
      },
      width: '40px',
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
      header: 'PILES (CONFIG)',
      align: 'center',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">—</span>;
        const nodeId = r.nodeIds[0];
        return (
          <div className="flex items-center justify-center gap-1.5">
            <select
              value={r.design.pileCount}
              onChange={(e) => {
                e.stopPropagation();
                const val = parseInt(e.target.value, 10);
                if (val >= 2 && val <= 6) handleQuickPileCountChange(nodeId, val);
              }}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-300 hover:border-indigo-500 hover:bg-indigo-100 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
              title="Change pile count configuration (2-6 piles)"
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}-Pile
                </option>
              ))}
            </select>
            <span className="text-[9px] font-mono text-slate-500">({r.mark})</span>
            {r.count > 1 && (
              <span className="text-[9px] px-1 bg-slate-100 text-slate-600 rounded font-mono font-bold">
                ×{r.count}
              </span>
            )}
            {r.isCustomized && (
              <span className="text-[8px] px-1 bg-amber-100 text-amber-800 rounded font-mono font-bold" title="Manually edited">
                ✎
              </span>
            )}
          </div>
        );
      },
      width: '170px',
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
      width: '180px',
    },
    {
      header: 'ORIENTATION',
      align: 'center',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">—</span>;
        const nodeId = r.nodeIds[0];
        const rot = ((customPileCapOverrides[nodeId]?.rotationAngle ?? r.design.rotationAngle ?? 0) % 360 + 360) % 360;
        return (
          <div className="flex items-center justify-center gap-1 font-mono">
            <button
              onClick={() => rotatePileCap(nodeId, 'CCW')}
              className="p-1 hover:bg-slate-200 text-slate-600 rounded transition-colors"
              title="Rotate Counter-Clockwise (-90°)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
            </button>
            <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold border ${
              rot !== 0
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              {rot}°
            </span>
            <button
              onClick={() => rotatePileCap(nodeId, 'CW')}
              className="p-1 hover:bg-slate-200 text-slate-600 rounded transition-colors"
              title="Rotate Clockwise (+90°)"
            >
              <RotateCw className="w-3.5 h-3.5 text-blue-600" />
            </button>
          </div>
        );
      },
      width: '130px',
    },
    {
      header: 'CONCRETE (m³)',
      sortable: true,
      align: 'right',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">—</span>;
        const vol = (r.design.capLength / 1000) * (r.design.capWidth / 1000) * (r.design.capDepth / 1000);
        return (
          <span className="font-mono font-bold text-sky-700">
            {vol.toFixed(3)} m³
          </span>
        );
      },
      width: '110px',
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
      filteredRows.map((r) => ({
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
      `IS456_PileCap_${filterPileGroup !== 'ALL' ? `${filterPileGroup}Pile_` : ''}Design_Schedule.csv`
    );
  };

  const toggleDrawingCapSelection = (nodeId: number) => {
    setSelectedDrawingCaps((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const toggleAllDrawingCaps = () => {
    if (selectedDrawingCaps.size === rows.length) {
      setSelectedDrawingCaps(new Set());
    } else {
      setSelectedDrawingCaps(new Set(rows.map((r) => r.nodeIds[0])));
    }
  };

  const handleExportDrawingPdf = async () => {
    if (selectedDrawingCaps.size === 0) return;
    setIsExportingPdf(true);
    try {
      const capsToExport = Array.from(selectedDrawingCaps).map((nodeId) => designedCaps.get(nodeId)).filter(Boolean) as PileCapDesignOutput[];
      if (capsToExport.length === 0) return;

      const container = batchRenderRef.current;
      if (!container) return;

      const { default: jsPDF } = await import('jspdf');
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const a4W = 297;
      const a4H = 210;
      const a3W = 420;
      const a3H = 297;
      const margin = 8;

      for (let i = 0; i < capsToExport.length; i++) {
        const cap = capsToExport[i];
        const el = container.querySelector<HTMLElement>(`[data-cap-id="${cap.supportNodeId}"]`);
        if (!el) continue;

        el.style.display = 'block';
        el.style.position = 'static';

        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const ratio = Math.min((a4W - 2 * margin) / canvas.width, (a4H - 2 * margin) / canvas.height);
        const drawW = canvas.width * ratio;
        const drawH = canvas.height * ratio;
        const x = (a4W - drawW) / 2;
        const y = (a4H - drawH) / 2;

        if (i > 0) doc.addPage('a4', 'landscape');
        doc.addImage(imgData, 'PNG', x, y, drawW, drawH);

        el.style.display = 'none';
        el.style.position = 'absolute';
      }

      doc.save(`PileCap_Drawings_${capsToExport.length}caps_${Date.now()}.pdf`);
    } finally {
      setIsExportingPdf(false);
    }
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
          onClick={() => { setShowBanner(true); setShowRebar(true); setShowFilters(true); setShowCombined(true); setShowTable(true); }}
          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-[11px] font-mono shadow-2xs flex items-center gap-1"
        >
          <Eye className="w-3 h-3" /> Show All
        </button>
        <button
          type="button"
          onClick={() => { setShowBanner(false); setShowRebar(false); setShowFilters(false); setShowCombined(false); setShowTable(false); }}
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
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              Auto-configured by single pile capacity $Q_{'{'}safe{'}'}$, two-way column & pile punching shear, flexural bottom mats, and top shrinkage grids.
            </p>
            <AnalysisSourceToggle section="pilecaps" sectionLabel="Pile Caps" onSourceChange={() => handleDesignAll()} />
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Size to Plot & Spacing Button */}
            <button
              onClick={handleAutoSizeToSpacingAndPlot}
              disabled={isAutoSizing || isOptimizing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-700 hover:bg-violet-800 text-white font-mono text-xs font-bold rounded shadow-2xs transition-all disabled:opacity-50"
              title="Automatically resolve overlapping pile caps, rotate individual caps to clear neighbors, and size combined caps within plot boundaries"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>{isAutoSizing ? 'Auto-Sizing...' : '⚡ Auto-Size to Spacing & Plot'}</span>
            </button>

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
              <>
                <button
                  onClick={() => {
                    if (activeModel && activeProject) {
                      CalculationPdfService.exportPileCapsCalculationsPdf(activeModel, activeProject);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors shadow-2xs font-semibold"
                  title="Export Detailed Step-by-Step Pile Cap Calculations PDF (IS 456 & IS 2911)"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  Calculations PDF
                </button>

                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-ui-border rounded transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>

                <button
                  onClick={toggleAllDrawingCaps}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-ui-border rounded transition-colors shadow-2xs"
                  title={selectedDrawingCaps.size === rows.length ? 'Deselect All' : 'Select All for Drawing PDF'}
                >
                  {selectedDrawingCaps.size === rows.length ? '☐' : '☑'} Select All ({selectedDrawingCaps.size}/{rows.length})
                </button>

                <button
                  onClick={handleExportDrawingPdf}
                  disabled={selectedDrawingCaps.size === 0 || isExportingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors shadow-2xs disabled:opacity-50"
                  title="Export selected pile cap drawings as PDF (A4 Plan + A3 Cross Section)"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600" />
                  {isExportingPdf ? 'Exporting...' : `Drawing PDF (${selectedDrawingCaps.size})`}
                </button>
              </>
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

      {/* Spatial Foundation Audit Bar (Plot Boundary & Collision Avoidance) */}
      {spatialAudit && (
        <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg border font-mono text-xs shadow-2xs transition-all ${
          spatialAudit.isFullyCompliant
            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
            : 'bg-amber-50/90 border-amber-300 text-amber-950'
        }`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold">
              {spatialAudit.isFullyCompliant ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              <span>SPATIAL AUDIT:</span>
            </div>

            {/* Plot Site Status */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/80 border border-slate-200">
              <span className="text-slate-500">Plot:</span>
              <span className="font-semibold text-slate-800">
                {spatialAudit.plotLimits
                  ? `${spatialAudit.plotLimits.lengthM.toFixed(1)}m × ${spatialAudit.plotLimits.widthM.toFixed(1)}m`
                  : 'Not Defined'}
              </span>
              {spatialAudit.plotLimits && (
                spatialAudit.hasPlotViolations ? (
                  <span className="ml-1 px-1.5 py-0.2 bg-rose-100 text-rose-800 font-bold rounded text-[10px]">
                    {spatialAudit.plotViolations.length} Protrusion{spatialAudit.plotViolations.length > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="ml-1 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                    100% Inside Plot
                  </span>
                )
              )}
            </div>

            {/* Collision Status */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/80 border border-slate-200">
              <span className="text-slate-500">Spacing:</span>
              {spatialAudit.hasCollisions ? (
                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 font-bold rounded text-[10px]">
                  {spatialAudit.collisions.length} Overlap{spatialAudit.collisions.length > 1 ? 's' : ''} (&lt;150mm)
                </span>
              ) : (
                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                  Zero Collisions (&ge;150mm Clear)
                </span>
              )}
            </div>

            {/* Total Cap Counts */}
            <div className="hidden sm:flex items-center gap-2 text-slate-600 text-[11px]">
              <span>{spatialAudit.totalIndividualCaps} Individual</span>
              <span>·</span>
              <span>{spatialAudit.totalCombinedCaps} Combined</span>
            </div>
          </div>

          {/* Quick Auto-Fix Button if not compliant */}
          {!spatialAudit.isFullyCompliant && (
            <button
              onClick={handleAutoSizeToSpacingAndPlot}
              disabled={isAutoSizing}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-2xs transition-all disabled:opacity-50 text-[11px]"
              title="Automatically merge colliding column caps and rotate rectangular caps to clear plot boundaries"
            >
              <Zap className="w-3 h-3" />
              <span>Auto-Resolve ({spatialAudit.collisions.length + spatialAudit.plotViolations.length})</span>
            </button>
          )}
        </div>
      )}

      {/* Auto-Size Feedback Alert */}
      {autoSizeFeedback && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-300 text-violet-900 rounded font-mono text-xs shadow-2xs animate-in fade-in">
          <Zap className="w-4 h-4 text-violet-600 shrink-0" />
          <span className="font-semibold">{autoSizeFeedback}</span>
        </div>
      )}

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
              onClick={() => {
                selectedSupportNodeIds.forEach((nid) => rotatePileCap(nid, 'CCW'));
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-600/40 rounded font-bold transition-colors"
              title="Rotate selected pile caps 90° counter-clockwise"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rotate CCW</span>
            </button>
            <button
              onClick={() => {
                selectedSupportNodeIds.forEach((nid) => rotatePileCap(nid, 'CW'));
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-600/40 rounded font-bold transition-colors"
              title="Rotate selected pile caps 90° clockwise"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rotate CW</span>
            </button>
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

      {/* Filter Panel: Filter by Pile Cap Group (2-Pile, 3-Pile, 4-Pile, 5-Pile, 6-Pile, Combined) & Status */}
      <CollapsiblePanel
        title="FILTER PILE CAPS (BY PILE GROUP & DESIGN STATUS)"
        icon={<Sliders className="w-4 h-4 text-indigo-600" />}
        storageKey="pilecap-filters"
        open={showFilters}
        onToggle={setShowFilters}
        contentClassName="p-3.5 space-y-3"
        variant="card"
      >
        {/* Row 1: Pile Cap Group Filter */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-mono text-slate-500 font-semibold uppercase flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              Pile Cap Group:
            </span>
            <button
              onClick={() => setFilterPileGroup('ALL')}
              className={`px-3 py-1 text-xs font-mono rounded border transition-all ${
                filterPileGroup === 'ALL'
                  ? 'bg-deep-navy text-white border-deep-navy shadow-xs font-bold'
                  : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
              }`}
            >
              ALL ({rows.length + combinedPileCaps.length})
            </button>
            {pileGroupOptions.map((cnt) => {
              const standaloneCount = rows.filter((r) => r.design?.pileCount === cnt).length;
              const combCount = combinedPileCaps.filter((g) => g.pileCount === cnt).length;
              const totalInGroup = standaloneCount + combCount;
              return (
                <button
                  key={cnt}
                  onClick={() => setFilterPileGroup(cnt)}
                  className={`px-3 py-1 text-xs font-mono rounded border transition-all ${
                    filterPileGroup === cnt
                      ? 'bg-indigo-700 text-white border-indigo-700 shadow-xs font-bold'
                      : totalInGroup > 0
                      ? 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cnt}-Pile Cap ({totalInGroup})
                </button>
              );
            })}
            {combinedPileCaps.length > 0 && (
              <button
                onClick={() => setFilterPileGroup('COMBINED')}
                className={`px-3 py-1 text-xs font-mono rounded border transition-all ${
                  filterPileGroup === 'COMBINED'
                    ? 'bg-rose-700 text-white border-rose-700 shadow-xs font-bold'
                    : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
                }`}
              >
                Combined Mat ({combinedPileCaps.length})
              </button>
            )}
          </div>

          {(filterPileGroup !== 'ALL' || filterStatus !== 'ALL') && (
            <button
              onClick={() => {
                setFilterPileGroup('ALL');
                setFilterStatus('ALL');
              }}
              className="text-[11px] font-mono text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline px-2.5 py-1 rounded border border-indigo-200 bg-indigo-50/60 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Row 2: Status Filter */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-slate-200/70">
          <span className="text-xs font-mono text-slate-500 font-semibold uppercase">
            Design Status:
          </span>
          {(['ALL', 'PASS', 'WARNING', 'FAIL'] as const).map((st) => {
            const passCount = rows.filter((r) => r.design?.status === 'PASS').length;
            const warnCount = rows.filter((r) => r.design?.status === 'WARNING').length;
            const failCount = rows.filter((r) => r.design?.status === 'FAIL').length;
            const count =
              st === 'ALL'
                ? rows.length
                : st === 'PASS'
                ? passCount
                : st === 'WARNING'
                ? warnCount
                : failCount;

            return (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 text-xs font-mono rounded border transition-all ${
                  filterStatus === st
                    ? st === 'PASS'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs font-bold'
                      : st === 'WARNING'
                      ? 'bg-amber-700 text-white border-amber-700 shadow-xs font-bold'
                      : st === 'FAIL'
                      ? 'bg-red-700 text-white border-red-700 shadow-xs font-bold'
                      : 'bg-deep-navy text-white border-deep-navy shadow-xs font-bold'
                    : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
                }`}
              >
                {st} ({count})
              </button>
            );
          })}
        </div>
      </CollapsiblePanel>

      {/* ========================================================================= */}
      {/* COMBINED & SHEAR WALL PILE CAPS SECTION (IS 2911 / IS 456)                */}
      {/* ========================================================================= */}
      {combinedPileCaps.length > 0 && (
        <CollapsiblePanel
          title={`COMBINED & SHEAR WALL PILE CAPS (${filteredCombinedPileCaps.length} ACTIVE GROUPS) — IS 2911:2010 & IS 456:2000`}
          icon={<Layers className="w-4 h-4 text-rose-600" />}
          storageKey="pilecap-combined"
          open={showCombined}
          onToggle={setShowCombined}
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
            {filteredCombinedPileCaps.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded border border-dashed border-slate-300 font-mono text-xs text-slate-500">
                No combined pile caps match the selected filter ({typeof filterPileGroup === 'number' ? `${filterPileGroup}-Pile` : filterPileGroup}, Status: {filterStatus}).
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredCombinedPileCaps.map((grp) => {
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
                          onClick={() => handleAutoSizeSingleCombined(grp)}
                          className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-800 rounded border border-violet-300 text-[11px] font-mono shadow-2xs flex items-center gap-1 transition-all font-semibold"
                          title="Auto-size dimensions and pile grid to match statutory edge distance (eo = Dp) and pile-to-pile spacing without overlapping neighboring pile caps"
                        >
                          <Zap className="w-3 h-3 text-violet-600" />
                          <span>Auto-Size</span>
                        </button>
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
            )}
          </div>
        </CollapsiblePanel>
      )}

      {/* Main Table */}
      <CollapsiblePanel
        title={tableTitle}
        icon={<Layers className="w-4 h-4 text-sky-700" />}
        storageKey="pilecap-table"
        open={showTable}
        onToggle={setShowTable}
        contentClassName="p-0"
        className="flex-1 flex flex-col min-h-[420px]"
        variant="card"
      >
        <div className="flex-1 min-h-[380px] flex flex-col overflow-hidden">
        {filterPileGroup === 'COMBINED' ? (
          <div className="p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center space-y-2">
            <Layers className="w-8 h-8 text-rose-500" />
            <div className="font-mono font-bold text-sm text-slate-800">
              Showing Combined & Shear Wall Pile Caps ({combinedPileCaps.length} Groups)
            </div>
            <p className="text-xs text-slate-500 max-w-md font-sans">
              Combined pile caps are detailed in the section above. Click "ALL" or select a specific individual pile count (e.g. 2-Pile, 3-Pile, 4-Pile, 5-Pile) to view individual column pile caps.
            </p>
            <button
              onClick={() => setFilterPileGroup('ALL')}
              className="mt-2 px-3 py-1.5 bg-deep-navy text-white text-xs font-mono rounded font-bold hover:bg-slate-800 transition-colors shadow-2xs"
            >
              Show All Pile Caps
            </button>
          </div>
        ) : (
          <>
            {/* Batch Pile Count Change Bar (when 1+ caps selected via checkboxes) */}
            {selectedDrawingCaps.size > 0 && (
              <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 flex items-center gap-3 flex-wrap">
                <span className="text-[11px] font-mono font-bold text-rose-700">
                  {selectedDrawingCaps.size} cap{selectedDrawingCaps.size > 1 ? 's' : ''} selected
                </span>
                <span className="text-[10px] font-mono text-slate-500">|</span>
                <span className="text-[10px] font-mono text-slate-600">Batch set pile count:</span>
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      selectedDrawingCaps.forEach((nodeId) => {
                        const currentOverrides = customPileCapOverrides[nodeId] || {};
                        setCustomPileCapOverride(nodeId, { ...currentOverrides, customPileCount: n });
                      });
                      setTimeout(() => handleDesignAll(), 50);
                    }}
                    className="px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-300 rounded transition-colors"
                  >
                    {n}-Pile
                  </button>
                ))}
                <button
                  onClick={() => setSelectedDrawingCaps(new Set())}
                  className="ml-auto text-[10px] font-mono text-slate-500 hover:text-slate-700 underline"
                >
                  Clear selection
                </button>
              </div>
            )}
          <DataTable
            data={filteredRows}
            columns={columns}
            title={tableTitle}
            searchPlaceholder="Search by Mark (e.g. PC1), Column (e.g. C1), or Joint #..."
            searchFilter={(item, q) =>
              item.columnLabels.some((l: string) => l.toLowerCase().includes(q)) ||
              item.mark.toLowerCase().includes(q) ||
              item.assignedTypeId.toLowerCase().includes(q) ||
              item.nodeIds.some((id: number) => String(id).includes(q))
            }
            onExportCsv={handleExport}
          />
          </>
        )}
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
        onAutoSize={handleAutoSizeSingleCombined}
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

      {/* Hidden Batch Render Container for PDF Export */}
      <div ref={batchRenderRef} className="sr-only" style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        {Array.from(selectedDrawingCaps).map((nodeId) => {
          const cap = designedCaps.get(nodeId);
          if (!cap) return null;
          return (
            <div
              key={nodeId}
              data-cap-id={nodeId}
              style={{ display: 'none', position: 'absolute', left: '-9999px', width: '900px', background: '#fff', padding: '16px' }}
            >
              <PileCapDrawingSvg pileCap={cap} dimFontSize={dimFontSize} />
            </div>
          );
        })}
      </div>

      {/* Drawing Modal */}
      {selectedDrawingCap && (
        <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-2xs z-50 flex items-center justify-center p-3 font-sans animate-in fade-in">
          <div className="w-full max-w-4xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-3 bg-slate-50 border-b border-ui-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="font-mono text-sm font-bold text-deep-navy">
                  PILE CAP DRAWING — PC-{selectedDrawingCap.supportNodeId}
                </h3>
                <span className="font-mono text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {selectedDrawingCap.pileCount}-Pile • {selectedDrawingCap.capLength}×{selectedDrawingCap.capWidth}×{selectedDrawingCap.capDepth} mm
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Font Size Controls */}
                <div className="flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded">
                  <span className="text-[9px] font-mono text-slate-500 font-semibold">TEXT:</span>
                  <button
                    onClick={() => setDimFontSize((f) => Math.max(0.5, f - 0.1))}
                    className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700 transition-colors"
                    title="Decrease dimension text size"
                  >
                    −
                  </button>
                  <span className="text-[9px] font-mono text-slate-700 w-7 text-center font-bold">
                    {Math.round(dimFontSize * 100)}%
                  </span>
                  <button
                    onClick={() => setDimFontSize((f) => Math.min(2, f + 0.1))}
                    className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700 transition-colors"
                    title="Increase dimension text size"
                  >
                    +
                  </button>
                </div>
                <button onClick={() => setSelectedDrawingCap(null)} className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors" title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Drawing Area */}
            <div className="flex-1 overflow-auto p-4" ref={drawingContainerRef} style={{ minHeight: 0 }}>
              <div data-drawing-element className="flex justify-center">
                <PileCapDrawingSvg pileCap={selectedDrawingCap} dimFontSize={dimFontSize} />
              </div>
            </div>

            {/* Footer with Design Info & Actions */}
            <div className="px-5 py-2.5 bg-slate-50 border-t border-ui-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
                <span>Load: <strong className="text-slate-700">{selectedDrawingCap.factoredVerticalLoad?.toFixed(1)} kN</strong></span>
                <span>P/pile: <strong className="text-slate-700">{selectedDrawingCap.loadPerPile} kN</strong></span>
                <span>Depth: <strong className="text-slate-700">{selectedDrawingCap.effectiveDepth} mm</strong></span>
                <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                  selectedDrawingCap.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {selectedDrawingCap.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDrawingCap(null)}
                  className="px-3 py-1 text-[11px] font-mono text-slate-600 bg-white hover:bg-slate-100 border border-ui-border rounded transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
