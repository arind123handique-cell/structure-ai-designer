import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PileCapDesignEngine, PileCapDesignOutput } from './pileCapDesignEngine';
import { CombinedPileCapGroup } from './combinedPileCapEngine';
import { NormalizedStructuralModel } from '@/features/model/types';
import {
  getPileOffsetsMm,
  getTruncated3PilePolygonMm,
  get3PileDimensionsMm,
  angleToOrientation,
  CapOrientation,
} from './pileCapGeometryUtils';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { ProjectPileType } from '@/features/design/pile/pileDesignEngine';
import { ManualAnalysisEngine } from '@/features/calculations/manualAnalysisEngine';
import { X, ZoomIn, ZoomOut, Maximize2, RotateCcw, RotateCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PileCapPlanViewProps {
  activeModel: NormalizedStructuralModel;
  designedCaps: Map<number, PileCapDesignOutput>;
  combinedPileCaps: CombinedPileCapGroup[];
  customPileCapOverrides: Record<number, any>;
  projectPileTypes: ProjectPileType[];
  supportPileAssignments: Record<number, string>;
  onPileCountChange: (nodeId: number, newCount: number) => void;
  onRotationChange: (nodeId: number, direction: 'CW' | 'CCW') => void;
}

interface CapPolygon {
  nodeId: number | string;
  cx: number;
  cz: number;
  points: string;
  fill: string;
  stroke: string;
  pileCount: number;
  design: PileCapDesignOutput | null;
  columnLabel: string;
  isCombined: boolean;
  combinedGroup?: CombinedPileCapGroup;
}

export const PileCapPlanView: React.FC<PileCapPlanViewProps> = ({
  activeModel,
  designedCaps,
  combinedPileCaps,
  customPileCapOverrides,
  projectPileTypes,
  supportPileAssignments,
  onPileCountChange,
  onRotationChange,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<number | string>>(new Set());
  const [hoveredNodeId, setHoveredNodeId] = useState<number | string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Column numbering
  const columnSupportMapping = useMemo(() => ColumnNumberingService.getColumnSupportMapping(activeModel), [activeModel]);

  // Map absorbed nodes to their combined group
  const absorbedNodeMap = useMemo(() => {
    const map = new Map<number, CombinedPileCapGroup>();
    combinedPileCaps.forEach((grp) => {
      grp.absorbedIndividualCaps.forEach((id) => map.set(id, grp));
      grp.nodeIds.forEach((id) => map.set(id, grp));
    });
    return map;
  }, [combinedPileCaps]);

  // Support nodes with positions
  const supportNodes = useMemo(() => {
    if (!activeModel.supports) return [];
    return Array.from(activeModel.supports.values()).map((sup) => {
      const node = activeModel.nodes.get(sup.nodeId);
      const colInfo = columnSupportMapping.get(sup.nodeId);
      return {
        nodeId: sup.nodeId,
        x: node?.x ?? 0,
        z: node?.z ?? 0,
        columnLabel: colInfo?.columnLabel || `C${sup.nodeId}`,
        columnSlNo: colInfo?.columnSlNo || sup.nodeId,
      };
    }).sort((a, b) => a.columnSlNo - b.columnSlNo);
  }, [activeModel, columnSupportMapping]);

  // Compute bounding box of all support nodes
  const bounds = useMemo(() => {
    if (supportNodes.length === 0) return { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const n of supportNodes) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.z < minZ) minZ = n.z;
      if (n.z > maxZ) maxZ = n.z;
    }
    const pad = 3;
    return { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
  }, [supportNodes]);

  // SVG dimensions
  const svgW = 900;
  const svgH = 600;

  // Scale: world meters -> SVG pixels
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxZ - bounds.minZ;
  const scale = Math.min((svgW - 80) / worldW, (svgH - 80) / worldH) * zoom;

  const toSvgX = (wx: number) => (wx - bounds.minX) * scale + 40 + pan.x;
  const toSvgY = (wz: number) => (wz - bounds.minZ) * scale + 40 + pan.y;

  // Build cap polygons for each support node (skip absorbed) + combined caps
  const capPolygons: CapPolygon[] = useMemo(() => {
    const polys: CapPolygon[] = [];
    const renderedCombinedGroups = new Set<string>();

    // Individual pile caps (skip those absorbed into combined)
    for (const sup of supportNodes) {
      if (absorbedNodeMap.has(sup.nodeId)) continue;
      const design = designedCaps.get(sup.nodeId);
      if (!design) continue;

      const count = design.pileCount;
      const shape = design.capShape;
      const s = design.pileSpacing;
      const eo = design.edgeDistance;
      const L = design.capLength;
      const B = design.capWidth;
      const Dp = design.pileDiameter;
      const rotDeg = customPileCapOverrides[sup.nodeId]?.rotationAngle ?? design.rotationAngle ?? 0;
      const orientation: CapOrientation = rotDeg !== 0 ? angleToOrientation(rotDeg) : 'UP';

      let ptsMm: { x: number; y: number }[] = [];

      if (count === 3 || shape === 'TRIANGULAR') {
        ptsMm = getTruncated3PilePolygonMm(s, eo, orientation, 0);
      } else if (count === 5 || shape === 'PENTAGONAL') {
        const Rp = s / (2 * Math.sin(Math.PI / 5));
        const Rcap = Rp + eo;
        const rotRad = (rotDeg * Math.PI) / 180;
        for (let i = 0; i < 5; i++) {
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / 5 + rotRad;
          ptsMm.push({ x: Rcap * Math.cos(angle), y: Rcap * Math.sin(angle) });
        }
      } else {
        const isRot90 = rotDeg === 90 || rotDeg === 270;
        const baseL = count === 2 ? s + 2 * eo : L;
        const baseB = count === 2 ? Dp + 2 * eo : B;
        const curL = isRot90 ? baseB : baseL;
        const curB = isRot90 ? baseL : baseB;
        const hw = curL / 2;
        const hh = curB / 2;
        ptsMm = [
          { x: -hw, y: -hh },
          { x: hw, y: -hh },
          { x: hw, y: hh },
          { x: -hw, y: hh },
        ];
      }

      const svgPoints = ptsMm.map((p) => {
        const wx = sup.x + p.x / 1000;
        const wz = sup.z + p.y / 1000;
        return `${toSvgX(wx).toFixed(1)},${toSvgY(wz).toFixed(1)}`;
      }).join(' ');

      const isSelected = selectedNodeIds.has(sup.nodeId);
      const isHovered = hoveredNodeId === sup.nodeId;

      polys.push({
        nodeId: sup.nodeId,
        cx: toSvgX(sup.x),
        cz: toSvgY(sup.z),
        points: svgPoints,
        fill: isSelected ? '#dbeafe' : isHovered ? '#eff6ff' : '#fdf4ff',
        stroke: isSelected ? '#2563eb' : isHovered ? '#7c3aed' : '#c026d3',
        pileCount: count,
        design,
        columnLabel: sup.columnLabel,
        isCombined: false,
      });
    }

    // Combined pile caps (render as single merged rectangle)
    for (const grp of combinedPileCaps) {
      if (renderedCombinedGroups.has(grp.groupId)) continue;
      renderedCombinedGroups.add(grp.groupId);

      const cx = (grp.minX + grp.maxX) / 2;
      const cz = (grp.minZ + grp.maxZ) / 2;
      const halfW = ((grp.maxX - grp.minX) / 2);
      const halfH = ((grp.maxZ - grp.minZ) / 2);

      const svgPoints = [
        `${toSvgX(cx - halfW).toFixed(1)},${toSvgY(cz - halfH).toFixed(1)}`,
        `${toSvgX(cx + halfW).toFixed(1)},${toSvgY(cz - halfH).toFixed(1)}`,
        `${toSvgX(cx + halfW).toFixed(1)},${toSvgY(cz + halfH).toFixed(1)}`,
        `${toSvgX(cx - halfW).toFixed(1)},${toSvgY(cz + halfH).toFixed(1)}`,
      ].join(' ');

      const isSelected = grp.nodeIds.some((nid) => selectedNodeIds.has(nid));
      const isHovered = hoveredNodeId === grp.groupId;

      polys.push({
        nodeId: grp.groupId,
        cx: toSvgX(cx),
        cz: toSvgY(cz),
        points: svgPoints,
        fill: isSelected ? '#fce7f3' : isHovered ? '#fdf2f8' : '#fef2f2',
        stroke: isSelected ? '#be185d' : isHovered ? '#e11d48' : '#f43f5e',
        pileCount: grp.pileCount,
        design: null,
        columnLabel: grp.columnLabels.join('+'),
        isCombined: true,
        combinedGroup: grp,
      });
    }

    return polys;
  }, [supportNodes, designedCaps, combinedPileCaps, absorbedNodeMap, customPileCapOverrides, selectedNodeIds, hoveredNodeId, toSvgX, toSvgY]);

  // Click handler
  const handleCapClick = useCallback((nodeId: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId as any)) next.delete(nodeId as any);
        else next.add(nodeId as any);
        return next;
      });
    } else {
      setSelectedNodeIds((prev) => {
        if (prev.size === 1 && prev.has(nodeId as any)) return new Set();
        return new Set([nodeId as any]);
      });
    }
  }, []);

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(3, z * 1.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, z / 1.2));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'rect') {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    }
  };
  const handleMouseUp = () => setIsPanning(false);

  // Scroll wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(3, Math.max(0.3, z * delta)));
  };

  // Selected cap details
  const selectedIndividualCaps = useMemo(() => {
    return Array.from(selectedNodeIds)
      .filter((id): id is number => typeof id === 'number')
      .map((nid) => designedCaps.get(nid))
      .filter(Boolean) as PileCapDesignOutput[];
  }, [selectedNodeIds, designedCaps]);

  const selectedCombinedGroups = useMemo(() => {
    return Array.from(selectedNodeIds)
      .filter((id): id is string => typeof id === 'string')
      .map((gid) => combinedPileCaps.find((g) => g.groupId === gid))
      .filter(Boolean) as CombinedPileCapGroup[];
  }, [selectedNodeIds, combinedPileCaps]);

  const singleSelected = selectedIndividualCaps.length === 1 && selectedCombinedGroups.length === 0
    ? selectedIndividualCaps[0] : null;
  const singleCombined = selectedCombinedGroups.length === 1 && selectedIndividualCaps.length === 0
    ? selectedCombinedGroups[0] : null;

  return (
    <div className="flex h-full bg-slate-50 rounded-lg border border-ui-border overflow-hidden">
      {/* Left: 2D Plan View */}
      <div className="flex-1 relative overflow-hidden">
        {/* Toolbar */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200 shadow-sm px-2 py-1.5">
          <button onClick={handleZoomIn} className="p-1 hover:bg-slate-100 rounded transition-colors" title="Zoom In">
            <ZoomIn className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={handleZoomOut} className="p-1 hover:bg-slate-100 rounded transition-colors" title="Zoom Out">
            <ZoomOut className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={handleReset} className="p-1 hover:bg-slate-100 rounded transition-colors" title="Reset View">
            <Maximize2 className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-[10px] font-mono text-slate-500 ml-1">{Math.round(zoom * 100)}%</span>
        </div>

        {/* Selection info */}
        {selectedNodeIds.size > 0 && (
          <div className="absolute top-2 right-2 z-10 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 shadow-sm">
            <span className="text-[11px] font-mono font-bold text-blue-700">
              {selectedNodeIds.size} cap{selectedNodeIds.size > 1 ? 's' : ''} selected
            </span>
          </div>
        )}

        {/* SVG Plan */}
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Background */}
          <rect x="0" y="0" width={svgW} height={svgH} fill="#f8fafc" />

          {/* Grid lines */}
          {(() => {
            const gridLines = [];
            const gridStep = 1; // 1 meter grid
            const startZ = Math.ceil(bounds.minZ);
            const endZ = Math.floor(bounds.maxZ);
            const startX = Math.ceil(bounds.minX);
            const endX = Math.floor(bounds.maxX);

            for (let gz = startZ; gz <= endZ; gz += gridStep) {
              const sy = toSvgY(gz);
              gridLines.push(
                <line key={`gz${gz}`} x1={40} y1={sy} x2={svgW - 40} y2={sy} stroke="#e2e8f0" strokeWidth="0.5" />
              );
              gridLines.push(
                <text key={`gzt${gz}`} x={35} y={sy + 3} fill="#94a3b8" fontSize="7" textAnchor="end" fontFamily="monospace">
                  {gz.toFixed(0)}
                </text>
              );
            }
            for (let gx = startX; gx <= endX; gx += gridStep) {
              const sx = toSvgX(gx);
              gridLines.push(
                <line key={`gx${gx}`} x1={sx} y1={40} x2={sx} y2={svgH - 40} stroke="#e2e8f0" strokeWidth="0.5" />
              );
              gridLines.push(
                <text key={`gxt${gx}`} x={sx} y={svgH - 30} fill="#94a3b8" fontSize="7" textAnchor="middle" fontFamily="monospace">
                  {gx.toFixed(0)}
                </text>
              );
            }
            return gridLines;
          })()}

          {/* Grid axis labels */}
          <text x={svgW / 2} y={svgH - 8} fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
            X (meters)
          </text>
          <text x={10} y={svgH / 2} fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90, 10, ${svgH / 2})`}>
            Z (meters)
          </text>

          {/* Cap polygons */}
          {capPolygons.map((cp) => (
            <g key={cp.nodeId}>
              {/* Cap polygon */}
              <polygon
                points={cp.points}
                fill={cp.fill}
                stroke={cp.stroke}
                strokeWidth={(selectedNodeIds.has(cp.nodeId as any)) ? 2.5 : 1.5}
                strokeLinejoin="round"
                strokeDasharray={cp.isCombined ? '6,3' : undefined}
                className="cursor-pointer transition-all"
                onClick={(e) => handleCapClick(cp.nodeId, e)}
                onMouseEnter={() => setHoveredNodeId(cp.nodeId)}
                onMouseLeave={() => setHoveredNodeId(null)}
              />

              {/* Pile positions for individual caps */}
              {!cp.isCombined && cp.design && (() => {
                const design = cp.design;
                const count = design.pileCount;
                const s = design.pileSpacing;
                const Dp = design.pileDiameter;
                const rotDeg = customPileCapOverrides[cp.nodeId as number]?.rotationAngle ?? design.rotationAngle ?? 0;
                const orientation: CapOrientation = rotDeg !== 0 ? angleToOrientation(rotDeg) : 'UP';
                const offsets = getPileOffsetsMm(count, s, orientation);
                const sup = supportNodes.find((n) => n.nodeId === cp.nodeId);
                if (!sup) return null;

                return offsets.map((off, i) => {
                  const px = toSvgX(sup.x + off.x / 1000);
                  const py = toSvgY(sup.z + off.y / 1000);
                  return (
                    <g key={`pile_${cp.nodeId}_${i}`}>
                      <circle cx={px} cy={py} r={4} fill="#1e3a8a" stroke="#ffffff" strokeWidth="1" />
                      <line x1={px - 3} y1={py} x2={px + 3} y2={py} stroke="#ffffff" strokeWidth="0.5" />
                      <line x1={px} y1={py - 3} x2={px} y2={py + 3} stroke="#ffffff" strokeWidth="0.5" />
                    </g>
                  );
                });
              })()}

              {/* Pile positions for combined caps */}
              {cp.isCombined && cp.combinedGroup && (() => {
                const grp = cp.combinedGroup;
                const cx = (grp.minX + grp.maxX) / 2;
                const cz = (grp.minZ + grp.maxZ) / 2;
                return grp.pileOffsets.map((off, i) => {
                  const px = toSvgX(cx + off.x / 1000);
                  const py = toSvgY(cz + off.z / 1000);
                  return (
                    <g key={`cpile_${cp.nodeId}_${i}`}>
                      <circle cx={px} cy={py} r={4} fill="#1e3a8a" stroke="#ffffff" strokeWidth="1" />
                      <line x1={px - 3} y1={py} x2={px + 3} y2={py} stroke="#ffffff" strokeWidth="0.5" />
                      <line x1={px} y1={py - 3} x2={px} y2={py + 3} stroke="#ffffff" strokeWidth="0.5" />
                    </g>
                  );
                });
              })()}

              {/* Column positions inside combined cap */}
              {cp.isCombined && cp.combinedGroup && cp.combinedGroup.nodeIds.map((nid) => {
                const sup = supportNodes.find((n) => n.nodeId === nid);
                if (!sup) return null;
                return (
                  <rect
                    key={`col_${cp.nodeId}_${nid}`}
                    x={toSvgX(sup.x) - 3}
                    y={toSvgY(sup.z) - 3}
                    width={6}
                    height={6}
                    fill="#ca8a04"
                    stroke="#eab308"
                    strokeWidth="0.8"
                  />
                );
              })}

              {/* Column center marker (individual) */}
              {!cp.isCombined && (
                <rect
                  x={cp.cx - 4}
                  y={cp.cz - 4}
                  width={8}
                  height={8}
                  fill="#ca8a04"
                  stroke="#eab308"
                  strokeWidth="1"
                />
              )}

              {/* Label */}
              <text
                x={cp.cx}
                y={cp.cz - 10}
                fill={(selectedNodeIds.has(cp.nodeId as any)) ? (cp.isCombined ? '#be185d' : '#1d4ed8') : '#334155'}
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="monospace"
                className="pointer-events-none"
              >
                {cp.columnLabel}
              </text>
              <text
                x={cp.cx}
                y={cp.cz + 16}
                fill={(selectedNodeIds.has(cp.nodeId as any)) ? (cp.isCombined ? '#be185d' : '#1d4ed8') : '#64748b'}
                fontSize="6.5"
                textAnchor="middle"
                fontFamily="monospace"
                className="pointer-events-none"
              >
                {cp.isCombined
                  ? `${cp.pileCount}P Combined • ${cp.combinedGroup?.capLength}×${cp.combinedGroup?.capWidth}`
                  : `${cp.pileCount}P • ${cp.design?.capLength}×${cp.design?.capWidth}`
                }
              </text>
            </g>
          ))}

          {/* Empty state */}
          {capPolygons.length === 0 && (
            <text x={svgW / 2} y={svgH / 2} fill="#94a3b8" fontSize="12" textAnchor="middle" fontFamily="monospace">
              No pile caps designed yet. Run "Design All" first.
            </text>
          )}
        </svg>
      </div>

      {/* Right: Design Panel */}
      <div className="w-[320px] border-l border-slate-200 bg-white flex flex-col overflow-hidden">
        {singleSelected ? (
          <DesignPanel
            design={singleSelected}
            nodeId={Array.from(selectedNodeIds)[0] as number}
            customOverrides={customPileCapOverrides[Array.from(selectedNodeIds)[0] as number]}
            onPileCountChange={onPileCountChange}
            onRotationChange={onRotationChange}
          />
        ) : singleCombined ? (
          <CombinedDesignPanel group={singleCombined} />
        ) : (selectedIndividualCaps.length + selectedCombinedGroups.length) > 1 ? (
          <BatchDesignPanel
            caps={selectedIndividualCaps}
            nodeIds={Array.from(selectedNodeIds).filter((id): id is number => typeof id === 'number')}
            customOverrides={customPileCapOverrides}
            onPileCountChange={onPileCountChange}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <p className="font-mono text-xs font-semibold text-slate-500 mb-1">Select a Pile Cap</p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Click any pile cap on the plan to view and edit its configuration. Hold Ctrl/Cmd for multi-select.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Single Cap Design Panel ─────────────────────────────────────────────────

interface DesignPanelProps {
  design: PileCapDesignOutput;
  nodeId: number;
  customOverrides: any;
  onPileCountChange: (nodeId: number, newCount: number) => void;
  onRotationChange: (nodeId: number, direction: 'CW' | 'CCW') => void;
}

const DesignPanel: React.FC<DesignPanelProps> = ({
  design,
  nodeId,
  customOverrides,
  onPileCountChange,
  onRotationChange,
}) => {
  const count = design.pileCount;
  const rot = ((customOverrides?.rotationAngle ?? design.rotationAngle ?? 0) % 360 + 360) % 360;
  const isPass = design.status === 'PASS';

  // Mini plan preview SVG
  const miniW = 200;
  const miniH = 160;
  const mcx = miniW / 2;
  const mcy = miniH / 2;
  const s = design.pileSpacing;
  const eo = design.edgeDistance;
  const Dp = design.pileDiameter;
  const L = design.capLength;
  const B = design.capWidth;
  const rotDeg = rot;
  const orientation: CapOrientation = rotDeg !== 0 ? angleToOrientation(rotDeg) : 'UP';
  const maxDim = Math.max(L, B);
  const mScale = 60 / maxDim;

  // Cap polygon for mini view
  const getMiniCapPoints = () => {
    if (count === 3 || design.capShape === 'TRIANGULAR') {
      const pts = getTruncated3PilePolygonMm(s, eo, orientation, 0);
      return pts.map((p) => `${mcx + p.x * mScale},${mcy - p.y * mScale}`).join(' ');
    }
    if (count === 5 || design.capShape === 'PENTAGONAL') {
      const Rp = s / (2 * Math.sin(Math.PI / 5));
      const Rcap = Rp + eo;
      const rRad = (rotDeg * Math.PI) / 180;
      return Array.from({ length: 5 }, (_, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / 5 + rRad;
        return `${mcx + Rcap * mScale * Math.cos(a)},${mcy + Rcap * mScale * Math.sin(a)}`;
      }).join(' ');
    }
    const isRot90 = rotDeg === 90 || rotDeg === 270;
    const baseL = count === 2 ? s + 2 * eo : L;
    const baseB = count === 2 ? Dp + 2 * eo : B;
    const curL = isRot90 ? baseB : baseL;
    const curB = isRot90 ? baseL : baseB;
    const hw = (curL / 2) * mScale;
    const hh = (curB / 2) * mScale;
    return `${mcx - hw},${mcy - hh} ${mcx + hw},${mcy - hh} ${mcx + hw},${mcy + hh} ${mcx - hw},${mcy + hh}`;
  };

  const miniCapPts = getMiniCapPoints();

  // Pile positions for mini view
  const pileOffsets = getPileOffsetsMm(count, s, orientation);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono text-sm font-bold text-slate-800">Pile Cap Design</h3>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
            {design.status}
          </span>
        </div>
        <div className="font-mono text-[10px] text-slate-500">
          Node #{nodeId} • {design.factoredVerticalLoad?.toFixed(1)} kN (Pu)
        </div>
      </div>

      {/* Mini Plan Preview */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Plan Preview</div>
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 flex justify-center">
          <svg width={miniW} height={miniH} viewBox={`0 0 ${miniW} ${miniH}`}>
            <rect width={miniW} height={miniH} fill="#f8fafc" />
            {/* Cap outline */}
            <polygon points={miniCapPts} fill="#fdf4ff" stroke="#c026d3" strokeWidth="1.5" strokeLinejoin="round" />
            {/* Piles */}
            {pileOffsets.map((off, i) => (
              <g key={i}>
                <circle cx={mcx + off.x * mScale} cy={mcy - off.y * mScale} r={3.5} fill="#1e3a8a" stroke="#fff" strokeWidth="0.8" />
                <line x1={mcx + off.x * mScale - 2.5} y1={mcy - off.y * mScale} x2={mcx + off.x * mScale + 2.5} y2={mcy - off.y * mScale} stroke="#fff" strokeWidth="0.4" />
                <line x1={mcx + off.x * mScale} y1={mcy - off.y * mScale - 2.5} x2={mcx + off.x * mScale} y2={mcy - off.y * mScale + 2.5} stroke="#fff" strokeWidth="0.4" />
              </g>
            ))}
            {/* Column */}
            <rect x={mcx - 4} y={mcy - 4} width={8} height={8} fill="#ca8a04" stroke="#eab308" strokeWidth="0.8" />
          </svg>
        </div>
      </div>

      {/* Pile Count Config */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Pile Configuration</div>
        <div className="grid grid-cols-5 gap-1.5">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => onPileCountChange(nodeId, n)}
              className={`py-2 rounded-lg font-mono text-xs font-bold transition-all ${
                count === n
                  ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200'
              }`}
            >
              {n}
              <span className="block text-[8px] font-normal mt-0.5 opacity-70">pile{ n > 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500">Shape:</span>
          <span className="text-[10px] font-mono font-bold text-indigo-700">
            {design.capShape === 'TRIANGULAR' ? '▲ Triangle' : design.capShape === 'PENTAGONAL' ? '⬠ Pentagon' : '▬ Rectangle'}
          </span>
        </div>
      </div>

      {/* Rotation */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Orientation</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRotationChange(nodeId, 'CCW')}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
            title="Rotate CCW (-90°)"
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
          </button>
          <span className="font-mono text-sm font-bold text-slate-700 w-12 text-center">{rot}°</span>
          <button
            onClick={() => onRotationChange(nodeId, 'CW')}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
            title="Rotate CW (+90°)"
          >
            <RotateCw className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Design Details */}
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Design Summary</div>
        <div className="space-y-2">
          <DetailRow label="Cap Size" value={`${design.capLength} × ${design.capWidth} × ${design.capDepth} mm`} />
          <DetailRow label="Effective Depth" value={`${design.effectiveDepth} mm`} />
          <DetailRow label="Pile Diameter" value={`${design.pileDiameter} mm`} />
          <DetailRow label="Pile Spacing" value={`${design.pileSpacing} mm (${(design.pileSpacing / design.pileDiameter).toFixed(1)}×Dp)`} />
          <DetailRow label="Edge Distance" value={`${design.edgeDistance} mm (${(design.edgeDistance / design.pileDiameter).toFixed(1)}×Dp)`} />
          <DetailRow label="Load / Pile" value={`${design.loadPerPile} kN`} accent />
          <DetailRow label="Bottom Rebar" value={design.rebarCalloutX} />
          <DetailRow label="Top Rebar" value={design.topRebarCallout} />
          <DetailRow label="Side Rebar" value={design.sideFaceRebarCallout} />

          {design.columnPunching && (
            <div className="pt-2 mt-2 border-t border-slate-100">
              <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-1 font-semibold">Punching Shear</div>
              <div className="flex items-center gap-2">
                {design.columnPunching.status === 'PASS' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                )}
                <span className={`font-mono text-[11px] font-bold ${design.columnPunching.status === 'PASS' ? 'text-emerald-700' : 'text-red-700'}`}>
                  τvp = {design.columnPunching.tau_vp} N/mm²
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Cap: {design.columnPunching.tau_cp} N/mm²</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Batch Design Panel (Multiple Selection) ─────────────────────────────────

interface BatchDesignProps {
  caps: PileCapDesignOutput[];
  nodeIds: number[];
  customOverrides: Record<number, any>;
  onPileCountChange: (nodeId: number, newCount: number) => void;
}

const BatchDesignPanel: React.FC<BatchDesignProps> = ({
  caps,
  nodeIds,
  customOverrides,
  onPileCountChange,
}) => {
  // Summary stats
  const avgLoad = caps.reduce((s, c) => s + c.factoredVerticalLoad, 0) / caps.length;
  const totalVol = caps.reduce((s, c) => s + (c.capLength * c.capWidth * c.capDepth) / 1e9, 0);
  const counts = caps.map((c) => c.pileCount);
  const uniqueCounts = [...new Set(counts)];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
        <h3 className="font-mono text-sm font-bold text-slate-800 mb-1">Batch Configuration</h3>
        <div className="font-mono text-[10px] text-slate-500">
          {caps.length} pile caps selected
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Summary</div>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="bg-slate-50 rounded p-2">
            <div className="text-slate-400 text-[9px]">AVG LOAD</div>
            <div className="font-bold text-slate-700">{avgLoad.toFixed(0)} kN</div>
          </div>
          <div className="bg-slate-50 rounded p-2">
            <div className="text-slate-400 text-[9px]">TOTAL VOL</div>
            <div className="font-bold text-slate-700">{totalVol.toFixed(2)} m³</div>
          </div>
          <div className="bg-slate-50 rounded p-2 col-span-2">
            <div className="text-slate-400 text-[9px]">CONFIGURATIONS</div>
            <div className="font-bold text-slate-700">{uniqueCounts.map((c) => `${c}-pile`).join(', ')}</div>
          </div>
        </div>
      </div>

      {/* Batch Pile Count */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Set All To</div>
        <div className="grid grid-cols-5 gap-1.5">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => nodeIds.forEach((nid) => onPileCountChange(nid, n))}
              className="py-2 rounded-lg font-mono text-xs font-bold bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 transition-all"
            >
              {n}
              <span className="block text-[8px] font-normal mt-0.5 opacity-70">pile{n > 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Caps List */}
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Selected Caps</div>
        <div className="space-y-1.5">
          {caps.map((cap, i) => (
            <div key={nodeIds[i]} className="flex items-center justify-between bg-slate-50 rounded px-2.5 py-1.5 border border-slate-100">
              <div className="font-mono text-[11px]">
                <span className="font-bold text-slate-700">#{nodeIds[i]}</span>
                <span className="text-slate-400 mx-1">•</span>
                <span className="text-indigo-600 font-semibold">{cap.pileCount}-Pile</span>
              </div>
              <span className="font-mono text-[9px] text-slate-500">{cap.capLength}×{cap.capWidth}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Combined Cap Design Panel ───────────────────────────────────────────────

interface CombinedDesignProps {
  group: CombinedPileCapGroup;
}

const CombinedDesignPanel: React.FC<CombinedDesignProps> = ({ group }) => {
  const isPass = group.status === 'PASS';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 bg-rose-50 border-b border-rose-200 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono text-sm font-bold text-rose-800">Combined Pile Cap</h3>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
            {group.status}
          </span>
        </div>
        <div className="font-mono text-[10px] text-slate-500">
          {group.columnLabels.join(', ')} • {group.nodeIds.length} columns
        </div>
        <div className="font-mono text-[10px] text-slate-400 mt-0.5">
          {group.reason === 'SHEAR_WALL' ? 'Shear Wall' : group.reason === 'MERGED_CLOSE_COLUMNS' ? 'Merged Close Columns' : 'Manual Merge'}
        </div>
      </div>

      {/* Cap Details */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Cap Configuration</div>
        <div className="space-y-2">
          <DetailRow label="Cap Size" value={`${group.capLength} × ${group.capWidth} × ${group.capDepth} mm`} />
          <DetailRow label="Pile Count" value={`${group.pileCount} piles (${group.pileRows}×${group.pileCols})`} accent />
          <DetailRow label="Pile Diameter" value={`${group.pileDiameter} mm`} />
          <DetailRow label="Pile Spacing X" value={`${group.pileSpacingX || group.pileSpacing} mm`} />
          <DetailRow label="Pile Spacing Z" value={`${group.pileSpacingZ || group.pileSpacing} mm`} />
          <DetailRow label="Edge Distance" value={`${group.edgeDistance} mm`} />
          <DetailRow label="Load / Pile" value={`${group.loadPerPile} kN`} accent />
        </div>
      </div>

      {/* Loads */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Loading</div>
        <div className="space-y-2">
          <DetailRow label="Total Pu" value={`${group.totalFactoredLoad} kN`} />
          <DetailRow label="Total P_work" value={`${group.totalWorkingLoad} kN`} />
          <DetailRow label="Safe Capacity" value={`${group.safePileCapacity} kN`} />
        </div>
      </div>

      {/* Rebar */}
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Reinforcement</div>
        <div className="space-y-2">
          <DetailRow label="Bottom Mat" value={group.botRebarCallout} />
          <DetailRow label="Top Mesh" value={group.topRebarCallout} />
          <DetailRow label="Shear Stirrups" value={group.shearWallStirrupCallout} />
        </div>
      </div>

      {/* Columns in group */}
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">Columns in Group</div>
        <div className="space-y-1">
          {group.nodeIds.map((nid, i) => (
            <div key={nid} className="flex items-center justify-between bg-slate-50 rounded px-2.5 py-1.5 border border-slate-100">
              <span className="font-mono text-[11px] font-bold text-slate-700">
                {group.columnLabels[i] || `C${nid}`}
              </span>
              <span className="font-mono text-[9px] text-slate-400">Joint #{nid}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Helper ──────────────────────────────────────────────────────────────────

const DetailRow: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="flex items-start justify-between gap-2">
    <span className="text-[10px] font-mono text-slate-400 shrink-0">{label}</span>
    <span className={`text-[10px] font-mono text-right ${accent ? 'font-bold text-indigo-700' : 'text-slate-700'}`}>{value}</span>
  </div>
);
