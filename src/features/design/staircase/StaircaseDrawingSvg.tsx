import React, { useState, useRef } from 'react';
import {
  StaircaseFlightDesignOutput,
  StoreyStaircaseDesignOutput,
  StaircaseRoomGeometry,
  StaircaseLandingEntryConfig,
  StaircaseDesignEngine,
  StaircaseBbsSchedule,
  StaircaseBbsItem,
} from './staircaseEngine';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Layers,
  FileSpreadsheet,
  Printer,
  Table,
  Eye,
  FileText,
  Compass,
} from 'lucide-react';

interface StaircaseDrawingSvgProps {
  storeyDesign: StoreyStaircaseDesignOutput;
  activeFlightIndex?: 1 | 2;
  onSelectFlight?: (idx: 1 | 2) => void;
}

export const StaircaseDrawingSvg: React.FC<StaircaseDrawingSvgProps> = ({
  storeyDesign,
  activeFlightIndex = 1,
  onSelectFlight,
}) => {
  const [viewMode, setViewMode] = useState<'PLAN' | 'SECTION' | 'BBS' | 'BOTH' | 'CAD_SHEET'>('CAD_SHEET');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const geom = storeyDesign.roomGeometry;
  const entry = storeyDesign.landingEntryConfig;
  const f1 = storeyDesign.flight1;
  const f2 = storeyDesign.flight2;

  // BBS Schedule calculation
  const bbs: StaircaseBbsSchedule =
    storeyDesign.bbsSchedule ||
    StaircaseDesignEngine.generateStaircaseBbsSchedule(
      {
        levelIndex: storeyDesign.levelIndex,
        levelName: storeyDesign.levelName,
        bottomElevationY: storeyDesign.bottomElevationY,
        topElevationY: storeyDesign.topElevationY,
        storeyHeightM: storeyDesign.storeyHeightM,
        midLandingElevationY: storeyDesign.midLandingElevationY,
        isRoofLevel: false,
      },
      geom,
      f1,
      f2
    );

  // Zoom / Pan handlers
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, z + 0.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, z - 0.2));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // SVG Download
  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Staircase_CAD_${storeyDesign.levelName.replace(/[^a-zA-Z0-9]/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV Export for BBS
  const handleExportBbsCsv = () => {
    const headers = [
      'Bar Mark',
      'Flight / Member',
      'Bar Description',
      'Shape Code',
      'Bar Dia (mm)',
      'Spacing (mm)',
      'Dim a (mm)',
      'Dim b (mm)',
      'Dim c (mm)',
      'Dim d (mm)',
      'No. of Flights',
      'Bars per Flight',
      'Total Bars',
      'Cutting Length (m)',
      'Total Length (m)',
      'Unit Weight (kg/m)',
      'Total Weight (kg)',
      'Detailing Remarks',
    ];

    const rows = bbs.items.map((item) => [
      item.mark,
      item.flightName,
      `"${item.description.replace(/"/g, '""')}"`,
      item.shapeType,
      item.diameter,
      item.spacingMm || '-',
      item.a,
      item.b,
      item.c,
      item.d || 0,
      item.numFlights,
      item.numBarsPerFlight,
      item.totalCount,
      item.cuttingLengthM.toFixed(2),
      item.totalLengthM.toFixed(2),
      item.unitWeightKgM.toFixed(3),
      item.totalWeightKg.toFixed(2),
      `"${item.remarks.replace(/"/g, '""')}"`,
    ]);

    rows.push([]);
    rows.push(['--- DIAMETER-WISE SUMMARY ---']);
    rows.push(['Diameter (mm)', 'Unit Wt (kg/m)', 'Total Length (m)', 'Total Weight (kg)']);
    bbs.diameterSummary.forEach((ds) => {
      rows.push([`${ds.dia} mm`, ds.unitWeightKgM.toFixed(3), ds.totalLengthM.toFixed(2), ds.totalWeightKg.toFixed(2)]);
    });
    rows.push([]);
    rows.push(['NET REBAR WEIGHT', '', '', `${bbs.netWeightKg.toFixed(2)} kg`]);
    rows.push([`WASTAGE ALLOWANCE (${bbs.wastageAllowancePercent}%)`, '', '', `${bbs.wastageWeightKg.toFixed(2)} kg`]);
    rows.push(['GROSS REBAR STEEL REQUIRED', '', '', `${bbs.grossWeightKg.toFixed(2)} kg (${bbs.grossWeightMT.toFixed(3)} MT)`]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Staircase_BBS_${storeyDesign.levelName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Dimensions & Canvas Scaling
  const scale = 140; // pixels per meter in Plan View
  const roomL_px = geom.roomLength * scale; // e.g. 4.80m * 140 = 672px
  const roomW_px = geom.roomWidth * scale; // e.g. 2.40m * 140 = 336px
  const wall_px = (geom.wallThicknessMm / 1000) * scale; // 230mm -> 32.2px
  const flightW_px = geom.flightWidthM * scale; // 1.10m -> 154px
  const wellGap_px = geom.wellGapWidthM * scale; // 0.20m -> 28px
  const landingL_px = geom.landingWidthM * scale; // 1.20m -> 168px
  const tread_px = (geom.treadMm / 1000) * scale;

  // ViewBox dimensions based on active mode
  const svgWidth = viewMode === 'CAD_SHEET' ? 1860 : viewMode === 'BBS' ? 1420 : viewMode === 'BOTH' ? 1400 : 960;
  const svgHeight = viewMode === 'CAD_SHEET' ? 980 : viewMode === 'BBS' ? 840 : 700;

  // Render SVG Bending Diagram Shape for table row
  const renderBarShapeSvg = (item: StaircaseBbsItem, x: number, y: number, w: number, h: number) => {
    const stroke = '#38bdf8';
    const dimColor = '#f59e0b';
    const midX = x + w / 2;
    const midY = y + h / 2;

    switch (item.shapeType) {
      case 'CRANKED':
        return (
          <g>
            <path
              d={`M ${x + 8} ${y + 24} L ${x + 36} ${y + 24} L ${x + 58} ${y + 8} L ${x + 94} ${y + 8} L ${x + 116} ${y + 24} L ${x + 144} ${y + 24}`}
              fill="none"
              stroke={stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dimension labels */}
            <text x={x + 22} y={y + 34} fill={dimColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
              a:{item.a}
            </text>
            <text x={midX} y={y + 6} fill={dimColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
              b:{item.b}
            </text>
            <text x={x + 130} y={y + 34} fill={dimColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
              c:{item.c}
            </text>
          </g>
        );

      case 'L_BAR':
        return (
          <g>
            <path
              d={`M ${x + 18} ${y + 6} L ${x + 18} ${y + 26} L ${x + 136} ${y + 26}`}
              fill="none"
              stroke={stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x={x + 10} y={y + 18} fill={dimColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
              a:{item.a}
            </text>
            <text x={x + 77} y={y + 35} fill={dimColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
              b:{item.b}
            </text>
          </g>
        );

      case 'U_BAR':
        return (
          <g>
            <path
              d={`M ${x + 16} ${y + 8} L ${x + 16} ${y + 26} L ${x + 136} ${y + 26} L ${x + 136} ${y + 8}`}
              fill="none"
              stroke={stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x={x + 8} y={y + 20} fill={dimColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
              a:{item.a}
            </text>
            <text x={midX} y={y + 35} fill={dimColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
              b:{item.b}
            </text>
            <text x={x + 144} y={y + 20} fill={dimColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
              c:{item.c}
            </text>
          </g>
        );

      case 'STRAIGHT':
      default:
        return (
          <g>
            {/* Straight bar with 90 deg end legs */}
            <path
              d={`M ${x + 14} ${y + 12} L ${x + 14} ${y + 20} L ${x + 138} ${y + 20} L ${x + 138} ${y + 12}`}
              fill="none"
              stroke={stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x={midX} y={y + 32} fill={dimColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
              L:{item.b}mm
            </text>
          </g>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-lg border border-slate-800 overflow-hidden font-mono text-slate-100 select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white tracking-wide">
            CAD STAIRCASE &amp; BBS DRAWING: {storeyDesign.levelName.toUpperCase()}
          </span>
          <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-bold text-[10px]">
            {storeyDesign.overallStatus} (IS 456 / SP:34 / IS 2502)
          </span>
        </div>

        {/* View Mode & Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setViewMode('CAD_SHEET')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                viewMode === 'CAD_SHEET' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Full Master CAD Sheet with Plan, Section, BBS & Title Block"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-300" />
              <span>CAD Sheet</span>
            </button>
            <button
              onClick={() => setViewMode('BBS')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition-colors ${
                viewMode === 'BBS' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Bar Bending Schedule (BBS) Table per IS 2502"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>BBS Table</span>
            </button>
            <button
              onClick={() => setViewMode('PLAN')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === 'PLAN' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Plan
            </button>
            <button
              onClick={() => setViewMode('SECTION')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === 'SECTION' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Section
            </button>
            <button
              onClick={() => setViewMode('BOTH')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === 'BOTH' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Side-by-Side
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Zoom controls */}
          <button
            onClick={handleZoomIn}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Move controls */}
          <div className="flex items-center gap-1 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
            <button
              onClick={() => setPan((p) => ({ ...p, x: p.x + 40 }))}
              className="p-1 hover:bg-slate-800 text-slate-300 rounded text-[10px] font-bold"
              title="Move Left"
            >
              ◀
            </button>
            <button
              onClick={() => setPan((p) => ({ ...p, y: p.y + 40 }))}
              className="p-1 hover:bg-slate-800 text-slate-300 rounded text-[10px] font-bold"
              title="Move Up"
            >
              ▲
            </button>
            <button
              onClick={() => setPan((p) => ({ ...p, y: p.y - 40 }))}
              className="p-1 hover:bg-slate-800 text-slate-300 rounded text-[10px] font-bold"
              title="Move Down"
            >
              ▼
            </button>
            <button
              onClick={() => setPan((p) => ({ ...p, x: p.x - 40 }))}
              className="p-1 hover:bg-slate-800 text-slate-300 rounded text-[10px] font-bold"
              title="Move Right"
            >
              ▶
            </button>
          </div>

          <button
            onClick={handleResetView}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
            title="Reset Pan & Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Export BBS CSV */}
          <button
            onClick={handleExportBbsCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold text-xs shadow transition-colors"
            title="Export BBS Schedule as Excel / CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export BBS CSV</span>
          </button>

          {/* Export SVG */}
          <button
            onClick={handleDownloadSvg}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold text-xs shadow transition-colors"
            title="Export Vector CAD SVG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export SVG</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        className="flex-1 relative overflow-hidden bg-slate-950 cursor-grab active:cursor-grabbing flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full"
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="cadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>

            {/* Hatch for Concrete Waist Slab */}
            <pattern id="concreteHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="10" stroke="#334155" strokeWidth="1" />
            </pattern>

            {/* Hatch for Masonry Walls */}
            <pattern id="wallHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#475569" strokeWidth="1.2" />
            </pattern>

            {/* Marker Arrows */}
            <marker id="arrowUp" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>
            <marker id="arrowDim" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="url(#cadGrid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* ========================================================================= */}
            {/* CAD SHEET MASTER BORDER & TITLE BLOCK (When in CAD_SHEET mode)           */}
            {/* ========================================================================= */}
            {viewMode === 'CAD_SHEET' && (
              <g>
                {/* Outer Sheet Border */}
                <rect x="15" y="15" width="1830" height="950" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
                <rect x="22" y="22" width="1816" height="936" fill="none" stroke="#1e293b" strokeWidth="1" />

                {/* Sheet Title Bar */}
                <rect x="25" y="25" width="1810" height="40" fill="#0f172a" stroke="#334155" strokeWidth="1" />
                <text x="45" y="50" fill="#f8fafc" fontSize="16" fontWeight="bold" fontFamily="monospace">
                  PROJECT: RCC MULTI-STOREY RESIDENTIAL / COMMERCIAL BUILDING — STRUCTURAL STAIRCASE REINFORCEMENT &amp; BBS SHEET
                </text>
                <text x="1810" y="50" fill="#38bdf8" fontSize="12" fontWeight="bold" fontFamily="monospace" textAnchor="end">
                  DWG NO: STR-007 (REV-A)
                </text>
              </g>
            )}

            {/* ========================================================================= */}
            {/* 1. PLAN VIEW (STAIRCASE ROOM WITH DUAL-SIDE LANDING ENTRIES)             */}
            {/* ========================================================================= */}
            {(viewMode === 'PLAN' || viewMode === 'BOTH' || viewMode === 'CAD_SHEET') && (
              <g transform={viewMode === 'CAD_SHEET' ? 'translate(45, 95)' : 'translate(100, 120)'}>
                {/* Title & Dimension Summary */}
                <text x="0" y="-18" fill="#f8fafc" fontSize="13" fontWeight="bold" fontFamily="monospace">
                  PLAN VIEW — RCC DOG-LEGGED STAIRCASE (IS 456 Cl. 33)
                </text>
                <text x="0" y="-4" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                  Room: {geom.roomLength.toFixed(2)}m (L) × {geom.roomWidth.toFixed(2)}m (B) | Wall: {geom.wallThicknessMm}mm | Tread: {geom.treadMm}mm | Riser: {f1.riserMm}mm
                </text>

                {/* Outer Room Walls */}
                <rect
                  x={-wall_px}
                  y={-wall_px}
                  width={roomL_px + 2 * wall_px}
                  height={roomW_px + 2 * wall_px}
                  fill="url(#wallHatch)"
                  stroke="#64748b"
                  strokeWidth="2"
                />

                {/* Inner Room Void */}
                <rect
                  x="0"
                  y="0"
                  width={roomL_px}
                  height={roomW_px}
                  fill="#020617"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />

                {/* FLOOR LANDING 1 (LEFT SIDE / ENTRANCE) */}
                <rect
                  x="0"
                  y="0"
                  width={landingL_px}
                  height={roomW_px}
                  fill="#1e1b4b"
                  fillOpacity="0.4"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeDasharray="4,2"
                />
                <text x={landingL_px / 2} y={roomW_px / 2 - 8} fill="#a5b4fc" fontSize="11" fontWeight="bold" textAnchor="middle">
                  MAIN FLOOR LANDING
                </text>
                <text x={landingL_px / 2} y={roomW_px / 2 + 8} fill="#818cf8" fontSize="10" textAnchor="middle">
                  EL. +{storeyDesign.bottomElevationY.toFixed(2)}m
                </text>

                {/* FLIGHT 1 (GOING UP -> BOTTOM HALF) */}
                <g
                  className="cursor-pointer"
                  onClick={() => onSelectFlight && onSelectFlight(1)}
                  opacity={activeFlightIndex === 1 ? 1 : 0.75}
                >
                  <rect
                    x={landingL_px}
                    y={roomW_px - flightW_px}
                    width={roomL_px - 2 * landingL_px}
                    height={flightW_px}
                    fill={activeFlightIndex === 1 ? '#064e3b' : '#022c22'}
                    fillOpacity="0.6"
                    stroke={activeFlightIndex === 1 ? '#10b981' : '#059669'}
                    strokeWidth={activeFlightIndex === 1 ? '2.5' : '1.5'}
                  />

                  {/* Flight 1 Treads */}
                  {Array.from({ length: f1.treadCount }).map((_, i) => {
                    const tx = landingL_px + i * tread_px;
                    return (
                      <line
                        key={`f1_tr_${i}`}
                        x1={tx}
                        y1={roomW_px - flightW_px}
                        x2={tx}
                        y2={roomW_px}
                        stroke="#10b981"
                        strokeWidth="1.2"
                      />
                    );
                  })}

                  {/* Flight 1 Direction Arrow */}
                  <line
                    x1={landingL_px + 20}
                    y1={roomW_px - flightW_px / 2}
                    x2={roomL_px - landingL_px - 20}
                    y2={roomW_px - flightW_px / 2}
                    stroke="#10b981"
                    strokeWidth="2.5"
                    markerEnd="url(#arrowUp)"
                  />
                  <text
                    x={roomL_px / 2}
                    y={roomW_px - flightW_px / 2 - 8}
                    fill="#34d399"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    FLIGHT 1 UP ➔ ({f1.riserCount}R × {f1.treadCount}T)
                  </text>
                </g>

                {/* CENTRAL WELL GAP */}
                <rect
                  x={landingL_px}
                  y={flightW_px}
                  width={roomL_px - 2 * landingL_px}
                  height={wellGap_px}
                  fill="#090d16"
                  stroke="#475569"
                  strokeWidth="1"
                />

                {/* FLIGHT 2 (GOING UP TO NEXT FLOOR -> TOP HALF) */}
                <g
                  className="cursor-pointer"
                  onClick={() => onSelectFlight && onSelectFlight(2)}
                  opacity={activeFlightIndex === 2 ? 1 : 0.75}
                >
                  <rect
                    x={landingL_px}
                    y={0}
                    width={roomL_px - 2 * landingL_px}
                    height={flightW_px}
                    fill={activeFlightIndex === 2 ? '#064e3b' : '#022c22'}
                    fillOpacity="0.6"
                    stroke={activeFlightIndex === 2 ? '#10b981' : '#059669'}
                    strokeWidth={activeFlightIndex === 2 ? '2.5' : '1.5'}
                  />

                  {/* Flight 2 Treads */}
                  {Array.from({ length: f2.treadCount }).map((_, i) => {
                    const tx = landingL_px + (i + 1) * tread_px;
                    return (
                      <line
                        key={`f2_tr_${i}`}
                        x1={tx}
                        y1={0}
                        x2={tx}
                        y2={flightW_px}
                        stroke="#10b981"
                        strokeWidth="1.2"
                      />
                    );
                  })}

                  {/* Flight 2 Direction Arrow */}
                  <line
                    x1={roomL_px - landingL_px - 20}
                    y1={flightW_px / 2}
                    x2={landingL_px + 20}
                    y2={flightW_px / 2}
                    stroke="#10b981"
                    strokeWidth="2.5"
                    markerEnd="url(#arrowUp)"
                  />
                  <text
                    x={roomL_px / 2}
                    y={flightW_px / 2 - 8}
                    fill="#34d399"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    FLIGHT 2 UP ➔ ({f2.riserCount}R × {f2.treadCount}T)
                  </text>
                </g>

                {/* MID-LANDING (RIGHT SIDE) */}
                <rect
                  x={roomL_px - landingL_px}
                  y={0}
                  width={landingL_px}
                  height={roomW_px}
                  fill="#064e3b"
                  fillOpacity="0.3"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4,2"
                />
                <text
                  x={roomL_px - landingL_px / 2}
                  y={roomW_px / 2 - 8}
                  fill="#6ee7b7"
                  fontSize="11"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  MID-LANDING
                </text>
                <text
                  x={roomL_px - landingL_px / 2}
                  y={roomW_px / 2 + 8}
                  fill="#34d399"
                  fontSize="10"
                  textAnchor="middle"
                >
                  EL. +{storeyDesign.midLandingElevationY.toFixed(2)}m
                </text>

                {/* DUAL-SIDE LANDING ENTRY DOORS */}
                {/* 1. Left Entry Door */}
                {entry.hasLeftDoor && (
                  <g transform={`translate(${roomL_px - landingL_px / 2}, ${-wall_px})`}>
                    <rect x={-35} y="0" width="70" height={wall_px} fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="0" y={wall_px / 2 + 3} fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                      DOOR D1 ({entry.leftDoorWidthM}m)
                    </text>
                  </g>
                )}

                {/* 2. Right Entry Door */}
                {entry.hasRightDoor && (
                  <g transform={`translate(${roomL_px - landingL_px / 2}, ${roomW_px})`}>
                    <rect x={-35} y="0" width="70" height={wall_px} fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="0" y={wall_px / 2 + 3} fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                      DOOR D2 ({entry.rightDoorWidthM}m)
                    </text>
                  </g>
                )}

                {/* 3. Front Main Corridor Door */}
                {entry.hasFrontDoor && (
                  <g transform={`translate(${-wall_px}, ${roomW_px / 2 - 40})`}>
                    <rect x="0" y="0" width={wall_px} height="80" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x={wall_px / 2} y="44" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${wall_px / 2} 44)`}>
                      MAIN ENTRY ({entry.frontDoorWidthM}m)
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* ========================================================================= */}
            {/* 2. SECTION VIEW (LONGITUDINAL ELEVATION & REBAR DETAILING)               */}
            {/* ========================================================================= */}
            {(viewMode === 'SECTION' || viewMode === 'BOTH' || viewMode === 'CAD_SHEET') && (
              <g
                transform={
                  viewMode === 'CAD_SHEET'
                    ? 'translate(45, 520)'
                    : viewMode === 'BOTH'
                    ? 'translate(740, 120)'
                    : 'translate(100, 120)'
                }
              >
                <text x="0" y="-18" fill="#f8fafc" fontSize="13" fontWeight="bold" fontFamily="monospace">
                  LONGITUDINAL SECTION — RCC WAIST SLAB &amp; REBAR DETAILING (SP:34)
                </text>

                {(() => {
                  const landL = 100;
                  const goingL = 220;
                  const riseH = 130;
                  const tw = 22;
                  const riserS = riseH / f1.riserCount;
                  const treadS = goingL / f1.treadCount;
                  const startX = 0;
                  const startY = 240;

                  let stepsPath = `M ${startX} ${startY}`;
                  stepsPath += ` L ${startX + landL} ${startY}`;

                  let curX = startX + landL;
                  let curY = startY;
                  for (let i = 0; i < f1.treadCount; i++) {
                    curY -= riserS;
                    stepsPath += ` L ${curX} ${curY}`;
                    curX += treadS;
                    stepsPath += ` L ${curX} ${curY}`;
                  }
                  curY -= riserS;
                  stepsPath += ` L ${curX} ${curY}`;
                  stepsPath += ` L ${curX + landL} ${curY}`; // Top Mid-Landing

                  stepsPath += ` L ${curX + landL} ${curY + tw}`;
                  stepsPath += ` L ${curX} ${curY + tw}`;
                  stepsPath += ` L ${startX + landL} ${startY + tw}`;
                  stepsPath += ` L ${startX} ${startY + tw}`;
                  stepsPath += ' Z';

                  return (
                    <g>
                      {/* Concrete Waist Slab & Steps */}
                      <path d={stepsPath} fill="url(#concreteHatch)" stroke="#64748b" strokeWidth="2" />

                      {/* Bottom Main Tension Rebar (Orange) with Kink Detailing */}
                      <path
                        d={`M ${startX + 10} ${startY + tw - 6} L ${startX + landL + 25} ${startY + tw - 6} L ${curX + landL - 10} ${curY + tw - 6}`}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="3.2"
                      />

                      {/* Kink Cross-Over Tension Bar into Mid-Landing Compression Zone (SP:34) */}
                      <path
                        d={`M ${startX + landL - 20} ${startY + 6} L ${startX + landL + 35} ${startY + tw - 6}`}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="2.2"
                        strokeDasharray="4,2"
                      />

                      {/* Top Negative Reinforcement at Supports (Purple) */}
                      <path
                        d={`M ${startX + 10} ${startY + 6} L ${startX + landL + goingL * 0.28} ${startY + 6}`}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2.2"
                      />
                      <path
                        d={`M ${curX - goingL * 0.28} ${curY + 6} L ${curX + landL - 10} ${curY + 6}`}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2.2"
                      />

                      {/* Transverse Distribution Rebar Dots (Cyan) */}
                      {Array.from({ length: 7 }).map((_, i) => {
                        const dotX = startX + landL + (i * goingL) / 6;
                        const dotY = startY + tw - 11 - (i * riseH) / 6;
                        return (
                          <circle
                            key={`dist_dot_${i}`}
                            cx={dotX}
                            cy={dotY}
                            r="2.8"
                            fill="#06b6d4"
                            stroke="#083344"
                            strokeWidth="0.8"
                          />
                        );
                      })}

                      {/* Elevation Markers */}
                      <g transform={`translate(${startX - 10}, ${startY})`}>
                        <line x1="-30" y1="0" x2="40" y2="0" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3,2" />
                        <text x="-35" y="4" fill="#a5b4fc" fontSize="9" fontWeight="bold" textAnchor="end">
                          FL. EL. +{storeyDesign.bottomElevationY.toFixed(2)}m
                        </text>
                      </g>

                      <g transform={`translate(${curX + landL + 10}, ${curY})`}>
                        <line x1="-40" y1="0" x2="30" y2="0" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3,2" />
                        <text x="35" y="4" fill="#34d399" fontSize="9" fontWeight="bold" textAnchor="start">
                          MID-LANDING EL. +{storeyDesign.midLandingElevationY.toFixed(2)}m
                        </text>
                      </g>

                      {/* Rebar Callouts */}
                      <g transform={`translate(${startX + 10}, ${startY + tw + 28})`}>
                        <text x="0" y="0" fill="#f97316" fontSize="9.5" fontWeight="bold">
                          ● Main Rebar (Mark ST-01): {f1.mainRebarCallout}
                        </text>
                        <text x="0" y="14" fill="#06b6d4" fontSize="9">
                          ● Distribution Steel (Mark ST-03): {f1.distributionRebarCallout}
                        </text>
                        <text x="0" y="28" fill="#a855f7" fontSize="9">
                          ● Top Support Negative Steel (Mark ST-02): {f1.topNegativeRebarCallout}
                        </text>
                        <text x="0" y="42" fill="#10b981" fontSize="9" fontWeight="bold">
                          ● Kink Detail (Mark ST-KINK): Ld = 47d anchorage (IS 13920 / SP:34)
                        </text>
                      </g>
                    </g>
                  );
                })()}
              </g>
            )}

            {/* ========================================================================= */}
            {/* 3. BAR BENDING SCHEDULE (BBS) TABLE ON CAD SHEET (IS 2502 & SP:34)       */}
            {/* ========================================================================= */}
            {(viewMode === 'BBS' || viewMode === 'CAD_SHEET') && (
              <g transform={viewMode === 'CAD_SHEET' ? 'translate(830, 95)' : 'translate(40, 80)'}>
                {/* BBS Title & Subtitle Banner */}
                <rect x="0" y="-18" width="980" height="28" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" rx="3" />
                <text x="12" y="1" fill="#38bdf8" fontSize="11" fontWeight="bold" fontFamily="monospace">
                  BAR BENDING SCHEDULE (BBS) — IS 2502:1963 &amp; SP:34:1987 COMPLIANT
                </text>
                <text x="965" y="1" fill="#94a3b8" fontSize="9" fontWeight="bold" textAnchor="end">
                  {bbs.elevationRange} | {bbs.concreteGrade} Concrete | {bbs.steelGrade} Steel | Cover: {bbs.clearCoverMm}mm
                </text>

                {/* Table Header */}
                {(() => {
                  const headerY = 20;
                  const rowH = 44;
                  const cols = [
                    { label: 'MARK', w: 60 },
                    { label: 'FLIGHT / COMP', w: 90 },
                    { label: 'BAR DESCRIPTION', w: 220 },
                    { label: 'BENDING SHAPE (IS 2502)', w: 155 },
                    { label: 'DIA', w: 40 },
                    { label: 'SPAC', w: 45 },
                    { label: 'NO.', w: 45 },
                    { label: 'CUT L (m)', w: 65 },
                    { label: 'TOT L (m)', w: 65 },
                    { label: 'UNIT WT', w: 60 },
                    { label: 'TOT WT (kg)', w: 75 },
                    { label: 'REMARKS', w: 60 },
                  ];

                  let curColX = 0;

                  return (
                    <g>
                      {/* Header Row Background */}
                      <rect x="0" y={headerY} width="980" height="24" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                      {cols.map((c, cIdx) => {
                        const colX = curColX;
                        curColX += c.w;
                        return (
                          <g key={`hdr_col_${cIdx}`}>
                            <text
                              x={colX + c.w / 2}
                              y={headerY + 16}
                              fill="#f8fafc"
                              fontSize="8.5"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {c.label}
                            </text>
                            <line x1={curColX} y1={headerY} x2={curColX} y2={headerY + 24 + bbs.items.length * rowH + 85} stroke="#334155" strokeWidth="0.8" />
                          </g>
                        );
                      })}

                      {/* Table Border */}
                      <rect x="0" y={headerY} width="980" height={24 + bbs.items.length * rowH + 85} fill="none" stroke="#475569" strokeWidth="1.2" />

                      {/* BBS Data Rows */}
                      {bbs.items.map((item, rIdx) => {
                        const rowY = headerY + 24 + rIdx * rowH;
                        const isEven = rIdx % 2 === 0;

                        return (
                          <g key={`bbs_row_${item.mark}`}>
                            {/* Row Background */}
                            <rect
                              x="0"
                              y={rowY}
                              width="980"
                              height={rowH}
                              fill={isEven ? '#090d16' : '#030712'}
                              stroke="#1e293b"
                              strokeWidth="0.5"
                            />

                            {/* Col 1: Mark */}
                            <text x="30" y={rowY + 26} fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">
                              {item.mark}
                            </text>

                            {/* Col 2: Flight */}
                            <text x="105" y={rowY + 26} fill="#cbd5e1" fontSize="8.5" textAnchor="middle">
                              {item.flightName}
                            </text>

                            {/* Col 3: Description */}
                            <text x="155" y={rowY + 20} fill="#f1f5f9" fontSize="8" fontWeight="bold">
                              {item.description.length > 38 ? `${item.description.slice(0, 38)}...` : item.description}
                            </text>
                            <text x="155" y={rowY + 34} fill="#64748b" fontSize="7.5">
                              {item.remarks.length > 40 ? `${item.remarks.slice(0, 40)}...` : item.remarks}
                            </text>

                            {/* Col 4: Shape Diagram */}
                            {renderBarShapeSvg(item, 370, rowY + 4, 150, rowH - 8)}

                            {/* Col 5: Dia */}
                            <text x="545" y={rowY + 26} fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">
                              T{item.diameter}
                            </text>

                            {/* Col 6: Spacing */}
                            <text x="590" y={rowY + 26} fill="#94a3b8" fontSize="8.5" textAnchor="middle">
                              {item.spacingMm ? `${item.spacingMm}` : '-'}
                            </text>

                            {/* Col 7: No. */}
                            <text x="635" y={rowY + 26} fill="#f8fafc" fontSize="9" fontWeight="bold" textAnchor="middle">
                              {item.totalCount}
                            </text>

                            {/* Col 8: Cut L */}
                            <text x="690" y={rowY + 26} fill="#cbd5e1" fontSize="8.5" textAnchor="middle">
                              {item.cuttingLengthM.toFixed(2)}
                            </text>

                            {/* Col 9: Tot L */}
                            <text x="755" y={rowY + 26} fill="#cbd5e1" fontSize="8.5" textAnchor="middle">
                              {item.totalLengthM.toFixed(2)}
                            </text>

                            {/* Col 10: Unit Wt */}
                            <text x="820" y={rowY + 26} fill="#94a3b8" fontSize="8.5" textAnchor="middle">
                              {item.unitWeightKgM.toFixed(3)}
                            </text>

                            {/* Col 11: Tot Wt */}
                            <text x="888" y={rowY + 26} fill="#4ade80" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                              {item.totalWeightKg.toFixed(2)}
                            </text>

                            {/* Col 12: Remarks */}
                            <text x="955" y={rowY + 26} fill="#a5b4fc" fontSize="7.5" textAnchor="middle">
                              SP:34
                            </text>
                          </g>
                        );
                      })}

                      {/* Total Net Weight Row */}
                      {(() => {
                        const totalNetY = headerY + 24 + bbs.items.length * rowH;
                        const wastageY = totalNetY + 26;
                        const grossY = wastageY + 26;

                        return (
                          <g>
                            {/* Net Total */}
                            <rect x="0" y={totalNetY} width="980" height="26" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                            <text x="15" y={totalNetY + 17} fill="#f8fafc" fontSize="9.5" fontWeight="bold">
                              TOTAL NET REBAR QUANTITY (IS 456 DESIGN CONSUMPTION):
                            </text>
                            <text x="755" y={totalNetY + 17} fill="#38bdf8" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                              {bbs.totalLengthM.toFixed(2)} m
                            </text>
                            <text x="888" y={totalNetY + 17} fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
                              {bbs.netWeightKg.toFixed(2)} kg
                            </text>

                            {/* Wastage Row */}
                            <rect x="0" y={wastageY} width="980" height="26" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                            <text x="15" y={wastageY + 17} fill="#fbbf24" fontSize="9" fontWeight="bold">
                              ADD: STANDARD REBAR CUTTING &amp; LAPPING WASTAGE ALLOWANCE (+5.0% PER CPWD / IS 2502):
                            </text>
                            <text x="888" y={wastageY + 17} fill="#fbbf24" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                              +{bbs.wastageWeightKg.toFixed(2)} kg
                            </text>

                            {/* Gross Total Row */}
                            <rect x="0" y={grossY} width="980" height="32" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
                            <text x="15" y={grossY + 21} fill="#ecfdf5" fontSize="10.5" fontWeight="bold">
                              GROSS TOTAL REINFORCEMENT STEEL REQUIRED (PROCUREMENT ORDER):
                            </text>
                            <text x="888" y={grossY + 21} fill="#34d399" fontSize="11.5" fontWeight="bold" textAnchor="middle">
                              {bbs.grossWeightKg.toFixed(2)} kg ({bbs.grossWeightMT.toFixed(3)} MT)
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  );
                })()}

                {/* DIAMETER-WISE SUMMARY BOX & GENERAL NOTES */}
                {(() => {
                  const summaryBoxY = 20 + 24 + bbs.items.length * 44 + 95;

                  return (
                    <g transform={`translate(0, ${summaryBoxY})`}>
                      {/* Left Box: Diameter-Wise Breakdown */}
                      <rect x="0" y="0" width="460" height="150" fill="#090d16" stroke="#334155" strokeWidth="1" rx="4" />
                      <rect x="0" y="0" width="460" height="24" fill="#1e293b" rx="4" />
                      <text x="12" y="16" fill="#38bdf8" fontSize="9.5" fontWeight="bold">
                        DIAMETER-WISE STEEL WEIGHT SUMMARY
                      </text>

                      {/* Header */}
                      <text x="20" y="42" fill="#94a3b8" fontSize="8.5" fontWeight="bold">DIAMETER</text>
                      <text x="130" y="42" fill="#94a3b8" fontSize="8.5" fontWeight="bold">UNIT WT</text>
                      <text x="240" y="42" fill="#94a3b8" fontSize="8.5" fontWeight="bold">TOTAL LENGTH</text>
                      <text x="360" y="42" fill="#94a3b8" fontSize="8.5" fontWeight="bold">TOTAL WEIGHT</text>

                      {bbs.diameterSummary.map((ds, dIdx) => {
                        const dY = 62 + dIdx * 20;
                        return (
                          <g key={`dia_sum_${ds.dia}`}>
                            <text x="20" y={dY} fill="#38bdf8" fontSize="9" fontWeight="bold">T{ds.dia} mm</text>
                            <text x="130" y={dY} fill="#cbd5e1" fontSize="8.5">{ds.unitWeightKgM.toFixed(3)} kg/m</text>
                            <text x="240" y={dY} fill="#cbd5e1" fontSize="8.5">{ds.totalLengthM.toFixed(2)} m</text>
                            <text x="360" y={dY} fill="#4ade80" fontSize="9" fontWeight="bold">{ds.totalWeightKg.toFixed(2)} kg</text>
                          </g>
                        );
                      })}

                      {/* Right Box: General Detailing Notes & Title Block */}
                      <g transform="translate(480, 0)">
                        <rect x="0" y="0" width="500" height="150" fill="#090d16" stroke="#334155" strokeWidth="1" rx="4" />
                        <rect x="0" y="0" width="500" height="24" fill="#1e293b" rx="4" />
                        <text x="12" y="16" fill="#38bdf8" fontSize="9.5" fontWeight="bold">
                          GENERAL REINFORCEMENT &amp; BBS NOTES (IS 456 / SP:34)
                        </text>

                        <text x="12" y="42" fill="#cbd5e1" fontSize="8">
                          1. ALL REBAR SHALL BE HIGH YIELD STRENGTH DEFORMED BARS (Fe 500D) CONFORMING TO IS 1786.
                        </text>
                        <text x="12" y="56" fill="#cbd5e1" fontSize="8">
                          2. MINIMUM CLEAR COVER TO MAIN REBAR: 20mm IN WAIST SLAB &amp; 25mm IN BEAMS/LANDINGS.
                        </text>
                        <text x="12" y="70" fill="#cbd5e1" fontSize="8">
                          3. FULL TENSION DEVELOPMENT LENGTH Ld = 47d PROVIDED AT ALL LANDING ANCHORAGES.
                        </text>
                        <text x="12" y="84" fill="#cbd5e1" fontSize="8">
                          4. AT RE-ENTRANT KINK CORNERS, TENSION BARS CROSS OVER TO FAR COMPRESSION FACE (SP:34 Cl. 10.4).
                        </text>
                        <text x="12" y="98" fill="#cbd5e1" fontSize="8">
                          5. BEND DEDUCTIONS: 2d FOR 45°, 2d FOR 90°, AND 4d FOR 135° BENDS PER IS 2502:1963.
                        </text>

                        {/* Title Stamp */}
                        <g transform="translate(10, 114)">
                          <rect x="0" y="0" width="480" height="28" fill="#0284c7" fillOpacity="0.15" stroke="#0284c7" strokeWidth="1" rx="2" />
                          <text x="10" y="18" fill="#38bdf8" fontSize="8.5" fontWeight="bold">
                            ENGINEER: ANTIGRAVITY AI DESIGNER | STATUS: APPROVED FOR FABRICATION | CODE: IS 456:2000
                          </text>
                        </g>
                      </g>
                    </g>
                  );
                })()}
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* Bottom Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-4">
          <span>Flight 1: <strong className="text-emerald-400">{f1.concreteM3} m³</strong> concrete | <strong className="text-sky-400">{f1.steelKg} kg</strong> steel</span>
          <span className="text-slate-600">|</span>
          <span>Flight 2: <strong className="text-emerald-400">{f2.concreteM3} m³</strong> concrete | <strong className="text-sky-400">{f2.steelKg} kg</strong> steel</span>
          <span className="text-slate-600">|</span>
          <span>Storey Total Rebar: <strong className="text-amber-300 font-bold">{bbs.grossWeightKg.toFixed(1)} kg</strong> ({bbs.grossWeightMT.toFixed(3)} MT with 5% waste)</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">Headroom Clearance:</span>
          <span className="text-emerald-400 font-bold">{f1.headroomM} m (NBC $\ge 2.20$m Safe)</span>
        </div>
      </div>
    </div>
  );
};
