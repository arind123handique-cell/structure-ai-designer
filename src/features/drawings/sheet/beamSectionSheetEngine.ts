/**
 * Beam reinforcement cross-section sheet engine.
 *
 * Reproduces the layout and annotation of the source AutoCAD drawing
 * `beam 1st floor cross section.dxf` (see DXF_DRAWING_ANALYSIS.md):
 *
 *   - one scaled cross-section per beam, laid out in rows and packed left to right;
 *   - rows stack downwards, B1 at the top and the highest mark at the bottom;
 *   - row pitch 25,200 model units, cell width 8,950;
 *   - sections drawn at 4x true size so they print at 1:25 on a 1:100 sheet;
 *   - zone / stirrup strips drawn at 2x true size so they print at 1:50;
 *   - annotation vocabulary: `B1:230x450`, `3-T16`, `ST  2L-T8`, `SFR 1-T10EF`,
 *     `B8 (LOC: 0 TO 1030)`, `12-2L-T8` + `@95 C/C`, `(SCALE 1:25)`,
 *     `(SCALE: H = 1:50  / V = 1:50)`.
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
  SECTION_SCALE,
  STRIP_SCALE,
  SheetBuilder,
  TEXT_H,
} from './drawingSheet';

// ---------------------------------------------------------------------------
// Layout constants — measured from the source drawing
// ---------------------------------------------------------------------------

/** Vertical pitch between detail rows (measured from the source sheet). */
export const ROW_PITCH = 25200;
/** Widest zone strip drawn under a detail, in model units. */
export const MAX_STRIP_WIDTH = 8250;
/** Room either side of the strip for grid bubbles, support marks and dimensions. */
const CELL_MARGIN = 4400;
const MIN_CELL_WIDTH = 6200;
/** Aspect ratio (width / height) the finished sheet aims for. */
const TARGET_ASPECT = 1.4;

/** Zone strip width for a beam, drawn at 1:50 and capped to the sheet width. */
export const stripWidthFor = (spanM: number): number =>
  Math.min(Math.abs(spanM || 0) * 1000 * STRIP_SCALE, MAX_STRIP_WIDTH);

/** Cell width needed by a detail: its strip plus margins. */
export const cellWidthFor = (spanM: number): number =>
  Math.max(MIN_CELL_WIDTH, stripWidthFor(spanM) + CELL_MARGIN);

/**
 * Chooses how many details go across a row so the finished sheet is close to a
 * landscape A-series proportion. The source sheet packs 1-5 details per row,
 * with the row width set by the widest schedule strip in that row.
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
/** Distance from the row datum up to the underside of each section detail. */
const SECTION_BASE_OFFSET = 4600;

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

export interface BeamSectionDesign {
  memberId: number;
  mark: string;
  b: number;
  D: number;
  spanM: number;
  top: { through: RebarLine; extra?: RebarLine };
  bottom: { through: RebarLine; extra?: RebarLine };
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

/** Round down to the nearest 25 mm, as used for practical stirrup spacings. */
const round25 = (mm: number) => Math.max(50, Math.floor(mm / 25) * 25);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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

    // B1 lowest mark first: the source sheet stacks B1 at the top.
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
    let sideFace: RebarLine | undefined;
    let stirrupDia: number;
    let stirrupCount: number;
    let spacingSupport: number;
    let spacingMid: number;
    let source: 'SAVED' | 'LIVE';
    // Ductility + curtailment data used to place the stirrup zones.
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
      spacingSupport = round25(
        Math.min(spacingProv, duct.confinementHoopSpacingMax || spacingProv)
      );
      spacingMid = round25(Math.min(spacingProv, duct.midSpanHoopSpacingMax || spacingProv));
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
   * support / mid-span / support split seen on the source sheet; otherwise it
   * is a single uniform zone.
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
      // confinement zone is 2d long; fall back to 0.18L when d is unknown
      supZone = Math.round(ctx.effectiveDepth ? 2 * ctx.effectiveDepth : L * 0.18);
    }
    // A saved explicit cut-off length wins when it is the longer of the two.
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

  public static buildSheet(input: BeamSectionSheetInput): DrawingSheet {
    const { level } = input;
    const designs = this.extractLevelBeams(input);
    const builder = new SheetBuilder(BEAM_SECTION_SHEET_LAYERS);
    const sheetNumber = `STR-${200 + (level.levelIndex || 0)}`;

    const columns = detailsPerRow(designs.map((d) => cellWidthFor(d.spanM)));
    for (let rowIdx = 0; rowIdx * columns < designs.length; rowIdx++) {
      const rowDesigns = designs.slice(rowIdx * columns, (rowIdx + 1) * columns);
      let cursorX = 0;
      rowDesigns.forEach((design) => {
        const cellW = cellWidthFor(design.spanM);
        this.drawDetail(builder, design, cursorX, cellW, -rowIdx * ROW_PITCH, level);
        cursorX += cellW;
      });
    }

    return builder.build({
      sheetNumber,
      title: 'BEAM REINFORCEMENT CROSS-SECTIONS & STIRRUP ZONE SCHEDULE',
      subtitle: `${designs.length} beam sections · ${columns} per row · IS 456 / IS 13920 detailing`,
      levelName: level.levelName,
      notes: ['(SCALE 1:25)', '(SCALE: H = 1:50  / V = 1:50)', 'All dimensions in mm'],
    });
  }

  private static drawDetail(
    b: SheetBuilder,
    design: BeamSectionDesign,
    cellX: number,
    cellW: number,
    rowBaseY: number,
    level: FloorPlanLevel
  ) {
    const cx = cellX + cellW / 2;
    const w = design.b * SECTION_SCALE;
    const h = design.D * SECTION_SCALE;
    const x0 = cx - w / 2;
    const y0 = rowBaseY + SECTION_BASE_OFFSET;

    this.drawSection(b, design, x0, y0, w, h);

    // Beam size label + per-detail scale note (the source writes both).
    // Vertical order: section, width dim, size label, scale notes.
    b.text(LAYER_LABELS.name, cx, y0 - 1900, `${design.mark}:${design.b}x${design.D}`, TEXT_H.LABEL, {
      anchor: 'middle',
      underline: true,
      bold: true,
    });
    b.text(LAYER_TEXT_SCALE.name, cx, y0 - 2600, '(SCALE 1:25)', TEXT_H.CALLOUT, { anchor: 'middle' });
    b.text(
      LAYER_TEXT_SCALE.name,
      cx,
      y0 - 3200,
      '(SCALE: H = 1:50  / V = 1:50)',
      TEXT_H.CALLOUT,
      { anchor: 'middle' }
    );

    this.drawZoneStrip(b, design, cellX, cellW, y0 + h + 4300, level);
  }

  /** The scaled cross-section with bars, link, callouts and dimensions. */
  private static drawSection(
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

    // Side face reinforcement (skin steel) on both faces
    if (design.sideFace) {
      const r = (design.sideFace.dia * S) / 2;
      const midY = y0 + h / 2;
      const sx = insetFor(design.sideFace.dia);
      for (let i = 0; i < design.sideFace.count; i++) {
        const t = design.sideFace.count === 1 ? 0.5 : i / (design.sideFace.count - 1);
        const y = y0 + h * 0.28 + t * h * 0.44;
        b.circle(LAYER_REBAR.name, x0 + sx, y, r);
        b.circle(LAYER_REBAR.name, x0 + w - sx, y, r);
      }
    }

    // Bar callouts (exact source vocabulary)
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

    // Stirrup callout — note the two spaces after ST in the source drawings
    b.text(
      LAYER_TEXT.name,
      x0 + w / 2,
      y0 + h / 2 + 200,
      `ST  ${design.stirrups.legs}L-T${linkDia}`,
      TEXT_H.CALLOUT,
      { anchor: 'middle' }
    );

    if (design.sideFace) {
      b.text(LAYER_TEXT.name, x0 + w / 2, y0 + h / 2 - 700, design.sideFace.callout, TEXT_H.CALLOUT, {
        anchor: 'middle',
      });
    }

    // Section dimensions: width below the outline, depth on the left so the
    // right-hand side stays clear for the bar callouts and their leaders.
    b.dimHorizontal(x0, x0 + w, y0 - 700, design.b, { textHeight: TEXT_H.CALLOUT });
    b.dimVertical(y0, y0 + h, x0 - 700, design.D, { textHeight: TEXT_H.CALLOUT, side: 'left' });
  }

  /** The zone / stirrup strip table, drawn at 1:50 like the source sheet. */
  private static drawZoneStrip(
    b: SheetBuilder,
    design: BeamSectionDesign,
    cellX: number,
    cellW: number,
    stripBottomY: number,
    level: FloorPlanLevel
  ) {
    const stripW = stripWidthFor(design.spanM);
    const stripX = cellX + (cellW - stripW) / 2;
    const total = design.zones.reduce((s, z) => s + (z.endMm - z.startMm), 0) || 1;

    const labelBandH = 900;
    const cellBandH = 1500;
    const dimBandH = 1100;

    const tableTop = stripBottomY + dimBandH + cellBandH + labelBandH;

    // Outer border for the whole strip table
    b.rect(LAYER_SCHEDULE_BORDER.name, stripX, stripBottomY, stripW, labelBandH + cellBandH + dimBandH);

    let cursor = stripX;
    design.zones.forEach((zone) => {
      const zoneW = (stripW * (zone.endMm - zone.startMm)) / total;
      const zoneCx = cursor + zoneW / 2;

      // Zone cut-off positions strip
      b.text(LAYER_SCHEDULE_TEXT.name, zoneCx, tableTop - 330, zone.label, TEXT_H.CALLOUT, {
        anchor: 'middle',
      });

      // Stirrup callout cell: `<n>-2L-T<dia>` over `@<spacing> C/C`
      b.line(LAYER_SCHEDULE_LINE.name, cursor, stripBottomY + dimBandH, cursor, tableTop);
      b.text(
        LAYER_SCHEDULE_TEXT.name,
        zoneCx,
        stripBottomY + dimBandH + cellBandH * 0.55,
        `${zone.stirrupCount}-${design.stirrups.legs}L-T${zone.stirrupDia}`,
        TEXT_H.CALLOUT,
        { anchor: 'middle', bold: true }
      );
      b.text(
        LAYER_SCHEDULE_TEXT.name,
        zoneCx,
        stripBottomY + dimBandH + cellBandH * 0.16,
        `@${zone.spacing} C/C`,
        TEXT_H.CALLOUT,
        { anchor: 'middle' }
      );

      // Bar length dimension for the zone
      b.dimHorizontal(cursor, cursor + zoneW, stripBottomY + 320, Math.round(zone.endMm - zone.startMm), {
        textHeight: TEXT_H.CALLOUT,
      });

      cursor += zoneW;
    });
    b.line(LAYER_SCHEDULE_LINE.name, cursor, stripBottomY + dimBandH, cursor, tableTop);
    b.line(
      LAYER_SCHEDULE_LINE.name,
      stripX,
      stripBottomY + dimBandH,
      stripX + stripW,
      stripBottomY + dimBandH
    );

    // Support marks at each end (the source sheet's Labels_Support layer)
    const startsAt = this.findSupport(level, design.memberId, 'start');
    const endsAt = this.findSupport(level, design.memberId, 'end');
    if (startsAt) {
      b.text(LAYER_LABELS_SUPPORT.name, stripX - 300, stripBottomY + 3000, startsAt, TEXT_H.GRID, {
        anchor: 'end',
      });
    }
    if (endsAt) {
      b.text(LAYER_LABELS_SUPPORT.name, stripX + stripW + 300, stripBottomY + 3000, endsAt, TEXT_H.GRID, {
        anchor: 'start',
      });
    }

    // Grid references with bubbles at the strip ends
    const gridStart = this.findGridLabel(level, design.memberId, 'start');
    const gridEnd = this.findGridLabel(level, design.memberId, 'end');
    const bubbleR = TEXT_H.GRID_BUBBLE * 0.75;
    if (gridStart) {
      const gx = stripX - 1400;
      const gy = stripBottomY;
      b.circle(LAYER_GRID.name, gx, gy, bubbleR);
      b.text(LAYER_GRID.name, gx, gy + TEXT_H.GRID * 0.35, gridStart, TEXT_H.GRID, { anchor: 'middle' });
    }
    if (gridEnd) {
      const gx = stripX + stripW + 1400;
      const gy = stripBottomY;
      b.circle(LAYER_GRID.name, gx, gy, bubbleR);
      b.text(LAYER_GRID.name, gx, gy + TEXT_H.GRID * 0.35, gridEnd, TEXT_H.GRID, {
        anchor: 'middle',
      });
    }
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
    return best.label || best.id || null;
  }
}
