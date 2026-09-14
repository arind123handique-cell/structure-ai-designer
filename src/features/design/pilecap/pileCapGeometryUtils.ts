/**
 * pileCapGeometryUtils.ts
 *
 * Engineering CAD geometry utilities for pile cap plans and cross sections
 * adhering to authentic AutoCAD structural detailing standards (IS 2911 & SP:34).
 * Supports:
 *  - Quarter-shaded bored pile graphic symbol (crosshairs with alternating filled quadrants).
 *  - Truncated triangular/trapezoidal 3-pile caps with chamfers and 4 orthogonal orientations (UP, DOWN, LEFT, RIGHT).
 *  - Rectangular 2-pile, square 4-pile, pentagonal 5-pile, and 6-pile configurations.
 *  - Multi-tiered CAD dimension chains (internal spacing, centerline offsets, diagonal chamfers, overall dimensions).
 *  - Section elevation rebar hooks (90 deg bottom hooks upward, 90 deg top hooks downward, column starter hooks, side face skin ties, PCC, embedment).
 */

export type CapOrientation = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Point2D {
  x: number;
  y: number;
}

export interface DimensionChainItem {
  id: string;
  start: Point2D;
  end: Point2D;
  extStart1: Point2D;
  extEnd1: Point2D;
  extStart2: Point2D;
  extEnd2: Point2D;
  textPos: Point2D;
  text: string;
  angleDeg?: number;
}

/**
 * Returns pile offsets in millimeters relative to the column centroid (0,0).
 */
export function getPileOffsetsMm(
  count: number,
  spacingMm: number,
  orientation: CapOrientation = 'UP'
): Point2D[] {
  const s = spacingMm;

  if (count === 2) {
    // 2-pile cap: along X axis (or Y depending on orientation)
    if (orientation === 'UP' || orientation === 'DOWN') {
      return [
        { x: -Math.round(s / 2), y: 0 },
        { x: Math.round(s / 2), y: 0 },
      ];
    } else {
      return [
        { x: 0, y: -Math.round(s / 2) },
        { x: 0, y: Math.round(s / 2) },
      ];
    }
  }

  if (count === 3) {
    // Equilateral triangle: Rp = s / sqrt(3) ~= 0.57735 * s
    const Rp = Math.round(s / Math.sqrt(3));
    const halfRp = Math.round(Rp / 2);
    const halfS = Math.round(s / 2);

    let pts: Point2D[];
    if (orientation === 'UP') {
      pts = [
        { x: 0, y: Rp }, // Apex (Top)
        { x: -halfS, y: -halfRp }, // Base Left
        { x: halfS, y: -halfRp }, // Base Right
      ];
    } else if (orientation === 'DOWN') {
      pts = [
        { x: 0, y: -Rp }, // Apex (Bottom)
        { x: -halfS, y: halfRp }, // Base Left
        { x: halfS, y: halfRp }, // Base Right
      ];
    } else if (orientation === 'LEFT') {
      pts = [
        { x: -Rp, y: 0 }, // Apex (Left)
        { x: halfRp, y: -halfS }, // Base Top
        { x: halfRp, y: halfS }, // Base Bottom
      ];
    } else {
      // RIGHT
      pts = [
        { x: Rp, y: 0 }, // Apex (Right)
        { x: -halfRp, y: -halfS }, // Base Top
        { x: -halfRp, y: halfS }, // Base Bottom
      ];
    }
    return pts;
  }

  if (count === 4) {
    const halfS = Math.round(s / 2);
    return [
      { x: -halfS, y: halfS },
      { x: halfS, y: halfS },
      { x: -halfS, y: -halfS },
      { x: halfS, y: -halfS },
    ];
  }

  if (count === 5) {
    // 5-pile regular pentagon
    const Rp = Math.round(s / (2 * Math.sin(Math.PI / 5)));
    const cos18 = Math.cos(Math.PI / 10);
    const sin18 = Math.sin(Math.PI / 10);
    const sin36 = Math.sin(Math.PI / 5);
    const cos36 = Math.cos(Math.PI / 5);

    return [
      { x: 0, y: Rp },
      { x: -Math.round(Rp * cos18), y: Math.round(Rp * sin18) },
      { x: -Math.round(Rp * sin36), y: -Math.round(Rp * cos36) },
      { x: Math.round(Rp * sin36), y: -Math.round(Rp * cos36) },
      { x: Math.round(Rp * cos18), y: Math.round(Rp * sin18) },
    ];
  }

  // 6 piles: 3x2 grid
  const halfS = Math.round(s / 2);
  return [
    { x: -s, y: halfS },
    { x: 0, y: halfS },
    { x: s, y: halfS },
    { x: -s, y: -halfS },
    { x: 0, y: -halfS },
    { x: s, y: -halfS },
  ];
}

/**
 * Generates polygon vertices for a truncated 3-pile trapezoidal cap with chamfers.
 * Coordinates are in millimeters relative to the column centroid (0,0).
 *
 * @param s Pile spacing in mm
 * @param eo Edge distance in mm
 * @param orientation Direction apex points: 'UP', 'DOWN', 'LEFT', 'RIGHT'
 * @param extraOffsetMm Positive for PCC (+150mm), negative for rebar cage (-60mm)
 */
export function getTruncated3PilePolygonMm(
  s: number,
  eo: number,
  orientation: CapOrientation = 'UP',
  extraOffsetMm: number = 0
): Point2D[] {
  const curEo = eo + extraOffsetMm;
  const Rp = s / Math.sqrt(3);
  const halfRp = Rp / 2;
  const halfS = s / 2;

  // Base shape (orientation = UP):
  // Top flat edge (apex): width = 2 * curEo, y = Rp + curEo
  // Bottom flat edge (base): width = s + 2 * curEo, y = -(halfRp + curEo)
  // Side vertical return at bottom corners: height = curEo (from -(halfRp + curEo) up to -halfRp)
  // Slanted edges connecting (-(halfS + curEo), -halfRp) to (-curEo, Rp + curEo)
  const topY = Rp + curEo;
  const btmY = -(halfRp + curEo);
  const sideReturnY = -halfRp;
  const topHalfW = curEo;
  const btmHalfW = halfS + curEo;

  const rawPtsUp: Point2D[] = [
    { x: -topHalfW, y: topY }, // Top-left of flat apex
    { x: topHalfW, y: topY }, // Top-right of flat apex
    { x: btmHalfW, y: sideReturnY }, // Top-right of base corner
    { x: btmHalfW, y: btmY }, // Bottom-right of base corner
    { x: -btmHalfW, y: btmY }, // Bottom-left of base corner
    { x: -btmHalfW, y: sideReturnY }, // Top-left of base corner
  ];

  if (orientation === 'UP') {
    return rawPtsUp;
  }
  if (orientation === 'DOWN') {
    return rawPtsUp.map((p) => ({ x: p.x, y: -p.y }));
  }
  if (orientation === 'LEFT') {
    return rawPtsUp.map((p) => ({ x: -p.y, y: p.x }));
  }
  // RIGHT
  return rawPtsUp.map((p) => ({ x: p.y, y: -p.x }));
}

/**
 * Returns overall bounding length L and width B in mm for a 3-pile cap.
 */
export function get3PileDimensionsMm(s: number, eo: number): {
  lengthMm: number; // base width
  widthMm: number; // total height
  apexWidthMm: number;
  RpMm: number;
  halfRpMm: number;
  diagonalChamferMm: number;
} {
  const Rp = Math.round(s / Math.sqrt(3));
  const halfRp = Math.round(Rp / 2);
  const lengthMm = s + 2 * eo; // base width
  const widthMm = Math.round(Rp + halfRp + 2 * eo); // total height = 1.5 * Rp + 2 * eo
  const apexWidthMm = 2 * eo;

  const dx = Math.round(s / 2);
  const dy = Math.round(1.5 * Rp + eo);
  const diagonalChamferMm = Math.round(Math.hypot(dx, dy));

  return {
    lengthMm,
    widthMm,
    apexWidthMm,
    RpMm: Rp,
    halfRpMm: halfRp,
    diagonalChamferMm,
  };
}

/**
 * Generates an SVG path for the quarter-shaded structural pile symbol.
 * Quadrant 1 (top-right) and Quadrant 3 (bottom-left) are filled.
 * Quadrants 2 & 4 remain light/open.
 * Center crosshairs extend 2px beyond the outer circle.
 */
export function renderQuarteredPileSvg(
  cx: number,
  cy: number,
  r: number,
  fillColor = '#2563eb',
  strokeColor = '#1e3a8a',
  strokeWidth = 1.2
): {
  outerCircle: { cx: number; cy: number; r: number };
  shadedQuadrantPath: string;
  crosshairs: { x1: number; y1: number; x2: number; y2: number }[];
} {
  const ext = 2.5;

  // Shaded Quadrant 1 (Angle 270 deg to 360 deg: top to right)
  // Shaded Quadrant 3 (Angle 90 deg to 180 deg: bottom to left)
  // SVG coordinates: (cx, cy - r) is 12 o'clock, (cx + r, cy) is 3 o'clock, (cx, cy + r) is 6 o'clock, (cx - r, cy) is 9 o'clock
  const q1Path = `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`;
  const q3Path = `M ${cx} ${cy} L ${cx} ${cy + r} A ${r} ${r} 0 0 1 ${cx - r} ${cy} Z`;
  const combinedPath = `${q1Path} ${q3Path}`;

  const crosshairs = [
    { x1: cx - r - ext, y1: cy, x2: cx + r + ext, y2: cy },
    { x1: cx, y1: cy - r - ext, x2: cx, y2: cy + r + ext },
  ];

  return {
    outerCircle: { cx, cy, r },
    shadedQuadrantPath: combinedPath,
    crosshairs,
  };
}

/**
 * Generates section elevation rebar paths with IS 456 / IS 2911 anchorage hooks.
 * - Bottom main flexural bar: horizontal along bottom with 90 deg upward hooks at ends.
 * - Top distribution bar: horizontal along top with 90 deg downward hooks at ends.
 * - Column starter bars: vertical down through cap, hooking horizontally outward 90 deg.
 */
export function getSectionRebarPaths(
  secX: number,
  secY: number,
  secW: number,
  secH: number,
  coverBottom = 60,
  coverTop = 40,
  coverSide = 40,
  colW = 50,
  colX?: number
): {
  bottomMatPath: string;
  topMatPath: string;
  columnStarterPaths: string[];
  sideTiePoints: Point2D[];
} {
  const btmY = secY + secH - coverBottom;
  const topY = secY + coverTop;
  const leftX = secX + coverSide;
  const rightX = secX + secW - coverSide;
  const hookLen = Math.min(secH * 0.65, 180);

  // Bottom mat with 90 deg upward hooks
  const bottomMatPath = `M ${leftX} ${btmY - hookLen} L ${leftX} ${btmY} L ${rightX} ${btmY} L ${rightX} ${btmY - hookLen}`;

  // Top mat with 90 deg downward hooks
  const topMatPath = `M ${leftX} ${topY + hookLen * 0.5} L ${leftX} ${topY} L ${rightX} ${topY} L ${rightX} ${topY + hookLen * 0.5}`;

  // Column starter bars (left bar hooks left, right bar hooks right)
  const actualColX = colX ?? secX + (secW - colW) / 2;
  const colLeftBarX = actualColX + 8;
  const colRightBarX = actualColX + colW - 8;
  const colEmbedY = btmY - 4;
  const colHookLen = 22;

  const colLeftPath = `M ${colLeftBarX} ${secY - 45} L ${colLeftBarX} ${colEmbedY} L ${colLeftBarX - colHookLen} ${colEmbedY}`;
  const colRightPath = `M ${colRightBarX} ${secY - 45} L ${colRightBarX} ${colEmbedY} L ${colRightBarX + colHookLen} ${colEmbedY}`;

  // Side face ties points
  const sideTiePoints: Point2D[] = [
    { x: leftX, y: secY + secH * 0.35 },
    { x: leftX, y: secY + secH * 0.65 },
    { x: rightX, y: secY + secH * 0.35 },
    { x: rightX, y: secY + secH * 0.65 },
  ];

  return {
    bottomMatPath,
    topMatPath,
    columnStarterPaths: [colLeftPath, colRightPath],
    sideTiePoints,
  };
}

/**
 * Determines 3-pile cap orientation based on column coordinates in a building model bounds.
 */
export function determineCapOrientation(
  colX: number,
  colZ: number,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
): CapOrientation {
  const tolX = Math.max(1.0, (bounds.maxX - bounds.minX) * 0.15);
  const tolZ = Math.max(1.0, (bounds.maxZ - bounds.minZ) * 0.15);

  const isTopEdge = Math.abs(colZ - bounds.minZ) <= tolZ;
  const isBottomEdge = Math.abs(colZ - bounds.maxZ) <= tolZ;
  const isLeftEdge = Math.abs(colX - bounds.minX) <= tolX;
  const isRightEdge = Math.abs(colX - bounds.maxX) <= tolX;

  if (isTopEdge && !isLeftEdge && !isRightEdge) return 'UP';
  if (isBottomEdge && !isLeftEdge && !isRightEdge) return 'DOWN';
  if (isLeftEdge) return 'LEFT';
  if (isRightEdge) return 'RIGHT';

  return 'UP';
}
