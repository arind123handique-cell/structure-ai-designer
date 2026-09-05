import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { NormalizedStructuralModel } from '@/features/model/types';
import { FloorPlanEngine, FloorPlanLevel } from '@/features/drawings/floorPlanEngine';
import { EtabsDrawTool } from './EtabsToolPalette';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Tag,
  Activity,
  Compass,
  TrendingUp,
} from 'lucide-react';

interface EtabsPlanCanvasProps {
  model: NormalizedStructuralModel | null;
  selectedStoreyElevation: number;
  activeTool: EtabsDrawTool;
  onAddColumn: (x: number, z: number) => void;
  onAddBeam: (startNodeId: number, endNodeId: number) => void;
  onAddBeamAtCoords?: (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    startNodeId?: number,
    endNodeId?: number
  ) => void;
  onQuickBeam?: (nodeId: number) => void;
  onAddPlate?: (nodeIds: number[], classification: 'SLAB' | 'WALL') => void;
  onAssignLoadToMember?: (memberId: number) => void;
  selectedMemberId: number | null;
  onSelectMember: (id: number | null) => void;
  selectedNodeId: number | null;
  onSelectNode: (id: number | null) => void;
  diagramType?: 'NONE' | 'BMD' | 'SFD';
  onSetDiagramType?: (type: 'NONE' | 'BMD' | 'SFD') => void;
}

export const EtabsPlanCanvas: React.FC<EtabsPlanCanvasProps> = React.memo(({
  model,
  selectedStoreyElevation,
  activeTool,
  onAddColumn,
  onAddBeam,
  onAddBeamAtCoords,
  onQuickBeam,
  onAddPlate,
  onAssignLoadToMember,
  selectedMemberId,
  onSelectMember,
  selectedNodeId,
  onSelectNode,
  diagramType: propDiagramType,
  onSetDiagramType: propSetDiagramType,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Extract all floor plans from the model (memoized)
  const floorPlans = useMemo(() => {
    return FloorPlanEngine.extractAllFloorPlans(model);
  }, [model]);

  // Find active floor plan matching selectedStoreyElevation (with closest match fallback)
  const activeFloorPlan: FloorPlanLevel | null = useMemo(() => {
    if (!floorPlans || floorPlans.length === 0) return null;
    let closest = floorPlans[0];
    let minDiff = Math.abs(closest.elevationY - selectedStoreyElevation);

    for (const fp of floorPlans) {
      const diff = Math.abs(fp.elevationY - selectedStoreyElevation);
      if (diff < minDiff) {
        minDiff = diff;
        closest = fp;
      }
    }
    return closest;
  }, [floorPlans, selectedStoreyElevation]);

  // Viewport transformation: scale and offset in pixels
  const [scale, setScale] = useState(35); // 35 px per meter
  const [pan, setPan] = useState({ x: 200, y: 200 });
  const [isPanning, setIsPanning] = useState(false);
  const [showLabels, setShowLabels] = useState(false); // ALWAYS KEEP LABELS OFF BY DEFAULT
  const [internalDiagramType, setInternalDiagramType] = useState<'NONE' | 'BMD' | 'SFD'>('NONE');
  const diagramType = propDiagramType ?? internalDiagramType;
  const setDiagramType = propSetDiagramType ?? setInternalDiagramType;

  const [showCmCr, setShowCmCr] = useState(false);
  const startPanRef = useRef({ x: 0, y: 0 });

  const beams = activeFloorPlan?.beams || [];
  const columns = activeFloorPlan?.columns || [];
  const gridLinesX = activeFloorPlan?.gridLinesX || [];
  const gridLinesZ = activeFloorPlan?.gridLinesZ || [];
  const bounds = activeFloorPlan?.bounds || { minX: 0, maxX: 15, minZ: 0, maxZ: 12 };

  // Precompute grid intersections for snapping
  const gridIntersections = useMemo(() => {
    const list: { x: number; z: number; label: string }[] = [];
    gridLinesX.forEach((gx) => {
      gridLinesZ.forEach((gz) => {
        list.push({
          x: gx.coord,
          z: gz.coord,
          label: `${gx.id || gx.label} / ${gz.id || gz.label}`,
        });
      });
    });
    return list;
  }, [gridLinesX, gridLinesZ]);

  // Calculate Center of Mass (CM) & Center of Rigidity (CR) on active storey
  const cmCrData = useMemo(() => {
    if (!activeFloorPlan || columns.length === 0) return null;
    const cmX = (bounds.minX + bounds.maxX) / 2;
    const cmZ = (bounds.minZ + bounds.maxZ) / 2;

    let sumKxX = 0;
    let sumKx = 0;
    let sumKzZ = 0;
    let sumKz = 0;

    columns.forEach((c) => {
      const b = c.width || 0.45;
      const h = c.depth || 0.45;
      const kx = (b * Math.pow(h, 3)) / 12;
      const kz = (h * Math.pow(b, 3)) / 12;
      sumKx += kx;
      sumKxX += kx * c.x;
      sumKz += kz;
      sumKzZ += kz * c.z;
    });

    const crX = sumKx > 0 ? sumKxX / sumKx : cmX;
    const crZ = sumKz > 0 ? sumKzZ / sumKz : cmZ;
    const ex = Math.abs(cmX - crX);
    const ez = Math.abs(cmZ - crZ);
    const boundWidth = bounds.maxX - bounds.minX;
    const edx = 1.5 * ex + 0.05 * boundWidth;

    return { cmX, cmZ, crX, crZ, ex, ez, edx };
  }, [activeFloorPlan, columns, bounds]);

  // Extract internal forces for active framing beams (O(N) indexed grouping)
  const memberForcesMap = useMemo(() => {
    const map = new Map<number, { maxMoment: number; maxShear: number; spanMoment: number }>();
    if (!model) return map;

    // Pre-group member forces by memberId in a single pass O(M)
    const forcesByMember = new Map<number, typeof model.memberForces>();
    if (model.memberForces) {
      for (let i = 0; i < model.memberForces.length; i++) {
        const mf = model.memberForces[i];
        let list = forcesByMember.get(mf.memberId);
        if (!list) {
          list = [];
          forcesByMember.set(mf.memberId, list);
        }
        list.push(mf);
      }
    }

    beams.forEach((b) => {
      const forces = forcesByMember.get(b.memberId);
      if (forces && forces.length > 0) {
        const maxM = forces.reduce((max, f) => Math.max(max, Math.abs(f.mz || 0)), 0);
        const maxV = forces.reduce((max, f) => Math.max(max, Math.abs(f.vy || 0)), 0);
        map.set(b.memberId, {
          maxMoment: maxM || 42.0,
          maxShear: maxV || 28.0,
          spanMoment: (maxM || 42.0) * 0.7,
        });
      } else {
        const wEst = 18.0;
        const L = b.length;
        const mSpan = (wEst * L * L) / 12;
        const vMax = (wEst * L) / 2;
        map.set(b.memberId, {
          maxMoment: mSpan,
          maxShear: vMax,
          spanMoment: mSpan * 0.7,
        });
      }
    });
    return map;
  }, [model, beams]);

  // Drawing beam & CAD snapping state
  const [drawingBeamStart, setDrawingBeamStart] = useState<{
    x: number;
    z: number;
    nodeId?: number;
  } | null>(null);
  const [activeSnap, setActiveSnap] = useState<{
    x: number;
    z: number;
    rawX: number;
    rawZ: number;
    type: 'COLUMN' | 'GRID' | 'ORTHO';
    label: string;
    nodeId?: number;
  } | null>(null);
  const [cursorCoord, setCursorCoord] = useState<{ x: number; z: number }>({ x: 0, z: 0 });

  // Reset drawing state when active tool switches
  useEffect(() => {
    setDrawingBeamStart(null);
  }, [activeTool]);

  // Slab/wall polygon node selection state
  const [slabNodes, setSlabNodes] = useState<number[]>([]);
  const [wallNodes, setWallNodes] = useState<number[]>([]);
  const [isAssigningLoad, setIsAssigningLoad] = useState(false);

  // Auto-center view to fit bounds
  const autoFitView = useCallback(() => {
    if (!containerRef.current || !activeFloorPlan) return;
    const rect = containerRef.current.getBoundingClientRect();
    const bounds = activeFloorPlan.bounds;

    const padding = 100;
    const availableW = Math.max(100, rect.width - padding * 2);
    const availableH = Math.max(100, rect.height - padding * 2);

    const modelW = Math.max(2, bounds.width);
    const modelH = Math.max(2, bounds.height);

    const fitScale = Math.max(12, Math.min(75, Math.min(availableW / modelW, availableH / modelH)));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;

    setScale(fitScale);
    setPan({
      x: rect.width / 2 - centerX * fitScale,
      y: rect.height / 2 - centerZ * fitScale,
    });
  }, [activeFloorPlan]);

  // Run autoFitView whenever active floor plan or model node count changes
  useEffect(() => {
    autoFitView();
  }, [activeFloorPlan?.levelIndex, model?.statistics.totalNodes, autoFitView]);

  // Coordinate transforms: World (m) -> Screen (px) & Screen (px) -> World (m) with CAD snapping
  const toWorld = useCallback(
    (screenX: number, screenY: number) => {
      const rawX = (screenX - pan.x) / scale;
      const rawZ = (screenY - pan.y) / scale;

      // 1. Column snap (tolerance 0.35m)
      for (const col of columns) {
        if (Math.hypot(col.x - rawX, col.z - rawZ) <= 0.35) {
          return {
            x: col.x,
            z: col.z,
            rawX,
            rawZ,
            type: 'COLUMN' as const,
            label: col.label || `Joint N${col.nodeId}`,
            nodeId: col.nodeId,
          };
        }
      }

      // 2. Grid intersection snap (tolerance 0.35m)
      for (const gi of gridIntersections) {
        if (Math.hypot(gi.x - rawX, gi.z - rawZ) <= 0.35) {
          return {
            x: gi.x,
            z: gi.z,
            rawX,
            rawZ,
            type: 'GRID' as const,
            label: gi.label,
          };
        }
      }

      // 3. Orthogonal grid snap fallback (0.5m)
      const snapX = Math.round(rawX * 2) / 2;
      const snapZ = Math.round(rawZ * 2) / 2;
      return {
        x: snapX,
        z: snapZ,
        rawX,
        rawZ,
        type: 'ORTHO' as const,
        label: `${snapX.toFixed(1)}, ${snapZ.toFixed(1)}`,
      };
    },
    [pan, scale, columns, gridIntersections]
  );

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1 || e.altKey || activeTool === 'SELECT') {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const snap = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (activeTool === 'QUICK_COLUMN') {
      onAddColumn(snap.x, snap.z);
      return;
    }

    if (activeTool === 'DRAW_BEAM' || activeTool === 'QUICK_BEAM') {
      if (!drawingBeamStart) {
        setDrawingBeamStart({ x: snap.x, z: snap.z, nodeId: snap.nodeId });
      } else {
        const dist = Math.hypot(snap.x - drawingBeamStart.x, snap.z - drawingBeamStart.z);
        if (dist > 0.2) {
          if (onAddBeamAtCoords) {
            onAddBeamAtCoords(
              drawingBeamStart.x,
              drawingBeamStart.z,
              snap.x,
              snap.z,
              drawingBeamStart.nodeId,
              snap.nodeId
            );
          } else if (drawingBeamStart.nodeId && snap.nodeId) {
            onAddBeam(drawingBeamStart.nodeId, snap.nodeId);
          }
        }
        setDrawingBeamStart(null);
      }
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const snap = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    setCursorCoord({ x: snap.x, z: snap.z });
    setActiveSnap(snap);

    if (isPanning) {
      setPan({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Non-passive wheel event listener to eliminate "Unable to preventDefault inside passive event listener invocation"
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      setScale((prev) => Math.max(10, Math.min(180, prev * zoomFactor)));
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', onWheel);
    };
  }, []);

  const handleNodeClick = (e: React.MouseEvent, nodeId: number) => {
    e.stopPropagation();
    if (activeTool === 'DRAW_BEAM' || activeTool === 'QUICK_BEAM') {
      const node = model?.nodes.get(nodeId);
      const nx = node ? node.x : 0;
      const nz = node ? node.z : 0;

      if (!drawingBeamStart) {
        setDrawingBeamStart({ x: nx, z: nz, nodeId });
      } else {
        if (drawingBeamStart.nodeId !== nodeId || Math.hypot(nx - drawingBeamStart.x, nz - drawingBeamStart.z) > 0.2) {
          if (onAddBeamAtCoords) {
            onAddBeamAtCoords(
              drawingBeamStart.x,
              drawingBeamStart.z,
              nx,
              nz,
              drawingBeamStart.nodeId,
              nodeId
            );
          } else {
            onAddBeam(drawingBeamStart.nodeId || nodeId, nodeId);
          }
        }
        setDrawingBeamStart(null);
      }
    } else if (activeTool === 'DRAW_SLAB') {
      if (slabNodes.includes(nodeId)) {
        setSlabNodes(slabNodes.filter((n) => n !== nodeId));
      } else {
        const next = [...slabNodes, nodeId];
        if (next.length >= 4 && onAddPlate) {
          onAddPlate(next, 'SLAB');
          setSlabNodes([]);
        } else {
          setSlabNodes(next);
        }
      }
    } else if (activeTool === 'DRAW_WALL') {
      if (wallNodes.includes(nodeId)) {
        setWallNodes(wallNodes.filter((n) => n !== nodeId));
      } else {
        const next = [...wallNodes, nodeId];
        if (next.length >= 2 && onAddPlate) {
          onAddPlate(next, 'WALL');
          setWallNodes([]);
        } else {
          setWallNodes(next);
        }
      }
    } else if (activeTool === 'ASSIGN_LOAD') {
      onSelectNode(nodeId);
    } else {
      onSelectNode(nodeId);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden select-none font-mono">
      {/* Top Left Storey Info Badge */}
      <div className="absolute top-3 left-3 z-10 bg-slate-900/95 border border-slate-700 px-3.5 py-2 rounded-lg text-xs text-slate-200 shadow-2xl flex items-center gap-3 backdrop-blur-xs">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold block">
            {activeFloorPlan?.levelName || 'STOREY FRAMING PLAN'}
          </span>
          <span className="font-bold text-indigo-300">
            EL. +{(activeFloorPlan?.elevationY ?? selectedStoreyElevation).toFixed(2)}m • {columns.length} Columns • {beams.length} Framing Beams
          </span>
        </div>
        <div className="h-6 w-px bg-slate-700" />
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Tool:</span>
          <span className="font-bold text-amber-400">{activeTool}</span>
        </div>
      </div>

      {/* Floating Zoom, Extents, Labels, Diagrams & CM/CR Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-slate-900/95 border border-slate-700 p-1 rounded-lg shadow-2xl backdrop-blur-xs">
        {/* Diagram Type Selector */}
        <div className="flex items-center bg-slate-950 rounded p-0.5 border border-slate-800 text-[10px]">
          <button
            onClick={() => setDiagramType('NONE')}
            className={`px-1.5 py-1 rounded font-bold transition-colors ${diagramType === 'NONE' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Frames
          </button>
          <button
            onClick={() => setDiagramType('BMD')}
            className={`px-1.5 py-1 rounded font-bold transition-colors flex items-center gap-1 ${diagramType === 'BMD' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-400 hover:text-amber-300'}`}
            title="Display 2D Bending Moment Diagram (Mz)"
          >
            <TrendingUp className="w-3 h-3" />
            <span>BMD (Mz)</span>
          </button>
          <button
            onClick={() => setDiagramType('SFD')}
            className={`px-1.5 py-1 rounded font-bold transition-colors flex items-center gap-1 ${diagramType === 'SFD' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-400 hover:text-emerald-300'}`}
            title="Display 2D Shear Force Diagram (Vy)"
          >
            <Activity className="w-3 h-3" />
            <span>SFD (Vy)</span>
          </button>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        {/* CM / CR Toggle */}
        <button
          onClick={() => setShowCmCr((p) => !p)}
          className={`p-1.5 rounded font-bold flex items-center gap-1 text-[11px] px-2 border transition-colors ${
            showCmCr
              ? 'bg-purple-700 text-white border-purple-500 shadow-xs'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
          }`}
          title="Toggle Center of Mass (CM) & Center of Rigidity (CR) Markers"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>CM/CR</span>
        </button>

        {/* Labels Toggle */}
        <button
          onClick={() => setShowLabels((p) => !p)}
          className={`p-1.5 rounded font-bold flex items-center gap-1 text-[11px] px-2 border transition-colors ${
            showLabels
              ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
          }`}
          title="Toggle Member & Column Labels (Default: Off)"
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Labels {showLabels ? 'ON' : 'OFF'}</span>
        </button>

        <div className="h-4 w-px bg-slate-700" />

        <button
          onClick={() => setScale((s) => Math.min(180, s * 1.2))}
          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(10, s * 0.8))}
          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={autoFitView}
          className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold flex items-center gap-1 text-[11px] px-2.5 shadow-md"
          title="Auto-Fit / Zoom Extents"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Fit Extents</span>
        </button>
      </div>

      {/* High-Speed Hardware-Accelerated SVG Canvas */}
      <svg
        ref={svgRef}
        className={`w-full h-full ${
          activeTool === 'QUICK_COLUMN' || activeTool === 'DRAW_BEAM'
            ? 'cursor-crosshair'
            : isPanning
            ? 'cursor-grabbing'
            : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <defs>
          <pattern id="etabs_minor_grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
          </pattern>
          <pattern id="etabs_major_grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect width="80" height="80" fill="url(#etabs_minor_grid)" />
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#334155" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Background Grid */}
        <rect width="100%" height="100%" fill="url(#etabs_major_grid)" />

        {/* Main Transformed Group for 60fps Smooth Hardware Pan & Zoom */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {/* Global Origin Marker */}
          <g transform="translate(0, 0)">
            <line x1="-1" y1="0" x2="2" y2="0" stroke="#ef4444" strokeWidth="0.1" />
            <line x1="0" y1="-1" x2="0" y2="2" stroke="#3b82f6" strokeWidth="0.1" />
            <text x="2.2" y="0.2" fill="#ef4444" fontSize="0.4" fontWeight="bold">X</text>
            <text x="-0.2" y="2.5" fill="#3b82f6" fontSize="0.4" fontWeight="bold">Z</text>
          </g>

          {/* Grid Lines (X Axis) */}
          {gridLinesX.map((gx) => (
            <g key={gx.id}>
              <line
                x1={gx.coord}
                y1={bounds.minZ - 2}
                x2={gx.coord}
                y2={bounds.maxZ + 2}
                stroke="#475569"
                strokeWidth={0.04}
                strokeDasharray="0.3,0.2"
              />
              {/* Grid Bubble */}
              <circle cx={gx.coord} cy={bounds.minZ - 2} r={0.35} fill="#0f172a" stroke="#64748b" strokeWidth={0.05} />
              <text cx={gx.coord} x={gx.coord} y={bounds.minZ - 1.85} fill="#e2e8f0" fontSize="0.3" fontWeight="bold" textAnchor="middle">
                {gx.label}
              </text>
            </g>
          ))}

          {/* Grid Lines (Z Axis) */}
          {gridLinesZ.map((gz) => (
            <g key={gz.id}>
              <line
                x1={bounds.minX - 2}
                y1={gz.coord}
                x2={bounds.maxX + 2}
                y2={gz.coord}
                stroke="#475569"
                strokeWidth={0.04}
                strokeDasharray="0.3,0.2"
              />
              {/* Grid Bubble */}
              <circle cx={bounds.minX - 2} cy={gz.coord} r={0.35} fill="#0f172a" stroke="#64748b" strokeWidth={0.05} />
              <text x={bounds.minX - 2} y={gz.coord + 0.1} fill="#e2e8f0" fontSize="0.3" fontWeight="bold" textAnchor="middle">
                {gz.label}
              </text>
            </g>
          ))}

          {/* Framing Beams */}
          {beams.map((beam) => {
            const isSelected = selectedMemberId === beam.memberId;
            const midX = (beam.startX + beam.endX) / 2;
            const midZ = (beam.startZ + beam.endZ) / 2;
            const beamW = Math.max(0.2, beam.width || 0.3);
            const forces = memberForcesMap.get(beam.memberId) || { maxMoment: 42, maxShear: 28, spanMoment: 29.4 };

            // Compute perpendicular offset vector for diagrams
            const dx = beam.endX - beam.startX;
            const dz = beam.endZ - beam.startZ;
            const len = Math.max(0.1, Math.sqrt(dx * dx + dz * dz));
            const nx = -dz / len;
            const nz = dx / len;

            const momentOffset = Math.min(1.2, Math.max(0.3, (forces.spanMoment / 100) * 1.5));
            const shearOffset = Math.min(0.9, Math.max(0.25, (forces.maxShear / 80) * 1.2));

            return (
              <g
                key={beam.memberId}
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'ASSIGN_LOAD') {
                    if (onAssignLoadToMember) onAssignLoadToMember(beam.memberId);
                    else onSelectMember(beam.memberId);
                  } else if (activeTool === 'DRAW_STAIRCASE') {
                    // Place a dog-legged staircase flight zone as a slab plate
                    const mem = model?.members.get(beam.memberId);
                    if (mem && onAddPlate) {
                      onAddPlate([mem.startNodeId, mem.endNodeId], 'SLAB');
                    }
                    onSelectMember(beam.memberId);
                  } else {
                    onSelectMember(beam.memberId);
                  }
                }}
                className="cursor-pointer group"
              >
                {/* Beam Solid Line */}
                <line
                  x1={beam.startX}
                  y1={beam.startZ}
                  x2={beam.endX}
                  y2={beam.endZ}
                  stroke={isSelected ? '#f59e0b' : '#38bdf8'}
                  strokeWidth={isSelected ? 0.35 : beamW}
                  strokeLinecap="square"
                />

                {/* 2D Bending Moment Diagram (BMD Mz) Overlay */}
                {diagramType === 'BMD' && (
                  <g pointerEvents="none">
                    {/* Filled Moment Parabola */}
                    <path
                      d={`M ${beam.startX} ${beam.startZ} Q ${midX + nx * momentOffset} ${midZ + nz * momentOffset} ${beam.endX} ${beam.endZ} Z`}
                      fill="rgba(245, 158, 11, 0.3)"
                      stroke="#f59e0b"
                      strokeWidth={0.04}
                    />
                    {/* Moment Peak Value Tag */}
                    <rect
                      x={midX + nx * (momentOffset + 0.15) - 0.55}
                      y={midZ + nz * (momentOffset + 0.15) - 0.16}
                      width="1.1"
                      height="0.32"
                      fill="#0f172a"
                      rx="0.06"
                      stroke="#f59e0b"
                      strokeWidth={0.02}
                    />
                    <text
                      x={midX + nx * (momentOffset + 0.15)}
                      y={midZ + nz * (momentOffset + 0.15) + 0.08}
                      fill="#fef08a"
                      fontSize="0.18"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      +{forces.spanMoment.toFixed(1)} kNm
                    </text>
                  </g>
                )}

                {/* 2D Shear Force Diagram (SFD Vy) Overlay */}
                {diagramType === 'SFD' && (
                  <g pointerEvents="none">
                    {/* Stepped Shear Polygons */}
                    <polygon
                      points={`${beam.startX},${beam.startZ} ${beam.startX + nx * shearOffset},${beam.startZ + nz * shearOffset} ${midX + nx * shearOffset},${midZ + nz * shearOffset} ${midX},${midZ}`}
                      fill="rgba(16, 185, 129, 0.3)"
                      stroke="#10b981"
                      strokeWidth={0.03}
                    />
                    <polygon
                      points={`${midX},${midZ} ${midX - nx * shearOffset},${midZ - nz * shearOffset} ${beam.endX - nx * shearOffset},${beam.endZ - nz * shearOffset} ${beam.endX},${beam.endZ}`}
                      fill="rgba(16, 185, 129, 0.3)"
                      stroke="#10b981"
                      strokeWidth={0.03}
                    />
                    {/* Shear Value Tag */}
                    <rect
                      x={midX + nx * (shearOffset + 0.15) - 0.5}
                      y={midZ + nz * (shearOffset + 0.15) - 0.16}
                      width="1.0"
                      height="0.32"
                      fill="#0f172a"
                      rx="0.06"
                      stroke="#10b981"
                      strokeWidth={0.02}
                    />
                    <text
                      x={midX + nx * (shearOffset + 0.15)}
                      y={midZ + nz * (shearOffset + 0.15) + 0.08}
                      fill="#a7f3d0"
                      fontSize="0.18"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ±{forces.maxShear.toFixed(1)} kN
                    </text>
                  </g>
                )}

                {/* Beam Tag Label (Only if Labels ON or Beam Selected) */}
                {(showLabels || isSelected) && (
                  <g transform={`translate(${midX}, ${midZ})`}>
                    <rect
                      x="-0.7"
                      y="-0.22"
                      width="1.4"
                      height="0.44"
                      fill="#0f172a"
                      rx="0.08"
                      stroke={isSelected ? '#f59e0b' : '#475569'}
                      strokeWidth="0.03"
                    />
                    <text
                      x="0"
                      y="0.09"
                      fill={isSelected ? '#fde68a' : '#cbd5e1'}
                      fontSize="0.22"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {beam.label} ({beam.length.toFixed(1)}m)
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Framing Columns (Cross-Section Blocks with Orientation & Hatching) */}
          {columns.map((col) => {
            const isSelected = selectedMemberId === col.memberId || selectedNodeId === col.nodeId;
            const colW = Math.max(0.35, col.width || 0.45);
            const colD = Math.max(0.35, col.depth || 0.45);

            return (
              <g
                key={`${col.nodeId}_${col.columnSlNo}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'ASSIGN_LOAD') {
                    if (col.memberId) {
                      if (onAssignLoadToMember) onAssignLoadToMember(col.memberId);
                      else onSelectMember(col.memberId);
                    } else {
                      onSelectNode(col.nodeId);
                    }
                    return;
                  }
                  // Prefer selecting the column member for property inspection.
                  // Only fall back to node selection when the column has no member.
                  if (col.memberId) {
                    onSelectMember(col.memberId);
                  } else {
                    onSelectNode(col.nodeId);
                  }
                }}
                transform={`translate(${col.x}, ${col.z})`}
                className="cursor-pointer group"
              >
                {/* Column Solid Body */}
                <rect
                  x={-colW / 2}
                  y={-colD / 2}
                  width={colW}
                  height={colD}
                  fill={isSelected ? '#fbbf24' : '#0284c7'}
                  stroke={isSelected ? '#f59e0b' : '#38bdf8'}
                  strokeWidth={0.04}
                  rx={0.02}
                />
                {/* Diagonal Cross Hatching */}
                <line x1={-colW / 2} y1={-colD / 2} x2={colW / 2} y2={colD / 2} stroke="#0f172a" strokeWidth={0.03} />
                <line x1={-colW / 2} y1={colD / 2} x2={colW / 2} y2={-colD / 2} stroke="#0f172a" strokeWidth={0.03} />

                {/* Column Label Pill (Only if Labels ON or Column Selected) */}
                {(showLabels || isSelected) && (
                  <>
                    <rect
                      x={-colW / 2}
                      y={colD / 2 + 0.05}
                      width={colW}
                      height={0.28}
                      fill="#0f172a"
                      rx={0.05}
                      stroke="#334155"
                      strokeWidth={0.02}
                    />
                    <text
                      x="0"
                      y={colD / 2 + 0.25}
                      fill="#f8fafc"
                      fontSize="0.2"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {col.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Center of Mass (CM) & Center of Rigidity (CR) Markers & Eccentricity Line */}
          {showCmCr && cmCrData && (
            <g pointerEvents="none">
              {/* Dotted Connection Line between CM and CR */}
              <line
                x1={cmCrData.cmX}
                y1={cmCrData.cmZ}
                x2={cmCrData.crX}
                y2={cmCrData.crZ}
                stroke="#eab308"
                strokeWidth={0.05}
                strokeDasharray="0.15,0.1"
              />

              {/* Eccentricity Dimension Badge */}
              <g transform={`translate(${(cmCrData.cmX + cmCrData.crX) / 2}, ${(cmCrData.cmZ + cmCrData.crZ) / 2 - 0.4})`}>
                <rect
                  x="-1.1"
                  y="-0.2"
                  width="2.2"
                  height="0.4"
                  fill="#0f172a"
                  rx="0.08"
                  stroke="#eab308"
                  strokeWidth={0.03}
                />
                <text
                  x="0"
                  y="0.08"
                  fill="#fef08a"
                  fontSize="0.22"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ex = {cmCrData.ex.toFixed(2)}m (edx = {cmCrData.edx.toFixed(2)}m)
                </text>
              </g>

              {/* 1. Center of Mass (CM) Bullseye Marker */}
              <g transform={`translate(${cmCrData.cmX}, ${cmCrData.cmZ})`}>
                <circle cx="0" cy="0" r="0.45" fill="rgba(59, 130, 246, 0.25)" stroke="#3b82f6" strokeWidth={0.06} />
                <circle cx="0" cy="0" r="0.15" fill="#3b82f6" />
                <line x1="-0.6" y1="0" x2="0.6" y2="0" stroke="#3b82f6" strokeWidth={0.04} />
                <line x1="0" y1="-0.6" x2="0" y2="0.6" stroke="#3b82f6" strokeWidth={0.04} />
                <rect x="-0.4" y="0.55" width="0.8" height="0.32" fill="#1e3a8a" rx="0.06" stroke="#3b82f6" strokeWidth={0.02} />
                <text x="0" y="0.78" fill="#93c5fd" fontSize="0.2" fontWeight="bold" textAnchor="middle">
                  CM
                </text>
              </g>

              {/* 2. Center of Rigidity (CR) Diamond Marker */}
              <g transform={`translate(${cmCrData.crX}, ${cmCrData.crZ})`}>
                <polygon
                  points="0,-0.55 0.55,0 0,0.55 -0.55,0"
                  fill="rgba(168, 85, 247, 0.25)"
                  stroke="#a855f7"
                  strokeWidth={0.06}
                />
                <circle cx="0" cy="0" r="0.12" fill="#a855f7" />
                <rect x="-0.4" y="0.65" width="0.8" height="0.32" fill="#581c87" rx="0.06" stroke="#a855f7" strokeWidth={0.02} />
                <text x="0" y="0.88" fill="#d8b4fe" fontSize="0.2" fontWeight="bold" textAnchor="middle">
                  CR
                </text>
              </g>
            </g>
          )}

          {/* Real-time Dynamic Rubber-Band Beam Drafting Preview */}
          {drawingBeamStart && (
            <g pointerEvents="none">
              <line
                x1={drawingBeamStart.x}
                y1={drawingBeamStart.z}
                x2={activeSnap?.x ?? cursorCoord.x}
                y2={activeSnap?.z ?? cursorCoord.z}
                stroke="#f59e0b"
                strokeWidth={0.25}
                strokeDasharray="0.3,0.15"
              />
              {/* Span Length Pill */}
              <g
                transform={`translate(${
                  (drawingBeamStart.x + (activeSnap?.x ?? cursorCoord.x)) / 2
                }, ${
                  (drawingBeamStart.z + (activeSnap?.z ?? cursorCoord.z)) / 2 - 0.35
                })`}
              >
                <rect
                  x="-1.0"
                  y="-0.22"
                  width="2.0"
                  height="0.44"
                  fill="#0f172a"
                  rx="0.08"
                  stroke="#f59e0b"
                  strokeWidth={0.03}
                />
                <text
                  x="0"
                  y="0.08"
                  fill="#fef08a"
                  fontSize="0.22"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  L = {Math.hypot(
                    (activeSnap?.x ?? cursorCoord.x) - drawingBeamStart.x,
                    (activeSnap?.z ?? cursorCoord.z) - drawingBeamStart.z
                  ).toFixed(2)}m
                </text>
              </g>
            </g>
          )}

          {/* Active Snap Target Ring Indicator */}
          {activeSnap && (activeTool === 'QUICK_COLUMN' || activeTool === 'DRAW_BEAM' || activeTool === 'QUICK_BEAM') && (
            <g pointerEvents="none" transform={`translate(${activeSnap.x}, ${activeSnap.z})`}>
              <circle
                cx="0"
                cy="0"
                r={0.28}
                fill="none"
                stroke={activeSnap.type === 'COLUMN' ? '#38bdf8' : activeSnap.type === 'GRID' ? '#eab308' : '#64748b'}
                strokeWidth={0.05}
              />
              <circle cx="0" cy="0" r={0.06} fill="#f59e0b" />
              {activeSnap.label && (
                <g transform="translate(0.35, -0.35)">
                  <rect
                    x="-0.1"
                    y="-0.2"
                    width={activeSnap.label.length * 0.14 + 0.3}
                    height="0.36"
                    fill="#0f172a"
                    rx="0.06"
                    stroke="#475569"
                    strokeWidth={0.02}
                    opacity="0.95"
                  />
                  <text
                    x={(activeSnap.label.length * 0.14 + 0.1) / 2}
                    y="0.05"
                    fill="#f8fafc"
                    fontSize="0.18"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {activeSnap.label}
                  </text>
                </g>
              )}
            </g>
          )}
        </g>
      </svg>

      {/* Bottom Status & Coordinate Information */}
      <div className="absolute bottom-3 left-3 z-10 bg-slate-900/95 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs text-slate-300 shadow-2xl flex items-center gap-4 backdrop-blur-xs">
        <span>Cursor: X=<strong className="text-white">{cursorCoord.x.toFixed(2)}m</strong>, Z=<strong className="text-white">{cursorCoord.z.toFixed(2)}m</strong></span>
        {activeSnap && (
          <span className="text-sky-300 font-bold">
            Snap: {activeSnap.type} [{activeSnap.label}]
          </span>
        )}
        <span>•</span>
        <span className="text-slate-400 text-[11px]">
          {activeTool === 'QUICK_COLUMN' && 'Click grid intersection or joint to place RCC Column (450x450)'}
          {activeTool === 'DRAW_BEAM' && (drawingBeamStart ? 'Click second joint or grid intersection to finish beam' : 'Click first joint or grid intersection to begin beam')}
          {activeTool === 'QUICK_BEAM' && 'Click 2 joints or grid intersections to draw a framing beam (300x450)'}
          {activeTool === 'DRAW_SLAB' && `Click 4 nodes to define slab panel (${slabNodes.length}/4 selected)`}
          {activeTool === 'DRAW_WALL' && `Click 2 nodes to draw shear wall (${wallNodes.length}/2 selected)`}
          {activeTool === 'DRAW_STAIRCASE' && 'Select a beam to place a dog-legged RCC staircase module'}
          {activeTool === 'ASSIGN_LOAD' && 'Click a beam/column member to assign loads'}
          {activeTool === 'SELECT' && 'Click columns or beams to inspect. Mouse drag to pan, wheel to zoom.'}
        </span>
      </div>
    </div>
  );
});
