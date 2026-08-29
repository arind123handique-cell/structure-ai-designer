import { NormalizedStructuralModel, Member3D, Plate3D } from '@/features/model/types';
import { ProjectMetadata } from '@/types';
import { FloorPlanEngine } from '@/features/drawings/floorPlanEngine';
import { GradeBeamDesignEngine } from '@/features/design/gradebeam/gradeBeamEngine';
import { PileCapDesignEngine } from '@/features/design/pilecap/pileCapDesignEngine';
import { CombinedPileCapEngine } from '@/features/design/pilecap/combinedPileCapEngine';
import { FootingDesignEngine } from '@/features/design/footing/footingDesignEngine';
import { ColumnDesignEngine } from '@/features/design/column/columnDesignEngine';
import { BeamDesignEngine } from '@/features/design/beam/beamDesignEngine';
import { StaircaseDesignEngine } from '@/features/design/staircase/staircaseEngine';
import { ColumnNumberingService } from '@/features/model/columnNumbering';

export interface ConcreteComponentVolume {
  id: string;
  component: string;
  category: 'SUPERSTRUCTURE' | 'SUBSTRUCTURE';
  codeRef: string;
  count: number;
  typicalDimensions: string;
  concreteGrade: string;
  concreteM3: number;
  percentageShare: number;
  formworkM2: number;
  cementBags: number;
  sandM3: number;
  sandMT: number;
  aggregateM3: number;
  aggregateMT: number;
  waterLiters: number;
  itemizedMembers?: {
    id: string | number;
    label: string;
    dimensions: string;
    lengthOrHeightM?: number;
    areaM2?: number;
    volumeM3: number;
    formworkM2: number;
    level?: string;
  }[];
}

export interface FloorConcreteVolume {
  levelIndex: number;
  levelName: string;
  elevationY: number;
  isFoundation: boolean;
  totalFloorConcreteM3: number;
  columnsConcreteM3: number;
  beamsConcreteM3: number;
  slabsConcreteM3: number;
  shearWallsConcreteM3: number;
  foundationConcreteM3: number;
  gradeBeamsConcreteM3: number;
  totalFormworkM2: number;
  totalCementBags: number;
}

export interface BuildingConcreteSummary {
  components: ConcreteComponentVolume[];
  floorBreakdown: FloorConcreteVolume[];
  grandTotalConcreteM3: number;
  substructureConcreteM3: number;
  substructurePercent: number;
  superstructureConcreteM3: number;
  superstructurePercent: number;
  totalFormworkM2: number;
  totalCementBags: number;
  totalSandM3: number;
  totalSandMT: number;
  totalAggregateM3: number;
  totalAggregateMT: number;
  totalWaterLiters: number;
}

export class ConcreteVolumeEngine {
  /**
   * Material mix factors per m³ based on IS 456 / IS 10262 standard nominal & design mixes:
   * - M25 / M30 Concrete: ~8.0 to 8.8 bags cement (50kg), 0.45 m³ sand, 0.85 m³ coarse aggregate, 180 L water
   * - M15 PCC Blinding: ~5.0 bags cement (50kg), 0.48 m³ sand, 0.90 m³ coarse aggregate, 160 L water
   */
  private static getMaterialFactors(grade: string) {
    const isM30 = grade === 'M30';
    const isM15 = grade === 'M15';
    const cementBagsPerM3 = isM30 ? 8.8 : isM15 ? 5.0 : 8.0;
    const sandM3PerM3 = isM15 ? 0.48 : 0.45;
    const sandDensityMT = 1.6; // MT per m³
    const aggM3PerM3 = isM15 ? 0.90 : 0.85;
    const aggDensityMT = 1.6; // MT per m³
    const waterLitersPerM3 = isM15 ? 160 : 180;

    return {
      cementBagsPerM3,
      sandM3PerM3,
      sandMTPerM3: sandM3PerM3 * sandDensityMT,
      aggM3PerM3,
      aggMTPerM3: aggM3PerM3 * aggDensityMT,
      waterLitersPerM3,
    };
  }

  /**
   * Calculates comprehensive, high-precision concrete volume and material take-off
   * for every structural part in the building separately.
   */
  public static calculateBuildingConcreteSummary(
    model: NormalizedStructuralModel,
    metadata?: ProjectMetadata,
    overrides?: {
      savedColumnDesigns?: Record<number, any> | Map<number, any>;
      savedBeamDesigns?: Record<number, any> | Map<number, any>;
      savedShearWallDesigns?: Record<number, any> | Map<number, any>;
      savedGradeBeamDesigns?: any[];
      savedFootingDesigns?: Record<number, any> | Map<number, any>;
      savedSlabDesigns?: Record<string, any> | Map<string, any>;
      manualMergedPileCapGroups?: number[][];
      detachedCombinedCapNodeIds?: number[];
      customCombinedCapOverrides?: Record<string, any>;
      projectPileTypes?: any[];
      customStaircaseGeometry?: any;
      customStaircaseLandingEntry?: any;
    }
  ): BuildingConcreteSummary {
    const settings = metadata?.designSettings || {
      concreteGrade: 'M25',
      steelGrade: 'Fe500D',
      clearCoverBeam: 25,
      clearCoverColumn: 40,
      clearCoverFooting: 50,
      clearCoverSlab: 20,
    };

    const mainGrade = settings.concreteGrade || 'M25';
    const fck = mainGrade === 'M30' ? 30 : 25;
    const fy = settings.steelGrade === 'Fe500D' ? 500 : 500;
    const columnMapping = ColumnNumberingService.getColumnSupportMapping(model);

    // -------------------------------------------------------------------------
    // 1. RCC COLUMNS (IS 456 / IS 13920)
    // -------------------------------------------------------------------------
    const cols = Array.from(model.members.values()).filter((m) => m.classification === 'COLUMN');
    let colsConcreteM3 = 0;
    let colsFormworkM2 = 0;
    const colItems: any[] = [];
    const savedCols = overrides?.savedColumnDesigns;

    cols.forEach((c) => {
      const saved = savedCols instanceof Map ? savedCols.get(c.id) : (savedCols as any)?.[c.id];
      const b_mm = saved?.b || Math.round((c.section.zd || 0.45) * 1000);
      const D_mm = saved?.D || Math.round((c.section.yd || 0.55) * 1000);
      const H_m = saved?.unsupportedHeight || c.length || 3.5;

      const b_m = b_mm / 1000;
      const D_m = D_mm / 1000;
      const vol = b_m * D_m * H_m;
      // Formwork for 4 vertical faces of rectangular column
      const formwork = 2 * (b_m + D_m) * H_m;

      colsConcreteM3 += vol;
      colsFormworkM2 += formwork;

      const mapInfo = columnMapping.get(c.startNodeId) || columnMapping.get(c.endNodeId);
      const label = mapInfo?.columnLabel ? `${mapInfo.columnLabel} (Mem #${c.id})` : `C-${c.id}`;

      colItems.push({
        id: c.id,
        label,
        dimensions: `${b_mm} × ${D_mm} mm`,
        lengthOrHeightM: H_m,
        volumeM3: Number(vol.toFixed(3)),
        formworkM2: Number(formwork.toFixed(2)),
      });
    });

    const colTypicalDim = cols.length > 0 ? `${colItems[0]?.dimensions || '450 × 550 mm'}` : '450 × 550 mm';

    // -------------------------------------------------------------------------
    // 2. RCC BEAMS (Elevated Framing & Roof Beams - IS 456 / IS 13920)
    // -------------------------------------------------------------------------
    const beams = Array.from(model.members.values()).filter((m) => m.classification === 'BEAM');
    let beamsConcreteM3 = 0;
    let beamsFormworkM2 = 0;
    const beamItems: any[] = [];
    const savedBms = overrides?.savedBeamDesigns;

    beams.forEach((bm) => {
      const saved = savedBms instanceof Map ? savedBms.get(bm.id) : (savedBms as any)?.[bm.id];
      const b_mm = saved?.b || Math.round((bm.section.zd || 0.30) * 1000);
      const D_mm = saved?.D || Math.round((bm.section.yd || 0.45) * 1000);
      const L_m = saved?.spanLength || bm.length || 4.5;

      const b_m = b_mm / 1000;
      const D_m = D_mm / 1000;
      const vol = b_m * D_m * L_m;
      // Formwork for beam bottom soffit + 2 vertical sides (excluding top slab junction)
      const formwork = (b_m + 2 * D_m) * L_m;

      beamsConcreteM3 += vol;
      beamsFormworkM2 += formwork;

      beamItems.push({
        id: bm.id,
        label: `B-${bm.id}`,
        dimensions: `${b_mm} × ${D_mm} mm`,
        lengthOrHeightM: L_m,
        volumeM3: Number(vol.toFixed(3)),
        formworkM2: Number(formwork.toFixed(2)),
      });
    });

    const beamTypicalDim = beams.length > 0 ? `${beamItems[0]?.dimensions || '300 × 450 mm'}` : '300 × 450 mm';

    // -------------------------------------------------------------------------
    // 3. PLINTH & GRADE TIE BEAMS (IS 456 / IS 13920 Cl. 11.2)
    // -------------------------------------------------------------------------
    const gradeBeams = (overrides?.savedGradeBeamDesigns && overrides.savedGradeBeamDesigns.length > 0)
      ? overrides.savedGradeBeamDesigns
      : GradeBeamDesignEngine.discoverAndDesignAll(model, fck, fy);
    
    let gbConcreteM3 = 0;
    let gbFormworkM2 = 0;
    const gbItems: any[] = [];

    gradeBeams.forEach((gb) => {
      const b_m = gb.b / 1000;
      const D_m = gb.D / 1000;
      const L_m = gb.spanLength || 4.0;
      const vol = b_m * D_m * L_m;
      // Grade beam shuttering: 2 vertical sides
      const formwork = 2 * D_m * L_m;

      gbConcreteM3 += vol;
      gbFormworkM2 += formwork;

      gbItems.push({
        id: gb.gradeBeamId,
        label: `GB-${gb.gradeBeamId}`,
        dimensions: `${gb.b} × ${gb.D} mm`,
        lengthOrHeightM: L_m,
        volumeM3: Number(vol.toFixed(3)),
        formworkM2: Number(formwork.toFixed(2)),
      });
    });

    const gbTypicalDim = gradeBeams.length > 0 ? `${gradeBeams[0]?.b || 300} × ${gradeBeams[0]?.D || 450} mm` : '300 × 450 mm';

    // -------------------------------------------------------------------------
    // 4. FOUNDATION PILE CAPS & COMBINED RIGID MATS (IS 2911 / IS 456)
    // -------------------------------------------------------------------------
    const supports = Array.from(model.supports.values());
    const capsMap = new Map<number, any>();
    let capsConcreteM3 = 0;
    let capsFormworkM2 = 0;
    let totalPilesCount = 0;
    let pilesConcreteM3 = 0;
    const capItems: any[] = [];
    const pileItems: any[] = [];

    supports.forEach((sup) => {
      const colInfo = columnMapping.get(sup.nodeId);
      const reactions = model.reactions?.filter((r) => r.nodeId === sup.nodeId) || [];
      let maxFy = reactions.length > 0 ? Math.max(...reactions.map((r) => Math.abs(r.fy))) : 650;

      const des = PileCapDesignEngine.design({
        supportNodeId: sup.nodeId,
        colWidth: 450,
        colDepth: 550,
        pileDiameter: 350,
        safePileCapacity: 280,
        factoredVerticalLoad: maxFy,
        fck,
        fy,
      });

      capsMap.set(sup.nodeId, des);

      const capL = des.capLength / 1000;
      const capB = des.capWidth / 1000;
      const capD = des.capDepth / 1000;
      const capVol = capL * capB * capD;
      const capFormwork = 2 * (capL + capB) * capD;

      capsConcreteM3 += capVol;
      capsFormworkM2 += capFormwork;

      const pCount = des.pileCount || 2;
      totalPilesCount += pCount;
      const pileLenM = 12.0;
      const singlePileVol = (Math.PI * 0.35 * 0.35 / 4) * pileLenM;
      pilesConcreteM3 += pCount * singlePileVol;

      const capLabel = colInfo?.footingLabel || `PC-${sup.nodeId}`;
      capItems.push({
        id: sup.nodeId,
        label: `${capLabel} (${colInfo?.columnLabel || `C${sup.nodeId}`})`,
        dimensions: `${capL.toFixed(2)}m × ${capB.toFixed(2)}m × ${des.capDepth}mm`,
        volumeM3: Number(capVol.toFixed(3)),
        formworkM2: Number(capFormwork.toFixed(2)),
      });

      pileItems.push({
        id: `Piles-Joint-${sup.nodeId}`,
        label: `${pCount}× Piles for ${capLabel}`,
        dimensions: `Dia 350 mm × 12.0m depth`,
        volumeM3: Number((pCount * singlePileVol).toFixed(3)),
        formworkM2: 0, // In-situ drilled piles have no shuttering
      });
    });

    // Combined Pile Caps
    const combinedCaps = CombinedPileCapEngine.detectAndDesignAll(
      model,
      capsMap,
      350,
      overrides?.manualMergedPileCapGroups || [],
      overrides?.detachedCombinedCapNodeIds || [],
      overrides?.customCombinedCapOverrides || {},
      280
    );

    combinedCaps.forEach((cc) => {
      const cL = cc.capLength / 1000;
      const cB = cc.capWidth / 1000;
      const cD = cc.capDepth / 1000;
      const capVol = cL * cB * cD;
      const capFormwork = 2 * (cL + cB) * cD;

      capsConcreteM3 += capVol;
      capsFormworkM2 += capFormwork;

      const cpCount = cc.pileCount;
      totalPilesCount += cpCount;
      const pileLenM = 12.0;
      const combPileVol = cpCount * (Math.PI * 0.35 * 0.35 / 4) * pileLenM;
      pilesConcreteM3 += combPileVol;

      capItems.push({
        id: cc.groupId,
        label: `Combined Mat ${cc.groupId}`,
        dimensions: `${cL.toFixed(2)}m × ${cB.toFixed(2)}m × ${cc.capDepth}mm`,
        volumeM3: Number(capVol.toFixed(3)),
        formworkM2: Number(capFormwork.toFixed(2)),
      });
    });

    // -------------------------------------------------------------------------
    // 5. FOUNDATION ISOLATED PAD FOOTINGS (If configured or used instead of piles)
    // -------------------------------------------------------------------------
    const savedFootings = overrides?.savedFootingDesigns;
    let footingsConcreteM3 = 0;
    let footingsFormworkM2 = 0;
    const footingItems: any[] = [];

    if (savedFootings && (savedFootings instanceof Map ? savedFootings.size > 0 : Object.keys(savedFootings).length > 0)) {
      const fMap: Map<number, any> = savedFootings instanceof Map ? savedFootings : new Map(Object.entries(savedFootings).map(([k, v]) => [Number(k), v]));
      fMap.forEach((fd, nodeId) => {
        const L_m = fd.length || 2.0;
        const B_m = fd.width || 2.0;
        const D_m = (fd.thickness || 500) / 1000;
        const vol = L_m * B_m * D_m;
        const formwork = 2 * (L_m + B_m) * D_m;

        footingsConcreteM3 += vol;
        footingsFormworkM2 += formwork;

        const colInfo = columnMapping.get(nodeId);
        footingItems.push({
          id: nodeId,
          label: colInfo?.footingLabel || `F-${nodeId}`,
          dimensions: `${L_m.toFixed(2)}m × ${B_m.toFixed(2)}m × ${fd.thickness}mm`,
          volumeM3: Number(vol.toFixed(3)),
          formworkM2: Number(formwork.toFixed(2)),
        });
      });
    }

    // -------------------------------------------------------------------------
    // 6. DUCTILE RC SHEAR WALLS / CORE LIFT WALLS (IS 13920)
    // -------------------------------------------------------------------------
    const savedSwDesigns: Record<number, any> = overrides?.savedShearWallDesigns instanceof Map
      ? Object.fromEntries(overrides.savedShearWallDesigns)
      : (overrides?.savedShearWallDesigns || {});
    const savedWallIds = Object.keys(savedSwDesigns).map(Number);
    const wallPlates = Array.from(model.plates.values()).filter((p: any) => p.classification === 'WALL');

    const targetWalls: { id: number; design?: any; plate?: any }[] = savedWallIds.length > 0
      ? savedWallIds.map((id) => ({ id, design: savedSwDesigns[id] }))
      : wallPlates.map((wp: any) => ({ id: wp.id, plate: wp }));

    let wallsConcreteM3 = 0;
    let wallsFormworkM2 = 0;
    const wallItems: any[] = [];

    targetWalls.forEach((entry, idx) => {
      const savedWall = entry.design;
      let defaultPlateLw = 3.2;
      let defaultPlateHw = 3.5;
      if (entry.plate?.nodeIds && model.nodes) {
        const pNodes = entry.plate.nodeIds.map((nid: number) => model.nodes.get(nid)).filter(Boolean);
        if (pNodes.length >= 2) {
          const xs = pNodes.map((n: any) => n.x);
          const ys = pNodes.map((n: any) => n.y);
          const zs = pNodes.map((n: any) => n.z);
          const dx = Math.max(...xs) - Math.min(...xs);
          const dz = Math.max(...zs) - Math.min(...zs);
          const dy = Math.max(...ys) - Math.min(...ys);
          const span = Math.sqrt(dx * dx + dz * dz);
          if (span > 0.5) defaultPlateLw = span;
          if (dy > 0.5) defaultPlateHw = dy;
        }
      }

      const Lw = Number(savedWall?.length || savedWall?.Lw || savedWall?.input?.length || defaultPlateLw);
      const tw_mm = Number(savedWall?.thickness || savedWall?.tw || savedWall?.input?.thickness || (entry.plate?.thickness ? Math.round(entry.plate.thickness * 1000) : 230));
      const Hw = Number(savedWall?.height || savedWall?.Hw || savedWall?.input?.height || defaultPlateHw);

      const tw_m = tw_mm / 1000;
      const vol = Lw * tw_m * Hw;
      // Shear wall formwork: 2 large vertical faces + 2 side end faces
      const formwork = 2 * (Lw + tw_m) * Hw;

      wallsConcreteM3 += vol;
      wallsFormworkM2 += formwork;

      wallItems.push({
        id: entry.id,
        label: `SW-${idx + 1} (Plate #${entry.id})`,
        dimensions: `${Lw.toFixed(2)}m × ${tw_mm}mm thk × ${Hw.toFixed(2)}m H`,
        lengthOrHeightM: Hw,
        volumeM3: Number(vol.toFixed(3)),
        formworkM2: Number(formwork.toFixed(2)),
      });
    });

    const wallTypicalDim = targetWalls.length > 0 ? `${wallItems[0]?.dimensions || '3.2m × 230mm thk'}` : '230 mm Thick Core';

    // -------------------------------------------------------------------------
    // 7. REINFORCED CONCRETE FLOOR & ROOF SLABS (IS 456 / RCDC)
    // -------------------------------------------------------------------------
    const savedSlabs: Record<string, any> = overrides?.savedSlabDesigns instanceof Map
      ? Object.fromEntries(overrides.savedSlabDesigns)
      : (overrides?.savedSlabDesigns || {});
    let slabList = Object.values(savedSlabs);

    if (slabList.length === 0) {
      const plans = FloorPlanEngine.extractAllFloorPlans(model);
      if (plans && plans.length > 0) {
        const autoList: any[] = [];
        plans.forEach((p) => {
          if (p.isFoundationLevel) return;
          for (let i = 1; i <= 4; i++) {
            autoList.push({
              panelId: `S${i}`,
              floorLevel: p.levelName || '1ST FLOOR',
              lx: 3.5,
              ly: 4.5,
              thickness: 130,
            });
          }
        });
        slabList = autoList;
      }
    }

    let slabsConcreteM3 = 0;
    let slabsFormworkM2 = 0;
    const slabItems: any[] = [];

    slabList.forEach((s) => {
      const lx = s.lx || 3.5;
      const ly = s.ly || 4.5;
      const area = lx * ly;
      const thk_mm = s.thickness || 130;
      const thk_m = thk_mm / 1000;
      const vol = area * thk_m;
      // Slab formwork: bottom soffit area
      const formwork = area;

      slabsConcreteM3 += vol;
      slabsFormworkM2 += formwork;

      slabItems.push({
        id: s.panelId,
        label: `${s.panelId} (${s.floorLevel || 'Floor Slab'})`,
        dimensions: `${lx.toFixed(2)}m × ${ly.toFixed(2)}m × ${thk_mm}mm`,
        areaM2: Number(area.toFixed(2)),
        volumeM3: Number(vol.toFixed(3)),
        formworkM2: Number(formwork.toFixed(2)),
        level: s.floorLevel,
      });
    });

    const slabTypicalDim = slabList.length > 0 ? `${slabItems[0]?.dimensions || '3.5m × 4.5m × 130mm'}` : '130 mm Thickness';

    // -------------------------------------------------------------------------
    // 8. PCC BLINDING SUB-BASE CONCRETE (M15 - 75mm under foundations)
    // -------------------------------------------------------------------------
    let pccConcreteM3 = 0;
    if (capsConcreteM3 > 0) {
      capItems.forEach((c) => {
        const area = (c.formworkM2 / 2) || 4.0;
        pccConcreteM3 += area * 0.075;
      });
    } else if (footingsConcreteM3 > 0) {
      footingItems.forEach((f) => {
        const area = (f.formworkM2 / 2) || 4.0;
        pccConcreteM3 += area * 0.075;
      });
    }

    // -------------------------------------------------------------------------
    // 8.5. RCC DOG-LEGGED STAIRCASE FLIGHTS & LANDINGS (IS 456 Cl. 33)
    // -------------------------------------------------------------------------
    const stairSummary = StaircaseDesignEngine.calculateBuildingStaircaseSummary(
      model,
      metadata,
      {
        customGeometry: overrides?.customStaircaseGeometry,
        customLandingEntry: overrides?.customStaircaseLandingEntry,
      }
    );
    const stairsConcreteM3 = stairSummary.totalConcreteM3;
    const stairsFormworkM2 = stairSummary.totalFormworkM2;
    const stairItems = stairSummary.storeyDesigns.flatMap((s) => [
      {
        id: `${s.storeyId}-F1`,
        label: `${s.levelName} - Flight 1`,
        dimensions: `Going: ${s.flight1.goingLengthM}m × W: ${s.flight1.flightWidthM}m × tw: ${s.flight1.waistSlabThicknessMm}mm`,
        volumeM3: s.flight1.concreteM3,
        formworkM2: s.flight1.formworkM2,
        level: s.levelName,
      },
      {
        id: `${s.storeyId}-F2`,
        label: `${s.levelName} - Flight 2`,
        dimensions: `Going: ${s.flight2.goingLengthM}m × W: ${s.flight2.flightWidthM}m × tw: ${s.flight2.waistSlabThicknessMm}mm`,
        volumeM3: s.flight2.concreteM3,
        formworkM2: s.flight2.formworkM2,
        level: s.levelName,
      },
    ]);

    // -------------------------------------------------------------------------
    // 9. GRAND TOTAL AND COMPONENT AGGREGATION
    // -------------------------------------------------------------------------
    const grandTotalConcreteM3 =
      colsConcreteM3 +
      beamsConcreteM3 +
      gbConcreteM3 +
      capsConcreteM3 +
      pilesConcreteM3 +
      footingsConcreteM3 +
      wallsConcreteM3 +
      slabsConcreteM3 +
      stairsConcreteM3 +
      pccConcreteM3;

    const substructureConcreteM3 =
      pilesConcreteM3 +
      capsConcreteM3 +
      footingsConcreteM3 +
      gbConcreteM3 +
      pccConcreteM3;

    const superstructureConcreteM3 =
      colsConcreteM3 +
      beamsConcreteM3 +
      wallsConcreteM3 +
      slabsConcreteM3 +
      stairsConcreteM3;

    const safeTotal = grandTotalConcreteM3 > 0 ? grandTotalConcreteM3 : 1;

    // Build Detailed Component Breakdown Array
    const components: ConcreteComponentVolume[] = [];

    // Helper to build a component entry
    const createComponentEntry = (
      id: string,
      component: string,
      category: 'SUPERSTRUCTURE' | 'SUBSTRUCTURE',
      codeRef: string,
      count: number,
      typicalDimensions: string,
      concreteGrade: string,
      volM3: number,
      formworkM2: number,
      items: any[]
    ): ConcreteComponentVolume => {
      const mat = ConcreteVolumeEngine.getMaterialFactors(concreteGrade);
      const roundedVol = Number(volM3.toFixed(2));
      return {
        id,
        component,
        category,
        codeRef,
        count,
        typicalDimensions,
        concreteGrade,
        concreteM3: roundedVol,
        percentageShare: Number(((roundedVol / safeTotal) * 100).toFixed(1)),
        formworkM2: Number(formworkM2.toFixed(1)),
        cementBags: Math.round(roundedVol * mat.cementBagsPerM3),
        sandM3: Number((roundedVol * mat.sandM3PerM3).toFixed(2)),
        sandMT: Number((roundedVol * mat.sandMTPerM3).toFixed(2)),
        aggregateM3: Number((roundedVol * mat.aggM3PerM3).toFixed(2)),
        aggregateMT: Number((roundedVol * mat.aggMTPerM3).toFixed(2)),
        waterLiters: Math.round(roundedVol * mat.waterLitersPerM3),
        itemizedMembers: items,
      };
    };

    if (cols.length > 0) {
      components.push(
        createComponentEntry(
          'columns',
          'RCC Columns',
          'SUPERSTRUCTURE',
          'IS 456:2000 / IS 13920:2016 Cl. 7',
          cols.length,
          colTypicalDim,
          mainGrade,
          colsConcreteM3,
          colsFormworkM2,
          colItems
        )
      );
    }

    if (beams.length > 0) {
      components.push(
        createComponentEntry(
          'beams',
          'RCC Framing Beams',
          'SUPERSTRUCTURE',
          'IS 456:2000 / IS 13920:2016 Cl. 6',
          beams.length,
          beamTypicalDim,
          mainGrade,
          beamsConcreteM3,
          beamsFormworkM2,
          beamItems
        )
      );
    }

    if (slabList.length > 0) {
      components.push(
        createComponentEntry(
          'slabs',
          'Floor & Roof Slabs',
          'SUPERSTRUCTURE',
          'IS 456:2000 Cl. 24 & 31',
          slabList.length,
          slabTypicalDim,
          mainGrade,
          slabsConcreteM3,
          slabsFormworkM2,
          slabItems
        )
      );
    }

    if (targetWalls.length > 0) {
      components.push(
        createComponentEntry(
          'shearwalls',
          'Ductile RC Shear Walls',
          'SUPERSTRUCTURE',
          'IS 13920:2016 Cl. 9 & 10',
          targetWalls.length,
          wallTypicalDim,
          mainGrade,
          wallsConcreteM3,
          wallsFormworkM2,
          wallItems
        )
      );
    }

    if (stairSummary.totalFlights > 0) {
      components.push(
        createComponentEntry(
          'staircases',
          'RCC Staircase Flights & Landings',
          'SUPERSTRUCTURE',
          'IS 456:2000 Cl. 33',
          stairSummary.totalFlights,
          `Going: ${stairSummary.storeyDesigns[0]?.flight1.goingLengthM}m × W: ${stairSummary.storeyDesigns[0]?.flight1.flightWidthM}m`,
          mainGrade,
          stairsConcreteM3,
          stairsFormworkM2,
          stairItems
        )
      );
    }

    if (gradeBeams.length > 0) {
      components.push(
        createComponentEntry(
          'gradebeams',
          'Plinth & Grade Tie Beams',
          'SUBSTRUCTURE',
          'IS 13920:2016 Cl. 11.2',
          gradeBeams.length,
          gbTypicalDim,
          mainGrade,
          gbConcreteM3,
          gbFormworkM2,
          gbItems
        )
      );
    }

    if (capsConcreteM3 > 0) {
      components.push(
        createComponentEntry(
          'pilecaps',
          'Foundation Pile Caps & Mats',
          'SUBSTRUCTURE',
          'IS 2911:2010 / IS 456 Cl. 34',
          supports.length + combinedCaps.length,
          '2.4m × 1.2m × 700mm Typical',
          mainGrade,
          capsConcreteM3,
          capsFormworkM2,
          capItems
        )
      );
    }

    if (totalPilesCount > 0) {
      components.push(
        createComponentEntry(
          'piles',
          'Cast-in-situ Bored Piles',
          'SUBSTRUCTURE',
          'IS 2911:2010 (Part 1/Sec 2)',
          totalPilesCount,
          'Dia 350 mm × 12.0m Depth',
          mainGrade,
          pilesConcreteM3,
          0, // Piles in-situ no formwork
          pileItems
        )
      );
    }

    if (footingsConcreteM3 > 0) {
      components.push(
        createComponentEntry(
          'footings',
          'Isolated Pad Footings',
          'SUBSTRUCTURE',
          'IS 456:2000 Cl. 34',
          footingItems.length,
          '2.0m × 2.0m × 500mm Typical',
          mainGrade,
          footingsConcreteM3,
          footingsFormworkM2,
          footingItems
        )
      );
    }

    if (pccConcreteM3 > 0) {
      components.push(
        createComponentEntry(
          'pcc',
          'PCC Leveling / Blinding Bed',
          'SUBSTRUCTURE',
          'IS 456:2000 Nominal Bed',
          capItems.length || footingItems.length,
          '75mm Thick M15 PCC Bed',
          'M15',
          pccConcreteM3,
          0,
          []
        )
      );
    }

    // -------------------------------------------------------------------------
    // 10. FLOOR-BY-FLOOR BREAKDOWN
    // -------------------------------------------------------------------------
    const plans = FloorPlanEngine.extractAllFloorPlans(model);
    const floorBreakdown: FloorConcreteVolume[] = [];

    plans.forEach((fp) => {
      const isFoundation = fp.isFoundationLevel;
      const fBeams = fp.beams.reduce((sum, b) => sum + (b.length || 0) * 0.30 * 0.45, 0);
      const fCols = fp.columns.length * (0.45 * 0.55 * 3.2);
      const fSlabs = !isFoundation ? (fp.metrics.totalFloorAreaM2 || 150) * 0.13 : 0;
      const fWalls = targetWalls.length > 0 ? (wallsConcreteM3 / Math.max(1, plans.length - 1)) : 0;
      const fGradeBeams = isFoundation ? gbConcreteM3 : 0;
      const fFoundations = isFoundation ? (capsConcreteM3 + pilesConcreteM3 + footingsConcreteM3 + pccConcreteM3) : 0;

      const totalFloorConcreteM3 = Number((fBeams + fCols + fSlabs + fWalls + fGradeBeams + fFoundations).toFixed(2));
      const totalFormworkM2 = Number((fBeams * 3.5 + fCols * 5.0 + fSlabs * 7.7).toFixed(1));
      const totalCementBags = Math.round(totalFloorConcreteM3 * 8.0);

      floorBreakdown.push({
        levelIndex: fp.levelIndex,
        levelName: fp.levelName,
        elevationY: fp.elevationY,
        isFoundation,
        totalFloorConcreteM3,
        columnsConcreteM3: Number(fCols.toFixed(2)),
        beamsConcreteM3: Number(fBeams.toFixed(2)),
        slabsConcreteM3: Number(fSlabs.toFixed(2)),
        shearWallsConcreteM3: Number(fWalls.toFixed(2)),
        foundationConcreteM3: Number(fFoundations.toFixed(2)),
        gradeBeamsConcreteM3: Number(fGradeBeams.toFixed(2)),
        totalFormworkM2,
        totalCementBags,
      });
    });

    const totalFormworkM2 = components.reduce((sum, c) => sum + c.formworkM2, 0);
    const totalCementBags = components.reduce((sum, c) => sum + c.cementBags, 0);
    const totalSandM3 = components.reduce((sum, c) => sum + c.sandM3, 0);
    const totalSandMT = components.reduce((sum, c) => sum + c.sandMT, 0);
    const totalAggregateM3 = components.reduce((sum, c) => sum + c.aggregateM3, 0);
    const totalAggregateMT = components.reduce((sum, c) => sum + c.aggregateMT, 0);
    const totalWaterLiters = components.reduce((sum, c) => sum + c.waterLiters, 0);

    return {
      components,
      floorBreakdown,
      grandTotalConcreteM3: Number(grandTotalConcreteM3.toFixed(2)),
      substructureConcreteM3: Number(substructureConcreteM3.toFixed(2)),
      substructurePercent: Number(((substructureConcreteM3 / safeTotal) * 100).toFixed(1)),
      superstructureConcreteM3: Number(superstructureConcreteM3.toFixed(2)),
      superstructurePercent: Number(((superstructureConcreteM3 / safeTotal) * 100).toFixed(1)),
      totalFormworkM2: Number(totalFormworkM2.toFixed(1)),
      totalCementBags,
      totalSandM3: Number(totalSandM3.toFixed(2)),
      totalSandMT: Number(totalSandMT.toFixed(2)),
      totalAggregateM3: Number(totalAggregateM3.toFixed(2)),
      totalAggregateMT: Number(totalAggregateMT.toFixed(2)),
      totalWaterLiters,
    };
  }
}
