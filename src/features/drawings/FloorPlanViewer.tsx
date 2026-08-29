import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { FloorPlanEngine, FloorPlanLevel } from './floorPlanEngine';
import { FloorPlanSvg } from './FloorPlanSvg';
import { PdfExportService } from './pdfExportService';
import { exportToCsv } from '@/utils/exportUtils';
import {
  Layers,
  FileText,
  Download,
  Printer,
  Sliders,
  CheckCircle2,
  Building,
  Box,
  Compass,
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
  Footprints,
  Move,
  RotateCw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';

export const FloorPlanViewer: React.FC = () => {
  const {
    activeModel,
    activeProject,
    projectPileTypes,
    supportPileAssignments,
    customPileCapOverrides,
    manualMergedPileCapGroups,
    detachedCombinedCapNodeIds,
    architecturalStaircases,
    updateStaircase,
    addStaircase,
    customStaircaseGeometry,
    customStaircaseLandingEntry,
    setActiveView,
  } = useProjectStore();

  // Extract all floor plans from the model
  const floorPlans: FloorPlanLevel[] = useMemo(() => {
    return FloorPlanEngine.extractAllFloorPlans(
      activeModel,
      projectPileTypes,
      supportPileAssignments,
      customPileCapOverrides,
      manualMergedPileCapGroups,
      detachedCombinedCapNodeIds
    );
  }, [activeModel, projectPileTypes, supportPileAssignments, customPileCapOverrides, manualMergedPileCapGroups, detachedCombinedCapNodeIds]);

  const [selectedLevelIndex, setSelectedLevelIndex] = useState<number>(0);

  // Active Floor Plan Level
  const activePlan = useMemo(() => {
    return floorPlans[selectedLevelIndex] || floorPlans[0];
  }, [floorPlans, selectedLevelIndex]);

  // Layer Visibility States
  const [showGrids, setShowGrids] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showMemberLabels, setShowMemberLabels] = useState(true);
  const [showSectionSizes, setShowSectionSizes] = useState(true);
  const [showSlabs, setShowSlabs] = useState(true);
  const [showPileCaps, setShowPileCaps] = useState(true);
  const [showGradeBeams, setShowGradeBeams] = useState(true);
  const [showStaircases, setShowStaircases] = useState(true);
  const [showLiftCore] = useState(false); // hidden per user request — lift core tw=230 not shown in 2D plan
  const [selectedSectionType, setSelectedSectionType] = useState<string>('ALL');
  const [pileCapDisplayMode, setPileCapDisplayMode] = useState<'BOTH' | 'PLAN' | 'SECTION'>('BOTH');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccessMessage, setPdfSuccessMessage] = useState<string | null>(null);

  // Active floor staircase helper
  const activeFloorId = `floor_${activePlan?.levelIndex || 0}`;
  const activeLevelStaircases = useMemo(() => {
    const all = Object.values(architecturalStaircases || {});
    const match = all.filter((s) => s.floorId === activeFloorId);
    if (match.length > 0) return match;
    if (activePlan && !activePlan.isFoundationLevel && all.length > 0) return all;
    return [];
  }, [architecturalStaircases, activeFloorId, activePlan]);

  const selectedStair = activeLevelStaircases[0] || null;

  // Add / Place Staircase on active level
  const handleAddStaircaseToLevel = () => {
    if (!activePlan) return;
    const geom = customStaircaseGeometry || {};
    const entry = customStaircaseLandingEntry || {};
    const centerX = (activePlan.bounds.minX + activePlan.bounds.maxX) / 2 - 2.4;
    const centerZ = (activePlan.bounds.minZ + activePlan.bounds.maxZ) / 2 - 1.2;

    const newStair: any = {
      id: `STAIR-${Date.now().toString(36).substr(-4).toUpperCase()}`,
      floorId: activeFloorId,
      name: `Staircase FL-${(activePlan.levelIndex || 0) + 1}`,
      position: { x: Math.round(centerX * 10) / 10, y: Math.round(centerZ * 10) / 10 },
      rotation: 0,
      staircaseType: 'DOG_LEGGED',
      roomLength: geom.roomLength || 4.8,
      roomWidth: geom.roomWidth || 2.4,
      flightWidth: geom.flightWidth || 1.1,
      wellGap: geom.wellGap || 0.2,
      landingDepth: geom.landingDepth || 1.2,
      treadMm: geom.treadMm || 275,
      riserMm: geom.riserMm || 160,
      riserCount: geom.riserCount || 10,
      treadCount: geom.treadCount || 9,
      waistThicknessMm: geom.waistThicknessMm || 160,
      wallThicknessMm: geom.wallThicknessMm || 230,
      hasEnclosureWalls: true,
      hasLeftDoor: entry.hasLeftDoor !== undefined ? entry.hasLeftDoor : true,
      leftDoorWidth: entry.leftDoorWidth || 1.0,
      hasRightDoor: entry.hasRightDoor !== undefined ? entry.hasRightDoor : true,
      rightDoorWidth: entry.rightDoorWidth || 1.0,
      hasFrontDoor: entry.hasFrontDoor !== undefined ? entry.hasFrontDoor : true,
      frontDoorWidth: entry.frontDoorWidth || 1.2,
      direction: 'UP',
      startElevation: activePlan.elevationY,
      endElevation: activePlan.elevationY + 3.2,
    };

    addStaircase(newStair);
  };

  if (!activeModel || floorPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-slate-400 font-mono space-y-3">
        <Building className="w-12 h-12 text-slate-600 animate-pulse" />
        <span className="text-sm font-semibold">NO STRUCTURAL MODEL LOADED</span>
        <span className="text-xs text-slate-500">Please import a .ANL or .STD file to generate 2D floor plans.</span>
      </div>
    );
  }

  // Handle Export Current Level to PDF — passes web toggles so PDF matches exactly what is seen
  const handleExportCurrentPdf = () => {
    if (!activePlan) return;
    setIsExportingPdf(true);
    try {
      PdfExportService.exportSingleFloorPlanToPdf(activePlan, activeProject, undefined, {
        showGrids,
        showDimensions,
        showMemberLabels,
        showSectionSizes,
        showSlabs,
        showPileCaps,
        showGradeBeams,
        selectedSectionType,
      });
      setPdfSuccessMessage(`Exported ${activePlan.sheetNumber} (${activePlan.levelName}) to PDF!`);
      setTimeout(() => setPdfSuccessMessage(null), 3500);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle Export All Levels to PDF — uses current toggle state for every level
  const handleExportAllPdf = () => {
    if (floorPlans.length === 0) return;
    setIsExportingPdf(true);
    try {
      PdfExportService.exportAllFloorPlansToPdf(floorPlans, activeProject, undefined, {
        showGrids,
        showDimensions,
        showMemberLabels,
        showSectionSizes,
        showSlabs,
        showPileCaps,
        showGradeBeams,
        selectedSectionType,
      });
      setPdfSuccessMessage(`Exported complete multi-page PDF set for all ${floorPlans.length} floor levels!`);
      setTimeout(() => setPdfSuccessMessage(null), 4000);
    } catch (err) {
      console.error('All floors PDF export failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle Print Sheet
  const handlePrint = () => {
    window.print();
  };

  // Export CSV of elements at this level
  const handleExportCsv = () => {
    if (!activePlan) return;
    if (activePlan.isFoundationLevel) {
      exportToCsv(
        activePlan.columns.map((c) => ({
          ColumnLabel: c.label,
          JointNode: c.nodeId,
          X_m: c.x,
          Z_m: c.z,
          PileCapLabel: c.pileCap ? `PC-${c.columnSlNo}` : '—',
          PileCapShape: c.pileCap?.capShape || '—',
          PileCount: c.pileCap?.pileCount || 0,
          CapSize_mm: c.pileCap ? `${c.pileCap.capLength}x${c.pileCap.capWidth}x${c.pileCap.capDepth}` : '—',
          FactoredPu_kN: c.pileCap?.factoredVerticalLoad || 0,
        })),
        `${activePlan.sheetNumber}_Foundation_Layout_Schedule.csv`
      );
    } else {
      exportToCsv(
        activePlan.beams.map((b) => ({
          BeamLabel: b.label,
          MemberId: b.memberId,
          Section: b.sectionName,
          Span_m: b.length,
          StartNode: b.startNodeId,
          EndNode: b.endNodeId,
          Elevation_m: activePlan.elevationY,
        })),
        `${activePlan.sheetNumber}_Floor_Framing_Beams_Schedule.csv`
      );
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-5 bg-ui-background overflow-y-auto font-sans">
      {/* Top Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card p-4 rounded-md border border-ui-border shadow-2xs">
        <div>
          <h2 className="font-mono text-base font-bold text-deep-navy flex items-center gap-2">
            <Layers className="w-5 h-5 text-secondary-brand" />
            2D STRUCTURAL FLOOR FRAMING &amp; FOUNDATION PLANS
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-sans">
            Auto-generated floor framing layouts, grid bays, column callouts, beam dimensions, and foundation pile caps from Y = 0.00 m (Foundation) to Top Floor Level.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Current Level PDF */}
          <button
            onClick={handleExportCurrentPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary-brand hover:bg-blue-700 text-white font-mono text-xs font-semibold rounded shadow-2xs transition-all disabled:opacity-50"
            title="Export the currently active 2D floor plan as a vector A3 PDF drawing sheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPdf ? 'Exporting...' : 'Export Active Level (PDF)'}</span>
          </button>

          {/* Export Complete Multi-Page PDF Set */}
          <button
            onClick={handleExportAllPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold rounded shadow-2xs transition-all disabled:opacity-50"
            title="Export all floor plans from foundation to roof into a complete multi-page PDF set"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Complete Building Set (PDF)</span>
          </button>

          {/* Export CSV Schedule */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-xs font-mono font-semibold shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-ui-border rounded text-xs shadow-2xs transition-colors"
            title="Print Drawing Sheet"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF Success Alert Notification */}
      {pdfSuccessMessage && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded font-mono text-xs shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{pdfSuccessMessage}</span>
        </div>
      )}

      {/* Floor Elevation Level Switcher Bar */}
      <div className="bg-surface-card p-3 rounded-lg border border-ui-border space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <Building className="w-4 h-4 text-sky-600" />
            Select Floor Level Elevation (Y):
          </span>
          <span className="text-xs font-mono text-slate-500">
            Total {floorPlans.length} Floor Levels in Project
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {floorPlans.map((fp, idx) => (
            <button
              key={fp.sheetNumber}
              onClick={() => setSelectedLevelIndex(idx)}
              className={`px-3.5 py-2 rounded-md font-mono text-xs transition-all shrink-0 flex items-center gap-2 border ${
                selectedLevelIndex === idx
                  ? 'bg-deep-navy text-white font-bold border-deep-navy shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  selectedLevelIndex === idx
                    ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {fp.sheetNumber}
              </span>
              <span>{fp.isFoundationLevel ? 'Foundation Level' : `El. +${fp.elevationY.toFixed(2)}m`}</span>
              <span className="text-[11px] opacity-75">
                {fp.isFoundationLevel
                  ? `(${fp.columns.length} Caps)`
                  : `(${fp.beams.length} Beams)`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Layer Toggles & Active Floor Level Metrics Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Layer Visibility Toggles */}
        <div className="bg-surface-card p-3 rounded-lg border border-ui-border space-y-2 shadow-2xs">
          <span className="text-xs font-mono font-bold text-slate-700 uppercase flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            Drawing Layer Toggles
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900">
              <input
                type="checkbox"
                checked={showGrids}
                onChange={(e) => setShowGrids(e.target.checked)}
                className="rounded text-secondary-brand focus:ring-secondary-brand"
              />
              <span>Grid Lines</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900">
              <input
                type="checkbox"
                checked={showDimensions}
                onChange={(e) => setShowDimensions(e.target.checked)}
                className="rounded text-secondary-brand focus:ring-secondary-brand"
              />
              <span>Dimensions</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900">
              <input
                type="checkbox"
                checked={showMemberLabels}
                onChange={(e) => setShowMemberLabels(e.target.checked)}
                className="rounded text-secondary-brand focus:ring-secondary-brand"
              />
              <span>Labels (B/C)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900">
              <input
                type="checkbox"
                checked={showSectionSizes}
                onChange={(e) => setShowSectionSizes(e.target.checked)}
                className="rounded text-secondary-brand focus:ring-secondary-brand"
              />
              <span>Section Sizes</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900">
              <input
                type="checkbox"
                checked={showSlabs}
                onChange={(e) => setShowSlabs(e.target.checked)}
                className="rounded text-secondary-brand focus:ring-secondary-brand"
              />
              <span>Floor Slabs</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 font-bold text-amber-700">
              <input
                type="checkbox"
                checked={showStaircases}
                onChange={(e) => setShowStaircases(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-600"
              />
              <span className="flex items-center gap-1">
                <Footprints className="w-3.5 h-3.5 text-amber-600" />
                Staircases (Moveable)
              </span>
            </label>

            {activePlan.isFoundationLevel && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={showPileCaps}
                  onChange={(e) => setShowPileCaps(e.target.checked)}
                  className="rounded text-secondary-brand focus:ring-secondary-brand"
                />
                <span>Pile Caps</span>
              </label>
            )}
          </div>
        </div>

        {/* Quantities Card 1: Area & Framing Elements */}
        <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
            {activePlan.isFoundationLevel ? 'Foundation Columns / Caps' : 'Framing Members at Level'}
          </span>
          <div className="font-mono space-y-0.5">
            <span className="text-base font-bold text-deep-navy">
              {activePlan.isFoundationLevel
                ? `${activePlan.columns.length} Column Pile Caps`
                : `${activePlan.beams.length} Beams • ${activePlan.columns.length} Columns`}
            </span>
            <span className="text-[11px] text-slate-500 block">
              Floor Plan Area: {activePlan.metrics.totalFloorAreaM2} m²
            </span>
          </div>
        </div>

        {/* Quantities Card 2: Concrete & Steel Volume */}
        <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
            Estimated Takeoff for this Level
          </span>
          <div className="font-mono space-y-0.5">
            <span className="text-base font-bold text-emerald-700">
              {activePlan.metrics.totalConcreteM3} m³ Concrete
            </span>
            <span className="text-[11px] text-slate-500 block">
              Rebar Takeoff: {activePlan.metrics.totalSteelKg} kg (~{(activePlan.metrics.totalSteelKg / 1000).toFixed(2)} MT)
            </span>
          </div>
        </div>

        {/* Quantities Card 3: IS Code Detailing */}
        <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs flex flex-col justify-between">
          <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
            Detailing Code &amp; Sheet No
          </span>
          <div className="font-mono space-y-0.5">
            <span className="text-base font-bold text-indigo-700">
              {activePlan.sheetNumber} (IS 456 / IS 13920)
            </span>
            <span className="text-[11px] text-slate-500 block">
              Elevation: Y = {activePlan.elevationY >= 0 ? `+${activePlan.elevationY.toFixed(3)}` : activePlan.elevationY.toFixed(3)} m
            </span>
          </div>
        </div>
      </div>

      {/* Foundation Level Active Cross-Section View Selector — bullet switch per user request */}
      {activePlan.isFoundationLevel && (
        <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-mono font-bold text-deep-navy uppercase">
                Foundation Cross-Section View:
              </span>
              <span className="text-[11px] text-slate-500 font-sans">
                (Bullet switch — select which pile-cap plan / section to display)
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: 'All Cross-Sections (Grid)' },
                { id: 'TYPE-1', label: 'Section 1-1 (4-Pile Cap)' },
                { id: 'TYPE-2', label: 'Section 2-2 (5-Pile Cap)' },
                { id: 'COMBINED', label: 'Section 3-3 (Shear Wall / Combined Mat)' },
              ].map((sec) => {
                const isActive = selectedSectionType === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setSelectedSectionType(sec.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-semibold transition-all border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center shrink-0 ${isActive ? 'bg-white border-white' : 'border-slate-400 bg-white'}`}>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
                    </span>
                    {sec.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bullet switch for Pile Cap Plan vs Section display */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <span className="text-xs font-mono font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Pile Cap Display:
            </span>
            {[
              { id: 'BOTH', label: 'Both Plan & Section' },
              { id: 'PLAN', label: 'Plan Only' },
              { id: 'SECTION', label: 'Section Only' },
            ].map((opt) => {
              const isActive = pileCapDisplayMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPileCapDisplayMode(opt.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-semibold transition-all border ${
                    isActive ? 'bg-deep-navy text-white border-deep-navy' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-white bg-white' : 'border-slate-400'}`}>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-deep-navy"></span>}
                  </span>
                  {opt.label}
                </button>
              );
            })}
            <span className="text-[11px] text-slate-500 ml-2">• Bullet switch controls which pile-cap drawings are visible in 2D plan and PDF export</span>
          </div>
        </div>
      )}

      {/* Staircase Moving & Positioning Toolbar on the Drawing */}
      {showStaircases && (
        <div className="bg-surface-card p-3 rounded-lg border border-amber-300/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 text-amber-600 rounded">
              <Move className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                Staircase Moving &amp; Placement on Drawing
              </span>
              <span className="text-[11px] text-slate-500 block">
                {selectedStair
                  ? `Position: X = ${selectedStair.position.x.toFixed(2)} m, Z = ${selectedStair.position.y.toFixed(2)} m | Rotation = ${selectedStair.rotation || 0}° (Drag staircase directly on plan to move)`
                  : 'No staircase currently placed on this floor framing level.'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedStair ? (
              <>
                {/* Nudge Controls */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded border border-slate-300">
                  <span className="text-[10px] text-slate-500 font-bold px-1 uppercase">Nudge:</span>
                  <button
                    onClick={() =>
                      updateStaircase(selectedStair.id, {
                        position: { x: selectedStair.position.x, y: Math.round((selectedStair.position.y - 0.2) * 20) / 20 },
                      })
                    }
                    className="p-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded shadow-2xs"
                    title="Nudge Up (Z - 0.2m)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      updateStaircase(selectedStair.id, {
                        position: { x: selectedStair.position.x, y: Math.round((selectedStair.position.y + 0.2) * 20) / 20 },
                      })
                    }
                    className="p-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded shadow-2xs"
                    title="Nudge Down (Z + 0.2m)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      updateStaircase(selectedStair.id, {
                        position: { x: Math.round((selectedStair.position.x - 0.2) * 20) / 20, y: selectedStair.position.y },
                      })
                    }
                    className="p-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded shadow-2xs"
                    title="Nudge Left (X - 0.2m)"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      updateStaircase(selectedStair.id, {
                        position: { x: Math.round((selectedStair.position.x + 0.2) * 20) / 20, y: selectedStair.position.y },
                      })
                    }
                    className="p-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded shadow-2xs"
                    title="Nudge Right (X + 0.2m)"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Rotate 90 deg */}
                <button
                  onClick={() =>
                    updateStaircase(selectedStair.id, {
                      rotation: ((selectedStair.rotation || 0) + 90) % 360,
                    })
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded shadow-2xs transition-colors text-xs"
                  title="Rotate Staircase 90° Clockwise"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate 90°</span>
                </button>

                {/* Center Staircase on Floor */}
                <button
                  onClick={() => {
                    const cx = (activePlan.bounds.minX + activePlan.bounds.maxX) / 2 - 2.4;
                    const cz = (activePlan.bounds.minZ + activePlan.bounds.maxZ) / 2 - 1.2;
                    updateStaircase(selectedStair.id, {
                      position: { x: Math.round(cx * 10) / 10, y: Math.round(cz * 10) / 10 },
                    });
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded shadow-2xs text-xs font-semibold"
                >
                  Center on Plan
                </button>
              </>
            ) : (
              <button
                onClick={handleAddStaircaseToLevel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-2xs text-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Place Designed Staircase on this Level</span>
              </button>
            )}

            {/* Jump to Staircase IS 456 Designer */}
            <button
              onClick={() => setActiveView('staircase-design')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded text-xs font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>IS 456 Calc Sheet</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 2D CAD SVG Canvas Plan */}
      <div className="w-full flex justify-center">
        <FloorPlanSvg
          floorPlan={activePlan}
          project={activeProject}
          showGrids={showGrids}
          showDimensions={showDimensions}
          showMemberLabels={showMemberLabels}
          showSectionSizes={showSectionSizes}
          showSlabs={showSlabs}
          showPileCaps={showPileCaps}
          showGradeBeams={showGradeBeams}
          showLiftCore={showLiftCore}
          showStaircases={showStaircases}
          staircases={architecturalStaircases}
          onUpdateStaircase={updateStaircase}
          pileCapDisplayMode={pileCapDisplayMode}
          selectedSectionType={selectedSectionType}
          onSelectSection={setSelectedSectionType}
          width={activePlan.isFoundationLevel ? 1560 : 960}
          height={activePlan.isFoundationLevel ? 760 : 580}
        />
      </div>
    </div>
  );
};
