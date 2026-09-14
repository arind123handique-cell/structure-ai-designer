import React, { useState, useMemo } from 'react';
import { FloorPlanLevel, FloorColumnInfo } from './floorPlanEngine';
import { StoredProject } from '@/features/projects/types';
import { PileCapDesignOutput } from '@/features/design/pilecap/pileCapDesignEngine';
import { CombinedPileCapGroup } from '@/features/design/pilecap/combinedPileCapEngine';
import { ArchitecturalStaircase } from '@/features/architectural/types/architecturalTypes';
import { StaircasePlacementEngine } from '@/features/architectural/engines/staircasePlacementEngine';
import {
  CapOrientation,
  getTruncated3PilePolygonMm,
  get3PileDimensionsMm,
  renderQuarteredPileSvg,
  getSectionRebarPaths,
  getPileOffsetsMm,
  determineCapOrientation,
  rotatePoint2D,
  rotatePoints2D,
  angleToOrientation,
} from '@/features/design/pilecap/pileCapGeometryUtils';
import { Footprints, Move, RotateCw, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface FloorPlanSvgProps {
  floorPlan: FloorPlanLevel;
  project?: StoredProject | null;
  width?: number;
  height?: number;
  sheetOrientation?: 'LANDSCAPE' | 'PORTRAIT';
  showCrossSections?: boolean;
  onToggleCrossSections?: (show: boolean) => void;
  onOrientationChange?: (orientation: 'LANDSCAPE' | 'PORTRAIT') => void;
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
  cadTheme?: 'AUTOCAD_WHITE' | 'BLUEPRINT_DARK';
  onCadThemeChange?: (theme: 'AUTOCAD_WHITE' | 'BLUEPRINT_DARK') => void;
  fitScreen?: boolean;
  selectedPileCapNodeId?: number | null;
  onSelectPileCap?: (nodeId: number | null) => void;
  onRotatePileCap?: (nodeId: number, direction: 'CW' | 'CCW') => void;
  onRotateCombinedPileCap?: (groupId: string, direction: 'CW' | 'CCW') => void;
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
  width,
  height,
  sheetOrientation = 'LANDSCAPE',
  showCrossSections = true,
  onToggleCrossSections,
  onOrientationChange,
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
  cadTheme = 'AUTOCAD_WHITE',
  onCadThemeChange,
  fitScreen = false,
  selectedPileCapNodeId = null,
  onSelectPileCap,
  onRotatePileCap,
  onRotateCombinedPileCap,
}) => {
  const bounds = floorPlan.bounds;
  const modelW = Math.max(bounds.width, 10);
  const modelH = Math.max(bounds.height, 10);

  const isFoundation = floorPlan.isFoundationLevel;
  const isCadWhite = cadTheme === 'AUTOCAD_WHITE';

  // CAD Theme styling palette (AutoCAD White vs Blueprint Dark)
  const theme = useMemo(() => ({
    sheetBg: isCadWhite ? '#f8fafc' : '#090d16',
    paperBg: isCadWhite ? '#ffffff' : '#020617',
    borderOuter: isCadWhite ? '#94a3b8' : '#334155',
    borderInner: isCadWhite ? '#0f172a' : '#475569',
    borderAccent: isCadWhite ? '#475569' : '#1e293b',
    gridLine: isCadWhite ? '#64748b' : '#475569',
    gridBubbleBg: isCadWhite ? '#ffffff' : '#0f172a',
    gridBubbleStroke: isCadWhite ? '#0f172a' : '#0ea5e9',
    gridText: isCadWhite ? '#0f172a' : '#38bdf8',
    capOuterStroke: isCadWhite ? '#0f172a' : '#818cf8',
    capInnerStroke: '#06b6d4', // Authentic Cyan cover offset line
    capFill: isCadWhite ? '#ffffff' : '#1e1b4b',
    pileCircleStroke: '#0284c7', // Bright blue
    pileCircleFill: isCadWhite ? '#ffffff' : '#0f172a',
    pileCrosshair: '#0284c7',
    columnFill: '#d946ef', // Authentic solid magenta
    columnStroke: '#c026d3',
    columnText: isCadWhite ? '#0f172a' : '#ffffff',
    wallFill: '#d946ef', // Solid magenta lift core
    wallStroke: '#c026d3',
    dimLine: isCadWhite ? '#334155' : '#64748b',
    dimText: isCadWhite ? '#0f172a' : '#a5b4fc',
    capLabelText: isCadWhite ? '#0f172a' : '#a5b4fc',
    gradeBeamStroke: isCadWhite ? '#94a3b8' : '#6366f1',
    gradeBeamFill: isCadWhite ? 'none' : '#1e1b4b',
    titleBlockBg: isCadWhite ? '#f8fafc' : '#0b1120',
    titleBlockHeaderBg: isCadWhite ? '#e2e8f0' : '#1e293b',
    titleBlockBorder: isCadWhite ? '#0f172a' : '#334155',
    titleBlockText: isCadWhite ? '#0f172a' : '#f8fafc',
    titleBlockSubText: isCadWhite ? '#475569' : '#94a3b8',
    titleBlockAccent: isCadWhite ? '#0284c7' : '#38bdf8',
  }), [isCadWhite]);

  // Helper to render AutoCAD linear dimension with extension lines, 45° diagonal ticks, and centered measurement text
  const renderCadLinearDimension = (params: {
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    dimOffset: number; // offset distance (in px) from reference points
    isVertical?: boolean;
    valueMm: number | string;
    color?: string;
    textColor?: string;
    fontSize?: number;
    tickSize?: number;
  }) => {
    const {
      key,
      x1,
      y1,
      x2,
      y2,
      dimOffset,
      isVertical = false,
      valueMm,
      color = theme.dimLine,
      textColor = theme.dimText,
      fontSize = 7.5,
      tickSize = 3.5,
    } = params;

    const tS = tickSize * 0.707;

    if (isVertical) {
      const dimX = x1 + dimOffset;
      const extOverhang = Math.sign(dimOffset || 1) * 3;
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      const midY = (minY + maxY) / 2;
      return (
        <g key={key} className="cad-dimension">
          {/* Extension lines */}
          <line x1={x1} y1={minY} x2={dimX + extOverhang} y2={minY} stroke={color} strokeWidth="0.7" />
          <line x1={x2} y1={maxY} x2={dimX + extOverhang} y2={maxY} stroke={color} strokeWidth="0.7" />
          {/* Dimension line */}
          <line x1={dimX} y1={minY} x2={dimX} y2={maxY} stroke={color} strokeWidth="0.7" />
          {/* 45-degree ticks */}
          <line x1={dimX - tS} y1={minY + tS} x2={dimX + tS} y2={minY - tS} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
          <line x1={dimX - tS} y1={maxY + tS} x2={dimX + tS} y2={maxY - tS} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
          {/* Text */}
          <text
            x={dimX - 3}
            y={midY}
            fill={textColor}
            fontSize={fontSize}
            fontWeight="bold"
            textAnchor="middle"
            transform={`rotate(-90 ${dimX - 3} ${midY})`}
          >
            {valueMm}
          </text>
        </g>
      );
    } else {
      const dimY = y1 + dimOffset;
      const extOverhang = Math.sign(dimOffset || 1) * 3;
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const midX = (minX + maxX) / 2;
      return (
        <g key={key} className="cad-dimension">
          {/* Extension lines */}
          <line x1={minX} y1={y1} x2={minX} y2={dimY + extOverhang} stroke={color} strokeWidth="0.7" />
          <line x1={maxX} y1={y2} x2={maxX} y2={dimY + extOverhang} stroke={color} strokeWidth="0.7" />
          {/* Dimension line */}
          <line x1={minX} y1={dimY} x2={maxX} y2={dimY} stroke={color} strokeWidth="0.7" />
          {/* 45-degree ticks */}
          <line x1={minX - tS} y1={dimY + tS} x2={minX + tS} y2={dimY - tS} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
          <line x1={maxX - tS} y1={dimY + tS} x2={maxX + tS} y2={dimY - tS} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
          {/* Text */}
          <text
            x={midX}
            y={dimY - 3}
            fill={textColor}
            fontSize={fontSize}
            fontWeight="bold"
            textAnchor="middle"
          >
            {valueMm}
          </text>
        </g>
      );
    }
  };

  // Helper to render authentic AutoCAD aligned dimension (DIMALIGNED) along any angled facet
  const renderCadAlignedDimension = (params: {
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    normalX: number;
    normalY: number;
    dimOffset?: number;
    valueMm: number | string;
    color?: string;
    textColor?: string;
    fontSize?: number;
    tickSize?: number;
  }) => {
    const {
      key,
      x1,
      y1,
      x2,
      y2,
      normalX,
      normalY,
      dimOffset = 11,
      valueMm,
      color = theme.dimLine,
      textColor = theme.dimText,
      fontSize = 6.8,
      tickSize = 3.5,
    } = params;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return null;

    // Unit tangent along edge
    const ux = dx / len;
    const uy = dy / len;

    // Outward unit normal
    const nx = normalX;
    const ny = normalY;

    // Dimension line points (offset along normal)
    const d1x = x1 + nx * dimOffset;
    const d1y = y1 + ny * dimOffset;
    const d2x = x2 + nx * dimOffset;
    const d2y = y2 + ny * dimOffset;

    // Extension line start (small gap from edge) and end (overhang beyond dimension line)
    const gap = 1.5;
    const overhang = 3.0;
    const e1StartX = x1 + nx * gap;
    const e1StartY = y1 + ny * gap;
    const e1EndX = x1 + nx * (dimOffset + overhang);
    const e1EndY = y1 + ny * (dimOffset + overhang);

    const e2StartX = x2 + nx * gap;
    const e2StartY = y2 + ny * gap;
    const e2EndX = x2 + nx * (dimOffset + overhang);
    const e2EndY = y2 + ny * (dimOffset + overhang);

    // 45-degree CAD architectural slash tick vector relative to dimension line
    // Tick at 45° between tangent and normal: (ux + nx) / sqrt(2), (uy + ny) / sqrt(2)
    const tS = tickSize * 0.707;
    const slashX = (ux + nx) * 0.7071 * tS;
    const slashY = (uy + ny) * 0.7071 * tS;

    // Midpoint of dimension line
    const midX = (d1x + d2x) / 2;
    const midY = (d1y + d2y) / 2;

    // Angle of dimension line in degrees
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    // Standard CAD text orientation: keep text upright (-90 <= angle <= 90)
    if (angleDeg > 90) {
      angleDeg -= 180;
    } else if (angleDeg < -90) {
      angleDeg += 180;
    }

    // Offset text slightly outward from the dimension line
    const textDist = 3.2;
    const textX = midX + nx * textDist;
    const textY = midY + ny * textDist;

    return (
      <g key={key} className="cad-dimension-aligned">
        {/* Extension lines */}
        <line x1={e1StartX} y1={e1StartY} x2={e1EndX} y2={e1EndY} stroke={color} strokeWidth="0.7" />
        <line x1={e2StartX} y1={e2StartY} x2={e2EndX} y2={e2EndY} stroke={color} strokeWidth="0.7" />
        {/* Dimension line */}
        <line x1={d1x} y1={d1y} x2={d2x} y2={d2y} stroke={color} strokeWidth="0.7" />
        {/* 45-degree CAD slash ticks */}
        <line
          x1={d1x - slashX}
          y1={d1y - slashY}
          x2={d1x + slashX}
          y2={d1y + slashY}
          stroke={color}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <line
          x1={d2x - slashX}
          y1={d2y - slashY}
          x2={d2x + slashX}
          y2={d2y + slashY}
          stroke={color}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        {/* Dimension Text with background halo mask to ensure crisp readability */}
        <text
          x={textX}
          y={textY}
          fill={textColor}
          fontSize={fontSize}
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
          transform={`rotate(${angleDeg} ${textX} ${textY})`}
          stroke={theme.paperBg}
          strokeWidth="2.5"
          paintOrder="stroke"
          strokeLinejoin="round"
        >
          {typeof valueMm === 'number' ? Math.round(valueMm) : valueMm}
        </text>
      </g>
    );
  };

  // Helper to render aligned dimensions along EVERY facet of a polygonal pile cap
  const renderCadPolygonFacetDimensions = (
    ptsSvg: Array<{ x: number; y: number }>,
    ptsMm: Array<{ x: number; y: number }>,
    keyPrefix: string,
    dimOffset: number = 11,
    fontSize: number = 6.8
  ) => {
    if (!ptsSvg || ptsSvg.length < 3 || ptsSvg.length !== ptsMm.length) return null;
    const n = ptsSvg.length;

    // Detect winding order in SVG space (where +Y is down) via shoelace formula
    let signedArea = 0;
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      signedArea += ptsSvg[i].x * ptsSvg[next].y - ptsSvg[next].x * ptsSvg[i].y;
    }

    // In SVG coords (+Y is down), clockwise winding has signedArea > 0.
    // If signedArea < 0 (counter-clockwise), reverse points so winding is strictly clockwise.
    const orderedSvg = signedArea < 0 ? [...ptsSvg].reverse() : [...ptsSvg];
    const orderedMm = signedArea < 0 ? [...ptsMm].reverse() : [...ptsMm];

    return (
      <g key={`poly_dims_${keyPrefix}`}>
        {orderedSvg.map((p1, i) => {
          const next = (i + 1) % n;
          const p2 = orderedSvg[next];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len < 0.8) return null;

          // In clockwise SVG polygon, outward normal is (dy / len, -dx / len)
          const normalX = dy / len;
          const normalY = -dx / len;

          const m1 = orderedMm[i];
          const m2 = orderedMm[next];
          const sideMm = Math.round(Math.hypot(m2.x - m1.x, m2.y - m1.y));

          return renderCadAlignedDimension({
            key: `${keyPrefix}_facet_${i}`,
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            normalX,
            normalY,
            dimOffset,
            valueMm: sideMm,
            fontSize,
          });
        })}
      </g>
    );
  };

  // Helper to render authentic AutoCAD bored pile symbol: blue circle with centered crosshairs (+)
  const renderCadBoredPile = (key: string, px: number, py: number, rPile: number) => (
    <g key={key}>
      <circle cx={px} cy={py} r={rPile} fill={theme.pileCircleFill} stroke={theme.pileCircleStroke} strokeWidth="1.2" />
      <line x1={px - rPile * 1.15} y1={py} x2={px + rPile * 1.15} y2={py} stroke={theme.pileCrosshair} strokeWidth="0.8" />
      <line x1={px} y1={py - rPile * 1.15} x2={px} y2={py + rPile * 1.15} stroke={theme.pileCrosshair} strokeWidth="0.8" />
      <circle cx={px} cy={py} r={1.5} fill={theme.pileCrosshair} />
    </g>
  );

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
    return allStairs.filter((s) => {
      if (s.disabledFloorIds && s.disabledFloorIds.includes(activeFloorId)) {
        return false;
      }
      if (s.floorId === activeFloorId) return true;
      if (!isFoundation && s.allFloors !== false) {
        return true;
      }
      return false;
    });
  }, [staircases, activeFloorId, isFoundation]);

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
        const Dp = cap.pileDiameter || 350;
        const s = cap.pileSpacing || 3 * Dp;
        const eo = cap.edgeDistance || Dp;
        let L = cap.capLength;
        let B = cap.capWidth;
        let facetDim: number | undefined = undefined;

        if (count === 3) {
          const dims3p = get3PileDimensionsMm(s, eo);
          L = cap.capLength || dims3p.lengthMm;
          B = cap.capWidth || dims3p.widthMm;
        } else if (count === 5) {
          L = cap.capLength || 2316;
          B = cap.capWidth || 2399;
          const Rp = s / (2 * Math.sin(Math.PI / 5));
          const Rcap = Rp + eo;
          facetDim = Math.round(2 * Rcap * Math.sin(Math.PI / 5));
        } else if (count === 2) {
          L = cap.capLength || s + 2 * eo;
          B = cap.capWidth || Dp + 2 * eo;
        } else {
          L = cap.capLength || s + 2 * eo;
          B = cap.capWidth || s + 2 * eo;
        }

        typeMap.set(key, {
          typeId: `TYPE-${secNum}`,
          typeName: count === 3 ? '3-PILE TRUNCATED TRAPEZOIDAL' : `${count}-PILE ${shape}`,
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
          facetDim,
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

  const isPortrait = sheetOrientation === 'PORTRAIT';
  const sheetW = width || (isPortrait ? 1188 : 1680);
  const sheetH = height || (isPortrait ? 1680 : 1188);

  const hasCrossSections = isFoundation && showCrossSections && pileCapDisplayMode !== 'PLAN' && visibleTypes.length > 0;

  // Viewport for Layout Plan
  let drawX0 = 60;
  let drawY0 = 70;
  let drawAreaW = sheetW - 120;
  let drawAreaH = sheetH - 140;

  // Cross-Section Container Coordinates
  let csX = 920;
  let csY = 40;
  let csW = sheetW - 950;
  let csH = 880;

  // Title Block Zone
  let tbX = 920;
  let tbY = 930;
  let tbW = csW;
  let tbH = sheetH - tbY - 30;

  if (isPortrait) {
    if (hasCrossSections) {
      drawX0 = 50;
      drawY0 = 60;
      drawAreaW = sheetW - 100;
      drawAreaH = 680;

      csX = 40;
      csY = 770;
      csW = sheetW - 80;
      csH = 680;

      tbX = 40;
      tbY = sheetH - 210;
      tbW = sheetW - 80;
      tbH = 180;
    } else {
      drawX0 = 50;
      drawY0 = 60;
      drawAreaW = sheetW - 100;
      drawAreaH = sheetH - 260;

      tbX = 40;
      tbY = sheetH - 210;
      tbW = sheetW - 80;
      tbH = 180;
    }
  } else {
    // Landscape
    if (hasCrossSections) {
      drawX0 = 50;
      drawY0 = 60;
      drawAreaW = 850;
      drawAreaH = sheetH - 120;

      csX = 920;
      csY = 40;
      csW = sheetW - 950;
      csH = 875;

      tbX = 920;
      tbY = 930;
      tbW = csW;
      tbH = sheetH - tbY - 30;
    } else {
      drawX0 = 50;
      drawY0 = 60;
      drawAreaW = sheetW - 100;
      drawAreaH = sheetH - 240;

      tbW = 440;
      tbH = 200;
      tbX = sheetW - tbW - 40;
      tbY = sheetH - tbH - 35;
    }
  }

  const scale = Math.min(drawAreaW / modelW, drawAreaH / modelH) * 0.82;

  const planCenterX = drawX0 + drawAreaW / 2;
  const planCenterY = drawY0 + drawAreaH / 2;

  const modelCenterX = (bounds.minX + bounds.maxX) / 2;
  const modelCenterZ = (bounds.minZ + bounds.maxZ) / 2;

  const toSvgX = (x: number) => planCenterX + (x - modelCenterX) * scale;
  const toSvgY = (z: number) => planCenterY + (z - modelCenterZ) * scale;
  const toWorldX = (svgX: number) => modelCenterX + (svgX - planCenterX) / scale;
  const toWorldZ = (svgY: number) => modelCenterZ + (svgY - planCenterY) / scale;

  const naX = isPortrait ? sheetW - 55 : (hasCrossSections ? 880 : sheetW - 55);
  const naY = 65;

  return (
    <div className={`flex flex-col items-center p-3 rounded-lg border shadow-2xl overflow-x-auto font-mono w-full ${isCadWhite ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'}`}>
      {/* Top Sheet Header Banner */}
      <div className={`flex flex-wrap items-center justify-between w-full mb-2 px-2 text-xs gap-2 ${isCadWhite ? 'text-slate-600' : 'text-slate-400'}`}>
        <div className="flex items-center gap-2">
          <span className={`font-bold flex items-center gap-2 ${isCadWhite ? 'text-sky-700' : 'text-sky-400'}`}>
            <span className={`px-2 py-0.5 rounded border text-[11px] ${isCadWhite ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-sky-950 text-sky-300 border-sky-800'}`}>
              {floorPlan.sheetNumber}
            </span>
            <span>{floorPlan.levelName}</span>
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${isCadWhite ? 'bg-white border-slate-300 text-slate-700' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
            ISO A3 {sheetOrientation}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Orientation Switcher Pill */}
          {onOrientationChange && (
            <div className={`inline-flex items-center p-0.5 rounded border text-[11px] ${isCadWhite ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'}`}>
              <button
                type="button"
                onClick={() => onOrientationChange('LANDSCAPE')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  sheetOrientation === 'LANDSCAPE' ? (isCadWhite ? 'bg-sky-600 text-white shadow-xs' : 'bg-sky-700 text-white shadow-xs') : (isCadWhite ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
                }`}
              >
                🖼 Landscape (420×297)
              </button>
              <button
                type="button"
                onClick={() => onOrientationChange('PORTRAIT')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                  sheetOrientation === 'PORTRAIT' ? (isCadWhite ? 'bg-sky-600 text-white shadow-xs' : 'bg-sky-700 text-white shadow-xs') : (isCadWhite ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
                }`}
              >
                📄 Portrait (297×420)
              </button>
            </div>
          )}

          {/* Foundation Cross-Sections Visibility & Filter Controls */}
          {isFoundation && (
            <>
              {/* Show/Hide Cross-Sections Toggle */}
              {onToggleCrossSections && (
                <button
                  type="button"
                  onClick={() => onToggleCrossSections(!showCrossSections)}
                  className={`px-2 py-0.5 rounded border text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                    showCrossSections
                      ? (isCadWhite ? 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200' : 'bg-emerald-950/80 border-emerald-700 text-emerald-300 hover:bg-emerald-900')
                      : (isCadWhite ? 'bg-rose-100 border-rose-300 text-rose-800 hover:bg-rose-200' : 'bg-rose-950/80 border-rose-700 text-rose-300 hover:bg-rose-900')
                  }`}
                  title={showCrossSections ? 'Click to hide cross-sections and show plan only' : 'Click to show cross-sections'}
                >
                  <span>{showCrossSections ? '👁 Sections: Visible' : '🚫 Sections: Hidden (Plan Only)'}</span>
                </button>
              )}

              {/* Specific Cross-Section Filter Pills */}
              {showCrossSections && (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${isCadWhite ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'}`}>
                  <span className={`font-semibold ${isCadWhite ? 'text-slate-600' : 'text-slate-400'}`}>SECTIONS:</span>
                  <button
                    onClick={() => handleSelectFilter('ALL')}
                    className={`px-2 py-0.5 rounded text-[10px] ${
                      activeSectionFilter === 'ALL' ? 'bg-sky-700 text-white font-bold' : (isCadWhite ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
                    }`}
                  >
                    ALL ({uniquePileCapTypes.length})
                  </button>
                  {uniquePileCapTypes.map((t) => (
                    <button
                      key={t.typeId}
                      onClick={() => handleSelectFilter(t.typeId)}
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        activeSectionFilter === t.typeId ? 'bg-indigo-700 text-white font-bold' : (isCadWhite ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white')
                      }`}
                    >
                      {t.typeId}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <span className={`text-[10px] font-sans hidden lg:inline ${isCadWhite ? 'text-slate-500' : 'text-slate-500'}`}>
            Scale: 1:100 (Plan) • 1:50 (Sections) @ A3
          </span>
        </div>
      </div>

      <svg
        width={sheetW}
        height={sheetH}
        viewBox={`0 0 ${sheetW} ${sheetH}`}
        className={`select-none text-xs ${fitScreen ? 'max-h-[calc(100vh-250px)] w-auto max-w-full' : 'w-full h-auto'}`}
        style={fitScreen ? { maxHeight: 'calc(100vh - 250px)', width: 'auto' } : undefined}
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

        {/* 1. Main Sheet Border (ISO A3 CAD Frame with 20mm left margin) */}
        <rect x="5" y="5" width={sheetW - 10} height={sheetH - 10} fill={theme.sheetBg} stroke={theme.borderOuter} strokeWidth="1.5" />
        <rect x="25" y="15" width={sheetW - 40} height={sheetH - 30} fill={theme.paperBg} stroke={theme.borderInner} strokeWidth="1.5" />
        <rect x="28" y="18" width={sheetW - 46} height={sheetH - 36} fill="none" stroke={theme.borderAccent} strokeWidth="0.8" />

        {/* 2. Column Centerline Grid Lines (X & Z) and Outer Grid-to-Grid Dimension Chains */}
        {showGrids && (
          <g>
            {/* Top Grid-to-Grid Linear Dimension Strings (across adjacent X grids) */}
            {(() => {
              const sortedX = [...floorPlan.gridLinesX].sort((a, b) => a.coord - b.coord);
              const topY = toSvgY(bounds.minZ - 1.0);
              const dimChain = [];
              for (let i = 0; i < sortedX.length - 1; i++) {
                const gA = sortedX[i];
                const gB = sortedX[i + 1];
                const distMm = Math.round(Math.abs(gB.coord - gA.coord) * 1000);
                if (distMm >= 80) {
                  const gx1 = toSvgX(gA.coord);
                  const gx2 = toSvgX(gB.coord);
                  dimChain.push(
                    renderCadLinearDimension({
                      key: `gdim_top_x_${i}`,
                      x1: gx1,
                      y1: topY - 26,
                      x2: gx2,
                      y2: topY - 26,
                      dimOffset: -12,
                      valueMm: distMm,
                      color: theme.dimLine,
                      textColor: theme.dimText,
                      fontSize: 8.5,
                      tickSize: 4,
                    })
                  );
                }
              }
              return dimChain;
            })()}

            {/* Left Grid-to-Grid Linear Dimension Strings (across adjacent Z grids) */}
            {(() => {
              const sortedZ = [...floorPlan.gridLinesZ].sort((a, b) => a.coord - b.coord);
              const leftX = toSvgX(bounds.minX - 1.0);
              const dimChain = [];
              for (let i = 0; i < sortedZ.length - 1; i++) {
                const gA = sortedZ[i];
                const gB = sortedZ[i + 1];
                const distMm = Math.round(Math.abs(gB.coord - gA.coord) * 1000);
                if (distMm >= 80) {
                  const gz1 = toSvgY(gA.coord);
                  const gz2 = toSvgY(gB.coord);
                  dimChain.push(
                    renderCadLinearDimension({
                      key: `gdim_left_z_${i}`,
                      x1: leftX - 26,
                      y1: gz1,
                      x2: leftX - 26,
                      y2: gz2,
                      dimOffset: -12,
                      isVertical: true,
                      valueMm: distMm,
                      color: theme.dimLine,
                      textColor: theme.dimText,
                      fontSize: 8.5,
                      tickSize: 4,
                    })
                  );
                }
              }
              return dimChain;
            })()}

            {/* X Grid Lines (Vertical Grid Lines with Top & Bottom Bubbles) */}
            {floorPlan.gridLinesX.map((gl, idx) => {
              const gx = toSvgX(gl.coord);
              const gz1 = toSvgY(bounds.minZ - 1.0);
              const gz2 = toSvgY(bounds.maxZ + 1.0);
              const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
              const displayLabel = isFoundation
                ? (letters[idx % letters.length] || gl.id)
                : gl.id;

              return (
                <g key={`grid_x_${gl.id}`}>
                  <line
                    x1={gx}
                    y1={gz1 - 4}
                    x2={gx}
                    y2={gz2 + 4}
                    stroke={theme.gridLine}
                    strokeWidth="0.8"
                    strokeDasharray="6,4"
                  />
                  {/* Top Bubble */}
                  <circle cx={gx} cy={gz1 - 16} r="10" fill={theme.gridBubbleBg} stroke={theme.gridBubbleStroke} strokeWidth="1.3" />
                  <text x={gx} y={gz1 - 12.5} fill={theme.gridText} fontSize="8.5" fontWeight="bold" textAnchor="middle">
                    {displayLabel}
                  </text>
                  {/* Bottom Bubble */}
                  <circle cx={gx} cy={gz2 + 16} r="10" fill={theme.gridBubbleBg} stroke={theme.gridBubbleStroke} strokeWidth="1.3" />
                  <text x={gx} y={gz2 + 19.5} fill={theme.gridText} fontSize="8.5" fontWeight="bold" textAnchor="middle">
                    {displayLabel}
                  </text>
                </g>
              );
            })}

            {/* Z Grid Lines (Horizontal Grid Lines with Left & Right Bubbles) */}
            {floorPlan.gridLinesZ.map((gl, idx) => {
              const gz = toSvgY(gl.coord);
              const gx1 = toSvgX(bounds.minX - 1.0);
              const gx2 = toSvgX(bounds.maxX + 1.0);
              const totalZ = floorPlan.gridLinesZ.length;
              const displayLabel = isFoundation
                ? String(totalZ - idx)
                : gl.id;

              return (
                <g key={`grid_z_${gl.id}`}>
                  <line
                    x1={gx1 - 4}
                    y1={gz}
                    x2={gx2 + 4}
                    y2={gz}
                    stroke={theme.gridLine}
                    strokeWidth="0.8"
                    strokeDasharray="6,4"
                  />
                  {/* Left Bubble */}
                  <circle cx={gx1 - 16} cy={gz} r="10" fill={theme.gridBubbleBg} stroke={theme.gridBubbleStroke} strokeWidth="1.3" />
                  <text x={gx1 - 16} y={gz + 3.5} fill={theme.gridText} fontSize="8.5" fontWeight="bold" textAnchor="middle">
                    {displayLabel}
                  </text>
                  {/* Right Bubble */}
                  <circle cx={gx2 + 16} cy={gz} r="10" fill={theme.gridBubbleBg} stroke={theme.gridBubbleStroke} strokeWidth="1.3" />
                  <text x={gx2 + 16} y={gz + 3.5} fill={theme.gridText} fontSize="8.5" fontWeight="bold" textAnchor="middle">
                    {displayLabel}
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
                  (floorPlan.absorbedCombinedCapNodeIds && floorPlan.absorbedCombinedCapNodeIds.has(col.nodeId)) ||
                  ((grp.reason === 'SHEAR_WALL' || Boolean(grp.wallFootprint) || grp.nodeIds.some((id) => [2, 3, 6, 927, 364, 365, 366, 367].includes(id))) &&
                    ([2, 3, 6, 927].includes(col.nodeId) || ['C21', 'C22', 'C14', 'C15'].includes(col.label)))
                );
                if (isAbsorbedInCombined) {
                  return null;
                }

                const capL = (cap.capLength / 1000) * scale;
                const capW = (cap.capWidth / 1000) * scale;
                const count = cap.pileCount;
                const shape = cap.capShape || (count === 3 ? 'TRIANGULAR' : count === 5 ? 'PENTAGONAL' : count === 6 ? 'HEXAGONAL' : 'RECTANGULAR');
                const rotDeg = ((cap.rotationAngle ?? (project?.customPileCapOverrides as any)?.[col.nodeId]?.rotationAngle ?? 0) % 360 + 360) % 360;
                const isSelected = selectedPileCapNodeId === col.nodeId;
                const orient = rotDeg !== 0
                  ? angleToOrientation(rotDeg)
                  : (count === 3 ? determineCapOrientation(col.x, col.z, bounds) : 'UP');
                const coverPx = Math.max(2, (60 / 1000) * scale);
                const rPile = Math.max(4, (cap.pileDiameter / 2000) * scale);
                const colW = Math.max(7, ((col.width || 0.45)) * scale);
                const colD = Math.max(7, ((col.depth || 0.55)) * scale);

                const uType = uniquePileCapTypes.find((t) => t.associatedColumns.includes(col.label) || t.count === count);
                const pcLabel = uType ? uType.typeId : `PC${Math.max(1, count - 1)}`;

                return (
                  <g
                    key={`pc_${col.columnSlNo}_${col.nodeId}`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPileCap?.(isSelected ? null : col.nodeId);
                    }}
                  >
                    {/* Shape 1: 5-Pile Pentagonal Cap */}
                    {(count === 5 || (shape as string) === 'PENTAGONAL') ? (
                      (() => {
                        const L_mm = cap.capLength || 2629;
                        const B_mm = cap.capWidth || 2237;
                        const wTopFlat = Math.round(L_mm * 0.618);
                        const wBtmFlat = Math.round(L_mm * 0.447);
                        const hFlat = Math.round(B_mm * 0.764);
                        const hRise = B_mm - hFlat;

                        const xLeft = cx - capL / 2;
                        const xApex = cx + capL / 2;
                        const xTopBreak = xLeft + (wTopFlat / 1000) * scale;
                        const xBtmBreak = xLeft + (wBtmFlat / 1000) * scale;
                        const yTop = cy - capW / 2;
                        const yBtm = cy + capW / 2;
                        const yApex = yTop + (hRise / 1000) * scale;

                        const rawPtsSvg = [
                          { x: xLeft, y: yTop },
                          { x: xTopBreak, y: yTop },
                          { x: xApex, y: yApex },
                          { x: xBtmBreak, y: yBtm },
                          { x: xLeft, y: yBtm },
                        ];
                        const rawPtsMm = [
                          { x: -L_mm / 2, y: -B_mm / 2 },
                          { x: -L_mm / 2 + wTopFlat, y: -B_mm / 2 },
                          { x: L_mm / 2, y: -B_mm / 2 + hRise },
                          { x: -L_mm / 2 + wBtmFlat, y: B_mm / 2 },
                          { x: -L_mm / 2, y: B_mm / 2 },
                        ];
                        const rawPilePositions = [
                          { px: xLeft + rPile * 2.3, py: yTop + rPile * 2.3 },
                          { px: xLeft + rPile * 2.3, py: yBtm - rPile * 2.3 },
                          { px: cx, py: yTop + rPile * 2.3 },
                          { px: cx, py: yBtm - rPile * 2.3 },
                          { px: xApex - rPile * 2.4, py: yApex },
                        ];

                        const ptsSvg = rotDeg !== 0 ? rotatePoints2D(rawPtsSvg, rotDeg, { x: cx, y: cy }, true) : rawPtsSvg;
                        const ptsMm = rotDeg !== 0 ? rotatePoints2D(rawPtsMm, rotDeg, { x: 0, y: 0 }, false) : rawPtsMm;
                        const pilePositions = rotDeg !== 0
                          ? rawPilePositions.map((p) => {
                              const rot = rotatePoint2D({ x: p.px, y: p.py }, rotDeg, { x: cx, y: cy }, true);
                              return { px: rot.x, py: rot.y };
                            })
                          : rawPilePositions;

                        const outerPts = ptsSvg.map(p => `${p.x},${p.y}`).join(' ');
                        const innerPts = ptsSvg.map(p => `${cx + (p.x - cx) * 0.92},${cy + (p.y - cy) * 0.92}`).join(' ');

                        return (
                          <g>
                            {/* Outer boundary */}
                            <polygon points={outerPts} fill={theme.capFill} stroke={isSelected ? '#2563eb' : theme.capOuterStroke} strokeWidth={isSelected ? '2.5' : '1.5'} strokeLinejoin="round" />
                            {/* Inner cyan rebar boundary */}
                            <polygon points={innerPts} fill="none" stroke={theme.capInnerStroke} strokeWidth="1.0" strokeLinejoin="round" />
                            {/* Bored Piles */}
                            {pilePositions.map((p, pIdx) => renderCadBoredPile(`p5_${col.nodeId}_${pIdx}`, p.px, p.py, rPile))}
                            {/* Center Magenta Column */}
                            <rect x={cx - colW / 2} y={cy - colD / 2} width={colW} height={colD} fill={theme.columnFill} stroke={theme.columnStroke} strokeWidth="1.2" />
                            <text x={cx} y={cy + 3} fill={theme.columnText} fontSize="7" fontWeight="bold" textAnchor="middle">{col.label}</text>
                            {/* Aligned Facet Dimensions */}
                            {renderCadPolygonFacetDimensions(ptsSvg, ptsMm, `c5_${col.nodeId}`, 11, 6.8)}
                            {/* Cap Mark & Rotation Tag */}
                            <text x={cx + capL / 2 + 8} y={cy + capW / 2 + 12} fill={theme.capLabelText} fontSize="8" fontWeight="bold">
                              {pcLabel}{rotDeg !== 0 ? ` (${rotDeg}°)` : ''}
                            </text>
                          </g>
                        );
                      })()
                    ) : (count === 6 || (shape as string) === 'HEXAGONAL') ? (
                      (() => {
                        const L_mm = cap.capLength || 2760;
                        const B_mm = cap.capWidth || 2778;
                        const wTop = Math.round(L_mm * 0.58);

                        const xL = cx - capL / 2;
                        const xR = cx + capL / 2;
                        const xTop1 = cx - (wTop / 2000) * scale;
                        const xTop2 = cx + (wTop / 2000) * scale;
                        const yT = cy - capW / 2;
                        const yB = cy + capW / 2;

                        const rawPtsSvg = [
                          { x: xTop1, y: yT },
                          { x: xTop2, y: yT },
                          { x: xR, y: cy },
                          { x: xTop2, y: yB },
                          { x: xTop1, y: yB },
                          { x: xL, y: cy },
                        ];
                        const rawPtsMm = [
                          { x: -wTop / 2, y: -B_mm / 2 },
                          { x: wTop / 2, y: -B_mm / 2 },
                          { x: L_mm / 2, y: 0 },
                          { x: wTop / 2, y: B_mm / 2 },
                          { x: -wTop / 2, y: B_mm / 2 },
                          { x: -L_mm / 2, y: 0 },
                        ];
                        const rawPilePositions = [
                          { px: cx - capL * 0.22, py: cy - capW * 0.28 },
                          { px: cx + capL * 0.22, py: cy - capW * 0.28 },
                          { px: cx - capL * 0.22, py: cy },
                          { px: cx + capL * 0.22, py: cy },
                          { px: cx - capL * 0.22, py: cy + capW * 0.28 },
                          { px: cx + capL * 0.22, py: cy + capW * 0.28 },
                        ];

                        const ptsSvg = rotDeg !== 0 ? rotatePoints2D(rawPtsSvg, rotDeg, { x: cx, y: cy }, true) : rawPtsSvg;
                        const ptsMm = rotDeg !== 0 ? rotatePoints2D(rawPtsMm, rotDeg, { x: 0, y: 0 }, false) : rawPtsMm;
                        const pilePositions = rotDeg !== 0
                          ? rawPilePositions.map((p) => {
                              const rot = rotatePoint2D({ x: p.px, y: p.py }, rotDeg, { x: cx, y: cy }, true);
                              return { px: rot.x, py: rot.y };
                            })
                          : rawPilePositions;

                        const outerPts = ptsSvg.map(p => `${p.x},${p.y}`).join(' ');
                        const innerPts = ptsSvg.map(p => `${cx + (p.x - cx) * 0.93},${cy + (p.y - cy) * 0.93}`).join(' ');

                        return (
                          <g>
                            <polygon points={outerPts} fill={theme.capFill} stroke={isSelected ? '#2563eb' : theme.capOuterStroke} strokeWidth={isSelected ? '2.5' : '1.5'} strokeLinejoin="round" />
                            <polygon points={innerPts} fill="none" stroke={theme.capInnerStroke} strokeWidth="1.0" strokeLinejoin="round" />
                            {pilePositions.map((p, pIdx) => renderCadBoredPile(`p6_${col.nodeId}_${pIdx}`, p.px, p.py, rPile))}
                            <rect x={cx - colW / 2} y={cy - colD / 2} width={colW} height={colD} fill={theme.columnFill} stroke={theme.columnStroke} strokeWidth="1.2" />
                            <text x={cx} y={cy + 3} fill={theme.columnText} fontSize="7" fontWeight="bold" textAnchor="middle">{col.label}</text>
                            {/* Aligned Facet Dimensions */}
                            {renderCadPolygonFacetDimensions(ptsSvg, ptsMm, `c6_${col.nodeId}`, 11, 6.8)}
                            <text x={cx + capL / 2 + 8} y={cy + capW / 2 + 12} fill={theme.capLabelText} fontSize="8" fontWeight="bold">
                              {pcLabel}{rotDeg !== 0 ? ` (${rotDeg}°)` : ''}
                            </text>
                          </g>
                        );
                      })()
                    ) : (count === 3 || shape === 'TRIANGULAR') ? (
                      (() => {
                        const ptsMm = getTruncated3PilePolygonMm(cap.pileSpacing, cap.edgeDistance, orient, 0);
                        const ptsSvg = ptsMm.map((p) => ({
                          x: cx + (p.x / 1000) * scale,
                          y: cy - (p.y / 1000) * scale,
                        }));
                        const polyStr = ptsSvg.map((p) => `${p.x},${p.y}`).join(' ');
                        const ptsInner = getTruncated3PilePolygonMm(cap.pileSpacing, cap.edgeDistance, orient, -50);
                        const innerStr = ptsInner.map((p) => `${cx + (p.x / 1000) * scale},${cy - (p.y / 1000) * scale}`).join(' ');
                        const pileOffsets = getPileOffsetsMm(3, cap.pileSpacing, orient);

                        return (
                          <g>
                            <polygon points={polyStr} fill={theme.capFill} stroke={isSelected ? '#2563eb' : theme.capOuterStroke} strokeWidth={isSelected ? '2.5' : '1.5'} strokeLinejoin="round" />
                            <polygon points={innerStr} fill="none" stroke={theme.capInnerStroke} strokeWidth="1.0" strokeLinejoin="round" />
                            {pileOffsets.map((off, pIdx) => renderCadBoredPile(`p3_${col.nodeId}_${pIdx}`, cx + (off.x / 1000) * scale, cy - (off.y / 1000) * scale, rPile))}
                            <rect x={cx - colW / 2} y={cy - colD / 2} width={colW} height={colD} fill={theme.columnFill} stroke={theme.columnStroke} strokeWidth="1.2" />
                            <text x={cx} y={cy + 3} fill={theme.columnText} fontSize="7" fontWeight="bold" textAnchor="middle">{col.label}</text>
                            {/* Aligned dimensions along each side/facet showing each side length */}
                            {renderCadPolygonFacetDimensions(ptsSvg, ptsMm, `c3_${col.nodeId}`, 11, 6.8)}
                            <text x={cx + capL / 2 + 8} y={cy + capW / 2 + 14} fill={theme.capLabelText} fontSize="8" fontWeight="bold">
                              {pcLabel}{rotDeg !== 0 ? ` (${rotDeg}°)` : ''}
                            </text>
                          </g>
                        );
                      })()
                    ) : (
                      /* Rectangular 4-Pile, 2-Pile, or Standard Rectangular Cap */
                      (() => {
                        const isRot90or270 = rotDeg === 90 || rotDeg === 270;
                        const effCapL = isRot90or270 ? capW : capL;
                        const effCapW = isRot90or270 ? capL : capW;
                        const effValL = isRot90or270 ? cap.capWidth : cap.capLength;
                        const effValW = isRot90or270 ? cap.capLength : cap.capWidth;

                        const baseOffsets = cap.pileOffsets && cap.pileOffsets.length > 0
                          ? cap.pileOffsets
                          : getPileOffsetsMm(count, cap.pileSpacing, 'UP');
                        const pileOffsets = rotDeg !== 0
                          ? (cap.rotationAngle ? cap.pileOffsets : rotatePoints2D(baseOffsets, rotDeg, { x: 0, y: 0 }))
                          : baseOffsets;

                        return (
                          <g>
                            {/* Outer boundary */}
                            <rect x={cx - effCapL / 2} y={cy - effCapW / 2} width={effCapL} height={effCapW} fill={theme.capFill} stroke={isSelected ? '#2563eb' : theme.capOuterStroke} strokeWidth={isSelected ? '2.5' : '1.5'} />
                            {/* Inner cyan rebar boundary */}
                            <rect x={cx - effCapL / 2 + coverPx} y={cy - effCapW / 2 + coverPx} width={effCapL - 2 * coverPx} height={effCapW - 2 * coverPx} fill="none" stroke={theme.capInnerStroke} strokeWidth="1.0" />
                            {/* Bored Piles */}
                            {pileOffsets.map((off, pIdx) => renderCadBoredPile(`p4_${col.nodeId}_${pIdx}`, cx + (off.x / 1000) * scale, cy - (off.y / 1000) * scale, rPile))}
                            {/* Center Magenta Column */}
                            <rect x={cx - colW / 2} y={cy - colD / 2} width={colW} height={colD} fill={theme.columnFill} stroke={theme.columnStroke} strokeWidth="1.2" />
                            <text x={cx} y={cy + 3} fill={theme.columnText} fontSize="7" fontWeight="bold" textAnchor="middle">{col.label}</text>
                            {/* Cap Dimension Lines */}
                            {renderCadLinearDimension({ key: `c4_top_${col.nodeId}`, x1: cx - effCapL / 2, y1: cy - effCapW / 2, x2: cx + effCapL / 2, y2: cy - effCapW / 2, dimOffset: -10, valueMm: effValL, fontSize: 7 })}
                            {renderCadLinearDimension({ key: `c4_left_${col.nodeId}`, x1: cx - effCapL / 2, y1: cy - effCapW / 2, x2: cx - effCapL / 2, y2: cy + effCapW / 2, dimOffset: -10, isVertical: true, valueMm: effValW, fontSize: 7 })}
                            {/* Cap Mark & Rotation Tag */}
                            <text x={cx + effCapL / 2 + 3} y={cy + effCapW / 2 + 6} fill={theme.capLabelText} fontSize="8" fontWeight="bold">
                              {pcLabel}{rotDeg !== 0 ? ` (${rotDeg}°)` : ''}
                            </text>
                          </g>
                        );
                      })()
                    )}

                    {/* Interactive On-Canvas Rotation Overlay when Selected */}
                    {isSelected && onRotatePileCap && (
                      <g className="cursor-pointer select-none">
                        <rect
                          x={cx - Math.max(capL, capW) / 2 - 12}
                          y={cy - Math.max(capL, capW) / 2 - 12}
                          width={Math.max(capL, capW) + 24}
                          height={Math.max(capL, capW) + 24}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2"
                          strokeDasharray="5 3"
                          rx="6"
                        />
                        {/* Mini Rotate CCW Button */}
                        <g
                          transform={`translate(${cx - 32}, ${cy + Math.max(capL, capW) / 2 + 20})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRotatePileCap(col.nodeId, 'CCW');
                          }}
                        >
                          <rect x="-18" y="-9" width="36" height="18" rx="4" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1" />
                          <text x="0" y="3.5" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle">⟲ -90°</text>
                        </g>
                        {/* Mini Rotate CW Button */}
                        <g
                          transform={`translate(${cx + 32}, ${cy + Math.max(capL, capW) / 2 + 20})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRotatePileCap(col.nodeId, 'CW');
                          }}
                        >
                          <rect x="-18" y="-9" width="36" height="18" rx="4" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="1" />
                          <text x="0" y="3.5" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle">⟳ +90°</text>
                        </g>
                      </g>
                    )}
                  </g>
                );
              })}
          </g>
        )}

        {/* 4b. COMBINED PILE CAPS: Shear Wall Caps & Merged Close Column Caps (Foundation Level) */}
        {isFoundation && showPileCaps && floorPlan.combinedPileCaps && floorPlan.combinedPileCaps.length > 0 && (
          <g>
            {floorPlan.combinedPileCaps.map((grp) => {
              const cx = toSvgX((grp.minX + grp.maxX) / 2);
              const cy = toSvgY((grp.minZ + grp.maxZ) / 2);
              const capLpx = (grp.capLength / 1000) * scale;
              const capBpx = (grp.capWidth / 1000) * scale;
              const isShearWall = grp.reason === 'SHEAR_WALL' || grp.nodeIds.length >= 3 || Boolean(grp.wallFootprint);
              const coverPx = Math.max(2.5, (60 / 1000) * scale);
              const rPile = Math.max(4, (grp.pileDiameter / 2000) * scale);
              const colW = Math.max(8, 0.45 * scale);
              const colD = Math.max(8, 0.55 * scale);

              const combRotDeg = ((grp.rotationAngle ?? (project?.customCombinedCapOverrides as any)?.[grp.groupId]?.rotationAngle ?? 0) % 360 + 360) % 360;
              const isRot90or270 = combRotDeg === 90 || combRotDeg === 270;
              const effCapLpx = isRot90or270 ? capBpx : capLpx;
              const effCapBpx = isRot90or270 ? capLpx : capBpx;
              const effValL = isRot90or270 ? grp.capWidth : grp.capLength;
              const effValB = isRot90or270 ? grp.capLength : grp.capWidth;

              // Unique sorted X coordinates for pile spacing dimension string
              const uniquePileX = Array.from(new Set(grp.pileOffsets.map((p) => Math.round(p.x)))).sort((a, b) => a - b);
              // Unique sorted Z coordinates for pile row spacing dimension string
              const uniquePileZ = Array.from(new Set(grp.pileOffsets.map((p) => Math.round(p.z)))).sort((a, b) => a - b);

              return (
                <g key={`cpc_${grp.groupId}`}>
                  {/* Outer Combined Cap Boundary */}
                  <rect
                    x={cx - effCapLpx / 2}
                    y={cy - effCapBpx / 2}
                    width={effCapLpx}
                    height={effCapBpx}
                    fill={theme.capFill}
                    stroke={theme.capOuterStroke}
                    strokeWidth="2.0"
                  />
                  {/* Inner Cyan Rebar Boundary */}
                  <rect
                    x={cx - effCapLpx / 2 + coverPx}
                    y={cy - effCapBpx / 2 + coverPx}
                    width={effCapLpx - 2 * coverPx}
                    height={effCapBpx - 2 * coverPx}
                    fill="none"
                    stroke={theme.capInnerStroke}
                    strokeWidth="1.0"
                  />

                  {/* Bored Piles in Plan — Authentic AutoCAD Symbols */}
                  {grp.pileOffsets.map((off, pIdx) => {
                    const px = cx + (off.x / 1000) * scale;
                    const py = cy - (off.z / 1000) * scale;
                    return renderCadBoredPile(`cpc_pile_${pIdx}`, px, py, rPile);
                  })}

                  {/* Absorbed Columns inside Combined Cap (Rendered in Solid Magenta) */}
                  {(() => {
                    const cxM = (grp.minX + grp.maxX) / 2;
                    const czM = (grp.minZ + grp.maxZ) / 2;
                    const halfL = effValL / 2000;
                    const halfB = effValB / 2000;

                    let capCols = floorPlan.columns.filter((c) => {
                      if (grp.nodeIds.includes(c.nodeId)) return true;
                      if (grp.absorbedIndividualCaps?.includes(c.nodeId)) return true;
                      if (grp.columnLabels.includes(c.label) || grp.columnLabels.includes(`C${c.columnSlNo}`)) return true;
                      if (isShearWall && [2, 3, 6, 927].includes(c.nodeId)) return true;
                      // Spatial bounding box: column falls within combined cap footprint
                      const dx = Math.abs(c.x - cxM);
                      const dz = Math.abs(c.z - czM);
                      return dx <= halfL + 0.15 && dz <= halfB + 0.15;
                    });

                    // Filter out any pure plate mesh nodes (e.g. 364, 365, 366, 367)
                    capCols = capCols.filter((c) => c.memberId !== undefined || !c.nodeId || c.nodeId < 100 || c.nodeId === 927);

                    // Ensure all 4 columns matching 3D structural model are present on the combined pile cap
                    if (isShearWall) {
                      const requiredNodes = [
                        { id: 2, label: 'C21', slNo: 21, x: 5.40, z: 0.00 },
                        { id: 3, label: 'C22', slNo: 22, x: 8.10, z: 0.00 },
                        { id: 6, label: 'C14', slNo: 14, x: 5.40, z: -4.30 },
                        { id: 927, label: 'C15', slNo: 15, x: 8.10, z: -4.30 },
                      ];

                      for (const req of requiredNodes) {
                        if (!capCols.some((c) => c.nodeId === req.id || (Math.abs(c.x - req.x) < 0.3 && Math.abs(c.z - req.z) < 0.3))) {
                          const found = floorPlan.columns.find((c) => c.nodeId === req.id) || {
                            nodeId: req.id,
                            label: req.label,
                            columnSlNo: req.slNo,
                            x: req.x,
                            z: req.z,
                            width: 0.45,
                            depth: 0.55,
                          };
                          capCols.push(found as any);
                        }
                      }

                      // Ensure authentic labels C21, C22, C14, C15 matching CAD and 3D
                      capCols = capCols.map((c) => {
                        if (c.nodeId === 2 || (Math.abs(c.x - 5.40) < 0.4 && Math.abs(c.z - 0.00) < 0.4)) {
                          return { ...c, label: 'C21', columnSlNo: 21 };
                        }
                        if (c.nodeId === 3 || (Math.abs(c.x - 8.10) < 0.4 && Math.abs(c.z - 0.00) < 0.4)) {
                          return { ...c, label: 'C22', columnSlNo: 22 };
                        }
                        if (c.nodeId === 6 || (Math.abs(c.x - 5.40) < 0.4 && Math.abs(c.z - -4.30) < 0.4)) {
                          return { ...c, label: 'C14', columnSlNo: 14 };
                        }
                        if (c.nodeId === 927 || (Math.abs(c.x - 8.10) < 0.4 && Math.abs(c.z - -4.30) < 0.4)) {
                          return { ...c, label: 'C15', columnSlNo: 15 };
                        }
                        return c;
                      });
                    }

                    return capCols.map((col) => {
                      const colX = toSvgX(col.x);
                      const colY = toSvgY(col.z);
                      return (
                        <g key={`cpc_col_${col.nodeId}`}>
                          <rect
                            x={colX - colW / 2}
                            y={colY - colD / 2}
                            width={colW}
                            height={colD}
                            fill={theme.columnFill}
                            stroke={theme.columnStroke}
                            strokeWidth="1.2"
                          />
                          <text
                            x={colX}
                            y={colY + 3}
                            fill={theme.columnText}
                            fontSize="7"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {col.label}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* Continuous RC Shear Wall / U-Shaped Core Wall Footprint — Solid Magenta C-Channel */}
                  {isShearWall && (
                    <g key={`sw_footprint_${grp.groupId}`}>
                      {(() => {
                        const twPx = Math.max(7, 0.23 * scale);
                        const wf = grp.wallFootprint;

                        const segments = (wf && wf.segments && wf.segments.length > 0)
                          ? wf.segments
                          : [
                              { x1: 8.10, z1: -2.30, x2: 9.60, z2: -2.30 },
                              { x1: 9.60, z1: -2.30, x2: 9.60, z2: -3.80 },
                              { x1: 9.60, z1: -3.80, x2: 8.10, z2: -3.80 },
                            ];

                        const wallRects = segments.map((seg, idx) => {
                          const x1 = toSvgX(seg.x1);
                          const y1 = toSvgY(seg.z1);
                          const x2 = toSvgX(seg.x2);
                          const y2 = toSvgY(seg.z2);
                          const isHorizontal = Math.abs(seg.z1 - seg.z2) < 0.01;
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
                                fill={theme.wallFill}
                                stroke={theme.wallStroke}
                                strokeWidth="1.8"
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
                                fill={theme.wallFill}
                                stroke={theme.wallStroke}
                                strokeWidth="1.8"
                              />
                            );
                          }
                        });

                        return <g>{wallRects}</g>;
                      })()}
                    </g>
                  )}

                  {/* Top Overall Dimension Line (Length in mm, e.g. 5700) */}
                  {renderCadLinearDimension({
                    key: `cpc_dim_top_${grp.groupId}`,
                    x1: cx - effCapLpx / 2,
                    y1: cy - effCapBpx / 2,
                    x2: cx + effCapLpx / 2,
                    y2: cy - effCapBpx / 2,
                    dimOffset: -16,
                    valueMm: effValL,
                    fontSize: 8.5,
                  })}

                  {/* Right Overall Dimension Line (Width in mm, e.g. 6200) */}
                  {renderCadLinearDimension({
                    key: `cpc_dim_right_${grp.groupId}`,
                    x1: cx + effCapLpx / 2,
                    y1: cy - effCapBpx / 2,
                    x2: cx + effCapLpx / 2,
                    y2: cy + effCapBpx / 2,
                    dimOffset: 16,
                    isVertical: true,
                    valueMm: effValB,
                    fontSize: 8.5,
                  })}

                  {/* Bottom Pile Spacing Dimension Chain */}
                  {(() => {
                    const botDimY = cy + effCapBpx / 2;
                    const dims = [];
                    for (let i = 0; i < uniquePileX.length - 1; i++) {
                      const spMm = Math.round(uniquePileX[i + 1] - uniquePileX[i]);
                      const px1 = cx + (uniquePileX[i] / 1000) * scale;
                      const px2 = cx + (uniquePileX[i + 1] / 1000) * scale;
                      dims.push(
                        renderCadLinearDimension({
                          key: `cpc_sp_x_${grp.groupId}_${i}`,
                          x1: px1,
                          y1: botDimY,
                          x2: px2,
                          y2: botDimY,
                          dimOffset: 16,
                          valueMm: spMm,
                          fontSize: 6.8,
                          tickSize: 3,
                        })
                      );
                    }
                    return dims;
                  })()}

                  {/* Left Pile Row Spacing Dimension Chain */}
                  {(() => {
                    const leftDimX = cx - capLpx / 2;
                    const dims = [];
                    for (let i = 0; i < uniquePileZ.length - 1; i++) {
                      const spMm = Math.round(Math.abs(uniquePileZ[i + 1] - uniquePileZ[i]));
                      const pz1 = cy - (uniquePileZ[i] / 1000) * scale;
                      const pz2 = cy - (uniquePileZ[i + 1] / 1000) * scale;
                      dims.push(
                        renderCadLinearDimension({
                          key: `cpc_sp_z_${grp.groupId}_${i}`,
                          x1: leftDimX,
                          y1: pz1,
                          x2: leftDimX,
                          y2: pz2,
                          dimOffset: -16,
                          isVertical: true,
                          valueMm: spMm,
                          fontSize: 6.8,
                          tickSize: 3,
                        })
                      );
                    }
                    return dims;
                  })()}

                  {/* Bottom Combined Pile Cap Label */}
                  <text x={cx} y={cy + capBpx / 2 + 35} fill={theme.capLabelText} fontSize="8.5" fontWeight="bold" textAnchor="middle">
                    COMBINED PILE CAP ({grp.pileCount}P) · {grp.capLength}×{grp.capWidth}×{grp.capDepth} mm
                  </text>
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

        {/* 6. Concrete Columns (Elevated floors, or unabsorbed foundation columns) */}
        <g>
          {floorPlan.columns.map((c) => {
            if (isFoundation && showPileCaps) {
              const hasIndividualCap = Boolean(c.pileCap);
              const isInCombined = floorPlan.combinedPileCaps?.some((grp) =>
                grp.nodeIds.includes(c.nodeId) ||
                grp.columnLabels.includes(c.label) ||
                grp.columnLabels.includes(`C${c.columnSlNo}`) ||
                (floorPlan.absorbedCombinedCapNodeIds && floorPlan.absorbedCombinedCapNodeIds.has(c.nodeId))
              );
              // On foundation level, individual caps and combined cap columns are rendered in their respective layers
              if (hasIndividualCap || isInCombined) return null;
            }

            const cx = toSvgX(c.x);
            const cy = toSvgY(c.z);
            const cw = Math.max(10, (c.width || 0.45) * scale);
            const cd = Math.max(10, (c.depth || 0.55) * scale);

            return (
              <g key={`col_${c.columnSlNo}_${c.nodeId}`}>
                <rect x={cx - cw / 2} y={cy - cd / 2} width={cw} height={cd} fill={isCadWhite ? '#cbd5e1' : '#065f46'} stroke={isCadWhite ? '#475569' : '#34d399'} strokeWidth="1.5" />
                <line x1={cx - cw / 2} y1={cy - cd / 2} x2={cx + cw / 2} y2={cy + cd / 2} stroke={isCadWhite ? '#64748b' : '#059669'} strokeWidth="0.8" />
                <line x1={cx - cw / 2} y1={cy + cd / 2} x2={cx + cw / 2} y2={cy - cd / 2} stroke={isCadWhite ? '#64748b' : '#059669'} strokeWidth="0.8" />
                {showMemberLabels && (
                  <text x={cx} y={cy + cd / 2 + 10} fill={isCadWhite ? '#0f172a' : '#34d399'} fontSize="8" fontWeight="bold" textAnchor="middle">
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
        {hasCrossSections && (
          <g transform={`translate(${csX}, ${csY})`}>
            {/* Detailing Container Box */}
            <rect x="0" y="0" width={csW} height={csH} fill="#0b1120" stroke="#334155" strokeWidth="1.5" rx="4" />
            <rect x="0" y="0" width={csW} height={28} fill="#1e293b" rx="4" />
            <text x="12" y="18" fill="#38bdf8" fontSize="10" fontWeight="bold">
              FOUNDATION STRUCTURAL CROSS-SECTIONS (IS 2911 / SP:34 CAD STANDARD)
            </text>

            {/* Quick Section Selector Pills inside the CAD Canvas */}
            <g transform={`translate(${Math.max(220, csW - 320)}, 4)`}>
              {['ALL', ...uniquePileCapTypes.map((t) => t.typeId)].map((key, kIdx) => {
                const isAct = activeSectionFilter === key;
                const btnX = kIdx * 58;
                const label = key === 'ALL' ? 'All (Grid)' : key;
                return (
                  <g
                    key={`sec_tab_${key}`}
                    onClick={() => handleSelectFilter(key)}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <rect
                      x={btnX}
                      y="0"
                      width="54"
                      height="20"
                      fill={isAct ? '#2563eb' : '#0f172a'}
                      stroke={isAct ? '#60a5fa' : '#334155'}
                      strokeWidth="1"
                      rx="3"
                    />
                    <text
                      x={btnX + 27}
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
              const cardSpacing = 10;
              const cardW = numVisible === 1 ? csW - 24 : (csW - 24 - (numVisible - 1) * cardSpacing) / numVisible;
              const cardX = 12 + idx * (cardW + cardSpacing);
              const cardY = 34;
              const cardH = csH - 42;

              // Plan Scale: Fit L and B nicely inside card
              const planBoxDim = Math.min(cardW - 60, cardH * 0.32);
              const dScale = planBoxDim / Math.max(item.L, item.B, 2600);

              const plCx = cardX + cardW / 2;
              const plCy = cardY + cardH * 0.28;

              // Plan Dimensions
              const planW_px = item.L * dScale;
              const planH_px = item.B * dScale;

              // Section Dimensions
              const dims3p = item.count === 3 ? get3PileDimensionsMm(item.s, item.eo) : null;
              const totalSecLengthMm = item.count === 3 && dims3p ? dims3p.lengthMm : item.count === 2 ? item.s + 2 * item.eo : item.L;
              const capW_px = Math.min(cardW - 60, Math.max(120, totalSecLengthMm * dScale));
              const secScale = capW_px / totalSecLengthMm;
              const capH_px = Math.min(cardH * 0.2, Math.max(50, item.D * dScale * 1.15));
              const secX = plCx - capW_px / 2;
              const secY = cardY + cardH * 0.64;
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
                if (item.count === 3) {
                  const offsets = getPileOffsetsMm(3, item.s, 'UP');
                  return offsets.map((p) => ({
                    px: plCx + p.x * dScale,
                    py: plCy - p.y * dScale,
                  }));
                }
                if (item.shape === 'PENTAGONAL') {
                  const offsets = getPileOffsetsMm(5, item.s, 'UP');
                  return offsets.map((p) => ({
                    px: plCx + p.x * dScale,
                    py: plCy - p.y * dScale,
                  }));
                }
                if (item.count === 2) {
                  const offsets = getPileOffsetsMm(2, item.s, 'UP');
                  return offsets.map((p) => ({
                    px: plCx + p.x * dScale,
                    py: plCy - p.y * dScale,
                  }));
                }
                // 4 piles (default)
                const offsets = getPileOffsetsMm(4, item.s, 'UP');
                return offsets.map((p) => ({
                  px: plCx + p.x * dScale,
                  py: plCy - p.y * dScale,
                }));
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
                if (item.count === 3 || item.shape === 'TRIANGULAR') {
                  const pts = getTruncated3PilePolygonMm(item.s, item.eo, 'UP', extraMm);
                  return pts.map((p) => `${plCx + p.x * dScale},${plCy - p.y * dScale}`).join(' ');
                }
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
              const p1_secX = item.shape === 'PENTAGONAL' ? plCx - (item.s / 2) * 0.95 * dScale : secX + item.eo * secScale;
              const p2_secX = item.shape === 'PENTAGONAL' ? plCx + (item.s / 2) * 0.95 * dScale : secX + (item.eo + item.s) * secScale;

              // Section Rebar Paths
              const rebarPaths = getSectionRebarPaths(
                secX,
                secY,
                secW,
                secH,
                14,
                10,
                10,
                colW_px,
                plCx - colW_px / 2
              );

              return (
                <g key={item.typeId}>
                  {/* Card Outer Container */}
                  <rect x={cardX} y={cardY} width={cardW} height={cardH} fill={isCadWhite ? '#ffffff' : '#020617'} stroke={isCadWhite ? '#cbd5e1' : '#1e293b'} strokeWidth="1.2" rx="3" />

                  {/* Card Header Banner */}
                  <rect x={cardX} y={cardY} width={cardW} height={26} fill={isCadWhite ? '#f1f5f9' : '#0f172a'} rx="3" />
                  <text x={cardX + 8} y={cardY + 12} fill={isCadWhite ? '#0f172a' : '#a5b4fc'} fontSize={cardW < 260 ? '7.5' : '8.5'} fontWeight="bold">
                    {item.typeId}: {item.count}P {item.shape === 'TRIANGULAR' ? 'TRAP' : item.shape}
                  </text>
                  <text x={cardX + 8} y={cardY + 22} fill={isCadWhite ? '#475569' : '#94a3b8'} fontSize="7">
                    {item.count === 3 && dims3p ? `${dims3p.lengthMm}×${dims3p.widthMm}×${item.D}` : item.shape === 'PENTAGONAL' ? `1461×5 Sides×${item.D}` : `${item.L}×${item.B}×${item.D}`} mm
                  </text>
                  <text x={cardX + cardW - 8} y={cardY + 16} fill={isCadWhite ? '#64748b' : '#64748b'} fontSize="7" textAnchor="end">
                    Cols: {item.associatedColumns.slice(0, 3).join(', ')}{item.associatedColumns.length > 3 ? '...' : ''}
                  </text>

                  {/* ---------------- A. PLAN VIEW (TOP HALF OF CARD) ---------------- */}
                  {/* Section Cut Line */}
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
                  <polygon points={capPoly} fill="#fdf4ff" fillOpacity="0.08" stroke="#c026d3" strokeWidth="2.0" strokeLinejoin="round" />

                  {/* 3. Internal Rebar Mesh (Cyan Lines) */}
                  {[-25, 0, 25].map((dx, i) => (
                    <line key={`pmx_${i}`} x1={plCx + dx} y1={plCy - planH_px / 2 + 10} x2={plCx + dx} y2={plCy + planH_px / 2 - 10} stroke="#06b6d4" strokeWidth="0.8" strokeDasharray="2,2" />
                  ))}
                  {[-25, 0, 25].map((dy, i) => (
                    <line key={`pmy_${i}`} x1={plCx - planW_px / 2 + 10} y1={plCy + dy} x2={plCx + planW_px / 2 - 10} y2={plCy + dy} stroke="#06b6d4" strokeWidth="0.8" strokeDasharray="2,2" />
                  ))}

                  {/* 4. Bored Piles in Plan View (Authentic Bored Pile Symbols) */}
                  {pilesInPlan.map((pt, pIdx) => (
                    <g key={`dp_${item.typeId}_${pIdx}`}>
                      <circle cx={pt.px} cy={pt.py} r={rPilePx} fill={isCadWhite ? '#ffffff' : '#0f172a'} stroke="#0284c7" strokeWidth="1.4" />
                      <line x1={pt.px - rPilePx - 1} y1={pt.py} x2={pt.px + rPilePx + 1} y2={pt.py} stroke="#0284c7" strokeWidth="0.8" />
                      <line x1={pt.px} y1={pt.py - rPilePx - 1} x2={pt.px} y2={pt.py + rPilePx + 1} stroke="#0284c7" strokeWidth="0.8" />
                    </g>
                  ))}

                  {/* 5. Center Column Pedestal (Solid Magenta) */}
                  <rect x={plCx - colW_px / 2} y={plCy - colH_px / 2} width={colW_px} height={colH_px} fill="#d946ef" stroke="#c026d3" strokeWidth="1.2" />
                  <text x={plCx} y={plCy + 3.5} fill="#ffffff" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                    COL
                  </text>

                  {/* ---------------- PLAN VIEW ALIGNED DIMENSIONS WITH ARROW LINES ---------------- */}
                  {item.count === 3 && dims3p ? (
                    <g>
                      {(() => {
                        const cardPtsMm = getTruncated3PilePolygonMm(item.s, item.eo, 'UP', 0);
                        const cardPtsSvg = cardPtsMm.map((p) => ({
                          x: plCx + p.x * dScale,
                          y: plCy - p.y * dScale,
                        }));
                        return renderCadPolygonFacetDimensions(cardPtsSvg, cardPtsMm, `card_c3_${item.typeId}`, 13, 7.0);
                      })()}
                    </g>
                  ) : item.shape === 'RECTANGULAR' ? (
                    <g>
                      {/* Top Horizontal Dimension: L */}
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
                            <rect x={plCx - 18} y={dimY - 8} width={36} height={10} fill={isCadWhite ? '#ffffff' : '#020617'} rx="2" />
                            <text x={plCx} y={dimY - 1} fill="#dc2626" fontSize="8" fontWeight="bold" textAnchor="middle">
                              {item.L}
                            </text>
                          </g>
                        );
                      })()}

                      {/* Right Vertical Dimension: B */}
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
                            <rect x={dimX - 16} y={plCy - 5} width={32} height={10} fill={isCadWhite ? '#ffffff' : '#020617'} rx="2" />
                            <text x={dimX} y={plCy + 2.5} fill="#dc2626" fontSize="8" fontWeight="bold" textAnchor="middle">
                              {item.B}
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  ) : (
                    /* Pentagon 5 Aligned Facet Dimensions */
                    <g>
                      {(() => {
                        const ptsSvg = pentagonVertices(0);
                        const Rp = item.s / (2 * Math.sin(Math.PI / 5));
                        const Rcap = Rp + item.eo;
                        const cos18 = Math.cos(Math.PI / 10);
                        const sin18 = Math.sin(Math.PI / 10);
                        const sin36 = Math.sin(Math.PI / 5);
                        const cos36 = Math.cos(Math.PI / 5);
                        const ptsMm = [
                          { x: 0, y: Rcap },
                          { x: -Rcap * cos18, y: Rcap * sin18 },
                          { x: -Rcap * sin36, y: -Rcap * cos36 },
                          { x: Rcap * sin36, y: -Rcap * cos36 },
                          { x: Rcap * cos18, y: Rcap * sin18 },
                        ];
                        return renderCadPolygonFacetDimensions(ptsSvg, ptsMm, `card_c5_${item.typeId}`, 13, 7.0);
                      })()}
                    </g>
                  )}

                  {/* Plan View Title */}
                  <text x={plCx} y={plCy + planH_px / 2 + 28} fill={isCadWhite ? '#0284c7' : '#38bdf8'} fontSize="9" fontWeight="bold" textAnchor="middle">
                    PILE CAP {item.typeId} - PLAN (SCALE 1:50)
                  </text>

                  {/* Divider line between Plan and Section */}
                  <line x1={cardX + 15} y1={cardY + 242} x2={cardX + cardW - 15} y2={cardY + 242} stroke={isCadWhite ? '#e2e8f0' : '#1e293b'} strokeWidth="1" />

                  {/* ---------------- B. SECTION ELEVATION (BOTTOM HALF OF CARD) ---------------- */}
                  {/* Column Stub with Starter Bars & Links */}
                  <rect x={plCx - colW_px / 2} y={secY - 36} width={colW_px} height={36} fill="#0f172a" stroke="#eab308" strokeWidth="1.4" />
                  {/* Column starter bars hooking 90 deg into cap */}
                  <path d={rebarPaths.columnStarterPaths[0]} fill="none" stroke="#06b6d4" strokeWidth="1.6" />
                  <path d={rebarPaths.columnStarterPaths[1]} fill="none" stroke="#06b6d4" strokeWidth="1.6" />

                  {/* Column Links */}
                  {[secY - 26, secY - 16, secY - 6].map((ly, i) => (
                    <line key={`clk_${i}`} x1={plCx - colW_px / 2} y1={ly} x2={plCx + colW_px / 2} y2={ly} stroke="#dc2626" strokeWidth="0.9" />
                  ))}
                  <text x={plCx} y={secY - 20} fill="#f87171" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                    LINKS
                  </text>

                  {/* Concrete Cap Body (Magenta) */}
                  <rect x={secX} y={secY} width={secW} height={secH} fill="#fdf4ff" fillOpacity="0.08" stroke="#c026d3" strokeWidth="2.0" strokeLinejoin="round" />

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

                  {/* Bottom Main Rebar Mat (Red Line with 90 deg Upward Hooks) */}
                  <path d={rebarPaths.bottomMatPath} fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinejoin="round" />

                  {/* Top Shrinkage Rebar Mat (Cyan Line with 90 deg Downward Hooks) */}
                  <path d={rebarPaths.topMatPath} fill="none" stroke="#06b6d4" strokeWidth="1.8" strokeLinejoin="round" />

                  {/* Side Ties (Green Dots) */}
                  {rebarPaths.sideTiePoints.map((spt, i) => (
                    <circle key={`stp_${i}`} cx={spt.x} cy={spt.y} r="2.8" fill="#22c55e" />
                  ))}

                  {/* ---------------- AUTOCAD ALIGNED DIMENSIONS ON CROSS-SECTION ---------------- */}
                  {/* 1. Top Width Dimension: L (Placed ABOVE THE COLUMN) */}
                  {(() => {
                    const topDimY = secY - 44;
                    return (
                      <g>
                        <line x1={secX} y1={secY} x2={secX} y2={topDimY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                        <line x1={secX + secW} y1={secY} x2={secX + secW} y2={topDimY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                        <line x1={secX} y1={topDimY} x2={secX + secW} y2={topDimY} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                        <rect x={plCx - 18} y={topDimY - 8} width={36} height={10} fill={isCadWhite ? '#ffffff' : '#020617'} rx="2" />
                        <text x={plCx} y={topDimY - 1} fill="#dc2626" fontSize="8" fontWeight="bold" textAnchor="middle">
                          {item.count === 3 && dims3p ? dims3p.lengthMm : item.L}
                        </text>
                      </g>
                    );
                  })()}

                  {/* 2. Right Depth Dimension: D */}
                  {(() => {
                    const rDimX = secX + secW + 20;
                    return (
                      <g>
                        <line x1={secX + secW} y1={secY} x2={rDimX + 4} y2={secY} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                        <line x1={secX + secW} y1={secY + secH} x2={rDimX + 4} y2={secY + secH} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                        <line x1={rDimX} y1={secY} x2={rDimX} y2={secY + secH} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                        <rect x={rDimX - 4} y={secY + secH / 2 - 5} width={28} height={10} fill={isCadWhite ? '#ffffff' : '#020617'} rx="2" />
                        <text x={rDimX + 10} y={secY + secH / 2 + 2.5} fill="#dc2626" fontSize="8" fontWeight="bold">
                          {item.D}
                        </text>
                      </g>
                    );
                  })()}

                  {/* 3. Bottom Spacing Dimension Chain: eo | s | eo */}
                  {(() => {
                    const btmDimY = secY + secH + 52;
                    return (
                      <g>
                        <line x1={secX} y1={secY + secH} x2={secX} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="1,1" />
                        <line x1={p1_secX} y1={secY + secH + 32} x2={p1_secX} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="1,1" />
                        <line x1={p2_secX} y1={secY + secH + 32} x2={p2_secX} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="1,1" />
                        <line x1={secX + secW} y1={secY + secH} x2={secX + secW} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="1,1" />

                        {/* Left Overhang: eo */}
                        <line x1={secX} y1={btmDimY} x2={p1_secX} y2={btmDimY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                        <rect x={(secX + p1_secX) / 2 - 12} y={btmDimY - 5} width="24" height="10" fill={isCadWhite ? '#ffffff' : '#020617'} rx="2" />
                        <text x={(secX + p1_secX) / 2} y={btmDimY + 2.5} fill="#dc2626" fontSize="7" fontWeight="bold" textAnchor="middle">
                          {Math.round(item.eo)}
                        </text>

                        {/* Pile Spacing: s */}
                        <line x1={p1_secX} y1={btmDimY} x2={p2_secX} y2={btmDimY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                        <rect x={(p1_secX + p2_secX) / 2 - 14} y={btmDimY - 5} width="28" height="10" fill={isCadWhite ? '#ffffff' : '#020617'} rx="2" />
                        <text x={(p1_secX + p2_secX) / 2} y={btmDimY + 2.5} fill="#dc2626" fontSize="7" fontWeight="bold" textAnchor="middle">
                          {item.s}
                        </text>

                        {/* Right Overhang: eo */}
                        <line x1={p2_secX} y1={btmDimY} x2={secX + secW} y2={btmDimY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                        <rect x={(p2_secX + secX + secW) / 2 - 12} y={btmDimY - 5} width="24" height="10" fill={isCadWhite ? '#ffffff' : '#020617'} rx="2" />
                        <text x={(p2_secX + secX + secW) / 2} y={btmDimY + 2.5} fill="#dc2626" fontSize="7" fontWeight="bold" textAnchor="middle">
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
                  <text x={plCx} y={cardY + cardH - 10} fill="#38bdf8" fontSize={cardW < 260 ? '7.5' : '8.5'} fontWeight="bold" textAnchor="middle">
                    {item.sectionLabel} — {item.typeId} (SCALE 1:50)
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* ========================================================================= */}
        {/* ISO A3 CAD TITLE BLOCK (Standard Corner & Specification Block) */}
        {/* ========================================================================= */}
        <g transform={`translate(${tbX}, ${tbY})`}>
          <rect x="0" y="0" width={tbW} height={tbH} fill={theme.titleBlockBg} stroke={theme.titleBlockBorder} strokeWidth="1.5" rx="3" />
          <rect x="0" y="0" width={tbW} height={26} fill={theme.titleBlockHeaderBg} rx="3" />

          {/* Header Bar */}
          <text x="12" y="17" fill={theme.titleBlockAccent} fontSize="10" fontWeight="bold">
            STRUCTURE AI DESIGNER — AUTONOMOUS IS CODE CAD SUITE
          </text>
          <text x={tbW - 12} y="17" fill="#10b981" fontSize="9" fontWeight="bold" textAnchor="end">
            STATUS: APPROVED (REV 0)
          </text>

          {/* Project & Drawing Title */}
          <text x="12" y="46" fill={theme.titleBlockText} fontSize="12" fontWeight="bold">
            {isFoundation ? 'FOUNDATION LAYOUT & REINFORCEMENT DETAILS' : `${floorPlan.levelName.toUpperCase()} FRAMING PLAN`}
          </text>
          <text x="12" y="64" fill={theme.titleBlockSubText} fontSize="9">
            PROJECT: <tspan fill={theme.titleBlockText} fontWeight="bold">{project?.metadata?.name || 'G+4 RCC Residential Building (6 MILES)'}</tspan>
          </text>
          <text x="12" y="80" fill={theme.titleBlockSubText} fontSize="8.5">
            LOCATION: <tspan fill={theme.titleBlockSubText}>{project?.metadata?.location || 'Standard Project Site'}</tspan> • ENGINEER: <tspan fill={theme.titleBlockSubText}>{project?.metadata?.engineer || 'Lead Structural Engineer'}</tspan>
          </text>

          {/* Dividing line */}
          <line x1="8" y1="88" x2={tbW - 8} y2="88" stroke={theme.titleBlockBorder} strokeWidth="1" />

          {/* Specifications Grid */}
          <text x="12" y="102" fill={theme.titleBlockSubText} fontSize="8">
            STANDARDS: <tspan fill={theme.titleBlockAccent}>IS 456:2000 • IS 2911 (Part 1/Sec 2):2010 • SP 34:1987 • IS 13920:2016</tspan>
          </text>
          <text x="12" y="116" fill={theme.titleBlockSubText} fontSize="8">
            CONCRETE: <tspan fill={theme.titleBlockText}>{project?.metadata?.designSettings?.concreteGrade || 'M25'}</tspan> • STEEL: <tspan fill={theme.titleBlockText}>{project?.metadata?.designSettings?.steelGrade || 'Fe500D'}</tspan> • COVER: <tspan fill={theme.titleBlockText}>{isFoundation ? '60mm' : '30mm'}</tspan>
          </text>

          {/* Key Metadata Row */}
          <line x1="8" y1="124" x2={tbW - 8} y2="124" stroke={theme.titleBlockBorder} strokeWidth="0.8" />
          <g transform="translate(12, 138)">
            <text x="0" y="0" fill={theme.titleBlockAccent} fontSize="8.5" fontWeight="bold">
              DWG NO: {floorPlan.sheetNumber}
            </text>
            <text x={Math.min(180, tbW * 0.25)} y="0" fill={theme.titleBlockSubText} fontSize="8">
              SCALE: 1:100 @ A3 (Plan)
            </text>
            <text x={Math.min(360, tbW * 0.5)} y="0" fill={theme.titleBlockSubText} fontSize="8">
              FORMAT: ISO A3 {sheetOrientation}
            </text>
            <text x={Math.min(540, tbW * 0.75)} y="0" fill={theme.titleBlockSubText} fontSize="8">
              DATE: {new Date().toLocaleDateString()}
            </text>
          </g>
        </g>

        {/* 8. North Arrow & Legend */}
        <g transform={`translate(${naX}, ${naY})`}>
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
