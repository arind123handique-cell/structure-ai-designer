import { RCDCDocument, RCDCBeam, RCDCColumn } from './types';
import { buildRCDCMemberIds } from './rcdxKeys';

export interface RCDXDesignPayload {
  savedBeamDesigns: Record<number, any>;
  savedColumnDesigns: Record<number, any>;
  savedSlabDesigns: Record<string, any>;
}

function round(v: number, dp = 2): number {
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

function barRow(diameterMm: number, count: number): { diameterMm: number; count: number } {
  return { diameterMm, count };
}

function pickMaxLink<T>(list: T[], sel: (item: T) => number): T | null {
  let best: T | null = null;
  let bestVal = -Infinity;
  for (const item of list) {
    const v = sel(item);
    if (v > bestVal) {
      bestVal = v;
      best = item;
    }
  }
  return best;
}

function beamDesign(beam: RCDCBeam, memberId: number): any {
  const b = beam.widthMm || 230;
  const D = beam.depthMm || 450;
  const cover = beam.coverMm || 25;

  const topLayer = pickMaxLink(beam.topLayers, (l) => l.ast);
  const bottomLayer = pickMaxLink(beam.bottomLayers, (l) => l.ast);
  const stirrupZone = pickMaxLink(beam.shearZones, (s) => s.asvMm2);

  const maxTopReq = Math.max(0, ...beam.stations.map((s) => s.astTopReq));
  const maxBotReq = Math.max(0, ...beam.stations.map((s) => s.astBottomReq));
  const demandMu = Math.max(
    0,
    ...beam.stations.map((s) => Math.max(Math.abs(s.momentTop), Math.abs(s.momentBottom)))
  );
  const demandVu = beam.envelope.maxShear || Math.max(0, ...beam.stations.map((s) => Math.abs(s.shear)));

  const topBars = topLayer?.bars ?? [barRow(0, 0)];
  const bottomBars = bottomLayer?.bars ?? [barRow(0, 0)];
  const topTotal = topLayer?.ast ?? 0;
  const bottomTotal = bottomLayer?.ast ?? 0;
  const topMainDia = topBars[0]?.diameterMm || 0;
  const bottomMainDia = bottomBars[0]?.diameterMm || 0;
  const upper = topMainDia > 0 ? topMainDia : 16;

  const stirrupSpacing = stirrupZone?.spacingMm || beam.stations[0]?.shearSpacingProv || 150;
  const stirrupDia = stirrupZone?.diameterMm || 8;
  const stirrupLegs = stirrupZone?.legs || 2;
  const stirrupAsv = stirrupZone?.asvMm2 || 0;

  const barCallout = (bars: { diameterMm: number; count: number }[]): string => {
    return bars
      .filter((x) => x.diameterMm > 0)
      .map((x) => `${x.count}-T${x.diameterMm}`)
      .join(' + ') || 'Not detailed';
  };

  const zones = beam.zones.map((z) => ({
    startMm: z.startMm,
    endMm: z.endMm,
    astTopProv: z.astTopProv,
    astBottomProv: z.astBottomProv,
    momentTop: z.momentTop,
    momentBottom: z.momentBottom,
    shear: z.shear,
    spacingMm: z.shearSpacingMm,
  }));

  return {
    memberId,
    dimensions: `${b}x${D} mm`,
    spanLength: round(beam.clearSpanMm / 1000),
    effectiveDepth: D - cover - upper / 2,
    b,
    bMm: b,
    D,
    dMm: D,
    cover,
    demandMu: round(demandMu),
    demandVu: round(demandVu),
    astTopReqAnl: round(maxTopReq),
    astBottomReqAnl: round(maxBotReq),
    flexureTop: {
      status: beam.stations.every((s) => s.designFlagTop) ? 'PASS' : 'FAIL',
      Ast_required: round(maxTopReq),
      Ast_min: round(beam.stations[0]?.astTopProv || 0),
      Ast_max: round(beam.stations[0]?.astTopProv || 0),
    },
    flexureBottom: {
      status: beam.stations.every((s) => s.designFlagBottom) ? 'PASS' : 'FAIL',
      Ast_required: round(maxBotReq),
      Ast_min: round(beam.stations[0]?.astBottomProv || 0),
      Ast_max: round(beam.stations[0]?.astBottomProv || 0),
    },
    topRebar: {
      callout: barCallout(topLayer?.bars ?? []) || `${Math.ceil(topTotal / 201) || 2}-T16`,
      totalArea: round(topTotal),
      barCount: topLayer ? topLayer.bars.reduce((s, x) => s + x.count, 0) : 0,
      mainDiameter: topMainDia,
      layers: topLayer ? 1 : 0,
      bars: topLayer?.bars?.length ? topLayer.bars.map((x) => barRow(x.diameterMm, x.count)) : [],
    },
    bottomRebar: {
      callout: barCallout(bottomLayer?.bars ?? []) || `${Math.ceil(bottomTotal / 201) || 2}-T16`,
      totalArea: round(bottomTotal),
      barCount: bottomLayer ? bottomLayer.bars.reduce((s, x) => s + x.count, 0) : 0,
      mainDiameter: bottomMainDia,
      layers: bottomLayer ? 1 : 0,
      bars: bottomLayer?.bars?.length ? bottomLayer.bars.map((x) => barRow(x.diameterMm, x.count)) : [],
    },
    curtailment: {
      zones,
      throughTop: barCallout(topLayer?.bars ?? []),
      throughBottom: barCallout(bottomLayer?.bars ?? []),
    },
    shear: {
      callout: stirrupZone ? `T${stirrupDia} @ ${stirrupSpacing} c/c (${stirrupLegs}-legged)` : `T${stirrupDia} @ ${stirrupSpacing} c/c`,
      stirrupSpacing,
      stirrupDiameter: stirrupDia,
      stirrupLegs,
      Asv: round(stirrupAsv),
      Asv_required: round(Math.max(0, ...beam.stations.map((s) => s.asvCalc))),
      status: beam.stations.every((s) => s.shearDesignFlag) ? 'PASS' : 'FAIL',
    },
    ductility: { status: 'INFO', message: 'IS 13920 ductile detailing as per RCDC' },
    developmentLength: 0,
    governingLoadCase: beam.envelope.governingLoadCombId ?? 0,
    status: beam.stations.length ? 'PASS' : 'WARNING',
    calculationReport: null,
  };
}

function columnRebarLayout(col: RCDCColumn): {
  cornerBars: { diameter: number; count: 4; callout: string; area: number };
  faceBars: { diameter: number; count: number; countX: number; countY: number; callout: string; area: number } | undefined;
  totalBars: number;
  totalArea: number;
  spacingX: number;
  spacingY: number;
} {
  const main = col.mainBars[0];
  const dia = main?.diameterMm || 16;
  const totalBars = col.mainBars.reduce((s, x) => s + (x.count || 0), 0) || 4;
  const singleArea = (Math.PI * dia * dia) / 4;
  const totalArea = totalBars * singleArea;
  const b = col.widthMm || 400;
  const D = col.depthMm || 450;
  const cover = col.coverMm || 50;

  // Derive face bar counts from the RCDC per-bar coordinate table when available.
  // DeltaX/DeltaZ are distances (mm) from the section's bottom-left corner, so a
  // bar is "near an edge" when its coordinate is at the minimum or maximum band.
  let countX = 0;
  let countY = 0;
  const coords = col.barCoords;
  if (coords && coords.length > 0) {
    const minAbs = Math.max(2, Math.min(...coords.map((c) => Math.min(Math.abs(c.dx), Math.abs(c.dz)))));
    const maxAbs = Math.max(...coords.map((c) => Math.max(Math.abs(c.dx), Math.abs(c.dz))));
    const band = minAbs * 1.8 + 2;
    const nearEdge = (v: number) => v <= band || v >= maxAbs - band;
    let faceX = 0;
    let faceY = 0;
    for (const c of coords) {
      const nearX = nearEdge(Math.abs(c.dx));
      const nearZ = nearEdge(Math.abs(c.dz));
      if (nearX && nearZ) continue; // corner
      if (nearX) faceX += 1;
      else if (nearZ) faceY += 1;
    }
    countX = Math.round(faceX / 2);
    countY = Math.round(faceY / 2);
  }
  if ((countX === 0 && countY === 0) || 2 * (countX + countY) >= totalBars - 4) {
    const face = totalBars - 4;
    if (face > 0) {
      const split = Math.round((face * D) / (2 * (D + b)));
      countX = Math.max(0, split);
      countY = Math.max(0, Math.round(face / 2) - countX);
      countX = Math.max(0, Math.round(face / 2) - countY);
    } else {
      countX = 0;
      countY = 0;
    }
  }
  const faceArea = 2 * (countX + countY) * singleArea;

  const coreD = D - 2 * (cover + 8);
  const coreB = b - 2 * (cover + 8);
  const spacingX = countX > 0 ? round(coreD / (countX + 1), 1) : 0;
  const spacingY = countY > 0 ? round(coreB / (countY + 1), 1) : 0;

  return {
    cornerBars: {
      diameter: dia,
      count: 4,
      callout: `4-T${dia}`,
      area: round(4 * singleArea),
    },
    faceBars:
      countX > 0 || countY > 0
        ? {
            diameter: dia,
            count: Math.round(faceArea / singleArea),
            countX: Math.round(countX),
            countY: Math.round(countY),
            callout: `Face bars: 2x${Math.round(countX)}+2x${Math.round(countY)}-T${dia}`,
            area: round(faceArea),
          }
        : undefined,
    totalBars,
    totalArea: round(totalArea),
    spacingX,
    spacingY,
  };
}

function columnDesign(col: RCDCColumn, memberId: number): any {
  const layout = columnRebarLayout(col);
  const b = col.widthMm || 400;
  const D = col.depthMm || 450;
  const cover = col.coverMm || 50;
  const Ag = b * D;

  const minSpacing = Math.min(layout.spacingX || 999, layout.spacingY || 999);
  const maxSpacing = Math.max(layout.spacingX, layout.spacingY);
  const isConfinementCompliant = maxSpacing > 0 ? maxSpacing <= 300 && minSpacing >= Math.max(layout.cornerBars.diameter + 20, 40) : true;

  return {
    memberId,
    dimensions: `${b}x${D} mm`,
    height: round(col.unsupportedLengthMm / 1000),
    b,
    bMm: b,
    D,
    dMm: D,
    cover,
    factoredDemandPu: round(col.envelope.maxAxial),
    factoredDemandMux: round(col.envelope.maxMomentMajor),
    factoredDemandMuy: round(col.envelope.maxMomentMinor),
    rebar: {
      callout: `${layout.totalBars}-T${layout.cornerBars.diameter}`,
      totalArea: layout.totalArea,
      totalBars: layout.totalBars,
      isMixed: false,
      cornerBars: layout.cornerBars,
      faceBars: layout.faceBars,
      spacingX: layout.spacingX,
      spacingY: layout.spacingY,
      isConfinementCompliant,
      pt_prov: round((layout.totalArea * 100) / Ag, 2),
    },
    interactionRatio: col.interactionRatio,
    factoredDemandPuz: 0,
    status: col.designFail ? 'FAIL' : col.mainBars.length ? 'PASS' : 'WARNING',
    ductility: { status: 'INFO', message: 'IS 13920 ductile detailing as per RCDC' },
    governingLoadCase: 0,
    calculationReport: null,
  };
}

/**
 * Derives app-compatible saved design payloads (consumed by the 3D viewer and
 * the member details drawer) from the RCDC design output.
 */
export function rcdcToDesigns(doc: RCDCDocument): RCDXDesignPayload {
  const ids = buildRCDCMemberIds(doc);

  const savedBeamDesigns: Record<number, any> = {};
  for (const beam of doc.beams) {
    const memberId = ids.beamId.get(beam.beamNo) ?? beam.beamNo;
    const entry = beamDesign(beam, memberId);
    savedBeamDesigns[memberId] = entry;
  }

  const savedColumnDesigns: Record<number, any> = {};
  for (const col of doc.columns) {
    const memberId = ids.columnId.get(col.columnNo) ?? col.columnNo;
    const entry = columnDesign(col, memberId);
    savedColumnDesigns[memberId] = entry;
  }

  return {
    savedBeamDesigns,
    savedColumnDesigns,
    savedSlabDesigns: {},
  };
}