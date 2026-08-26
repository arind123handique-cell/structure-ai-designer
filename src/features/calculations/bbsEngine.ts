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

    // 1. EXTRACT BEAMS
    // ── READ FROM SAVED BEAM DESIGNS first (live sync with Beam Design workspace) ──
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
      // Elevated Framing Beams
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
        let liveCurtailment: any = null; // capture from live design for extra bars

        if (savedBm) {
          const cur = savedBm.curtailment || savedBm;
          botDia = cur.throughBottom?.diameter || savedBm.botDia || getBestLongDia([16, 12, 20]);
          botCount = cur.throughBottom?.count || savedBm.botCount || 2;
          topDia = cur.throughTop?.diameter || savedBm.topDia || getBestLongDia([12, 16, 20]);
          topCount = cur.throughTop?.count || savedBm.topCount || 2;
          stirrupDia = savedBm.shear?.stirrupDia || savedBm.stirrupDia || getBestTieDia([8, 10]);
          stirrupSpacing = savedBm.shear?.spacing_prov || savedBm.stirrupSpacing || 125;
          LdMm = savedBm.developmentLength || 45 * botDia;
          // Ensure within allowed inventory
          if (!allowedLong.includes(botDia)) botDia = getBestLongDia([botDia, 16, 12, 20]);
          if (!allowedLong.includes(topDia)) topDia = getBestLongDia([topDia, 12, 16, 20]);
          if (!allowedTies.includes(stirrupDia)) stirrupDia = getBestTieDia([stirrupDia, 8, 10]);
        } else {
          // Auto design representative beam reinforcement
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

        const anchorHookMm = Math.max(200, Math.min(DMm - 2 * cover, Math.round(LdMm * 0.4)));
        const botA = anchorHookMm;
        const botB = Math.round(spanM * 1000 - 2 * cover);
        const botCutM = Math.max(0.5, (botA * 2 + botB - 4 * botDia) / 1000);

        items.push({
          barNo: barIndex++,
          elementCategory: 'BEAM',
          elementTag: `${beam.label} (${fp.levelName.split(' ')[0]})`,
          barDescription: `Bottom Main Through Bars (${botCount}-T${botDia})`,
          shapeType: 'U_BAR',
          a: botA,
          b: botB,
          c: botA,
          diameter: botDia,
          cuttingLengthM: Number(botCutM.toFixed(2)),
          numElements: 1,
          barsPerElement: botCount,
          totalCount: botCount,
          totalLengthM: Number((botCount * botCutM).toFixed(2)),
          lengthByDia: { [botDia]: Number((botCount * botCutM).toFixed(2)) },
        });

        // Item 2: Top Hanger Continuous Bars (topDia/topCount already resolved above)
        const topA = anchorHookMm;
        const topB = Math.round(spanM * 1000 - 2 * cover);
        const topCutM = Math.max(0.5, (topA * 2 + topB - 4 * topDia) / 1000);

        items.push({
          barNo: barIndex++,
          elementCategory: 'BEAM',
          elementTag: `${beam.label} (${fp.levelName.split(' ')[0]})`,
          barDescription: `Top Continuous Hanger Bars (${topCount}-T${topDia})`,
          shapeType: 'U_BAR',
          a: topA,
          b: topB,
          c: topA,
          diameter: topDia,
          cuttingLengthM: Number(topCutM.toFixed(2)),
          numElements: 1,
          barsPerElement: topCount,
          totalCount: topCount,
          totalLengthM: Number((topCount * topCutM).toFixed(2)),
          lengthByDia: { [topDia]: Number((topCount * topCutM).toFixed(2)) },
        });

        // Item 3: Extra Bottom Midspan Bars (if curtailment design provides them)
        const curForExtra = savedBm?.curtailment || liveCurtailment;
        if (curForExtra?.extraBottomMidspan?.hasExtra && curForExtra.extraBottomMidspan.count > 0) {
          const ebDia = curForExtra.extraBottomMidspan.diameter || botDia;
          const ebCount = curForExtra.extraBottomMidspan.count;
          const ebLenM = curForExtra.extraBottomMidspan.length || (spanM / 3);
          const ebB = Math.round(ebLenM * 1000);
          const ebCutM = Math.max(0.3, (ebB + 2 * 50) / 1000);
          items.push({
            barNo: barIndex++,
            elementCategory: 'BEAM',
            elementTag: `${beam.label} (${fp.levelName.split(' ')[0]})`,
            barDescription: `Extra Bottom Midspan Bars (${ebCount}-T${ebDia})`,
            shapeType: 'STRAIGHT',
            a: 0, b: ebB, c: 0,
            diameter: ebDia,
            cuttingLengthM: Number(ebCutM.toFixed(2)),
            numElements: 1, barsPerElement: ebCount, totalCount: ebCount,
            totalLengthM: Number((ebCount * ebCutM).toFixed(2)),
            lengthByDia: { [ebDia]: Number((ebCount * ebCutM).toFixed(2)) },
          });
        }

        // Item 4 (saved path): Top Extra Support Bars — read from saved design curtailment
        if (savedBm) {
          // Read from saved design curtailment
          const curExtra = savedBm.curtailment?.extraTopSupport;
          if (curExtra?.hasExtra && curExtra.count > 0) {
            const exDia = curExtra.diameter || getBestLongDia([16, 20, 25]);
            const exCount = curExtra.count;
            const exCutoffM = curExtra.cutoffLength || (spanM / 3);
            const exA = anchorHookMm;
            const exB = Math.round(exCutoffM * 1000 + LdMm);
            const exCutM = Math.max(0.4, (exA + exB - 2 * exDia) / 1000);
            items.push({
              barNo: barIndex++,
              elementCategory: 'BEAM',
              elementTag: `${beam.label} (${fp.levelName.split(' ')[0]})`,
              barDescription: `Top Extra Support Bars (${exCount}-T${exDia})`,
              shapeType: 'L_BAR',
              a: exA, b: exB, c: 0,
              diameter: exDia,
              cuttingLengthM: Number(exCutM.toFixed(2)),
              numElements: 1, barsPerElement: exCount, totalCount: exCount,
              totalLengthM: Number((exCount * exCutM).toFixed(2)),
              lengthByDia: { [exDia]: Number((exCount * exCutM).toFixed(2)) },
            });
          }
        } else {
          const exDia = getBestLongDia([16, 20, 25]);
          const exA = anchorHookMm;
          const exB = Math.round((spanM / 3) * 1000 + LdMm);
          const exCutM = Math.max(0.4, (exA + exB - 2 * exDia) / 1000);
          items.push({
            barNo: barIndex++,
            elementCategory: 'BEAM',
            elementTag: `${beam.label} (${fp.levelName.split(' ')[0]})`,
            barDescription: `Top Extra Support Bars (2-T${exDia})`,
            shapeType: 'L_BAR',
            a: exA, b: exB, c: 0,
            diameter: exDia,
            cuttingLengthM: Number(exCutM.toFixed(2)),
            numElements: 1, barsPerElement: 2, totalCount: 2,
            totalLengthM: Number((2 * exCutM).toFixed(2)),
            lengthByDia: { [exDia]: Number((2 * exCutM).toFixed(2)) },
          });
        }

        // Item 5: 2-Legged Closed Shear Stirrups (stirrupDia/stirrupSpacing already resolved above)
        const stirrupA = Math.round(DMm - 2 * cover - stirrupDia);
        const stirrupC = Math.round(bMm - 2 * cover - stirrupDia);
        const stirrupCutM = Math.max(0.4, (2 * (stirrupA + stirrupC) + 24 * stirrupDia - 6 * stirrupDia) / 1000);
        const stirrupCount = Math.max(4, Math.round((spanM * 1000) / stirrupSpacing) + 1);

        items.push({
          barNo: barIndex++,
          elementCategory: 'BEAM',
          elementTag: `${beam.label} (${fp.levelName.split(' ')[0]})`,
          barDescription: `2-Legged Closed Stirrups (${stirrupDia}Ø@${stirrupSpacing} c/c)`,
          shapeType: 'RECT_TIE',
          a: stirrupA,
          b: 0,
          c: stirrupC,
          diameter: stirrupDia,
          spacing: stirrupSpacing,
          cuttingLengthM: Number(stirrupCutM.toFixed(2)),
          numElements: 1,
          barsPerElement: stirrupCount,
          totalCount: stirrupCount,
          totalLengthM: Number((stirrupCount * stirrupCutM).toFixed(2)),
          lengthByDia: { [stirrupDia]: Number((stirrupCount * stirrupCutM).toFixed(2)) },
        });
      });

      // Grade Beams (Foundation Level)
      if (fp.isFoundationLevel) {
        fp.gradeBeams.forEach((gb) => {
          const spanM = gb.length || 5.0;
          const bMm = gb.width || 300;
          const DMm = gb.depth || 450;
          const cover = 40;

          // Bottom Bars: 3-T16
          const botDia = getBestLongDia([16, 12, 20]);
          const botCount = 3;
          const botA = Math.round(DMm - 2 * cover);
          const botB = Math.round(spanM * 1000 - 2 * cover);
          const botCutM = (botA * 2 + botB - 4 * botDia) / 1000;

          items.push({
            barNo: barIndex++,
            elementCategory: 'GRADE_BEAM',
            elementTag: `${gb.gradeBeamId} (Plinth)`,
            barDescription: `Grade Beam Bottom Main Bars (${botCount}-T${botDia})`,
            shapeType: 'U_BAR',
            a: botA,
            b: botB,
            c: botA,
            diameter: botDia,
            cuttingLengthM: Number(botCutM.toFixed(2)),
            numElements: 1,
            barsPerElement: botCount,
            totalCount: botCount,
            totalLengthM: Number((botCount * botCutM).toFixed(2)),
            lengthByDia: { [botDia]: Number((botCount * botCutM).toFixed(2)) },
          });

          // Top Bars: 3-T16
          const topCutM = botCutM;
          items.push({
            barNo: barIndex++,
            elementCategory: 'GRADE_BEAM',
            elementTag: `${gb.gradeBeamId} (Plinth)`,
            barDescription: `Grade Beam Top Main Bars (${botCount}-T${botDia})`,
            shapeType: 'U_BAR',
            a: botA,
            b: botB,
            c: botA,
            diameter: botDia,
            cuttingLengthM: Number(topCutM.toFixed(2)),
            numElements: 1,
            barsPerElement: botCount,
            totalCount: botCount,
            totalLengthM: Number((botCount * topCutM).toFixed(2)),
            lengthByDia: { [botDia]: Number((botCount * topCutM).toFixed(2)) },
          });

          // Ties: 8Ø@150
          const tieDia = getBestTieDia([8, 10]);
          const tieSpacing = 150;
          const tieA = Math.round(DMm - 2 * cover);
          const tieC = Math.round(bMm - 2 * cover);
          const tieCutM = (2 * (tieA + tieC) + 24 * tieDia - 6 * tieDia) / 1000;
          const tieCount = Math.round((spanM * 1000) / tieSpacing) + 1;

          items.push({
            barNo: barIndex++,
            elementCategory: 'GRADE_BEAM',
            elementTag: `${gb.gradeBeamId} (Plinth)`,
            barDescription: `Grade Beam Closed Ties (${tieDia}Ø@150 c/c)`,
            shapeType: 'RECT_TIE',
            a: tieA,
            b: 0,
            c: tieC,
            diameter: tieDia,
            spacing: tieSpacing,
            cuttingLengthM: Number(tieCutM.toFixed(2)),
            numElements: 1,
            barsPerElement: tieCount,
            totalCount: tieCount,
            totalLengthM: Number((tieCount * tieCutM).toFixed(2)),
            lengthByDia: { [tieDia]: Number((tieCount * tieCutM).toFixed(2)) },
          });
        });
      }
    });

    // 2. EXTRACT COLUMNS
    // ── READ FROM SAVED COLUMN DESIGNS first (live sync with Column Design workspace) ──
    const savedColDesigns: Record<number, any> = project?.savedColumnDesigns || {};
    const customColOverrides: Record<number, any> = project?.customColumnRebarOverrides || {};
    if (floorPlans.length > 0) {
      const colProcessed = new Set<string>();
      floorPlans.forEach((fp) => {
        fp.columns.forEach((col) => {
          // Dedup by memberId (unique per physical column member) to prevent
          // double-counting when the same member appears on two floor plans
          const colKey = String(col.memberId || `${fp.levelIndex}_${col.columnSlNo}`);
          if (colProcessed.has(colKey)) return;
          colProcessed.add(colKey);

          const bMm = Math.round((col.width || 0.45) * 1000);
          const DMm = Math.round((col.depth || 0.55) * 1000);
          const cover = 40;

          // Compute actual storey height from model geometry
          let storeyHeightM = 3.5; // fallback
          if (model && col.memberId) {
            const member = model.members.get(col.memberId);
            if (member) {
              const n1 = model.nodes.get(member.startNodeId);
              const n2 = model.nodes.get(member.endNodeId);
              if (n1 && n2) {
                storeyHeightM = Math.abs(n2.y - n1.y);
              }
            }
          }

          const colKeyLookup = col.memberId || col.columnSlNo;
          // Prefer saved design result; fall back to custom overrides; then live design engine
          const savedDes = savedColDesigns[colKeyLookup];
          const customOverride = customColOverrides[colKeyLookup];
          let mainDia: number;
          let mainCount: number;
          let tieDia: number;

          if (savedDes) {
            // Read directly from saved design
            mainDia = savedDes.rebar?.cornerBars?.diameter || savedDes.mainDia || getBestLongDia([16, 12, 20]);
            mainCount = savedDes.rebar?.totalBars || savedDes.totalBars || 8;
            tieDia = savedDes.rebar?.ties?.diameter || savedDes.tieDia || getBestTieDia([8, 10]);
            // Ensure selected diameters are within allowed rebar inventory
            if (!allowedLong.includes(mainDia)) mainDia = getBestLongDia([mainDia, 16, 12, 20]);
            if (!allowedTies.includes(tieDia)) tieDia = getBestTieDia([tieDia, 8, 10]);
          } else if (customOverride) {
            // User overrode rebar but didn't save full design
            mainDia = customOverride.diameter || getBestLongDia([16, 12, 20]);
            mainCount = customOverride.count || 8;
            tieDia = customOverride.tieDiameter || getBestTieDia([8, 10]);
            if (!allowedLong.includes(mainDia)) mainDia = getBestLongDia([mainDia, 16, 12, 20]);
            if (!allowedTies.includes(tieDia)) tieDia = getBestTieDia([tieDia, 8, 10]);
          } else {
            // Run Column Design with allowed longitudinal diameters
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

          const lapLengthMm = Math.round(50 * mainDia); // 50d lap as per IS 13920 / IS 456
          const bearingMm = col.isGroundSupport ? 150 : 0; // 150mm bearing only at foundation
          const colCutM = (storeyHeightM * 1000 + lapLengthMm + bearingMm) / 1000;

          items.push({
            barNo: barIndex++,
            elementCategory: 'COLUMN',
            elementTag: `${col.label} (${fp.levelName.split(' ')[0]})`,
            barDescription: `Column Main Longitudinal Bars (${mainCount}-T${mainDia} + 50d Lap)`,
            shapeType: 'STRAIGHT',
            a: 0,
            b: Math.round(colCutM * 1000),
            c: 0,
            diameter: mainDia,
            cuttingLengthM: Number(colCutM.toFixed(2)),
            numElements: 1,
            barsPerElement: mainCount,
            totalCount: mainCount,
            totalLengthM: Number((mainCount * colCutM).toFixed(2)),
            lengthByDia: { [mainDia]: Number((mainCount * colCutM).toFixed(2)) },
          });

          // Outer Rectangular Tie
          const tieA = Math.round(DMm - 2 * cover);
          const tieC = Math.round(bMm - 2 * cover);
          const tieCutM = (2 * (tieA + tieC) + 24 * tieDia - 6 * tieDia) / 1000;
          const tieCount = Math.round((storeyHeightM * 1000) / 125) + 1;

          items.push({
            barNo: barIndex++,
            elementCategory: 'COLUMN',
            elementTag: `${col.label} (${fp.levelName.split(' ')[0]})`,
            barDescription: `Ductile Transverse Outer Ties (${tieDia}Ø@100/150 c/c)`,
            shapeType: 'RECT_TIE',
            a: tieA,
            b: 0,
            c: tieC,
            diameter: tieDia,
            spacing: 125,
            cuttingLengthM: Number(tieCutM.toFixed(2)),
            numElements: 1,
            barsPerElement: tieCount,
            totalCount: tieCount,
            totalLengthM: Number((tieCount * tieCutM).toFixed(2)),
            lengthByDia: { [tieDia]: Number((tieCount * tieCutM).toFixed(2)) },
          });

          // Internal Diamond / Cross Ties
          const crossTieA = Math.round(Math.hypot(tieA / 2, tieC / 2) * 2);
          const crossTieCutM = (2 * crossTieA + 24 * tieDia - 6 * tieDia) / 1000;
          items.push({
            barNo: barIndex++,
            elementCategory: 'COLUMN',
            elementTag: `${col.label} (${fp.levelName.split(' ')[0]})`,
            barDescription: `Internal Diamond Cross Ties (${tieDia}Ø@125 c/c)`,
            shapeType: 'DIAMOND_TIE',
            a: Math.round(tieA / 2),
            b: 0,
            c: Math.round(tieC / 2),
            diameter: tieDia,
            spacing: 125,
            cuttingLengthM: Number(crossTieCutM.toFixed(2)),
            numElements: 1,
            barsPerElement: tieCount,
            totalCount: tieCount,
            totalLengthM: Number((tieCount * crossTieCutM).toFixed(2)),
            lengthByDia: { [tieDia]: Number((tieCount * crossTieCutM).toFixed(2)) },
          });

          // Starter Dowels (if ground support column entering foundation)
          if (col.isGroundSupport) {
            const starterDia = mainDia;
            const starterCount = mainCount;
            const starterA = 300;
            const starterB = Math.round(1000 + lapLengthMm);
            const starterCutM = (starterA + starterB - 2 * starterDia) / 1000;

            items.push({
              barNo: barIndex++,
              elementCategory: 'COLUMN',
              elementTag: `${col.label} (Foundation)`,
              barDescription: `Foundation Column Starter Dowels (${starterCount}-T${starterDia} with 300mm Leg)`,
              shapeType: 'L_BAR',
              a: starterA,
              b: starterB,
              c: 0,
              diameter: starterDia,
              cuttingLengthM: Number(starterCutM.toFixed(2)),
              numElements: 1,
              barsPerElement: starterCount,
              totalCount: starterCount,
              totalLengthM: Number((starterCount * starterCutM).toFixed(2)),
              lengthByDia: { [starterDia]: Number((starterCount * starterCutM).toFixed(2)) },
            });
          }
        });
      });
    }

    // 3. EXTRACT PILE CAPS & FOUNDATIONS
    if (floorPlans.length > 0) {
      const foundationPlan = floorPlans.find((fp) => fp.isFoundationLevel);
      if (foundationPlan) {
        foundationPlan.columns.forEach((col) => {
          if (!col.pileCap) return;
          // Skip individual caps whose columns are absorbed into a combined pile cap
          if (foundationPlan.absorbedCombinedCapNodeIds && foundationPlan.absorbedCombinedCapNodeIds.has(col.nodeId)) return;
          const cap = col.pileCap;
          const LMm = cap.capLength || 1900;
          const BMm = cap.capWidth || 1900;
          const DMm = cap.capDepth || 750;
          const cover = 60;
          const isPentagon = cap.pileCount === 5 || cap.capShape === 'PENTAGONAL';
          const markLabel = `PC${Math.max(1, (cap.pileCount || 4) - 1)}`;
          const colLabel = col.label || `C${col.columnSlNo}`;
          const tag = `${markLabel} (${colLabel})`;

          // Parse rebar callout from design (e.g. "T16 @ 125 mm c/c (Bottom Mat ...)")
          function parseRebarCallout(callout: string | undefined): { dia: number; spacing: number } | null {
            if (!callout) return null;
            const m = callout.match(/T(\d+)\s*@\s*(\d+)/i);
            return m ? { dia: parseInt(m[1]), spacing: parseInt(m[2]) } : null;
          }
          const parsedBotX = parseRebarCallout(cap.rebarCalloutX);
          const parsedBotY = parseRebarCallout(cap.rebarCalloutY);
          const parsedTop = parseRebarCallout(cap.topRebarCallout);
          const parsedSide = parseRebarCallout(cap.sideFaceRebarCallout);

          // 1. Bottom Main Rebar Mesh in X-direction (U-Bar)
          const botDia = parsedBotX?.dia || getBestLongDia([16, 12, 20]);
          const botSpacing = parsedBotX?.spacing || (isPentagon ? 125 : 150);
          const botBarsX = Math.round(BMm / botSpacing) + 1;
          const botA = Math.round(DMm - 2 * cover);
          const botB = Math.round(LMm - 2 * cover);
          const botCutM = (botA * 2 + botB - 4 * botDia) / 1000;

          items.push({
            barNo: barIndex++,
            elementCategory: 'PILE_CAP',
            elementTag: tag,
            barDescription: `Bottom Main Rebar Mesh X-Dir (T${botDia}@${botSpacing} c/c)`,
            shapeType: 'U_BAR',
            a: botA,
            b: botB,
            c: botA,
            diameter: botDia,
            spacing: botSpacing,
            cuttingLengthM: Number(botCutM.toFixed(2)),
            numElements: 1,
            barsPerElement: botBarsX,
            totalCount: botBarsX,
            totalLengthM: Number((botBarsX * botCutM).toFixed(2)),
            lengthByDia: { [botDia]: Number((botBarsX * botCutM).toFixed(2)) },
          });

          // 2. Bottom Main Rebar Mesh in Y-direction (U-Bar)
          const botDiaY = parsedBotY?.dia || botDia;
          const botSpacingY = parsedBotY?.spacing || botSpacing;
          const botBarsY = Math.round(LMm / botSpacingY) + 1;
          const botBY = Math.round(BMm - 2 * cover);
          const botCutMY = (botA * 2 + botBY - 4 * botDiaY) / 1000;

          items.push({
            barNo: barIndex++,
            elementCategory: 'PILE_CAP',
            elementTag: tag,
            barDescription: `Bottom Main Rebar Mesh Y-Dir (T${botDiaY}@${botSpacingY} c/c)`,
            shapeType: 'U_BAR',
            a: botA,
            b: botBY,
            c: botA,
            diameter: botDiaY,
            spacing: botSpacingY,
            cuttingLengthM: Number(botCutMY.toFixed(2)),
            numElements: 1,
            barsPerElement: botBarsY,
            totalCount: botBarsY,
            totalLengthM: Number((botBarsY * botCutMY).toFixed(2)),
            lengthByDia: { [botDiaY]: Number((botBarsY * botCutMY).toFixed(2)) },
          });

          // 3. Top Shrinkage Rebar Mesh X-Dir (U-Bar with downward legs)
          const topDia = parsedTop?.dia || getBestLongDia([12, 16, 10]);
          const topSpacing = parsedTop?.spacing || 150;
          const topBarsX = Math.round(BMm / topSpacing) + 1;
          const topA = Math.round(DMm - 2 * cover);
          const topB = Math.round(LMm - 2 * cover);
          const topCutMX = (topA * 2 + topB - 4 * topDia) / 1000;

          items.push({
            barNo: barIndex++,
            elementCategory: 'PILE_CAP',
            elementTag: tag,
            barDescription: `Top Shrinkage Rebar Mesh X-Dir (T${topDia}@${topSpacing} c/c)`,
            shapeType: 'U_BAR',
            a: topA,
            b: topB,
            c: topA,
            diameter: topDia,
            spacing: topSpacing,
            cuttingLengthM: Number(topCutMX.toFixed(2)),
            numElements: 1,
            barsPerElement: topBarsX,
            totalCount: topBarsX,
            totalLengthM: Number((topBarsX * topCutMX).toFixed(2)),
            lengthByDia: { [topDia]: Number((topBarsX * topCutMX).toFixed(2)) },
          });

          // 4. Top Shrinkage Rebar Mesh Y-Dir (U-Bar with downward legs)
          const topBarsY = Math.round(LMm / topSpacing) + 1;
          const topBY = Math.round(BMm - 2 * cover);
          const topCutMY = (topA * 2 + topBY - 4 * topDia) / 1000;

          items.push({
            barNo: barIndex++,
            elementCategory: 'PILE_CAP',
            elementTag: tag,
            barDescription: `Top Shrinkage Rebar Mesh Y-Dir (T${topDia}@${topSpacing} c/c)`,
            shapeType: 'U_BAR',
            a: topA,
            b: topBY,
            c: topA,
            diameter: topDia,
            spacing: topSpacing,
            cuttingLengthM: Number(topCutMY.toFixed(2)),
            numElements: 1,
            barsPerElement: topBarsY,
            totalCount: topBarsY,
            totalLengthM: Number((topBarsY * topCutMY).toFixed(2)),
            lengthByDia: { [topDia]: Number((topBarsY * topCutMY).toFixed(2)) },
          });

          // 5. Side Face Skin Ties (from design callout)
          const sideDia = parsedSide?.dia || getBestTieDia([10, 8]);
          const sideCount = (() => {
            if (cap.sideFaceRebarCallout) {
              const m = cap.sideFaceRebarCallout.match(/^(\d+)-/);
              if (m) return parseInt(m[1]);
            }
            return 3;
          })();
          let sideCutM = 0;
          let shapeType: BarShapeType = 'RECT_TIE';

          if (isPentagon) {
            shapeType = 'PENTAGON_TIE';
            sideCutM = (5 * 1461 + 24 * sideDia) / 1000;
          } else {
            shapeType = 'RECT_TIE';
            sideCutM = (2 * (LMm - 2 * cover + BMm - 2 * cover) + 24 * sideDia) / 1000;
          }

          items.push({
            barNo: barIndex++,
            elementCategory: 'PILE_CAP',
            elementTag: tag,
            barDescription: `Side Face Skin Reinforcement Ties (${sideCount}-T${sideDia})`,
            shapeType,
            a: isPentagon ? 1461 : Math.round(DMm / 4),
            b: isPentagon ? 1461 : Math.round(LMm - 2 * cover),
            c: isPentagon ? 1461 : Math.round(BMm - 2 * cover),
            diameter: sideDia,
            cuttingLengthM: Number(sideCutM.toFixed(2)),
            numElements: 1,
            barsPerElement: sideCount,
            totalCount: sideCount,
            totalLengthM: Number((sideCount * sideCutM).toFixed(2)),
            lengthByDia: { [sideDia]: Number((sideCount * sideCutM).toFixed(2)) },
          });
        });

        // ── 3b. COMBINED PILE CAPS BBS ──
        if (foundationPlan.combinedPileCaps && foundationPlan.combinedPileCaps.length > 0) {
          function parseRebarCallout(callout: string | undefined): { dia: number; spacing: number } | null {
            if (!callout) return null;
            const m = callout.match(/T(\d+)\s*@\s*(\d+)/i);
            return m ? { dia: parseInt(m[1]), spacing: parseInt(m[2]) } : null;
          }

          for (const grp of foundationPlan.combinedPileCaps) {
            const capL = grp.capLength;
            const capB = grp.capWidth;
            const capD = grp.capDepth;
            const cover = 60;
            const tag = grp.label || `Combined Cap ${grp.groupId}`;
            const nElem = 1;

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

            // Bottom long bars (U-Bar)
            const botCountLong = Math.max(2, Math.floor(capB / botSpacing) + 1);
            const botLenL = botA * 2 + botBL - 4 * botDia;
            items.push({
              barNo: barIndex++,
              elementCategory: 'PILE_CAP',
              elementTag: tag,
              barDescription: `Bottom Main Bars — Long Way (T${botDia} @ ${botSpacing} c/c)`,
              shapeType: 'U_BAR',
              a: botA, b: botBL, c: botA, diameter: botDia, spacing: botSpacing,
              cuttingLengthM: Number((botLenL / 1000).toFixed(2)),
              numElements: nElem, barsPerElement: botCountLong, totalCount: botCountLong,
              totalLengthM: Number((botCountLong * botLenL / 1000).toFixed(2)),
              lengthByDia: { [botDia]: Number((botCountLong * botLenL / 1000).toFixed(2)) },
            });

            // Bottom short bars (U-Bar)
            const botCountShort = Math.max(2, Math.floor(capL / botSpacing) + 1);
            const botLenB = botA * 2 + botBB - 4 * botDia;
            items.push({
              barNo: barIndex++,
              elementCategory: 'PILE_CAP',
              elementTag: tag,
              barDescription: `Bottom Main Bars — Short Way (T${botDia} @ ${botSpacing} c/c)`,
              shapeType: 'U_BAR',
              a: botA, b: botBB, c: botA, diameter: botDia, spacing: botSpacing,
              cuttingLengthM: Number((botLenB / 1000).toFixed(2)),
              numElements: nElem, barsPerElement: botCountShort, totalCount: botCountShort,
              totalLengthM: Number((botCountShort * botLenB / 1000).toFixed(2)),
              lengthByDia: { [botDia]: Number((botCountShort * botLenB / 1000).toFixed(2)) },
            });

            // Top mesh long way (U-Bar)
            const topCountL = Math.max(2, Math.floor(capB / topSpacing) + 1);
            const topLenL = botA * 2 + botBL - 4 * topDia;
            items.push({
              barNo: barIndex++,
              elementCategory: 'PILE_CAP',
              elementTag: tag,
              barDescription: `Top Mesh — Long Way (T${topDia} @ ${topSpacing} c/c)`,
              shapeType: 'U_BAR',
              a: botA, b: botBL, c: botA, diameter: topDia, spacing: topSpacing,
              cuttingLengthM: Number((topLenL / 1000).toFixed(2)),
              numElements: nElem, barsPerElement: topCountL, totalCount: topCountL,
              totalLengthM: Number((topCountL * topLenL / 1000).toFixed(2)),
              lengthByDia: { [topDia]: Number((topLenL * topCountL / 1000).toFixed(2)) },
            });

            // Top mesh short way (U-Bar)
            const topCountB = Math.max(2, Math.floor(capL / topSpacing) + 1);
            const topLenB = botA * 2 + botBB - 4 * topDia;
            items.push({
              barNo: barIndex++,
              elementCategory: 'PILE_CAP',
              elementTag: tag,
              barDescription: `Top Mesh — Short Way (T${topDia} @ ${topSpacing} c/c)`,
              shapeType: 'U_BAR',
              a: botA, b: botBB, c: botA, diameter: topDia, spacing: topSpacing,
              cuttingLengthM: Number((topLenB / 1000).toFixed(2)),
              numElements: nElem, barsPerElement: topCountB, totalCount: topCountB,
              totalLengthM: Number((topCountB * topLenB / 1000).toFixed(2)),
              lengthByDia: { [topDia]: Number((topCountB * topLenB / 1000).toFixed(2)) },
            });

            // Strap / Perimeter ties
            const tieCount = Math.max(2, Math.floor(capL / tieSpacing) + 1);
            const tiePerim = 2 * (capB - 2 * cover + capD - 2 * cover) + 24 * tieDia;
            items.push({
              barNo: barIndex++,
              elementCategory: 'PILE_CAP',
              elementTag: tag,
              barDescription: `Perimeter / Strap Ties (T${tieDia} @ ${tieSpacing} c/c)`,
              shapeType: 'RECT_TIE',
              a: capD - 2 * cover, b: capB - 2 * cover, c: 0, diameter: tieDia, spacing: tieSpacing,
              cuttingLengthM: Number((tiePerim / 1000).toFixed(2)),
              numElements: nElem, barsPerElement: tieCount, totalCount: tieCount,
              totalLengthM: Number((tieCount * tiePerim / 1000).toFixed(2)),
              lengthByDia: { [tieDia]: Number((tieCount * tiePerim / 1000).toFixed(2)) },
            });
          }
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
