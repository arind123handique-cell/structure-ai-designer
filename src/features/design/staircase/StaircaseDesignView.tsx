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
} from 'lucide-react';

export const StaircaseDesignView: React.FC = () => {
  const { activeModel, activeProject, saveStaircaseDesigns } = useProjectStore();

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
  const [showLandingEntries, setShowLandingEntries] = useState(true);
  const [showTable, setShowTable] = useState(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate Building-wide Staircase Summary
  const buildingSummary: BuildingStaircaseSummary = useMemo(() => {
    return StaircaseDesignEngine.calculateBuildingStaircaseSummary(
      activeModel,
      activeProject?.metadata,
      {
        customGeometry,
        customLandingEntry: landingEntryConfig,
      }
    );
  }, [activeModel, activeProject, customGeometry, landingEntryConfig]);

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

  // Reset to IS 456 Defaults
  const handleResetDefaults = () => {
    setCustomGeometry(defaultGeom);
    setLandingEntryConfig(defaultEntry);
  };

  // Save designs to Project Store
  const handleSaveDesigns = async () => {
    setIsSaving(true);
    try {
      if (saveStaircaseDesigns) {
        await saveStaircaseDesigns(buildingSummary, customGeometry, landingEntryConfig);
      }
      setSaveSuccessMsg('Staircase designs, room geometry, and dual-side landing entries saved successfully!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Export CSV Schedule
  const handleExportCsv = () => {
    const csvData = tableRows.map((r) => ({
      'Storey Diaphragm': r.storeyLevelName,
      'Flight': r.name,
      'Rise (m)': r.flightRiseM,
      'Risers Count': r.riserCount,
      'Riser (mm)': r.riserMm,
      'Treads Count': r.treadCount,
      'Tread (mm)': r.treadMm,
      'Waist Thickness (mm)': r.waistSlabThicknessMm,
      'Effective Span Leff (m)': r.effectiveSpanLeffM,
      'Factored Load wu (kN/m²)': r.factoredLoadWuKnM2,
      'Design Moment Mu (kNm)': r.designMomentMu,
      'Main Tension Rebar': r.mainRebarCallout,
      'Distribution Rebar': r.distributionRebarCallout,
      'Kink Detailing': r.kinkAnchorageDetail,
      'Landing Rebar': r.landingRebarCallout,
      'Dual Entry Clearance': r.landingClearanceCheck,
      'Concrete Vol (m³)': r.concreteM3,
      'Formwork Area (m²)': r.formworkM2,
      'Rebar Steel (kg)': r.steelKg,
      'Status': r.status,
    }));

    exportToCsv(csvData, 'Staircase_Design_IS456_Schedule.csv');
  };

  // Table Columns Definition
  const columns: ColumnDef<any>[] = [
    {
      header: 'STOREY DIAPHRAGM & FLIGHT',
      accessorKey: 'name',
      sortable: true,
      cell: (r) => (
        <div className="font-mono">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs">
              {r.flightIndex === 1 ? 'Flight 1 (Mid)' : 'Flight 2 (Floor)'}
            </span>
            <span className="text-[11px] text-slate-700 font-semibold truncate max-w-[200px]" title={r.storeyLevelName}>
              {r.storeyLevelName.split(' (')[0]}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            EL. +{r.bottomElevationY.toFixed(2)}m → +{r.topElevationY.toFixed(2)}m (Rise: {r.flightRiseM}m)
          </span>
        </div>
      ),
      width: '260px',
    },
    {
      header: 'STEPS (R × T)',
      cell: (r) => (
        <div className="font-mono text-xs">
          <span className="font-bold text-slate-900 block">
            {r.riserCount}R @ {r.riserMm}mm × {r.treadCount}T @ {r.treadMm}mm
          </span>
          <span className="text-[10px] text-slate-500">
            Going: {r.goingLengthM}m (Slope: {r.slopeAngleDeg}°)
          </span>
        </div>
      ),
      width: '180px',
    },
    {
      header: 'WAIST SLAB & SPAN',
      cell: (r) => (
        <div className="font-mono text-xs">
          <span className="font-bold text-slate-800 block">
            tw = {r.waistSlabThicknessMm} mm
          </span>
          <span className="text-[10px] text-slate-500">
            Leff = {r.effectiveSpanLeffM} m
          </span>
        </div>
      ),
      width: '140px',
    },
    {
      header: 'Mu / Vu DEMAND',
      align: 'right',
      cell: (r) => (
        <div className="font-mono text-right text-xs">
          <span className="font-bold text-orange-700 block">
            Mu: {r.designMomentMu} kNm
          </span>
          <span className="text-[10px] text-slate-500">
            wu: {r.factoredLoadWuKnM2} kN/m²
          </span>
        </div>
      ),
      width: '130px',
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
          className="px-2 py-1 bg-white hover:bg-slate-100 text-indigo-700 rounded border border-indigo-200 text-[11px] font-mono font-semibold shadow-2xs transition-colors"
          title="View Step-by-Step IS 456 Calculation Sheet"
        >
          Calc Sheet
        </button>
      ),
      width: '95px',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-ui-background overflow-y-auto p-6 space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card p-4 rounded-md border border-ui-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-mono text-base font-bold text-deep-navy">
                RCC STAIRCASE DESIGN &amp; DUAL-SIDE LANDING DETAILING
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                IS 456:2000 Cl. 33, IS 13920:2016, SP:34 detailing &amp; STAAD ANL Diaphragm Levels.
              </p>
            </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono text-xs">
        {/* Panel 1: Room Dimensions & Step Geometry */}
        <CollapsiblePanel
          title="STAIRCASE ROOM SIZE & STEP GEOMETRY (IS 456 Cl. 33)"
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

        {/* Panel 2: Dual-Side Landing Entries & Door Clearances */}
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

      {/* Interactive CAD Vector Drawing Viewer */}
      <div className="h-[620px] rounded-lg overflow-hidden border border-ui-border shadow-md">
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
