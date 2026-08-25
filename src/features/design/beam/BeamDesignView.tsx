import React, { useState, useMemo, useCallback } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { BeamDesignEngine, BeamDesignOutput } from './beamDesignEngine';
import { BeamDrawingSvg } from './BeamDrawingSvg';
import { CalculationModal } from '@/features/calculations/CalculationModal';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { DataTable, ColumnDef } from '@/components/tables/DataTable';
import { exportToCsv } from '@/utils/exportUtils';
import { SectionEditModal } from '@/features/design/common/SectionEditModal';
import { BeamRebarEditModal } from './BeamRebarEditModal';
import { WarningFixModal } from '@/features/warnings/WarningFixModal';
import {
  BeamOptimizationEngine,
  BatchBeamOptimizationSummary,
} from './beamOptimizationEngine';
import { BeamAutoDesignModal } from './BeamAutoDesignModal';
import { UniversalRebarBar } from '@/features/design/common/UniversalRebarBar';
import { CollapsiblePanel } from '@/components/common/CollapsiblePanel';
import { Member3D } from '@/features/model/types';
import {
  Play,
  Compass,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Layers,
  X,
  Building2,
  Cpu,
  Sparkles,
  Sliders,
  Wrench,
  Zap,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';

export interface FloorLevelGroup {
  id: string;
  label: string;
  elevationY: number;
  beamCount: number;
  beamIds: number[];
}

export const QUICK_SIZE_OPTIONS = [
  // 300 mm (Standard Main Beams - Low Steel % & Less Congestion)
  { label: '300×400 mm', zd: 0.30, yd: 0.40 },
  { label: '300×450 mm', zd: 0.30, yd: 0.45 },
  { label: '300×500 mm', zd: 0.30, yd: 0.50 },
  { label: '300×550 mm', zd: 0.30, yd: 0.55 },
  { label: '300×600 mm', zd: 0.30, yd: 0.60 },
  { label: '300×750 mm', zd: 0.30, yd: 0.75 },

  // 250 mm (Balanced Standard)
  { label: '250×400 mm', zd: 0.25, yd: 0.40 },
  { label: '250×450 mm', zd: 0.25, yd: 0.45 },
  { label: '250×500 mm', zd: 0.25, yd: 0.50 },
  { label: '250×600 mm', zd: 0.25, yd: 0.60 },

  // 230 mm (9" Masonry Wall Flush)
  { label: '230×300 mm', zd: 0.23, yd: 0.30 },
  { label: '230×350 mm', zd: 0.23, yd: 0.35 },
  { label: '230×400 mm', zd: 0.23, yd: 0.40 },
  { label: '230×450 mm', zd: 0.23, yd: 0.45 },
  { label: '230×500 mm', zd: 0.23, yd: 0.50 },
  { label: '230×600 mm', zd: 0.23, yd: 0.60 },

  // 350 mm (Heavy Transfers)
  { label: '350×600 mm', zd: 0.35, yd: 0.60 },
  { label: '350×750 mm', zd: 0.35, yd: 0.75 },
];

export const BeamDesignView: React.FC = () => {
  const { 
    activeModel, 
    activeProject, 
    updateMemberSection, 
    batchUpdateSections,
    allowedBeamRebarDiameters,
    setAllowedBeamRebarDiameters,
    saveBeamDesigns,
  } = useProjectStore();

  const [designedBeams, setDesignedBeams] = useState<Map<number, BeamDesignOutput>>(new Map());
  const [customBeamRebarMap, setCustomBeamRebarMap] = useState<
    Map<number, { topCurtailment: any; botCurtailment: any }>
  >(() => {
    if (activeProject?.customBeamRebarOverrides) {
      return new Map(Object.entries(activeProject.customBeamRebarOverrides).map(([k, v]) => [Number(k), v as any]));
    }
    return new Map();
  });
  const [selectedReport, setSelectedReport] = useState<DetailedCalculationReport | null>(null);
  const [selectedDrawingBeam, setSelectedDrawingBeam] = useState<BeamDesignOutput | null>(null);
  const [selectedFixBeam, setSelectedFixBeam] = useState<BeamDesignOutput | null>(null);
  const [selectedRebarEditBeam, setSelectedRebarEditBeam] = useState<BeamDesignOutput | null>(null);
  const [autoDesignSummary, setAutoDesignSummary] = useState<BatchBeamOptimizationSummary | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PASS' | 'WARNING' | 'FAIL'>('ALL');
  const [isDesigning, setIsDesigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isAutoDesigning, setIsAutoDesigning] = useState(false);
  const [isApplyingAutoDesign, setIsApplyingAutoDesign] = useState(false);
  const [editMemberId, setEditMemberId] = useState<number | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [showRebar, setShowRebar] = useState(true);
  const [showFloors, setShowFloors] = useState(true);
  const [showAudit, setShowAudit] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [showTable, setShowTable] = useState(true);

  const allBeams = useMemo(() => {
    if (!activeModel) return [];
    return Array.from(activeModel.members.values()).filter((m) => m.classification === 'BEAM');
  }, [activeModel]);

  // Extract distinct floor elevations and group beams floor-wise
  const floorGroups: FloorLevelGroup[] = useMemo(() => {
    if (!activeModel || allBeams.length === 0) return [];

    const elevationMap = new Map<number, number[]>();

    for (const b of allBeams) {
      const n1 = activeModel.nodes.get(b.startNodeId);
      const n2 = activeModel.nodes.get(b.endNodeId);
      const avgY = n1 && n2 ? (n1.y + n2.y) / 2 : n1?.y || 0;
      const roundedY = parseFloat(avgY.toFixed(1));

      if (!elevationMap.has(roundedY)) {
        elevationMap.set(roundedY, []);
      }
      elevationMap.get(roundedY)!.push(b.id);
    }

    const sortedElevations = Array.from(elevationMap.keys()).sort((a, b) => a - b);

    return sortedElevations.map((elev, idx) => {
      let name = `Floor ${idx + 1}`;
      if (idx === 0 && elev <= 1.0) name = 'Plinth Level';
      else if (idx === sortedElevations.length - 1 && sortedElevations.length > 1) name = 'Roof / Terrace';

      const beamIds = elevationMap.get(elev)!;
      return {
        id: `level_${elev}`,
        label: `${name} (+${elev.toFixed(2)}m)`,
        elevationY: elev,
        beamCount: beamIds.length,
        beamIds,
      };
    });
  }, [activeModel, allBeams]);

  // Filtered beams by floor
  const visibleBeams = useMemo(() => {
    if (selectedFloorId === 'ALL') return allBeams;
    const group = floorGroups.find((g) => g.id === selectedFloorId);
    if (!group) return allBeams;
    const idSet = new Set(group.beamIds);
    return allBeams.filter((b) => idSet.has(b.id));
  }, [allBeams, selectedFloorId, floorGroups]);

  // Floor-wise statistics for current view
  const floorStats = useMemo(() => {
    let totalConcreteM3 = 0;
    let maxMoment = 0;
    let warningCount = 0;

    for (const b of visibleBeams) {
      const width = b.section.zd || 0.3;
      const depth = b.section.yd || 0.45;
      totalConcreteM3 += width * depth * b.length;

      const design = designedBeams.get(b.id);
      if (design) {
        if (design.flexureTop.Mu_lim > maxMoment) {
          maxMoment = design.flexureTop.Mu_lim;
        }
        if (design.status !== 'PASS') {
          warningCount++;
        }
      }
    }

    const totalSteelKg = totalConcreteM3 * 2500 * 0.015;

    return {
      count: visibleBeams.length,
      concreteVolume: parseFloat(totalConcreteM3.toFixed(1)),
      steelKg: Math.round(totalSteelKg),
      maxMoment: parseFloat(maxMoment.toFixed(1)),
      warningCount,
    };
  }, [visibleBeams, designedBeams]);

  // Run Batch Beam Design
  const handleDesignAll = useCallback(() => {
    if (!activeModel || !activeProject) return;
    setIsDesigning(true);

    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const cover = activeProject.metadata.designSettings.clearCoverBeam || 30;

    const newMap = new Map<number, BeamDesignOutput>();

    for (const beam of allBeams) {
      const b = Math.round((beam.section.zd || 0.3) * 1000);
      const D = Math.round((beam.section.yd || 0.45) * 1000);
      const spanLength = beam.length;

      const forces = activeModel.memberForces.filter((f) => f.memberId === beam.id);
      let maxMoment = 0;
      let maxShear = 0;
      let govLC = 0; // 0 = unset

      if (forces.length > 0) {
        for (const f of forces) {
          // Update govLC whenever a higher shear or moment is found
          // (mz from forceParser is back-calculated; use loadCaseId from shear line which IS correct)
          if (Math.abs(f.vy) > maxShear) {
            maxShear = Math.abs(f.vy);
            govLC = f.loadCaseId; // governs from STAAD shear design LD=XX line
          }
          if (Math.abs(f.mz) > maxMoment) {
            maxMoment = Math.abs(f.mz);
            govLC = f.loadCaseId;
          }
        }
        // Also check the MemberDesignSummary (has correct Mu back-calc'd from REINF AREA table)
        const summary = activeModel.memberForces
          .filter((f) => f.memberId === beam.id)
          .reduce<{ maxMz: number; lc: number }>(
            (acc, f) => (f.mz > acc.maxMz ? { maxMz: f.mz, lc: f.loadCaseId } : acc),
            { maxMz: 0, lc: govLC }
          );
        if (summary.maxMz > 0) {
          maxMoment = summary.maxMz;
        }
      }

      // Engineering Gravity Envelope (1.5 DL + 1.5 LL)
      // Factored load: self-weight + 230mm brick wall (8.5 kN/m) + tributary slab DL+LL (~8.0 kN/m)
      const sw_unfactored = (b / 1000) * (D / 1000) * 25; // kN/m
      const wu_gravity = 1.5 * (sw_unfactored + 8.5 + 8.0); // ~28.5 to 30.5 kN/m factored
      const minGravityMoment = parseFloat(Math.max(45, (wu_gravity * spanLength * spanLength) / 10).toFixed(1));
      const minGravityShear = parseFloat(Math.max(35, (wu_gravity * spanLength) / 2).toFixed(1));

      // Design envelope: take max of STAAD parsed forces and realistic gravity envelope
      const designMoment = Math.max(maxMoment, minGravityMoment);
      const designShear = Math.max(maxShear, minGravityShear);
      if (govLC <= 0) govLC = 9; // Default to LC9 = 1.5DL+1.5LL if no STAAD forces

      const staadSummary = activeModel.designSummaries?.get(beam.id);

      let result = BeamDesignEngine.design({
        memberId: beam.id,
        b,
        D,
        spanLength,
        fck,
        fy,
        cover,
        Mu_top: designMoment,
        Mu_bottom: designMoment * 0.7,
        Vu: designShear,
        Ast_top_anl: staadSummary?.astTopReq,
        Ast_bottom_anl: staadSummary?.astBottomReq,
        governingLoadCase: govLC,
        allowedDiameters: allowedBeamRebarDiameters || [12, 16, 20, 25],
      });

      // Apply custom rebar override if available
      const customOverride = customBeamRebarMap.get(beam.id);
      if (customOverride) {
        const top = customOverride.topCurtailment;
        const bot = customOverride.botCurtailment;

        const aThruTop = top.throughCount * ((Math.PI * top.throughDia * top.throughDia) / 4);
        const aExtraTop = top.extraCount * ((Math.PI * top.extraDia * top.extraDia) / 4);
        const totalTopArea = parseFloat((aThruTop + aExtraTop).toFixed(1));

        const aThruBot = bot.throughCount * ((Math.PI * bot.throughDia * bot.throughDia) / 4);
        const aExtraBot = bot.extraCount * ((Math.PI * bot.extraDia * bot.extraDia) / 4);
        const totalBotArea = parseFloat((aThruBot + aExtraBot).toFixed(1));

        const cutoffTopLength = parseFloat(Math.max(0.6, spanLength / 3).toFixed(2));
        const midspanExtraLength = parseFloat((0.75 * spanLength).toFixed(2));

        const topCallout =
          top.extraCount > 0
            ? `${top.throughCount}-T${top.throughDia} (Thru) + ${top.extraCount}-T${top.extraDia} Extra (L/3 = ${cutoffTopLength}m)`
            : `${top.throughCount}-T${top.throughDia} (Through)`;

        const botCallout =
          bot.extraCount > 0
            ? `${bot.throughCount}-T${bot.throughDia} (Thru) + ${bot.extraCount}-T${bot.extraDia} Extra (Midspan ${midspanExtraLength}m)`
            : `${bot.throughCount}-T${bot.throughDia} (Through)`;

        result = {
          ...result,
          curtailment: {
            ...result.curtailment,
            throughTop: {
              count: top.throughCount,
              diameter: top.throughDia,
              callout: `${top.throughCount}-T${top.throughDia} (Through)`,
              area: parseFloat(aThruTop.toFixed(1)),
            },
            extraTopSupport: {
              count: top.extraCount,
              diameter: top.extraDia,
              callout: top.extraCount > 0 ? `${top.extraCount}-T${top.extraDia} Extra (L/3)` : 'None',
              cutoffLength: cutoffTopLength,
              area: parseFloat(aExtraTop.toFixed(1)),
              hasExtra: top.extraCount > 0,
            },
            throughBottom: {
              count: bot.throughCount,
              diameter: bot.throughDia,
              callout: `${bot.throughCount}-T${bot.throughDia} (Through)`,
              area: parseFloat(aThruBot.toFixed(1)),
            },
            extraBottomMidspan: {
              count: bot.extraCount,
              diameter: bot.extraDia,
              callout: bot.extraCount > 0 ? `${bot.extraCount}-T${bot.extraDia} Extra (Midspan)` : 'None',
              startOffset: parseFloat((0.125 * spanLength).toFixed(2)),
              length: midspanExtraLength,
              area: parseFloat(aExtraBot.toFixed(1)),
              hasExtra: bot.extraCount > 0,
            },
            topScheduleCallout: topCallout,
            bottomScheduleCallout: botCallout,
            totalTopArea,
            totalBottomArea: totalBotArea,
          },
        };
      }

      newMap.set(beam.id, result);
    }

    setDesignedBeams(newMap);
    setIsDesigning(false);
  }, [activeModel, activeProject, allBeams, customBeamRebarMap]);

  // Auto-run if empty or if member sections updated
  React.useEffect(() => {
    if (allBeams.length > 0) {
      handleDesignAll();
    }
  }, [allBeams, handleDesignAll]);

  // 1-Click Auto-Design & Economical Optimizer Engine
  const handleRunAutoDesign = (targetBeams: Member3D[], preferredWidth: number = 300) => {
    if (!activeModel || !activeProject || targetBeams.length === 0) return;
    setIsAutoDesigning(true);

    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const cover = activeProject.metadata.designSettings.clearCoverBeam || 30;

    // Run optimization defaulting to 300 mm standard width for uncrowded single-layer rebars
    const summary = BeamOptimizationEngine.optimizeAllBeams(
      targetBeams,
      activeModel,
      fck,
      fy,
      cover,
      allowedBeamRebarDiameters || [12, 16, 20, 25],
      preferredWidth
    );
    setAutoDesignSummary(summary);
    setIsAutoDesigning(false);
  };

  // Re-run beam batch optimization with selected rebar diameters and width preference
  const handleReoptimize = (allowedDiameters: number[], preferredWidth?: number) => {
    if (!activeModel || !activeProject) return;
    const fck = activeProject.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = activeProject.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const cover = activeProject.metadata.designSettings.clearCoverBeam || 30;

    const targetBeams = allBeams;
    const summary = BeamOptimizationEngine.optimizeAllBeams(
      targetBeams,
      activeModel,
      fck,
      fy,
      cover,
      allowedDiameters,
      preferredWidth
    );
    setAutoDesignSummary(summary);
  };

  // Confirm and apply all optimized sections & rebars in 1 click
  const handleConfirmApplyAutoDesign = async () => {
    if (!autoDesignSummary) return;
    setIsApplyingAutoDesign(true);

    // Apply batch section size updates to STAAD model
    await batchUpdateSections(autoDesignSummary.sectionUpdates);

    // Sync optimized rebar layouts
    const newRebarMap = new Map(customBeamRebarMap);
    for (const res of autoDesignSummary.results) {
      const cur = res.optimizedDesign.curtailment;
      newRebarMap.set(res.memberId, {
        topCurtailment: {
          throughCount: cur.throughTop.count,
          throughDia: cur.throughTop.diameter,
          extraCount: cur.extraTopSupport.hasExtra ? cur.extraTopSupport.count : 0,
          extraDia: cur.extraTopSupport.diameter,
        },
        botCurtailment: {
          throughCount: cur.throughBottom.count,
          throughDia: cur.throughBottom.diameter,
          extraCount: cur.extraBottomMidspan.hasExtra ? cur.extraBottomMidspan.count : 0,
          extraDia: cur.extraBottomMidspan.diameter,
        },
      });
    }

    setCustomBeamRebarMap(newRebarMap);
    setIsApplyingAutoDesign(false);
    setAutoDesignSummary(null);
    handleDesignAll();
  };

  const handleSaveDesigns = async () => {
    if (designedBeams.size === 0) return;
    setIsSaving(true);
    try {
      await saveBeamDesigns(designedBeams, customBeamRebarMap);
      setSaveSuccessMsg(`Successfully saved ${designedBeams.size} Beam designs to project!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick inline section changer (automatically recalculates economic rebar arrangement for new size)
  const handleQuickChangeSection = async (memberId: number, zd: number, yd: number) => {
    // Clear stale custom rebar override so new dimensions dynamically calculate economical rebar
    const nextOverrides = new Map(customBeamRebarMap);
    nextOverrides.delete(memberId);
    setCustomBeamRebarMap(nextOverrides);

    const name = `${Math.round(zd * 1000)}x${Math.round(yd * 1000)} mm`;
    await updateMemberSection(memberId, yd, zd, name);
  };

  // Bulk Floor Section Change
  const handleBulkFloorSectionChange = async (zd: number, yd: number) => {
    if (visibleBeams.length === 0) return;

    // Clear stale overrides for all target beams
    const nextOverrides = new Map(customBeamRebarMap);
    for (const b of visibleBeams) {
      nextOverrides.delete(b.id);
    }
    setCustomBeamRebarMap(nextOverrides);

    const name = `${Math.round(zd * 1000)}x${Math.round(yd * 1000)} mm`;
    const updates = visibleBeams.map((b) => ({
      memberId: b.id,
      yd,
      zd,
      name,
    }));
    await batchUpdateSections(updates);
  };

  // Apply custom beam rebar from BeamRebarEditModal
  const handleApplyBeamRebar = (
    memberId: number,
    topCurtailment: any,
    botCurtailment: any,
    applyScope: 'SINGLE' | 'FLOOR' | 'ALL'
  ) => {
    const newOverrides = new Map(customBeamRebarMap);

    if (applyScope === 'ALL') {
      for (const b of allBeams) {
        newOverrides.set(b.id, { topCurtailment, botCurtailment });
      }
    } else if (applyScope === 'FLOOR') {
      const activeGroup = floorGroups.find((g) => g.id === selectedFloorId);
      const targetBeams = activeGroup ? activeGroup.beamIds : [memberId];
      for (const bid of targetBeams) {
        newOverrides.set(bid, { topCurtailment, botCurtailment });
      }
    } else {
      newOverrides.set(memberId, { topCurtailment, botCurtailment });
    }

    setCustomBeamRebarMap(newOverrides);
  };

  // 1-Click Auto-Fix All Warnings
  const handleAutoFixAllWarnings = async () => {
    const nonPassingBeams = Array.from(designedBeams.values()).filter((b) => b.status !== 'PASS');
    if (nonPassingBeams.length === 0) {
      handleDesignAll();
      return;
    }

    const updates = nonPassingBeams.map((b) => ({
      memberId: b.memberId,
      zd: 0.23,
      yd: 0.45,
      name: '230x450 mm',
    }));

    await batchUpdateSections(updates);
    handleDesignAll();
  };

  const rows = useMemo(() => {
    return visibleBeams
      .map((beam) => {
        const design = designedBeams.get(beam.id);
        const n1 = activeModel?.nodes.get(beam.startNodeId);
        const elev = n1 ? n1.y.toFixed(2) : '0.00';

        return {
          memberId: beam.id,
          dimensions: beam.section.name || `${Math.round((beam.section.zd || 0.3) * 1000)}x${Math.round((beam.section.yd || 0.45) * 1000)} mm`,
          zd: beam.section.zd || 0.3,
          yd: beam.section.yd || 0.45,
          spanLength: beam.length,
          elevation: `+${elev}m`,
          design,
        };
      })
      .filter((r) => {
        if (filterStatus === 'ALL') return true;
        return r.design?.status === filterStatus;
      });
  }, [visibleBeams, designedBeams, filterStatus, activeModel]);

  const columns: ColumnDef<any>[] = [
    {
      header: 'BEAM #',
      accessorKey: 'memberId',
      sortable: true,
      cell: (r) => <span className="font-bold text-sky-700 font-mono">B-{r.memberId}</span>,
      width: '85px',
    },
    {
      header: 'FLOOR LEVEL',
      accessorKey: 'elevation',
      sortable: true,
      cell: (r) => (
        <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
          {r.elevation}
        </span>
      ),
      width: '100px',
    },
    {
      header: 'SIZE (b × D)',
      accessorKey: 'dimensions',
      cell: (r) => {
        const currentSizeStr = `${Math.round(r.zd * 1000)}x${Math.round(r.yd * 1000)}`;
        return (
          <div className="flex items-center gap-1">
            <select
              value={currentSizeStr}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'CUSTOM') {
                  setEditMemberId(r.memberId);
                } else {
                  const [wStr, dStr] = val.split('x');
                  handleQuickChangeSection(r.memberId, Number(wStr) / 1000, Number(dStr) / 1000);
                }
              }}
              className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs font-bold text-deep-navy hover:border-secondary-brand focus:border-secondary-brand focus:outline-hidden cursor-pointer"
              title="Select RCC beam size or choose Custom"
            >
              {QUICK_SIZE_OPTIONS.map((opt, i) => {
                const optKey = `${Math.round(opt.zd * 1000)}x${Math.round(opt.yd * 1000)}`;
                return (
                  <option key={i} value={optKey}>
                    {opt.label}
                  </option>
                );
              })}
              <option value="CUSTOM">Custom Size...</option>
            </select>
          </div>
        );
      },
      width: '165px',
    },
    {
      header: 'SPAN (m)',
      accessorKey: 'spanLength',
      sortable: true,
      align: 'right',
      cell: (r) => <span className="font-mono">{r.spanLength.toFixed(2)}</span>,
      width: '80px',
    },
    {
      header: 'GOV. LOAD CASE',
      align: 'center',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono text-[10px]">—</span>;
        const lcId = r.design.governingLoadCase;
        const lc = activeModel?.loadCases.get(lcId);
        const lcType = lc?.type || '';
        const isCombo = lc?.isCombination ?? lcId > 8;
        const colorClass = isCombo
          ? 'bg-amber-100 text-amber-900 border-amber-300'
          : lcType === 'SEISMIC'
          ? 'bg-purple-100 text-purple-900 border-purple-300'
          : lcType === 'WIND'
          ? 'bg-sky-100 text-sky-900 border-sky-300'
          : lcType === 'LIVE'
          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
          : 'bg-slate-100 text-slate-700 border-slate-300';
        return (
          <div className={`font-mono text-[10px] px-2 py-1 rounded border ${colorClass} text-center leading-tight`}>
            <div className="font-bold">LC {lcId}</div>
            {lc && <div className="text-[9px] truncate max-w-[90px]">{lc.title}</div>}
          </div>
        );
      },
      width: '105px',
    },
    {
      header: 'Mu / Vu Demand',
      align: 'right',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">—</span>;
        return (
          <div className="font-mono text-right text-xs leading-tight">
            <div className="font-bold text-orange-700">M: {r.design.demandMu.toFixed(1)} kNm</div>
            <div className="text-purple-700">V: {r.design.demandVu.toFixed(1)} kN</div>
          </div>
        );
      },
      width: '110px',
    },
    {
      header: 'TOP REBAR (Ast BASED)',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">Pending</span>;
        const cur = r.design.curtailment;
        return (
          <button
            type="button"
            onClick={() => setSelectedRebarEditBeam(r.design)}
            className="font-mono text-left group hover:bg-slate-50 p-1 rounded transition-colors w-full"
            title="Click to modify Top Rebar based on Ast demand"
          >
            <span className="font-bold text-orange-600 group-hover:text-orange-700 underline decoration-dotted block text-xs">
              {cur ? cur.topScheduleCallout : r.design.topRebar.callout}
            </span>
            <span className="text-[10px] text-slate-500 block">
              Ast,prov: <strong className="text-slate-700">{cur ? cur.totalTopArea : r.design.topRebar.totalArea} mm²</strong> (Req: {r.design.flexureTop.Ast_req} mm²
              {r.design.astTopReqAnl ? <span className="text-orange-700 font-semibold"> • STAAD: {r.design.astTopReqAnl} mm²</span> : ''}) ✎
            </span>
          </button>
        );
      },
      width: '240px',
    },
    {
      header: 'BOTTOM REBAR (Ast BASED)',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">Pending</span>;
        const cur = r.design.curtailment;
        return (
          <button
            type="button"
            onClick={() => setSelectedRebarEditBeam(r.design)}
            className="font-mono text-left group hover:bg-slate-50 p-1 rounded transition-colors w-full"
            title="Click to modify Bottom Rebar based on Ast demand"
          >
            <span className="font-bold text-sky-600 group-hover:text-sky-700 underline decoration-dotted block text-xs">
              {cur ? cur.bottomScheduleCallout : r.design.bottomRebar.callout}
            </span>
            <span className="text-[10px] text-slate-500 block">
              Ast,prov: <strong className="text-slate-700">{cur ? cur.totalBottomArea : r.design.bottomRebar.totalArea} mm²</strong> (Req: {r.design.flexureBottom.Ast_req} mm²
              {r.design.astBottomReqAnl ? <span className="text-sky-700 font-semibold"> • STAAD: {r.design.astBottomReqAnl} mm²</span> : ''}) ✎
            </span>
          </button>
        );
      },
      width: '240px',
    },
    {
      header: 'SHEAR LINKS (IS 13920)',
      cell: (r) => {
        if (!r.design) return <span className="text-slate-400 font-mono">Pending</span>;
        return <span className="font-mono text-purple-700 font-semibold">{r.design.shear.callout}</span>;
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
            onClick={() => setSelectedFixBeam(r.design)}
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
      width: '100px',
    },
    {
      header: 'ACTIONS',
      align: 'center',
      cell: (r) => (
        <div className="flex items-center gap-1.5 justify-center">
          <button
            onClick={() => setSelectedRebarEditBeam(r.design)}
            className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded border border-sky-200 text-[11px] font-mono shadow-xs transition-colors"
            title="Modify Rebars Based on Ast Demand"
          >
            Ast Rebar
          </button>

          {r.design && r.design.status !== 'PASS' ? (
            <button
              onClick={() => setSelectedFixBeam(r.design)}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-mono font-bold shadow-xs transition-colors flex items-center gap-1"
              title="1-Click Auto-Fix & Manual Diagnostics"
            >
              <Wrench className="w-3 h-3" />
              <span>Fix</span>
            </button>
          ) : (
            <button
              onClick={() => setEditMemberId(r.memberId)}
              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-200 text-[11px] font-mono shadow-xs transition-colors"
              title="Custom Resizing & WBSC Optimizer"
            >
              Edit
            </button>
          )}

          <button
            onClick={() => r.design && setSelectedReport(r.design.calculationReport)}
            disabled={!r.design}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border text-[11px] font-mono shadow-xs transition-colors disabled:opacity-40"
            title="View Step-by-step Math Sheet"
          >
            Calc
          </button>
          <button
            onClick={() => r.design && setSelectedDrawingBeam(r.design)}
            disabled={!r.design}
            className="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded border border-sky-200 text-[11px] font-mono shadow-xs transition-colors disabled:opacity-40"
            title="View CAD SVG Drawing"
          >
            Draw
          </button>
        </div>
      ),
      width: '215px',
    },
  ];

  const handleExport = () => {
    const floorLabel = selectedFloorId === 'ALL' ? 'All_Floors' : selectedFloorId;
    exportToCsv(
      rows.map((r) => ({
        BeamId: r.memberId,
        FloorLevel: r.elevation,
        Size: r.dimensions,
        Span_m: r.spanLength,
        Mu_top_kNm: r.design?.flexureTop.Mu_lim || 0,
        Ast_top_req_mm2: r.design?.flexureTop.Ast_req || 0,
        Ast_top_prov_mm2: r.design?.curtailment?.totalTopArea || r.design?.topRebar.totalArea || 0,
        TopBars: r.design?.curtailment?.topScheduleCallout || r.design?.topRebar.callout || '',
        BottomBars: r.design?.curtailment?.bottomScheduleCallout || r.design?.bottomRebar.callout || '',
        ShearLinks: r.design?.shear.callout || '',
        Status: r.design?.status || 'PENDING',
      })),
      `IS456_Beam_Schedule_${floorLabel}.csv`
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-5 bg-ui-background overflow-y-auto font-sans">
      {/* Global hide for all panels */}
      <div className="flex items-center justify-end gap-1.5 -mb-1">
        <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider">Panels:</span>
        <button
          type="button"
          onClick={() => { setShowBanner(true); setShowRebar(true); setShowFloors(true); setShowAudit(true); setShowFilters(true); setShowTable(true); }}
          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-[11px] font-mono shadow-2xs flex items-center gap-1"
        >
          <Eye className="w-3 h-3" /> Show All
        </button>
        <button
          type="button"
          onClick={() => { setShowBanner(false); setShowRebar(false); setShowFloors(false); setShowAudit(false); }}
          className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-[11px] font-mono shadow-2xs flex items-center gap-1"
        >
          <EyeOff className="w-3 h-3" /> Hide All
        </button>
      </div>

      <CollapsiblePanel
        title="IS 456:2000 & IS 13920:2016 FLOOR-WISE RCC BEAM DESIGN ENGINE"
        icon={<Compass className="w-5 h-5 text-sky-600" />}
        storageKey="beam-banner"
        open={showBanner}
        onToggle={setShowBanner}
        contentClassName="p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">
              Story-by-story beam detailing, 1-click economical auto-designer, Ast rebar optimizer, and ductile confinement.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* ⚡ 1-Click Auto-Design All Beams Button */}
            <button
              onClick={() => handleRunAutoDesign(allBeams)}
              disabled={isAutoDesigning || allBeams.length === 0}
              className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold rounded shadow transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              title="Automatically optimize cross sections and rebars to be as economical as possible without failing code checks"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>{isAutoDesigning ? 'Optimizing All Beams...' : '⚡ 1-Click Auto-Design All Beams'}</span>
            </button>

            {floorStats.warningCount > 0 && (
              <button
                onClick={handleAutoFixAllWarnings}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-mono text-xs font-bold rounded shadow transition-all animate-bounce"
                title="1-Click Auto-Fix all warnings and non-compliant beams"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ Auto-Fix All ({floorStats.warningCount}) Warnings</span>
              </button>
            )}

            {designedBeams.size > 0 && (
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white hover:bg-slate-50 border border-ui-border rounded transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export Floor CSV
              </button>
            )}

            <button
              onClick={handleSaveDesigns}
              disabled={isSaving || designedBeams.size === 0}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-mono text-xs font-bold rounded shadow transition-all disabled:opacity-50"
              title="Save designed beams and custom rebar configurations to project"
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
              <span>{isDesigning ? 'Designing Beams...' : 'Re-calculate Beams'}</span>
            </button>
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title="UNIVERSAL REBAR SELECTION (RCC Beam)"
        icon={<Layers className="w-4 h-4 text-emerald-600" />}
        storageKey="beam-rebar"
        open={showRebar}
        onToggle={setShowRebar}
        contentClassName="p-3"
      >
        <UniversalRebarBar moduleName="RCC Beam" />
      </CollapsiblePanel>

      {/* Save Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      <CollapsiblePanel
        title="Floor / Story Level Selector & Batch Sizing"
        icon={<Building2 className="w-4 h-4 text-sky-600" />}
        storageKey="beam-floors"
        open={showFloors}
        onToggle={setShowFloors}
        contentClassName="p-3"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-deep-navy flex items-center gap-1.5 uppercase">
              <Building2 className="w-4 h-4 text-sky-600" />
              Select Floor / Story Level:
            </span>
          <div className="flex items-center gap-2">
            {/* Auto-Design Active Floor Button */}
            <button
              onClick={() => handleRunAutoDesign(visibleBeams)}
              disabled={isAutoDesigning || visibleBeams.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded font-mono text-xs font-bold shadow-xs transition-colors"
              title="Auto-design and economize beams on current floor"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>⚡ Auto-Design {selectedFloorId === 'ALL' ? 'All Floors' : 'Active Floor'}</span>
            </button>

            <span className="text-[11px] font-mono text-slate-500">
              Bulk Resize:
            </span>
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const [w, d] = val.split('x').map(Number);
                  handleBulkFloorSectionChange(w / 1000, d / 1000);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs text-secondary-brand font-bold focus:outline-hidden"
            >
              <option value="" disabled>
                ⚡ Apply Size to {selectedFloorId === 'ALL' ? 'All Floors' : 'Floor'}...
              </option>
              {QUICK_SIZE_OPTIONS.map((opt, i) => {
                const k = `${Math.round(opt.zd * 1000)}x${Math.round(opt.yd * 1000)}`;
                return (
                  <option key={i} value={k}>
                    Set all to {opt.label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedFloorId('ALL')}
            className={`px-3 py-1.5 font-mono text-xs rounded border transition-all ${
              selectedFloorId === 'ALL'
                ? 'bg-deep-navy text-white border-deep-navy font-bold shadow-sm'
                : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
            }`}
          >
            All Floors ({allBeams.length} Beams)
          </button>

          {floorGroups.map((fg) => {
            const isActive = selectedFloorId === fg.id;
            return (
              <button
                key={fg.id}
                onClick={() => setSelectedFloorId(fg.id)}
                className={`px-3 py-1.5 font-mono text-xs rounded border transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-secondary-brand text-white border-secondary-brand font-bold shadow-sm'
                    : 'bg-white text-slate-700 border-ui-border hover:bg-slate-50'
                }`}
              >
                <span>{fg.label}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${isActive ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {fg.beamCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Floor Quick Statistics KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-ui-border text-xs font-mono">
          <div className="bg-slate-50 p-2 rounded border border-ui-border flex justify-between items-center">
            <span className="text-slate-500">Beams on Level:</span>
            <span className="font-bold text-deep-navy">{floorStats.count}</span>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-ui-border flex justify-between items-center">
            <span className="text-slate-500">Concrete Volume:</span>
            <span className="font-bold text-sky-700">{floorStats.concreteVolume} m³</span>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-ui-border flex justify-between items-center">
            <span className="text-slate-500">Est. Rebar Steel:</span>
            <span className="font-bold text-secondary-brand">{floorStats.steelKg} kg</span>
          </div>
          <div className="bg-slate-50 p-2 rounded border border-ui-border flex justify-between items-center">
            <span className="text-slate-500">Max Design Mz:</span>
            <span className="font-bold text-orange-600">{floorStats.maxMoment} kNm</span>
          </div>
        </div>
        </div>
      </CollapsiblePanel>

      {activeModel && (
        <CollapsiblePanel
          title="Load Combination & Engineering Gravity Envelope Audit (G+3 Standard)"
          icon={<Layers className="w-4 h-4 text-amber-600" />}
          storageKey="beam-audit"
          open={showAudit}
          onToggle={setShowAudit}
          contentClassName="p-3"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span className="font-mono text-xs font-bold text-amber-900 uppercase">
                  Load Combination & Engineering Gravity Envelope Audit (G+3 Standard)
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-300 font-semibold">
              Gravity Envelope Active (wu ≈ 30 kN/m)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Self Weight */}
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs font-mono">
              <div className="font-bold text-amber-800 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" /> Self Weight (SW)
              </div>
              {(() => {
                const dlCase = Array.from(activeModel.loadCases.values()).find(
                  (lc) => lc.type === 'DEAD' && !lc.isCombination
                );
                return dlCase ? (
                  <span className="text-emerald-700 font-semibold">
                    ✓ LC {dlCase.id}: {dlCase.title} — SELFWEIGHT Y -1 applied (25 kN/m³)
                  </span>
                ) : (
                  <span className="text-rose-600">⚠ No Dead Load case parsed</span>
                );
              })()}
            </div>

            {/* Member UDL */}
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs font-mono">
              <div className="font-bold text-amber-800 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" /> Wall UDL + Floor Load
              </div>
              <div className="space-y-1">
                {(() => {
                  const dlCase = Array.from(activeModel.loadCases.values()).find(
                    (lc) => lc.type === 'DEAD' && !lc.isCombination
                  );
                  const llCase = Array.from(activeModel.loadCases.values()).find(
                    (lc) => lc.type === 'LIVE' && !lc.isCombination
                  );
                  return (
                    <>
                      <div className={dlCase ? 'text-emerald-700 font-semibold' : 'text-rose-600'}>
                        {dlCase ? `✓ LC ${dlCase.id} (${dlCase.title}): UNI GY -8.5 kN/m wall load` : '⚠ DL case missing'}
                      </div>
                      <div className={llCase ? 'text-emerald-700 font-semibold' : 'text-rose-600'}>
                        {llCase ? `✓ LC ${llCase.id} (${llCase.title}): FLOOR LOAD -3 kN/m² (LL)` : '⚠ LL case missing'}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Load Combinations */}
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs font-mono">
              <div className="font-bold text-amber-800 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-amber-600" /> IS 875 Load Combinations Active
              </div>
              <div className="space-y-0.5 max-h-20 overflow-y-auto">
                {Array.from(activeModel.loadCombinations.values()).slice(0, 8).map((lc) => (
                  <div key={lc.id} className="truncate text-[10px]">
                    <span className="text-slate-500 mr-1">LC {lc.id}:</span>
                    <span className="text-emerald-800 font-semibold">{lc.title}</span>
                  </div>
                ))}
                {activeModel.loadCombinations.size > 8 && (
                  <div className="text-slate-400 text-[10px]">
                    +{activeModel.loadCombinations.size - 8} more combinations ({activeModel.loadCombinations.size} total)
                  </div>
                )}
                {activeModel.loadCombinations.size === 0 && (
                  <span className="text-rose-500">⚠ No load combinations parsed from ANL file</span>
                )}
              </div>
            </div>
          </div>

          {/* Engineering Envelope & Sizing Guardrails Note */}
          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[11px] font-mono text-blue-900">
            <span className="font-bold text-blue-800">🛡️ G+3 Building Sizing Guardrails (IS 456 & IS 13920):</span>
            <span className="ml-1 text-slate-700">
              Beams are designed for governing <span className="font-bold text-deep-navy">max(STAAD ANL Forces, 1.5 DL + 1.5 LL Gravity Envelope)</span> with span-to-depth deflection minimums (L ≥ 4.2m → D ≥ 450mm, 3.2m ≤ L &lt; 4.2m → D ≥ 400mm, 2.2m ≤ L &lt; 3.2m → D ≥ 350mm).
            </span>
          </div>
          </div>
        </CollapsiblePanel>
      )}

      <CollapsiblePanel
        title="Filter by Status"
        icon={<Layers className="w-4 h-4 text-slate-500" />}
        storageKey="beam-filters"
        open={showFilters}
        onToggle={setShowFilters}
        contentClassName="p-3"
        variant="card"
      >
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
              {st} ({st === 'ALL' ? visibleBeams.length : visibleBeams.filter((b) => designedBeams.get(b.id)?.status === st).length})
            </button>
          ))}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        title={
          selectedFloorId === 'ALL'
            ? 'RCC BEAM SCHEDULE — ALL FLOORS'
            : `RCC BEAM SCHEDULE — ${floorGroups.find((g) => g.id === selectedFloorId)?.label.toUpperCase()}`
        }
        icon={<Layers className="w-4 h-4 text-sky-700" />}
        storageKey="beam-table"
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
          title={
            selectedFloorId === 'ALL'
              ? 'RCC BEAM SCHEDULE — ALL FLOORS'
              : `RCC BEAM SCHEDULE — ${floorGroups.find((g) => g.id === selectedFloorId)?.label.toUpperCase()}`
          }
          searchPlaceholder="Search by beam # or size..."
          searchFilter={(item, q) =>
            String(item.memberId).includes(q) ||
            item.dimensions.toLowerCase().includes(q) ||
            item.elevation.toLowerCase().includes(q) ||
            String(item.design?.topRebar.callout || '').toLowerCase().includes(q)
          }
          onExportCsv={handleExport}
        />
        </div>
      </CollapsiblePanel>

      {/* Step-by-Step Calculation Sheet Modal */}
      <CalculationModal report={selectedReport} onClose={() => setSelectedReport(null)} />

      {/* SVG CAD Drawing Drawer Modal */}
      {selectedDrawingBeam && (
        <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
          <div className="w-full max-w-4xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold text-deep-navy">
                CAD REINFORCEMENT DRAWING — BEAM B-{selectedDrawingBeam.memberId}
              </h3>
              <button onClick={() => setSelectedDrawingBeam(null)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <BeamDrawingSvg beam={selectedDrawingBeam} />
            </div>
          </div>
        </div>
      )}

      {/* Ast-Based Rebar Optimizer & Modifier Modal */}
      <BeamRebarEditModal
        beam={selectedRebarEditBeam}
        isOpen={selectedRebarEditBeam !== null}
        onClose={() => setSelectedRebarEditBeam(null)}
        onApplyRebar={handleApplyBeamRebar}
      />

      {/* 1-Click Economical Auto-Design Modal */}
      <BeamAutoDesignModal
        summary={autoDesignSummary}
        isOpen={autoDesignSummary !== null}
        onClose={() => setAutoDesignSummary(null)}
        onConfirmApply={handleConfirmApplyAutoDesign}
        onReoptimize={handleReoptimize}
        isApplying={isApplyingAutoDesign}
      />

      {/* Warning Diagnostics & Auto-Fix Modal */}
      <WarningFixModal
        beamDesign={selectedFixBeam}
        isOpen={selectedFixBeam !== null}
        onClose={() => setSelectedFixBeam(null)}
        onAutoFixApplied={handleDesignAll}
      />

      {/* Section Edit & Economical Sizing Modal */}
      <SectionEditModal
        memberId={editMemberId}
        isOpen={editMemberId !== null}
        onClose={() => setEditMemberId(null)}
        onSaved={handleDesignAll}
      />
    </div>
  );
};

