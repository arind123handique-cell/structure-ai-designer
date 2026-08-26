import { NormalizedStructuralModel } from '@/features/model/types';
import { StoredProject } from '@/features/projects/types';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';
import { BeamDesignEngine } from '@/features/design/beam/beamDesignEngine';
import { ColumnDesignEngine } from '@/features/design/column/columnDesignEngine';
import { PileCapDesignEngine } from '@/features/design/pilecap/pileCapDesignEngine';
import { GradeBeamDesignEngine } from '@/features/design/gradebeam/gradeBeamEngine';
import { ShearWallEngine } from '@/features/design/shearwall/shearWallEngine';

export type BarShapeType =
  | 'STRAIGHT'
  | 'U_BAR'
  | 'L_BAR'
  | 'RECT_TIE'
  | 'DIAMOND_TIE'
  | 'CRANKED'
  | 'PENTAGON_TIE';

export type BbsElementCategory =
  | 'BEAM'
  | 'COLUMN'
  | 'PILE_CAP'
  | 'GRADE_BEAM'
  | 'PILE'
  | 'SHEAR_WALL'
  | 'SLAB';

export interface BbsItem {
  barNo: number;
  elementCategory: BbsElementCategory;
  elementTag: string; // e.g. "B1 (L1)", "C1 (GF-1F)", "PC-1"
  barDescription: string; // e.g. "Bottom Main Through Bars (2-T16)"
  shapeType: BarShapeType;
  // Dimensions in millimeters (can be converted to meters in UI)
  a: number; // leg 1 (e.g. hook or tie height)
  b: number; // main span / width
  c: number; // leg 2 (or tie width)
  d?: number; // extra hook / crank
  diameter: number; // mm: 8, 10, 12, 16, 20, 25, 28, 32
  spacing?: number; // mm (e.g. 150)
  cuttingLengthM: number; // cutting length in meters with bend deductions
  numElements: number; // number of identical elements
  barsPerElement: number; // bars per element
  totalCount: number; // total number of bars = numElements * barsPerElement
  totalLengthM: number; // total count * cuttingLengthM
  lengthByDia: { [dia: number]: number }; // length in meters assigned to diameter
}

export interface BbsDiameterSummary {
  diameter: number;
  unitWeightKgM: number; // dia^2 / 162.2
  totalLengthM: number;
  totalWeightKg: number;
  totalWeightMT: number;
}

export interface BbsProjectOutput {
  projectName: string;
  engineer: string;
  docNo: string;
  refDwgNo: string;
  revision: string;
  status: string;
  date: string;
  items: BbsItem[];
  diameterSummaries: BbsDiameterSummary[];
  grandTotalLengthM: number;
  grandTotalWeightKg: number;
  grandTotalWeightMT: number;
  byCategoryWeightKg: { [category: string]: number };
  byCategoryDiameterMatrix: { [category in BbsElementCategory]?: { [dia: number]: number } };
}

export class BbsEngine {
  public static readonly STANDARD_DIAMETERS = [8, 10, 12, 16, 20, 25, 28, 32];

  /**
   * Generates a complete Bar Bending Schedule for the entire building model,
   * strictly adhering to the active Universal Rebar Selection dictionary.
   */
  public static generateBuildingBbs(
    model: NormalizedStructuralModel | null,
    project: StoredProject | null
  ): BbsProjectOutput {
    const fck = project?.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
    const fy = project?.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;
    const projectName = project?.metadata.name || 'Structural Building Model';
    const engineer = project?.metadata.engineer || 'Lead Structural Engineer';
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

    const allowedLong = project?.universalRebarSelection?.longitudinalDiameters ||
      project?.allowedColumnRebarDiameters || [12, 16, 20, 25];
    const allowedTies = project?.universalRebarSelection?.shearTieDiameters || [8, 10];

    const items: BbsItem[] = [];
    let barIndex = 1;

    // Helper default diameters strictly within allowed inventory
    const getBestLongDia = (preferred: number[]): number => {
      for (const p of preferred) {
        if (allowedLong.includes(p)) return p;
      }
      return allowedLong[0] || 16;
    };

    const getBestTieDia = (preferred: number[]): number => {
      for (const p of preferred) {
        if (allowedTies.includes(p)) return p;
      }
      return allowedTies[0] || 8;
    };

    // 1. EXTRACT BEAMS (Grouped by identical span, section & rebar design)
    const savedBeamDesigns: Record<number, any> = project?.savedBeamDesigns || {};
    const floorPlans = model
      ? FloorPlanEngine.extractAllFloorPlans(
          model,
          project?.projectPileTypes,
          project?.supportPileAssignments,
          project?.customPileCapOverrides,
          project?.manualMergedPileCapGroups,
          project?.detachedCombinedCapNodeIds,
          project?.customCombinedCapOverrides,
          project?.savedPileCapDesigns,
          project?.savedCombinedCapDesigns,
          project?.metadata?.designSettings
        )
      : [];
    const beamProcessed = new Set<string>();

    floorPlans.forEach((fp) => {
      // Collect framing beams at this floor level and group identical ones
      const beamGroups = new Map<string, {
        spanM: number;
        bMm: number;
        DMm: number;
        cover: number;
        botDia: number;
        botCount: number;
        topDia: number;
        topCount: number;
        stirrupDia: number;
        stirrupSpacing: number;
        LdMm: number;
        savedBm: any;
        liveCurtailment: any;
        count: number;
        labels: string[];
      }>();

      fp.beams.forEach((beam) => {
        const key = `${fp.levelIndex}_${beam.memberId}`;
        if (beamProcessed.has(key)) return;
        beamProcessed.add(key);

        const spanM = beam.length || 4.5;
        const bMm = Math.round((beam.width || 0.3) * 1000);
        const DMm = Math.round((beam.depth || 0.45) * 1000);
        const cover = 30;

        // Prefer saved design; fall back to live design engine
        const savedBm = savedBeamDesigns[beam.memberId];
        let botDia: number;
        let botCount: number;
        let topDia: number;
        let topCount: number;
        let stirrupDia: number;
        let stirrupSpacing: number;
        let LdMm: number;
        let liveCurtailment: any = null;

        if (savedBm) {
          const cur = savedBm.curtailment || savedBm;
          botDia = cur.throughBottom?.diameter || savedBm.botDia || getBestLongDia([16, 12, 20]);
          botCount = cur.throughBottom?.count || savedBm.botCount || 2;
          topDia = cur.throughTop?.diameter || savedBm.topDia || getBestLongDia([12, 16, 20]);
          topCount = cur.throughTop?.count || savedBm.topCount || 2;
          stirrupDia = savedBm.shear?.stirrupDia || savedBm.stirrupDia || getBestTieDia([8, 10]);
          stirrupSpacing = savedBm.shear?.spacing_prov || savedBm.stirrupSpacing || 125;
          LdMm = savedBm.developmentLength || 45 * botDia;
          if (!allowedLong.includes(botDia)) botDia = getBestLongDia([botDia, 16, 12, 20]);
          if (!allowedLong.includes(topDia)) topDia = getBestLongDia([topDia, 12, 16, 20]);
          if (!allowedTies.includes(stirrupDia)) stirrupDia = getBestTieDia([stirrupDia, 8, 10]);
        } else {
          const MuHog = Math.round(0.08 * 25 * spanM * spanM);
          const MuSag = Math.round(0.06 * 25 * spanM * spanM);
          const Vu = Math.round(0.5 * 25 * spanM);

          const design = BeamDesignEngine.design({
            memberId: beam.memberId,
            b: bMm,
            D: DMm,
            spanLength: spanM,
            fck,
            fy,
            Mu_top: MuHog,
            Mu_bottom: MuSag,
            Vu,
            cover,
            allowedDiameters: allowedLong,
          });

          const cur = design.curtailment;
          LdMm = design.developmentLength || 45 * 16;
          botDia = (cur.throughBottom.diameter && allowedLong.includes(cur.throughBottom.diameter))
            ? cur.throughBottom.diameter
            : getBestLongDia([16, 12, 20]);
          botCount = cur.throughBottom.count || 2;
          topDia = (cur.throughTop.diameter && allowedLong.includes(cur.throughTop.diameter))
            ? cur.throughTop.diameter
            : getBestLongDia([12, 16, 20]);
          topCount = cur.throughTop.count || 2;
          stirrupDia = getBestTieDia([8, 10]);
          stirrupSpacing = design.shear.spacing_prov || 125;
          liveCurtailment = design.curtailment;
        }

        const sig = `${fp.levelIndex}_${bMm}_${DMm}_${spanM}_${botDia}_${botCount}_${topDia}_${topCount}_${stirrupDia}_${stirrupSpacing}_${savedBm ? 'S_' + beam.memberId : 'A'}`;

        if (!beamGroups.has(sig)) {
          beamGroups.set(sig, {
            spanM, bMm, DMm, cover, botDia, botCount, topDia, topCount, stirrupDia, stirrupSpacing, LdMm, savedBm, liveCurtailment,
            count: 0, labels: [],
          });
        }
        const g = beamGroups.get(sig)!;
        g.count++;
        g.labels.push(beam.label);
      });

      beamGroups.forEach((g) => {
        const nElem = g.count;
        const tag = nElem === 1
          ? `${g.labels[0]} (${fp.levelName.split(' ')[0]})`
          : `BEAM TYPE (${g.bMm}×${g.DMm} L=${g.spanM}m — ${fp.levelName.split(' ')[0]}) — ${nElem} Beams (${g.labels.join(', ')})`;

        const anchorHookMm = Math.max(200, Math.min(g.DMm - 2 * g.cover, Math.round(g.LdMm * 0.4)));
        const botA = anchorHookMm;
        const botB = Math.round(g.spanM * 1000 - 2 * g.cover);
        const botCutM = Math.max(0.5, (botA * 2 + botB - 4 * g.botDia) / 1000);
        const totBotCount = nElem * g.botCount;

        items.push({
          barNo: barIndex++,
          elementCategory: 'BEAM',
          elementTag: tag,
          barDescription: `Bottom Main Through Bars (${g.botCount}-T${g.botDia})`,
          shapeType: 'U_BAR',
          a: botA, b: botB, c: botA,
          diameter: g.botDia,
          cuttingLengthM: Number(botCutM.toFixed(2)),
          numElements: nElem,
          barsPerElement: g.botCount,
          totalCount: totBotCount,
          totalLengthM: Number((totBotCount * botCutM).toFixed(2)),
          lengthByDia: { [g.botDia]: Number((totBotCount * botCutM).toFixed(2)) },
        });

        const topA = anchorHookMm;
        const topB = Math.round(g.spanM * 1000 - 2 * g.cover);
        const topCutM = Math.max(0.5, (topA * 2 + topB - 4 * g.topDia) / 1000);
        const totTopCount = nElem * g.topCount;

        items.push({
          barNo: barIndex++,
          elementCategory: 'BEAM',
          elementTag: tag,
          barDescription: `Top Continuous Hanger Bars (${g.topCount}-T${g.topDia})`,
          shapeType: 'U_BAR',
          a: topA, b: topB, c: topA,
          diameter: g.topDia,
          cuttingLengthM: Number(topCutM.toFixed(2)),
          numElements: nElem,
          barsPerElement: g.topCount,
          totalCount: totTopCount,
          totalLengthM: Number((totTopCount * topCutM).toFixed(2)),
          lengthByDia: { [g.topDia]: Number((totTopCount * topCutM).toFixed(2)) },
        });

        const stirrupA = Math.round(g.DMm - 2 * g.cover - g.stirrupDia);
        const stirrupC = Math.round(g.bMm - 2 * g.cover - g.stirrupDia);
        const stirrupCutM = Math.max(0.4, (2 * (stirrupA + stirrupC) + 24 * g.stirrupDia - 6 * g.stirrupDia) / 1000);
        const stirrupPerBeam = Math.max(4, Math.round((g.spanM * 1000) / g.stirrupSpacing) + 1);
        const totStirrupCount = nElem * stirrupPerBeam;

        items.push({
          barNo: barIndex++,
          elementCategory: 'BEAM',
          elementTag: tag,
          barDescription: `2-Legged Closed Stirrups (${g.stirrupDia}Ø@${g.stirrupSpacing} c/c)`,
          shapeType: 'RECT_TIE',
          a: stirrupA, b: 0, c: stirrupC,
          diameter: g.stirrupDia,
          spacing: g.stirrupSpacing,
          cuttingLengthM: Number(stirrupCutM.toFixed(2)),
          numElements: nElem,
          barsPerElement: stirrupPerBeam,
          totalCount: totStirrupCount,
          totalLengthM: Number((totStirrupCount * stirrupCutM).toFixed(2)),
          lengthByDia: { [g.stirrupDia]: Number((totStirrupCount * stirrupCutM).toFixed(2)) },
        });
      });

      // Grade Beams
      if (fp.isFoundationLevel) {
        const gbGroups = new Map<string, { spanM: number; bMm: number; DMm: number; cover: number; count: number; labels: string[] }>();
        fp.gradeBeams.forEach((gb) => {
          const spanM = gb.length || 5.0;
          const bMm = gb.width || 300;
          const DMm = gb.depth || 450;
          const cover = 40;
          const sig = `${bMm}_${DMm}_${spanM}`;
          if (!gbGroups.has(sig)) {
            gbGroups.set(sig, { spanM, bMm, DMm, cover, count: 0, labels: [] });
          }
          const g = gbGroups.get(sig)!;
          g.count++;
          g.labels.push(gb.gradeBeamId);
        });

        gbGroups.forEach((g) => {
          const nElem = g.count;
          const tag = nElem === 1 ? `${g.labels[0]} (Plinth)` : `GRADE BEAM (${g.bMm}×${g.DMm} L=${g.spanM}m) — ${nElem} Beams (${g.labels.join(', ')})`;
          const botDia = getBestLongDia([16, 12, 20]);
          const botCount = 3;
          const botA = Math.round(g.DMm - 2 * g.cover);
          const botB = Math.round(g.spanM * 1000 - 2 * g.cover);
          const botCutM = (botA * 2 + botB - 4 * botDia) / 1000;
          const totBotCount = nElem * botCount;

          items.push({
            barNo: barIndex++,
            elementCategory: 'GRADE_BEAM',
            elementTag: tag,
            barDescription: `Grade Beam Bottom Main Bars (${botCount}-T${botDia})`,
            shapeType: 'U_BAR',
            a: botA, b: botB, c: botA, diameter: botDia,
            cuttingLengthM: Number(botCutM.toFixed(2)),
            numElements: nElem, barsPerElement: botCount, totalCount: totBotCount,
            totalLengthM: Number((totBotCount * botCutM).toFixed(2)),
            lengthByDia: { [botDia]: Number((totBotCount * botCutM).toFixed(2)) },
          });

          items.push({
            barNo: barIndex++,
            elementCategory: 'GRADE_BEAM',
            elementTag: tag,
            barDescription: `Grade Beam Top Main Bars (${botCount}-T${botDia})`,
            shapeType: 'U_BAR',
            a: botA, b: botB, c: botA, diameter: botDia,
            cuttingLengthM: Number(botCutM.toFixed(2)),
            numElements: nElem, barsPerElement: botCount, totalCount: totBotCount,
            totalLengthM: Number((totBotCount * botCutM).toFixed(2)),
            lengthByDia: { [botDia]: Number((totBotCount * botCutM).toFixed(2)) },
          });

          const tieDia = getBestTieDia([8, 10]);
          const tieSpacing = 150;
          const tieA = Math.round(g.DMm - 2 * g.cover);
          const tieC = Math.round(g.bMm - 2 * g.cover);
          const tieCutM = (2 * (tieA + tieC) + 24 * tieDia - 6 * tieDia) / 1000;
          const tieCount = Math.round((g.spanM * 1000) / tieSpacing) + 1;
          const totTieCount = nElem * tieCount;

          items.push({
            barNo: barIndex++,
            elementCategory: 'GRADE_BEAM',
            elementTag: tag,
            barDescription: `Grade Beam Closed Ties (${tieDia}Ø@150 c/c)`,
            shapeType: 'RECT_TIE',
            a: tieA, b: 0, c: tieC, diameter: tieDia, spacing: tieSpacing,
            cuttingLengthM: Number(tieCutM.toFixed(2)),
            numElements: nElem, barsPerElement: tieCount, totalCount: totTieCount,
            totalLengthM: Number((totTieCount * tieCutM).toFixed(2)),
            lengthByDia: { [tieDia]: Number((totTieCount * tieCutM).toFixed(2)) },
          });
        });
      }
    });

    // 2. EXTRACT COLUMNS (Grouped by identical height, section & rebar design)
    const savedColDesigns: Record<number, any> = project?.savedColumnDesigns || {};
    const customColOverrides: Record<number, any> = project?.customColumnRebarOverrides || {};

    if (floorPlans.length > 0) {
      const colProcessed = new Set<string>();
      floorPlans.forEach((fp) => {
        const colGroups = new Map<string, {
          bMm: number;
          DMm: number;
          cover: number;
          storeyHeightM: number;
          mainDia: number;
          mainCount: number;
          tieDia: number;
          isGroundSupport: boolean;
          count: number;
          labels: string[];
        }>();

        fp.columns.forEach((col) => {
          const colKey = String(col.memberId || `${fp.levelIndex}_${col.columnSlNo}`);
          if (colProcessed.has(colKey)) return;
          colProcessed.add(colKey);

          const bMm = Math.round((col.width || 0.45) * 1000);
          const DMm = Math.round((col.depth || 0.55) * 1000);
          const cover = 40;

          let storeyHeightM = 3.5;
          if (model && col.memberId) {
            const member = model.members.get(col.memberId);
            if (member) {
              const n1 = model.nodes.get(member.startNodeId);
              const n2 = model.nodes.get(member.endNodeId);
              if (n1 && n2) storeyHeightM = Math.abs(n2.y - n1.y);
            }
          }

          const colKeyLookup = col.memberId || col.columnSlNo;
          const savedDes = savedColDesigns[colKeyLookup];
          const customOverride = customColOverrides[colKeyLookup];
          let mainDia: number;
          let mainCount: number;
          let tieDia: number;

          if (savedDes) {
            mainDia = savedDes.rebar?.cornerBars?.diameter || savedDes.mainDia || getBestLongDia([16, 12, 20]);
            mainCount = savedDes.rebar?.totalBars || savedDes.totalBars || 8;
            tieDia = savedDes.rebar?.ties?.diameter || savedDes.tieDia || getBestTieDia([8, 10]);
            if (!allowedLong.includes(mainDia)) mainDia = getBestLongDia([mainDia, 16, 12, 20]);
            if (!allowedTies.includes(tieDia)) tieDia = getBestTieDia([tieDia, 8, 10]);
          } else if (customOverride) {
            mainDia = customOverride.diameter || getBestLongDia([16, 12, 20]);
            mainCount = customOverride.count || 8;
            tieDia = customOverride.tieDiameter || getBestTieDia([8, 10]);
            if (!allowedLong.includes(mainDia)) mainDia = getBestLongDia([mainDia, 16, 12, 20]);
            if (!allowedTies.includes(tieDia)) tieDia = getBestTieDia([tieDia, 8, 10]);
          } else {
            const colDes = ColumnDesignEngine.design({
              memberId: colKeyLookup,
              b: bMm,
              D: DMm,
              unsupportedHeight: storeyHeightM,
              fck,
              fy,
              Pu: 800,
              Mux: 40,
              Muy: 30,
              allowedDiameters: allowedLong,
            });
            mainDia = (colDes.rebar.cornerBars?.diameter && allowedLong.includes(colDes.rebar.cornerBars.diameter))
              ? colDes.rebar.cornerBars.diameter
              : getBestLongDia([16, 12, 20]);
            mainCount = colDes.rebar.totalBars || 8;
            tieDia = getBestTieDia([8, 10]);
          }

          const sig = `${fp.levelIndex}_${bMm}_${DMm}_${storeyHeightM}_${mainDia}_${mainCount}_${tieDia}_${col.isGroundSupport}_${savedDes ? 'S_' + colKeyLookup : 'A'}`;

          if (!colGroups.has(sig)) {
            colGroups.set(sig, {
              bMm, DMm, cover, storeyHeightM, mainDia, mainCount, tieDia, isGroundSupport: col.isGroundSupport,
              count: 0, labels: [],
            });
          }
          const g = colGroups.get(sig)!;
          g.count++;
          g.labels.push(col.label);
        });

        colGroups.forEach((g) => {
          const nElem = g.count;
          const tag = nElem === 1
            ? `${g.labels[0]} (${fp.levelName.split(' ')[0]})`
            : `COLUMN TYPE (${g.bMm}×${g.DMm} — ${fp.levelName.split(' ')[0]}) — ${nElem} Columns (${g.labels.join(', ')})`;

          const lapLengthMm = Math.round(50 * g.mainDia);
          const bearingMm = g.isGroundSupport ? 150 : 0;
          const colCutM = (g.storeyHeightM * 1000 + lapLengthMm + bearingMm) / 1000;
          const totMainCount = nElem * g.mainCount;

          items.push({
            barNo: barIndex++,
            elementCategory: 'COLUMN',
            elementTag: tag,
            barDescription: `Column Main Longitudinal Bars (${g.mainCount}-T${g.mainDia} + 50d Lap)`,
            shapeType: 'STRAIGHT',
            a: 0, b: Math.round(colCutM * 1000), c: 0,
            diameter: g.mainDia,
            cuttingLengthM: Number(colCutM.toFixed(2)),
            numElements: nElem,
            barsPerElement: g.mainCount,
            totalCount: totMainCount,
            totalLengthM: Number((totMainCount * colCutM).toFixed(2)),
            lengthByDia: { [g.mainDia]: Number((totMainCount * colCutM).toFixed(2)) },
          });

          const tieA = Math.round(g.DMm - 2 * g.cover);
          const tieC = Math.round(g.bMm - 2 * g.cover);
          const tieCutM = (2 * (tieA + tieC) + 24 * g.tieDia - 6 * g.tieDia) / 1000;
          const tiePerCol = Math.round((g.storeyHeightM * 1000) / 125) + 1;
          const totTieCount = nElem * tiePerCol;

          items.push({
            barNo: barIndex++,
            elementCategory: 'COLUMN',
            elementTag: tag,
            barDescription: `Ductile Transverse Outer Ties (${g.tieDia}Ø@100/150 c/c)`,
            shapeType: 'RECT_TIE',
            a: tieA, b: 0, c: tieC,
            diameter: g.tieDia, spacing: 125,
            cuttingLengthM: Number(tieCutM.toFixed(2)),
            numElements: nElem,
            barsPerElement: tiePerCol,
            totalCount: totTieCount,
            totalLengthM: Number((totTieCount * tieCutM).toFixed(2)),
            lengthByDia: { [g.tieDia]: Number((totTieCount * tieCutM).toFixed(2)) },
          });

          const crossTieA = Math.round(Math.hypot(tieA / 2, tieC / 2) * 2);
          const crossTieCutM = (2 * crossTieA + 24 * g.tieDia - 6 * g.tieDia) / 1000;
          items.push({
            barNo: barIndex++,
            elementCategory: 'COLUMN',
            elementTag: tag,
            barDescription: `Internal Diamond Cross Ties (${g.tieDia}Ø@125 c/c)`,
            shapeType: 'DIAMOND_TIE',
            a: Math.round(tieA / 2), b: 0, c: Math.round(tieC / 2),
            diameter: g.tieDia, spacing: 125,
            cuttingLengthM: Number(crossTieCutM.toFixed(2)),
            numElements: nElem,
            barsPerElement: tiePerCol,
            totalCount: totTieCount,
            totalLengthM: Number((totTieCount * crossTieCutM).toFixed(2)),
            lengthByDia: { [g.tieDia]: Number((totTieCount * crossTieCutM).toFixed(2)) },
          });

          if (g.isGroundSupport) {
            const starterDia = g.mainDia;
            const starterCount = g.mainCount;
            const starterA = 300;
            const starterB = Math.round(1000 + lapLengthMm);
            const starterCutM = (starterA + starterB - 2 * starterDia) / 1000;
            const totStarterCount = nElem * starterCount;

            items.push({
              barNo: barIndex++,
              elementCategory: 'COLUMN',
              elementTag: tag,
              barDescription: `Foundation Column Starter Dowels (${starterCount}-T${starterDia} with 300mm Leg)`,
              shapeType: 'L_BAR',
              a: starterA, b: starterB, c: 0,
              diameter: starterDia,
              cuttingLengthM: Number(starterCutM.toFixed(2)),
              numElements: nElem,
              barsPerElement: starterCount,
              totalCount: totStarterCount,
              totalLengthM: Number((totStarterCount * starterCutM).toFixed(2)),
              lengthByDia: { [starterDia]: Number((totStarterCount * starterCutM).toFixed(2)) },
            });
          }
        });
      });
    }

    // 3. EXTRACT PILE CAPS & FOUNDATIONS (Grouped by identical pile count, dimensions & rebar schedule)
    if (floorPlans.length > 0) {
      const foundationPlan = floorPlans.find((fp) => fp.isFoundationLevel);
      if (foundationPlan) {
        const capGroups = new Map<string, {
          cap: any;
          LMm: number;
          BMm: number;
          DMm: number;
          cover: number;
          isPentagon: boolean;
          parsedBotX: any;
          parsedBotY: any;
          parsedTop: any;
          parsedSide: any;
          count: number;
          labels: string[];
        }>();

        foundationPlan.columns.forEach((col) => {
          if (!col.pileCap) return;
          if (foundationPlan.absorbedCombinedCapNodeIds && foundationPlan.absorbedCombinedCapNodeIds.has(col.nodeId)) return;
          const cap = col.pileCap;
          const LMm = cap.capLength || 1900;
          const BMm = cap.capWidth || 1900;
          const DMm = cap.capDepth || 750;
          const cover = 60;
          const isPentagon = cap.pileCount === 5 || cap.capShape === 'PENTAGONAL';

          function parseRebarCallout(callout: string | undefined): { dia: number; spacing: number } | null {
            if (!callout) return null;
            const m = callout.match(/(?:T|Ø)?\s*(\d+)\s*(?:mm)?\s*@\s*(\d+)/i);
            return m ? { dia: parseInt(m[1]), spacing: parseInt(m[2]) } : null;
          }
          const parsedBotX = parseRebarCallout(cap.rebarCalloutX);
          const parsedBotY = parseRebarCallout(cap.rebarCalloutY);
          const parsedTop = parseRebarCallout(cap.topRebarCallout);
          const parsedSide = parseRebarCallout(cap.sideFaceRebarCallout);

          const sig = `${cap.pileCount}_${LMm}_${BMm}_${DMm}_${cap.rebarCalloutX}_${cap.rebarCalloutY}_${cap.topRebarCallout}_${cap.sideFaceRebarCallout}`;
          if (!capGroups.has(sig)) {
            capGroups.set(sig, {
              cap, LMm, BMm, DMm, cover, isPentagon, parsedBotX, parsedBotY, parsedTop, parsedSide,
              count: 0, labels: [],
            });
          }
          const g = capGroups.get(sig)!;
          g.count++;
          g.labels.push(col.label || `C${col.columnSlNo}`);
        });

        capGroups.forEach((g) => {
          const nElem = g.count;
          const markLabel = `PC${Math.max(1, (g.cap.pileCount || 4) - 1)}`;
          const tag = nElem === 1
            ? `${markLabel} (${g.labels[0]})`
            : `${markLabel} (${g.cap.pileCount}-Pile Cap ${g.LMm}×${g.BMm}×${g.DMm}) — ${nElem} Caps (${g.labels.join(', ')})`;

          const botDia = g.parsedBotX?.dia || getBestLongDia([16, 12, 20]);
          const botSpacing = g.parsedBotX?.spacing || (g.isPentagon ? 125 : 150);
          const botBarsX = Math.round(g.BMm / botSpacing) + 1;
          const botA = Math.round(g.DMm - 2 * g.cover);
          const botB = Math.round(g.LMm - 2 * g.cover);
          const botCutM = (botA * 2 + botB - 4 * botDia) / 1000;
          const totBotXCount = nElem * botBarsX;

          items.push({
            barNo: barIndex++,
            elementCategory: 'PILE_CAP',
            elementTag: tag,
            barDescription: `Bottom Main Rebar Mesh X-Dir (T${botDia}@${botSpacing} c/c)`,
            shapeType: 'U_BAR',
            a: botA, b: botB, c: botA,
            diameter: botDia, spacing: botSpacing,
            cuttingLengthM: Number(botCutM.toFixed(2)),
            numElements: nElem,
            barsPerElement: botBarsX,
            totalCount: totBotXCount,
            totalLengthM: Number((totBotXCount * botCutM).toFixed(2)),
            lengthByDia: { [botDia]: Number((totBotXCount * botCutM).toFixed(2)) },
          });

          const botDiaY = g.parsedBotY?.dia || botDia;
          const botSpacingY = g.parsedBotY?.spacing || botSpacing;
          const botBarsY = Math.round(g.LMm / botSpacingY) + 1;
          const botBY = Math.round(g.BMm - 2 * g.cover);
          const botCutMY = (botA * 2 + botBY - 4 * botDiaY) / 1000;
          const totBotYCount = nElem * botBarsY;

          items.push({
            barNo: barIndex++,
            elementCategory: 'PILE_CAP',
            elementTag: tag,
            barDescription: `Bottom Main Rebar Mesh Y-Dir (T${botDiaY}@${botSpacingY} c/c)`,
            shapeType: 'U_BAR',
            a: botA, b: botBY, c: botA,
            diameter: botDiaY, spacing: botSpacingY,
            cuttingLengthM: Number(botCutMY.toFixed(2)),
            numElements: nElem,
            barsPerElement: botBarsY,
            totalCount: totBotYCount,
            totalLengthM: Number((totBotYCount * botCutMY).toFixed(2)),
            lengthByDia: { [botDiaY]: Number((totBotYCount * botCutMY).toFixed(2)) },
          });

          const topDia = g.parsedTop?.dia || getBestLongDia([12, 16, 10]);
          const topSpacing = g.parsedTop?.spacing || 150;
          const topBarsX = Math.round(g.BMm / topSpacing) + 1;
          const topA = Math.round(g.DMm - 2 * g.cover);
          const topB = Math.round(g.LMm - 2 * g.cover);
          const topCutMX = (topA * 2 + topB - 4 * topDia) / 1000;
          const totTopXCount = nElem * topBarsX;

          items.push({
            barNo: barIndex++,
            elementCategory: 'PILE_CAP',
            elementTag: tag,
            barDescription: `Top Shrinkage Rebar Mesh X-Dir (T${topDia}@${topSpacing} c/c)`,
            shapeType: 'U_BAR',
            a: topA, b: topB, c: topA,
            diameter: topDia, spacing: topSpacing,
            cuttingLengthM: Number(topCutMX.toFixed(2)),
            numElements: nElem,
            barsPerElement: topBarsX,
            totalCount: totTopXCount,
            totalLengthM: Number((totTopXCount * topCutMX).toFixed(2)),
            lengthByDia: { [topDia]: Number((totTopXCount * topCutMX).toFixed(2)) },
          });

          const topBarsY = Math.round(g.LMm / topSpacing) + 1;
          const topBY = Math.round(g.BMm - 2 * g.cover);
          const topCutMY = (topA * 2 + topBY - 4 * topDia) / 1000;
          const totTopYCount = nElem * topBarsY;

          items.push({
            barNo: barIndex++,
            elementCategory: 'PILE_CAP',
            elementTag: tag,
            barDescription: `Top Shrinkage Rebar Mesh Y-Dir (T${topDia}@${topSpacing} c/c)`,
            shapeType: 'U_BAR',
            a: topA, b: topBY, c: topA,
            diameter: topDia, spacing: topSpacing,
            cuttingLengthM: Number(topCutMY.toFixed(2)),
            numElements: nElem,
            barsPerElement: topBarsY,
            totalCount: totTopYCount,
            totalLengthM: Number((totTopYCount * topCutMY).toFixed(2)),
            lengthByDia: { [topDia]: Number((totTopYCount * topCutMY).toFixed(2)) },
          });

          const sideDia = g.parsedSide?.dia || getBestTieDia([10, 8]);
          const sideCountPerCap = (() => {
            if (g.cap.sideFaceRebarCallout) {
              const m = g.cap.sideFaceRebarCallout.match(/(\d+)\s*[-–\sTØ]/);
              if (m) return parseInt(m[1]);
            }
            return 3;
          })();
          let sideCutM = 0;
          let shapeType: BarShapeType = 'RECT_TIE';

          if (g.isPentagon) {
            shapeType = 'PENTAGON_TIE';
            sideCutM = (5 * 1461 + 24 * sideDia) / 1000;
          } else {
            shapeType = 'RECT_TIE';
            sideCutM = (2 * (g.LMm - 2 * g.cover + g.BMm - 2 * g.cover) + 24 * sideDia) / 1000;
          }
          const totSideCount = nElem * sideCountPerCap;

          items.push({
            barNo: barIndex++,
            elementCategory: 'PILE_CAP',
            elementTag: tag,
            barDescription: `Side Face Skin Reinforcement Ties (${sideCountPerCap}-T${sideDia})`,
            shapeType,
            a: g.isPentagon ? 1461 : Math.round(g.DMm / 4),
            b: g.isPentagon ? 1461 : Math.round(g.LMm - 2 * g.cover),
            c: g.isPentagon ? 1461 : Math.round(g.BMm - 2 * g.cover),
            diameter: sideDia,
            cuttingLengthM: Number(sideCutM.toFixed(2)),
            numElements: nElem,
            barsPerElement: sideCountPerCap,
            totalCount: totSideCount,
            totalLengthM: Number((totSideCount * sideCutM).toFixed(2)),
            lengthByDia: { [sideDia]: Number((totSideCount * sideCutM).toFixed(2)) },
          });
        });

        // ── 3b. COMBINED PILE CAPS BBS ──
        if (foundationPlan.combinedPileCaps && foundationPlan.combinedPileCaps.length > 0) {
          function parseRebarCallout(callout: string | undefined): { dia: number; spacing: number } | null {
            if (!callout) return null;
            const m = callout.match(/(?:T|Ø)?\s*(\d+)\s*(?:mm)?\s*@\s*(\d+)/i);
            return m ? { dia: parseInt(m[1]), spacing: parseInt(m[2]) } : null;
          }

          const combGroups = new Map<string, { grp: any; count: number; labels: string[] }>();
          foundationPlan.combinedPileCaps.forEach((grp) => {
            const sig = `${grp.pileCount}_${grp.capLength}_${grp.capWidth}_${grp.capDepth}_${grp.botRebarCallout}_${grp.topRebarCallout}_${grp.shearWallStirrupCallout}`;
            if (!combGroups.has(sig)) {
              combGroups.set(sig, { grp, count: 0, labels: [] });
            }
            const g = combGroups.get(sig)!;
            g.count++;
            g.labels.push(grp.label || `Combined Cap ${grp.groupId}`);
          });

          combGroups.forEach((cg) => {
            const grp = cg.grp;
            const nElem = cg.count;
            const tag = nElem === 1 ? (grp.label || `Combined Cap ${grp.groupId}`) : `${grp.label || 'Combined Cap'} — ${nElem} Caps (${cg.labels.join(', ')})`;
            const capL = grp.capLength;
            const capB = grp.capWidth;
            const capD = grp.capDepth;
            const cover = 60;

            const parsedBot = parseRebarCallout(grp.botRebarCallout);
            const parsedTop = parseRebarCallout(grp.topRebarCallout);
            const parsedTie = parseRebarCallout(grp.shearWallStirrupCallout);

            const botDia = parsedBot?.dia || getBestLongDia([16, 12, 20]);
            const botSpacing = parsedBot?.spacing || 125;
            const topDia = parsedTop?.dia || getBestLongDia([12, 16, 10]);
            const topSpacing = parsedTop?.spacing || 150;
            const tieDia = parsedTie?.dia || getBestTieDia([10, 8]);
            const tieSpacing = parsedTie?.spacing || 200;

            const botA = Math.round(capD - 2 * cover);
            const botBL = Math.round(capL - 2 * cover);
            const botBB = Math.round(capB - 2 * cover);

            const botCountLong = Math.max(2, Math.floor(capB / botSpacing) + 1);
            const botLenL = botA * 2 + botBL - 4 * botDia;
            const totBotLong = nElem * botCountLong;

            items.push({
              barNo: barIndex++,
              elementCategory: 'PILE_CAP',
              elementTag: tag,
              barDescription: `Bottom Main Bars — Long Way (T${botDia} @ ${botSpacing} c/c)`,
              shapeType: 'U_BAR',
              a: botA, b: botBL, c: botA, diameter: botDia, spacing: botSpacing,
              cuttingLengthM: Number((botLenL / 1000).toFixed(2)),
              numElements: nElem, barsPerElement: botCountLong, totalCount: totBotLong,
              totalLengthM: Number((totBotLong * botLenL / 1000).toFixed(2)),
              lengthByDia: { [botDia]: Number((totBotLong * botLenL / 1000).toFixed(2)) },
            });

            const botCountShort = Math.max(2, Math.floor(capL / botSpacing) + 1);
            const botLenB = botA * 2 + botBB - 4 * botDia;
            const totBotShort = nElem * botCountShort;

            items.push({
              barNo: barIndex++,
              elementCategory: 'PILE_CAP',
              elementTag: tag,
              barDescription: `Bottom Main Bars — Short Way (T${botDia} @ ${botSpacing} c/c)`,
              shapeType: 'U_BAR',
              a: botA, b: botBB, c: botA, diameter: botDia, spacing: botSpacing,
              cuttingLengthM: Number((botLenB / 1000).toFixed(2)),
              numElements: nElem, barsPerElement: botCountShort, totalCount: totBotShort,
              totalLengthM: Number((totBotShort * botLenB / 1000).toFixed(2)),
              lengthByDia: { [botDia]: Number((totBotShort * botLenB / 1000).toFixed(2)) },
            });

            const topCountL = Math.max(2, Math.floor(capB / topSpacing) + 1);
            const topLenL = botA * 2 + botBL - 4 * topDia;
            const totTopL = nElem * topCountL;

            items.push({
              barNo: barIndex++,
              elementCategory: 'PILE_CAP',
              elementTag: tag,
              barDescription: `Top Mesh — Long Way (T${topDia} @ ${topSpacing} c/c)`,
              shapeType: 'U_BAR',
              a: botA, b: botBL, c: botA, diameter: topDia, spacing: topSpacing,
              cuttingLengthM: Number((topLenL / 1000).toFixed(2)),
              numElements: nElem, barsPerElement: topCountL, totalCount: totTopL,
              totalLengthM: Number((totTopL * topLenL / 1000).toFixed(2)),
              lengthByDia: { [topDia]: Number((totTopL * topLenL / 1000).toFixed(2)) },
            });

            const topCountB = Math.max(2, Math.floor(capL / topSpacing) + 1);
            const topLenB = botA * 2 + botBB - 4 * topDia;
            const totTopB = nElem * topCountB;

            items.push({
              barNo: barIndex++,
              elementCategory: 'PILE_CAP',
              elementTag: tag,
              barDescription: `Top Mesh — Short Way (T${topDia} @ ${topSpacing} c/c)`,
              shapeType: 'U_BAR',
              a: botA, b: botBB, c: botA, diameter: topDia, spacing: topSpacing,
              cuttingLengthM: Number((topLenB / 1000).toFixed(2)),
              numElements: nElem, barsPerElement: topCountB, totalCount: totTopB,
              totalLengthM: Number((totTopB * topLenB / 1000).toFixed(2)),
              lengthByDia: { [topDia]: Number((totTopB * topLenB / 1000).toFixed(2)) },
            });

            const tieCount = Math.max(2, Math.floor(capL / tieSpacing) + 1);
            const tiePerim = 2 * (capB - 2 * cover + capD - 2 * cover) + 24 * tieDia;
            const totTie = nElem * tieCount;

            items.push({
              barNo: barIndex++,
              elementCategory: 'PILE_CAP',
              elementTag: tag,
              barDescription: `Perimeter / Strap Ties (T${tieDia} @ ${tieSpacing} c/c)`,
              shapeType: 'RECT_TIE',
              a: capD - 2 * cover, b: capB - 2 * cover, c: 0, diameter: tieDia, spacing: tieSpacing,
              cuttingLengthM: Number((tiePerim / 1000).toFixed(2)),
              numElements: nElem, barsPerElement: tieCount, totalCount: totTie,
              totalLengthM: Number((totTie * tiePerim / 1000).toFixed(2)),
              lengthByDia: { [tieDia]: Number((totTie * tiePerim / 1000).toFixed(2)) },
            });
          });
        }
      }
    }

    // 4. EXTRACT CAST-IN-SITU BORED PILES
    // ── READ FROM SAVED PROJECT PILE TYPES (live sync with Pile Design workspace) ──
    const savedPileTypes: any[] = project?.projectPileTypes && project.projectPileTypes.length > 0
      ? project.projectPileTypes
      : [];

    // Count actual piles from foundation plan columns instead of hardcoding 4 per cap
    const pileTypeCounts: Record<string, number> = {};
    if (floorPlans.length > 0) {
      const foundationPlan = floorPlans.find((fp) => fp.isFoundationLevel);
      if (foundationPlan) {
        foundationPlan.columns.forEach((col) => {
          if (!col.pileCap) return;
          // Skip individual caps absorbed into combined pile caps
          if (foundationPlan.absorbedCombinedCapNodeIds && foundationPlan.absorbedCombinedCapNodeIds.has(col.nodeId)) return;
          const pileCount = col.pileCap.pileCount || 4;
          // Use supportPileAssignments to assign to correct pile type
          const assignedTypeId = project?.supportPileAssignments?.[col.nodeId] || (savedPileTypes.length > 0 ? savedPileTypes[0].id : 'P-1');
          pileTypeCounts[assignedTypeId] = (pileTypeCounts[assignedTypeId] || 0) + pileCount;
        });
        // Also count piles from combined pile caps
        if (foundationPlan.combinedPileCaps) {
          for (const grp of foundationPlan.combinedPileCaps) {
            const pileCount = grp.pileCount || grp.nodeIds?.length || 4;
            const assignedTypeId = savedPileTypes.length > 0 ? savedPileTypes[0].id : 'P-1';
            pileTypeCounts[assignedTypeId] = (pileTypeCounts[assignedTypeId] || 0) + pileCount;
          }
        }
      }
    }

    if (savedPileTypes.length > 0) {
      // Use actual designed pile types from the Pile Design workspace
      for (const pt of savedPileTypes) {
        const pileDiaMm: number = pt.diameter || 500;
        const pileLenM: number = pt.length || 12.0;
        const barCount: number = pt.barCount || 6;
        const barDia: number = pt.barDiameter || 16;
        const spiralDia: number = pt.spiralDiameter || 8;
        const spiralPitch: number = pt.spiralPitch || 150;
        const pileCover = 60;

        // Use actual pile counts from foundation plan + supportPileAssignments
        const totalPilesOfType = pileTypeCounts[pt.id] || 0;
        if (totalPilesOfType === 0) continue;

        // Vertical Cage Bars
        const vertLapMm = 50 * barDia;
        const vertCutM = (pileLenM * 1000 + vertLapMm) / 1000;

        items.push({
          barNo: barIndex++,
          elementCategory: 'PILE',
          elementTag: `${pt.id}: Ø${pileDiaMm}mm × ${pileLenM}m (${totalPilesOfType} nos.)`,
          barDescription: `Cast-in-situ Pile Vertical Cage Bars (${barCount}-T${barDia} + 50d Lap)`,
          shapeType: 'STRAIGHT',
          a: 0,
          b: Math.round(vertCutM * 1000),
          c: 0,
          diameter: barDia,
          cuttingLengthM: Number(vertCutM.toFixed(2)),
          numElements: totalPilesOfType,
          barsPerElement: barCount,
          totalCount: totalPilesOfType * barCount,
          totalLengthM: Number((totalPilesOfType * barCount * vertCutM).toFixed(2)),
          lengthByDia: { [barDia]: Number((totalPilesOfType * barCount * vertCutM).toFixed(2)) },
        });

        // Helical Spiral Links
        const spiralTurns = Math.ceil((pileLenM * 1000) / spiralPitch);
        const spiralPerim = Math.PI * (pileDiaMm - 2 * pileCover) / 1000;
        const spiralTotalLenM = Number((totalPilesOfType * spiralTurns * spiralPerim).toFixed(2));

        items.push({
          barNo: barIndex++,
          elementCategory: 'PILE',
          elementTag: `${pt.id}: Ø${pileDiaMm}mm × ${pileLenM}m (${totalPilesOfType} nos.)`,
          barDescription: `Cast-in-situ Pile Continuous Helical Spiral (${spiralDia}Ø@${spiralPitch} Pitch)`,
          shapeType: 'RECT_TIE',
          a: pileDiaMm - 2 * pileCover,
          b: 0,
          c: pileDiaMm - 2 * pileCover,
          diameter: spiralDia,
          spacing: spiralPitch,
          cuttingLengthM: Number((spiralTurns * spiralPerim).toFixed(2)),
          numElements: totalPilesOfType,
          barsPerElement: 1,
          totalCount: totalPilesOfType,
          totalLengthM: spiralTotalLenM,
          lengthByDia: { [spiralDia]: spiralTotalLenM },
        });
      }
    } else {
      // Fallback: estimate from model geometry with default pile design
      const totalPiles = Object.values(pileTypeCounts).reduce((sum, n) => sum + n, 0) || (model ? Array.from(model.supports.values()).length * 4 : 0);
      if (totalPiles > 0) {
        const pileLenM = 12.0;
        const pileDiaMm = 500;
        const pileVertDia = getBestLongDia([16, 12, 20]);
        const pileSpiralDia = getBestTieDia([8, 10]);
        const pileCover = 60;
        const vertCount = 6;
        const vertLapMm = 50 * pileVertDia;
        const vertCutM = (pileLenM * 1000 + vertLapMm) / 1000;

        items.push({
          barNo: barIndex++,
          elementCategory: 'PILE',
          elementTag: `P-1 to P-${totalPiles} (Ø${pileDiaMm})`,
          barDescription: `Cast-in-situ Pile Vertical Cage Bars (${vertCount}-T${pileVertDia})`,
          shapeType: 'STRAIGHT',
          a: 0, b: Math.round(vertCutM * 1000), c: 0,
          diameter: pileVertDia, cuttingLengthM: Number(vertCutM.toFixed(2)),
          numElements: totalPiles, barsPerElement: vertCount,
          totalCount: totalPiles * vertCount,
          totalLengthM: Number((totalPiles * vertCount * vertCutM).toFixed(2)),
          lengthByDia: { [pileVertDia]: Number((totalPiles * vertCount * vertCutM).toFixed(2)) },
        });

        const spiralTurns = Math.ceil((pileLenM * 1000) / 150);
        const spiralPerim = Math.PI * (pileDiaMm - 2 * pileCover) / 1000;
        const spiralTotalLenM = Number((totalPiles * spiralTurns * spiralPerim).toFixed(2));
        items.push({
          barNo: barIndex++,
          elementCategory: 'PILE',
          elementTag: `P-1 to P-${totalPiles} (Ø${pileDiaMm})`,
          barDescription: `Cast-in-situ Pile Helical Spiral (${pileSpiralDia}Ø@150)`,
          shapeType: 'RECT_TIE',
          a: pileDiaMm - 2 * pileCover, b: 0, c: pileDiaMm - 2 * pileCover,
          diameter: pileSpiralDia, spacing: 150,
          cuttingLengthM: Number((spiralTurns * spiralPerim).toFixed(2)),
          numElements: totalPiles, barsPerElement: 1, totalCount: totalPiles,
          totalLengthM: spiralTotalLenM,
          lengthByDia: { [pileSpiralDia]: spiralTotalLenM },
        });
      }
    }

    // 5. EXTRACT DUCTILE SHEAR WALLS
    // ── READ FROM SAVED SHEAR WALL DESIGNS (live sync with ShearWall Design workspace) ──
    const savedSwDesigns: Record<number, any> = project?.savedShearWallDesigns instanceof Map
      ? Object.fromEntries(project.savedShearWallDesigns)
      : (project?.savedShearWallDesigns || {});
    const savedWallIds = Object.keys(savedSwDesigns).map(Number);
    const wallPlates = model ? Array.from(model.plates.values()).filter((p) => p.classification === 'WALL') : [];

    // Use saved shear wall designs if present; otherwise fall back to vertical wall plates (NOT all plates/slabs!)
    const activeWallEntries: { id: number; design?: any; plate?: any }[] = savedWallIds.length > 0
      ? savedWallIds.map((id) => ({ id, design: savedSwDesigns[id] }))
      : wallPlates.map((wp) => ({ id: wp.id, plate: wp }));

    for (let i = 0; i < activeWallEntries.length; i++) {
      const entry = activeWallEntries[i];
      const savedSw = entry.design;
      const wallTag = `SW-${entry.id}`;

      let Lw: number;
      let tw: number;
      let Hw: number;
      let boundaryDia: number;
      let bBarsCount: number;
      let webVertDia: number;
      let webVertSpacing: number;
      let webHorizDia: number;
      let webHorizSpacing: number;
      let hoopDia: number;
      let hoopSpacing: number;
      let isBoundaryRequired: boolean;

      if (savedSw) {
        // Read geometry from saved design result
        Lw = Number(savedSw.length || savedSw.Lw || (savedSw.input?.length) || 3.2);
        tw = Number(savedSw.thickness || savedSw.tw || (savedSw.input?.thickness) || 230);
        Hw = Number(savedSw.height || savedSw.Hw || (savedSw.input?.height) || 3.5);
        // Read boundary requirement directly from saved IS 13920 audit
        isBoundaryRequired = savedSw.result?.boundary?.isBoundaryElementRequired ?? false;
        boundaryDia = savedSw.result?.boundary?.longitudinalBarDia || savedSw.result?.boundary?.rebarDiameter || getBestLongDia([16, 20, 25]);
        bBarsCount = (savedSw.result?.boundary?.longitudinalBarCount || 8) * 2; // both boundary ends
        
        webVertDia = savedSw.result?.webVerticalDia || (savedSw.result?.webVerticalRebar ? parseInt(savedSw.result.webVerticalRebar.match(/T(\d+)/)?.[1] || '10', 10) : getBestTieDia([10, 8]));
        webVertSpacing = savedSw.result?.webVerticalSpacing || 150;
        
        webHorizDia = savedSw.result?.webHorizontalDia || (savedSw.result?.webHorizontalRebar ? parseInt(savedSw.result.webHorizontalRebar.match(/T(\d+)/)?.[1] || '10', 10) : getBestTieDia([10, 8]));
        webHorizSpacing = savedSw.result?.webHorizontalSpacing || 150;

        hoopDia = savedSw.result?.boundary?.confiningHoopDia || getBestTieDia([8, 10]);
        hoopSpacing = savedSw.result?.boundary?.confiningHoopSpacing || 100;

        // Clamp to allowed inventory
        if (!allowedLong.includes(boundaryDia)) boundaryDia = getBestLongDia([boundaryDia, 16, 20, 25]);
        if (!allowedTies.includes(webVertDia)) webVertDia = getBestTieDia([webVertDia, 10, 8]);
        if (!allowedTies.includes(webHorizDia)) webHorizDia = getBestTieDia([webHorizDia, 10, 8]);
        if (!allowedTies.includes(hoopDia)) hoopDia = getBestTieDia([hoopDia, 8, 10]);
      } else {
        Lw = 3.2;
        tw = entry.plate?.thickness ? Math.round(entry.plate.thickness * 1000) : 230;
        Hw = 3.5;
        isBoundaryRequired = false;
        boundaryDia = getBestLongDia([16, 20, 25]);
        bBarsCount = 16;
        webVertDia = getBestTieDia([10, 8]);
        webVertSpacing = 150;
        webHorizDia = getBestTieDia([10, 8]);
        webHorizSpacing = 150;
        hoopDia = getBestTieDia([8, 10]);
        hoopSpacing = 100;
      }

      // Boundary element vertical bars — ONLY when IS 13920 requires boundary elements (σc > 0.2 fck)
      if (isBoundaryRequired) {
        const bCutM = (Hw * 1000 + 50 * boundaryDia + 150) / 1000;
        items.push({
          barNo: barIndex++,
          elementCategory: 'SHEAR_WALL',
          elementTag: wallTag,
          barDescription: `Ductile Boundary Element Vertical Cages (${bBarsCount}-T${boundaryDia})`,
          shapeType: 'STRAIGHT',
          a: 0,
          b: Math.round(bCutM * 1000),
          c: 0,
          diameter: boundaryDia,
          cuttingLengthM: Number(bCutM.toFixed(2)),
          numElements: 1,
          barsPerElement: bBarsCount,
          totalCount: bBarsCount,
          totalLengthM: Number((bBarsCount * bCutM).toFixed(2)),
          lengthByDia: { [boundaryDia]: Number((bBarsCount * bCutM).toFixed(2)) },
        });
      }

      // Web Double-Curtain Vertical & Horizontal Mesh — always required (2 curtains)
      const vertMeshCount = Math.ceil(Lw / (webVertSpacing / 1000)) * 2;
      const horizMeshCount = Math.ceil(Hw / (webHorizSpacing / 1000)) * 2;
      const vertLenM = Number((vertMeshCount * Hw).toFixed(2));
      const horizLenM = Number((horizMeshCount * Lw).toFixed(2));

      if (webVertDia === webHorizDia) {
        const totalWebLenM = Number((vertLenM + horizLenM).toFixed(2));
        items.push({
          barNo: barIndex++,
          elementCategory: 'SHEAR_WALL',
          elementTag: wallTag,
          barDescription: `Web Double-Curtain Orthogonal Mesh (2-Curtains T${webVertDia}@${webVertSpacing} c/c)`,
          shapeType: 'STRAIGHT',
          a: 0,
          b: Math.round(Math.max(Lw, Hw) * 1000),
          c: 0,
          diameter: webVertDia,
          spacing: webVertSpacing,
          cuttingLengthM: Number(Math.max(Lw, Hw).toFixed(2)),
          numElements: 1,
          barsPerElement: vertMeshCount + horizMeshCount,
          totalCount: vertMeshCount + horizMeshCount,
          totalLengthM: totalWebLenM,
          lengthByDia: { [webVertDia]: totalWebLenM },
        });
      } else {
        items.push({
          barNo: barIndex++,
          elementCategory: 'SHEAR_WALL',
          elementTag: wallTag,
          barDescription: `Web Double-Curtain Vertical Rebar (2-Curtains T${webVertDia}@${webVertSpacing} c/c)`,
          shapeType: 'STRAIGHT',
          a: 0,
          b: Math.round(Hw * 1000),
          c: 0,
          diameter: webVertDia,
          spacing: webVertSpacing,
          cuttingLengthM: Number(Hw.toFixed(2)),
          numElements: 1,
          barsPerElement: vertMeshCount,
          totalCount: vertMeshCount,
          totalLengthM: vertLenM,
          lengthByDia: { [webVertDia]: vertLenM },
        });
        items.push({
          barNo: barIndex++,
          elementCategory: 'SHEAR_WALL',
          elementTag: wallTag,
          barDescription: `Web Double-Curtain Horizontal Ties (2-Curtains T${webHorizDia}@${webHorizSpacing} c/c)`,
          shapeType: 'STRAIGHT',
          a: 0,
          b: Math.round(Lw * 1000),
          c: 0,
          diameter: webHorizDia,
          spacing: webHorizSpacing,
          cuttingLengthM: Number(Lw.toFixed(2)),
          numElements: 1,
          barsPerElement: horizMeshCount,
          totalCount: horizMeshCount,
          totalLengthM: horizLenM,
          lengthByDia: { [webHorizDia]: horizLenM },
        });
      }

      // Confining Boundary Hoops — ONLY when boundary element is required
      if (isBoundaryRequired) {
        const hoopPerimeter = 2 * (0.45 + (tw / 1000));
        const hoopCount = Math.ceil(Hw / (hoopSpacing / 1000)) * 2;
        const hoopCutM = hoopPerimeter;
        items.push({
          barNo: barIndex++,
          elementCategory: 'SHEAR_WALL',
          elementTag: wallTag,
          barDescription: `Special Confining Boundary Hoops (${hoopDia}Ø@${hoopSpacing} c/c)`,
          shapeType: 'RECT_TIE',
          a: 450,
          b: 0,
          c: tw,
          diameter: hoopDia,
          spacing: hoopSpacing,
          cuttingLengthM: Number(hoopCutM.toFixed(2)),
          numElements: 1,
          barsPerElement: hoopCount,
          totalCount: hoopCount,
          totalLengthM: Number((hoopCount * hoopCutM).toFixed(2)),
          lengthByDia: { [hoopDia]: Number((hoopCount * hoopCutM).toFixed(2)) },
        });
      }
    }

    // 6. CALCULATE DIAMETER TOTALS & CATEGORY MATRIX
    const summaryMap = new Map<number, { totalLen: number }>();
    this.STANDARD_DIAMETERS.forEach((d) => summaryMap.set(d, { totalLen: 0 }));

    const categoryWeightMap: { [cat: string]: number } = {
      BEAM: 0,
      COLUMN: 0,
      PILE_CAP: 0,
      GRADE_BEAM: 0,
      PILE: 0,
      SHEAR_WALL: 0,
      SLAB: 0,
    };

    const byCategoryDiameterMatrix: { [category in BbsElementCategory]?: { [dia: number]: number } } = {};
    const allCategories: BbsElementCategory[] = ['PILE', 'PILE_CAP', 'GRADE_BEAM', 'COLUMN', 'BEAM', 'SHEAR_WALL', 'SLAB'];
    allCategories.forEach((cat) => {
      byCategoryDiameterMatrix[cat] = {};
      this.STANDARD_DIAMETERS.forEach((d) => {
        byCategoryDiameterMatrix[cat]![d] = 0;
      });
    });

    let grandTotalLengthM = 0;
    let grandTotalWeightKg = 0;

    items.forEach((item) => {
      grandTotalLengthM += item.totalLengthM;
      const unitWt = (item.diameter * item.diameter) / 162.2;
      const wtKg = item.totalLengthM * unitWt;
      grandTotalWeightKg += wtKg;

      categoryWeightMap[item.elementCategory] = (categoryWeightMap[item.elementCategory] || 0) + wtKg;

      if (!byCategoryDiameterMatrix[item.elementCategory]) {
        byCategoryDiameterMatrix[item.elementCategory] = {};
      }
      byCategoryDiameterMatrix[item.elementCategory]![item.diameter] =
        (byCategoryDiameterMatrix[item.elementCategory]![item.diameter] || 0) + wtKg;

      const current = summaryMap.get(item.diameter) || { totalLen: 0 };
      current.totalLen += item.totalLengthM;
      summaryMap.set(item.diameter, current);
    });

    const diameterSummaries: BbsDiameterSummary[] = this.STANDARD_DIAMETERS.map((d) => {
      const len = summaryMap.get(d)?.totalLen || 0;
      const unitWt = (d * d) / 162.2;
      const wtKg = len * unitWt;
      return {
        diameter: d,
        unitWeightKgM: Number(unitWt.toFixed(3)),
        totalLengthM: Number(len.toFixed(2)),
        totalWeightKg: Number(wtKg.toFixed(2)),
        totalWeightMT: Number((wtKg / 1000).toFixed(3)),
      };
    });

    return {
      projectName,
      engineer,
      docNo: 'BBS-STR-001',
      refDwgNo: 'STR-100 / STR-101',
      revision: 'REV-A',
      status: 'APPROVED FOR CONSTRUCTION',
      date: dateStr,
      items,
      diameterSummaries,
      grandTotalLengthM: Number(grandTotalLengthM.toFixed(2)),
      grandTotalWeightKg: Number(grandTotalWeightKg.toFixed(2)),
      grandTotalWeightMT: Number((grandTotalWeightKg / 1000).toFixed(2)),
      byCategoryWeightKg: categoryWeightMap,
      byCategoryDiameterMatrix,
    };
  }
}
