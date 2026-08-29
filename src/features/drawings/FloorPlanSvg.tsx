import React, { useState, useMemo } from 'react';
import { FloorPlanLevel, FloorColumnInfo } from './floorPlanEngine';
import { StoredProject } from '@/features/projects/types';
import { PileCapDesignOutput } from '@/features/design/pilecap/pileCapDesignEngine';
import { CombinedPileCapGroup } from '@/features/design/pilecap/combinedPileCapEngine';
import { ArchitecturalStaircase } from '@/features/architectural/types/architecturalTypes';
import { StaircasePlacementEngine } from '@/features/architectural/engines/staircasePlacementEngine';
import { Footprints, Move, RotateCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface FloorPlanSvgProps {
  floorPlan: FloorPlanLevel;
  project?: StoredProject | null;
  width?: number;
  height?: number;
  showGrids?: boolean;
  showDimensions?: boolean;
  showMemberLabels?: boolean;
  showSectionSizes?: boolean;
  showSlabs?: boolean;
  showPileCaps?: boolean;
  showGradeBeams?: boolean;
  showLiftCore?: boolean;
  showStaircases?: boolean;
  staircases?: Record<string, ArchitecturalStaircase>;
  onUpdateStaircase?: (id: string, updates: Partial<ArchitecturalStaircase>) => void;
  selectedStaircaseId?: string | null;
  onSelectStaircase?: (id: string | null) => void;
  pileCapDisplayMode?: 'BOTH' | 'PLAN' | 'SECTION';
  selectedSectionType?: string;
  onSelectSection?: (sectionId: string) => void;
}

export interface UniquePileCapType {
  typeId: string;
  typeName: string;
  cap: PileCapDesignOutput;
  representativeColumn: FloorColumnInfo;
  associatedColumns: string[];
  sectionNum: number;
  sectionLabel: string;
  count: number;
  shape: string;
  L: number;
  B: number;
  D: number;
  Dp: number;
  s: number;
  eo: number;
  facetDim?: number;
}

export const FloorPlanSvg: React.FC<FloorPlanSvgProps> = ({
  floorPlan,
  project,
  width = 1560,
  height = 760,
  showGrids = true,
  showDimensions = true,
  showMemberLabels = true,
  showSectionSizes = true,
  showSlabs = true,
  showPileCaps = true,
  showGradeBeams = true,
  showLiftCore = false,
  showStaircases = true,
  staircases = {},
  onUpdateStaircase,
  selectedStaircaseId = null,
  onSelectStaircase,
  pileCapDisplayMode = 'BOTH',
  selectedSectionType = 'ALL',
  onSelectSection,
}) => {
  const bounds = floorPlan.bounds;
  const modelW = Math.max(bounds.width, 10);
  const modelH = Math.max(bounds.height, 10);

  const isFoundation = floorPlan.isFoundationLevel;

  // Staircase Interactive Moving State
  const [draggingStairId, setDraggingStairId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{
    mouseX: number;
    mouseY: number;
    stairX: number;
    stairY: number;
  } | null>(null);
  const [hoveredStairId, setHoveredStairId] = useState<string | null>(null);
  const [internalSelectedStairId, setInternalSelectedStairId] = useState<string | null>(null);

  const activeSelectedStairId = selectedStaircaseId !== undefined && selectedStaircaseId !== null
    ? selectedStaircaseId
    : internalSelectedStairId;

  // Active Floor Staircases
  const activeFloorId = `floor_${floorPlan.levelIndex}`;
  const levelStaircases = useMemo(() => {
    const allStairs = Object.values(staircases || {});
    const filtered = allStairs.filter((s) => s.floorId === activeFloorId);
    if (filtered.length > 0) return filtered;
    // Fallback: if no specific stair for this floor, show stairs defined on floor 0 / 1 on superstructures
    if (!isFoundation && allStairs.length > 0) {
      return allStairs;
    }
    return [];
  }, [staircases, activeFloorId, isFoundation]);

  // Viewport for Layout Plan
  const drawX0 = isFoundation ? 60 : 100;
  const drawY0 = isFoundation ? 60 : 60;
  const drawAreaW = isFoundation ? 460 : 780;
  const drawAreaH = isFoundation ? 480 : 480;

  const scale = Math.min(drawAreaW / modelW, drawAreaH / modelH) * 0.85;

  const planCenterX = drawX0 + drawAreaW / 2;
  const planCenterY = drawY0 + drawAreaH / 2;

  const modelCenterX = (bounds.minX + bounds.maxX) / 2;
  const modelCenterZ = (bounds.minZ + bounds.maxZ) / 2;

  const toSvgX = (x: number) => planCenterX + (x - modelCenterX) * scale;
  const toSvgY = (z: number) => planCenterY + (z - modelCenterZ) * scale;
  const toWorldX = (svgX: number) => modelCenterX + (svgX - planCenterX) / scale;
  const toWorldZ = (svgY: number) => modelCenterZ + (svgY - planCenterY) / scale;

  // Nudge movement handler
  const handleNudgeStaircase = (stair: ArchitecturalStaircase, dx: number, dz: number) => {
    if (!onUpdateStaircase) return;
    const newX = Math.round((stair.position.x + dx) * 20) / 20;
    const newY = Math.round((stair.position.y + dz) * 20) / 20;
    onUpdateStaircase(stair.id, { position: { x: newX, y: newY } });
  };

  // Rotate staircase handler
  const handleRotateStaircase = (stair: ArchitecturalStaircase) => {
    if (!onUpdateStaircase) return;
    const newRot = ((stair.rotation || 0) + 90) % 360;
    onUpdateStaircase(stair.id, { rotation: newRot });
  };

  // Extract pile cap types present in the building model + combined/shear wall caps
  const uniquePileCapTypes: UniquePileCapType[] = useMemo(() => {
    if (!isFoundation) return [];

    const typeMap = new Map<string, UniquePileCapType>();

    for (const col of floorPlan.columns) {
      if (!col.pileCap) continue;
      // Skip columns that are absorbed into combined pile caps
      if (floorPlan.absorbedCombinedCapNodeIds && floorPlan.absorbedCombinedCapNodeIds.has(col.nodeId)) {
        continue;
      }

      const cap = col.pileCap;
      const count = cap.pileCount;
      const shape = cap.capShape || (count === 3 ? 'TRIANGULAR' : count === 5 ? 'PENTAGONAL' : 'RECTANGULAR');
      const key = `${count}_${shape}`;

      if (!typeMap.has(key)) {
        const secNum = typeMap.size + 1;
        const L = cap.capLength || (count === 5 ? 2316 : 1900);
        const B = cap.capWidth || (count === 5 ? 2399 : 1900);
        const Dp = cap.pileDiameter || 350;
        const s = cap.pileSpacing || 3 * Dp;
        const eo = cap.edgeDistance || Dp;

        // Calculate facet length for pentagon (e.g. 1461 mm)
        const Rp = s / (2 * Math.sin(Math.PI / 5));
        const Rcap = Rp + eo;
        const facetDim = Math.round(2 * Rcap * Math.sin(Math.PI / 5));

        typeMap.set(key, {
          typeId: `TYPE-${secNum}`,
          typeName: `${count}-PILE ${shape}`,
          cap,
          representativeColumn: col,
          associatedColumns: [col.label],
          sectionNum: secNum,
          sectionLabel: `SECTION ${secNum}-${secNum}`,
          count,
          shape,
          L,
          B,
          D: cap.capDepth || 750,
          Dp,
          s,
          eo,
          facetDim: shape === 'PENTAGONAL' ? (cap.capLength ? 1461 : facetDim) : undefined,
        });
      } else {
        typeMap.get(key)!.associatedColumns.push(col.label);
      }
    }

    const types = Array.from(typeMap.values());

    // If combined pile caps exist, append Combined & Shear Wall Mat Cross-Section
    if (floorPlan.combinedPileCaps && floorPlan.combinedPileCaps.length > 0) {
      floorPlan.combinedPileCaps.forEach((grp) => {
        const secNum = types.length + 1;
        types.push({
          typeId: `TYPE-${secNum}`,
          typeName: `${grp.pileCount}-PILE COMBINED / SHEAR WALL MAT`,
          cap: {
            supportNodeId: grp.nodeIds[0],
            pileCount: grp.pileCount,
            capShape: 'RECTANGULAR',
            capLength: grp.capLength,
            capWidth: grp.capWidth,
            capDepth: grp.capDepth,
            pileDiameter: grp.pileDiameter,
            pileSpacing: grp.pileSpacing,
            edgeDistance: grp.edgeDistance,
            rebarCalloutX: grp.botRebarCallout,
            topRebarCallout: grp.topRebarCallout,
            sideFaceRebarCallout: grp.shearWallStirrupCallout,
            rebarCalloutY: grp.botRebarCallout,
          } as any,
          representativeColumn: { columnSlNo: grp.nodeIds[0], label: grp.columnLabels.join('+') } as any,
          associatedColumns: grp.columnLabels,
          sectionNum: secNum,
          sectionLabel: `SECTION ${secNum}-${secNum}`,
          count: grp.pileCount,
          shape: 'COMBINED',
          L: grp.capLength,
          B: grp.capWidth,
          D: grp.capDepth,
          Dp: grp.pileDiameter,
          s: grp.pileSpacing,
          eo: grp.edgeDistance,
        });
      });
    }

    // Fallback if empty
    if (types.length === 0) {
      const Dp = 350;
      const D = 750;
      const s = 3 * Dp;
      const eo = Dp;

      types.push(
        {
          typeId: 'TYPE-1',
          typeName: '4-PILE RECTANGULAR',
          cap: {
            supportNodeId: 1,
            pileCount: 4,
            capShape: 'RECTANGULAR',
            capLength: 1900,
            capWidth: 1900,
            capDepth: D,
            pileDiameter: Dp,
            pileSpacing: s,
            edgeDistance: eo,
            rebarCalloutX: 'T16 @ 150 mm c/c',
            topRebarCallout: 'T12 @ 100 mm c/c',
            sideFaceRebarCallout: '3-T10',
            rebarCalloutY: 'T16 @ 150 mm c/c',
          } as any,
          representativeColumn: { columnSlNo: 1, label: 'C1' } as any,
          associatedColumns: ['C1', 'C4', 'C5', 'C7', 'C8', 'C9', 'C12', 'C13', 'C14', 'C17'],
          sectionNum: 1,
          sectionLabel: 'SECTION 1-1',
          count: 4,
          shape: 'RECTANGULAR',
          L: 1900,
          B: 1900,
          D,
          Dp,
          s,
          eo,
        },
        {
          typeId: 'TYPE-2',
          typeName: '5-PILE PENTAGONAL',
          cap: {
            supportNodeId: 2,
            pileCount: 5,
            capShape: 'PENTAGONAL',
            capLength: 2316,
            capWidth: 2399,
            capDepth: D,
            pileDiameter: Dp,
            pileSpacing: s,
            edgeDistance: eo,
            rebarCalloutX: 'T16 @ 125 mm c/c',
            topRebarCallout: 'T12 @ 100 mm c/c',
            sideFaceRebarCallout: '3-T10',
            rebarCalloutY: 'T16 @ 125 mm c/c',
          } as any,
          representativeColumn: { columnSlNo: 2, label: 'C2' } as any,
          associatedColumns: ['C2', 'C3', 'C6', 'C10', 'C11', 'C15', 'C16', 'C18', 'C19', 'C20'],
          sectionNum: 2,
          sectionLabel: 'SECTION 2-2',
          count: 5,
          shape: 'PENTAGONAL',
          L: 2316,
          B: 2399,
          D,
          Dp,
          s,
          eo,
          facetDim: 1461,
        }
      );
    }

    // PC annotation: 2P=PC1, 3P=PC2, 4P=PC3 per user spec (PC = pileCount -1)
    const sorted = [...types].sort((a, b) => a.count - b.count);
    const usedPc = new Set<string>();
    return sorted.map((t) => {
      let pcNum = Math.max(1, t.count - 1);
      while (usedPc.has(`PC${pcNum}`)) pcNum++;
      usedPc.add(`PC${pcNum}`);
      return {
        ...t,
        typeId: `PC${pcNum}`,
        sectionNum: pcNum,
        sectionLabel: `SECTION ${pcNum}-${pcNum}`,
      };
    });
  }, [floorPlan.columns, floorPlan.combinedPileCaps, floorPlan.absorbedCombinedCapNodeIds, isFoundation]);

  const [localSectionFilter, setLocalSectionFilter] = useState<string>(selectedSectionType || 'ALL');

  React.useEffect(() => {
    if (selectedSectionType) {
      setLocalSectionFilter(selectedSectionType);
    }
  }, [selectedSectionType]);

  const handleSelectFilter = (id: string) => {
    setLocalSectionFilter(id);
    onSelectSection?.(id);
  };

  const activeSectionFilter = localSectionFilter || selectedSectionType || 'ALL';

  const visibleTypes = useMemo(() => {
    if (activeSectionFilter === 'ALL') return uniquePileCapTypes;
    return uniquePileCapTypes.filter(
      (t) => t.typeId === activeSectionFilter || t.sectionLabel.includes(activeSectionFilter) || (activeSectionFilter === 'COMBINED' && t.shape === 'COMBINED')
    );
  }, [uniquePileCapTypes, activeSectionFilter]);

  return (
    <div className="flex flex-col items-center bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-2xl overflow-x-auto font-mono">
      {/* Top Sheet Header Banner */}
      <div className="flex items-center justify-between w-full mb-2 px-2 text-xs text-slate-400">
        <span className="font-bold text-sky-400 flex items-center gap-2">
          <span className="px-2 py-0.5 bg-sky-950 text-sky-300 rounded border border-sky-800 text-[11px]">
            {floorPlan.sheetNumber}
          </span>
          <span>{floorPlan.levelName}</span>
        </span>
        <div className="flex items-center gap-2">
          {isFoundation && (
            <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
              <span className="text-slate-400 font-semibold">VIEW SECTIONS:</span>
              <button
                onClick={() => handleSelectFilter('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] ${
                  activeSectionFilter === 'ALL' ? 'bg-sky-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                ALL TYPES ({uniquePileCapTypes.length})
              </button>
              {uniquePileCapTypes.map((t) => (
                <button
                  key={t.typeId}
                  onClick={() => handleSelectFilter(t.typeId)}
                  className={`px-2 py-0.5 rounded text-[10px] ${
                    activeSectionFilter === t.typeId ? 'bg-indigo-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.typeName} ({t.sectionLabel})
                </button>
              ))}
            </div>
          )}
          <span className="text-[11px] text-slate-500 font-sans">
            Scale: 1:100 @ A3 • IS 456 / IS 2911 / IS 13920 Detailing Sheet
          </span>
        </div>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="select-none text-xs"
        onMouseMove={(e) => {
          if (draggingStairId && dragStartPos && onUpdateStaircase) {
            const dx = (e.clientX - dragStartPos.mouseX) / scale;
            const dz = (e.clientY - dragStartPos.mouseY) / scale;
            const newX = Math.round((dragStartPos.stairX + dx) * 20) / 20;
            const newZ = Math.round((dragStartPos.stairY + dz) * 20) / 20;
            onUpdateStaircase(draggingStairId, { position: { x: newX, y: newZ } });
          }
        }}
        onMouseUp={() => {
          setDraggingStairId(null);
          setDragStartPos(null);
        }}
        onMouseLeave={() => {
          setDraggingStairId(null);
          setDragStartPos(null);
        }}
      >
        {/* SVG Arrowhead & Marker Definitions */}
        <defs>
          <marker id="arrow-dim" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#94a3b8" />
          </marker>
          <marker id="tick-45" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
            <line x1="2" y1="8" x2="8" y2="2" stroke="#dc2626" strokeWidth="1.5" />
          </marker>
          {/* Authentic AutoCAD Dimension Arrowheads */}
          <marker id="cad-arrow" viewBox="0 0 12 6" refX="12" refY="3" markerWidth="7" markerHeight="4" orient="auto">
            <path d="M 0 0 L 12 3 L 0 6 z" fill="#dc2626" />
          </marker>
          <marker id="cad-arrow-start" viewBox="0 0 12 6" refX="0" refY="3" markerWidth="7" markerHeight="4" orient="auto">
            <path d="M 12 0 L 0 3 L 12 6 z" fill="#dc2626" />
          </marker>
          <marker id="cad-leader-arrow" viewBox="0 0 10 6" refX="0" refY="3" markerWidth="6" markerHeight="4" orient="auto-start-reverse">
            <polygon points="0 3, 10 0, 10 6" fill="#dc2626" />
          </marker>
          <marker id="arrow-orange" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#f97316" />
          </marker>
          <marker id="arrow-purple" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#a78bfa" />
          </marker>
          <marker id="arrow-green" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#10b981" />
          </marker>
          <marker id="arrow-cyan" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* 1. Main Sheet Border */}
        <rect x="12" y="12" width={width - 24} height={height - 24} fill="#090d16" stroke="#334155" strokeWidth="2" />
        <rect x="16" y="16" width={width - 32} height={height - 32} fill="#020617" stroke="#1e293b" strokeWidth="1" />

        {/* 2. Column Centerline Grid Lines (X & Z) */}
        {showGrids && (
          <g>
            {/* X Grid Lines */}
            {floorPlan.gridLinesX.map((gl) => {
              const gx = toSvgX(gl.coord);
              const gz1 = toSvgY(bounds.minZ - 1.0);
              const gz2 = toSvgY(bounds.maxZ + 1.0);

              return (
                <g key={`grid_x_${gl.id}`}>
                  <line
                    x1={gx}
                    y1={gz1}
                    x2={gx}
                    y2={gz2}
                    stroke="#475569"
                    strokeWidth="0.8"
                    strokeDasharray="6,4"
                  />
                  <circle cx={gx} cy={gz1 - 14} r="9" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1.2" />
                  <text x={gx} y={gz1 - 10.5} fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
                    {gl.id}
                  </text>
                  <circle cx={gx} cy={gz2 + 14} r="9" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1.2" />
                  <text x={gx} y={gz2 + 17.5} fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
                    {gl.id}
                  </text>
                </g>
              );
            })}

            {/* Z Grid Lines */}
            {floorPlan.gridLinesZ.map((gl) => {
              const gz = toSvgY(gl.coord);
              const gx1 = toSvgX(bounds.minX - 1.0);
              const gx2 = toSvgX(bounds.maxX + 1.0);

              return (
                <g key={`grid_z_${gl.id}`}>
                  <line
                    x1={gx1}
                    y1={gz}
                    x2={gx2}
                    y2={gz}
                    stroke="#475569"
                    strokeWidth="0.8"
                    strokeDasharray="6,4"
                  />
                  <circle cx={gx1 - 14} cy={gz} r="9" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1.2" />
                  <text x={gx1 - 14} y={gz + 3.5} fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
                    {gl.id}
                  </text>
                  <circle cx={gx2 + 14} cy={gz} r="9" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1.2" />
                  <text x={gx2 + 14} y={gz + 3.5} fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
                    {gl.id}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* 3. Slab Panels (Elevated Floors) */}
        {showSlabs && !floorPlan.isFoundationLevel && (
          <g>
            {floorPlan.slabs.map((slab) => {
              const polyPoints = slab.points.map((p) => `${toSvgX(p.x)},${toSvgY(p.z)}`).join(' ');
              const cx = slab.points.reduce((acc, p) => acc + toSvgX(p.x), 0) / (slab.points.length || 1);
              const cy = slab.points.reduce((acc, p) => acc + toSvgY(p.z), 0) / (slab.points.length || 1);

              return (
                <g key={`slab_${slab.id}`}>
                  <polygon
                    points={polyPoints}
                    fill="#0284c7"
                    fillOpacity="0.08"
                    stroke="#0284c7"
                    strokeWidth="0.5"
                    strokeDasharray="3,3"
                  />
                  <text x={cx} y={cy - 4} fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">
                    {slab.label}
                  </text>
                  <text x={cx} y={cy + 7} fill="#7dd3fc" fontSize="6.5" textAnchor="middle">
                    THK: {slab.thickness}mm
                  </text>
                </g>
              );
            })}
          </g>
        )}        {/* 4. Foundation Grade Beams & Pile Caps (Foundation Level) — hidden when SECTION only */}
        {floorPlan.isFoundationLevel && pileCapDisplayMode !== 'SECTION' && (
          <g>
            {/* Grade Beams (Double Lines) */}
            {showGradeBeams &&
              floorPlan.gradeBeams.map((gb) => {
                // If this grade beam is internal to a combined/shear wall pile cap, suppress it
                const isInternalToShearWall = floorPlan.combinedPileCaps?.some((grp) => {
                  const isWallGrp = grp.reason === 'SHEAR_WALL' || grp.nodeIds.length >= 3 || Boolean(grp.wallFootprint);
                  if (!isWallGrp) return false;
                  const startIn = grp.columnLabels.includes(gb.startColumnLabel) || grp.columnLabels.includes(`C${gb.startColumnLabel.replace(/\D/g, '')}`);
                  const endIn = grp.columnLabels.includes(gb.endColumnLabel) || grp.columnLabels.includes(`C${gb.endColumnLabel.replace(/\D/g, '')}`);
                  return startIn && endIn;
                });
                if (isInternalToShearWall) return null;

                const x1 = toSvgX(gb.startX);
                const y1 = toSvgY(gb.startZ);
                const x2 = toSvgX(gb.endX);
                const y2 = toSvgY(gb.endZ);

                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.hypot(dx, dy);
                if (len < 1) return null;

                const nx = -dy / len;
                const ny = dx / len;
                const hw = Math.max(3.5, ((gb.width / 1000) / 2) * scale);

                const p1 = `${x1 + nx * hw},${y1 + ny * hw}`;
                const p2 = `${x2 + nx * hw},${y2 + ny * hw}`;
                const p3 = `${x2 - nx * hw},${y2 - ny * hw}`;
                const p4 = `${x1 - nx * hw},${y1 - ny * hw}`;

                let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
                if (angleDeg > 90) angleDeg -= 180;
                if (angleDeg < -90) angleDeg += 180;

                const isShort = len < 45;
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;
                const textStr = isShort ? gb.gradeBeamId : `${gb.gradeBeamId} (${gb.width}×${gb.depth})`;
                const textWidth = textStr.length * 5.2 + 8;

                return (
                  <g key={`gb_${gb.gradeBeamId}`}>
                    <polygon
                      points={`${p1} ${p2} ${p3} ${p4}`}
                      fill="#1e1b4b"
                      fillOpacity="0.45"
                      stroke="#6366f1"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                    {showMemberLabels && len >= 35 && (
                      <g transform={`translate(${midX}, ${midY}) rotate(${angleDeg})`}>
                        <rect
                          x={-textWidth / 2}
                          y="-5.5"
                          width={textWidth}
                          height={11}
                          fill="#020617"
                          stroke="#4f46e5"
                          strokeWidth="0.7"
                          rx="2"
                        />
                        <text x="0" y="2.5" fill="#c7d2fe" fontSize="6.8" fontWeight="bold" textAnchor="middle">
                          {textStr}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

            {/* Pile Caps in Plan (Excludes Absorbed Columns in Combined/Shear Wall Caps) */}
            {showPileCaps &&
              floorPlan.columns.map((col) => {
                const cap = col.pileCap;
                const cx = toSvgX(col.x);
                const cy = toSvgY(col.z);

                if (!cap) return null;

                // SUPPRESS individual pile cap if column is absorbed into a Combined or Shear Wall Pile Cap
                const isAbsorbedInCombined = floorPlan.combinedPileCaps?.some((grp) =>
                  grp.nodeIds.includes(col.nodeId) ||
                  grp.columnLabels.includes(col.label) ||
                  grp.columnLabels.includes(`C${col.columnSlNo}`) ||
                  (floorPlan.absorbedCombinedCapNodeIds && floorPlan.absorbedCombinedCapNodeIds.has(col.nodeId))
                );
                if (isAbsorbedInCombined) {
                  return null;
                }

                const capL = (cap.capLength / 1000) * scale;
                const capW = (cap.capWidth / 1000) * scale;
                const count = cap.pileCount;
                const shape = cap.capShape || (count === 3 ? 'TRIANGULAR' : count === 5 ? 'PENTAGONAL' : 'RECTANGULAR');

                return (
                  <g key={`pc_${col.columnSlNo}_${col.nodeId}`}>
                    {shape === 'PENTAGONAL' ? (
                      (() => {
                        const Rp = ((cap.pileSpacing / (2 * Math.sin(Math.PI / 5))) / 1000) * scale;
                        const Rcap = Rp + (cap.edgeDistance / 1000) * scale;
                        const cos18 = Math.cos(Math.PI / 10);
                        const sin18 = Math.sin(Math.PI / 10);
                        const sin36 = Math.sin(Math.PI / 5);
                        const cos36 = Math.cos(Math.PI / 5);
                        const p1 = `${cx},${cy - Rcap}`;
                        const p2 = `${cx - Rcap * cos18},${cy - Rcap * sin18}`;
                        const p3 = `${cx - Rcap * sin36},${cy + Rcap * cos36}`;
                        const p4 = `${cx + Rcap * sin36},${cy + Rcap * cos36}`;
                        const p5 = `${cx + Rcap * cos18},${cy - Rcap * sin18}`;
                        return (
                          <polygon
                            points={`${p1} ${p2} ${p3} ${p4} ${p5}`}
                            fill="#1e1b4b"
                            fillOpacity="0.85"
                            stroke="#818cf8"
                            strokeWidth="1.8"
                          />
                        );
                      })()
                    ) : (
                      <rect
                        x={cx - capL / 2}
                        y={cy - capW / 2}
                        width={capL}
                        height={capW}
                        fill="#1e1b4b"
                        fillOpacity="0.85"
                        stroke="#818cf8"
                        strokeWidth="1.8"
                        rx="3"
                      />
                    )}

                    {/* Bored Piles in Plan */}
                    {cap.pileOffsets &&
                      cap.pileOffsets.map((off, pIdx) => {
                        const px = cx + (off.x / 1000) * scale;
                        const py = cy - (off.y / 1000) * scale;
                        const rPile = Math.max(3.5, (cap.pileDiameter / 2000) * scale);
                        return (
                          <circle
                            key={`p_${pIdx}`}
                            cx={px}
                            cy={py}
                            r={rPile}
                            fill="#312e81"
                            stroke="#c084fc"
                            strokeWidth="1.5"
                          />
                        );
                      })}

                    {/* Pile Cap Text Badge — PC per pile count: 2P=PC1, 3P=PC2, 4P=PC3 */}
                    <text x={cx} y={cy - capW / 2 - 4} fill="#a5b4fc" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                      PC{Math.max(1, count - 1)} ({count}P)
                    </text>
                  </g>
                );
              })}
          </g>
        )}

        {/* 4b. COMBINED PILE CAPS: Shear Wall Caps & Merged Close Column Caps (Foundation Level) */}
        {isFoundation && showPileCaps && floorPlan.combinedPileCaps && floorPlan.combinedPileCaps.length > 0 && (
          <g>
            {floorPlan.combinedPileCaps.map((grp) => {
              // Center of combined cap bounding box in SVG coordinates
              const cx = toSvgX((grp.minX + grp.maxX) / 2);
              const cy = toSvgY((grp.minZ + grp.maxZ) / 2);
              const capLpx = (grp.capLength / 1000) * scale;
              const capBpx = (grp.capWidth / 1000) * scale;
              const isShearWall = grp.reason === 'SHEAR_WALL' || grp.nodeIds.length >= 3 || Boolean(grp.wallFootprint);
              const capColor = isShearWall ? '#450a0a' : '#14532d';
              const capStroke = isShearWall ? '#f43f5e' : '#4ade80';
              const pileColor = isShearWall ? '#fb7185' : '#16a34a';
              const textColor = isShearWall ? '#fecdd3' : '#bbf7d0';

              // Outer PCC boundary
              const pccPad = (150 / 1000) * scale;

              return (
                <g key={`cpc_${grp.groupId}`}>
                  {/* PCC Outer Boundary (blue dashed) */}
                  <rect
                    x={cx - capLpx / 2 - pccPad}
                    y={cy - capBpx / 2 - pccPad}
                    width={capLpx + 2 * pccPad}
                    height={capBpx + 2 * pccPad}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1"
                    strokeDasharray="5,3"
                  />
                  {/* Combined Cap Body (double-line thick boundary) */}
                  <rect
                    x={cx - capLpx / 2}
                    y={cy - capBpx / 2}
                    width={capLpx}
                    height={capBpx}
                    fill={capColor}
                    fillOpacity="0.8"
                    stroke={capStroke}
                    strokeWidth="3"
                    rx="3"
                  />
                  {/* Inner outline (double-line effect) */}
                  <rect
                    x={cx - capLpx / 2 + 3}
                    y={cy - capBpx / 2 + 3}
                    width={capLpx - 6}
                    height={capBpx - 6}
                    fill="none"
                    stroke={capStroke}
                    strokeWidth="0.8"
                    strokeOpacity="0.6"
                    rx="2"
                  />

                  {/* Piles in plan view */}
                  {grp.pileOffsets.map((off, pIdx) => {
                    const px = cx + (off.x / 1000) * scale;
                    const py = cy - (off.z / 1000) * scale;
                    const rPile = Math.max(4, (grp.pileDiameter / 2000) * scale);
                    return (
                      <g key={`cpc_pile_${pIdx}`}>
                        <circle cx={px} cy={py} r={rPile} fill={capColor} stroke={pileColor} strokeWidth="1.8" />
                        <line x1={px - rPile} y1={py} x2={px + rPile} y2={py} stroke={pileColor} strokeWidth="0.8" />
                        <line x1={px} y1={py - rPile} x2={px} y2={py + rPile} stroke={pileColor} strokeWidth="0.8" />
                      </g>
                    );
                  })}

                  {/* Continuous RC Shear Wall / U-Shaped Core Wall Footprint — wall figure always visible, text hidden when showLiftCore=false */}
                  {isShearWall && (
                    <g key={`sw_footprint_${grp.groupId}`}>
                      {(() => {
                        const twPx = Math.max(7, 0.23 * scale);
                        const bePx = Math.max(12, 0.45 * scale);
                        const wf = grp.wallFootprint;

                        // If we have actual footprint segments, render them exactly (correct U orientation, no mirrored web)
                        if (wf && wf.segments && wf.segments.length > 0) {
                          const wallRects = wf.segments.map((seg, idx) => {
                            const x1 = toSvgX(seg.x1);
                            const y1 = toSvgY(seg.z1);
                            const x2 = toSvgX(seg.x2);
                            const y2 = toSvgY(seg.z2);
                            const isHorizontal = Math.abs(seg.z1 - seg.z2) < 0.01;
                            const lenPx = Math.hypot(x2 - x1, y2 - y1);
                            if (isHorizontal) {
                              const minX = Math.min(x1, x2);
                              const maxX = Math.max(x1, x2);
                              return (
                                <rect
                                  key={`seg_${idx}`}
                                  x={minX - twPx / 2}
                                  y={y1 - twPx / 2}
                                  width={Math.max(twPx, Math.abs(maxX - minX) + twPx)}
                                  height={twPx}
                                  fill="#881337"
                                  stroke="#f43f5e"
                                  strokeWidth="2.2"
                                />
                              );
                            } else {
                              const minY = Math.min(y1, y2);
                              const maxY = Math.max(y1, y2);
                              return (
                                <rect
                                  key={`seg_${idx}`}
                                  x={x1 - twPx / 2}
                                  y={minY - twPx / 2}
                                  width={twPx}
                                  height={Math.max(twPx, Math.abs(maxY - minY) + twPx)}
                                  fill="#881337"
                                  stroke="#f43f5e"
                                  strokeWidth="2.2"
                                />
                              );
                            }
                          });

                          // Boundary element zones from footprint
                          const beZones = (wf.boundaryZones || []).map((bz, bIdx) => {
                            const bx = toSvgX(bz.cx);
                            const by = toSvgY(bz.cz);
                            return (
                              <g key={`be_wf_${bIdx}`}>
                                <rect x={bx - bePx / 2} y={by - bePx / 2} width={bePx} height={bePx} fill="#ca8a04" stroke="#eab308" strokeWidth="1.5" />
                                <line x1={bx - bePx / 2} y1={by - bePx / 2} x2={bx + bePx / 2} y2={by + bePx / 2} stroke="#a16207" strokeWidth="0.8" />
                                <line x1={bx - bePx / 2} y1={by + bePx / 2} x2={bx + bePx / 2} y2={by - bePx / 2} stroke="#a16207" strokeWidth="0.8" />
                              </g>
                            );
                          });

                          // For U shape, also draw lift shaft X hatch inside the U
                          const isU = wf.shape === 'U_SHAPE';
                          const cx = toSvgX((grp.minX + grp.maxX) / 2);
                          const cy = toSvgY((grp.minZ + grp.maxZ) / 2);
                          // Approximate hatch bounds: use min/max of footprint
                          const allXs = wf.segments.flatMap(s => [s.x1, s.x2]);
                          const allZs = wf.segments.flatMap(s => [s.z1, s.z2]);
                          const hatchX1 = toSvgX(Math.min(...allXs)) + twPx / 2;
                          const hatchX2 = toSvgX(Math.max(...allXs)) - twPx / 2;
                          const hatchY1 = toSvgY(Math.min(...allZs)) + twPx / 2;
                          const hatchY2 = toSvgY(Math.max(...allZs)) - twPx / 2;

                          return (
                            <g>
                              {wallRects}
                              {beZones}
                              {isU && (
                                <>
                                  {/* Rebar guide along each segment centerline */}
                                  {wf.segments.map((seg, i) => (
                                    <line
                                      key={`guide_${i}`}
                                      x1={toSvgX(seg.x1)}
                                      y1={toSvgY(seg.z1)}
                                      x2={toSvgX(seg.x2)}
                                      y2={toSvgY(seg.z2)}
                                      stroke="#fca5a5"
                                      strokeWidth="1"
                                      strokeDasharray="3,2"
                                    />
                                  ))}
                                  <line x1={hatchX1} y1={hatchY1} x2={hatchX2} y2={hatchY2} stroke="#f43f5e" strokeWidth="0.7" strokeDasharray="3,3" />
                                  <line x1={hatchX2} y1={hatchY1} x2={hatchX1} y2={hatchY2} stroke="#f43f5e" strokeWidth="0.7" strokeDasharray="3,3" />
                                  {showLiftCore && (
                                    <>
                                      <rect x={cx - 45} y={cy - 7} width={90} height={14} fill="#0f172a" fillOpacity="0.9" stroke="#f43f5e" strokeWidth="0.8" rx="2" />
                                      <text x={cx} y={cy + 3} fill="#fecdd3" fontSize="7" fontWeight="bold" textAnchor="middle">
                                        LIFT CORE (tw=230)
                                      </text>
                                    </>
                                  )}
                                </>
                              )}
                              {!isU && showLiftCore && (
                                <text x={cx} y={cy + 3} fill="#fecdd3" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                                  RC SHEAR WALL (tw=230)
                                </text>
                              )}
                            </g>
                          );
                        }

                        // Fallback: legacy generic U / straight logic (for older data without wallFootprint)
                        const xMin = toSvgX(grp.minX);
                        const xMax = toSvgX(grp.maxX);
                        const zMin = toSvgY(grp.minZ);
                        const zMax = toSvgY(grp.maxZ);
                        const isUShape = grp.wallFootprint?.shape === 'U_SHAPE' || (Math.abs(xMax - xMin) > 0.8 && Math.abs(zMax - zMin) > 0.8);
                        if (isUShape) {
                          const zTop = Math.min(zMin, zMax);
                          const zBottom = Math.max(zMin, zMax);
                          const xLeft = Math.min(xMin, xMax);
                          const xRight = Math.max(xMin, xMax);
                          return (
                            <g>
                              <rect x={xLeft - twPx / 2} y={zTop - twPx / 2} width={twPx} height={zBottom - zTop + twPx} fill="#881337" stroke="#f43f5e" strokeWidth="2.2" />
                              <rect x={xLeft - twPx / 2} y={zTop - twPx / 2} width={xRight - xLeft + twPx} height={twPx} fill="#881337" stroke="#f43f5e" strokeWidth="2.2" />
                              <rect x={xRight - twPx / 2} y={zTop - twPx / 2} width={twPx} height={zBottom - zTop + twPx} fill="#881337" stroke="#f43f5e" strokeWidth="2.2" />
                              {[
                                { bx: xLeft, by: zTop },
                                { bx: xLeft, by: zBottom },
                                { bx: xRight, by: zTop },
                                { bx: xRight, by: zBottom },
                              ].map((bpos, bIdx) => (
                                <g key={`be_u_${bIdx}`}>
                                  <rect x={bpos.bx - bePx / 2} y={bpos.by - bePx / 2} width={bePx} height={bePx} fill="#ca8a04" stroke="#eab308" strokeWidth="1.5" />
                                  <line x1={bpos.bx - bePx / 2} y1={bpos.by - bePx / 2} x2={bpos.bx + bePx / 2} y2={bpos.by + bePx / 2} stroke="#a16207" strokeWidth="0.8" />
                                  <line x1={bpos.bx - bePx / 2} y1={bpos.by + bePx / 2} x2={bpos.bx + bePx / 2} y2={bpos.by - bePx / 2} stroke="#a16207" strokeWidth="0.8" />
                                </g>
                              ))}
                              <line x1={xLeft} y1={zTop} x2={xLeft} y2={zBottom} stroke="#fca5a5" strokeWidth="1" strokeDasharray="3,2" />
                              <line x1={xLeft} y1={zTop} x2={xRight} y2={zTop} stroke="#fca5a5" strokeWidth="1" strokeDasharray="3,2" />
                              <line x1={xRight} y1={zTop} x2={xRight} y2={zBottom} stroke="#fca5a5" strokeWidth="1" strokeDasharray="3,2" />
                              <line x1={xLeft + twPx / 2} y1={zTop + twPx / 2} x2={xRight - twPx / 2} y2={zBottom} stroke="#f43f5e" strokeWidth="0.7" strokeDasharray="3,3" />
                              <line x1={xRight - twPx / 2} y1={zTop + twPx / 2} x2={xLeft + twPx / 2} y2={zBottom} stroke="#f43f5e" strokeWidth="0.7" strokeDasharray="3,3" />
                              {showLiftCore && (
                                <>
                                  <rect x={(xLeft + xRight) / 2 - 45} y={(zTop + zBottom) / 2 - 7} width={90} height={14} fill="#0f172a" fillOpacity="0.9" stroke="#f43f5e" strokeWidth="0.8" rx="2" />
                                  <text x={(xLeft + xRight) / 2} y={(zTop + zBottom) / 2 + 3} fill="#fecdd3" fontSize="7" fontWeight="bold" textAnchor="middle">
                                    LIFT CORE (tw=230)
                                  </text>
                                </>
                              )}
                            </g>
                          );
                        } else {
                          return (
                            <g>
                              <rect x={Math.min(xMin, xMax) - twPx / 2} y={Math.min(zMin, zMax) - twPx / 2} width={Math.max(twPx, Math.abs(xMax - xMin))} height={Math.max(twPx, Math.abs(zMax - zMin))} fill="#881337" stroke="#f43f5e" strokeWidth="2.2" />
                              {showLiftCore && (
                                <text x={(xMin + xMax) / 2} y={(zMin + zMax) / 2 + 3} fill="#fecdd3" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                                  RC SHEAR WALL (tw=230)
                                </text>
                              )}
                            </g>
                          );
                        }
                      })()}
                    </g>
                  )}

                  {/* Top label badge — PC-SW (18P) hidden per user request, only shows for non-SW merged caps */}
                  {!isShearWall && (
                    <>
                      <rect x={cx - 60} y={cy - capBpx / 2 - 14} width={120} height={13} fill="#0f172a" fillOpacity="0.95" stroke={capStroke} strokeWidth="0.8" rx="2" />
                      <text x={cx} y={cy - capBpx / 2 - 5} fill={textColor} fontSize="7.5" fontWeight="bold" textAnchor="middle">
                        {`PC-${grp.columnLabels[0]}+${grp.columnLabels[1]} (${grp.pileCount}P)`}
                      </text>
                    </>
                  )}

                  {/* Red Top Width Dimension (Well above the badge so they never collide!) */}
                  <line
                    x1={cx - capLpx / 2}
                    y1={cy - capBpx / 2 - 24}
                    x2={cx + capLpx / 2}
                    y2={cy - capBpx / 2 - 24}
                    stroke="#ef4444"
                    strokeWidth="0.8"
                    markerStart="url(#cad-arrow-start)"
                    markerEnd="url(#cad-arrow)"
                  />
                  <line x1={cx - capLpx / 2} y1={cy - capBpx / 2} x2={cx - capLpx / 2} y2={cy - capBpx / 2 - 26} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1={cx + capLpx / 2} y1={cy - capBpx / 2} x2={cx + capLpx / 2} y2={cy - capBpx / 2 - 26} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                  <rect x={cx - 16} y={cy - capBpx / 2 - 30} width={32} height={10} fill="#020617" rx="2" />
                  <text x={cx} y={cy - capBpx / 2 - 22} fill="#f87171" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                    {grp.capLength}
                  </text>

                  {/* Clean Bottom Dimensions & Rebar details */}
                  <text x={cx} y={cy + capBpx / 2 + 10} fill={capStroke} fontSize="6.8" fontWeight="bold" textAnchor="middle">
                    {grp.pileCount}P · {grp.capLength}×{grp.capWidth}×{grp.capDepth} mm
                  </text>
                  <text x={cx} y={cy + capBpx / 2 + 18} fill="#94a3b8" fontSize="6.2" textAnchor="middle">
                    {grp.botRebarCallout}
                  </text>
                  {isShearWall && (
                    <text x={cx} y={cy + capBpx / 2 + 26} fill="#fdba74" fontSize="5.8" textAnchor="middle">
                      ({grp.columnLabels.join(' · ')})
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* 4c. ELEVATED FLOORS: Continuous Shear Wall & Lift Core Footprints — hidden when showLiftCore=false */}
        {!floorPlan.isFoundationLevel && showLiftCore && floorPlan.combinedPileCaps && (
          <g>
            {floorPlan.combinedPileCaps
              .filter((grp) => grp.reason === 'SHEAR_WALL' || grp.wallFootprint || grp.nodeIds.length >= 3)
              .map((grp) => {
                const twPx = Math.max(7, 0.23 * scale);
                const bePx = Math.max(12, 0.45 * scale);
                const wf = grp.wallFootprint;
                if (wf && wf.segments && wf.segments.length > 0) {
                  const wallRects = wf.segments.map((seg, idx) => {
                    const x1 = toSvgX(seg.x1);
                    const y1 = toSvgY(seg.z1);
                    const x2 = toSvgX(seg.x2);
                    const y2 = toSvgY(seg.z2);
                    const isHoriz = Math.abs(seg.z1 - seg.z2) < 0.01;
                    if (isHoriz) {
                      const minX = Math.min(x1, x2);
                      const maxX = Math.max(x1, x2);
                      return <rect key={`elev_seg_${idx}`} x={minX - twPx / 2} y={y1 - twPx / 2} width={Math.max(twPx, Math.abs(maxX - minX) + twPx)} height={twPx} fill="#881337" stroke="#f43f5e" strokeWidth="2.2" />;
                    } else {
                      const minY = Math.min(y1, y2);
                      const maxY = Math.max(y1, y2);
                      return <rect key={`elev_seg_${idx}`} x={x1 - twPx / 2} y={minY - twPx / 2} width={twPx} height={Math.max(twPx, Math.abs(maxY - minY) + twPx)} fill="#881337" stroke="#f43f5e" strokeWidth="2.2" />;
                    }
                  });
                  const beZones = (wf.boundaryZones || []).map((bz, bIdx) => {
                    const bx = toSvgX(bz.cx);
                    const by = toSvgY(bz.cz);
                    return (
                      <g key={`elev_be_wf_${bIdx}`}>
                        <rect x={bx - bePx / 2} y={by - bePx / 2} width={bePx} height={bePx} fill="#ca8a04" stroke="#eab308" strokeWidth="1.5" />
                        <line x1={bx - bePx / 2} y1={by - bePx / 2} x2={bx + bePx / 2} y2={by + bePx / 2} stroke="#a16207" strokeWidth="0.8" />
                        <line x1={bx - bePx / 2} y1={by + bePx / 2} x2={bx + bePx / 2} y2={by - bePx / 2} stroke="#a16207" strokeWidth="0.8" />
                      </g>
                    );
                  });
                  const cx = toSvgX((grp.minX + grp.maxX) / 2);
                  const cy = toSvgY((grp.minZ + grp.maxZ) / 2);
                  const isU = wf.shape === 'U_SHAPE';
                  const allXs = wf.segments.flatMap(s => [s.x1, s.x2]);
                  const allZs = wf.segments.flatMap(s => [s.z1, s.z2]);
                  const hatchX1 = toSvgX(Math.min(...allXs)) + twPx / 2;
                  const hatchX2 = toSvgX(Math.max(...allXs)) - twPx / 2;
                  const hatchY1 = toSvgY(Math.min(...allZs)) + twPx / 2;
                  const hatchY2 = toSvgY(Math.max(...allZs)) - twPx / 2;
                  return (
                    <g key={`elev_sw_${grp.groupId}`}>
                      {wallRects}
                      {beZones}
                      {isU && (
                        <>
                          {wf.segments.map((seg, i) => (
                            <line key={`elev_guide_${i}`} x1={toSvgX(seg.x1)} y1={toSvgY(seg.z1)} x2={toSvgX(seg.x2)} y2={toSvgY(seg.z2)} stroke="#fca5a5" strokeWidth="1" strokeDasharray="3,2" />
                          ))}
                          <line x1={hatchX1} y1={hatchY1} x2={hatchX2} y2={hatchY2} stroke="#f43f5e" strokeWidth="0.8" strokeDasharray="3,3" />
                          <line x1={hatchX2} y1={hatchY1} x2={hatchX1} y2={hatchY2} stroke="#f43f5e" strokeWidth="0.8" strokeDasharray="3,3" />
                          {showLiftCore && (
                            <>
                              <rect x={cx - 45} y={cy - 8} width={90} height={16} fill="#0f172a" stroke="#f43f5e" strokeWidth="0.8" rx="2" />
                              <text x={cx} y={cy + 4} fill="#fecdd3" fontSize="8" fontWeight="bold" textAnchor="middle">
                                LIFT CORE (tw=230)
                              </text>
                            </>
                          )}
                        </>
                      )}
                      {!isU && showLiftCore && <text x={cx} y={cy + 3} fill="#fecdd3" fontSize="7.5" fontWeight="bold" textAnchor="middle">RC SHEAR WALL (tw=230)</text>}
                    </g>
                  );
                }
                // Fallback legacy
                const xMin = toSvgX(grp.minX);
                const xMax = toSvgX(grp.maxX);
                const zMin = toSvgY(grp.minZ);
                const zMax = toSvgY(grp.maxZ);
                const isUShape = grp.wallFootprint?.shape === 'U_SHAPE' || (Math.abs(xMax - xMin) > 0.8 && Math.abs(zMax - zMin) > 0.8);
                if (isUShape) {
                  const zTop = Math.min(zMin, zMax);
                  const zBottom = Math.max(zMin, zMax);
                  const xLeft = Math.min(xMin, xMax);
                  const xRight = Math.max(xMin, xMax);
                  return (
                    <g key={`elev_sw_${grp.groupId}`}>
                      <rect x={xLeft - twPx / 2} y={zTop - twPx / 2} width={twPx} height={zBottom - zTop + twPx} fill="#881337" stroke="#f43f5e" strokeWidth="2.2" />
                      <rect x={xLeft - twPx / 2} y={zTop - twPx / 2} width={xRight - xLeft + twPx} height={twPx} fill="#881337" stroke="#f43f5e" strokeWidth="2.2" />
                      <rect x={xRight - twPx / 2} y={zTop - twPx / 2} width={twPx} height={zBottom - zTop + twPx} fill="#881337" stroke="#f43f5e" strokeWidth="2.2" />
                      {[
                        { bx: xLeft, by: zTop },
                        { bx: xLeft, by: zBottom },
                        { bx: xRight, by: zTop },
                        { bx: xRight, by: zBottom },
                      ].map((bpos, bIdx) => (
                        <g key={`elev_be_${bIdx}`}>
                          <rect x={bpos.bx - bePx / 2} y={bpos.by - bePx / 2} width={bePx} height={bePx} fill="#ca8a04" stroke="#eab308" strokeWidth="1.5" />
                          <line x1={bpos.bx - bePx / 2} y1={bpos.by - bePx / 2} x2={bpos.bx + bePx / 2} y2={bpos.by + bePx / 2} stroke="#a16207" strokeWidth="0.8" />
                          <line x1={bpos.bx - bePx / 2} y1={bpos.by + bePx / 2} x2={bpos.bx + bePx / 2} y2={bpos.by - bePx / 2} stroke="#a16207" strokeWidth="0.8" />
                        </g>
                      ))}
                      <line x1={xLeft + twPx / 2} y1={zTop + twPx / 2} x2={xRight - twPx / 2} y2={zBottom} stroke="#f43f5e" strokeWidth="0.8" strokeDasharray="3,3" />
                      <line x1={xRight - twPx / 2} y1={zTop + twPx / 2} x2={xLeft + twPx / 2} y2={zBottom} stroke="#f43f5e" strokeWidth="0.8" strokeDasharray="3,3" />
                      {showLiftCore && (
                        <>
                          <rect x={(xLeft + xRight) / 2 - 45} y={(zTop + zBottom) / 2 - 8} width={90} height={16} fill="#0f172a" stroke="#f43f5e" strokeWidth="0.8" rx="2" />
                          <text x={(xLeft + xRight) / 2} y={(zTop + zBottom) / 2 + 4} fill="#fecdd3" fontSize="8" fontWeight="bold" textAnchor="middle">
                            LIFT CORE (tw=230)
                          </text>
                        </>
                      )}
                    </g>
                  );
                } else {
                  return (
                    <g key={`elev_sw_st_${grp.groupId}`}>
                      <rect x={Math.min(xMin, xMax) - twPx / 2} y={Math.min(zMin, zMax) - twPx / 2} width={Math.max(twPx, Math.abs(xMax - xMin))} height={Math.max(twPx, Math.abs(zMax - zMin))} fill="#881337" stroke="#f43f5e" strokeWidth="2.2" />
                      {showLiftCore && (
                        <text x={(xMin + xMax) / 2} y={(zMin + zMax) / 2 + 3} fill="#fecdd3" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                          RC SHEAR WALL (tw=230)
                        </text>
                      )}
                    </g>
                  );
                }
              })}
          </g>
        )}

        {/* 5. Framing Beams (Elevated Floors - Double Line Wall Style) */}
        {!floorPlan.isFoundationLevel && (
          <g>
            {floorPlan.beams.map((b) => {
              // If beam is internal to shear wall/core wall, suppress it
              const isInternalToCore = floorPlan.combinedPileCaps?.some((grp) => {
                const isWallGrp = grp.reason === 'SHEAR_WALL' || grp.nodeIds.length >= 3 || Boolean(grp.wallFootprint);
                if (!isWallGrp) return false;
                return grp.nodeIds.includes(b.startNodeId) && grp.nodeIds.includes(b.endNodeId);
              });
              if (isInternalToCore) return null;

              const x1 = toSvgX(b.startX);
              const y1 = toSvgY(b.startZ);
              const x2 = toSvgX(b.endX);
              const y2 = toSvgY(b.endZ);

              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.hypot(dx, dy);
              if (len < 1) return null;

              const nx = -dy / len;
              const ny = dx / len;
              const bWidth = b.width || 0.23;
              const hw = Math.max(3.5, (bWidth / 2) * scale);

              const p1 = `${x1 + nx * hw},${y1 + ny * hw}`;
              const p2 = `${x2 + nx * hw},${y2 + ny * hw}`;
              const p3 = `${x2 - nx * hw},${y2 - ny * hw}`;
              const p4 = `${x1 - nx * hw},${y1 - ny * hw}`;

              let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
              if (angleDeg > 90) angleDeg -= 180;
              if (angleDeg < -90) angleDeg += 180;

              const isShort = len < 45;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              const textStr = isShort ? b.label : `${b.label} ${showSectionSizes ? `(${b.sectionName})` : ''}`;
              const textWidth = textStr.length * 5.2 + 8;

              return (
                <g key={`beam_${b.memberId}`}>
                  <polygon
                    points={`${p1} ${p2} ${p3} ${p4}`}
                    fill="#082f49"
                    fillOpacity="0.45"
                    stroke="#0284c7"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  {showMemberLabels && len >= 25 && (
                    <g transform={`translate(${midX}, ${midY}) rotate(${angleDeg})`}>
                      <rect
                        x={-textWidth / 2}
                        y={-5.5}
                        width={textWidth}
                        height={11}
                        fill="#020617"
                        stroke="#0369a1"
                        strokeWidth="0.7"
                        rx="2"
                      />
                      <text
                        x="0"
                        y={2.5}
                        fill="#38bdf8"
                        fontSize="6.8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {textStr}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* 6. Concrete Columns — only C20-C23 lift-core fixed supports hidden; other 2 in same 6-col combined cap remain visible */}
        <g>
          {floorPlan.columns.map((c) => {
            const isInLiftCoreU = floorPlan.combinedPileCaps?.some((grp) => {
              const isWallGrp = grp.reason === 'SHEAR_WALL' || grp.nodeIds.length >= 3 || Boolean(grp.wallFootprint);
              if (!isWallGrp) return false;
              return (
                grp.nodeIds.includes(c.nodeId) ||
                grp.columnLabels.includes(c.label) ||
                grp.columnLabels.includes(`C${c.columnSlNo}`) ||
                (floorPlan.absorbedCombinedCapNodeIds && floorPlan.absorbedCombinedCapNodeIds.has(c.nodeId))
              );
            });
            // Hide only C20-C23 as fixed lift supports; show the other 2 of a 6-col combined mat
            if (isInLiftCoreU && ['C20', 'C21', 'C22', 'C23'].includes(c.label)) return null;

            const cx = toSvgX(c.x);
            const cy = toSvgY(c.z);
            const cw = Math.max(10, (c.width || 0.45) * scale);
            const cd = Math.max(10, (c.depth || 0.55) * scale);

            return (
              <g key={`col_${c.columnSlNo}_${c.nodeId}`}>
                <rect x={cx - cw / 2} y={cy - cd / 2} width={cw} height={cd} fill="#065f46" stroke="#34d399" strokeWidth="1.5" />
                <line x1={cx - cw / 2} y1={cy - cd / 2} x2={cx + cw / 2} y2={cy + cd / 2} stroke="#059669" strokeWidth="0.8" />
                <line x1={cx - cw / 2} y1={cy + cd / 2} x2={cx + cw / 2} y2={cy - cd / 2} stroke="#059669" strokeWidth="0.8" />
                {showMemberLabels && (
                  <text x={cx} y={cy + cd / 2 + 10} fill="#34d399" fontSize="8" fontWeight="bold" textAnchor="middle">
                    {c.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* 6.5. RCC STAIRCASE FRAMING & PARAMETRIC IN-DRAWING MOVING / DRAGGING LAYER */}
        {showStaircases && (
          <g id="staircases_layer">
            {levelStaircases.map((stair) => {
              const comp = StaircasePlacementEngine.getStaircase2DComponents(stair);
              const isHovered = hoveredStairId === stair.id;
              const isSelected = activeSelectedStairId === stair.id;
              const isDragging = draggingStairId === stair.id;

              const polyToSvgPoints = (poly: { x: number; y: number }[]) =>
                poly.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ');

              const centerSvgX = toSvgX(comp.center.x);
              const centerSvgY = toSvgY(comp.center.y);

              return (
                <g
                  key={`stair_dwg_${stair.id}`}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                  onMouseEnter={() => setHoveredStairId(stair.id)}
                  onMouseLeave={() => setHoveredStairId(null)}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingStairId(stair.id);
                    setInternalSelectedStairId(stair.id);
                    onSelectStaircase?.(stair.id);
                    setDragStartPos({
                      mouseX: e.clientX,
                      mouseY: e.clientY,
                      stairX: stair.position.x,
                      stairY: stair.position.y,
                    });
                  }}
                >
                  {/* Outer Enclosure Wall */}
                  {stair.hasEnclosureWalls && comp.enclosurePolygon.length > 0 && (
                    <polygon
                      points={polyToSvgPoints(comp.enclosurePolygon)}
                      fill="#090d16"
                      stroke={isSelected ? '#f59e0b' : isHovered ? '#fbbf24' : '#475569'}
                      strokeWidth={isSelected ? '2' : '1.5'}
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Floor Landing & Mid-Landing */}
                  {comp.floorLandingPolygon.length > 0 && (
                    <polygon
                      points={polyToSvgPoints(comp.floorLandingPolygon)}
                      fill="#312e81"
                      fillOpacity="0.5"
                      stroke="#818cf8"
                      strokeWidth="1"
                    />
                  )}

                  {comp.midLandingPolygon.length > 0 && (
                    <polygon
                      points={polyToSvgPoints(comp.midLandingPolygon)}
                      fill="#064e3b"
                      fillOpacity="0.5"
                      stroke="#34d399"
                      strokeWidth="1"
                    />
                  )}

                  {/* Flights */}
                  {comp.flight1Polygon.length > 0 && (
                    <polygon
                      points={polyToSvgPoints(comp.flight1Polygon)}
                      fill="#082f49"
                      fillOpacity="0.4"
                      stroke="#0284c7"
                      strokeWidth="0.8"
                    />
                  )}

                  {comp.flight2Polygon.length > 0 && (
                    <polygon
                      points={polyToSvgPoints(comp.flight2Polygon)}
                      fill="#082f49"
                      fillOpacity="0.4"
                      stroke="#0284c7"
                      strokeWidth="0.8"
                    />
                  )}

                  {/* Central Well Gap */}
                  {comp.wellGapPolygon.length > 0 && (
                    <polygon
                      points={polyToSvgPoints(comp.wellGapPolygon)}
                      fill="#020617"
                      stroke="#64748b"
                      strokeWidth="0.8"
                      strokeDasharray="3,3"
                    />
                  )}

                  {/* Tread Lines */}
                  {comp.flight1TreadLines.map((t, idx) => (
                    <line
                      key={`f1_t_${idx}`}
                      x1={toSvgX(t.start.x)}
                      y1={toSvgY(t.start.y)}
                      x2={toSvgX(t.end.x)}
                      y2={toSvgY(t.end.y)}
                      stroke="#38bdf8"
                      strokeWidth="0.8"
                    />
                  ))}

                  {comp.flight2TreadLines.map((t, idx) => (
                    <line
                      key={`f2_t_${idx}`}
                      x1={toSvgX(t.start.x)}
                      y1={toSvgY(t.start.y)}
                      x2={toSvgX(t.end.x)}
                      y2={toSvgY(t.end.y)}
                      stroke="#38bdf8"
                      strokeWidth="0.8"
                    />
                  ))}

                  {/* Direction Arrows */}
                  <line
                    x1={toSvgX(comp.flight1Arrow.start.x)}
                    y1={toSvgY(comp.flight1Arrow.start.y)}
                    x2={toSvgX(comp.flight1Arrow.end.x)}
                    y2={toSvgY(comp.flight1Arrow.end.y)}
                    stroke="#10b981"
                    strokeWidth="1.6"
                    markerEnd="url(#arrow-green)"
                  />
                  <line
                    x1={toSvgX(comp.flight2Arrow.start.x)}
                    y1={toSvgY(comp.flight2Arrow.start.y)}
                    x2={toSvgX(comp.flight2Arrow.end.x)}
                    y2={toSvgY(comp.flight2Arrow.end.y)}
                    stroke="#10b981"
                    strokeWidth="1.6"
                    markerEnd="url(#arrow-green)"
                  />

                  {/* Landing Entry Doors */}
                  {comp.leftDoor && (
                    <g>
                      <line
                        x1={toSvgX(comp.leftDoor.opening.start.x)}
                        y1={toSvgY(comp.leftDoor.opening.start.y)}
                        x2={toSvgX(comp.leftDoor.opening.end.x)}
                        y2={toSvgY(comp.leftDoor.opening.end.y)}
                        stroke="#020617"
                        strokeWidth="2.5"
                      />
                      <line
                        x1={toSvgX(comp.leftDoor.leaf.start.x)}
                        y1={toSvgY(comp.leftDoor.leaf.start.y)}
                        x2={toSvgX(comp.leftDoor.leaf.end.x)}
                        y2={toSvgY(comp.leftDoor.leaf.end.y)}
                        stroke="#f59e0b"
                        strokeWidth="1.2"
                      />
                    </g>
                  )}

                  {comp.rightDoor && (
                    <g>
                      <line
                        x1={toSvgX(comp.rightDoor.opening.start.x)}
                        y1={toSvgY(comp.rightDoor.opening.start.y)}
                        x2={toSvgX(comp.rightDoor.opening.end.x)}
                        y2={toSvgY(comp.rightDoor.opening.end.y)}
                        stroke="#020617"
                        strokeWidth="2.5"
                      />
                      <line
                        x1={toSvgX(comp.rightDoor.leaf.start.x)}
                        y1={toSvgY(comp.rightDoor.leaf.start.y)}
                        x2={toSvgX(comp.rightDoor.leaf.end.x)}
                        y2={toSvgY(comp.rightDoor.leaf.end.y)}
                        stroke="#f59e0b"
                        strokeWidth="1.2"
                      />
                    </g>
                  )}

                  {/* Title & Dimension Text */}
                  <text
                    x={centerSvgX}
                    y={centerSvgY - 4}
                    fill="#fef08a"
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {stair.name || 'RCC STAIRCASE'}
                  </text>
                  <text
                    x={centerSvgX}
                    y={centerSvgY + 6}
                    fill="#93c5fd"
                    fontSize="6.5"
                    textAnchor="middle"
                  >
                    {`${stair.roomLength}m × ${stair.roomWidth}m (${stair.treadMm}T / ${stair.riserMm}R)`}
                  </text>

                  {/* Selection & Moving UI Overlay */}
                  {(isSelected || isHovered || isDragging) && (
                    <g>
                      {/* Bounding Highlight Rectangle */}
                      <rect
                        x={toSvgX(comp.bounds.minX) - 3}
                        y={toSvgY(comp.bounds.minY) - 3}
                        width={Math.abs(toSvgX(comp.bounds.maxX) - toSvgX(comp.bounds.minX)) + 6}
                        height={Math.abs(toSvgY(comp.bounds.maxY) - toSvgY(comp.bounds.minY)) + 6}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                        rx="3"
                      />

                      {/* Moving Coordinates Badge */}
                      <g transform={`translate(${centerSvgX}, ${toSvgY(comp.bounds.minY) - 18})`}>
                        <rect
                          x="-80"
                          y="0"
                          width="160"
                          height="15"
                          fill="#0f172a"
                          fillOpacity="0.95"
                          stroke="#f59e0b"
                          strokeWidth="0.8"
                          rx="3"
                        />
                        <text
                          x="0"
                          y="10.5"
                          fill="#fbbf24"
                          fontSize="7"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {isDragging ? 'DRAGGING STAIR...' : `MOVE: X=${stair.position.x.toFixed(1)}m, Z=${stair.position.y.toFixed(1)}m`}
                        </text>
                      </g>

                      {/* In-Drawing Nudge Movement Buttons */}
                      {isSelected && onUpdateStaircase && (
                        <g transform={`translate(${toSvgX(comp.bounds.maxX) + 8}, ${centerSvgY - 32})`}>
                          {/* Background Pill */}
                          <rect
                            x="0"
                            y="0"
                            width="58"
                            height="64"
                            fill="#020617"
                            fillOpacity="0.9"
                            stroke="#f59e0b"
                            strokeWidth="1"
                            rx="4"
                          />

                          {/* Up Button */}
                          <g
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNudgeStaircase(stair, 0, -0.2);
                            }}
                            className="cursor-pointer hover:opacity-75"
                          >
                            <rect x="20" y="4" width="18" height="14" fill="#1e293b" stroke="#475569" rx="2" />
                            <text x="29" y="14" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">▲</text>
                          </g>

                          {/* Left Button */}
                          <g
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNudgeStaircase(stair, -0.2, 0);
                            }}
                            className="cursor-pointer hover:opacity-75"
                          >
                            <rect x="3" y="22" width="18" height="14" fill="#1e293b" stroke="#475569" rx="2" />
                            <text x="12" y="32" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">◀</text>
                          </g>

                          {/* Right Button */}
                          <g
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNudgeStaircase(stair, 0.2, 0);
                            }}
                            className="cursor-pointer hover:opacity-75"
                          >
                            <rect x="37" y="22" width="18" height="14" fill="#1e293b" stroke="#475569" rx="2" />
                            <text x="46" y="32" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">▶</text>
                          </g>

                          {/* Down Button */}
                          <g
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNudgeStaircase(stair, 0, 0.2);
                            }}
                            className="cursor-pointer hover:opacity-75"
                          >
                            <rect x="20" y="22" width="18" height="14" fill="#1e293b" stroke="#475569" rx="2" />
                            <text x="29" y="32" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">▼</text>
                          </g>

                          {/* Rotate 90 deg Button */}
                          <g
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotateStaircase(stair);
                            }}
                            className="cursor-pointer hover:opacity-75"
                          >
                            <rect x="4" y="42" width="50" height="16" fill="#3b82f6" stroke="#60a5fa" rx="2" />
                            <text x="29" y="53" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">
                              ↻ ROT 90°
                            </text>
                          </g>
                        </g>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* 7. Column Bay Dimension Chains */}
        {showDimensions && (
          <g>
            {/* Top X Bay Dimensions */}
            {floorPlan.gridLinesX.slice(0, -1).map((g1, i) => {
              const g2 = floorPlan.gridLinesX[i + 1];
              const x1 = toSvgX(g1.coord);
              const x2 = toSvgX(g2.coord);
              const dimY = toSvgY(bounds.minZ - 1.0) - 24;
              const baySpan = (g2.coord - g1.coord).toFixed(2);

              return (
                <g key={`dim_x_${i}`}>
                  <line x1={x1} y1={dimY} x2={x2} y2={dimY} stroke="#94a3b8" strokeWidth="1" markerStart="url(#arrow-dim)" markerEnd="url(#arrow-dim)" />
                  <line x1={x1} y1={dimY - 4} x2={x1} y2={dimY + 4} stroke="#94a3b8" strokeWidth="1.2" />
                  <line x1={x2} y1={dimY - 4} x2={x2} y2={dimY + 4} stroke="#94a3b8" strokeWidth="1.2" />
                  <text x={(x1 + x2) / 2} y={dimY - 4} fill="#cbd5e1" fontSize="8" textAnchor="middle">
                    {baySpan} m
                  </text>
                </g>
              );
            })}

            {/* Left Z Bay Dimensions */}
            {floorPlan.gridLinesZ.slice(0, -1).map((g1, i) => {
              const g2 = floorPlan.gridLinesZ[i + 1];
              const y1 = toSvgY(g1.coord);
              const y2 = toSvgY(g2.coord);
              const dimX = toSvgX(bounds.minX - 1.0) - 24;
              const baySpan = (g2.coord - g1.coord).toFixed(2);

              return (
                <g key={`dim_z_${i}`}>
                  <line x1={dimX} y1={y1} x2={dimX} y2={y2} stroke="#94a3b8" strokeWidth="1" markerStart="url(#arrow-dim)" markerEnd="url(#arrow-dim)" />
                  <line x1={dimX - 4} y1={y1} x2={dimX + 4} y2={y1} stroke="#94a3b8" strokeWidth="1.2" />
                  <line x1={dimX - 4} y1={y2} x2={dimX + 4} y2={y2} stroke="#94a3b8" strokeWidth="1.2" />
                  <text x={dimX - 6} y={(y1 + y2) / 2 + 3} fill="#cbd5e1" fontSize="8" textAnchor="end">
                    {baySpan} m
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* ========================================================================= */}
        {/* FOUNDATION SPECIAL: ALL PILE CAP TYPES STRUCTURAL DETAILING PANELS — hidden when PLAN only */}
        {/* ========================================================================= */}
        {isFoundation && pileCapDisplayMode !== 'PLAN' && (
          <g transform="translate(540, 30)">
            {/* Detailing Container Box */}
            <rect x="0" y="0" width={width - 560} height={height - 50} fill="#0b1120" stroke="#334155" strokeWidth="1.5" rx="4" />
            <rect x="0" y="0" width={width - 560} height={28} fill="#1e293b" rx="4" />
            <text x="12" y="18" fill="#38bdf8" fontSize="10" fontWeight="bold">
              FOUNDATION STRUCTURAL CROSS-SECTIONS (IS 2911 / SP:34 CAD STANDARD)
            </text>

            {/* Quick Section Selector Pills inside the CAD Canvas */}
            <g transform={`translate(${width - 560 - 360}, 4)`}>
              {['ALL', ...uniquePileCapTypes.map((t) => t.typeId)].map((key, kIdx) => {
                const isAct = activeSectionFilter === key;
                const btnX = kIdx * 68;
                const label = key === 'ALL' ? 'All (Grid)' : key;
                return (
                  <g
                    key={`sec_tab_${key}`}
                    onClick={() => onSelectSection?.(key)}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <rect
                      x={btnX}
                      y="0"
                      width="64"
                      height="20"
                      fill={isAct ? '#2563eb' : '#0f172a'}
                      stroke={isAct ? '#60a5fa' : '#334155'}
                      strokeWidth="1"
                      rx="3"
                    />
                    <text
                      x={btnX + 32}
                      y="13"
                      fill={isAct ? '#ffffff' : '#94a3b8'}
                      fontSize="7.5"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Grid of All Pile Cap Types */}
            {visibleTypes.map((item, idx) => {
              const numVisible = visibleTypes.length;
              const cardW = numVisible === 1 ? width - 600 : (width - 590) / numVisible;
              const cardX = 12 + idx * (cardW + 10);
              const cardY = 36;
              const cardH = height - 95;

              // Plan Scale: Fit L and B nicely inside ~170px width
              const planBoxDim = Math.min(cardW - 80, 160);
              const dScale = planBoxDim / Math.max(item.L, item.B, 2600);

              const plCx = cardX + cardW / 2;
              const plCy = cardY + 120;

              // Plan Dimensions
              const planW_px = item.L * dScale;
              const planH_px = item.B * dScale;

              // Section Dimensions
              const capW_px = Math.max(140, item.L * dScale);
              const capH_px = Math.max(70, item.D * dScale * 1.15);
              const secX = plCx - capW_px / 2;
              const secY = cardY + 295;
              const secW = capW_px;
              const secH = capH_px;

              const rPilePx = Math.max(12, (item.Dp / 2) * dScale);
              const colW_px = Math.max(24, 450 * dScale);
              const colH_px = Math.max(26, 550 * dScale);

              const botRebar = item.cap.rebarCalloutX ? item.cap.rebarCalloutX.split(' (')[0] : 'T16@150 C/C (B)';
              const topRebar = item.cap.topRebarCallout ? item.cap.topRebarCallout.split(' (')[0] : 'T12@100 C/C (T)';
              const sideRebar = '3-T10';

              // Compute Plan Piles Points
              const planPilePoints = () => {
                if (item.shape === 'PENTAGONAL') {
                  const Rp = item.s / (2 * Math.sin(Math.PI / 5));
                  const cos18 = Math.cos(Math.PI / 10);
                  const sin18 = Math.sin(Math.PI / 10);
                  const sin36 = Math.sin(Math.PI / 5);
                  const cos36 = Math.cos(Math.PI / 5);
                  return [
                    { px: plCx, py: plCy - Rp * dScale },
                    { px: plCx - Rp * cos18 * dScale, py: plCy - Rp * sin18 * dScale },
                    { px: plCx - Rp * sin36 * dScale, py: plCy + Rp * cos36 * dScale },
                    { px: plCx + Rp * sin36 * dScale, py: plCy + Rp * cos36 * dScale },
                    { px: plCx + Rp * cos18 * dScale, py: plCy - Rp * sin18 * dScale },
                  ];
                } else {
                  // 4 piles
                  return [
                    { px: plCx - (item.s / 2) * dScale, py: plCy - (item.s / 2) * dScale },
                    { px: plCx + (item.s / 2) * dScale, py: plCy - (item.s / 2) * dScale },
                    { px: plCx - (item.s / 2) * dScale, py: plCy + (item.s / 2) * dScale },
                    { px: plCx + (item.s / 2) * dScale, py: plCy + (item.s / 2) * dScale },
                  ];
                }
              };

              const pilesInPlan = planPilePoints();

              // Compute Plan Pentagon Vertices for Aligned Dimensioning
              const pentagonVertices = (extraMm: number) => {
                const Rp = item.s / (2 * Math.sin(Math.PI / 5));
                const Rcap = (Rp + item.eo + extraMm) * dScale;
                const cos18 = Math.cos(Math.PI / 10);
                const sin18 = Math.sin(Math.PI / 10);
                const sin36 = Math.sin(Math.PI / 5);
                const cos36 = Math.cos(Math.PI / 5);
                return [
                  { x: plCx, y: plCy - Rcap },
                  { x: plCx - Rcap * cos18, y: plCy - Rcap * sin18 },
                  { x: plCx - Rcap * sin36, y: plCy + Rcap * cos36 },
                  { x: plCx + Rcap * sin36, y: plCy + Rcap * cos36 },
                  { x: plCx + Rcap * cos18, y: plCy - Rcap * sin18 },
                ];
              };

              // Compute Plan Polygon
              const getPolygon = (extraMm: number) => {
                if (item.shape === 'PENTAGONAL') {
                  const pts = pentagonVertices(extraMm);
                  return pts.map((p) => `${p.x},${p.y}`).join(' ');
                }
                const halfW = ((item.L + 2 * extraMm) / 2) * dScale;
                const halfH = ((item.B + 2 * extraMm) / 2) * dScale;
                return `${plCx - halfW},${plCy - halfH} ${plCx + halfW},${plCy - halfH} ${plCx + halfW},${plCy + halfH} ${plCx - halfW},${plCy + halfH}`;
              };

              const pccPoly = getPolygon(150);
              const capPoly = getPolygon(0);

              // Section Piles X positions
              const p1_secX = item.shape === 'PENTAGONAL' ? plCx - (item.s / 2) * 0.95 * dScale : plCx - (item.s / 2) * dScale;
              const p2_secX = item.shape === 'PENTAGONAL' ? plCx + (item.s / 2) * 0.95 * dScale : plCx + (item.s / 2) * dScale;

              return (
                <g key={item.typeId}>
                  {/* Card Outer Container */}
                  <rect x={cardX} y={cardY} width={cardW} height={cardH} fill="#020617" stroke="#1e293b" strokeWidth="1.2" rx="3" />

                  {/* Card Header Banner */}
                  <rect x={cardX} y={cardY} width={cardW} height={22} fill="#0f172a" rx="3" />
                  <text x={cardX + 8} y={cardY + 15} fill="#a5b4fc" fontSize="9" fontWeight="bold">
                    {item.typeId}: {item.typeName} ({item.shape === 'PENTAGONAL' ? `1461mm × 5 Sides × ${item.D}` : `${item.L}×${item.B}×${item.D}`} mm)
                  </text>
                  <text x={cardX + cardW - 8} y={cardY + 15} fill="#64748b" fontSize="7.5" textAnchor="end">
                    Cols: {item.associatedColumns.slice(0, 4).join(', ')}{item.associatedColumns.length > 4 ? '...' : ''}
                  </text>

                  {/* ---------------- A. PLAN VIEW (TOP HALF OF CARD) ---------------- */}
                  {/* Section Cut Line (Across the Plan with Blue Indicator Arrows) */}
                  <line x1={plCx - planW_px / 2 - 28} y1={plCy} x2={plCx + planW_px / 2 + 28} y2={plCy} stroke="#6366f1" strokeWidth="0.8" strokeDasharray="5,3" />
                  <polygon points={`${plCx - planW_px / 2 - 28},${plCy - 4} ${plCx - planW_px / 2 - 35},${plCy} ${plCx - planW_px / 2 - 28},${plCy + 4}`} fill="#4f46e5" />
                  <polygon points={`${plCx + planW_px / 2 + 28},${plCy - 4} ${plCx + planW_px / 2 + 35},${plCy} ${plCx + planW_px / 2 + 28},${plCy + 4}`} fill="#4f46e5" />
                  <text x={plCx - planW_px / 2 - 40} y={plCy - 4} fill="#4f46e5" fontSize="8.5" fontWeight="bold">
                    {item.sectionNum}
                  </text>
                  <text x={plCx + planW_px / 2 + 40} y={plCy - 4} fill="#4f46e5" fontSize="8.5" fontWeight="bold">
                    {item.sectionNum}
                  </text>

                  {/* 1. 150 THK PCC Bedding Boundary (Blue Line) */}
                  <polygon points={pccPoly} fill="none" stroke="#2563eb" strokeWidth="1.3" />

                  {/* 2. Concrete Cap Perimeter (Magenta Line) */}
                  <polygon points={capPoly} fill="#fdf4ff" fillOpacity="0.08" stroke="#c026d3" strokeWidth="2.0" />

                  {/* 3. Internal Rebar Mesh (Cyan Lines) */}
                  {[-25, 0, 25].map((dx, i) => (
                    <line key={`pmx_${i}`} x1={plCx + dx} y1={plCy - planH_px / 2 + 10} x2={plCx + dx} y2={plCy + planH_px / 2 - 10} stroke="#06b6d4" strokeWidth="0.8" strokeDasharray="2,2" />
                  ))}
                  {[-25, 0, 25].map((dy, i) => (
                    <line key={`pmy_${i}`} x1={plCx - planW_px / 2 + 10} y1={plCy + dy} x2={plCx + planW_px / 2 - 10} y2={plCy + dy} stroke="#06b6d4" strokeWidth="0.8" strokeDasharray="2,2" />
                  ))}

                  {/* 4. Bored Piles in Plan View (Green Circles with Center Crosshairs) */}
                  {pilesInPlan.map((pt, pIdx) => (
                    <g key={`dp_${item.typeId}_${pIdx}`}>
                      <circle cx={pt.px} cy={pt.py} r={rPilePx} fill="#052e16" stroke="#22c55e" strokeWidth="1.6" />
                      <line x1={pt.px - rPilePx - 2} y1={pt.py} x2={pt.px + rPilePx + 2} y2={pt.py} stroke="#22c55e" strokeWidth="0.8" strokeDasharray="1.5,1.5" />
                      <line x1={pt.px} y1={pt.py - rPilePx - 2} x2={pt.px} y2={pt.py + rPilePx + 2} stroke="#22c55e" strokeWidth="0.8" strokeDasharray="1.5,1.5" />
                    </g>
                  ))}

                  {/* 5. Center Column Pedestal (Golden Brown with Yellow Border) */}
                  <rect x={plCx - colW_px / 2} y={plCy - colH_px / 2} width={colW_px} height={colH_px} fill="#ca8a04" stroke="#eab308" strokeWidth="1.5" />
                  <text x={plCx} y={plCy + 3.5} fill="#fef08a" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                    COL
                  </text>

                  {/* ---------------- PLAN VIEW ALIGNED DIMENSIONS WITH ARROW LINES ---------------- */}
                  {item.shape === 'RECTANGULAR' ? (
                    <g>
                      {/* Top Horizontal Dimension: L = 1900 / 2500 (Spanning EXACT Edge to Edge of Concrete Cap) */}
                      {(() => {
                        const dimY = plCy - planH_px / 2 - 20;
                        const x1 = plCx - planW_px / 2;
                        const x2 = plCx + planW_px / 2;
                        const yEdge = plCy - planH_px / 2;
                        return (
                          <g>
                            <line x1={x1} y1={yEdge} x2={x1} y2={dimY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                            <line x1={x2} y1={yEdge} x2={x2} y2={dimY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                            <line x1={x1} y1={dimY} x2={x2} y2={dimY} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                            <rect x={plCx - 18} y={dimY - 8} width={36} height={10} fill="#020617" rx="2" />
                            <text x={plCx} y={dimY - 1} fill="#f87171" fontSize="8" fontWeight="bold" textAnchor="middle">
                              {item.L}
                            </text>
                          </g>
                        );
                      })()}

                      {/* Right Vertical Dimension: B = 1900 / 2500 (Spanning EXACT Edge to Edge of Concrete Cap) */}
                      {(() => {
                        const dimX = plCx + planW_px / 2 + 20;
                        const y1 = plCy - planH_px / 2;
                        const y2 = plCy + planH_px / 2;
                        const xEdge = plCx + planW_px / 2;
                        return (
                          <g>
                            <line x1={xEdge} y1={y1} x2={dimX + 4} y2={y1} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                            <line x1={xEdge} y1={y2} x2={dimX + 4} y2={y2} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                            <line x1={dimX} y1={y1} x2={dimX} y2={y2} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                            <rect x={dimX - 16} y={plCy - 5} width={32} height={10} fill="#020617" rx="2" />
                            <text x={dimX} y={plCy + 2.5} fill="#f87171" fontSize="8" fontWeight="bold" textAnchor="middle">
                              {item.B}
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  ) : (
                    /* Pentagon 5 Aligned Facet Dimensions with Outward Extension Lines & Arrowheads */
                    <g>
                      {(() => {
                        const pts = pentagonVertices(0);
                        return pts.map((v1, i) => {
                          const v2 = pts[(i + 1) % pts.length];
                          const dx = v2.x - v1.x;
                          const dy = v2.y - v1.y;
                          const len = Math.hypot(dx, dy);
                          if (len < 1) return null;

                          const nx = -dy / len;
                          const ny = dx / len;
                          const off = 15;

                          const p1x = v1.x + nx * off;
                          const p1y = v1.y + ny * off;
                          const p2x = v2.x + nx * off;
                          const p2y = v2.y + ny * off;

                          let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
                          if (angleDeg > 90) angleDeg -= 180;
                          if (angleDeg < -90) angleDeg += 180;

                          const midX = (p1x + p2x) / 2;
                          const midY = (p1y + p2y) / 2;
                          const facetVal = item.facetDim || Math.round(len / dScale);

                          return (
                            <g key={`p_dim_${i}`}>
                              {/* Extension Lines */}
                              <line x1={v1.x + nx * 2} y1={v1.y + ny * 2} x2={v1.x + nx * (off + 3)} y2={v1.y + ny * (off + 3)} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="1,1" />
                              <line x1={v2.x + nx * 2} y1={v2.y + ny * 2} x2={v2.x + nx * (off + 3)} y2={v2.y + ny * (off + 3)} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="1,1" />
                              {/* Aligned Dimension Line with Arrowheads */}
                              <line x1={p1x} y1={p1y} x2={p2x} y2={p2y} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                              {/* Aligned Dimension Text with Knockout */}
                              <g transform={`translate(${midX}, ${midY}) rotate(${angleDeg})`}>
                                <rect x="-14" y="-5" width="28" height="10" fill="#020617" rx="2" />
                                <text x="0" y="2.5" fill="#f87171" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                                  {facetVal}
                                </text>
                              </g>
                            </g>
                          );
                        });
                      })()}
                    </g>
                  )}

                  {/* Plan View Title */}
                  <text x={plCx} y={plCy + planH_px / 2 + 28} fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">
                    PILE CAP {item.typeId} - PLAN (SCALE 1:50)
                  </text>

                  {/* Divider line between Plan and Section */}
                  <line x1={cardX + 15} y1={cardY + 242} x2={cardX + cardW - 15} y2={cardY + 242} stroke="#1e293b" strokeWidth="1" />

                  {/* ---------------- B. SECTION ELEVATION (BOTTOM HALF OF CARD) ---------------- */}
                  {/* Column Stub with Starter Bars & Links */}
                  <rect x={plCx - colW_px / 2} y={secY - 36} width={colW_px} height={36} fill="#0f172a" stroke="#eab308" strokeWidth="1.4" />
                  <line x1={plCx - 6} y1={secY - 34} x2={plCx - 6} y2={secY + secH - 8} stroke="#06b6d4" strokeWidth="1.6" />
                  <line x1={plCx + 6} y1={secY - 34} x2={plCx + 6} y2={secY + secH - 8} stroke="#06b6d4" strokeWidth="1.6" />
                  <line x1={plCx - 6} y1={secY + secH - 8} x2={plCx - 16} y2={secY + secH - 8} stroke="#06b6d4" strokeWidth="1.6" />
                  <line x1={plCx + 6} y1={secY + secH - 8} x2={plCx + 16} y2={secY + secH - 8} stroke="#06b6d4" strokeWidth="1.6" />

                  {/* Column Links */}
                  {[secY - 26, secY - 16, secY - 6].map((ly, i) => (
                    <line key={`clk_${i}`} x1={plCx - colW_px / 2} y1={ly} x2={plCx + colW_px / 2} y2={ly} stroke="#dc2626" strokeWidth="0.9" />
                  ))}
                  <text x={plCx} y={secY - 20} fill="#f87171" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                    LINKS
                  </text>

                  {/* Concrete Cap Body (Magenta) */}
                  <rect x={secX} y={secY} width={secW} height={secH} fill="#fdf4ff" fillOpacity="0.08" stroke="#c026d3" strokeWidth="2.0" />

                  {/* 150 THK PCC Bedding Layer (Brown) */}
                  <rect x={secX - 10} y={secY + secH} width={secW + 20} height={10} fill="#b45309" stroke="#78350f" strokeWidth="1" />

                  {/* Bored Concrete Piles Shafts (Green Outlines) */}
                  <rect x={p1_secX - rPilePx} y={secY + secH - 6} width={rPilePx * 2} height={38} fill="#052e16" stroke="#22c55e" strokeWidth="1.6" />
                  <rect x={p2_secX - rPilePx} y={secY + secH - 6} width={rPilePx * 2} height={38} fill="#052e16" stroke="#22c55e" strokeWidth="1.6" />

                  {/* Center Pile for 5-Pile Cap in Section */}
                  {item.shape === 'PENTAGONAL' && (
                    <rect x={plCx - rPilePx} y={secY + secH - 6} width={rPilePx * 2} height={38} fill="#052e16" stroke="#22c55e" strokeWidth="1.6" />
                  )}

                  {/* Pile Dowels entering Cap */}
                  <line x1={p1_secX - rPilePx + 4} y1={secY + secH - 24} x2={p1_secX - rPilePx + 4} y2={secY + secH + 30} stroke="#22c55e" strokeWidth="1.4" />
                  <line x1={p1_secX + rPilePx - 4} y1={secY + secH - 24} x2={p1_secX + rPilePx - 4} y2={secY + secH + 30} stroke="#22c55e" strokeWidth="1.4" />
                  <line x1={p2_secX - rPilePx + 4} y1={secY + secH - 24} x2={p2_secX - rPilePx + 4} y2={secY + secH + 30} stroke="#22c55e" strokeWidth="1.4" />
                  <line x1={p2_secX + rPilePx - 4} y1={secY + secH - 24} x2={p2_secX + rPilePx - 4} y2={secY + secH + 30} stroke="#22c55e" strokeWidth="1.4" />

                  {/* Bottom Main Rebar Mat (Red Line with Upward Hooks) */}
                  <line x1={secX + 8} y1={secY + secH - 8} x2={secX + secW - 8} y2={secY + secH - 8} stroke="#dc2626" strokeWidth="2.2" />
                  <line x1={secX + 8} y1={secY + secH - 8} x2={secX + 8} y2={secY + 22} stroke="#dc2626" strokeWidth="2.2" />
                  <line x1={secX + secW - 8} y1={secY + secH - 8} x2={secX + secW - 8} y2={secY + 22} stroke="#dc2626" strokeWidth="2.2" />

                  {/* Top Shrinkage Rebar Mat (Cyan Line with Downward Hooks) */}
                  <line x1={secX + 8} y1={secY + 8} x2={secX + secW - 8} y2={secY + 8} stroke="#06b6d4" strokeWidth="1.8" />
                  <line x1={secX + 8} y1={secY + 8} x2={secX + 8} y2={secY + 32} stroke="#06b6d4" strokeWidth="1.8" />
                  <line x1={secX + secW - 8} y1={secY + 8} x2={secX + secW - 8} y2={secY + 32} stroke="#06b6d4" strokeWidth="1.8" />

                  {/* Side Ties (Green Dots) */}
                  <circle cx={secX + 8} cy={secY + 28} r={2.8} fill="#22c55e" />
                  <circle cx={secX + 8} cy={secY + 48} r={2.8} fill="#22c55e" />
                  <circle cx={secX + secW - 8} cy={secY + 28} r={2.8} fill="#22c55e" />
                  <circle cx={secX + secW - 8} cy={secY + 48} r={2.8} fill="#22c55e" />

                  {/* ---------------- AUTOCAD ALIGNED DIMENSIONS ON CROSS-SECTION ---------------- */}
                  {/* 1. Top Width Dimension: L = 1900 / 2500 (Placed ABOVE THE COLUMN) */}
                  {(() => {
                    const topDimY = secY - 44;
                    return (
                      <g>
                        <line x1={secX} y1={secY} x2={secX} y2={topDimY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                        <line x1={secX + secW} y1={secY} x2={secX + secW} y2={topDimY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                        <line x1={secX} y1={topDimY} x2={secX + secW} y2={topDimY} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                        <rect x={plCx - 18} y={topDimY - 8} width={36} height={10} fill="#020617" rx="2" />
                        <text x={plCx} y={topDimY - 1} fill="#f87171" fontSize="8" fontWeight="bold" textAnchor="middle">
                          {item.L}
                        </text>
                      </g>
                    );
                  })()}

                  {/* 2. Right Depth Dimension: D = 750 (with Extension Lines & CAD Arrows) */}
                  {(() => {
                    const rDimX = secX + secW + 20;
                    return (
                      <g>
                        <line x1={secX + secW} y1={secY} x2={rDimX + 4} y2={secY} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                        <line x1={secX + secW} y1={secY + secH} x2={rDimX + 4} y2={secY + secH} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                        <line x1={rDimX} y1={secY} x2={rDimX} y2={secY + secH} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                        <rect x={rDimX - 4} y={secY + secH / 2 - 5} width={28} height={10} fill="#020617" rx="2" />
                        <text x={rDimX + 10} y={secY + secH / 2 + 2.5} fill="#f87171" fontSize="8" fontWeight="bold">
                          {item.D}
                        </text>
                      </g>
                    );
                  })()}

                  {/* 3. Bottom Spacing Dimension Chain: eo | s | eo (with CAD Arrows) */}
                  {(() => {
                    const btmDimY = secY + secH + 52;
                    return (
                      <g>
                        {/* Extension Lines from edges and piles */}
                        <line x1={secX} y1={secY + secH} x2={secX} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="1,1" />
                        <line x1={p1_secX} y1={secY + secH + 32} x2={p1_secX} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="1,1" />
                        <line x1={p2_secX} y1={secY + secH + 32} x2={p2_secX} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="1,1" />
                        <line x1={secX + secW} y1={secY + secH} x2={secX + secW} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="1,1" />

                        {/* Left Overhang: eo */}
                        <line x1={secX} y1={btmDimY} x2={p1_secX} y2={btmDimY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                        <rect x={(secX + p1_secX) / 2 - 12} y={btmDimY - 5} width="24" height="10" fill="#020617" rx="2" />
                        <text x={(secX + p1_secX) / 2} y={btmDimY + 2.5} fill="#f87171" fontSize="7" fontWeight="bold" textAnchor="middle">
                          {Math.round(item.eo)}
                        </text>

                        {/* Pile Spacing: s */}
                        <line x1={p1_secX} y1={btmDimY} x2={p2_secX} y2={btmDimY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                        <rect x={(p1_secX + p2_secX) / 2 - 14} y={btmDimY - 5} width="28" height="10" fill="#020617" rx="2" />
                        <text x={(p1_secX + p2_secX) / 2} y={btmDimY + 2.5} fill="#f87171" fontSize="7" fontWeight="bold" textAnchor="middle">
                          {item.s}
                        </text>

                        {/* Right Overhang: eo */}
                        <line x1={p2_secX} y1={btmDimY} x2={secX + secW} y2={btmDimY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                        <rect x={(p2_secX + secX + secW) / 2 - 12} y={btmDimY - 5} width="24" height="10" fill="#020617" rx="2" />
                        <text x={(p2_secX + secX + secW) / 2} y={btmDimY + 2.5} fill="#f87171" fontSize="7" fontWeight="bold" textAnchor="middle">
                          {Math.round(item.eo)}
                        </text>
                      </g>
                    );
                  })()}

                  {/* 4. Leader Callouts with Arrowheads Pointing to Elements */}
                  {/* Top Rebar Leader */}
                  <path
                    d={`M ${secX + secW - 10} ${secY + 8} L ${cardX + cardW - 65} ${secY - 14} L ${cardX + cardW - 12} ${secY - 14}`}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="0.8"
                    markerStart="url(#cad-leader-arrow)"
                  />
                  <text x={cardX + cardW - 12} y={secY - 17} fill="#f87171" fontSize="7" fontWeight="bold" textAnchor="end">
                    {topRebar}
                  </text>

                  {/* Bottom Rebar Leader */}
                  <path
                    d={`M ${secX + secW - 10} ${secY + secH - 8} L ${cardX + cardW - 65} ${secY + secH - 18} L ${cardX + cardW - 12} ${secY + secH - 18}`}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="0.8"
                    markerStart="url(#cad-leader-arrow)"
                  />
                  <text x={cardX + cardW - 12} y={secY + secH - 21} fill="#f87171" fontSize="7" fontWeight="bold" textAnchor="end">
                    {botRebar}
                  </text>

                  {/* Side Ties Leader */}
                  <path
                    d={`M ${secX + 8} ${secY + 28} L ${cardX + 50} ${secY + 12} L ${cardX + 12} ${secY + 12}`}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="0.8"
                    markerStart="url(#cad-leader-arrow)"
                  />
                  <text x={cardX + 12} y={secY + 9} fill="#f87171" fontSize="7" fontWeight="bold">
                    {sideRebar}
                  </text>

                  {/* PCC Bedding Leader */}
                  <path
                    d={`M ${secX - 8} ${secY + secH + 5} L ${cardX + 50} ${secY + secH + 18} L ${cardX + 12} ${secY + secH + 18}`}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="0.8"
                    markerStart="url(#cad-leader-arrow)"
                  />
                  <text x={cardX + 12} y={secY + secH + 15} fill="#f87171" fontSize="6.5" fontWeight="bold">
                    150THK PCC
                  </text>

                  {/* Pile Shaft Leader */}
                  <path
                    d={`M ${p1_secX} ${secY + secH + 18} L ${p1_secX - 18} ${secY + secH + 34} L ${cardX + 12} ${secY + secH + 34}`}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="0.8"
                    markerStart="url(#cad-leader-arrow)"
                  />
                  <text x={cardX + 12} y={secY + secH + 31} fill="#f87171" fontSize="6.5" fontWeight="bold">
                    {item.Dp} Ø PILE (50mm Embed)
                  </text>

                  {/* Section Title */}
                  <text x={plCx} y={cardY + cardH - 8} fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">
                    {item.sectionLabel} — DETAIL OF {item.typeId} (SCALE 1:50)
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* 8. North Arrow & Legend */}
        <g transform={`translate(${isFoundation ? 490 : width - 45}, 45)`}>
          <polygon points="0,-16 -6,4 0,0 6,4" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
          <polygon points="0,0 -6,4 0,16 6,4" fill="#0f172a" stroke="#0284c7" strokeWidth="0.8" />
          <text x="0" y="-20" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">
            N
          </text>
        </g>
      </svg>
    </div>
  );
};
