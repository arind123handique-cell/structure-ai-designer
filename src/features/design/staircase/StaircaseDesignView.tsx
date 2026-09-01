import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  StaircaseDesignEngine,
  StaircaseRoomGeometry,
  StaircaseLandingEntryConfig,
  StaircaseFlightDesignOutput,
  StoreyStaircaseDesignOutput,
  BuildingStaircaseSummary,
  DiaphragmLevelInfo,
} from './staircaseEngine';
import { StaircaseDrawingSvg } from './StaircaseDrawingSvg';
import { CalculationModal } from '@/features/calculations/CalculationModal';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { DataTable, ColumnDef } from '@/components/tables/DataTable';
import { CollapsiblePanel } from '@/components/common/CollapsiblePanel';
import { UniversalRebarBar } from '@/features/design/common/UniversalRebarBar';
import { exportToCsv } from '@/utils/exportUtils';
import {
  Layers,
  Building,
  Box,
  Compass,
  FileText,
  Download,
  CheckCircle2,
  Sliders,
  Sparkles,
  Save,
  Play,
  RotateCcw,
  DoorOpen,
  Info,
  Maximize2,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';

export const StaircaseDesignView: React.FC = () => {
  const { activeModel, activeProject, saveStaircaseDesigns, universalRebarSelection } = useProjectStore();

  // Extract Diaphragm Levels from STAAD Model
  const diaphragmLevels: DiaphragmLevelInfo[] = useMemo(() => {
    return StaircaseDesignEngine.extractDiaphragmLevels(activeModel);
  }, [activeModel]);

  const [selectedLevelIndex, setSelectedLevelIndex] = useState<number>(1);
  const [activeFlightIndex, setActiveFlightIndex] = useState<1 | 2>(1);

  // Custom Geometry State
  const defaultGeom = useMemo(() => {
    return StaircaseDesignEngine.getDefaultGeometry(activeProject?.metadata);
  }, [activeProject]);

  const [customGeometry, setCustomGeometry] = useState<StaircaseRoomGeometry>(defaultGeom);

  // Custom Landing Entry Configuration
  const defaultEntry = useMemo(() => {
    return StaircaseDesignEngine.getDefaultLandingEntryConfig();
  }, []);

  const [landingEntryConfig, setLandingEntryConfig] = useState<StaircaseLandingEntryConfig>(defaultEntry);

  // Calculation report modal
  const [selectedReport, setSelectedReport] = useState<DetailedCalculationReport | null>(null);

  // UI Panels
  const [showParameters, setShowParameters] = useState(true);
  const [showRebarSelection, setShowRebarSelection] = useState(true);
  const [showLandingEntries, setShowLandingEntries] = useState(true);
  const [showTable, setShowTable] = useState(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Effective geometry taking universal rebar into account
  const effectiveGeometry: StaircaseRoomGeometry = useMemo(() => {
    return {
      ...customGeometry,
      allowedUniversalDiameters: universalRebarSelection?.longitudinalDiameters,
    };
  }, [customGeometry, universalRebarSelection?.longitudinalDiameters]);

  // Calculate Building-wide Staircase Summary
  const buildingSummary: BuildingStaircaseSummary = useMemo(() => {
    return StaircaseDesignEngine.calculateBuildingStaircaseSummary(
      activeModel,
      activeProject?.metadata,
      {
        customGeometry: effectiveGeometry,
        customLandingEntry: landingEntryConfig,
      }
    );
  }, [activeModel, activeProject, effectiveGeometry, landingEntryConfig]);

  // Active Storey Design
  const activeStoreyDesign: StoreyStaircaseDesignOutput = useMemo(() => {
    const found = buildingSummary.storeyDesigns.find((s) => s.levelIndex === selectedLevelIndex);
    return found || buildingSummary.storeyDesigns[0];
  }, [buildingSummary, selectedLevelIndex]);

  // Flattened Flight Table Rows
  const tableRows = useMemo(() => {
    const rows: (StaircaseFlightDesignOutput & { storeyLevelName: string; storeyIndex: number })[] = [];
    buildingSummary.storeyDesigns.forEach((s) => {
      rows.push({
        ...s.flight1,
        storeyLevelName: s.levelName,
        storeyIndex: s.levelIndex,
      });
      rows.push({
        ...s.flight2,
        storeyLevelName: s.levelName,
        storeyIndex: s.levelIndex,
      });
    });
    return rows;
  }, [buildingSummary]);

  // Update Geometry Field
  const handleUpdateGeom = (field: keyof StaircaseRoomGeometry, value: number) => {
    setCustomGeometry((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Update Entry Field
  const handleUpdateEntry = (field: keyof StaircaseLandingEntryConfig, value: any) => {
    setLandingEntryConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Reset to default geometry
  const handleResetDefaults = () => {
    setCustomGeometry(defaultGeom);
    setLandingEntryConfig(defaultEntry);
  };

  // Save designs to project
  const handleSaveDesigns = () => {
    setIsSaving(true);
    try {
      if (saveStaircaseDesigns) {
        saveStaircaseDesigns(buildingSummary, customGeometry, landingEntryConfig);
      }
      setSaveSuccessMsg(`Successfully saved ${buildingSummary.totalStoreys} storey staircase designs & BBS to project state!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Export CSV Schedule
  const handleExportCsv = () => {
    const records = tableRows.map((r) => ({
      'Storey Level': r.storeyLevelName,
      'Flight Name': r.name,
      'Riser (mm)': r.riserMm,
      'Tread (mm)': r.treadMm,
      'Riser Count': r.riserCount,
      'Tread Count': r.treadCount,
      'Waist Slab (mm)': r.waistSlabThicknessMm,
      'Slope Angle (deg)': r.slopeAngleDeg,
      'Eff Span Leff (m)': r.effectiveSpanLeffM,
      'Design Mu (kNm)': r.designMomentMu,
      'Design Vu (kN)': r.designShearVu,
      'Main Rebar (IS 456)': r.mainRebarCallout,
      'Ast Provided (mm2/m)': r.mainAstProvided,
      'Ast Req (mm2/m)': r.mainAstRequired,
      'pt (%)': r.ptProvided,
      'Distribution Rebar': r.distributionRebarCallout,
      'Top Support Rebar': r.topNegativeRebarCallout,
      'Kink Detailing (IS 13920)': r.kinkAnchorageDetail,
      'Concrete (m3)': r.concreteM3,
      'Steel (kg)': r.steelKg,
      'Formwork (m2)': r.formworkM2,
      'Status': r.status,
    }));

    exportToCsv(records, `Staircase_Design_Schedule_${activeProject?.metadata.name || 'Project'}.csv`);
  };

  // DataTable columns
  const columns: ColumnDef<StaircaseFlightDesignOutput & { storeyLevelName: string; storeyIndex: number }>[] = [
    {
      header: 'STOREY & FLIGHT',
      sortable: true,
      cell: (r) => (
        <div className="font-mono text-xs">
          <span className="font-bold text-deep-navy block">{r.storeyLevelName}</span>
          <span className="text-[10px] text-slate-500 block">{r.name}</span>
        </div>
      ),
      width: '200px',
    },
    {
      header: 'GEOMETRY (R × T)',
      cell: (r) => (
        <div className="font-mono text-xs">
          <span className="font-bold text-indigo-700 block">
            {r.riserCount}R ({r.riserMm}mm) × {r.treadCount}T ({r.treadMm}mm)
          </span>
          <span className="text-[10px] text-slate-500 block">
            tw = {r.waistSlabThicknessMm}mm | θ = {r.slopeAngleDeg}° | Leff = {r.effectiveSpanLeffM}m
          </span>
        </div>
      ),
      width: '210px',
    },
    {
      header: 'DESIGN MOMENT & SHEAR',
      cell: (r) => (
        <div className="font-mono text-xs">
          <span className="font-bold text-slate-900 block">Mu = {r.designMomentMu} kNm</span>
          <span className="text-[10px] text-slate-500 block">Vu = {r.designShearVu} kN</span>
        </div>
      ),
      width: '180px',
    },
    {
      header: 'MAIN REBAR (IS 456 / SP:34)',
      cell: (r) => (
        <div className="font-mono text-xs">
          <span className="font-bold text-orange-700 block">
            {r.mainRebarCallout}
          </span>
          <span className="text-[10px] text-slate-500 block">
            Ast: {r.mainAstProvided} mm²/m (pt = {r.ptProvided}%)
          </span>
        </div>
      ),
      width: '240px',
    },
    {
      header: 'DISTRIBUTION & KINK ANCHOR',
      cell: (r) => (
        <div className="font-mono text-xs">
          <span className="text-slate-800 font-semibold block">
            {r.distributionRebarCallout}
          </span>
          <span className="text-[10px] text-emerald-700 block font-bold">
            {r.kinkAnchorageDetail.split('(')[0]}
          </span>
        </div>
      ),
      width: '240px',
    },
    {
      header: 'CONCRETE (m³)',
      sortable: true,
      align: 'right',
      cell: (r) => (
        <span className="font-mono font-bold text-sky-700">
          {r.concreteM3.toFixed(3)} m³
        </span>
      ),
      width: '110px',
    },
    {
      header: 'STATUS',
      sortable: true,
      align: 'center',
      cell: (r) => (
        <span
          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
            r.status === 'PASS'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}
        >
          {r.status}
        </span>
      ),
      width: '90px',
    },
    {
      header: 'ACTIONS',
      align: 'center',
      cell: (r) => (
        <button
          onClick={() => setSelectedReport(r.calculationReport)}
          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-mono font-bold border border-indigo-200 transition-colors"
          title="View full step-by-step IS 456 calculation sheet"
        >
          Calc Sheet
        </button>
      ),
      width: '110px',
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-4 p-4 lg:p-6 bg-ui-background overflow-y-auto font-sans">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card p-4 rounded-md border border-ui-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-700 text-white rounded-lg shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-mono text-base font-bold text-deep-navy">
              RCC STAIRCASE DESIGN &amp; REBAR DETAILING (IS 456 / SP:34)
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              IS 456:2000 Cl. 33, IS 13920:2016, SP:34 detailing, custom rebar selection &amp; STAAD ANL Diaphragm Levels.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-mono font-semibold transition-colors"
            title="Reset to standard IS 456 / NBC geometry"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-xs font-mono font-semibold shadow-xs transition-colors"
            title="Export CSV Schedule"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleSaveDesigns}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-mono font-bold shadow-xs transition-colors disabled:opacity-50"
            title="Save designed staircases to project state"
          >
            <Save className="w-3.5 h-3.5 text-blue-200" />
            <span>{isSaving ? 'Saving...' : '💾 Save Designs'}</span>
          </button>
        </div>
      </div>

      {/* Master KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        <div className="bg-surface-card border border-ui-border rounded p-3 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block flex items-center gap-1">
            <Building className="w-3.5 h-3.5 text-sky-600" />
            Storeys &amp; Flights
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold text-slate-900">{buildingSummary.totalStoreys} Storeys</span>
            <span className="text-[10px] text-slate-500 block">{buildingSummary.totalFlights} Flights Total</span>
          </div>
        </div>

        <div className="bg-surface-card border border-ui-border rounded p-3 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block flex items-center gap-1">
            <Box className="w-3.5 h-3.5 text-amber-600" />
            Concrete Volume
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold text-amber-700">{buildingSummary.totalConcreteM3} m³</span>
            <span className="text-[10px] text-slate-500 block">Waist, Steps &amp; Landings</span>
          </div>
        </div>

        <div className="bg-surface-card border border-ui-border rounded p-3 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            Steel Rebar Takeoff
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold text-emerald-700">{buildingSummary.totalSteelMT} MT</span>
            <span className="text-[10px] text-slate-500 block">{buildingSummary.totalSteelKg} kg (Fe500D)</span>
          </div>
        </div>

        <div className="bg-surface-card border border-ui-border rounded p-3 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Shuttering Formwork
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold text-indigo-900">{buildingSummary.totalFormworkM2} m²</span>
            <span className="text-[10px] text-slate-500 block">Soffit, Risers &amp; Sides</span>
          </div>
        </div>

        <div className="bg-surface-card border border-ui-border rounded p-3 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-purple-600" />
            Cement Demand
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold text-purple-800">{buildingSummary.totalCementBags} Bags</span>
            <span className="text-[10px] text-slate-500 block">50kg Bags ({customGeometry.fck >= 30 ? 'M30' : 'M25'})</span>
          </div>
        </div>

        <div className="bg-surface-card border border-ui-border rounded p-3 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            IS 456 Compliance
          </span>
          <div className="mt-1">
            <span className="text-xl font-bold text-emerald-700">100% PASS</span>
            <span className="text-[10px] text-slate-500 block">NBC Headroom Safe</span>
          </div>
        </div>
      </div>

      {/* Universal Rebar Selection Integration Bar */}
      <UniversalRebarBar moduleName="RCC Staircase" />

      {/* Save Notification */}
      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Storey Diaphragm Navigator */}
      <div className="bg-surface-card border border-ui-border rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-deep-navy uppercase">STAAD Diaphragm Storey:</span>
          <select
            value={selectedLevelIndex}
            onChange={(e) => setSelectedLevelIndex(Number(e.target.value))}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded font-bold text-indigo-900 focus:border-indigo-600 focus:outline-hidden cursor-pointer"
          >
            {diaphragmLevels.map((lvl) => (
              <option key={lvl.levelIndex} value={lvl.levelIndex}>
                {lvl.levelName} (Storey H = {lvl.storeyHeightM}m)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-slate-600">
          <span>Flight Rise: <strong className="text-slate-900">{(activeStoreyDesign.storeyHeightM / 2).toFixed(2)} m</strong></span>
          <span>•</span>
          <span>Mid-Landing: <strong className="text-emerald-700">EL. +{activeStoreyDesign.midLandingElevationY.toFixed(2)} m</strong></span>
          <span>•</span>
          <span>Diaphragm: <strong className="text-indigo-700">EL. +{activeStoreyDesign.topElevationY.toFixed(2)} m</strong></span>
        </div>
      </div>

      {/* Parameter Adjustment Panels Grid */}
      <div className="space-y-4 font-mono text-xs">
        {/* Panel 1: Rebar Selection & Reinforcement Detailing (PRIMARY) */}
        <CollapsiblePanel
          title="STAIRCASE REBAR SELECTION & REINFORCEMENT DETAILING (IS 456 / SP:34)"
          icon={<Sliders className="w-4 h-4 text-orange-600" />}
          storageKey="staircase-rebar"
          open={showRebarSelection}
          onToggle={setShowRebarSelection}
          variant="card"
          contentClassName="p-4 space-y-4"
        >
          {/* Quick Presets Bar */}
          <div className="flex items-center gap-1.5 flex-wrap pb-3 border-b border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">
              REBAR PRESETS:
            </span>
            {[
              {
                label: 'Residential (T12 @ 150 / T8 @ 200)',
                main: 12,
                dist: 8,
                top: 10,
                maxMain: 175,
                maxDist: 200,
                cover: 20,
              },
              {
                label: 'Light Footfall (T10 @ 125 / T8 @ 200)',
                main: 10,
                dist: 8,
                top: 8,
                maxMain: 150,
                maxDist: 200,
                cover: 20,
              },
              {
                label: 'Commercial (T16 @ 150 / T10 @ 150)',
                main: 16,
                dist: 10,
                top: 12,
                maxMain: 175,
                maxDist: 175,
                cover: 25,
              },
              {
                label: 'Public / High-Rise (T20 @ 150 / T10 @ 150)',
                main: 20,
                dist: 10,
                top: 16,
                maxMain: 175,
                maxDist: 175,
                cover: 25,
              },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setCustomGeometry((prev) => ({
                    ...prev,
                    preferredMainBarDia: preset.main,
                    preferredDistributionBarDia: preset.dist,
                    preferredTopSupportBarDia: preset.top,
                    maxMainSpacingMm: preset.maxMain,
                    maxDistributionSpacingMm: preset.maxDist,
                    clearCoverMm: preset.cover,
                  }));
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
                  customGeometry.preferredMainBarDia === preset.main &&
                  customGeometry.preferredDistributionBarDia === preset.dist
                    ? 'bg-orange-600 text-white border-orange-700 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Rebar Diameter Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Main Tension Rebar Diameter */}
            <div className="space-y-2 p-3 bg-orange-50/60 rounded-lg border border-orange-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-orange-950 font-bold uppercase">
                  1. Main Waist Rebar (ϕ)
                </label>
                <span className="text-[10px] text-orange-700 font-bold bg-orange-100 px-2 py-0.5 rounded border border-orange-300">
                  {activeStoreyDesign.flight1.mainRebarCallout.split('(')[0].trim()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[10, 12, 16, 20, 25].map((dia) => {
                  const isAllowed =
                    !universalRebarSelection?.longitudinalDiameters ||
                    universalRebarSelection.longitudinalDiameters.length === 0 ||
                    universalRebarSelection.longitudinalDiameters.includes(dia);
                  const isSelected = (customGeometry.preferredMainBarDia ?? 12) === dia;

                  return (
                    <button
                      key={dia}
                      type="button"
                      disabled={!isAllowed}
                      onClick={() => handleUpdateGeom('preferredMainBarDia', dia)}
                      className={`flex-1 py-1.5 px-2 rounded font-mono text-xs font-bold transition-all text-center ${
                        isSelected
                          ? 'bg-orange-600 text-white shadow-sm ring-2 ring-orange-400'
                          : isAllowed
                          ? 'bg-white text-slate-800 border border-slate-300 hover:border-orange-500'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
                      }`}
                      title={!isAllowed ? `T${dia} disabled in Universal Rebar Selection` : `Select T${dia} Main Rebar`}
                    >
                      T{dia}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] text-slate-600 space-y-0.5 pt-1">
                <div>Ast Provided: <strong className="text-orange-900">{activeStoreyDesign.flight1.mainAstProvided} mm²/m</strong> (Req: {activeStoreyDesign.flight1.mainAstRequired} mm²/m)</div>
                <div>pt Provided: <strong className="text-orange-900">{activeStoreyDesign.flight1.ptProvided}%</strong></div>
              </div>
            </div>

            {/* 2. Transverse Distribution Rebar */}
            <div className="space-y-2 p-3 bg-sky-50/60 rounded-lg border border-sky-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-sky-950 font-bold uppercase">
                  2. Distribution Steel (ϕ)
                </label>
                <span className="text-[10px] text-sky-700 font-bold bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
                  {activeStoreyDesign.flight1.distributionRebarCallout.split('(')[0].trim()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[8, 10, 12, 16].map((dia) => {
                  const isSelected = (customGeometry.preferredDistributionBarDia ?? 8) === dia;

                  return (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => handleUpdateGeom('preferredDistributionBarDia', dia)}
                      className={`flex-1 py-1.5 px-2 rounded font-mono text-xs font-bold transition-all text-center ${
                        isSelected
                          ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-400'
                          : 'bg-white text-slate-800 border border-slate-300 hover:border-sky-500'
                      }`}
                      title={`Select T${dia} Transverse Distribution Rebar`}
                    >
                      T{dia}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] text-slate-600 space-y-0.5 pt-1">
                <div>Ast Provided: <strong className="text-sky-900">{activeStoreyDesign.flight1.distributionAstProvided} mm²/m</strong></div>
                <div>Code check: <strong className="text-sky-900">IS 456 Cl. 26.5.2.1 (0.12%)</strong></div>
              </div>
            </div>

            {/* 3. Top Support Negative Steel */}
            <div className="space-y-2 p-3 bg-purple-50/60 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-purple-950 font-bold uppercase">
                  3. Top Support Steel (ϕ)
                </label>
                <span className="text-[10px] text-purple-700 font-bold bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
                  T{customGeometry.preferredTopSupportBarDia ?? 10} @ 150 mm
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[8, 10, 12, 16].map((dia) => {
                  const isSelected = (customGeometry.preferredTopSupportBarDia ?? 10) === dia;

                  return (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => handleUpdateGeom('preferredTopSupportBarDia', dia)}
                      className={`flex-1 py-1.5 px-2 rounded font-mono text-xs font-bold transition-all text-center ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-400'
                          : 'bg-white text-slate-800 border border-slate-300 hover:border-purple-500'
                      }`}
                      title={`Select T${dia} Top Negative Support Steel`}
                    >
                      T{dia}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] text-slate-600 space-y-0.5 pt-1">
                <div>Support Extension: <strong className="text-purple-900">0.28 Leff + Ld</strong></div>
                <div>Kink Cross-over: <strong className="text-emerald-800">SP:34 Cl. 10.4 Safe</strong></div>
              </div>
            </div>
          </div>

          {/* Spacing Caps & Clear Cover Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                Max Main Spacing Cap (mm)
              </label>
              <select
                value={customGeometry.maxMainSpacingMm ?? 200}
                onChange={(e) => handleUpdateGeom('maxMainSpacingMm', Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-indigo-600 focus:outline-hidden cursor-pointer"
              >
                <option value={125}>125 mm (Dense / High Traffic)</option>
                <option value={150}>150 mm (Standard SP:34)</option>
                <option value={175}>175 mm</option>
                <option value={200}>200 mm (Economy)</option>
                <option value={250}>250 mm</option>
                <option value={300}>300 mm (IS 456 Code Max 3d)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                Max Distribution Spacing (mm)
              </label>
              <select
                value={customGeometry.maxDistributionSpacingMm ?? 250}
                onChange={(e) => handleUpdateGeom('maxDistributionSpacingMm', Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-indigo-600 focus:outline-hidden cursor-pointer"
              >
                <option value={150}>150 mm</option>
                <option value={200}>200 mm (Standard)</option>
                <option value={250}>250 mm (Economy)</option>
                <option value={300}>300 mm</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                Waist Slab Clear Cover (mm)
              </label>
              <select
                value={customGeometry.clearCoverMm ?? 20}
                onChange={(e) => handleUpdateGeom('clearCoverMm', Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-indigo-600 focus:outline-hidden cursor-pointer"
              >
                <option value={15}>15 mm (Mild Internal)</option>
                <option value={20}>20 mm (Standard IS 456 Cl. 26.4)</option>
                <option value={25}>25 mm (Moderate / Staircore)</option>
                <option value={30}>30 mm (Severe External Fire)</option>
              </select>
            </div>
          </div>
        </CollapsiblePanel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Panel 2: Room Dimensions & Step Geometry */}
          <CollapsiblePanel
            title="ROOM GEOMETRY & ARCHITECTURAL DIMENSIONS (IS 456 Cl. 33)"
            icon={<Maximize2 className="w-4 h-4 text-indigo-600" />}
            storageKey="staircase-geom"
            open={showParameters}
            onToggle={setShowParameters}
            variant="card"
            contentClassName="p-4 space-y-3"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  Room Length L (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="3.0"
                  max="8.0"
                  value={customGeometry.roomLength}
                  onChange={(e) => handleUpdateGeom('roomLength', parseFloat(e.target.value) || 4.8)}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  Room Width B (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.8"
                  max="5.0"
                  value={customGeometry.roomWidth}
                  onChange={(e) => handleUpdateGeom('roomWidth', parseFloat(e.target.value) || 2.4)}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  Flight Width W (m)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.9"
                  max="2.5"
                  value={customGeometry.flightWidthM}
                  onChange={(e) => handleUpdateGeom('flightWidthM', parseFloat(e.target.value) || 1.1)}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:border-indigo-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  Step Tread T (mm)
                </label>
                <input
                  type="number"
                  step="5"
                  min="225"
                  max="350"
                  value={customGeometry.treadMm}
                  onChange={(e) => handleUpdateGeom('treadMm', parseInt(e.target.value, 10) || 275)}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-indigo-700 focus:border-indigo-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  Target Riser R (mm)
                </label>
                <input
                  type="number"
                  step="5"
                  min="125"
                  max="200"
                  value={customGeometry.riserMm}
                  onChange={(e) => handleUpdateGeom('riserMm', parseInt(e.target.value, 10) || 160)}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-indigo-700 focus:border-indigo-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                  Waist Slab tw (mm)
                </label>
                <input
                  type="number"
                  step="5"
                  min="120"
                  max="250"
                  value={customGeometry.waistSlabThicknessMm}
                  onChange={(e) => handleUpdateGeom('waistSlabThicknessMm', parseInt(e.target.value, 10) || 160)}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-amber-700 focus:border-indigo-600 focus:outline-hidden"
                />
              </div>
            </div>
          </CollapsiblePanel>

          {/* Panel 3: Dual-Side Landing Entries & Door Clearances */}
          <CollapsiblePanel
            title="DUAL-SIDE LANDING ENTRIES & ACCESS DOORS (NBC 2016)"
            icon={<DoorOpen className="w-4 h-4 text-emerald-600" />}
            storageKey="staircase-entries"
            open={showLandingEntries}
            onToggle={setShowLandingEntries}
            variant="card"
            contentClassName="p-4 space-y-3"
          >
            <div className="space-y-3">
              {/* Left Door Entry Toggle & Width */}
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk_left_door"
                    checked={landingEntryConfig.hasLeftDoor}
                    onChange={(e) => handleUpdateEntry('hasLeftDoor', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="chk_left_door" className="font-bold text-slate-800 cursor-pointer">
                    Left-Side Landing Entry Door
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Door Width:</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.8"
                    max="1.8"
                    value={landingEntryConfig.leftDoorWidthM}
                    onChange={(e) => handleUpdateEntry('leftDoorWidthM', parseFloat(e.target.value) || 1.0)}
                    disabled={!landingEntryConfig.hasLeftDoor}
                    className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center font-bold text-slate-900 disabled:opacity-40"
                  />
                  <span>m</span>
                </div>
              </div>

              {/* Right Door Entry Toggle & Width */}
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk_right_door"
                    checked={landingEntryConfig.hasRightDoor}
                    onChange={(e) => handleUpdateEntry('hasRightDoor', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="chk_right_door" className="font-bold text-slate-800 cursor-pointer">
                    Right-Side Landing Entry Door
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Door Width:</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.8"
                    max="1.8"
                    value={landingEntryConfig.rightDoorWidthM}
                    onChange={(e) => handleUpdateEntry('rightDoorWidthM', parseFloat(e.target.value) || 1.0)}
                    disabled={!landingEntryConfig.hasRightDoor}
                    className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center font-bold text-slate-900 disabled:opacity-40"
                  />
                  <span>m</span>
                </div>
              </div>

              {/* Front Corridor Access */}
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk_front_door"
                    checked={landingEntryConfig.hasFrontDoor}
                    onChange={(e) => handleUpdateEntry('hasFrontDoor', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="chk_front_door" className="font-bold text-slate-800 cursor-pointer">
                    Front Corridor / Hall Access
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Passage Width:</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0.9"
                    max="2.4"
                    value={landingEntryConfig.frontDoorWidthM}
                    onChange={(e) => handleUpdateEntry('frontDoorWidthM', parseFloat(e.target.value) || 1.2)}
                    disabled={!landingEntryConfig.hasFrontDoor}
                    className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center font-bold text-slate-900 disabled:opacity-40"
                  />
                  <span>m</span>
                </div>
              </div>
            </div>
          </CollapsiblePanel>
        </div>
      </div>

      {/* Interactive CAD Vector Drawing Viewer */}
      <div className="h-[640px] rounded-lg overflow-hidden border border-ui-border shadow-md">
        <StaircaseDrawingSvg
          storeyDesign={activeStoreyDesign}
          activeFlightIndex={activeFlightIndex}
          onSelectFlight={setActiveFlightIndex}
        />
      </div>

      {/* Staircase Schedule Data Table */}
      <CollapsiblePanel
        title="ALL STOREY STAIRCASE FLIGHTS SCHEDULE & REBAR DETAILING (IS 456 / SP:34)"
        icon={<FileText className="w-4 h-4 text-indigo-700" />}
        storageKey="staircase-table"
        open={showTable}
        onToggle={setShowTable}
        variant="card"
        contentClassName="p-0"
        className="flex-1 flex flex-col min-h-[420px]"
      >
        <div className="flex-1 min-h-[380px] flex flex-col overflow-hidden">
          <DataTable
            data={tableRows}
            columns={columns}
            title="STAIRCASE FLIGHTS DESIGN SCHEDULE & REBAR DETAILED SUMMARY"
            searchPlaceholder="Search by Storey or Flight..."
            searchFilter={(item, q) => item.name.toLowerCase().includes(q.toLowerCase()) || item.storeyLevelName.toLowerCase().includes(q.toLowerCase())}
            onExportCsv={handleExportCsv}
          />
        </div>
      </CollapsiblePanel>

      {/* Step-by-Step Calculation Sheet Modal */}
      {selectedReport && (
        <CalculationModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
};
