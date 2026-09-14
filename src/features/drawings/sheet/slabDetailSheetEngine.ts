/**
 * Slab detailing sheet engine.
 *
 * Reproduces the content of the source AutoCAD drawing `SLAB.dxf`
 * (see DXF_DRAWING_ANALYSIS.md):
 *
 *   - slab panels drawn at true size (1:100) in their real plan positions;
 *   - panel marks `SLAB S1`, `SLAB S2` ... on the Labels layer;
 *   - panel type notes `(ONE WAY) (150 THK)` / `(TWO WAY) (150 THK)`;
 *   - bottom reinforcement bar callouts `T8@150 C/C` with leaders;
 *   - bent-up alternate bars noted `ALT. REINF. BENT U`;
 *   - a `SECTION X1-X1` cut line across the panels plus a scaled slab
 *     thickness section detail at 4x (printed 1:25).
 */

import { FloorPlanLevel } from '../floorPlanEngine';
import {
  DrawingSheet,
  LAYER_CONCRETE,
  LAYER_CUT_LINE,
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

export interface SlabSheetInput {
  level: FloorPlanLevel;
  /** StoredProject — provides savedSlabDesigns. */
  project?: any;
}

const round25 = (mm: number) => Math.max(75, Math.floor(mm / 25) * 25);

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

  public static buildSheet(input: SlabSheetInput): DrawingSheet {
    const { level } = input;
    const panels = this.extractLevelPanels(input);
    const b = new SheetBuilder(SLAB_SHEET_LAYERS);

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

    if (panels.length === 0) {
      return b.build({
        sheetNumber: `STR-${300 + (level.levelIndex || 0)}`,
        title: 'SLAB REINFORCEMENT DETAILING',
        levelName: level.levelName,
        notes: ['No slab panels detected at this level'],
      });
    }

    panels.forEach((panel) => this.drawPanel(b, panel, mm));

    // Slab thickness section detail below the plan, then the section cut line.
    const sectionY = minY - 4200;
    this.drawSectionDetail(b, panels[0], minX, sectionY);
    this.drawCutLine(b, minX, maxX, (minY + maxY) / 2);

    return b.build({
      sheetNumber: `STR-${300 + (level.levelIndex || 0)}`,
      title: 'SLAB REINFORCEMENT PLAN & THICKNESS SECTION',
      subtitle: `${panels.length} slab panels · ${panels[0].thickness} mm thick · IS 456 detailing`,
      levelName: level.levelName,
      notes: [
        '(ONE WAY / TWO WAY AS NOTED)',
        'All dimensions in mm unless noted',
        '(SCALE 1:100 PLAN · SECTION 1:25)',
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

  /** Enlarged slab thickness section at 4x (prints 1:25) with top/bottom bars. */
  private static drawSectionDetail(b: SheetBuilder, panel: SlabPanelDesign, x: number, y: number) {
    const S = SECTION_SCALE;
    const spanMm = Math.min(panel.lx, panel.ly) * 1000;
    const t = panel.thickness;
    const w = spanMm * S * 0.35;
    const h = t * S;

    const cover = SLAB_COVER * S;
    const barR = (panel.bottomMain.dia * S) / 2;

    b.rect(LAYER_CONCRETE.name, x, y, w, h);
    b.circle(LAYER_REBAR.name, x + cover, y + cover, barR);
    b.circle(LAYER_REBAR.name, x + w - cover, y + cover, barR);
    b.circle(LAYER_REBAR.name, x + cover, y + h - cover, barR);
    b.circle(LAYER_REBAR.name, x + w - cover, y + h - cover, barR);

    b.dimVertical(y, y + h, x + w + 600, t, { textHeight: TEXT_H.CALLOUT });
    b.text(
      LAYER_TEXT.name,
      x + w / 2,
      y + h + TEXT_H.CALLOUT * 3,
      `SLAB SECTION — ${t} THK, T${panel.bottomMain.dia}@${panel.bottomMain.spacing} C/C BOTTOM`,
      TEXT_H.CALLOUT,
      { anchor: 'middle', bold: true }
    );
    b.text(LAYER_TEXT.name, x + w / 2, y - TEXT_H.CALLOUT * 2.6, '(SCALE 1:25)', TEXT_H.CALLOUT, {
      anchor: 'middle',
    });
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
