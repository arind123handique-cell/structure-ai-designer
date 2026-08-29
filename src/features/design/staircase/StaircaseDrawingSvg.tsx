import React, { useState, useRef } from 'react';
import {
  StaircaseFlightDesignOutput,
  StoreyStaircaseDesignOutput,
  StaircaseRoomGeometry,
  StaircaseLandingEntryConfig,
} from './staircaseEngine';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Eye,
  Layers,
  DoorOpen,
  Maximize2,
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
  const [viewMode, setViewMode] = useState<'PLAN' | 'SECTION' | 'BOTH'>('PLAN');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  const geom = storeyDesign.roomGeometry;
  const entry = storeyDesign.landingEntryConfig;
  const f1 = storeyDesign.flight1;
  const f2 = storeyDesign.flight2;

  // Zoom / Pan handlers
  const handleZoomIn = () => setZoom((z) => Math.min(2.5, z + 0.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, z - 0.2));
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

  // Dimensions & Canvas Scaling
  const scale = 140; // pixels per meter in Plan View
  const roomL_px = geom.roomLength * scale; // e.g. 4.80m * 140 = 672px
  const roomW_px = geom.roomWidth * scale; // e.g. 2.40m * 140 = 336px
  const wall_px = (geom.wallThicknessMm / 1000) * scale; // 230mm -> 32.2px
  const flightW_px = geom.flightWidthM * scale; // 1.10m -> 154px
  const wellGap_px = geom.wellGapWidthM * scale; // 0.20m -> 28px
  const landingL_px = geom.landingWidthM * scale; // 1.20m -> 168px
  const tread_px = (geom.treadMm / 1000) * scale;

  // ViewBox
  const svgWidth = viewMode === 'BOTH' ? 1400 : 960;
  const svgHeight = 700;

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-lg border border-slate-800 overflow-hidden font-mono text-slate-100 select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white tracking-wide">
            CAD STAIRCASE DRAWING: {storeyDesign.levelName.toUpperCase()}
          </span>
          <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-bold text-[10px]">
            {storeyDesign.overallStatus} (IS 456 / SP:34)
          </span>
        </div>

        {/* View Mode & Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setViewMode('PLAN')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === 'PLAN' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Plan (Dual Entries)
            </button>
            <button
              onClick={() => setViewMode('SECTION')}
              className={`px-2.5 py-1 rounded transition-colors ${
                viewMode === 'SECTION' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Section Detailing
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
          <button
            onClick={handleResetView}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
            title="Reset Pan & Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDownloadSvg}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs shadow transition-colors"
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
            <marker id="doorSwing" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <circle cx="5" cy="5" r="4" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="url(#cadGrid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* ========================================================================= */}
            {/* 1. PLAN VIEW (STAIRCASE ROOM WITH DUAL-SIDE LANDING ENTRIES)             */}
            {/* ========================================================================= */}
            {(viewMode === 'PLAN' || viewMode === 'BOTH') && (
              <g transform="translate(100, 120)">
                {/* Title & Dimension Summary */}
                <text x="0" y="-55" fill="#f8fafc" fontSize="14" fontWeight="bold" fontFamily="monospace">
                  PLAN VIEW — RCC DOG-LEGGED STAIRCASE (IS 456:2000 Cl. 33)
                </text>
                <text x="0" y="-38" fill="#94a3b8" fontSize="11" fontFamily="monospace">
                  Room Size: {geom.roomLength.toFixed(2)}m (L) × {geom.roomWidth.toFixed(2)}m (B) | Wall: {geom.wallThicknessMm}mm | Tread: {geom.treadMm}mm | Riser: {f1.riserMm}mm
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

                {/* ================= FLOOR LANDING 1 (LEFT SIDE / ENTRANCE) ================= */}
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
                  EL. +{storeyDesign.bottomElevationY.toFixed(2)} m
                </text>
                <text x={landingL_px / 2} y={roomW_px / 2 + 22} fill="#64748b" fontSize="9" textAnchor="middle">
                  Depth: {geom.landingWidthM.toFixed(2)}m
                </text>

                {/* ================= MID-LANDING 2 (RIGHT SIDE) ================= */}
                <rect
                  x={roomL_px - landingL_px}
                  y="0"
                  width={landingL_px}
                  height={roomW_px}
                  fill="#064e3b"
                  fillOpacity="0.3"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4,2"
                />
                <text x={roomL_px - landingL_px / 2} y={roomW_px / 2 - 8} fill="#6ee7b7" fontSize="11" fontWeight="bold" textAnchor="middle">
                  MID-LANDING SLAB
                </text>
                <text x={roomL_px - landingL_px / 2} y={roomW_px / 2 + 8} fill="#34d399" fontSize="10" textAnchor="middle">
                  EL. +{storeyDesign.midLandingElevationY.toFixed(2)} m
                </text>
                <text x={roomL_px - landingL_px / 2} y={roomW_px / 2 + 22} fill="#64748b" fontSize="9" textAnchor="middle">
                  Depth: {geom.landingWidthM.toFixed(2)}m
                </text>

                {/* ================= FLIGHT 1 (GOING UP) ================= */}
                <g
                  className="cursor-pointer"
                  onClick={() => onSelectFlight && onSelectFlight(1)}
                >
                  <rect
                    x={landingL_px}
                    y="0"
                    width={f1.goingLengthM * scale}
                    height={flightW_px}
                    fill={activeFlightIndex === 1 ? '#0c4a6e' : '#0f172a'}
                    fillOpacity="0.7"
                    stroke="#0284c7"
                    strokeWidth="2"
                  />

                  {/* Flight 1 Treads Lines & Numbers */}
                  {Array.from({ length: f1.treadCount }).map((_, i) => {
                    const stepX = landingL_px + i * tread_px;
                    return (
                      <g key={`f1_step_${i}`}>
                        <line
                          x1={stepX}
                          y1="0"
                          x2={stepX}
                          y2={flightW_px}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        <text
                          x={stepX + tread_px / 2}
                          y={flightW_px / 2 + 4}
                          fill="#7dd3fc"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {i + 1}
                        </text>
                      </g>
                    );
                  })}

                  {/* Flight 1 Direction Arrow (UP) */}
                  <line
                    x1={landingL_px + 20}
                    y1={flightW_px / 2}
                    x2={landingL_px + f1.goingLengthM * scale - 20}
                    y2={flightW_px / 2}
                    stroke="#10b981"
                    strokeWidth="3"
                    markerEnd="url(#arrowUp)"
                  />
                  <text
                    x={landingL_px + (f1.goingLengthM * scale) / 2}
                    y={flightW_px / 2 - 10}
                    fill="#10b981"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    UP (Flight 1: {f1.riserCount} Risers @ {f1.riserMm}mm)
                  </text>
                </g>

                {/* ================= CENTRAL WELL GAP ================= */}
                <rect
                  x={landingL_px}
                  y={flightW_px}
                  width={f1.goingLengthM * scale}
                  height={wellGap_px}
                  fill="#020617"
                  stroke="#475569"
                  strokeDasharray="2,2"
                />
                <line
                  x1={landingL_px}
                  y1={flightW_px + wellGap_px / 2}
                  x2={landingL_px + f1.goingLengthM * scale}
                  y2={flightW_px + wellGap_px / 2}
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />
                <text
                  x={landingL_px + (f1.goingLengthM * scale) / 2}
                  y={flightW_px + wellGap_px / 2 + 3}
                  fill="#64748b"
                  fontSize="8"
                  textAnchor="middle"
                >
                  Well Gap {geom.wellGapWidthM * 1000}mm
                </text>

                {/* ================= FLIGHT 2 (GOING UP TO NEXT DIAPHRAGM) ================= */}
                <g
                  className="cursor-pointer"
                  onClick={() => onSelectFlight && onSelectFlight(2)}
                >
                  <rect
                    x={landingL_px}
                    y={flightW_px + wellGap_px}
                    width={f2.goingLengthM * scale}
                    height={flightW_px}
                    fill={activeFlightIndex === 2 ? '#0c4a6e' : '#0f172a'}
                    fillOpacity="0.7"
                    stroke="#0284c7"
                    strokeWidth="2"
                  />

                  {/* Flight 2 Treads Lines & Numbers */}
                  {Array.from({ length: f2.treadCount }).map((_, i) => {
                    const stepX = roomL_px - landingL_px - (i + 1) * tread_px;
                    return (
                      <g key={`f2_step_${i}`}>
                        <line
                          x1={stepX}
                          y1={flightW_px + wellGap_px}
                          x2={stepX}
                          y2={roomW_px}
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                        />
                        <text
                          x={stepX + tread_px / 2}
                          y={flightW_px + wellGap_px + flightW_px / 2 + 4}
                          fill="#7dd3fc"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {f1.riserCount + i + 1}
                        </text>
                      </g>
                    );
                  })}

                  {/* Flight 2 Direction Arrow (UP towards Floor Diaphragm) */}
                  <line
                    x1={roomL_px - landingL_px - 20}
                    y1={flightW_px + wellGap_px + flightW_px / 2}
                    x2={landingL_px + 20}
                    y2={flightW_px + wellGap_px + flightW_px / 2}
                    stroke="#10b981"
                    strokeWidth="3"
                    markerEnd="url(#arrowUp)"
                  />
                  <text
                    x={landingL_px + (f2.goingLengthM * scale) / 2}
                    y={flightW_px + wellGap_px + flightW_px / 2 - 10}
                    fill="#10b981"
                    fontSize="10"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    UP (Flight 2 → Diaphragm EL. +{storeyDesign.topElevationY.toFixed(2)}m)
                  </text>
                </g>

                {/* ===================================================================== */}
                {/* DUAL-SIDE LANDING ENTRY / EXIT DOORS                                  */}
                {/* ===================================================================== */}

                {/* 1. LEFT SIDE DOOR ENTRY (Top-Left of Landing) */}
                {entry.hasLeftDoor && (
                  <g transform={`translate(${landingL_px / 2 - (entry.leftDoorWidthM * scale) / 2}, ${-wall_px})`}>
                    {/* Wall Opening Cut */}
                    <rect
                      x="0"
                      y="0"
                      width={entry.leftDoorWidthM * scale}
                      height={wall_px}
                      fill="#020617"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    {/* Door Leaf */}
                    <line
                      x1="0"
                      y1={wall_px}
                      x2="0"
                      y2={wall_px + (entry.leftDoorWidthM * scale)}
                      stroke="#f59e0b"
                      strokeWidth="3"
                    />
                    {/* Door Swing Arc */}
                    <path
                      d={`M 0 ${wall_px + (entry.leftDoorWidthM * scale)} A ${entry.leftDoorWidthM * scale} ${entry.leftDoorWidthM * scale} 0 0 1 ${entry.leftDoorWidthM * scale} ${wall_px}`}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                    />
                    <text
                      x={(entry.leftDoorWidthM * scale) / 2}
                      y="-12"
                      fill="#fbbf24"
                      fontSize="9.5"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      🚪 LEFT ENTRY ({entry.leftDoorWidthM.toFixed(2)}m)
                    </text>
                  </g>
                )}

                {/* 2. RIGHT SIDE DOOR ENTRY (Bottom-Left of Landing) */}
                {entry.hasRightDoor && (
                  <g transform={`translate(${landingL_px / 2 - (entry.rightDoorWidthM * scale) / 2}, ${roomW_px})`}>
                    {/* Wall Opening Cut */}
                    <rect
                      x="0"
                      y="0"
                      width={entry.rightDoorWidthM * scale}
                      height={wall_px}
                      fill="#020617"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    {/* Door Leaf */}
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2={-(entry.rightDoorWidthM * scale)}
                      stroke="#f59e0b"
                      strokeWidth="3"
                    />
                    {/* Door Swing Arc */}
                    <path
                      d={`M 0 ${-(entry.rightDoorWidthM * scale)} A ${entry.rightDoorWidthM * scale} ${entry.rightDoorWidthM * scale} 0 0 0 ${entry.rightDoorWidthM * scale} 0`}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                    />
                    <text
                      x={(entry.rightDoorWidthM * scale) / 2}
                      y={wall_px + 22}
                      fill="#fbbf24"
                      fontSize="9.5"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      🚪 RIGHT ENTRY ({entry.rightDoorWidthM.toFixed(2)}m)
                    </text>
                  </g>
                )}

                {/* 3. FRONT / MAIN CORRIDOR ENTRY (Far Left Wall) */}
                {entry.hasFrontDoor && (
                  <g transform={`translate(${-wall_px}, ${roomW_px / 2 - (entry.frontDoorWidthM * scale) / 2})`}>
                    <rect
                      x="0"
                      y="0"
                      width={wall_px}
                      height={entry.frontDoorWidthM * scale}
                      fill="#020617"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    <line
                      x1={wall_px}
                      y1="0"
                      x2={wall_px + (entry.frontDoorWidthM * scale)}
                      y2="0"
                      stroke="#38bdf8"
                      strokeWidth="3"
                    />
                    <path
                      d={`M ${wall_px + (entry.frontDoorWidthM * scale)} 0 A ${entry.frontDoorWidthM * scale} ${entry.frontDoorWidthM * scale} 0 0 1 ${wall_px} ${entry.frontDoorWidthM * scale}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                    />
                    <text
                      x="-15"
                      y={(entry.frontDoorWidthM * scale) / 2}
                      fill="#38bdf8"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="end"
                      transform={`rotate(-90, -15, ${(entry.frontDoorWidthM * scale) / 2})`}
                    >
                      CORRIDOR ({entry.frontDoorWidthM.toFixed(2)}m)
                    </text>
                  </g>
                )}

                {/* 4. MID-LANDING EXTERIOR BALCONY/EXIT (Far Right Wall) */}
                {entry.hasMidLandingExit && (
                  <g transform={`translate(${roomL_px}, ${roomW_px / 2 - (entry.midLandingExitWidthM * scale) / 2})`}>
                    <rect
                      x="0"
                      y="0"
                      width={wall_px}
                      height={entry.midLandingExitWidthM * scale}
                      fill="#020617"
                      stroke="#10b981"
                      strokeWidth="2"
                    />
                    <text
                      x={wall_px + 10}
                      y={(entry.midLandingExitWidthM * scale) / 2 + 3}
                      fill="#34d399"
                      fontSize="8.5"
                      fontWeight="bold"
                    >
                      EXT. EXIT ({entry.midLandingExitWidthM.toFixed(2)}m)
                    </text>
                  </g>
                )}

                {/* ================= DIMENSION STRINGS ================= */}
                {/* Horizontal Room Dimension (Top) */}
                <g transform={`translate(0, ${-wall_px - 35})`}>
                  <line x1="0" y1="0" x2={roomL_px} y2="0" stroke="#64748b" strokeWidth="1.5" markerStart="url(#arrowDim)" markerEnd="url(#arrowDim)" />
                  <text x={roomL_px / 2} y="-6" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">
                    Room Length L = {geom.roomLength.toFixed(2)} m ({roomL_px.toFixed(0)}px)
                  </text>
                </g>

                {/* Vertical Room Dimension (Right) */}
                <g transform={`translate(${roomL_px + wall_px + 30}, 0)`}>
                  <line x1="0" y1="0" x2="0" y2={roomW_px} stroke="#64748b" strokeWidth="1.5" markerStart="url(#arrowDim)" markerEnd="url(#arrowDim)" />
                  <text
                    x="16"
                    y={roomW_px / 2}
                    fill="#f8fafc"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                    transform={`rotate(90, 16, ${roomW_px / 2})`}
                  >
                    Room Width B = {geom.roomWidth.toFixed(2)} m
                  </text>
                </g>

                {/* Flight Width Dimension */}
                <g transform={`translate(${landingL_px + 10}, 0)`}>
                  <line x1="0" y1="0" x2="0" y2={flightW_px} stroke="#e2e8f0" strokeWidth="1.2" />
                  <text x="5" y={flightW_px / 2 + 3} fill="#e2e8f0" fontSize="9" fontWeight="bold">
                    W = {geom.flightWidthM.toFixed(2)}m
                  </text>
                </g>
              </g>
            )}

            {/* ========================================================================= */}
            {/* 2. SECTION & REINFORCEMENT DETAILING VIEW (IS 456 / SP:34)                */}
            {/* ========================================================================= */}
            {(viewMode === 'SECTION' || viewMode === 'BOTH') && (
              <g transform={viewMode === 'BOTH' ? 'translate(800, 120)' : 'translate(100, 120)'}>
                <text x="0" y="-55" fill="#f8fafc" fontSize="14" fontWeight="bold" fontFamily="monospace">
                  CROSS-SECTIONAL ELEVATION &amp; REBAR DETAILING (IS 456 / SP:34)
                </text>
                <text x="0" y="-38" fill="#94a3b8" fontSize="11" fontFamily="monospace">
                  Waist Slab t_w: {f1.waistSlabThicknessMm}mm | Effective Span: {f1.effectiveSpanLeffM.toFixed(2)}m | Mu: {f1.designMomentMu} kNm
                </text>

                {/* Drawing Waist Slab Inclined Cross-Section */}
                {(() => {
                  const sScale = 120;
                  const landL = geom.landingWidthM * sScale; // 144px
                  const goingL = f1.goingLengthM * sScale; // 240px
                  const riseH = f1.flightRiseM * sScale; // 192px
                  const tw = (f1.waistSlabThicknessMm / 1000) * sScale; // 19.2px
                  const treadS = (geom.treadMm / 1000) * sScale;
                  const riserS = (f1.riserMm / 1000) * sScale;

                  const startX = 0;
                  const startY = 320;

                  // Build Steps Polygon Path
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
                  // Final riser to mid-landing
                  curY -= riserS;
                  stepsPath += ` L ${curX} ${curY}`;
                  stepsPath += ` L ${curX + landL} ${curY}`; // Top Mid-Landing

                  // Bottom thickness offset path
                  stepsPath += ` L ${curX + landL} ${curY + tw}`;
                  stepsPath += ` L ${curX} ${curY + tw}`;
                  stepsPath += ` L ${startX + landL} ${startY + tw}`;
                  stepsPath += ` L ${startX} ${startY + tw}`;
                  stepsPath += ' Z';

                  return (
                    <g>
                      {/* Concrete Waist Slab & Steps Hatch */}
                      <path
                        d={stepsPath}
                        fill="url(#concreteHatch)"
                        stroke="#64748b"
                        strokeWidth="2"
                      />

                      {/* Bottom Main Tension Rebar (Orange) with Kink Detailing */}
                      <path
                        d={`M ${startX + 10} ${startY + tw - 6} L ${startX + landL + 25} ${startY + tw - 6} L ${curX + landL - 10} ${curY + tw - 6}`}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="3.5"
                      />

                      {/* Kink Cross-Over Tension Bar extending into far face (IS 13920 / SP:34) */}
                      <path
                        d={`M ${startX + landL - 25} ${startY + 6} L ${startX + landL + 40} ${startY + tw - 6}`}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="2.5"
                        strokeDasharray="4,2"
                      />

                      {/* Top Negative Reinforcement at Supports (Purple) */}
                      <path
                        d={`M ${startX + 10} ${startY + 6} L ${startX + landL + (goingL * 0.25)} ${startY + 6}`}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2.5"
                      />
                      <path
                        d={`M ${curX - (goingL * 0.25)} ${curY + 6} L ${curX + landL - 10} ${curY + 6}`}
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2.5"
                      />

                      {/* Transverse Distribution Rebar Dots (Cyan Dots) */}
                      {Array.from({ length: 8 }).map((_, i) => {
                        const dotX = startX + landL + (i * goingL) / 7;
                        const dotY = startY + tw - 12 - (i * riseH) / 7;
                        return (
                          <circle
                            key={`dist_dot_${i}`}
                            cx={dotX}
                            cy={dotY}
                            r="3"
                            fill="#06b6d4"
                            stroke="#083344"
                            strokeWidth="0.8"
                          />
                        );
                      })}

                      {/* Elevation Level Markers */}
                      {/* 1. Base Floor Diaphragm */}
                      <g transform={`translate(${startX - 20}, ${startY})`}>
                        <line x1="-40" y1="0" x2="60" y2="0" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4,2" />
                        <text x="-45" y="4" fill="#a5b4fc" fontSize="10" fontWeight="bold" textAnchor="end">
                          FLOOR DIAPHRAGM EL. +{storeyDesign.bottomElevationY.toFixed(2)}m
                        </text>
                      </g>

                      {/* 2. Mid-Landing Elevation */}
                      <g transform={`translate(${curX + landL + 20}, ${curY})`}>
                        <line x1="-60" y1="0" x2="40" y2="0" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4,2" />
                        <text x="45" y="4" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="start">
                          MID-LANDING EL. +{storeyDesign.midLandingElevationY.toFixed(2)}m
                        </text>
                      </g>

                      {/* Rebar Annotation Callouts */}
                      <g transform={`translate(${startX + landL + 40}, ${startY + tw + 35})`}>
                        <text x="0" y="0" fill="#f97316" fontSize="10.5" fontWeight="bold">
                          ● Main Rebar: {f1.mainRebarCallout}
                        </text>
                        <text x="0" y="16" fill="#06b6d4" fontSize="10">
                          ● Distribution: {f1.distributionRebarCallout}
                        </text>
                        <text x="0" y="32" fill="#a855f7" fontSize="10">
                          ● Top Support Negative Steel: {f1.topNegativeRebarCallout}
                        </text>
                        <text x="0" y="48" fill="#10b981" fontSize="9.5" fontWeight="bold">
                          ● Kink Detailing: {f1.kinkAnchorageDetail.split('(')[0]}
                        </text>
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
          <span>Storey Total: <strong className="text-amber-300 font-bold">{storeyDesign.totalStoreyConcreteM3} m³</strong> ({storeyDesign.totalStoreyCementBags} bags)</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">Headroom Clearance:</span>
          <span className="text-emerald-400 font-bold">{f1.headroomM} m (NBC $\ge 2.20$m Safe)</span>
        </div>
      </div>
    </div>
  );
};
