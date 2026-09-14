/**
 * Drawing sheet model — a flat list of CAD primitives expressed in millimetre
 * model units, mirroring the conventions of the source AutoCAD detailing
 * drawings (see DXF_DRAWING_ANALYSIS.md at the repo root).
 *
 * A single `DrawingSheet` is the one source of truth for both the on-screen SVG
 * renderer and any DXF export, so a sheet only ever has to be built once.
 *
 * Conventions carried over from the source drawings:
 *   - Model units are millimetres; text heights are paper_mm x 100 for a 1:100 sheet.
 *   - Text heights actually used: 200/225/250/300/325.
 *   - Beam cross-sections are drawn at 4x true size (printed 1:25).
 *   - Beam elevation / zone strips are drawn at 2x true size (printed 1:50).
 *   - Plans and slab sheets are drawn at true size (printed 1:100).
 */

export type SheetAnchor = 'start' | 'middle' | 'end';

/** A CAD layer, kept identical to the layer names used by the source drawings. */
export interface SheetLayer {
  name: string;
  /** AutoCAD Color Index — preserved so a DXF export round-trips the same colours. */
  aci: number;
}

export type SheetPrimitive =
  | { t: 'line'; layer: string; x1: number; y1: number; x2: number; y2: number; width?: number }
  | { t: 'poly'; layer: string; pts: [number, number][]; closed?: boolean; width?: number }
  | { t: 'circle'; layer: string; cx: number; cy: number; r: number; filled?: boolean }
  /** Filled shape — dimension arrowheads, hatch wedges (DXF SOLID). */
  | { t: 'solid'; layer: string; pts: [number, number][] }
  | {
      t: 'text';
      layer: string;
      x: number;
      y: number;
      text: string;
      /** Text height in model units (200 = 2.0 mm on a 1:100 sheet). */
      h: number;
      anchor?: SheetAnchor;
      underline?: boolean;
      bold?: boolean;
    }
  /** Embedded raster image (data URI or URL). Used for viewporting existing SVG components. */
  | { t: 'image'; layer: string; x: number; y: number; w: number; h: number; href: string };

export interface SheetBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DrawingSheet {
  sheetNumber: string;
  title: string;
  subtitle?: string;
  levelName: string;
  layers: SheetLayer[];
  primitives: SheetPrimitive[];
  bounds: SheetBounds;
  /** Scale notes printed on the sheet, e.g. "(SCALE 1:25)". */
  notes: string[];
}

// ---------------------------------------------------------------------------
// Scale / text-height constants (model units = mm)
// ---------------------------------------------------------------------------

/** Cross-sections are drawn 4x true size so they print at 1:25 on a 1:100 sheet. */
export const SECTION_SCALE = 4;
/** Elevation and zone strips are drawn 2x true size so they print at 1:50. */
export const STRIP_SCALE = 2;
/** Plans and slab sheets are drawn true size. */
export const PLAN_SCALE = 1;

export const TEXT_H = {
  /** Dimension text, zone lengths, clear spans (clearly visible on ISO A3). */
  DIM: 350,
  /** Rebar callouts, stirrup notes, bar marks. */
  CALLOUT: 240,
  /** Support labels, column marks, grid text. */
  MARK: 220,
  GRID: 220,
  /** Beam size labels (B1:230x450), slab labels. */
  LABEL: 250,
  /** Grid bubbles in plans. */
  GRID_BUBBLE: 280,
  /** Major section titles (e.g. SECTION AA). */
  SECTION_TITLE: 320,
  /** Sheet titles. */
  SHEET_TITLE: 450,
} as const;

/** Nominal cover used across the detailing sheets, in mm. */
export const BEAM_COVER = 30;

// ---------------------------------------------------------------------------
// Layer definitions — names and ACI colours taken from the source drawings
// ---------------------------------------------------------------------------

export const LAYER_CONCRETE: SheetLayer = { name: 'Concrete Line', aci: 2 };
export const LAYER_REBAR: SheetLayer = { name: 'Reinforcement', aci: 4 };
export const LAYER_LINK: SheetLayer = { name: 'Link', aci: 225 };
export const LAYER_SPACER: SheetLayer = { name: 'Spacer', aci: 4 };
export const LAYER_GRID: SheetLayer = { name: 'Grid', aci: 8 };
export const LAYER_LABELS: SheetLayer = { name: 'Labels', aci: 4 };
export const LAYER_LABELS_SUPPORT: SheetLayer = { name: 'Labels_Support', aci: 4 };
export const LAYER_TEXT: SheetLayer = { name: 'Text', aci: 31 };
export const LAYER_TEXT_SCALE: SheetLayer = { name: 'Text_Scale', aci: 31 };
export const LAYER_DIMENSION: SheetLayer = { name: 'Dimension', aci: 31 };
export const LAYER_SCHEDULE_BORDER: SheetLayer = { name: 'Schedule Border', aci: 60 };
export const LAYER_SCHEDULE_HEADER: SheetLayer = { name: 'Schedule Header', aci: 4 };
export const LAYER_SCHEDULE_LINE: SheetLayer = { name: 'Schedule Line', aci: 60 };
export const LAYER_SCHEDULE_TEXT: SheetLayer = { name: 'Schedule Text', aci: 31 };
export const LAYER_CUT_LINE: SheetLayer = { name: 'Cut Line', aci: 31 };
export const LAYER_SECTION_MARK: SheetLayer = { name: 'Section Mark', aci: 5 };
export const LAYER_SOLID: SheetLayer = { name: 'Solid', aci: 25 };
export const LAYER_BEAM: SheetLayer = { name: 'Beam', aci: 3 };
export const LAYER_BEAM_NOS: SheetLayer = { name: 'Beam Nos', aci: 7 };
export const LAYER_COLUMN: SheetLayer = { name: 'Column', aci: 2 };
export const LAYER_COLUMN_NOS: SheetLayer = { name: 'Column Nos', aci: 7 };

/** Layers used by the beam reinforcement cross-section sheet. */
export const BEAM_SECTION_SHEET_LAYERS: SheetLayer[] = [
  LAYER_CONCRETE,
  LAYER_REBAR,
  LAYER_LINK,
  LAYER_SPACER,
  LAYER_GRID,
  LAYER_LABELS,
  LAYER_LABELS_SUPPORT,
  LAYER_TEXT,
  LAYER_TEXT_SCALE,
  LAYER_DIMENSION,
  LAYER_SCHEDULE_BORDER,
  LAYER_SCHEDULE_HEADER,
  LAYER_SCHEDULE_LINE,
  LAYER_SCHEDULE_TEXT,
  LAYER_CUT_LINE,
  LAYER_SECTION_MARK,
  LAYER_BEAM,
  LAYER_BEAM_NOS,
  LAYER_COLUMN,
  LAYER_COLUMN_NOS,
];

/** Layers used by the slab detailing sheet. */
export const SLAB_SHEET_LAYERS: SheetLayer[] = [
  LAYER_CONCRETE,
  LAYER_REBAR,
  LAYER_LINK,
  LAYER_GRID,
  LAYER_LABELS,
  LAYER_LABELS_SUPPORT,
  LAYER_TEXT,
  LAYER_TEXT_SCALE,
  LAYER_DIMENSION,
  LAYER_SCHEDULE_BORDER,
  LAYER_SCHEDULE_HEADER,
  LAYER_SCHEDULE_LINE,
  LAYER_SCHEDULE_TEXT,
  LAYER_CUT_LINE,
  LAYER_SECTION_MARK,
  LAYER_SOLID,
  LAYER_BEAM,
  LAYER_BEAM_NOS,
  LAYER_COLUMN,
  LAYER_COLUMN_NOS,
];

// ---------------------------------------------------------------------------
// ACI palette — dark (blueprint) and light (AutoCAD white paper) sheet themes
// ---------------------------------------------------------------------------

const ACI_PALETTE: Record<number, { dark: string; light: string }> = {
  1: { dark: '#ff5f5f', light: '#c00000' },
  2: { dark: '#ffd24a', light: '#0f6fbf' },
  3: { dark: '#00e676', light: '#0b7a3b' },
  4: { dark: '#5ad0ff', light: '#a3006a' },
  5: { dark: '#7d9bff', light: '#0000c0' },
  6: { dark: '#e07ce0', light: '#8000a0' },
  7: { dark: '#e8eef6', light: '#111111' },
  8: { dark: '#9aa7b5', light: '#7a7a7a' },
  25: { dark: '#8b98a6', light: '#4a4a4a' },
  31: { dark: '#cfdae6', light: '#1a1a1a' },
  60: { dark: '#8ba0b5', light: '#555555' },
  141: { dark: '#b48bff', light: '#5b21b6' },
  225: { dark: '#63d7c6', light: '#00786b' },
  250: { dark: '#6b7684', light: '#888888' },
  251: { dark: '#7b8794', light: '#999999' },
};

/** Resolve a layer's on-screen stroke colour for the active sheet theme. */
export const layerStroke = (layer: SheetLayer, theme: 'dark' | 'light'): string =>
  (ACI_PALETTE[layer.aci] || ACI_PALETTE[7])[theme];

export const strokeForAci = (aci: number, theme: 'dark' | 'light'): string =>
  (ACI_PALETTE[aci] || ACI_PALETTE[7])[theme];

/** Multiply a model-unit length by a sheet scale to get drawing-unit coordinates. */
export const toScale = (mm: number, scale: number): number => mm * scale;

// ---------------------------------------------------------------------------
// Sheet builder
// ---------------------------------------------------------------------------

/**
 * Accumulates primitives and tracks used layers. All coordinates are in
 * drawing units (millimetres already multiplied by the detail scale).
 */
export class SheetBuilder {
  private prims: SheetPrimitive[] = [];
  private usedLayers = new Set<string>();
  private layerDefs: Map<string, SheetLayer>;

  constructor(layers: SheetLayer[]) {
    this.layerDefs = new Map(layers.map((l) => [l.name, l]));
  }

  private use(layer: string): string {
    this.usedLayers.add(layer);
    return layer;
  }

  public line(layer: string, x1: number, y1: number, x2: number, y2: number, width?: number) {
    this.prims.push({ t: 'line', layer: this.use(layer), x1, y1, x2, y2, width });
    return this;
  }

  public rect(layer: string, x: number, y: number, w: number, h: number, width?: number) {
    return this.poly(
      layer,
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      true,
      width
    );
  }

  public poly(layer: string, pts: [number, number][], closed = false, width?: number) {
    if (pts.length >= 2) this.prims.push({ t: 'poly', layer: this.use(layer), pts, closed, width });
    return this;
  }

  public circle(layer: string, cx: number, cy: number, r: number, filled = false) {
    this.prims.push({ t: 'circle', layer: this.use(layer), cx, cy, r, filled });
    return this;
  }

  public solid(layer: string, pts: [number, number][]) {
    this.prims.push({ t: 'solid', layer: this.use(layer), pts });
    return this;
  }

  public text(
    layer: string,
    x: number,
    y: number,
    text: string,
    h: number = TEXT_H.CALLOUT,
    opts: { anchor?: SheetAnchor; underline?: boolean; bold?: boolean } = {}
  ) {
    this.prims.push({
      t: 'text',
      layer: this.use(layer),
      x,
      y,
      text,
      h,
      anchor: opts.anchor,
      underline: opts.underline,
      bold: opts.bold,
    });
    return this;
  }

  /** Filled triangular arrowhead pointing from (x1,y1) towards (x2,y2). */
  public arrowHead(layer: string, x: number, y: number, angle: number, size: number) {
    const half = size * 0.34;
    const pts: [number, number][] = [
      [x, y],
      [x - size * Math.cos(angle) + half * Math.sin(angle), y - size * Math.sin(angle) - half * Math.cos(angle)],
      [x - size * Math.cos(angle) - half * Math.sin(angle), y - size * Math.sin(angle) + half * Math.cos(angle)],
    ];
    return this.solid(layer, pts);
  }

  /** Embed a raster image (data URI or URL) at the given position and size. */
  public image(layer: string, x: number, y: number, w: number, h: number, href: string) {
    this.prims.push({ t: 'image', layer: this.use(layer), x, y, w, h, href });
    return this;
  }

  /**
   * Horizontal dimension: extension ticks, a dimension line with arrowheads and
   * centred text — the same construction as the source SOLID arrowheads.
   */
  public dimHorizontal(
    x1: number,
    x2: number,
    y: number,
    text: string | number,
    opts: { textHeight?: number; ext?: number; layer?: string } = {}
  ) {
    const layer = opts.layer || LAYER_DIMENSION.name;
    const h = opts.textHeight ?? TEXT_H.DIM;
    const ext = opts.ext ?? Math.min(h * 1.35, 300);
    const arrow = Math.min(h * 0.85, 120);
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);

    this.line(layer, left, y - ext, left, y + ext * 0.6);
    this.line(layer, right, y - ext, right, y + ext * 0.6);
    this.line(layer, left, y, right, y);
    this.arrowHead(layer, left, y, Math.PI, arrow);
    this.arrowHead(layer, right, y, 0, arrow);
    this.text(layer, (left + right) / 2, y + ext * 0.75, String(text), h, { anchor: 'middle', bold: true });
    return this;
  }

  /** Vertical dimension with text placed beside the dim line (left or right side). */
  public dimVertical(
    y1: number,
    y2: number,
    x: number,
    text: string | number,
    opts: { textHeight?: number; ext?: number; layer?: string; side?: 'left' | 'right' } = {}
  ) {
    const layer = opts.layer || LAYER_DIMENSION.name;
    const h = opts.textHeight ?? TEXT_H.DIM;
    const ext = opts.ext ?? h * 1.35;
    const arrow = h * 0.85;
    const bottom = Math.min(y1, y2);
    const top = Math.max(y1, y2);
    const side = opts.side || 'right';

    if (side === 'left') {
      this.line(layer, x - ext * 0.6, bottom, x + ext, bottom);
      this.line(layer, x - ext * 0.6, top, x + ext, top);
    } else {
      this.line(layer, x - ext, bottom, x + ext * 0.6, bottom);
      this.line(layer, x - ext, top, x + ext * 0.6, top);
    }
    this.line(layer, x, bottom, x, top);
    this.arrowHead(layer, x, bottom, -Math.PI / 2, arrow);
    this.arrowHead(layer, x, top, Math.PI / 2, arrow);
    this.text(
      layer,
      side === 'left' ? x - ext * 0.9 : x + ext * 0.75,
      (bottom + top) / 2,
      String(text),
      h,
      { anchor: side === 'left' ? 'end' : 'start', bold: true }
    );
    return this;
  }

  /** Dimension allowing an arbitrary (usually 45 degree) direction, e.g. bar cut-offs. */
  public dimAligned(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    text: string | number,
    opts: { textHeight?: number; layer?: string; offset?: number } = {}
  ) {
    const layer = opts.layer || LAYER_DIMENSION.name;
    const h = opts.textHeight ?? TEXT_H.CALLOUT;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const off = opts.offset ?? h * 1.6;

    const ax = x1 + nx * off;
    const ay = y1 + ny * off;
    const bx = x2 + nx * off;
    const by = y2 + ny * off;

    this.line(layer, x1, y1, ax, ay);
    this.line(layer, x2, y2, bx, by);
    this.line(layer, ax, ay, bx, by);
    this.arrowHead(layer, ax, ay, Math.atan2(-ny, -nx), h * 0.9);
    this.arrowHead(layer, bx, by, Math.atan2(ny, nx), h * 0.9);
    this.text(layer, (ax + bx) / 2 + nx * h * 0.9, (ay + by) / 2 + ny * h * 0.9, String(text), h, {
      anchor: 'middle',
    });
    return this;
  }

  /** Leader line with a filled arrowhead at the target end (DXF LEADER equivalent). */
  public leader(
    layer: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts: { h?: number; textHeight?: number } = {}
  ) {
    const h = opts.h ?? opts.textHeight ?? TEXT_H.CALLOUT;
    this.line(layer, x1, y1, x2, y2);
    this.arrowHead(layer, x2, y2, Math.atan2(y2 - y1, x2 - x1), h * 0.8);
    return this;
  }

  public get primitives(): SheetPrimitive[] {
    return this.prims;
  }

  public build(meta: Omit<DrawingSheet, 'layers' | 'primitives' | 'bounds'>): DrawingSheet {
    const layers = Array.from(this.usedLayers)
      .map((name) => this.layerDefs.get(name))
      .filter((l): l is SheetLayer => !!l);

    return {
      ...meta,
      layers,
      primitives: this.prims,
      bounds: computeBounds(this.prims),
    };
  }
}

/** Bounding box of a primitive list, including an approximation of text extents. */
export function computeBounds(prims: SheetPrimitive[]): SheetBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const bump = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  prims.forEach((p) => {
    switch (p.t) {
      case 'line':
        bump(p.x1, p.y1);
        bump(p.x2, p.y2);
        break;
      case 'poly':
        p.pts.forEach(([x, y]) => bump(x, y));
        break;
      case 'circle':
        bump(p.cx - p.r, p.cy - p.r);
        bump(p.cx + p.r, p.cy + p.r);
        break;
      case 'solid':
        p.pts.forEach(([x, y]) => bump(x, y));
        break;
      case 'text': {
        // Monospace-ish estimate: 0.62 * height per glyph.
        const w = p.text.length * p.h * 0.62;
        const left = p.anchor === 'middle' ? p.x - w / 2 : p.anchor === 'end' ? p.x - w : p.x;
        bump(left, p.y - p.h * 0.3);
        bump(left + w, p.y + p.h);
        break;
      }
    }
  });

  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// Standard ISO A3 CAD Sheet Constants & Detailing Helpers (420 x 297 mm @ 1:100)
// ---------------------------------------------------------------------------

export const A3_WIDTH = 42000;
export const A3_HEIGHT = 29700;
export const A3_MARGIN = 1000;
export const A3_INNER_W = A3_WIDTH - 2 * A3_MARGIN; // 40000
export const A3_INNER_H = A3_HEIGHT - 2 * A3_MARGIN; // 27700
export const A3_TITLE_BLOCK_H = 3500;

export interface A3TitleBlockOptions {
  title: string;
  sheetNumber: string;
  levelName?: string;
  project?: any;
  client?: string;
  address?: string;
  dagNo?: string;
  pattaNo?: string;
  wardNo?: string;
  scale?: string;
  drawnBy?: string;
  checkedBy?: string;
  jobDwgNo?: string;
  pageInfo?: string;
}

/**
 * Draws an authentic ISO A3 CAD drawing border, graphic reduction scale bar,
 * and multi-compartment engineering title block matching the user's reference drawings.
 */
export function drawA3BorderAndTitleBlock(b: SheetBuilder, opts: A3TitleBlockOptions) {
  const layerBorder = LAYER_SCHEDULE_BORDER.name;
  const layerLine = LAYER_SCHEDULE_LINE.name;
  const layerText = LAYER_TEXT.name;
  const layerHeader = LAYER_SCHEDULE_HEADER.name;
  const layerLabels = LAYER_LABELS.name;

  // Extract from user project metadata if provided
  const meta = opts.project?.metadata;
  const clientName = opts.client || meta?.client || 'CLIENT NAME';
  const clientAddr = opts.address || meta?.clientAddress || meta?.location || 'SITE ADDRESS / LOCATION';
  const dag = opts.dagNo || meta?.dagNo || '---';
  const patta = opts.pattaNo || meta?.pattaNo || '---';
  const ward = opts.wardNo || meta?.wardNo || '---';
  const drawn = opts.drawnBy || meta?.drawnBy || meta?.engineer || 'ENGINEER';
  const checked = opts.checkedBy || meta?.checkedBy || '';
  const jobDwg = opts.jobDwgNo || meta?.jobDwgNo || '1';

  // 1. Outer Paper Extents Border (420 x 297 mm paper boundary)
  b.rect(layerBorder, 0, 0, A3_WIDTH, A3_HEIGHT, 1.0);

  // 2. Inner Margin Border (10mm in from edge)
  const x0 = A3_MARGIN;
  const y0 = A3_MARGIN;
  const w = A3_INNER_W;
  const h = A3_INNER_H;
  b.rect(layerBorder, x0, y0, w, h, 3.5);

  // 3. Title Block across bottom of inner border (Y from y0 to y0 + A3_TITLE_BLOCK_H)
  const tbY0 = y0;
  const tbH = A3_TITLE_BLOCK_H;
  const tbY1 = tbY0 + tbH;

  b.line(layerBorder, x0, tbY1, x0 + w, tbY1, 2.5);

  // Compartment widths:
  // [Client & Scale Bar: 10500] | [Dag/Patta/Ward: 7500] | [Revision Table: 8000] | [Sheet Title & Specs: 14000]
  const col1W = 10500;
  const col2W = 7500;
  const col3W = 8000;
  const col4W = w - col1W - col2W - col3W; // 14000

  const col1X = x0;
  const col2X = col1X + col1W;
  const col3X = col2X + col2W;
  const col4X = col3X + col3W;

  // Vertical dividers
  b.line(layerBorder, col2X, tbY0, col2X, tbY1, 2.0);
  b.line(layerBorder, col3X, tbY0, col3X, tbY1, 2.0);
  b.line(layerBorder, col4X, tbY0, col4X, tbY1, 2.0);

  // --- COL 1: Client & Print Reduction Bar ---
  b.text(layerHeader, col1X + 300, tbY1 - 450, 'CLIENT:', 180, { bold: true });
  b.text(layerText, col1X + 1300, tbY1 - 450, clientName, 170, { bold: true });

  const addrLines = clientAddr.split('\n');
  addrLines.forEach((line: string, idx: number) => {
    b.text(layerText, col1X + 1300, tbY1 - 750 - idx * 280, line, 150);
  });

  // Scale bar at bottom of Col 1
  const sbY = tbY0 + 700;
  b.text(layerText, col1X + 300, sbY + 550, 'PRINT REDUCTION BAR | A3 SHEET', 140, { bold: true });
  b.line(layerLine, col1X + 300, sbY, col1X + 6300, sbY, 1.2);
  const tickSteps = [0, 10, 20, 30, 40, 50];
  tickSteps.forEach((val, i) => {
    const tx = col1X + 300 + i * 1200;
    b.line(layerLine, tx, sbY - 120, tx, sbY + 120, 1.0);
    b.text(layerText, tx, sbY + 240, String(val), 130, { anchor: 'middle' });
  });
  b.text(layerText, col1X + 6500, sbY + 10, '50mm', 140);
  b.text(layerText, col1X + 300, tbY0 + 200, 'ALL RIGHTS RESERVED. NO REPRODUCTION UNLESS WRITTEN CONSENT GIVEN', 105);

  // --- COL 2: DAG / PATTA / WARD / CHECKED_BY ---
  b.text(layerHeader, col2X + 400, tbY1 - 600, `DAG NO- ${dag}`, 240, { bold: true });
  b.text(layerHeader, col2X + 400, tbY1 - 1200, `PATTA NO: ${patta}`, 240, { bold: true });
  b.text(layerHeader, col2X + 400, tbY1 - 1800, `WARD NO-${ward}`, 240, { bold: true });

  b.line(layerLine, col2X, tbY0 + 1000, col3X, tbY0 + 1000, 1.0);
  b.text(layerText, col2X + 400, tbY0 + 400, `CHECKED_BY: ${checked}`, 200, { bold: true });

  // --- COL 3: Revision Table ---
  b.line(layerLine, col3X, tbY1 - 650, col4X, tbY1 - 650, 1.2);
  const revColW1 = 1500;
  const revColW2 = 4500;
  b.line(layerLine, col3X + revColW1, tbY0, col3X + revColW1, tbY1, 1.0);
  b.line(layerLine, col3X + revColW1 + revColW2, tbY0, col3X + revColW1 + revColW2, tbY1, 1.0);

  b.text(layerHeader, col3X + revColW1 / 2, tbY1 - 420, 'REV.', 140, { anchor: 'middle', bold: true });
  b.text(layerHeader, col3X + revColW1 + revColW2 / 2, tbY1 - 420, 'AMENDMENT DESCRIPTION', 140, { anchor: 'middle', bold: true });
  b.text(layerHeader, col4X - 1000, tbY1 - 420, 'DATE', 140, { anchor: 'middle', bold: true });

  // 4 revision rows
  for (let r = 1; r <= 4; r++) {
    const ry = tbY1 - 650 - r * 650;
    b.line(layerLine, col3X, ry, col4X, ry, 0.8);
  }

  // --- COL 4: Large Sheet Title & Drawing Metadata ---
  b.line(layerLine, col4X, tbY1 - 1800, x0 + w, tbY1 - 1800, 1.5);
  b.text(layerHeader, col4X + 500, tbY1 - 450, 'STRUCTURE AI DESIGNER — AUTONOMOUS CAD SUITE', 150, { bold: true });
  const fullTitle = opts.pageInfo ? `${opts.title} (${opts.pageInfo})` : opts.title;
  const titleH = Math.min(300, Math.max(160, Math.floor(12500 / (fullTitle.length * 0.65))));
  b.text(layerLabels, col4X + 500, tbY1 - 1100, fullTitle, titleH, { bold: true });

  const subRowY = tbY0 + 1000;
  b.line(layerLine, col4X, subRowY, x0 + w, subRowY, 1.0);

  // Sub-compartments in bottom half of Col 4
  const col4Sub1 = col4X + 3500;
  const col4Sub2 = col4X + 8000;
  b.line(layerLine, col4Sub1, tbY0, col4Sub1, subRowY, 1.0);
  b.line(layerLine, col4Sub2, tbY0, col4Sub2, tbY1 - 1800, 1.0);

  // Top half sub: DRAWN / SCALE / JOB NO
  b.text(layerText, col4X + 300, tbY1 - 2200, 'SCALE', 160);
  b.text(layerHeader, col4X + 1600, tbY1 - 2200, opts.scale || 'N.T.S', 200, { bold: true });

  b.text(layerText, col4Sub1 + 300, tbY1 - 2200, 'JOB-DRAWING No.', 150);
  b.text(layerHeader, col4Sub1 + 600, tbY1 - 2550, jobDwg, 240, { bold: true });

  b.text(layerText, col4Sub2 + 300, tbY1 - 2200, 'DWG NO:', 150);
  b.text(layerHeader, col4Sub2 + 300, tbY1 - 2550, `DWG NO: ${opts.sheetNumber}`, 240, { bold: true });

  b.text(layerText, col4X + 300, tbY0 + 400, 'DRAWN', 160);
  b.text(layerHeader, col4X + 1600, tbY0 + 400, drawn, 190, { bold: true });
  b.text(layerText, col4Sub2 + 300, tbY0 + 400, 'STATUS: APPROVED', 160, { bold: true });
}

/**
 * Draws the standard Top-Right General Notes block matching reference image media_1789398691291.png.
 */
export function drawA3GeneralNotes(b: SheetBuilder, customNotes?: string[]) {
  const layerBorder = LAYER_SCHEDULE_BORDER.name;
  const layerText = LAYER_TEXT.name;
  const layerHeader = LAYER_SCHEDULE_HEADER.name;

  const notesW = 7500;
  const notesH = 6800;
  const nx = A3_WIDTH - A3_MARGIN - notesW; // 41000 - 7500 = 33500
  const ny = A3_HEIGHT - A3_MARGIN - notesH; // 28700 - 6800 = 21900

  b.rect(layerBorder, nx, ny, notesW, notesH, 1.2);

  b.text(layerHeader, nx + 300, ny + notesH - 500, 'NOTE-', 220, { bold: true });

  const notes = customNotes || [
    '1. THIS DRAWING IS TO BE READ IN CONJUNCTION',
    '   WITH THE ARCHITECTURAL DRAWING.',
    '2. FIGURED DIMENSIONS SHOULD BE FOLLOWED.',
    '3. ALL DIMENSION ARE IN MM (MILLIMETERS),',
    '   UNLESS SPECIFIED.',
  ];

  notes.forEach((line, idx) => {
    b.text(layerText, nx + 300, ny + notesH - 1100 - idx * 450, line, 175);
  });
}
