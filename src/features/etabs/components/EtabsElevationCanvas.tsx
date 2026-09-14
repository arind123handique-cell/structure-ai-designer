import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Tag,
  TrendingUp,
  Activity,
  ArrowLeft,
  Columns,
  Grid,
} from 'lucide-react';
import { NormalizedStructuralModel } from '@/features/model/types';
import { FrameElevationEngine, FrameElevationData } from '../frameElevationEngine';

interface EtabsElevationCanvasProps {
  model: NormalizedStructuralModel | null;
  selectedGridId: string;
  onChangeGridId: (gridId: string) => void;
  diagramType: 'NONE' | 'BMD' | 'SFD';
  onSetDiagramType: (type: 'NONE' | 'BMD' | 'SFD') => void;
  onBackToPlan: () => void;
  selectedMemberId: number | null;
  onSelectMember: (memberId: number | null) => void;
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number | null) => void;
}

export const EtabsElevationCanvas: React.FC<EtabsElevationCanvasProps> = React.memo(({
  model,
  selectedGridId,
  onChangeGridId,
  diagramType,
  onSetDiagramType,
  onBackToPlan,
  selectedMemberId,
  onSelectMember,
  selectedNodeId,
  onSelectNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Available grids in model
  const availableGrids = useMemo(() => {
    return FrameElevationEngine.getAvailableGrids(model);
  }, [model]);

  // Extract 2D elevation frame data
  const frameData: FrameElevationData | null = useMemo(() => {
    return FrameElevationEngine.extractFrameElevation(model, selectedGridId);
  }, [model, selectedGridId]);

  // Canvas pan & zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(35); // pixels per meter
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showLabels, setShowLabels] = useState(true);

  // Auto-fit frame to container
  const autoFitView = useCallback(() => {
    if (!containerRef.current || !frameData) return;
    const rect = containerRef.current.getBoundingClientRect();
    const bounds = frameData.bounds;

    const padX = 140;
    const padY = 120;
    const availableW = Math.max(100, rect.width - padX * 2);
    const availableH = Math.max(100, rect.height - padY * 2);

    const frameW = Math.max(2, bounds.width);
    const frameH = Math.max(2, bounds.height);

    const fitScale = Math.max(15, Math.min(80, Math.min(availableW / frameW, availableH / frameH)));
    const centerH = (bounds.minH + bounds.maxH) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    setScale(fitScale);
    setPan({
      x: rect.width / 2 - centerH * fitScale,
      // Screen Y = pan.y - Y * scale, so center is at pan.y - centerY * scale
      y: rect.height / 2 + centerY * fitScale,
    });
  }, [frameData]);

  // Fit view when frame data changes
  useEffect(() => {
    autoFitView();
  }, [selectedGridId, model?.statistics.totalMembers, autoFitView]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Mouse wheel zoom anchored at cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.max(10, Math.min(180, scale * zoomFactor));

    setPan({
      x: mouseX - (mouseX - pan.x) * (newScale / scale),
      y: mouseY - (mouseY - pan.y) * (newScale / scale),
    });
    setScale(newScale);
  };

  if (!frameData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 font-mono">
        <Columns className="w-10 h-10 text-indigo-400 mb-2" />
        <p>No frame data found for grid {selectedGridId}.</p>
        <button
          onClick={onBackToPlan}
          className="mt-3 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs"
        >
          Back to Plan View
        </button>
      </div>
    );
  }

  const { gridLine, columns, beams, supports, intersectingGrids, storeyElevations, bayDimensions, bounds } = frameData;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden bg-slate-950 font-mono"
      onWheel={handleWheel}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Controls: Return to Plan + Grid Line Selector */}
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 border border-slate-700 px-2.5 py-1.5 rounded-lg shadow-xl backdrop-blur-xs">
          {/* Back to Plan View Button */}
          <button
            onClick={onBackToPlan}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs shadow-md transition-all"
            title="Return to 2D Floor Plan Framing Studio"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Plan View</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Grid Line Dropdown Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <Grid className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-slate-400 uppercase font-bold">Elevation:</span>
            <select
              value={selectedGridId}
              onChange={(e) => onChangeGridId(e.target.value)}
              className="bg-slate-950 text-amber-300 font-bold border border-slate-700 rounded px-2 py-0.5 text-xs focus:outline-hidden cursor-pointer"
            >
              {availableGrids.map((g) => (
                <option key={`${g.axis}-${g.id}`} value={g.id} className="bg-slate-900 text-white">
                  {g.label} ({g.axis}={g.coord.toFixed(2)}m)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Controls: Diagram Type (BMD/SFD) + Labels + Zoom */}
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 border border-slate-700 px-2.5 py-1.5 rounded-lg shadow-xl backdrop-blur-xs">
          {/* Diagram Type Selector */}
          <div className="flex items-center bg-slate-950 rounded p-0.5 border border-slate-800 text-[10px]">
            <button
              onClick={() => onSetDiagramType('NONE')}
              className={`px-2 py-1 rounded font-bold transition-colors ${
                diagramType === 'NONE' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Frame
            </button>
            <button
              onClick={() => onSetDiagramType('BMD')}
              className={`px-2 py-1 rounded font-bold transition-colors flex items-center gap-1 ${
                diagramType === 'BMD'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
              title="Display Vertical Bending Moment Diagram (Mz)"
            >
              <TrendingUp className="w-3 h-3" />
              <span>BMD (Mz)</span>
            </button>
            <button
              onClick={() => onSetDiagramType('SFD')}
              className={`px-2 py-1 rounded font-bold transition-colors flex items-center gap-1 ${
                diagramType === 'SFD'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
              title="Display Vertical Shear Force Diagram (Vy)"
            >
              <Activity className="w-3 h-3" />
              <span>SFD (Vy)</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Labels Toggle */}
          <button
            onClick={() => setShowLabels((p) => !p)}
            className={`p-1 rounded font-bold flex items-center gap-1 text-[11px] px-2 border transition-colors ${
              showLabels
                ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Toggle Member & Dimension Labels"
          >
            <Tag className="w-3 h-3" />
            <span>Labels {showLabels ? 'ON' : 'OFF'}</span>
          </button>

          <div className="h-4 w-px bg-slate-700" />

          {/* Zoom Buttons */}
          <button
            onClick={() => setScale((s) => Math.min(180, s * 1.2))}
            className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(10, s * 0.8))}
            className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={autoFitView}
            className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold flex items-center gap-1 text-[11px] px-2 shadow-md"
            title="Auto-Fit Elevation Frame"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Fit Extents</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <defs>
          <pattern id="etabs_elevation_grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
          </pattern>
          {/* Ground Hatch Pattern */}
          <pattern id="ground_hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#475569" strokeWidth="1.2" />
          </pattern>
        </defs>

        {/* Canvas Background Grid */}
        <rect width="100%" height="100%" fill="#090d16" />
        <rect width="100%" height="100%" fill="url(#etabs_elevation_grid)" />

        {/* Main Transformed Elevation Group */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* 1. Ground Level Baseline & Hatching */}
          <g>
            <line
              x1={bounds.minH - 3.5}
              y1={0}
              x2={bounds.maxH + 3.5}
              y2={0}
              stroke="#64748b"
              strokeWidth={0.08}
            />
            {/* Ground Soil Hatch under Base (Y=0) */}
            <rect
              x={bounds.minH - 3.5}
              y={0}
              width={bounds.width + 7}
              height={1.0}
              fill="url(#ground_hatch)"
              opacity="0.4"
            />
          </g>

          {/* 2. Storey Elevation Datum Lines & Level Flags */}
          {storeyElevations.map((lvl) => {
            const yPos = -lvl.y;
            return (
              <g key={`lvl-${lvl.y}`}>
                {/* Horizontal Datum Line */}
                <line
                  x1={bounds.minH - 2.8}
                  y1={yPos}
                  x2={bounds.maxH + 2.0}
                  y2={yPos}
                  stroke="#334155"
                  strokeWidth={0.03}
                  strokeDasharray="0.3,0.15"
                />

                {/* Left Storey Level Flag */}
                <g transform={`translate(${bounds.minH - 3.2}, ${yPos})`}>
                  {/* Flag Tag Pill */}
                  <rect
                    x="-2.6"
                    y="-0.22"
                    width="2.5"
                    height="0.44"
                    fill="#0f172a"
                    rx="0.08"
                    stroke="#475569"
                    strokeWidth={0.02}
                  />
                  <text
                    x="-1.35"
                    y="0.07"
                    fill="#38bdf8"
                    fontSize="0.2"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {lvl.label} (+{lvl.y.toFixed(2)}m)
                  </text>
                  {/* Triangle Pointer pointing to the datum line */}
                  <polygon points="0,0 -0.1,-0.12 -0.1,0.12" fill="#38bdf8" />
                </g>
              </g>
            );
          })}

          {/* 3. Intersecting Vertical Grid Lines & Bubbles */}
          {intersectingGrids.map((ig) => {
            const h = ig.coord;
            const topY = -bounds.maxY - 1.2;
            const botY = 0.8;
            return (
              <g key={`ig-${ig.id}`}>
                {/* Vertical Grid Datum Line */}
                <line
                  x1={h}
                  y1={topY}
                  x2={h}
                  y2={botY}
                  stroke="#475569"
                  strokeWidth={0.03}
                  strokeDasharray="0.3,0.15"
                />

                {/* Top Grid Bubble */}
                <g transform={`translate(${h}, ${topY})`}>
                  <circle cx="0" cy="0" r="0.4" fill="#0f172a" stroke="#f59e0b" strokeWidth={0.05} />
                  <text x="0" y="0.12" fill="#fef08a" fontSize="0.3" fontWeight="bold" textAnchor="middle">
                    {ig.label}
                  </text>
                </g>

                {/* Bottom Grid Bubble */}
                <g transform={`translate(${h}, ${botY})`}>
                  <circle cx="0" cy="0" r="0.4" fill="#0f172a" stroke="#f59e0b" strokeWidth={0.05} />
                  <text x="0" y="0.12" fill="#fef08a" fontSize="0.3" fontWeight="bold" textAnchor="middle">
                    {ig.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 4. Inter-Grid Bay Dimensions */}
          {bayDimensions.map((dim, idx) => {
            const dimY = 1.6;
            return (
              <g key={`bay-${idx}`}>
                {/* Horizontal Dimension Line */}
                <line
                  x1={dim.startH}
                  y1={dimY}
                  x2={dim.endH}
                  y2={dimY}
                  stroke="#94a3b8"
                  strokeWidth={0.03}
                />
                {/* End Ticks */}
                <line
                  x1={dim.startH}
                  y1={dimY - 0.2}
                  x2={dim.startH}
                  y2={dimY + 0.2}
                  stroke="#94a3b8"
                  strokeWidth={0.03}
                />
                <line
                  x1={dim.endH}
                  y1={dimY - 0.2}
                  x2={dim.endH}
                  y2={dimY + 0.2}
                  stroke="#94a3b8"
                  strokeWidth={0.03}
                />
                {/* Dimension Text Pill */}
                <g transform={`translate(${(dim.startH + dim.endH) / 2}, ${dimY})`}>
                  <rect
                    x="-0.65"
                    y="-0.2"
                    width="1.3"
                    height="0.4"
                    fill="#0f172a"
                    rx="0.06"
                    stroke="#475569"
                    strokeWidth={0.02}
                  />
                  <text
                    x="0"
                    y="0.08"
                    fill="#cbd5e1"
                    fontSize="0.22"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {dim.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 5. Base Column Supports */}
          {supports.map((sup) => (
            <g
              key={`sup-${sup.nodeId}`}
              transform={`translate(${sup.h}, 0)`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(sup.nodeId);
              }}
              className="cursor-pointer group"
            >
              {sup.type === 'FIXED' ? (
                /* Fixed Support Block */
                <g>
                  <rect
                    x="-0.35"
                    y="0"
                    width="0.7"
                    height="0.25"
                    fill="#1e293b"
                    stroke="#38bdf8"
                    strokeWidth={0.04}
                  />
                  <line x1="-0.45" y1="0.25" x2="0.45" y2="0.25" stroke="#38bdf8" strokeWidth={0.06} />
                </g>
              ) : (
                /* Pinned Triangle Support */
                <g>
                  <polygon
                    points="0,0 -0.3,0.3 0.3,0.3"
                    fill="#1e293b"
                    stroke="#38bdf8"
                    strokeWidth={0.04}
                  />
                  <line x1="-0.4" y1="0.3" x2="0.4" y2="0.3" stroke="#38bdf8" strokeWidth={0.06} />
                </g>
              )}
            </g>
          ))}

          {/* 6. Columns (Multi-Storey Vertical Members) */}
          {columns.map((col) => {
            const isSelected = selectedMemberId === col.memberId;
            const colW = Math.max(0.3, col.width);
            const yTop = -col.yTop;
            const yBot = -col.yBottom;
            const height = Math.abs(yBot - yTop);

            // Column Moment Diagram Offset Scale
            const bmdOffsetTop = Math.min(0.7, Math.max(0.12, (col.topMoment / 80) * 0.5));
            const bmdOffsetBot = Math.min(0.7, Math.max(0.12, (col.botMoment / 80) * 0.5));
            const sfdOffset = Math.min(0.5, Math.max(0.12, (col.maxShear / 60) * 0.4));

            return (
              <g
                key={`col-${col.memberId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMember(col.memberId);
                }}
                className="cursor-pointer group"
              >
                {/* Concrete Column Solid Body */}
                <rect
                  x={col.h - colW / 2}
                  y={yTop}
                  width={colW}
                  height={height}
                  fill={isSelected ? '#312e81' : '#1e293b'}
                  stroke={isSelected ? '#f59e0b' : '#38bdf8'}
                  strokeWidth={isSelected ? 0.08 : 0.04}
                />

                {/* Column Centerline */}
                <line
                  x1={col.h}
                  y1={yTop}
                  x2={col.h}
                  y2={yBot}
                  stroke="#475569"
                  strokeWidth={0.02}
                  strokeDasharray="0.2,0.1"
                />

                {/* Column Bending Moment Diagram (BMD) Overlay */}
                {diagramType === 'BMD' && (
                  <g pointerEvents="none">
                    {/* Trapezoidal Moment Shape along column height */}
                    <polygon
                      points={`${col.h},${yTop} ${col.h + bmdOffsetTop},${yTop} ${col.h - bmdOffsetBot},${yBot} ${col.h},${yBot}`}
                      fill="rgba(245, 158, 11, 0.25)"
                      stroke="#f59e0b"
                      strokeWidth={0.03}
                    />
                    {/* Top Moment Value Badge */}
                    <rect
                      x={col.h + bmdOffsetTop + 0.1}
                      y={yTop + 0.1}
                      width="0.9"
                      height="0.3"
                      fill="#0f172a"
                      rx="0.05"
                      stroke="#f59e0b"
                      strokeWidth={0.02}
                    />
                    <text
                      x={col.h + bmdOffsetTop + 0.55}
                      y={yTop + 0.32}
                      fill="#fef08a"
                      fontSize="0.17"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {col.topMoment.toFixed(1)}kNm
                    </text>
                    {/* Bottom Moment Value Badge */}
                    <rect
                      x={col.h - bmdOffsetBot - 1.0}
                      y={yBot - 0.4}
                      width="0.9"
                      height="0.3"
                      fill="#0f172a"
                      rx="0.05"
                      stroke="#f59e0b"
                      strokeWidth={0.02}
                    />
                    <text
                      x={col.h - bmdOffsetBot - 0.55}
                      y={yBot - 0.18}
                      fill="#fef08a"
                      fontSize="0.17"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {col.botMoment.toFixed(1)}kNm
                    </text>
                  </g>
                )}

                {/* Column Shear Force Diagram (SFD) Overlay */}
                {diagramType === 'SFD' && (
                  <g pointerEvents="none">
                    <polygon
                      points={`${col.h},${yTop} ${col.h + sfdOffset},${yTop} ${col.h + sfdOffset},${yBot} ${col.h},${yBot}`}
                      fill="rgba(16, 185, 129, 0.25)"
                      stroke="#10b981"
                      strokeWidth={0.03}
                    />
                    <rect
                      x={col.h + sfdOffset + 0.1}
                      y={(yTop + yBot) / 2 - 0.15}
                      width="0.8"
                      height="0.3"
                      fill="#0f172a"
                      rx="0.05"
                      stroke="#10b981"
                      strokeWidth={0.02}
                    />
                    <text
                      x={col.h + sfdOffset + 0.5}
                      y={(yTop + yBot) / 2 + 0.07}
                      fill="#a7f3d0"
                      fontSize="0.17"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {col.maxShear.toFixed(1)}kN
                    </text>
                  </g>
                )}

                {/* Column Label */}
                {(showLabels || isSelected) && (
                  <g transform={`translate(${col.h}, ${(yTop + yBot) / 2})`}>
                    <rect
                      x="-0.3"
                      y="-0.15"
                      width="0.6"
                      height="0.3"
                      fill="#0f172a"
                      rx="0.05"
                      stroke="#475569"
                      strokeWidth={0.02}
                    />
                    <text
                      x="0"
                      y="0.07"
                      fill="#f8fafc"
                      fontSize="0.18"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {col.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 7. Beams (Horizontal Framing Members) */}
          {beams.map((beam) => {
            const isSelected = selectedMemberId === beam.memberId;
            const y = -beam.y;
            const beamD = Math.max(0.35, beam.depth);
            const midH = (beam.h1 + beam.h2) / 2;
            const spanL = beam.length;

            // Diagram Vertical Offsets
            // Midspan sagging moment (+M) drawn downwards in elevation (positive Y in SVG coordinate space)
            const momentSagOffset = Math.min(1.4, Math.max(0.35, (beam.spanMoment / 100) * 1.6));
            // Support hogging moment (-M) drawn upwards at column joints (negative Y in SVG coordinate space)
            const momentHogOffset1 = Math.min(1.0, Math.max(0.25, (beam.supMoment1 / 100) * 1.2));
            const momentHogOffset2 = Math.min(1.0, Math.max(0.25, (beam.supMoment2 / 100) * 1.2));

            // Shear offsets
            const shearOffset = Math.min(0.9, Math.max(0.25, (beam.maxShear / 80) * 1.2));

            return (
              <g
                key={`beam-${beam.memberId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMember(beam.memberId);
                }}
                className="cursor-pointer group"
              >
                {/* Concrete Beam Body (drawn slightly below level line to represent drop) */}
                <rect
                  x={beam.h1}
                  y={y}
                  width={spanL}
                  height={beamD}
                  fill={isSelected ? '#312e81' : '#1e293b'}
                  stroke={isSelected ? '#f59e0b' : '#38bdf8'}
                  strokeWidth={isSelected ? 0.08 : 0.04}
                />

                {/* 2D Elevation Bending Moment Diagram (BMD Mz) Overlay */}
                {diagramType === 'BMD' && (
                  <g pointerEvents="none">
                    {/* Parabolic Bending Moment Curve with Support Hogging & Span Sagging */}
                    <path
                      d={`M ${beam.h1} ${y - momentHogOffset1} Q ${beam.h1 + spanL * 0.15} ${y} ${beam.h1 + spanL * 0.25} ${y + momentSagOffset * 0.6} Q ${midH} ${y + momentSagOffset} ${beam.h2 - spanL * 0.25} ${y + momentSagOffset * 0.6} Q ${beam.h2 - spanL * 0.15} ${y} ${beam.h2} ${y - momentHogOffset2} L ${beam.h2} ${y} L ${beam.h1} ${y} Z`}
                      fill="rgba(245, 158, 11, 0.35)"
                      stroke="#f59e0b"
                      strokeWidth={0.04}
                    />

                    {/* Midspan Sagging (+M) Value Tag */}
                    <g transform={`translate(${midH}, ${y + momentSagOffset + 0.25})`}>
                      <rect
                        x="-0.75"
                        y="-0.18"
                        width="1.5"
                        height="0.36"
                        fill="#0f172a"
                        rx="0.06"
                        stroke="#f59e0b"
                        strokeWidth={0.02}
                      />
                      <text
                        x="0"
                        y="0.08"
                        fill="#fef08a"
                        fontSize="0.2"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        +{beam.spanMoment.toFixed(1)} kNm
                      </text>
                    </g>

                    {/* Left Support Hogging (-M) Tag */}
                    <g transform={`translate(${beam.h1 + 0.6}, ${y - momentHogOffset1 - 0.25})`}>
                      <rect
                        x="-0.65"
                        y="-0.16"
                        width="1.3"
                        height="0.32"
                        fill="#0f172a"
                        rx="0.06"
                        stroke="#f59e0b"
                        strokeWidth={0.02}
                      />
                      <text
                        x="0"
                        y="0.08"
                        fill="#fde047"
                        fontSize="0.18"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        -{beam.supMoment1.toFixed(1)} kNm
                      </text>
                    </g>

                    {/* Right Support Hogging (-M) Tag */}
                    <g transform={`translate(${beam.h2 - 0.6}, ${y - momentHogOffset2 - 0.25})`}>
                      <rect
                        x="-0.65"
                        y="-0.16"
                        width="1.3"
                        height="0.32"
                        fill="#0f172a"
                        rx="0.06"
                        stroke="#f59e0b"
                        strokeWidth={0.02}
                      />
                      <text
                        x="0"
                        y="0.08"
                        fill="#fde047"
                        fontSize="0.18"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        -{beam.supMoment2.toFixed(1)} kNm
                      </text>
                    </g>
                  </g>
                )}

                {/* 2D Elevation Shear Force Diagram (SFD Vy) Overlay */}
                {diagramType === 'SFD' && (
                  <g pointerEvents="none">
                    {/* Left Positive Shear Block (+V drawn above beam line) */}
                    <polygon
                      points={`${beam.h1},${y} ${beam.h1},${y - shearOffset} ${midH},${y - shearOffset} ${midH},${y}`}
                      fill="rgba(16, 185, 129, 0.35)"
                      stroke="#10b981"
                      strokeWidth={0.04}
                    />
                    {/* Right Negative Shear Block (-V drawn below beam line) */}
                    <polygon
                      points={`${midH},${y + beamD} ${midH},${y + beamD + shearOffset} ${beam.h2},${y + beamD + shearOffset} ${beam.h2},${y + beamD}`}
                      fill="rgba(16, 185, 129, 0.35)"
                      stroke="#10b981"
                      strokeWidth={0.04}
                    />

                    {/* Left Shear Badge */}
                    <g transform={`translate(${beam.h1 + spanL * 0.25}, ${y - shearOffset - 0.22})`}>
                      <rect
                        x="-0.65"
                        y="-0.16"
                        width="1.3"
                        height="0.32"
                        fill="#0f172a"
                        rx="0.06"
                        stroke="#10b981"
                        strokeWidth={0.02}
                      />
                      <text
                        x="0"
                        y="0.08"
                        fill="#a7f3d0"
                        fontSize="0.18"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        +{beam.maxShear.toFixed(1)} kN
                      </text>
                    </g>

                    {/* Right Shear Badge */}
                    <g transform={`translate(${beam.h2 - spanL * 0.25}, ${y + beamD + shearOffset + 0.22})`}>
                      <rect
                        x="-0.65"
                        y="-0.16"
                        width="1.3"
                        height="0.32"
                        fill="#0f172a"
                        rx="0.06"
                        stroke="#10b981"
                        strokeWidth={0.02}
                      />
                      <text
                        x="0"
                        y="0.08"
                        fill="#a7f3d0"
                        fontSize="0.18"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        -{beam.maxShear.toFixed(1)} kN
                      </text>
                    </g>
                  </g>
                )}

                {/* Beam Label Pill */}
                {(showLabels || isSelected) && (
                  <g transform={`translate(${midH}, ${y + beamD / 2})`}>
                    <rect
                      x="-0.5"
                      y="-0.15"
                      width="1.0"
                      height="0.3"
                      fill="#0f172a"
                      rx="0.05"
                      stroke="#475569"
                      strokeWidth={0.02}
                    />
                    <text
                      x="0"
                      y="0.07"
                      fill="#f8fafc"
                      fontSize="0.18"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {beam.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Bottom Status Information */}
      <div className="absolute bottom-3 left-3 z-10 bg-slate-900/95 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs text-slate-300 shadow-2xl flex items-center gap-4 backdrop-blur-xs">
        <span className="text-amber-300 font-bold">
          2D Elevation Frame: {gridLine.label} ({gridLine.axis} = {gridLine.coord.toFixed(2)}m)
        </span>
        <span>•</span>
        <span className="text-slate-400">
          Beams: <strong className="text-white">{beams.length}</strong> | Columns: <strong className="text-white">{columns.length}</strong>
        </span>
        <span>•</span>
        <span className="text-slate-400 text-[11px]">
          {diagramType === 'BMD' && 'Showing Bending Moment Diagram (Mz in kNm) in vertical elevation plane'}
          {diagramType === 'SFD' && 'Showing Shear Force Diagram (Vy in kN) in vertical elevation plane'}
          {diagramType === 'NONE' && 'Click columns or beams to inspect properties. Mouse drag to pan, wheel to zoom.'}
        </span>
      </div>
    </div>
  );
});
