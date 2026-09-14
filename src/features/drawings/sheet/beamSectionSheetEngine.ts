/**
 * Beam reinforcement longitudinal elevation sheet engine.
 *
 * Generates authentic, full longitudinal cross-section elevations for all beams
 * on each floor level, reproducing AutoCAD structural detailing standards (IS 456 / IS 13920 / SP:34)
 * matching the user's reference drawing:
 *
 *   - Scaled longitudinal elevation per beam laid out in rows packed left to right;
 *   - Double wireframe lines for top and soffit of concrete (fill="none", crisp CAD line weights);
 *   - End column supports extending above and below beam with zigzag breaklines and centerlines;
 *   - Supporting beam supports with cross-section outlines;
 *   - Centerline dash-dot lines with top grid reference (e.g. 'A 400', 'B 400') and bottom support labels (e.g. 'C1', 'C5', 'B37');
 *   - Top continuous through rebar (e.g. `2-T 16`) anchored with 90° downward hook into end supports;
 *   - Top extra support rebar over supports extending 0.25L - 0.3L into span with dimension callouts;
 *   - Bottom continuous through rebar (e.g. `2-T 16`) anchored with 90° upward hook into end supports;
 *   - Bottom extra midspan rebar curtailed at ~0.15L from supports with bottom dimension callouts;
 *   - 3-zone shear confinement stirrups (support - midspan - support) with vertical stirrup lines and callouts below;
 *   - Clear span dimensions and support column width dimensions;
 *   - Beam title and scale note below: `B1:230x450` and `(SCALE: H - 1:50 / V - 1:50)`.
 */

import { BeamDesignEngine } from '@/features/design/beam/beamDesignEngine';
import { FloorPlanLevel, FloorBeamInfo } from '../floorPlanEngine';
import {
  BEAM_SECTION_SHEET_LAYERS,
  BEAM_COVER,
  DrawingSheet,
  LAYER_CONCRETE,
  LAYER_GRID,
  LAYER_LABELS,
  LAYER_LABELS_SUPPORT,
  LAYER_LINK,
  LAYER_REBAR,
  LAYER_SCHEDULE_BORDER,
  LAYER_SCHEDULE_LINE,
  LAYER_SCHEDULE_TEXT,
  LAYER_TEXT,
  LAYER_TEXT_SCALE,
  LAYER_DIMENSION,
  LAYER_BEAM,
  SECTION_SCALE,
  STRIP_SCALE,
  SheetBuilder,
  TEXT_H,
  A3_WIDTH,
  A3_HEIGHT,
  A3_MARGIN,
  drawA3BorderAndTitleBlock,
  drawA3GeneralNotes,
} from './drawingSheet';

// ---------------------------------------------------------------------------
// Layout constants — measured from the source drawing
// ---------------------------------------------------------------------------

/** Vertical pitch between detail rows (measured from the source sheet). */
export const ROW_PITCH = 25200;
/** Widest zone strip drawn under a detail, in model units. */
export const MAX_STRIP_WIDTH = 8250;
/** Room either side of the strip for grid bubbles, support marks and dimensions. */
export const CELL_MARGIN = 4400;
export const MIN_CELL_WIDTH = 6200;
/** Aspect ratio (width / height) the finished sheet aims for. */
export const TARGET_ASPECT = 1.4;

/** Zone strip width for a beam, drawn at 1:50 and capped to the sheet width. */
export const stripWidthFor = (spanM: number): number =>
  Math.min(Math.abs(spanM || 0) * 1000 * STRIP_SCALE, MAX_STRIP_WIDTH);

/** Cell width needed by a detail: its strip plus margins. */
export const cellWidthFor = (spanM: number): number =>
  Math.max(MIN_CELL_WIDTH, stripWidthFor(spanM) + CELL_MARGIN);

/**
 * Chooses how many details go across a row so the finished sheet is close to a
 * landscape A-series proportion.
 */
export const detailsPerRow = (cellWidths: number[], target = TARGET_ASPECT): number => {
  const n = cellWidths.length;
  if (n === 0) return 1;
  const avg = cellWidths.reduce((s, w) => s + w, 0) / n;
  let best = 1;
  let bestErr = Infinity;
  const maxCols = Math.min(n, 16);
  for (let c = 1; c <= maxCols; c++) {
    const width = avg * c;
    const height = Math.ceil(n / c) * ROW_PITCH;
    const err = Math.abs(width / height - target);
    if (err < bestErr) {
      bestErr = err;
      best = c;
    }
  }
  return best;
};

export interface RebarLine {
  count: number;
  dia: number;
  callout: string;
}

export interface BeamZone {
  startMm: number;
  endMm: number;
  label: string;
  spacing: number;
  stirrupCount: number;
  stirrupDia: number;
}

export interface BeamCurtailmentData {
  topCutoffLeftMm?: number;
  topCutoffRightMm?: number;
  botStartOffsetMm?: number;
  botLengthMm?: number;
}

export interface BeamSectionDesign {
  memberId: number;
  mark: string;
  b: number;
  D: number;
  spanM: number;
  top: { through: RebarLine; extra?: RebarLine };
  bottom: { through: RebarLine; extra?: RebarLine };
  curtailmentDetails?: BeamCurtailmentData;
  sideFace?: RebarLine;
  stirrups: { dia: number; legs: number; spacingSupport: number; spacingMid: number };
  zones: BeamZone[];
  ductile: boolean;
  source: 'SAVED' | 'LIVE';
}

export interface BeamSectionSheetInput {
  level: FloorPlanLevel;
  /** StoredProject — provides savedBeamDesigns, universalRebarSelection and design settings. */
  project?: any;
  fck: number;
  fy: number;
}

export interface BeamSupportDetail {
  type: 'COLUMN' | 'BEAM' | 'CANTILEVER';
  label: string;
  widthMm: number;
  depthMm: number;
  gridLabel: string;
}

export interface ContinuousSpanItem {
  design: BeamSectionDesign;
  beam: FloorBeamInfo;
  spanMm: number;
  clearSpanMm: number;
  wLeftMm: number;
  wRightMm: number;
  supLeft: BeamSupportDetail;
  supRight: BeamSupportDetail;
}

export interface ContinuousBeamRun {
  runId: string;
  axis: 'X' | 'Z';
  spans: ContinuousSpanItem[];
  totalSpanMm: number;
  totalWidthDrawing: number;
}

/** Round down to the nearest 25 mm, as used for practical stirrup spacings. */
const round25 = (mm: number) => Math.max(50, Math.floor(mm / 25) * 25);

export class BeamSectionSheetEngine {
  /**
   * Derives the reinforcement design for every beam at a floor level.
   * Prefers the user's saved design, falling back to a live IS 456 / IS 13920
   * design using the same demand estimates as BbsEngine so the sheets and the
   * bar bending schedule always agree.
   */
  public static extractLevelBeams(input: BeamSectionSheetInput): BeamSectionDesign[] {
    const { level, project, fck, fy } = input;
    if (!level || level.isFoundationLevel) return [];

    const savedBeamDesigns: Record<number, any> = project?.savedBeamDesigns || {};
    const allowedLong: number[] =
      project?.universalRebarSelection?.longitudinalDiameters ||
      project?.allowedColumnRebarDiameters ||
      [12, 16, 20, 25];
    const allowedTies: number[] =
      project?.universalRebarSelection?.shearTieDiameters || [8, 10];

    const pick = (preferred: number[], allowed: number[], fallback: number) => {
      for (const p of preferred) if (allowed.includes(p)) return p;
      return allowed[0] || fallback;
    };

    const designs: BeamSectionDesign[] = [];

    level.beams.forEach((beam, idx) => {
      const resulting = this.designBeam(beam, {
        savedBeamDesigns,
        allowedLong,
        allowedTies,
        pick,
        fck,
        fy,
        markIndex: idx,
      });
      if (resulting) designs.push(resulting);
    });

    // B1 lowest mark first: stacks B1 at the top.
    return designs.sort((a, b) => this.markOrder(a.mark) - this.markOrder(b.mark));
  }

  private static markOrder(mark: string): number {
    const m = /(\d+)/.exec(mark || '');
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  }

  private static designBeam(
    beam: FloorBeamInfo,
    ctx: {
      savedBeamDesigns: Record<number, any>;
      allowedLong: number[];
      allowedTies: number[];
      pick: (preferred: number[], allowed: number[], fallback: number) => number;
      fck: number;
      fy: number;
      markIndex: number;
    }
  ): BeamSectionDesign | null {
    const b = Math.round((beam.width || 0.3) * 1000);
    const D = Math.round((beam.depth || 0.45) * 1000);
    const spanM = beam.length || 4.5;
    if (!b || !D) return null;

    const mark = beam.label || `B${beam.memberId}`;
    const savedBm = ctx.savedBeamDesigns[beam.memberId];

    let topThrough: RebarLine;
    let topExtra: RebarLine | undefined;
    let botThrough: RebarLine;
    let botExtra: RebarLine | undefined;
    let topCutoffLeftMm: number | undefined;
    let topCutoffRightMm: number | undefined;
    let botStartOffsetMm: number | undefined;
    let botLengthMm: number | undefined;
    let sideFace: RebarLine | undefined;
    let stirrupDia: number;
    let stirrupCount: number;
    let spacingSupport: number;
    let spacingMid: number;
    let source: 'SAVED' | 'LIVE';
    let zoneCtx: { ductility?: any; curtailment?: any; effectiveDepth?: number };

    if (savedBm) {
      const cur = savedBm.curtailment || {};
      topThrough = this.toRebarLine(cur.throughTop, savedBm.topCount, savedBm.topDia, 12);
      botThrough = this.toRebarLine(cur.throughBottom, savedBm.botCount, savedBm.botDia, 16);
      topExtra = cur.extraTopSupport?.hasExtra
        ? this.toRebarLine(cur.extraTopSupport, undefined, undefined, 16)
        : undefined;
      botExtra = cur.extraBottomMidspan?.hasExtra
        ? this.toRebarLine(cur.extraBottomMidspan, undefined, undefined, 16)
        : undefined;

      if (cur.extraTopSupport?.cutoffLength) {
        topCutoffLeftMm = Math.round(cur.extraTopSupport.cutoffLength * 1000);
        topCutoffRightMm = topCutoffLeftMm;
      }
      if (cur.extraBottomMidspan?.startOffset) {
        botStartOffsetMm = Math.round(cur.extraBottomMidspan.startOffset * 1000);
      }
      if (cur.extraBottomMidspan?.length) {
        botLengthMm = Math.round(cur.extraBottomMidspan.length * 1000);
      }

      sideFace = cur.sideFaceBars?.diameter
        ? {
            count: Math.max(1, Math.round((cur.sideFaceBars.countTotal || 2) / 2)),
            dia: cur.sideFaceBars.diameter,
            callout: `SFR ${Math.max(1, Math.round((cur.sideFaceBars.countTotal || 2) / 2))}-T${cur.sideFaceBars.diameter}EF`,
          }
        : undefined;

      stirrupDia = savedBm.shear?.stirrupDiameter || savedBm.shear?.stirrupDia || savedBm.stirrupDia || 8;
      stirrupCount = savedBm.shear?.legs || 2;
      const spacingProv = savedBm.shear?.spacing_prov || savedBm.stirrupSpacing || 125;
      const duct = savedBm.ductility || {};
      spacingSupport = Math.round(
        Math.min(spacingProv, duct.confinementHoopSpacingMax || spacingProv)
      );
      spacingMid = Math.round(Math.min(spacingProv, duct.midSpanHoopSpacingMax || spacingProv));
      zoneCtx = { ductility: duct, curtailment: savedBm.curtailment, effectiveDepth: savedBm.effectiveDepth };
      source = 'SAVED';
    } else {
      const MuHog = Math.round(0.08 * 25 * spanM * spanM);
      const MuSag = Math.round(0.06 * 25 * spanM * spanM);
      const Vu = Math.round(0.5 * 25 * spanM);

      const design = BeamDesignEngine.design({
        memberId: beam.memberId,
        b,
        D,
        spanLength: spanM,
        fck: ctx.fck,
        fy: ctx.fy,
        Mu_top: MuHog,
        Mu_bottom: MuSag,
        Vu,
        cover: BEAM_COVER,
        allowedDiameters: ctx.allowedLong,
      });

      const cur = design.curtailment;
      topThrough = this.toRebarLine(cur.throughTop, undefined, undefined, 12);
      botThrough = this.toRebarLine(cur.throughBottom, undefined, undefined, 16);
      topExtra = cur.extraTopSupport?.hasExtra
        ? this.toRebarLine(cur.extraTopSupport, undefined, undefined, 16)
        : undefined;
      botExtra = cur.extraBottomMidspan?.hasExtra
        ? this.toRebarLine(cur.extraBottomMidspan, undefined, undefined, 16)
        : undefined;

      if (cur.extraTopSupport?.cutoffLength) {
        topCutoffLeftMm = Math.round(cur.extraTopSupport.cutoffLength * 1000);
        topCutoffRightMm = topCutoffLeftMm;
      }
      if (cur.extraBottomMidspan?.startOffset) {
        botStartOffsetMm = Math.round(cur.extraBottomMidspan.startOffset * 1000);
      }
      if (cur.extraBottomMidspan?.length) {
        botLengthMm = Math.round(cur.extraBottomMidspan.length * 1000);
      }

      sideFace = cur.sideFaceBars?.diameter
        ? {
            count: Math.max(1, Math.round((cur.sideFaceBars.countTotal || 2) / 2)),
            dia: cur.sideFaceBars.diameter,
            callout: `SFR ${Math.max(1, Math.round((cur.sideFaceBars.countTotal || 2) / 2))}-T${cur.sideFaceBars.diameter}EF`,
          }
        : undefined;

      stirrupDia = ctx.pick([8, 10], ctx.allowedTies, 8);
      stirrupCount = 2;
      const spacingProv = design.shear.spacing_prov || 125;
      spacingSupport = round25(
        Math.min(spacingProv, design.ductility.confinementHoopSpacingMax || spacingProv)
      );
      spacingMid = round25(
        Math.min(spacingProv, design.ductility.midSpanHoopSpacingMax || spacingProv)
      );
      zoneCtx = {
        ductility: design.ductility,
        curtailment: design.curtailment,
        effectiveDepth: design.effectiveDepth,
      };
      source = 'LIVE';
    }

    // Enforce the universal rebar inventory on saved designs too.
    const fix = (line: RebarLine | undefined, fallbackDia: number) => {
      if (!line) return undefined;
      const dia = ctx.allowedLong.includes(line.dia)
        ? line.dia
        : ctx.pick([line.dia, 16, 12, 20], ctx.allowedLong, fallbackDia);
      return { ...line, dia, callout: `${line.count}-T${dia}` };
    };

    const zones = this.computeZones(spanM, mark, spacingSupport, spacingMid, stirrupDia, zoneCtx);

    return {
      memberId: beam.memberId,
      mark,
      b,
      D,
      spanM,
      top: { through: fix(topThrough, 12)!, extra: fix(topExtra, 16) },
      bottom: { through: fix(botThrough, 16)!, extra: fix(botExtra, 16) },
      curtailmentDetails: {
        topCutoffLeftMm,
        topCutoffRightMm,
        botStartOffsetMm,
        botLengthMm,
      },
      sideFace,
      stirrups: { dia: stirrupDia, legs: stirrupCount, spacingSupport, spacingMid },
      zones,
      ductile: spacingSupport < spacingMid,
      source,
    };
  }

  private static toRebarLine(src: any, countFallback?: number, diaFallback?: number, diaDefault = 16): RebarLine {
    const rawDia = src?.diameter || diaFallback || diaDefault;
    if (src?.callout && /-T\d+/.test(src.callout) && !countFallback) {
      const m = /(\d+)\s*-\s*T(\d+)/.exec(src.callout);
      if (m) {
        return { count: parseInt(m[1], 10), dia: parseInt(m[2], 10), callout: `${parseInt(m[1], 10)}-T${parseInt(m[2], 10)}` };
      }
    }
    const count = src?.count || countFallback || 2;
    const dia = rawDia;
    return { count, dia, callout: `${count}-T${dia}` };
  }

  /**
   * Builds the reinforcement zones along the span. When ductile detailing
   * requires closer hoops than the shear design, the beam gets the three-zone
   * support / mid-span / support split; otherwise it is a single uniform zone.
   */
  private static computeZones(
    spanM: number,
    mark: string,
    spacingSupport: number,
    spacingMid: number,
    stirrupDia: number,
    ctx: { ductility?: any; curtailment?: any; effectiveDepth?: number }
  ): BeamZone[] {
    const L = Math.round(spanM * 1000);
    let supZone = 0;

    // IS 13920 Cl. 6.3.5 — 2d confinement zone at each support.
    if (ctx.ductility?.confinementZoneLength) {
      supZone = Math.round(ctx.ductility.confinementZoneLength);
    } else if (spacingSupport < spacingMid) {
      supZone = Math.round(ctx.effectiveDepth ? 2 * ctx.effectiveDepth : L * 0.18);
    }
    const cutoffMm = ctx.curtailment?.extraTopSupport?.cutoffLength
      ? Math.round(ctx.curtailment.extraTopSupport.cutoffLength * 1000)
      : 0;
    supZone = Math.max(supZone, cutoffMm);

    const makeZone = (start: number, end: number, spacing: number): BeamZone => ({
      startMm: start,
      endMm: end,
      label: `${mark} (LOC: ${start} TO ${end})`,
      spacing,
      stirrupCount: Math.ceil((end - start) / spacing) + 1,
      stirrupDia,
    });

    if (supZone <= 0 || supZone * 2 >= L) {
      return [makeZone(0, L, Math.min(spacingSupport, spacingMid))];
    }

    return [
      makeZone(0, supZone, spacingSupport),
      makeZone(supZone, L - supZone, spacingMid),
      makeZone(L - supZone, L, spacingSupport),
    ];
  }

  // -------------------------------------------------------------------------
  // Sheet construction
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Beam Layout Plan (Plan View) — First Page per Floor
  // -------------------------------------------------------------------------

  /**
   * Draws a beam layout plan (top-down view) showing all beams as double-line
   * rectangles with labels and column positions. This is the first page per floor.
   */
  private static drawBeamLayoutPlan(
    b: SheetBuilder,
    level: FloorPlanLevel,
    beamLabels: Map<number, string>
  ): void {
    const beams = level.beams || [];
    const columns = level.columns || [];
    if (beams.length === 0) return;

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    beams.forEach((bm) => {
      minX = Math.min(minX, bm.startX, bm.endX);
      maxX = Math.max(maxX, bm.startX, bm.endX);
      minZ = Math.min(minZ, bm.startZ, bm.endZ);
      maxZ = Math.max(maxZ, bm.startZ, bm.endZ);
    });
    columns.forEach((c) => {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minZ = Math.min(minZ, c.z);
      maxZ = Math.max(maxZ, c.z);
    });

    const modelSpanX = Math.max(0.1, maxX - minX);
    const modelSpanZ = Math.max(0.1, maxZ - minZ);
    const modelMidX = (minX + maxX) / 2;
    const modelMidZ = (minZ + maxZ) / 2;

    // Drawing area: inside A3 border with margins
    const drawX0 = A3_MARGIN + 2000;
    const drawY0 = A3_MARGIN + 2000;
    const drawW = A3_WIDTH - 2 * A3_MARGIN - 4000;
    const drawH = A3_HEIGHT - 2 * A3_MARGIN - 6000; // leave room for title block

    // Scale to fit
    const scaleX = drawW / (modelSpanX * 1000);
    const scaleZ = drawH / (modelSpanZ * 1000);
    const S = Math.min(scaleX, scaleZ, 1.0);

    const toX = (x: number) => drawX0 + drawW / 2 + (x - modelMidX) * 1000 * S;
    const toY = (z: number) => drawY0 + drawH / 2 - (z - modelMidZ) * 1000 * S;

    // Draw columns as filled rectangles
    columns.forEach((col) => {
      const cx = toX(col.x);
      const cy = toY(col.z);
      const w = (col.width || 0.4) * 1000 * S;
      const d = (col.depth || col.width || 0.4) * 1000 * S;
      b.rect(LAYER_CONCRETE.name, cx - w / 2, cy - d / 2, w, d, 1.0);
    });

    // Draw beams as double-line rectangles
    beams.forEach((bm) => {
      const x1 = toX(bm.startX);
      const y1 = toY(bm.startZ);
      const x2 = toX(bm.endX);
      const y2 = toY(bm.endZ);

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 1) return;

      const nx = -dy / len;
      const ny = dx / len;
      const hw = Math.max(3, ((bm.width || 0.23) / 2) * 1000 * S);

      // Draw beam polygon
      b.poly(LAYER_BEAM.name, [
        [x1 + nx * hw, y1 + ny * hw],
        [x2 + nx * hw, y2 + ny * hw],
        [x2 - nx * hw, y2 - ny * hw],
        [x1 - nx * hw, y1 - ny * hw],
      ], true);

      // Beam label at midpoint
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const label = beamLabels.get(bm.memberId) || bm.label || `B${bm.memberId}`;
      const sectionText = `${bm.width ? Math.round(bm.width * 1000) : 230}x${bm.depth ? Math.round(bm.depth * 1000) : 450}`;
      const fullLabel = `${label} (${sectionText})`;
      b.text(LAYER_LABELS.name, midX, midY, fullLabel, TEXT_H.CALLOUT - 40, { anchor: 'middle', bold: true });
    });

    // Grid lines
    const gridLinesX = level.gridLinesX || [];
    gridLinesX.forEach((g) => {
      const gx = toX(g.coord);
      b.line(LAYER_GRID.name, gx, drawY0, gx, drawY0 + drawH);
      b.text(LAYER_GRID.name, gx, drawY0 - 300, (g.label || g.id || '').replace(/^GRID\s*/i, ''), TEXT_H.MARK, { anchor: 'middle', bold: true });
    });
    const gridLinesZ = level.gridLinesZ || [];
    gridLinesZ.forEach((g) => {
      const gy = toY(g.coord);
      b.line(LAYER_GRID.name, drawX0, gy, drawX0 + drawW, gy);
      b.text(LAYER_GRID.name, drawX0 - 300, gy, (g.label || g.id || '').replace(/^GRID\s*/i, ''), TEXT_H.MARK, { anchor: 'end', bold: true });
    });
  }

  // -------------------------------------------------------------------------
  // Intelligent Text Overlap Detection & Auto-Fix
  // -------------------------------------------------------------------------

  /**
   * Checks if two text bounding boxes overlap and shifts the second one to avoid collision.
   */
  private static resolveTextOverlaps(
    placements: Array<{ x: number; y: number; w: number; h: number; text: string }>
  ): Array<{ x: number; y: number; text: string }> {
    const result: Array<{ x: number; y: number; text: string }> = [];
    const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];

    for (const p of placements) {
      let px = p.x;
      let py = p.y;
      let attempts = 0;
      const maxAttempts = 8;

      while (attempts < maxAttempts) {
        const collision = occupied.some(
          (o) => Math.abs(px - o.x) < (p.w + o.w) / 2 + 80 && Math.abs(py - o.y) < (p.h + o.h) / 2 + 80
        );
        if (!collision) break;
        // Shift downward
        py -= p.h + 120;
        attempts++;
      }

      occupied.push({ x: px, y: py, w: p.w, h: p.h });
      result.push({ x: px, y: py, text: p.text });
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Continuous Multi-Span Beam Grouping & Multi-Page A3 Sheet Construction
  // -------------------------------------------------------------------------

  public static buildSheets(input: BeamSectionSheetInput): DrawingSheet[] {
    const { level } = input;
    const designs = this.extractLevelBeams(input);

    // Reset beam numbering per floor: B1, B2, B3...
    const beamLabels = new Map<number, string>();
    designs.forEach((d, idx) => {
      beamLabels.set(d.memberId, `B${idx + 1}`);
    });

    if (designs.length === 0) {
      const b = new SheetBuilder(BEAM_SECTION_SHEET_LAYERS);
      const sheetNumber = `STR-${200 + (level.levelIndex || 0)}`;
      drawA3BorderAndTitleBlock(b, {
        title: `${level.levelName.toUpperCase()} BEAM LAYOUT`,
        sheetNumber,
        levelName: level.levelName,
      });
      drawA3GeneralNotes(b);
      return [
        b.build({
          sheetNumber,
          title: `${level.levelName.toUpperCase()} BEAM LAYOUT`,
          levelName: level.levelName,
          notes: ['(SCALE: H - 1:50 / V - 1:50)'],
        }),
      ];
    }

    const runs = this.groupContinuousBeams(designs, level);

    // Plan row placements across pages
    // Row 0 has Notes block on right (maxX = 31000). Rows 1-2 have maxX = 38500.
    const rowMaxX = [31000, 38500, 38500];
    const rowBaseYs = [21200, 14200, 7200];

    interface PlacedRun {
      run: ContinuousBeamRun;
      x: number;
      y: number;
      maxW: number;
    }

    const pages: PlacedRun[][] = [];
    let curPage: PlacedRun[] = [];
    let curRow = 0;
    let curX = 2200;

    runs.forEach((run) => {
      let limitX = rowMaxX[curRow] || 38500;
      const fullRowW = limitX - 2200;
      const fitScaleFull = run.totalWidthDrawing > fullRowW ? fullRowW / run.totalWidthDrawing : 1.0;
      const minRunW = run.totalWidthDrawing * fitScaleFull;

      if (curX + minRunW > limitX && curX > 2200) {
        // Wrap to next row
        curRow++;
        curX = 2200;
      }

      if (curRow >= 3) {
        // Page full -> start new page
        pages.push(curPage);
        curPage = [];
        curRow = 0;
        curX = 2200;
      }

      limitX = rowMaxX[curRow] || 38500;
      const maxW = Math.max(1000, limitX - curX);
      const fitScale = run.totalWidthDrawing > maxW ? maxW / run.totalWidthDrawing : 1.0;
      const effectiveW = run.totalWidthDrawing * fitScale;

      curPage.push({ run, x: curX, y: rowBaseYs[curRow], maxW });
      curX += effectiveW + 2400; // gap between runs in same row
    });

    if (curPage.length > 0) {
      pages.push(curPage);
    }

    // PAGE 1: Beam Layout Plan (Plan View)
    const sheets: DrawingSheet[] = [];
    const layoutBuilder = new SheetBuilder(BEAM_SECTION_SHEET_LAYERS);
    drawA3BorderAndTitleBlock(layoutBuilder, {
      title: `${level.levelName.toUpperCase()} BEAM LAYOUT PLAN`,
      sheetNumber: '11',
      levelName: level.levelName,
      project: input.project,
    });
    drawA3GeneralNotes(layoutBuilder);
    this.drawBeamLayoutPlan(layoutBuilder, level, beamLabels);
    sheets.push(layoutBuilder.build({
      sheetNumber: `STR-${200 + (level.levelIndex || 0)}-PLAN`,
      title: `${level.levelName.toUpperCase()} BEAM LAYOUT PLAN`,
      subtitle: `${designs.length} beams · Plan View`,
      levelName: level.levelName,
      notes: [
        '(SCALE: H - 1:50 / V - 1:50)',
        'All dimensions in mm',
        'Beam labels shown as B1, B2, B3... (per floor)',
      ],
    }));

    // SUBSEQUENT PAGES: Beam Longitudinal Sections
    const totalPages = Math.max(1, pages.length);
    const baseSheetNumber = `STR-${200 + (level.levelIndex || 0)}`;

    pages.forEach((pageRuns, pIdx) => {
      const builder = new SheetBuilder(BEAM_SECTION_SHEET_LAYERS);
      const sheetNumber = totalPages > 1 ? `${baseSheetNumber}-P${pIdx + 1}` : baseSheetNumber;
      const pageInfo = totalPages > 1 ? `PAGE ${pIdx + 1} OF ${totalPages}` : undefined;

      // 1. Draw A3 Border and Engineering Title Block
      drawA3BorderAndTitleBlock(builder, {
        title: `${level.levelName.toUpperCase()} BEAM LONGITUDINAL SECTION`,
        sheetNumber: `${pIdx + 12}`,
        levelName: level.levelName,
        pageInfo,
        project: input.project,
      });

      // 2. Draw Top-Right General Notes Block
      drawA3GeneralNotes(builder);

      // 3. Draw All Continuous Runs on this page
      pageRuns.forEach(({ run, x, y, maxW }) => {
        this.drawContinuousRun(builder, run, x, y, level, maxW);
      });

      sheets.push(builder.build({
        sheetNumber,
        title: `${level.levelName.toUpperCase()} BEAM LONGITUDINAL SECTION`,
        subtitle: `${designs.length} beams · ${runs.length} continuous runs · Page ${pIdx + 1} of ${totalPages}`,
        levelName: level.levelName,
        notes: [
          '(SCALE: H - 1:50 / V - 1:50)',
          '(SCALE 1:25)',
          'All dimensions in mm',
        ],
      }));
    });

    return sheets;
  }

  /**
   * Backward-compatible single sheet builder.
   * Returns page 0 or the requested pageIndex from buildSheets.
   */
  public static buildSheet(input: BeamSectionSheetInput, pageIndex = 0): DrawingSheet {
    const sheets = this.buildSheets(input);
    return sheets[Math.min(pageIndex, sheets.length - 1)] || sheets[0];
  }

  /**
   * Groups colinear, contiguous beams sharing common support nodes/columns into
   * continuous multi-span runs (e.g. 2-span, 3-span, 4-span, 5-span runs).
   */
  public static groupContinuousBeams(
    designs: BeamSectionDesign[],
    level: FloorPlanLevel
  ): ContinuousBeamRun[] {
    const S = STRIP_SCALE; // 2
    const used = new Set<number>();
    const runs: ContinuousBeamRun[] = [];

    const getBeam = (mId: number): FloorBeamInfo =>
      (level.beams || []).find((b) => b.memberId === mId) || {
        memberId: mId,
        label: `B${mId}`,
        startNodeId: 1,
        endNodeId: 2,
        startX: 0,
        startZ: 0,
        endX: 4.5,
        endZ: 0,
        length: 4.5,
        width: 0.23,
        depth: 0.45,
        sectionName: '230x450',
      };

    const xBeams: { design: BeamSectionDesign; beam: FloorBeamInfo }[] = [];
    const zBeams: { design: BeamSectionDesign; beam: FloorBeamInfo }[] = [];

    designs.forEach((d) => {
      const beam = getBeam(d.memberId);
      const dx = Math.abs(beam.endX - beam.startX);
      const dz = Math.abs(beam.endZ - beam.startZ);
      if (dx >= dz) {
        xBeams.push({ design: d, beam });
      } else {
        zBeams.push({ design: d, beam });
      }
    });

    const finalizeRun = (
      items: { design: BeamSectionDesign; beam: FloorBeamInfo }[],
      axis: 'X' | 'Z'
    ) => {
      let totalSpanMm = 0;
      let totalDrawingW = 0;
      const spans = items.map((it, idx) => {
        const supLeft = this.resolveSupport(level, it.beam, 'start');
        const supRight = this.resolveSupport(level, it.beam, 'end');
        const spanMm = Math.round(it.design.spanM * 1000);
        const clearSpanMm = Math.max(1000, spanMm - Math.round(supLeft.widthMm / 2 + supRight.widthMm / 2));
        totalSpanMm += spanMm;
        const spanDrawing = clearSpanMm * S;
        totalDrawingW += spanDrawing + (idx === 0 ? supLeft.widthMm * S : 0) + supRight.widthMm * S;
        return {
          design: it.design,
          beam: it.beam,
          spanMm,
          clearSpanMm,
          wLeftMm: supLeft.widthMm,
          wRightMm: supRight.widthMm,
          supLeft,
          supRight,
        };
      });

      runs.push({
        runId: items.map((i) => i.design.mark).join('-'),
        axis,
        spans,
        totalSpanMm,
        totalWidthDrawing: totalDrawingW,
      });
    };

    const chainBeams = (
      list: { design: BeamSectionDesign; beam: FloorBeamInfo }[],
      axis: 'X' | 'Z'
    ) => {
      const groups = new Map<number, { design: BeamSectionDesign; beam: FloorBeamInfo }[]>();
      list.forEach((item) => {
        const coord = axis === 'X' ? item.beam.startZ : item.beam.startX;
        const key = Math.round(coord * 2) / 2; // within 0.5m grid line
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      });

      groups.forEach((group) => {
        group.sort((a, b) => {
          const valA = axis === 'X' ? Math.min(a.beam.startX, a.beam.endX) : Math.min(a.beam.startZ, a.beam.endZ);
          const valB = axis === 'X' ? Math.min(b.beam.startX, b.beam.endX) : Math.min(b.beam.startZ, b.beam.endZ);
          return valA - valB;
        });

        let currentRun: { design: BeamSectionDesign; beam: FloorBeamInfo }[] = [];

        for (let i = 0; i < group.length; i++) {
          const item = group[i];
          if (used.has(item.design.memberId)) continue;

          if (currentRun.length === 0) {
            currentRun.push(item);
            used.add(item.design.memberId);
          } else {
            const prev = currentRun[currentRun.length - 1];
            const prevEndNode = prev.beam.endNodeId;
            const nextStartNode = item.beam.startNodeId;
            const prevEndCoord = axis === 'X' ? Math.max(prev.beam.startX, prev.beam.endX) : Math.max(prev.beam.startZ, prev.beam.endZ);
            const nextStartCoord = axis === 'X' ? Math.min(item.beam.startX, item.beam.endX) : Math.min(item.beam.startZ, item.beam.endZ);

            const isConnected =
              prevEndNode === nextStartNode ||
              prev.beam.startNodeId === item.beam.startNodeId ||
              prev.beam.endNodeId === item.beam.endNodeId ||
              Math.abs(prevEndCoord - nextStartCoord) <= 0.6;

            if (isConnected && currentRun.length < 5) {
              currentRun.push(item);
              used.add(item.design.memberId);
            } else {
              finalizeRun(currentRun, axis);
              currentRun = [item];
              used.add(item.design.memberId);
            }
          }
        }
        if (currentRun.length > 0) {
          finalizeRun(currentRun, axis);
        }
      });
    };

    chainBeams(xBeams, 'X');
    chainBeams(zBeams, 'Z');

    designs.forEach((d) => {
      if (!used.has(d.memberId)) {
        const beam = getBeam(d.memberId);
        finalizeRun([{ design: d, beam }], 'X');
        used.add(d.memberId);
      }
    });

    return runs;
  }

  /**
   * Draws an authentic continuous multi-span beam elevation cross-section matching media_1789398691291.png.
   */
  public static drawContinuousRun(
    b: SheetBuilder,
    run: ContinuousBeamRun,
    originX: number,
    rowBaseY: number,
    level: FloorPlanLevel,
    maxAvailableW?: number
  ) {
    const maxW = maxAvailableW || Math.max(1000, 39500 - originX);
    const fitScale = run.totalWidthDrawing > maxW ? maxW / run.totalWidthDrawing : 1.0;
    const S = STRIP_SCALE * fitScale;
    const N = run.spans.length;
    if (N === 0) return;

    const maxD = Math.max(...run.spans.map((s) => s.design.D));
    const D_units = maxD * S;

    const yBot = rowBaseY;
    const yTop = yBot + D_units;
    const covUnits = BEAM_COVER * S;
    const yTopBar = yTop - covUnits - 25;
    const yBotBar = yBot + covUnits + 25;

    // Track column & span X coordinates
    let curX = originX;
    const spanXStarts: number[] = [];
    const spanXEnds: number[] = [];
    const colStarts: number[] = [];
    const colEnds: number[] = [];
    const colCenters: number[] = [];

    // Left end support
    const w0Units = run.spans[0].wLeftMm * S;
    colStarts.push(curX);
    colEnds.push(curX + w0Units);
    colCenters.push(curX + w0Units / 2);
    curX += w0Units;

    run.spans.forEach((spanItem, idx) => {
      const spanW = spanItem.clearSpanMm * S;
      spanXStarts.push(curX);
      const xEnd = curX + spanW;
      spanXEnds.push(xEnd);
      curX = xEnd;

      const wSupport = spanItem.wRightMm * S;
      colStarts.push(curX);
      colEnds.push(curX + wSupport);
      colCenters.push(curX + wSupport / 2);
      curX += wSupport;
    });

    const xAnchLeft = colStarts[0] + covUnits;
    const xAnchRight = colEnds[N] - covUnits;

    // 1. Concrete Outline across all spans
    for (let i = 0; i < N; i++) {
      b.line(LAYER_CONCRETE.name, spanXStarts[i], yTop, spanXEnds[i], yTop);
      b.line(LAYER_CONCRETE.name, spanXStarts[i], yBot, spanXEnds[i], yBot);
    }

    // 2. Supports Detailing (Left, Intermediates, Right)
    const yColTop = yTop + 950;
    const yColBot = yBot - 1200;

    // Left Support
    const sup0 = run.spans[0].supLeft;
    b.line(LAYER_CONCRETE.name, colStarts[0], yColBot, colStarts[0], yColTop);
    b.line(LAYER_CONCRETE.name, colEnds[0], yTop, colEnds[0], yColTop);
    b.line(LAYER_CONCRETE.name, colEnds[0], yColBot, colEnds[0], yBot);
    this.drawBreakline(b, colStarts[0], colEnds[0], yColTop);
    this.drawBreakline(b, colStarts[0], colEnds[0], yColBot);
    this.drawCenterLine(b, colCenters[0], yColBot - 350, yColTop + 1300);
    b.arrowHead(LAYER_GRID.name, colCenters[0], yColTop + 1250, Math.PI / 2, 85);
    b.text(LAYER_GRID.name, colCenters[0], yTop + 2250, sup0.gridLabel, TEXT_H.MARK, { anchor: 'middle', bold: true });
    b.dimHorizontal(colStarts[0], colEnds[0], yTop + 1100, sup0.widthMm, { textHeight: TEXT_H.DIM });
    b.text(LAYER_LABELS_SUPPORT.name, colCenters[0], yBot - 2220, sup0.label, TEXT_H.MARK, { anchor: 'middle', bold: true });

    // Intermediate Supports
    for (let i = 0; i < N - 1; i++) {
      const cIdx = i + 1;
      const sup = run.spans[i].supRight;
      b.line(LAYER_CONCRETE.name, colStarts[cIdx], yTop, colStarts[cIdx], yColTop);
      b.line(LAYER_CONCRETE.name, colStarts[cIdx], yColBot, colStarts[cIdx], yBot);
      b.line(LAYER_CONCRETE.name, colEnds[cIdx], yTop, colEnds[cIdx], yColTop);
      b.line(LAYER_CONCRETE.name, colEnds[cIdx], yColBot, colEnds[cIdx], yBot);
      this.drawBreakline(b, colStarts[cIdx], colEnds[cIdx], yColTop);
      this.drawBreakline(b, colStarts[cIdx], colEnds[cIdx], yColBot);
      this.drawCenterLine(b, colCenters[cIdx], yColBot - 350, yColTop + 1300);
      b.arrowHead(LAYER_GRID.name, colCenters[cIdx], yColTop + 1250, Math.PI / 2, 85);
      b.text(LAYER_GRID.name, colCenters[cIdx], yTop + 2250, sup.gridLabel, TEXT_H.MARK, { anchor: 'middle', bold: true });
      b.dimHorizontal(colStarts[cIdx], colEnds[cIdx], yTop + 1100, sup.widthMm, { textHeight: TEXT_H.DIM });

      // Clean column marks below (stagger if very close)
      const isClose = Math.abs(colCenters[cIdx] - colCenters[cIdx - 1]) < 1800;
      const staggerY = (cIdx % 2 === 1 && isClose) ? yBot - 2380 : yBot - 2220;
      b.text(LAYER_LABELS_SUPPORT.name, colCenters[cIdx], staggerY, sup.label, TEXT_H.MARK, { anchor: 'middle', bold: true });
    }

    // Right End Support
    const supLast = run.spans[N - 1].supRight;
    b.line(LAYER_CONCRETE.name, colStarts[N], yTop, colStarts[N], yColTop);
    b.line(LAYER_CONCRETE.name, colStarts[N], yColBot, colStarts[N], yBot);
    b.line(LAYER_CONCRETE.name, colEnds[N], yColBot, colEnds[N], yColTop);
    this.drawBreakline(b, colStarts[N], colEnds[N], yColTop);
    this.drawBreakline(b, colStarts[N], colEnds[N], yColBot);
    this.drawCenterLine(b, colCenters[N], yColBot - 350, yColTop + 1300);
    b.arrowHead(LAYER_GRID.name, colCenters[N], yColTop + 1250, Math.PI / 2, 85);
    b.text(LAYER_GRID.name, colCenters[N], yTop + 2250, supLast.gridLabel, TEXT_H.MARK, { anchor: 'middle', bold: true });
    b.dimHorizontal(colStarts[N], colEnds[N], yTop + 1100, supLast.widthMm, { textHeight: TEXT_H.DIM });
    b.text(LAYER_LABELS_SUPPORT.name, colCenters[N], yBot - 2220, supLast.label, TEXT_H.MARK, { anchor: 'middle', bold: true });

    // 3. Continuous Top Through Rebar (full run length)
    b.poly(
      LAYER_REBAR.name,
      [
        [xAnchLeft, yTopBar - 220],
        [xAnchLeft, yTopBar],
        [xAnchRight, yTopBar],
        [xAnchRight, yTopBar - 220],
      ],
      false
    );

    const firstTopThru = `${run.spans[0].design.top.through.count}-T ${run.spans[0].design.top.through.dia}`;
    const topCalloutX = spanXStarts[0] + (spanXEnds[0] - spanXStarts[0]) * 0.22;
    b.leader(LAYER_REBAR.name, topCalloutX, yTopBar + 170, topCalloutX, yTopBar, { h: TEXT_H.CALLOUT });
    b.text(LAYER_REBAR.name, topCalloutX, yTopBar + 210, firstTopThru, TEXT_H.CALLOUT, {
      anchor: 'middle',
      bold: true,
    });

    // 4. Per-Span Reinforcement & Detailing
    // Collect all text callouts for overlap resolution
    interface RebarCallout {
      x: number;
      y: number;
      w: number;
      h: number;
      text: string;
      layer: string;
      fontSize: number;
      bold: boolean;
    }
    const allCallouts: RebarCallout[] = [];

    run.spans.forEach((spanItem, idx) => {
      const design = spanItem.design;
      const xStart = spanXStarts[idx];
      const xEnd = spanXEnds[idx];
      const clearSpanMm = spanItem.clearSpanMm;
      const spanMm = spanItem.spanMm;
      const spanUnits = xEnd - xStart;

      // Bottom Continuous Through Rebar
      const leftHookX = idx === 0 ? xAnchLeft : xStart - 80;
      const rightHookX = idx === N - 1 ? xAnchRight : xEnd + 80;

      if (idx === 0 || idx === N - 1) {
        const pts: [number, number][] = [];
        if (idx === 0) pts.push([xAnchLeft, yBotBar + 220]);
        pts.push([leftHookX, yBotBar]);
        pts.push([rightHookX, yBotBar]);
        if (idx === N - 1) pts.push([xAnchRight, yBotBar + 220]);
        b.poly(LAYER_REBAR.name, pts, false);
      } else {
        b.line(LAYER_REBAR.name, leftHookX, yBotBar, rightHookX, yBotBar);
      }

      // Bottom Through Rebar Callout
      const botCalloutX = xStart + spanUnits * 0.22;
      b.leader(LAYER_REBAR.name, botCalloutX, yBot - 170, botCalloutX, yBotBar, { h: TEXT_H.CALLOUT });
      const botText = `${design.bottom.through.count}-T ${design.bottom.through.dia}`;
      allCallouts.push({ x: botCalloutX, y: yBot - 210, w: botText.length * 80 + 100, h: TEXT_H.CALLOUT + 40, text: botText, layer: LAYER_REBAR.name, fontSize: TEXT_H.CALLOUT, bold: true });

      // Bottom Extra Midspan Rebar
      if (design.bottom.extra && design.bottom.extra.count > 0) {
        const startOffMm = design.curtailmentDetails?.botStartOffsetMm || Math.round(clearSpanMm * 0.15);
        const midLenMm = design.curtailmentDetails?.botLengthMm || Math.max(500, clearSpanMm - 2 * startOffMm);
        const xMidStart = xStart + startOffMm * S;
        const xMidEnd = xMidStart + midLenMm * S;
        const yBotExtra = yBotBar + 35;

        b.line(LAYER_REBAR.name, xMidStart, yBotExtra, xMidEnd, yBotExtra);
        b.line(LAYER_REBAR.name, xMidStart, yBotExtra - 15, xMidStart, yBotExtra + 15);
        b.line(LAYER_REBAR.name, xMidEnd, yBotExtra - 15, xMidEnd, yBotExtra + 15);

        const midCalloutX = (xMidStart + xMidEnd) / 2;
        b.leader(LAYER_REBAR.name, midCalloutX, yBot - 370, midCalloutX, yBotExtra, { h: TEXT_H.CALLOUT });
        const extraText = `${design.bottom.extra.count}-T ${design.bottom.extra.dia}`;
        allCallouts.push({ x: midCalloutX, y: yBot - 410, w: extraText.length * 80 + 100, h: TEXT_H.CALLOUT + 40, text: extraText, layer: LAYER_REBAR.name, fontSize: TEXT_H.CALLOUT, bold: true });
        b.dimHorizontal(xMidStart, xMidEnd, yBot - 720, midLenMm, { textHeight: TEXT_H.DIM });
      }

      // Top Extra End Support Rebar
      if (idx === 0 && design.top.extra && design.top.extra.count > 0) {
        const cutLeftMm = design.curtailmentDetails?.topCutoffLeftMm || Math.round(clearSpanMm * 0.28);
        const xCutLeft = xStart + cutLeftMm * S;
        const yTopExtra = yTopBar - 35;
        b.poly(LAYER_REBAR.name, [[xAnchLeft, yTopExtra - 160], [xAnchLeft, yTopExtra], [xCutLeft, yTopExtra]], false);
        b.line(LAYER_REBAR.name, xCutLeft, yTopExtra - 15, xCutLeft, yTopExtra + 15);
        const extraCalloutX = (xStart + xCutLeft) / 2;
        b.leader(LAYER_REBAR.name, extraCalloutX, yTop + 200, extraCalloutX, yTopExtra, { h: TEXT_H.CALLOUT });
        const extraTopText = `${design.top.extra.count}-T ${design.top.extra.dia}`;
        allCallouts.push({ x: extraCalloutX, y: yTop + 240, w: extraTopText.length * 80 + 100, h: TEXT_H.CALLOUT + 40, text: extraTopText, layer: LAYER_REBAR.name, fontSize: TEXT_H.CALLOUT, bold: true });
        b.dimHorizontal(xStart, xCutLeft, yTop + 580, cutLeftMm, { textHeight: TEXT_H.DIM });
      }

      if (idx === N - 1 && design.top.extra && design.top.extra.count > 0) {
        const cutRightMm = design.curtailmentDetails?.topCutoffRightMm || Math.round(clearSpanMm * 0.28);
        const xCutRight = xEnd - cutRightMm * S;
        const yTopExtra = yTopBar - 35;
        b.poly(LAYER_REBAR.name, [[xCutRight, yTopExtra], [xAnchRight, yTopExtra], [xAnchRight, yTopExtra - 160]], false);
        b.line(LAYER_REBAR.name, xCutRight, yTopExtra - 15, xCutRight, yTopExtra + 15);
        const extraCalloutX = (xCutRight + xEnd) / 2;
        b.leader(LAYER_REBAR.name, extraCalloutX, yTop + 200, extraCalloutX, yTopExtra, { h: TEXT_H.CALLOUT });
        const extraTopText2 = `${design.top.extra.count}-T ${design.top.extra.dia}`;
        allCallouts.push({ x: extraCalloutX, y: yTop + 240, w: extraTopText2.length * 80 + 100, h: TEXT_H.CALLOUT + 40, text: extraTopText2, layer: LAYER_REBAR.name, fontSize: TEXT_H.CALLOUT, bold: true });
        b.dimHorizontal(xCutRight, xEnd, yTop + 580, cutRightMm, { textHeight: TEXT_H.DIM });
      }

      // Stirrups in 3 Zones
      this.drawSpanStirrups(b, design, xStart, xEnd, yBot, yTop, S);

      // Top Span Dimension — center-to-center (at yTop + 1650)
      b.dimHorizontal(xStart, xEnd, yTop + 1650, spanMm, { textHeight: TEXT_H.DIM + 20 });

      // Beam Mark & Size below span (at yBot - 1880, auto-wrap on narrow spans)
      const availW = spanUnits - 80;
      const midX = (xStart + xEnd) / 2;
      if (availW < 1600) {
        b.text(LAYER_LABELS.name, midX, yBot - 1800, design.mark, TEXT_H.MARK, { anchor: 'middle', bold: true });
        b.text(LAYER_LABELS.name, midX, yBot - 2020, `${design.b}x${design.D}`, TEXT_H.MARK, { anchor: 'middle', bold: true });
      } else {
        b.text(LAYER_LABELS.name, midX, yBot - 1880, `${design.mark}:${design.b}x${design.D}`, TEXT_H.LABEL, { anchor: 'middle', bold: true });
      }
    });

    // Resolve text overlaps and draw all rebar callouts
    const resolvedRebarCallouts = this.resolveTextOverlaps(allCallouts);
    resolvedRebarCallouts.forEach((rc, i) => {
      b.text(allCallouts[i].layer, rc.x, rc.y, rc.text, allCallouts[i].fontSize, { anchor: 'middle', bold: allCallouts[i].bold });
    });

    // 5. Top Extra Rebar Over Intermediate Supports
    for (let i = 0; i < N - 1; i++) {
      const leftDesign = run.spans[i].design;
      const rightDesign = run.spans[i + 1].design;
      const extraBars = rightDesign.top.extra || leftDesign.top.extra;
      if (extraBars && extraBars.count > 0) {
        const cutLeftMm = leftDesign.curtailmentDetails?.topCutoffRightMm || Math.round(run.spans[i].clearSpanMm * 0.28);
        const cutRightMm = rightDesign.curtailmentDetails?.topCutoffLeftMm || Math.round(run.spans[i + 1].clearSpanMm * 0.28);
        const cIdx = i + 1;
        const xCutLeft = colStarts[cIdx] - cutLeftMm * S;
        const xCutRight = colEnds[cIdx] + cutRightMm * S;
        const yTopExtra = yTopBar - 35;

        b.line(LAYER_REBAR.name, xCutLeft, yTopExtra, xCutRight, yTopExtra);
        b.line(LAYER_REBAR.name, xCutLeft, yTopExtra - 15, xCutLeft, yTopExtra + 15);
        b.line(LAYER_REBAR.name, xCutRight, yTopExtra - 15, xCutRight, yTopExtra + 15);

        b.leader(LAYER_REBAR.name, colCenters[cIdx], yTop + 200, colCenters[cIdx], yTopExtra, { h: TEXT_H.CALLOUT });
        b.text(
          LAYER_REBAR.name,
          colCenters[cIdx],
          yTop + 240,
          `${extraBars.count}-T ${extraBars.dia}`,
          TEXT_H.CALLOUT,
          { anchor: 'middle', bold: true }
        );

        b.dimHorizontal(xCutLeft, colStarts[cIdx], yTop + 580, cutLeftMm, { textHeight: TEXT_H.DIM });
        b.dimHorizontal(colEnds[cIdx], xCutRight, yTop + 580, cutRightMm, { textHeight: TEXT_H.DIM });
      }
    }

    // Scale note below the run (at yBot - 2550)
    b.text(
      LAYER_TEXT_SCALE.name,
      (colStarts[0] + colEnds[N]) / 2,
      yBot - 2550,
      '(SCALE: H - 1:50 / V - 1:50)',
      140,
      { anchor: 'middle' }
    );
  }

  private static drawSpanStirrups(
    b: SheetBuilder,
    design: BeamSectionDesign,
    xStart: number,
    xEnd: number,
    yBot: number,
    yTop: number,
    S: number
  ) {
    const spanUnits = xEnd - xStart;
    const totalZoneMm = design.zones.reduce((s, z) => s + (z.endMm - z.startMm), 0) || 1;

    // Minimum drawing width needed for text (approx text width + padding)
    const MIN_TEXT_ZONE_W = 1200;
    const MIN_DIM_ZONE_W = 800;

    // Collect all text placements for overlap resolution
    interface TextPlacement {
      x: number;
      y: number;
      w: number;
      h: number;
      text: string;
      layer: string;
      fontSize: number;
      bold: boolean;
    }

    const callouts: TextPlacement[] = [];
    const dims: TextPlacement[] = [];

    let cursorX = xStart;
    design.zones.forEach((zone) => {
      const zoneMm = zone.endMm - zone.startMm;
      const zoneW = (spanUnits * zoneMm) / totalZoneMm;
      const zEnd = cursorX + zoneW;

      // Vertical stirrup lines inside beam
      const step = Math.max(16, Math.min(zoneW / 6, (zone.spacing * S) / 2));
      let sx = cursorX + step / 2;
      while (sx < zEnd) {
        b.line(LAYER_LINK.name, sx, yBot + 30, sx, yTop - 30);
        sx += step;
      }

      // Zone delimiter vertical tick
      b.line(LAYER_LINK.name, zEnd, yBot, zEnd, yTop);

      const zMid = (cursorX + zEnd) / 2;
      const dia = zone.stirrupDia || design.stirrups.dia || 8;
      const spacing = zone.spacing || 200;

      if (zoneW >= MIN_TEXT_ZONE_W) {
        const stirrupText = `${dia}mm@${spacing}mm c/c`;
        const isMidZone = design.zones.length > 1 && design.zones.indexOf(zone) === 1;
        const calloutY = isMidZone ? yBot - 1240 : yBot - 1050;
        callouts.push({ x: zMid, y: calloutY, w: stirrupText.length * 80 + 100, h: TEXT_H.CALLOUT + 40, text: stirrupText, layer: LAYER_SCHEDULE_TEXT.name, fontSize: TEXT_H.CALLOUT, bold: true });
      } else if (zoneW >= 500) {
        const compactText = `${dia}@${spacing}`;
        callouts.push({ x: zMid, y: yBot - 1050, w: compactText.length * 60 + 80, h: TEXT_H.CALLOUT - 20, text: compactText, layer: LAYER_SCHEDULE_TEXT.name, fontSize: TEXT_H.CALLOUT - 40, bold: true });
      }

      if (zoneMm > 0 && zoneW >= MIN_DIM_ZONE_W) {
        dims.push({ x: zMid, y: yBot - 1520, w: 500, h: TEXT_H.DIM, text: String(Math.round(zoneMm)), layer: LAYER_DIMENSION.name, fontSize: TEXT_H.DIM + 20, bold: false });
      } else if (zoneMm > 0 && zoneW >= 400) {
        dims.push({ x: zMid, y: yBot - 1520, w: 300, h: TEXT_H.CALLOUT - 20, text: String(Math.round(zoneMm)), layer: LAYER_DIMENSION.name, fontSize: TEXT_H.CALLOUT - 40, bold: false });
      }

      cursorX = zEnd;
    });

    // Resolve overlaps and draw callouts
    const resolvedCallouts = this.resolveTextOverlaps(callouts);
    resolvedCallouts.forEach((rc, i) => {
      b.text(callouts[i].layer, rc.x, rc.y, rc.text, callouts[i].fontSize, { anchor: 'middle', bold: callouts[i].bold });
    });

    // Resolve overlaps and draw dims
    const resolvedDims = this.resolveTextOverlaps(dims);
    resolvedDims.forEach((rd, i) => {
      b.text(dims[i].layer, rd.x, rd.y, rd.text, dims[i].fontSize, { anchor: 'middle' });
    });
  }

  /**
   * Generates a full longitudinal cross-section elevation for the beam,
   * matching authentic AutoCAD structural detailing standards and the reference drawing.
   */
  private static drawDetail(
    b: SheetBuilder,
    design: BeamSectionDesign,
    cellX: number,
    cellW: number,
    rowBaseY: number,
    level: FloorPlanLevel
  ) {
    const S = STRIP_SCALE; // 2 drawing units per mm
    const cx = cellX + cellW / 2;

    const beam = (level.beams || []).find((bm) => bm.memberId === design.memberId) || {
      memberId: design.memberId,
      label: design.mark,
      startNodeId: 1,
      endNodeId: 2,
      startX: 0,
      startZ: 0,
      endX: design.spanM,
      endZ: 0,
      length: design.spanM,
      width: design.b / 1000,
      depth: design.D / 1000,
      sectionName: `${design.b}x${design.D}`,
    };

    const supLeft = this.resolveSupport(level, beam, 'start');
    const supRight = this.resolveSupport(level, beam, 'end');

    const totalSpanMm = Math.round(design.spanM * 1000);
    const clearSpanMm = Math.max(1000, totalSpanMm - Math.round(supLeft.widthMm / 2 + supRight.widthMm / 2));
    const spanUnits = clearSpanMm * S;
    const D_units = design.D * S;

    const xLeft = cx - spanUnits / 2;
    const xRight = cx + spanUnits / 2;

    const yBot = rowBaseY + 6500;
    const yTop = yBot + D_units;

    // -----------------------------------------------------------------------
    // 1. Concrete Outline: beam top and soffit wireframe lines (yellow)
    // -----------------------------------------------------------------------
    b.line(LAYER_CONCRETE.name, xLeft, yTop, xRight, yTop);
    b.line(LAYER_CONCRETE.name, xLeft, yBot, xRight, yBot);

    // -----------------------------------------------------------------------
    // 2. Left End Support (Column or Beam)
    // -----------------------------------------------------------------------
    const wLeftUnits = supLeft.widthMm * S;
    const xColLeftOut = xLeft - wLeftUnits;
    const xClLeft = xLeft - wLeftUnits / 2;

    if (supLeft.type === 'COLUMN') {
      const yColTop = yTop + 1400;
      const yColBot = yBot - 1400;

      // Outer vertical column edge
      b.line(LAYER_CONCRETE.name, xColLeftOut, yColBot, xColLeftOut, yColTop);
      // Inner column edge segments
      b.line(LAYER_CONCRETE.name, xLeft, yTop, xLeft, yColTop);
      b.line(LAYER_CONCRETE.name, xLeft, yColBot, xLeft, yBot);
      b.line(LAYER_CONCRETE.name, xLeft, yBot, xLeft, yTop);

      // Breaklines
      this.drawBreakline(b, xColLeftOut, xLeft, yColTop);
      this.drawBreakline(b, xColLeftOut, xLeft, yColBot);

      // Dash-dot centerline
      this.drawCenterLine(b, xClLeft, yColBot - 500, yColTop + 850);
      b.arrowHead(LAYER_GRID.name, xClLeft, yColTop + 800, Math.PI / 2, 85);
      b.text(LAYER_GRID.name, xClLeft, yColTop + 1100, supLeft.gridLabel, TEXT_H.GRID, {
        anchor: 'middle',
        bold: true,
      });
      b.dimHorizontal(xColLeftOut, xLeft, yColTop + 450, supLeft.widthMm, {
        textHeight: TEXT_H.CALLOUT,
      });
      b.text(LAYER_LABELS_SUPPORT.name, xClLeft, yColBot - 450, supLeft.label, TEXT_H.GRID, {
        anchor: 'middle',
        bold: true,
      });
    } else if (supLeft.type === 'BEAM') {
      // Supporting beam rectangle
      b.rect(LAYER_CONCRETE.name, xColLeftOut, yBot, wLeftUnits, D_units);
      this.drawCenterLine(b, xClLeft, yBot - 800, yTop + 1100);
      b.arrowHead(LAYER_GRID.name, xClLeft, yTop + 1050, Math.PI / 2, 85);
      b.text(LAYER_GRID.name, xClLeft, yTop + 1350, supLeft.gridLabel, TEXT_H.GRID, {
        anchor: 'middle',
        bold: true,
      });
      b.dimHorizontal(xColLeftOut, xLeft, yTop + 650, supLeft.widthMm, {
        textHeight: TEXT_H.CALLOUT,
      });
      b.text(LAYER_LABELS_SUPPORT.name, xClLeft, yBot - 500, supLeft.label, TEXT_H.GRID, {
        anchor: 'middle',
        bold: true,
      });
    } else {
      b.line(LAYER_CONCRETE.name, xLeft, yBot, xLeft, yTop);
    }

    // -----------------------------------------------------------------------
    // 3. Right End Support (Column or Beam)
    // -----------------------------------------------------------------------
    const wRightUnits = supRight.widthMm * S;
    const xColRightOut = xRight + wRightUnits;
    const xClRight = xRight + wRightUnits / 2;

    if (supRight.type === 'COLUMN') {
      const yColTop = yTop + 1400;
      const yColBot = yBot - 1400;

      // Outer vertical column edge
      b.line(LAYER_CONCRETE.name, xColRightOut, yColBot, xColRightOut, yColTop);
      // Inner column edge segments
      b.line(LAYER_CONCRETE.name, xRight, yTop, xRight, yColTop);
      b.line(LAYER_CONCRETE.name, xRight, yColBot, xRight, yBot);
      b.line(LAYER_CONCRETE.name, xRight, yBot, xRight, yTop);

      // Breaklines
      this.drawBreakline(b, xRight, xColRightOut, yColTop);
      this.drawBreakline(b, xRight, xColRightOut, yColBot);

      // Dash-dot centerline
      this.drawCenterLine(b, xClRight, yColBot - 500, yColTop + 850);
      b.arrowHead(LAYER_GRID.name, xClRight, yColTop + 800, Math.PI / 2, 85);
      b.text(LAYER_GRID.name, xClRight, yColTop + 1100, supRight.gridLabel, TEXT_H.GRID, {
        anchor: 'middle',
        bold: true,
      });
      b.dimHorizontal(xRight, xColRightOut, yColTop + 450, supRight.widthMm, {
        textHeight: TEXT_H.CALLOUT,
      });
      b.text(LAYER_LABELS_SUPPORT.name, xClRight, yColBot - 450, supRight.label, TEXT_H.GRID, {
        anchor: 'middle',
        bold: true,
      });
    } else if (supRight.type === 'BEAM') {
      b.rect(LAYER_CONCRETE.name, xRight, yBot, wRightUnits, D_units);
      this.drawCenterLine(b, xClRight, yBot - 800, yTop + 1100);
      b.arrowHead(LAYER_GRID.name, xClRight, yTop + 1050, Math.PI / 2, 85);
      b.text(LAYER_GRID.name, xClRight, yTop + 1350, supRight.gridLabel, TEXT_H.GRID, {
        anchor: 'middle',
        bold: true,
      });
      b.dimHorizontal(xRight, xColRightOut, yTop + 650, supRight.widthMm, {
        textHeight: TEXT_H.CALLOUT,
      });
      b.text(LAYER_LABELS_SUPPORT.name, xClRight, yBot - 500, supRight.label, TEXT_H.GRID, {
        anchor: 'middle',
        bold: true,
      });
    } else {
      b.line(LAYER_CONCRETE.name, xRight, yBot, xRight, yTop);
    }

    // -----------------------------------------------------------------------
    // 4. Longitudinal Reinforcement (LAYER_REBAR, cyan)
    // -----------------------------------------------------------------------
    const covUnits = BEAM_COVER * S; // 60 units
    const yTopBar = yTop - covUnits - 25;
    const yBotBar = yBot + covUnits + 25;

    const xAnchLeft = supLeft.type === 'CANTILEVER' ? xLeft + covUnits : xColLeftOut + covUnits;
    const xAnchRight = supRight.type === 'CANTILEVER' ? xRight - covUnits : xColRightOut - covUnits;

    // A. Top continuous through bar with 90° downward hooks
    b.poly(
      LAYER_REBAR.name,
      [
        [xAnchLeft, yTopBar - 280],
        [xAnchLeft, yTopBar],
        [xAnchRight, yTopBar],
        [xAnchRight, yTopBar - 280],
      ],
      false
    );

    const topThruCallout = `${design.top.through.count}-T ${design.top.through.dia}`;
    const topCalloutX = xLeft + spanUnits * 0.22;
    const topCalloutY = yTopBar + 220;
    b.leader(LAYER_REBAR.name, topCalloutX, topCalloutY - 40, topCalloutX, yTopBar, {
      h: TEXT_H.CALLOUT,
    });
    b.text(LAYER_REBAR.name, topCalloutX, topCalloutY, topThruCallout, TEXT_H.CALLOUT, {
      anchor: 'middle',
      bold: true,
    });

    // B. Top extra support rebar (hogging reinforcement over supports)
    if (design.top.extra && design.top.extra.count > 0) {
      const extraCallout = `${design.top.extra.count}-T ${design.top.extra.dia}`;
      const cutLeftMm = design.curtailmentDetails?.topCutoffLeftMm || Math.round(clearSpanMm * 0.28);
      const xCutLeft = xLeft + cutLeftMm * S;
      const yTopExtra = yTopBar - 45;

      // Left support extra bar with downward hook
      b.poly(
        LAYER_REBAR.name,
        [
          [xAnchLeft, yTopExtra - 200],
          [xAnchLeft, yTopExtra],
          [xCutLeft, yTopExtra],
        ],
        false
      );
      b.line(LAYER_REBAR.name, xCutLeft, yTopExtra - 15, xCutLeft, yTopExtra + 15);

      const extraLeftCalloutX = (xLeft + xCutLeft) / 2;
      b.leader(LAYER_REBAR.name, extraLeftCalloutX, yTopBar + 380, extraLeftCalloutX, yTopExtra, {
        h: TEXT_H.CALLOUT,
      });
      b.text(LAYER_REBAR.name, extraLeftCalloutX, yTopBar + 420, extraCallout, TEXT_H.CALLOUT, {
        anchor: 'middle',
        bold: true,
      });
      b.dimHorizontal(xLeft, xCutLeft, yTop + 750, cutLeftMm, { textHeight: TEXT_H.CALLOUT });

      // Right support extra bar with downward hook
      const cutRightMm = design.curtailmentDetails?.topCutoffRightMm || Math.round(clearSpanMm * 0.28);
      const xCutRight = xRight - cutRightMm * S;

      b.poly(
        LAYER_REBAR.name,
        [
          [xCutRight, yTopExtra],
          [xAnchRight, yTopExtra],
          [xAnchRight, yTopExtra - 200],
        ],
        false
      );
      b.line(LAYER_REBAR.name, xCutRight, yTopExtra - 15, xCutRight, yTopExtra + 15);

      const extraRightCalloutX = (xCutRight + xRight) / 2;
      b.leader(LAYER_REBAR.name, extraRightCalloutX, yTopBar + 380, extraRightCalloutX, yTopExtra, {
        h: TEXT_H.CALLOUT,
      });
      b.text(LAYER_REBAR.name, extraRightCalloutX, yTopBar + 420, extraCallout, TEXT_H.CALLOUT, {
        anchor: 'middle',
        bold: true,
      });
      b.dimHorizontal(xCutRight, xRight, yTop + 750, cutRightMm, { textHeight: TEXT_H.CALLOUT });
    }

    // C. Bottom continuous through bar with 90° upward hooks
    b.poly(
      LAYER_REBAR.name,
      [
        [xAnchLeft, yBotBar + 280],
        [xAnchLeft, yBotBar],
        [xAnchRight, yBotBar],
        [xAnchRight, yBotBar + 280],
      ],
      false
    );

    const botThruCallout = `${design.bottom.through.count}-T ${design.bottom.through.dia}`;
    const botCalloutX = xLeft + spanUnits * 0.22;
    const botCalloutY = yBotBar - 220;
    b.leader(LAYER_REBAR.name, botCalloutX, botCalloutY + 40, botCalloutX, yBotBar, {
      h: TEXT_H.CALLOUT,
    });
    b.text(LAYER_REBAR.name, botCalloutX, botCalloutY, botThruCallout, TEXT_H.CALLOUT, {
      anchor: 'middle',
      bold: true,
    });

    // D. Bottom extra midspan rebar
    if (design.bottom.extra && design.bottom.extra.count > 0) {
      const startOffMm = design.curtailmentDetails?.botStartOffsetMm || Math.round(clearSpanMm * 0.15);
      const midLenMm = design.curtailmentDetails?.botLengthMm || Math.max(500, clearSpanMm - 2 * startOffMm);
      const xMidStart = xLeft + startOffMm * S;
      const xMidEnd = xMidStart + midLenMm * S;
      const yBotExtra = yBotBar + 45;

      b.line(LAYER_REBAR.name, xMidStart, yBotExtra, xMidEnd, yBotExtra);
      b.line(LAYER_REBAR.name, xMidStart, yBotExtra - 15, xMidStart, yBotExtra + 15);
      b.line(LAYER_REBAR.name, xMidEnd, yBotExtra - 15, xMidEnd, yBotExtra + 15);

      const botExtraCallout = `${design.bottom.extra.count}-T ${design.bottom.extra.dia}`;
      const midCalloutX = (xMidStart + xMidEnd) / 2;
      b.leader(LAYER_REBAR.name, midCalloutX, yBotExtra + 160, midCalloutX, yBotExtra, {
        h: TEXT_H.CALLOUT,
      });
      b.text(LAYER_REBAR.name, midCalloutX, yBotExtra + 200, botExtraCallout, TEXT_H.CALLOUT, {
        anchor: 'middle',
        bold: true,
      });
      b.dimHorizontal(xMidStart, xMidEnd, yBot - 880, midLenMm, { textHeight: TEXT_H.CALLOUT });
    }

    // -----------------------------------------------------------------------
    // 5. Stirrups & Confinement Zones across Beam Elevation (LAYER_LINK)
    // -----------------------------------------------------------------------
    const zones = design.zones && design.zones.length > 0
      ? design.zones
      : [
          {
            startMm: 0,
            endMm: clearSpanMm,
            label: `${design.mark} (LOC: 0 TO ${clearSpanMm})`,
            spacing: design.stirrups.spacingSupport,
            stirrupCount: Math.ceil(clearSpanMm / design.stirrups.spacingSupport) + 1,
            stirrupDia: design.stirrups.dia,
          },
        ];

    zones.forEach((zone) => {
      const zStartX = xLeft + (zone.startMm / totalSpanMm) * spanUnits;
      const zEndX = xLeft + (zone.endMm / totalSpanMm) * spanUnits;

      // Vertical zone boundaries
      b.line(LAYER_LINK.name, zStartX, yBotBar, zStartX, yTopBar);
      b.line(LAYER_LINK.name, zEndX, yBotBar, zEndX, yTopBar);

      // Representative stirrup lines across beam elevation
      const step = Math.max(zone.spacing * S, 180);
      for (let sx = zStartX + step; sx < zEndX - step * 0.4; sx += step) {
        b.line(LAYER_LINK.name, sx, yBotBar, sx, yTopBar);
      }
    });

    // -----------------------------------------------------------------------
    // 6. Stirrup Zone Callouts & Dimensions Below
    // -----------------------------------------------------------------------
    const MIN_TEXT_W = 1200;
    const MIN_DIM_W = 800;

    if (zones.length >= 3) {
      // Left Confinement Zone
      const z0Len = Math.round(zones[0].endMm - zones[0].startMm);
      const z0W = z0Len * S;
      const z0Cx = xLeft + z0W / 2;
      const z0Dia = zones[0].stirrupDia || design.stirrups.dia || 8;
      if (z0W >= MIN_TEXT_W) {
        b.text(LAYER_SCHEDULE_TEXT.name, z0Cx, yBot - 850, `${z0Dia}mm@${zones[0].spacing}mm c/c`, TEXT_H.CALLOUT, { anchor: 'middle', bold: true });
      } else if (z0W >= 500) {
        b.text(LAYER_SCHEDULE_TEXT.name, z0Cx, yBot - 850, `${z0Dia}@${zones[0].spacing}`, TEXT_H.CALLOUT - 40, { anchor: 'middle', bold: true });
      }
      if (z0W >= MIN_DIM_W) {
        b.dimHorizontal(xLeft, xLeft + z0W, yBot - 1200, z0Len, { textHeight: TEXT_H.DIM + 20 });
      }

      // Midspan Zone
      const z1Cx = cx;
      const z1Dia = zones[1].stirrupDia || design.stirrups.dia || 8;
      const z1Len = Math.round(zones[1].endMm - zones[1].startMm);
      const z1W = z1Len * S;
      if (z1W >= MIN_TEXT_W) {
        b.text(LAYER_SCHEDULE_TEXT.name, z1Cx, yBot - 850, `${z1Dia}mm@${zones[1].spacing}mm c/c`, TEXT_H.CALLOUT, { anchor: 'middle', bold: true });
      } else if (z1W >= 500) {
        b.text(LAYER_SCHEDULE_TEXT.name, z1Cx, yBot - 850, `${z1Dia}@${zones[1].spacing}`, TEXT_H.CALLOUT - 40, { anchor: 'middle', bold: true });
      }
      if (z1W >= MIN_DIM_W) {
        b.dimHorizontal(xLeft + z0W, xRight - Math.round(zones[2].endMm - zones[2].startMm) * S, yBot - 1200, z1Len, { textHeight: TEXT_H.DIM + 20 });
      }

      // Right Confinement Zone
      const z2Len = Math.round(zones[2].endMm - zones[2].startMm);
      const z2W = z2Len * S;
      const z2Cx = xRight - z2W / 2;
      const z2Dia = zones[2].stirrupDia || design.stirrups.dia || 8;
      if (z2W >= MIN_TEXT_W) {
        b.text(LAYER_SCHEDULE_TEXT.name, z2Cx, yBot - 850, `${z2Dia}mm@${zones[2].spacing}mm c/c`, TEXT_H.CALLOUT, { anchor: 'middle', bold: true });
      } else if (z2W >= 500) {
        b.text(LAYER_SCHEDULE_TEXT.name, z2Cx, yBot - 850, `${z2Dia}@${zones[2].spacing}`, TEXT_H.CALLOUT - 40, { anchor: 'middle', bold: true });
      }
      if (z2W >= MIN_DIM_W) {
        b.dimHorizontal(xRight - z2W, xRight, yBot - 1200, z2Len, { textHeight: TEXT_H.DIM + 20 });
      }
    } else {
      // Uniform zone
      const dia = zones[0].stirrupDia || design.stirrups.dia || 8;
      const fullW = spanUnits;
      if (fullW >= MIN_TEXT_W) {
        b.text(LAYER_SCHEDULE_TEXT.name, cx, yBot - 850, `${dia}mm@${zones[0].spacing}mm c/c`, TEXT_H.CALLOUT, { anchor: 'middle', bold: true });
      } else if (fullW >= 500) {
        b.text(LAYER_SCHEDULE_TEXT.name, cx, yBot - 850, `${dia}@${zones[0].spacing}`, TEXT_H.CALLOUT - 40, { anchor: 'middle', bold: true });
      }
    }

    // Schedule location reference and subtle separator line
    b.text(LAYER_SCHEDULE_TEXT.name, cx, yBot - 1420, zones[0].label, TEXT_H.CALLOUT * 0.85, {
      anchor: 'middle',
    });
    b.line(LAYER_SCHEDULE_BORDER.name, cx - 1100, yBot - 1580, cx + 1100, yBot - 1580);

    // General text layer callout for stirrup specification
    b.text(
      LAYER_TEXT.name,
      cx,
      yTop + 200,
      `ST  ${design.stirrups.legs}L-T${design.stirrups.dia}`,
      TEXT_H.CALLOUT,
      { anchor: 'middle' }
    );

    // -----------------------------------------------------------------------
    // 7. Top Dimensions: Clear span & column width
    // -----------------------------------------------------------------------
    b.dimHorizontal(xLeft, xRight, yTop + 1400, totalSpanMm, { textHeight: TEXT_H.CALLOUT });

    // -----------------------------------------------------------------------
    // 8. Beam Title & Scale Note Below (in cyan / Labels layer)
    // -----------------------------------------------------------------------
    b.text(LAYER_LABELS.name, cx, yBot - 1850, `${design.mark}:${design.b}x${design.D}`, TEXT_H.LABEL, {
      anchor: 'middle',
      bold: true,
      underline: true,
    });
    b.text(LAYER_TEXT_SCALE.name, cx, yBot - 2350, '(SCALE: H - 1:50 / V - 1:50)', TEXT_H.CALLOUT, {
      anchor: 'middle',
    });
    b.text(LAYER_TEXT.name, cx, yBot - 2800, '(SCALE 1:25)', TEXT_H.CALLOUT, {
      anchor: 'middle',
    });

    // 9. Scaled cross-section detail (4x, 1:25) placed below the elevation title
    const secW = design.b * SECTION_SCALE;
    const secH = design.D * SECTION_SCALE;
    const secX0 = cx - secW / 2;
    const secY0 = yBot - 3300 - secH;
    this.drawSection(b, design, secX0, secY0, secW, secH);
  }

  /** Helper to resolve column or beam support details at start/end of beam. */
  public static resolveSupport(
    level: FloorPlanLevel,
    beam: FloorBeamInfo,
    which: 'start' | 'end'
  ): BeamSupportDetail {
    const nodeId = which === 'start' ? beam.startNodeId : beam.endNodeId;
    const pt = which === 'start' ? { x: beam.startX, z: beam.startZ } : { x: beam.endX, z: beam.endZ };

    // 1. Column at node or within 250mm
    const col = (level.columns || []).find(
      (c) => c.nodeId === nodeId || Math.hypot(c.x - pt.x, c.z - pt.z) < 0.25
    );
    if (col) {
      const colW = Math.round((col.width || 0.4) * 1000) || 400;
      const colD = Math.round((col.depth || col.width || 0.4) * 1000) || 400;
      const grid = this.findGridLabel(level, beam.memberId, which) || (which === 'start' ? 'A' : 'B');
      return {
        type: 'COLUMN',
        label: col.label || `C${col.columnSlNo || 1}`,
        widthMm: colW,
        depthMm: colD,
        gridLabel: grid,
      };
    }

    // 2. Intersecting / supporting beam at node
    const otherBm = (level.beams || []).find(
      (b) =>
        b.memberId !== beam.memberId &&
        (b.startNodeId === nodeId ||
          b.endNodeId === nodeId ||
          Math.hypot(b.startX - pt.x, b.startZ - pt.z) < 0.25 ||
          Math.hypot(b.endX - pt.x, b.endZ - pt.z) < 0.25)
    );
    if (otherBm) {
      const bmW = Math.round((otherBm.width || 0.25) * 1000) || 250;
      const bmD = Math.round((otherBm.depth || 0.45) * 1000) || 450;
      const grid = this.findGridLabel(level, beam.memberId, which) || (which === 'start' ? 'A' : 'B');
      return {
        type: 'BEAM',
        label: otherBm.label || `B${otherBm.memberId}`,
        widthMm: bmW,
        depthMm: bmD,
        gridLabel: grid,
      };
    }

    // 3. Fallback support so longitudinal elevation always has valid supports
    const grid = this.findGridLabel(level, beam.memberId, which) || (which === 'start' ? 'A' : 'B');
    return {
      type: 'COLUMN',
      label: which === 'start' ? 'C1' : 'C2',
      widthMm: 400,
      depthMm: 400,
      gridLabel: grid,
    };
  }

  /** Draws AutoCAD-style centerline with long dashes and dots. */
  private static drawCenterLine(b: SheetBuilder, x: number, y1: number, y2: number) {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const dash = 260;
    const gap = 80;
    const dot = 40;
    let y = minY;
    while (y < maxY) {
      const nextY = Math.min(y + dash, maxY);
      b.line(LAYER_GRID.name, x, y, x, nextY);
      y = nextY + gap;
      if (y + dot <= maxY) {
        b.line(LAYER_GRID.name, x, y, x, y + dot);
        y += dot + gap;
      } else {
        break;
      }
    }
  }

  /** Draws engineering zigzag breaklines across columns. */
  private static drawBreakline(b: SheetBuilder, x1: number, x2: number, y: number) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const w = maxX - minX;
    b.poly(
      LAYER_CONCRETE.name,
      [
        [minX, y],
        [minX + w * 0.35, y],
        [minX + w * 0.42, y + 60],
        [minX + w * 0.58, y - 60],
        [minX + w * 0.65, y],
        [maxX, y],
      ],
      false
    );
  }

  /** Scaled cross-section helper (preserved for optional cross-section details). */
  public static drawSection(
    b: SheetBuilder,
    design: BeamSectionDesign,
    x0: number,
    y0: number,
    w: number,
    h: number
  ) {
    const S = SECTION_SCALE;
    const cov = BEAM_COVER;
    const linkDia = design.stirrups.dia;

    // Concrete outline + link (stirrup) rectangle
    b.rect(LAYER_CONCRETE.name, x0, y0, w, h);
    const linkInset = cov * S;
    b.rect(LAYER_LINK.name, x0 + linkInset, y0 + linkInset, w - 2 * linkInset, h - 2 * linkInset);

    // Bar layout
    const topBars = design.top.through.count + (design.top.extra?.count || 0);
    const botBars = design.bottom.through.count + (design.bottom.extra?.count || 0);
    const topDia = Math.max(design.top.through.dia, design.top.extra?.dia || 0);
    const botDia = Math.max(design.bottom.through.dia, design.bottom.extra?.dia || 0);

    const insetFor = (dia: number) => (cov + linkDia + dia / 2) * S;
    const topY = y0 + h - insetFor(topDia);
    const botY = y0 + insetFor(botDia);

    const spread = (count: number, y: number, dia: number) => {
      const lx = x0 + insetFor(dia);
      const rx = x0 + w - insetFor(dia);
      const r = (dia * S) / 2;
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        b.circle(LAYER_REBAR.name, lx + (rx - lx) * t, y, r);
      }
    };

    spread(topBars, topY, topDia);
    spread(botBars, botY, botDia);

    // Side face reinforcement
    if (design.sideFace) {
      const r = (design.sideFace.dia * S) / 2;
      const sx = insetFor(design.sideFace.dia);
      for (let i = 0; i < design.sideFace.count; i++) {
        const t = design.sideFace.count === 1 ? 0.5 : i / (design.sideFace.count - 1);
        const y = y0 + h * 0.28 + t * h * 0.44;
        b.circle(LAYER_REBAR.name, x0 + sx, y, r);
        b.circle(LAYER_REBAR.name, x0 + w - sx, y, r);
      }
    }

    // Bar callouts
    const topCallout = design.top.extra
      ? `${design.top.through.callout} + ${design.top.extra.callout}`
      : design.top.through.callout;
    const botCallout = design.bottom.extra
      ? `${design.bottom.through.callout} + ${design.bottom.extra.callout}`
      : design.bottom.through.callout;

    b.text(LAYER_TEXT.name, x0 + w + 500, topY + 320, topCallout, TEXT_H.CALLOUT, { anchor: 'start' });
    b.text(LAYER_TEXT.name, x0 + w + 500, botY + 320, botCallout, TEXT_H.CALLOUT, { anchor: 'start' });
    b.leader(LAYER_TEXT.name, x0 + w + 450, topY + 220, x0 + w * 0.55, topY, { h: TEXT_H.CALLOUT });
    b.leader(LAYER_TEXT.name, x0 + w + 450, botY + 220, x0 + w * 0.55, botY, { h: TEXT_H.CALLOUT });

    b.text(
      LAYER_TEXT.name,
      x0 + w / 2,
      y0 + h / 2 + 200,
      `ST  ${design.stirrups.legs}L-T${linkDia}`,
      TEXT_H.CALLOUT,
      { anchor: 'middle' }
    );

    b.dimHorizontal(x0, x0 + w, y0 - 700, design.b, { textHeight: TEXT_H.CALLOUT });
    b.dimVertical(y0, y0 + h, x0 - 700, design.D, { textHeight: TEXT_H.CALLOUT, side: 'left' });
  }

  private static findSupport(level: FloorPlanLevel, memberId: number, which: 'start' | 'end'): string | null {
    const beam = level.beams.find((bm) => bm.memberId === memberId);
    if (!beam) return null;
    const nodeId = which === 'start' ? beam.startNodeId : beam.endNodeId;
    const column = level.columns.find((c) => c.nodeId === nodeId);
    return column?.label || null;
  }

  private static findGridLabel(level: FloorPlanLevel, memberId: number, which: 'start' | 'end'): string | null {
    const beam = level.beams.find((bm) => bm.memberId === memberId);
    if (!beam) return null;
    const x = which === 'start' ? beam.startX : beam.endX;
    const lines = level.gridLinesX || [];
    if (lines.length === 0) return null;
    let best = lines[0];
    let bestDist = Math.abs(lines[0].coord - x);
    lines.forEach((g) => {
      const d = Math.abs(g.coord - x);
      if (d < bestDist) {
        bestDist = d;
        best = g;
      }
    });
    const raw = best.label || best.id || null;
    if (!raw) return null;
    // Strip "GRID" prefix — show just the label (e.g. "A", "1", "B")
    return raw.replace(/^GRID\s*/i, '');
  }
}
