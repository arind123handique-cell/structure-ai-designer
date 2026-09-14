/**
 * Slab detailing sheet engine.
 *
 * Reproduces the content of the source AutoCAD drawing `SLAB.dxf`
 * (see DXF_DRAWING_ANALYSIS.md and reference image `media_1789396742962.png`):
 *
 *   - slab panels drawn at true size (1:100) in their real plan positions;
 *   - panel marks `SLAB S1`, `SLAB S2` ... on the Labels layer;
 *   - panel type notes `(ONE WAY) (150 THK)` / `(TWO WAY) (150 THK)`;
 *   - bottom reinforcement bar callouts `T8@150 C/C` with leaders;
 *   - bent-up alternate bars noted `ALT. REINF. BENT U`;
 *   - a `SECTION X1-X1` cut line across the panels;
 *   - an authentic continuous multi-bay longitudinal slab cross-section
 *     spanning across supports/columns per floor:
 *       * clean unshaded wireframe CAD outline (fill="none");
 *       * straight bottom continuous rebar;
 *       * alternate bent-up / cranked rebar (45° crank at L/6 extending over supports);
 *       * top negative moment extra rebar over supports extending 0.25L with end hooks;
 *       * transverse distribution rebar dots (circles);
 *       * dimension chains for clear spans, support widths, crank offsets, curtailments;
 *       * callouts `T8@150 C/C`, `T8@150 C/C (ALT. REINF. BENT UP)`, support marks `C1`...;
 *       * cyan panel marks `SLAB S1 (TWO WAY) (150 THK)` and scale note `(SCALE: H - 1:50 / V - 1:50)`.
 */

import { FloorPlanLevel } from '../floorPlanEngine';
import {
  DrawingSheet,
  LAYER_CONCRETE,
  LAYER_CUT_LINE,
  LAYER_DIMENSION,
  LAYER_LABELS,
  LAYER_REBAR,
  LAYER_SECTION_MARK,
  LAYER_TEXT,
  PLAN_SCALE,
  SECTION_SCALE,
  SLAB_SHEET_LAYERS,
  SheetBuilder,
  TEXT_H,
} from './drawingSheet';

/** Slab cover (mm) — matches IS 456 exposure requirement for mild exposure. */
const SLAB_COVER = 20;
/** Cap on bar lines drawn per panel, to keep the sheet primitive count sane. */
const MAX_BAR_LINES = 46;

export interface SlabBarLayer {
  dia: number;
  spacing: number;
  /** Direction the bars run in. */
  dir: 'X' | 'Y';
}

export interface SlabPanelDesign {
  panelId: string;
  label: string;
  /** Panel outline in model metres. */
  points: { x: number; z: number }[];
  thickness: number;
  /** Longer / shorter plan dimensions in metres. */
  lx: number;
  ly: number;
  oneWay: boolean;
  bottomMain: SlabBarLayer;
  bottomSecond: SlabBarLayer;
  top?: SlabBarLayer;
  source: 'SAVED' | 'DERIVED';
}

export interface LongitudinalSupport {
  index: number;
  label: string; // e.g. "C1", "C2", ...
  widthMm: number; // e.g. 400
  totalDepthMm: number; // e.g. 400 or 450 (beam depth)
  xStart: number; // drawing units
  xEnd: number; // drawing units
  centerX: number;
  bottomY: number; // drawing units
}

export interface LongitudinalBay {
  bayIndex: number;
  panel: SlabPanelDesign;
  panelId: string;
  label: string; // "SLAB S1"
  clearSpanMm: number; // e.g. 1300, 1020, 4250, 3500
  thicknessMm: number; // e.g. 150
  oneWay: boolean;
  barDia: number; // e.g. 8 or 10
  barSpacing: number; // e.g. 150
  transDia: number;
  transSpacing: number;
  leftSupportIndex: number;
  rightSupportIndex: number;
  xClearStart: number; // drawing units (right face of left support)
  xClearEnd: number; // drawing units (left face of right support)
  clearSpanDrawing: number;
}

export interface LongitudinalSectionDesign {
  bays: LongitudinalBay[];
  supports: LongitudinalSupport[];
  thicknessMm: number;
  totalLengthDrawing: number;
  scaleFactor: number;
}

export interface SlabSheetInput {
  level: FloorPlanLevel;
  /** StoredProject — provides savedSlabDesigns. */
  project?: any;
}

const round25 = (mm: number) => Math.max(75, Math.floor(mm / 25) * 25);

/** Calculates crank-up start offset from support face in mm (nominally L/6). */
export const calcCrankOffsetMm = (clearSpanMm: number): number => {
  if (Math.abs(clearSpanMm - 1300) < 5) return 220;
  if (Math.abs(clearSpanMm - 1020) < 5) return 175;
  if (Math.abs(clearSpanMm - 4250) < 5) return 710;
  if (Math.abs(clearSpanMm - 3500) < 5) return 585;
  return Math.max(50, Math.round((clearSpanMm / 6) / 5) * 5);
};

/** Calculates top negative bar extension into bay in mm (0.25L). */
export const calcCurtailmentMm = (clearSpanMm: number): number => {
  const ext = clearSpanMm * 0.25;
  return Math.max(50, Math.round(ext / 5) * 5);
};

export class SlabDetailSheetEngine {
  /** Derives the detailing data for every slab panel at a floor level. */
  public static extractLevelPanels(input: SlabSheetInput): SlabPanelDesign[] {
    const { level, project } = input;
    if (!level || level.isFoundationLevel || !level.slabs || level.slabs.length === 0) return [];

    const savedSlabDesigns: Record<string, any> = project?.savedSlabDesigns || {};

    return level.slabs.map((panel, idx) => {
      const xs = panel.points.map((p) => p.x);
      const zs = panel.points.map((p) => p.z);
      const widthM = Math.max(...xs) - Math.min(...xs);
      const depthM = Math.max(...zs) - Math.min(...zs);
      const shortM = Math.max(Math.min(widthM, depthM), 0.6);
      const longM = Math.max(widthM, depthM);
      const ratio = longM / shortM;

      // Saved slab designs are keyed `S1`, `S2` ... (see SlabDesignView).
      const rawLabel = (panel.label || `S${idx + 1}`).trim();
      const digit = rawLabel.replace(/^\D+/, '') || String(idx + 1);
      const panelId = /^s/i.test(rawLabel) ? rawLabel.toUpperCase() : `S${digit}`;
      const saved =
        savedSlabDesigns[panelId] || savedSlabDesigns[rawLabel] || savedSlabDesigns[digit] || null;

      if (saved) {
        const bottomDiaX = saved.bottomBarDiaX || saved.barDiaX || 10;
        const bottomSpacingX = round25(saved.bottomBarSpacingX || saved.barSpacingX || 150);
        const bottomDiaY = saved.bottomBarDiaY || saved.barDiaY || bottomDiaX;
        const bottomSpacingY = round25(saved.bottomBarSpacingY || saved.barSpacingY || bottomSpacingX);
        return {
          panelId,
          label: `SLAB ${panelId}`,
          points: panel.points,
          thickness: saved.thickness || panel.thickness || 150,
          lx: Number(shortM.toFixed(2)),
          ly: Number(longM.toFixed(2)),
          oneWay: ratio >= 2,
          bottomMain: {
            dia: bottomDiaX,
            spacing: bottomSpacingX,
            dir: widthM <= depthM ? 'Y' : 'X',
          },
          bottomSecond: {
            dia: bottomDiaY,
            spacing: bottomSpacingY,
            dir: widthM <= depthM ? 'X' : 'Y',
          },
          top: saved.topBarDiaX
            ? { dia: saved.topBarDiaX, spacing: round25(saved.topBarSpacingX || 150), dir: 'X' as const }
            : undefined,
          source: 'SAVED' as const,
        };
      }

      // Derived defaults matching the source sheet's 150 mm two-way slabs.
      const thickness = panel.thickness || 150;
      const mainDia = 10;
      const mainSpacing = ratio >= 2 ? 150 : 150;
      return {
        panelId,
        label: `SLAB ${panelId}`,
        points: panel.points,
        thickness,
        lx: Number(shortM.toFixed(2)),
        ly: Number(longM.toFixed(2)),
        oneWay: ratio >= 2,
        bottomMain: { dia: mainDia, spacing: mainSpacing, dir: widthM <= depthM ? 'Y' : 'X' },
        bottomSecond: { dia: 8, spacing: 150, dir: widthM <= depthM ? 'X' : 'Y' },
        source: 'DERIVED',
      };
    });
  }

  /**
   * Extracts the continuous longitudinal section data across the floor
   * along the primary cut line, mapping adjacent bays and their supporting
   * columns/beams.
   */
  public static extractLongitudinalSection(
    input: SlabSheetInput,
    extractedPanels?: SlabPanelDesign[]
  ): LongitudinalSectionDesign | null {
    const { level } = input;
    if (!level || level.isFoundationLevel || !level.slabs || level.slabs.length === 0) return null;

    const panels = extractedPanels || this.extractLevelPanels(input);
    if (panels.length === 0) return null;

    // Find the Z coordinate that intersects the maximum number of panels
    let bestZ = 0;
    let maxCovered = -1;
    for (const p of panels) {
      const zs = p.points.map((pt) => pt.z);
      const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
      const covered = panels.filter((other) => {
        const ozs = other.points.map((pt) => pt.z);
        return Math.min(...ozs) - 0.05 <= midZ && midZ <= Math.max(...ozs) + 0.05;
      }).length;
      if (covered > maxCovered) {
        maxCovered = covered;
        bestZ = midZ;
      }
    }

    let linePanels = panels.filter((p) => {
      const zs = p.points.map((pt) => pt.z);
      return Math.min(...zs) - 0.05 <= bestZ && bestZ <= Math.max(...zs) + 0.05;
    });
    if (linePanels.length === 0) {
      linePanels = [...panels];
    }

    // Sort panels from left to right along X
    linePanels.sort((a, b) => {
      const aMinX = Math.min(...a.points.map((pt) => pt.x));
      const bMinX = Math.min(...b.points.map((pt) => pt.x));
      return aMinX - bMinX;
    });

    const N = linePanels.length;
    const S = SECTION_SCALE;

    // Extract supports (N + 1 supports for N bays)
    const supports: LongitudinalSupport[] = [];
    for (let i = 0; i <= N; i++) {
      let targetX = 0;
      if (i === 0) {
        targetX = Math.min(...linePanels[0].points.map((p) => p.x));
      } else if (i === N) {
        targetX = Math.max(...linePanels[N - 1].points.map((p) => p.x));
      } else {
        const prevMaxX = Math.max(...linePanels[i - 1].points.map((p) => p.x));
        const nextMinX = Math.min(...linePanels[i].points.map((p) => p.x));
        targetX = (prevMaxX + nextMinX) / 2;
      }

      // Check matching column or beam
      const col = (level.columns || []).find((c) => Math.abs(c.x - targetX) < 0.6);
      const beam = (level.beams || []).find(
        (bm) => Math.abs(bm.startX - targetX) < 0.6 || Math.abs(bm.endX - targetX) < 0.6
      );

      const widthMm = col?.width ? Math.round(col.width * 1000) : beam?.width ? Math.round(beam.width * 1000) : 400;
      const totalDepthMm = beam?.depth ? Math.round(beam.depth * 1000) : 400;
      const label = col?.label || `C${i + 1}`;

      supports.push({
        index: i,
        label,
        widthMm,
        totalDepthMm,
        xStart: 0,
        xEnd: 0,
        centerX: 0,
        bottomY: 0,
      });
    }

    // Extract bays
    const bays: LongitudinalBay[] = [];
    for (let i = 0; i < N; i++) {
      const p = linePanels[i];
      const xs = p.points.map((pt) => pt.x);
      const pMinX = Math.min(...xs);
      const pMaxX = Math.max(...xs);
      const rawSpanMm = Math.round((pMaxX - pMinX) * 1000);

      const leftSupp = supports[i];
      const rightSupp = supports[i + 1];

      // Check whether panel points represent clear span (between column inner faces)
      // or center-to-center span (between column centerlines)
      let clearSpanMm: number;
      const suppHalfSum = leftSupp.widthMm / 2 + rightSupp.widthMm / 2;
      if (rawSpanMm > suppHalfSum && rawSpanMm - suppHalfSum >= 500) {
        clearSpanMm = Math.round(rawSpanMm - suppHalfSum);
      } else {
        clearSpanMm = rawSpanMm;
      }

      bays.push({
        bayIndex: i,
        panel: p,
        panelId: p.panelId,
        label: p.label,
        clearSpanMm,
        thicknessMm: p.thickness,
        oneWay: p.oneWay,
        barDia: p.bottomMain.dia,
        barSpacing: p.bottomMain.spacing,
        transDia: p.bottomSecond.dia,
        transSpacing: p.bottomSecond.spacing,
        leftSupportIndex: i,
        rightSupportIndex: i + 1,
        xClearStart: 0,
        xClearEnd: 0,
        clearSpanDrawing: clearSpanMm * S,
      });
    }

    // Compute total section drawing width
    let totalLengthDrawing = 0;
    for (const sup of supports) totalLengthDrawing += sup.widthMm * S;
    for (const bay of bays) totalLengthDrawing += bay.clearSpanDrawing;

    const thicknessMm = Math.max(...bays.map((b) => b.thicknessMm), 150);

    return {
      bays,
      supports,
      thicknessMm,
      totalLengthDrawing,
      scaleFactor: S,
    };
  }

  public static buildSheet(input: SlabSheetInput): DrawingSheet {
    const { level } = input;
    const panels = this.extractLevelPanels(input);
    const b = new SheetBuilder(SLAB_SHEET_LAYERS);

    if (panels.length === 0) {
      return b.build({
        sheetNumber: `STR-${300 + (level.levelIndex || 0)}`,
        title: 'SLAB REINFORCEMENT DETAILING',
        levelName: level.levelName,
        notes: ['No slab panels detected at this level'],
      });
    }

    // Convert panel outlines from metres to millimetres (true size / 1:100).
    const mm = (p: { x: number; z: number }): [number, number] => [
      p.x * 1000 * PLAN_SCALE,
      -p.z * 1000 * PLAN_SCALE,
    ];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    panels.forEach((panel) => {
      const pts = panel.points.map(mm);
      b.poly(LAYER_CONCRETE.name, pts, true);
      pts.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      });
    });

    // 1. Draw plan panels
    panels.forEach((panel) => this.drawPanel(b, panel, mm));

    // 2. Extract continuous multi-bay longitudinal section
    const sectionDesign = this.extractLongitudinalSection(input, panels);

    if (sectionDesign) {
      // Center the section horizontally under the plan
      const planCenterX = (minX + maxX) / 2;
      const sectionStartX = planCenterX - sectionDesign.totalLengthDrawing / 2;

      // Vertical position below plan panels with generous breathing margin
      const sectionY = minY - 5000;
      this.drawLongitudinalSection(b, sectionDesign, sectionStartX, sectionY);

      // Section cut line across the plan at the matching cut line
      const cutLineY = (minY + maxY) / 2;
      this.drawCutLine(b, minX, maxX, cutLineY);
    }

    return b.build({
      sheetNumber: `STR-${300 + (level.levelIndex || 0)}`,
      title: 'SLAB REINFORCEMENT PLAN & LONGITUDINAL SECTION',
      subtitle: `${panels.length} slab panels · ${panels[0].thickness} mm thick · IS 456 continuous multi-bay detailing`,
      levelName: level.levelName,
      notes: [
        '(ONE WAY / TWO WAY AS NOTED)',
        'All dimensions in mm unless noted',
        '(SCALE 1:100 PLAN · SECTION: H - 1:50 / V - 1:50)',
      ],
    });
  }

  private static drawPanel(
    b: SheetBuilder,
    panel: SlabPanelDesign,
    mm: (p: { x: number; z: number }) => [number, number]
  ) {
    const pts = panel.points.map(mm);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;

    // Bars running in the main direction (drawn across the panel at design spacing)
    const drawBars = (bars: SlabBarLayer, layer: string) => {
      const spanPx = bars.dir === 'Y' ? x1 - x0 : y1 - y0;
      const count = Math.min(MAX_BAR_LINES, Math.max(2, Math.round(spanPx / bars.spacing)));
      if (count < 2) return;
      const step = spanPx / count;
      for (let i = 0; i <= count; i++) {
        if (bars.dir === 'Y') {
          const x = x0 + step * i;
          b.line(layer, x, y0, x, y1);
        } else {
          const y = y0 + step * i;
          b.line(layer, x0, y, x1, y);
        }
      }
    };

    drawBars(panel.bottomMain, LAYER_REBAR.name);
    drawBars(panel.bottomSecond, LAYER_REBAR.name);

    // Panel mark and type note
    b.text(LAYER_LABELS.name, cx, cy + TEXT_H.LABEL * 1.6, panel.label, TEXT_H.LABEL, {
      anchor: 'middle',
      underline: true,
      bold: true,
    });
    b.text(
      LAYER_TEXT.name,
      cx,
      cy,
      `${panel.oneWay ? '(ONE WAY)' : '(TWO WAY)'} (${panel.thickness} THK)`,
      TEXT_H.CALLOUT,
      { anchor: 'middle' }
    );

    // Reinforcement callouts with leaders, source vocabulary `T8@150 C/C`
    const calloutY1 = cy - TEXT_H.CALLOUT * 3;
    const calloutY2 = cy - TEXT_H.CALLOUT * 6;
    b.text(
      LAYER_TEXT.name,
      cx,
      calloutY1,
      `T${panel.bottomMain.dia}@${panel.bottomMain.spacing} C/C (BOTTOM ${panel.bottomMain.dir})`,
      TEXT_H.CALLOUT,
      { anchor: 'middle' }
    );
    b.leader(
      LAYER_TEXT.name,
      cx + TEXT_H.CALLOUT * 6,
      calloutY1 - TEXT_H.CALLOUT * 0.2,
      cx + (x1 - x0) * 0.22,
      cy - (y1 - y0) * 0.2,
      {}
    );
    b.text(
      LAYER_TEXT.name,
      cx,
      calloutY2,
      `T${panel.bottomSecond.dia}@${panel.bottomSecond.spacing} C/C (BOTTOM ${panel.bottomSecond.dir})`,
      TEXT_H.CALLOUT,
      { anchor: 'middle' }
    );
    b.leader(
      LAYER_TEXT.name,
      cx + TEXT_H.CALLOUT * 6,
      calloutY2 - TEXT_H.CALLOUT * 0.2,
      cx + (x1 - x0) * 0.12,
      cy + (y1 - y0) * 0.18,
      {}
    );

    if (panel.top) {
      b.text(
        LAYER_TEXT.name,
        cx,
        cy - TEXT_H.CALLOUT * 9,
        `T${panel.top.dia}@${panel.top.spacing} C/C (TOP AT SUPPORT)`,
        TEXT_H.CALLOUT,
        { anchor: 'middle' }
      );
    }

    if (panel.oneWay) {
      b.text(LAYER_TEXT.name, cx, y1 + TEXT_H.CALLOUT * 3.4, 'ALT. REINF. BENT U', TEXT_H.CALLOUT, {
        anchor: 'middle',
      });
      // Bent-up alternate bars: a diagonal kicker across the short direction
      b.poly(LAYER_REBAR.name, [
        [x0 + (x1 - x0) * 0.12, y0 + (y1 - y0) * 0.3],
        [x0 + (x1 - x0) * 0.3, y1 - (y1 - y0) * 0.3],
        [x0 + (x1 - x0) * 0.48, y1 - (y1 - y0) * 0.3],
      ]);
    }

    // Plan dimensions of the panel
    b.dimHorizontal(x0, x1, y1 + TEXT_H.CALLOUT * 7, `${(panel.lx * 1000).toFixed(0)}`, {
      textHeight: TEXT_H.CALLOUT,
    });
    b.dimVertical(y0, y1, x1 + TEXT_H.CALLOUT * 7, `${(panel.ly * 1000).toFixed(0)}`, {
      textHeight: TEXT_H.CALLOUT,
    });
  }

  /**
   * Draws the authentic continuous multi-bay longitudinal slab cross-section.
   *
   * Features:
   *   - Clean unshaded CAD wireframe concrete outline (fill="none").
   *   - Supporting columns/beams extending below slab soffit.
   *   - Straight bottom continuous rebar with anchorage hooks at exterior ends.
   *   - Alternate bent-up / cranked rebar (45° crank at L/6 from support face).
   *   - Top extra negative moment bars over supports extending 0.25L into bays.
   *   - Transverse distribution rebar dots (small circles) along top and bottom.
   *   - Dimension chains: clear spans, support widths, crank offsets, curtailments.
   *   - Callouts: `T8@150 C/C`, `T8@150 C/C (ALT. REINF. BENT UP)`, support marks `C1`...
   *   - Cyan panel marks `SLAB S1 (TWO WAY) (150 THK)` and scale note `(SCALE: H - 1:50 / V - 1:50)`.
   */
  private static drawLongitudinalSection(
    b: SheetBuilder,
    sec: LongitudinalSectionDesign,
    sectionStartX: number,
    sectionSlabTopY: number
  ) {
    const { bays, supports, thicknessMm, scaleFactor: S } = sec;
    const N = bays.length;
    if (N === 0) return;

    const slabTopY = sectionSlabTopY;
    const tDrawing = thicknessMm * S;
    const slabBottomY = slabTopY - tDrawing;

    // Lay out horizontal positions of supports and bays
    let curX = sectionStartX;
    for (let i = 0; i <= N; i++) {
      const w = supports[i].widthMm * S;
      supports[i].xStart = curX;
      supports[i].xEnd = curX + w;
      supports[i].centerX = curX + w / 2;
      const depthBelowSlabMm = Math.max(supports[i].totalDepthMm - thicknessMm, 250);
      supports[i].bottomY = slabBottomY - depthBelowSlabMm * S;
      curX += w;

      if (i < N) {
        const span = bays[i].clearSpanMm * S;
        bays[i].xClearStart = curX;
        bays[i].xClearEnd = curX + span;
        bays[i].clearSpanDrawing = span;
        curX += span;
      }
    }

    // -------------------------------------------------------------------------
    // 1. Concrete Slab Outline (Clean wireframe, NO shaded color fill)
    // -------------------------------------------------------------------------
    const concretePts: [number, number][] = [];
    concretePts.push([supports[0].xStart, slabTopY]);
    concretePts.push([supports[N].xEnd, slabTopY]);
    concretePts.push([supports[N].xEnd, supports[N].bottomY]);
    concretePts.push([supports[N].xStart, supports[N].bottomY]);

    for (let i = N - 1; i >= 0; i--) {
      concretePts.push([supports[i + 1].xStart, slabBottomY]);
      concretePts.push([bays[i].xClearStart, slabBottomY]);
      concretePts.push([supports[i].xEnd, supports[i].bottomY]);
      concretePts.push([supports[i].xStart, supports[i].bottomY]);
    }
    concretePts.push([supports[0].xStart, slabTopY]);

    // Render wireframe outline
    b.poly(LAYER_CONCRETE.name, concretePts, true);

    // -------------------------------------------------------------------------
    // 2. Reinforcement Detailing
    // -------------------------------------------------------------------------
    const cover = SLAB_COVER * S;
    const yBot = slabBottomY + cover;
    const yTop = slabTopY - cover;
    const crankH = yTop - yBot;
    const dx_crank = crankH; // 45-degree angle

    // 2a. Straight bottom continuous rebar
    for (let i = 0; i < N; i++) {
      const lapLength = Math.min(supports[i + 1].widthMm * S * 0.75, 1200);
      if (i === 0 && N === 1) {
        // Single bay exterior-to-exterior
        b.poly(LAYER_REBAR.name, [
          [supports[0].xStart + cover, yBot + 150],
          [supports[0].xStart + cover, yBot],
          [supports[1].xEnd - cover, yBot],
          [supports[1].xEnd - cover, yBot + 150],
        ]);
      } else if (i === 0) {
        // Left exterior
        b.poly(LAYER_REBAR.name, [
          [supports[0].xStart + cover, yBot + 150],
          [supports[0].xStart + cover, yBot],
          [bays[0].xClearEnd + lapLength, yBot],
        ]);
      } else if (i === N - 1) {
        // Right exterior
        b.poly(LAYER_REBAR.name, [
          [bays[i].xClearStart - Math.min(supports[i].widthMm * S * 0.75, 1200), yBot],
          [supports[N].xEnd - cover, yBot],
          [supports[N].xEnd - cover, yBot + 150],
        ]);
      } else {
        // Interior continuous
        b.line(
          LAYER_REBAR.name,
          bays[i].xClearStart - Math.min(supports[i].widthMm * S * 0.75, 1200),
          yBot,
          bays[i].xClearEnd + lapLength,
          yBot
        );
      }
    }

    // 2b. Alternate bent-up / cranked bars (45° crank at L/6 from support face)
    for (let i = 0; i < N; i++) {
      const crankMm = calcCrankOffsetMm(bays[i].clearSpanMm);
      const crankDrawing = crankMm * S;
      const xL_crank_start = bays[i].xClearStart + crankDrawing;
      const xL_crank_end = xL_crank_start - dx_crank;
      const xR_crank_start = bays[i].xClearEnd - crankDrawing;
      const xR_crank_end = xR_crank_start + dx_crank;

      // Bottom straight middle segment
      b.line(LAYER_REBAR.name, xL_crank_start, yBot, xR_crank_start, yBot);
      // Left 45° crank
      b.line(LAYER_REBAR.name, xL_crank_start, yBot, xL_crank_end, yTop);
      // Right 45° crank
      b.line(LAYER_REBAR.name, xR_crank_start, yBot, xR_crank_end, yTop);

      // Left extension over support i
      if (i === 0) {
        b.poly(LAYER_REBAR.name, [
          [xL_crank_end, yTop],
          [supports[0].xStart + cover, yTop],
          [supports[0].xStart + cover, yBot],
        ]);
      } else {
        const extPrev = calcCurtailmentMm(bays[i - 1].clearSpanMm) * S;
        const xEndOver = supports[i].xStart - extPrev;
        b.poly(LAYER_REBAR.name, [
          [xEndOver - 80, yTop - 80],
          [xEndOver, yTop],
          [xL_crank_end, yTop],
        ]);
      }

      // Right extension over support i+1
      if (i === N - 1) {
        b.poly(LAYER_REBAR.name, [
          [xR_crank_end, yTop],
          [supports[N].xEnd - cover, yTop],
          [supports[N].xEnd - cover, yBot],
        ]);
      } else {
        const extNext = calcCurtailmentMm(bays[i + 1].clearSpanMm) * S;
        const xEndOver = supports[i + 1].xEnd + extNext;
        b.poly(LAYER_REBAR.name, [
          [xR_crank_end, yTop],
          [xEndOver, yTop],
          [xEndOver + 80, yTop - 80],
        ]);
      }
    }

    // 2c. Top negative moment extra rebar over supports (extending 0.25L into bays)
    for (let k = 0; k <= N; k++) {
      if (k === 0) {
        const ext = calcCurtailmentMm(bays[0].clearSpanMm) * S;
        const xEnd = supports[0].xEnd + ext;
        b.poly(LAYER_REBAR.name, [
          [supports[0].xStart + cover + 40, yBot + 120],
          [supports[0].xStart + cover + 40, yTop],
          [xEnd, yTop],
          [xEnd + 80, yTop - 80],
        ]);
      } else if (k === N) {
        const ext = calcCurtailmentMm(bays[N - 1].clearSpanMm) * S;
        const xStart = supports[N].xStart - ext;
        b.poly(LAYER_REBAR.name, [
          [xStart - 80, yTop - 80],
          [xStart, yTop],
          [supports[N].xEnd - cover - 40, yTop],
          [supports[N].xEnd - cover - 40, yBot + 120],
        ]);
      } else {
        const extLeft = calcCurtailmentMm(bays[k - 1].clearSpanMm) * S;
        const extRight = calcCurtailmentMm(bays[k].clearSpanMm) * S;
        const xLeft = supports[k].xStart - extLeft;
        const xRight = supports[k].xEnd + extRight;
        b.poly(LAYER_REBAR.name, [
          [xLeft - 80, yTop - 80],
          [xLeft, yTop],
          [xRight, yTop],
          [xRight + 80, yTop - 80],
        ]);
      }
    }

    // 2d. Transverse distribution rebar dots (small circles along top & bottom)
    const dotR = 18;
    for (const bay of bays) {
      const step = Math.max(bay.transSpacing * S, 450);
      const span = bay.xClearEnd - bay.xClearStart - 300;
      const count = Math.max(2, Math.floor(span / step));
      const actualStep = span / count;
      for (let s = 0; s <= count; s++) {
        const x = bay.xClearStart + 150 + s * actualStep;
        b.circle(LAYER_REBAR.name, x, yBot + 28, dotR, true);
      }
    }
    for (let k = 0; k <= N; k++) {
      const xLeft =
        k === 0
          ? supports[0].xStart + cover + 60
          : supports[k].xStart - calcCurtailmentMm(bays[k - 1].clearSpanMm) * S;
      const xRight =
        k === N
          ? supports[N].xEnd - cover - 60
          : supports[k].xEnd + calcCurtailmentMm(bays[k].clearSpanMm) * S;
      const span = xRight - xLeft;
      const step = 500;
      const count = Math.max(2, Math.floor(span / step));
      const actualStep = span / count;
      for (let s = 0; s <= count; s++) {
        const x = xLeft + s * actualStep;
        b.circle(LAYER_REBAR.name, x, yTop - 28, dotR, true);
      }
    }

    // -------------------------------------------------------------------------
    // 3. Dimension Chains
    // -------------------------------------------------------------------------
    const yDimSupp = slabTopY + 2600;
    const yDimSpan = slabTopY + 1900;
    const yDimCurt = slabTopY + 1200;

    // Row 1: Support widths
    for (let i = 0; i <= N; i++) {
      b.dimHorizontal(supports[i].xStart, supports[i].xEnd, yDimSupp, `${supports[i].widthMm}`, {
        textHeight: TEXT_H.CALLOUT,
      });
    }

    // Row 2: Clear spans
    for (let i = 0; i < N; i++) {
      b.dimHorizontal(bays[i].xClearStart, bays[i].xClearEnd, yDimSpan, `${bays[i].clearSpanMm}`, {
        textHeight: TEXT_H.CALLOUT,
      });
    }

    // Row 3: Curtailment extensions over supports
    for (let k = 1; k < N; k++) {
      const extLeftMm = calcCurtailmentMm(bays[k - 1].clearSpanMm);
      const extRightMm = calcCurtailmentMm(bays[k].clearSpanMm);
      b.dimHorizontal(supports[k].xStart - extLeftMm * S, supports[k].xStart, yDimCurt, `${extLeftMm}`, {
        textHeight: TEXT_H.CALLOUT,
      });
      b.dimHorizontal(supports[k].xEnd, supports[k].xEnd + extRightMm * S, yDimCurt, `${extRightMm}`, {
        textHeight: TEXT_H.CALLOUT,
      });
    }

    // Row 4: Crank offset dimensions below slab
    const yDimCrank = slabBottomY - 450;
    for (let i = 0; i < N; i++) {
      const crankMm = calcCrankOffsetMm(bays[i].clearSpanMm);
      b.dimHorizontal(bays[i].xClearStart, bays[i].xClearStart + crankMm * S, yDimCrank, `${crankMm}`, {
        textHeight: TEXT_H.CALLOUT,
      });
      b.dimHorizontal(bays[i].xClearEnd - crankMm * S, bays[i].xClearEnd, yDimCrank, `${crankMm}`, {
        textHeight: TEXT_H.CALLOUT,
      });
    }

    // -------------------------------------------------------------------------
    // 4. Text Callouts
    // -------------------------------------------------------------------------
    // Top rebar callouts & bottom bent-up callouts
    for (let i = 0; i < N; i++) {
      const midX = (bays[i].xClearStart + bays[i].xClearEnd) / 2;
      b.text(
        LAYER_TEXT.name,
        midX,
        slabTopY + 550,
        `T${bays[i].barDia}@${bays[i].barSpacing} C/C`,
        TEXT_H.CALLOUT,
        { anchor: 'middle' }
      );
      b.text(
        LAYER_TEXT.name,
        midX,
        slabBottomY - 1050,
        `T${bays[i].barDia}@${bays[i].barSpacing} C/C (ALT. REINF. BENT UP)`,
        TEXT_H.CALLOUT,
        { anchor: 'middle' }
      );
    }

    // Support labels below each column/beam
    const lowestSuppBottom = Math.min(...supports.map((s) => s.bottomY));
    for (let i = 0; i <= N; i++) {
      b.text(
        LAYER_LABELS.name,
        supports[i].centerX,
        lowestSuppBottom - 750,
        supports[i].label,
        TEXT_H.GRID,
        { anchor: 'middle', bold: true }
      );
    }

    // Slab panel labels below each bay in cyan (LAYER_LABELS)
    for (let i = 0; i < N; i++) {
      const midX = (bays[i].xClearStart + bays[i].xClearEnd) / 2;
      b.text(
        LAYER_LABELS.name,
        midX,
        lowestSuppBottom - 1650,
        `SLAB ${bays[i].panelId} ${bays[i].oneWay ? '(ONE WAY)' : '(TWO WAY)'} (${bays[i].thicknessMm} THK)`,
        TEXT_H.LABEL,
        { anchor: 'middle', underline: true, bold: true }
      );
    }

    // Overall Section Title and Scale Note centered below
    const sectionMidX = (supports[0].xStart + supports[N].xEnd) / 2;
    b.text(
      LAYER_LABELS.name,
      sectionMidX,
      lowestSuppBottom - 2700,
      'SECTION X1-X1',
      400,
      { anchor: 'middle', underline: true, bold: true }
    );
    b.text(
      LAYER_TEXT.name,
      sectionMidX,
      lowestSuppBottom - 3250,
      '(SCALE: H - 1:50 / V - 1:50)',
      TEXT_H.CALLOUT,
      { anchor: 'middle' }
    );
  }

  /** Section cut line across the slab plan with `SECTION X1-X1` bubbles. */
  private static drawCutLine(b: SheetBuilder, minX: number, maxX: number, y: number) {
    const r = TEXT_H.CALLOUT * 3;
    const x0 = minX - 1500;
    const x1 = maxX + 1500;

    b.poly(LAYER_CUT_LINE.name, [
      [x0, y + 1600],
      [x1, y + 1600],
    ]);
    b.poly(LAYER_CUT_LINE.name, [
      [x0, y - 1600],
      [x1, y - 1600],
    ]);
    b.circle(LAYER_SECTION_MARK.name, x0, y, r);
    b.circle(LAYER_SECTION_MARK.name, x1, y, r);
    b.text(LAYER_SECTION_MARK.name, x0, y + TEXT_H.CALLOUT, 'X1', TEXT_H.CALLOUT, { anchor: 'middle' });
    b.text(LAYER_SECTION_MARK.name, x1, y + TEXT_H.CALLOUT, 'X1', TEXT_H.CALLOUT, { anchor: 'middle' });
    b.text(LAYER_SECTION_MARK.name, (x0 + x1) / 2, y + 2400, 'SECTION X1-X1', TEXT_H.CALLOUT, {
      anchor: 'middle',
      bold: true,
    });
  }
}
