import React, { useState, useMemo } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { FloorPlanEngine, FloorPlanLevel } from './floorPlanEngine';
import { FloorPlanSvg } from './FloorPlanSvg';
import { PdfExportService } from './pdfExportService';
import { exportToCsv } from '@/utils/exportUtils';
import { StaircasePlacementEngine } from '@/features/architectural/engines/staircasePlacementEngine';
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
  Trash2,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Settings2,
  Info,
} from 'lucide-react';

export const FloorPlanViewer: React.FC = () => {
  const {
    activeModel,
    activeProject,
    projectPileTypes,
    supportPileAssignments,
    customPileCapOverrides,
    customCombinedCapOverrides,
    manualMergedPileCapGroups,
    detachedCombinedCapNodeIds,
    architecturalStaircases,
    updateStaircase,
    addStaircase,
    deleteStaircase,
    deleteStaircaseFromFloor,
    restoreStaircaseForFloor,
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
      detachedCombinedCapNodeIds,
      customCombinedCapOverrides
    );
  }, [activeModel, projectPileTypes, supportPileAssignments, customPileCapOverrides, customCombinedCapOverrides, manualMergedPileCapGroups, detachedCombinedCapNodeIds]);

  const [selectedLevelIndex, setSelectedLevelIndex] = useState<number>(0);

  // Active Floor Plan Level
  const activePlan = useMemo(() => {
    return floorPlans[selectedLevelIndex] || floorPlans[0];
  }, [floorPlans, selectedLevelIndex]);

  // CAD Sheet Orientation & Section Visibility State (A3 Landscape / Portrait)
  const [sheetOrientation, setSheetOrientation] = useState<'LANDSCAPE' | 'PORTRAIT'>('LANDSCAPE');
  const [showCrossSections, setShowCrossSections] = useState<boolean>(true);
  const [layersMenuOpen, setLayersMenuOpen] = useState<boolean>(false);
  const [zoomFit, setZoomFit] = useState<boolean>(true);
  const [metricsExpanded, setMetricsExpanded] = useState<boolean>(false);

  // Layer Visibility States (Always keep labels/dimensions off by default)
  const [showGrids, setShowGrids] = useState(true);
  const [showDimensions, setShowDimensions] = useState(false);
  const [showMemberLabels, setShowMemberLabels] = useState(false);
  const [showSectionSizes, setShowSectionSizes] = useState(false);
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
    return all.filter((s) => {
      if (s.disabledFloorIds && s.disabledFloorIds.includes(activeFloorId)) {
        return false;
      }
      if (s.floorId === activeFloorId) return true;
      if (activePlan && !activePlan.isFoundationLevel && s.allFloors !== false) return true;
      return false;
    });
  }, [architecturalStaircases, activeFloorId, activePlan]);

  const selectedStair = activeLevelStaircases[0] || null;

  // Add / Place Staircase on active level
  const handleAddStaircaseToLevel = () => {
    if (!activePlan) return;
    const geom = customStaircaseGeometry || {};
    const entry = customStaircaseLandingEntry || {};
    const detectedCore = StaircasePlacementEngine.detectBuildingStaircaseCore(activeModel);
    const roomW = geom.roomWidth || detectedCore?.roomWidth || 2.4;
    const roomL = geom.roomLength || detectedCore?.roomLength || 4.3;
    const defaultX = detectedCore ? detectedCore.position.x : (activePlan.bounds.minX + activePlan.bounds.maxX) / 2 - roomW / 2;
    const defaultZ = detectedCore ? detectedCore.position.y : (activePlan.bounds.minZ + activePlan.bounds.maxZ) / 2 - roomL / 2;

    const newStair: any = {
      id: `STAIR-${Date.now().toString(36).substr(-4).toUpperCase()}`,
      floorId: activeFloorId,
      name: `Staircase FL-${(activePlan.levelIndex || 0) + 1}`,
      position: { x: Math.round(defaultX * 10) / 10, y: Math.round(defaultZ * 10) / 10 },
      rotation: 0,
      staircaseType: 'DOG_LEGGED',
      roomLength: roomL,
      roomWidth: roomW,
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
        orientation: sheetOrientation.toLowerCase() as any,
        showCrossSections,
      });
      setPdfSuccessMessage(`Exported ${activePlan.sheetNumber} (${activePlan.levelName}) as A3 ${sheetOrientation} PDF!`);
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
        orientation: sheetOrientation.toLowerCase() as any,
        showCrossSections,
      });
      setPdfSuccessMessage(`Exported complete A3 ${sheetOrientation} multi-page PDF set for all ${floorPlans.length} floor levels!`);
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

      {/* Unified CAD Engineering Toolbar */}
      <div className="bg-surface-card p-3 rounded-lg border border-ui-border space-y-2.5 shadow-2xs">
        {/* Row 1: Floor Elevation Level Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[11px] font-mono font-bold text-slate-500 uppercase flex items-center gap-1 mr-1 shrink-0">
              <Building className="w-3.5 h-3.5 text-sky-600" />
              Level:
            </span>
            {floorPlans.map((fp, idx) => (
              <button
                key={fp.sheetNumber}
                onClick={() => setSelectedLevelIndex(idx)}
                className={`px-2.5 py-1 rounded font-mono text-xs transition-all shrink-0 flex items-center gap-1.5 border ${
                  selectedLevelIndex === idx
                    ? 'bg-deep-navy text-white font-bold border-deep-navy shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <span
                  className={`px-1 py-0.2 rounded text-[9.5px] font-bold ${
                    selectedLevelIndex === idx
                      ? 'bg-sky-500/30 text-sky-200 border border-sky-400/40'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {fp.sheetNumber}
                </span>
                <span>{fp.isFoundationLevel ? 'Foundation' : `El. +${fp.elevationY.toFixed(2)}m`}</span>
              </button>
            ))}
          </div>

          {/* Quick Metrics Badge with Details Toggle */}
          <div className="flex items-center gap-2 font-mono text-xs shrink-0">
            <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded text-[11px]">
              Area: <strong className="text-slate-900">{activePlan.metrics.totalFloorAreaM2} m²</strong> • Concrete: <strong className="text-emerald-700">{activePlan.metrics.totalConcreteM3} m³</strong> • Steel: <strong className="text-indigo-700">{(activePlan.metrics.totalSteelKg / 1000).toFixed(2)} MT</strong>
            </span>
            <button
              type="button"
              onClick={() => setMetricsExpanded(!metricsExpanded)}
              className="p-1 px-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded text-[10px] text-slate-600 flex items-center gap-1"
              title="Toggle Detailed Quantity Breakdown"
            >
              <Info className="w-3 h-3 text-sky-600" />
              <span>{metricsExpanded ? 'Hide Takeoff' : 'Takeoff'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: CAD Sheet Setup (A3 Landscape / Portrait) & Cross-Sections Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. Sheet Orientation Toggle: A3 Landscape vs Portrait */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded border border-slate-300 text-xs font-mono">
              <button
                type="button"
                onClick={() => setSheetOrientation('LANDSCAPE')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  sheetOrientation === 'LANDSCAPE'
                    ? 'bg-deep-navy text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                }`}
                title="Format drawing as ISO A3 Landscape (420 × 297 mm)"
              >
                <span>🖼 A3 Landscape (420×297)</span>
              </button>
              <button
                type="button"
                onClick={() => setSheetOrientation('PORTRAIT')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  sheetOrientation === 'PORTRAIT'
                    ? 'bg-deep-navy text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                }`}
                title="Format drawing as ISO A3 Portrait (297 × 420 mm)"
              >
                <span>📄 A3 Portrait (297×420)</span>
              </button>
            </div>

            {/* 2. Foundation Cross-Sections Visibility & Selection */}
            {activePlan.isFoundationLevel && (
              <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
                {/* 1-Click Hide/Show Toggle */}
                <button
                  type="button"
                  onClick={() => setShowCrossSections(!showCrossSections)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-semibold transition-colors ${
                    showCrossSections
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                  }`}
                  title={showCrossSections ? 'Hide cross-sections and expand foundation plan to full sheet' : 'Show foundation cross-sections'}
                >
                  {showCrossSections ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-rose-600" />}
                  <span>{showCrossSections ? 'Cross-Sections: Visible' : 'Cross-Sections: Hidden (Plan Only)'}</span>
                </button>

                {/* Specific Section Pills */}
                {showCrossSections && (
                  <div className="inline-flex items-center bg-slate-100 p-0.5 rounded border border-slate-300 gap-0.5">
                    {[
                      { id: 'ALL', label: 'All (Grid)' },
                      { id: 'PC1', label: 'PC1 (2-Pile)' },
                      { id: 'PC2', label: 'PC2 (3-Pile)' },
                      { id: 'PC3', label: 'PC3 (4-Pile)' },
                      { id: 'COMBINED', label: 'Combined Mat' },
                    ].map((sec) => {
                      const isActive = selectedSectionType === sec.id;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => setSelectedSectionType(sec.id)}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                          }`}
                        >
                          {sec.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Controls: Layers Popover & Zoom/Fit Toggle */}
          <div className="flex items-center gap-2">
            {/* Layers Dropdown Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLayersMenuOpen(!layersMenuOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold rounded border transition-colors ${
                  layersMenuOpen
                    ? 'bg-slate-200 border-slate-400 text-slate-900'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs'
                }`}
                title="Toggle Drawing CAD Layers"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                <span>Layers (7)</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>

              {layersMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-300 rounded-lg shadow-xl p-3 z-50 space-y-2 text-xs font-mono animate-in fade-in zoom-in-95">
                  <div className="font-bold text-slate-700 border-b border-slate-100 pb-1 flex items-center justify-between">
                    <span>Drawing Layer Toggles</span>
                    <button onClick={() => setLayersMenuOpen(false)} className="text-slate-400 hover:text-slate-600 text-[10px]">✕ Close</button>
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={showGrids}
                        onChange={(e) => setShowGrids(e.target.checked)}
                        className="rounded text-secondary-brand focus:ring-secondary-brand"
                      />
                      <span>Grid Lines</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={showDimensions}
                        onChange={(e) => setShowDimensions(e.target.checked)}
                        className="rounded text-secondary-brand focus:ring-secondary-brand"
                      />
                      <span>Bay Dimensions</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={showMemberLabels}
                        onChange={(e) => setShowMemberLabels(e.target.checked)}
                        className="rounded text-secondary-brand focus:ring-secondary-brand"
                      />
                      <span>Labels (Beams/Cols)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={showSectionSizes}
                        onChange={(e) => setShowSectionSizes(e.target.checked)}
                        className="rounded text-secondary-brand focus:ring-secondary-brand"
                      />
                      <span>Section Sizes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={showSlabs}
                        onChange={(e) => setShowSlabs(e.target.checked)}
                        className="rounded text-secondary-brand focus:ring-secondary-brand"
                      />
                      <span>Floor Slabs</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded text-amber-700 font-semibold">
                      <input
                        type="checkbox"
                        checked={showStaircases}
                        onChange={(e) => setShowStaircases(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-600"
                      />
                      <span>Staircases (Moveable)</span>
                    </label>
                    {activePlan.isFoundationLevel && (
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded text-indigo-700 font-semibold">
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
              )}
            </div>

            {/* Zoom / Fit Sheet to Screen Toggle */}
            <button
              type="button"
              onClick={() => setZoomFit(!zoomFit)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-semibold rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-colors"
              title={zoomFit ? 'Switch to 100% full detail CAD scale' : 'Fit complete A3 sheet to window'}
            >
              {zoomFit ? <Maximize2 className="w-3.5 h-3.5 text-sky-600" /> : <Minimize2 className="w-3.5 h-3.5 text-slate-600" />}
              <span>{zoomFit ? 'Fit Screen' : '100% CAD'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Quantity Takeoff Cards Drawer */}
      {metricsExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in">
          <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
              {activePlan.isFoundationLevel ? 'Foundation Columns / Caps' : 'Framing Members at Level'}
            </span>
            <div className="font-mono space-y-0.5 mt-1">
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

          <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
              Estimated Takeoff for this Level
            </span>
            <div className="font-mono space-y-0.5 mt-1">
              <span className="text-base font-bold text-emerald-700">
                {activePlan.metrics.totalConcreteM3} m³ Concrete
              </span>
              <span className="text-[11px] text-slate-500 block">
                Rebar: {activePlan.metrics.totalSteelKg} kg (~{(activePlan.metrics.totalSteelKg / 1000).toFixed(2)} MT)
              </span>
            </div>
          </div>

          <div className="bg-surface-card p-3 rounded-lg border border-ui-border shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
              Detailing Code &amp; Sheet No
            </span>
            <div className="font-mono space-y-0.5 mt-1">
              <span className="text-base font-bold text-indigo-700">
                {activePlan.sheetNumber} (IS 456 / IS 13920 / IS 2911)
              </span>
              <span className="text-[11px] text-slate-500 block">
                Elevation: Y = {activePlan.elevationY >= 0 ? `+${activePlan.elevationY.toFixed(3)}` : activePlan.elevationY.toFixed(3)} m
              </span>
            </div>
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
                    const roomW = selectedStair.roomWidth || 2.4;
                    const roomL = selectedStair.roomLength || 4.3;
                    const cx = (activePlan.bounds.minX + activePlan.bounds.maxX) / 2 - roomW / 2;
                    const cz = (activePlan.bounds.minZ + activePlan.bounds.maxZ) / 2 - roomL / 2;
                    updateStaircase(selectedStair.id, {
                      position: { x: Math.round(cx * 10) / 10, y: Math.round(cz * 10) / 10 },
                    });
                  }}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded shadow-2xs text-xs font-semibold"
                >
                  Center on Plan
                </button>

                {/* Delete Floorwise vs All Floors */}
                <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
                  <button
                    onClick={() => deleteStaircaseFromFloor(selectedStair.id, activeFloorId)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-2xs transition-colors text-xs"
                    title={`Delete Staircase on ${activePlan.levelName} Only`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete on this Level</span>
                  </button>
                  <button
                    onClick={() => deleteStaircase(selectedStair.id)}
                    className="p-1.5 bg-slate-800 hover:bg-rose-950 text-rose-400 hover:text-rose-200 border border-rose-800/40 rounded shadow-2xs text-xs font-semibold"
                    title="Delete Staircase from ALL Floors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => {
                  const allStairs = Object.values(architecturalStaircases || {});
                  const disabledStair = allStairs.find((s) => s.disabledFloorIds?.includes(activeFloorId));
                  if (disabledStair) {
                    restoreStaircaseForFloor(disabledStair.id, activeFloorId);
                  } else {
                    handleAddStaircaseToLevel();
                  }
                }}
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

      {/* Main 2D CAD SVG Canvas Plan — Responsive Container with Zoom/Fit */}
      <div className={`w-full flex-1 flex justify-center items-center p-1 ${zoomFit ? 'max-h-[calc(100vh-210px)] overflow-hidden' : 'overflow-auto'}`}>
        <div className="w-full max-w-[1680px] flex justify-center items-center">
          <FloorPlanSvg
            floorPlan={activePlan}
            project={activeProject}
            sheetOrientation={sheetOrientation}
            showCrossSections={showCrossSections}
            onToggleCrossSections={setShowCrossSections}
            onOrientationChange={setSheetOrientation}
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
            width={sheetOrientation === 'PORTRAIT' ? 1188 : 1680}
            height={sheetOrientation === 'PORTRAIT' ? 1680 : 1188}
          />
        </div>
      </div>
    </div>
  );
};
