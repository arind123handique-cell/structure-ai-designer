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
    };

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
  /** Beam / column marks in plans, dimension text. */
  MARK: 200,
  /** Rebar callouts, scale notes, bar-length dims. */
  CALLOUT: 225,
  /** Grid references, support labels. */
  GRID: 250,
  /** Grid bubbles in plans. */
  GRID_BUBBLE: 300,
  /** Beam size labels (B1:230x450) and title notes. */
  LABEL: 325,
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
];

/** Layers used by the slab detailing sheet. */
export const SLAB_SHEET_LAYERS: SheetLayer[] = [
  LAYER_CONCRETE,
  LAYER_REBAR,
  LAYER_GRID,
  LAYER_LABELS,
  LAYER_TEXT,
  LAYER_DIMENSION,
  LAYER_SCHEDULE_BORDER,
  LAYER_SCHEDULE_HEADER,
  LAYER_SCHEDULE_LINE,
  LAYER_SECTION_MARK,
  LAYER_SOLID,
];

// ---------------------------------------------------------------------------
// ACI palette — dark (blueprint) and light (AutoCAD white paper) sheet themes
// ---------------------------------------------------------------------------

const ACI_PALETTE: Record<number, { dark: string; light: string }> = {
  1: { dark: '#ff5f5f', light: '#c00000' },
  2: { dark: '#ffd24a', light: '#0f6fbf' },
  3: { dark: '#6ede8a', light: '#0b7a3b' },
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
    const h = opts.textHeight ?? TEXT_H.CALLOUT;
    const ext = opts.ext ?? h * 1.4;
    const arrow = h * 0.9;
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);

    this.line(layer, left, y - ext, left, y + ext * 0.6);
    this.line(layer, right, y - ext, right, y + ext * 0.6);
    this.line(layer, left, y, right, y);
    this.arrowHead(layer, left, y, Math.PI, arrow);
    this.arrowHead(layer, right, y, 0, arrow);
    this.text(layer, (left + right) / 2, y + ext * 0.9, String(text), h, { anchor: 'middle' });
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
    const h = opts.textHeight ?? TEXT_H.CALLOUT;
    const ext = opts.ext ?? h * 1.4;
    const arrow = h * 0.9;
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
      { anchor: side === 'left' ? 'end' : 'start' }
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
