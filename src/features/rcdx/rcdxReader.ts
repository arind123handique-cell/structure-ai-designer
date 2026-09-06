import initSqlJs from 'sql.js/dist/sql-asm.js';
import type { SqlJsStatic } from 'sql.js';
import {
  RCDCDocument,
  RCDCLevel,
  RCDCNode,
  RCDCSection,
  RCDCLoadCase,
  RCDCLoadCombination,
  RCDCBeam,
  RCDCBeamStation,
  RCDCBeamZone,
  RCDCBarLayer,
  RCDCShearZone,
  RCDCColumn,
  RCDCLinkZone,
  RCDCSlabPanel,
  RCDCSlabSchedule,
  RCDCSlabReinforcement,
  RCDCEnvelope,
  RCDCBar,
} from './types';

type Row = Record<string, any>;

let sqlPromise: Promise<SqlJsStatic> | null = null;

export function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs();
  }
  return sqlPromise;
}

function isFiniteNumber(v: any): v is number {
  return typeof v === 'number' && isFinite(v);
}

function num(v: any, scale = 1, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isFiniteNumber(n) ? n * scale : fallback;
}

function round(v: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

/**
 * Reads an STAAD RCDC (.rcdx) design database (SQLite) into a normalized
 * RCDCDocument containing geometry, analysis loads/combinations, and the
 * actual reinforced-concrete design output (beam/column/slab reinforcement,
 * zones, forces and detailing) produced by RCDC.
 */
export async function readRCDC(bytes: Uint8Array, fileName: string): Promise<RCDCDocument> {
  const SQL = await getSqlJs();
  const db = new SQL.Database(bytes);
  const warnings: string[] = [];

  let tableNames: string[] = [];
  try {
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    if (res.length) {
      tableNames = res[0].values.map((v) => String(v[0]));
    }
  } catch {
    /* not a sqlite db */
  }
  const has = (t: string) => tableNames.includes(t);

  // ── Generic query helper: returns array-of-objects ──
  const q = (sql: string): Row[] => {
    try {
      const res = db.exec(sql);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map((rowVals) => {
        const o: Row = {};
        columns.forEach((c, i) => {
          o[c] = (rowVals as any[])[i];
        });
        return o;
      });
    } catch {
      return [];
    }
  };

  // ── Metadata ──
  const masterProps: Record<string, string> = {};
  const projectProps: Record<string, string> = {};
  if (has('Master_Properties')) {
    for (const r of q('SELECT Name, Value FROM Master_Properties')) {
      masterProps[String(r.Name)] = String(r.Value ?? '');
    }
  }
  if (has('Project_Properties')) {
    for (const r of q('SELECT Name, Value FROM Project_Properties')) {
      projectProps[String(r.Name)] = String(r.Value ?? '');
    }
  }

  const designCodeMap: Record<number, string> = {};
  if (has('Design_Code_Master')) {
    for (const r of q('SELECT DesignCodeID, DesignCode FROM Design_Code_Master')) {
      if (isFiniteNumber(r.DesignCodeID)) designCodeMap[Number(r.DesignCodeID)] = String(r.DesignCode);
    }
  }

  // ── Levels ──
  const levels: RCDCLevel[] = [];
  if (has('Level_Data')) {
    for (const r of q('SELECT LevelNo, LevelName, LevelHeight, LevelElevation FROM Level_Data')) {
      levels.push({
        levelNo: num(r.LevelNo),
        name: String(r.LevelName ?? `LEVEL ${r.LevelNo}`),
        heightMm: num(r.LevelHeight),
        elevation: num(r.LevelElevation),
      });
    }
    levels.sort((a, b) => a.levelNo - b.levelNo);
  }

  // ── Nodes ──
  const nodes: RCDCNode[] = [];
  if (has('Node_Data')) {
    for (const r of q('SELECT NodeNo, X_Coordinate, Y_Coordinate, Z_Coordinate FROM Node_Data')) {
      nodes.push({ nodeNo: num(r.NodeNo), x: round(num(r.X_Coordinate)), y: round(num(r.Y_Coordinate)), z: round(num(r.Z_Coordinate)) });
    }
  } else if (has('AN_Nodes')) {
    for (const r of q('SELECT AN_NodeNo, AN_X_Coordinate, AN_Y_Coordinate, AN_Z_Coordinate FROM AN_Nodes')) {
      nodes.push({ nodeNo: num(r.AN_NodeNo), x: round(num(r.AN_X_Coordinate)), y: round(num(r.AN_Y_Coordinate)), z: round(num(r.AN_Z_Coordinate)) });
    }
  }
  nodes.sort((a, b) => a.nodeNo - b.nodeNo);
  if (!nodes.length) warnings.push('No node geometry found in RCDC file.');

  const nodeById = new Map(nodes.map((n) => [n.nodeNo, n]));

  // ── Supports ──
  let supports: number[] = [];
  if (has('Support_Data')) {
    supports = q('SELECT NodeNo FROM Support_Data').map((r) => num(r.NodeNo));
  }

  // ── Frame sections ──
  const sections: RCDCSection[] = [];
  const sectionById = new Map<number, RCDCSection>();
  if (has('Frame_Section_Master')) {
    for (const r of q('SELECT FrameSectionID, FrameSectionName, Depth, WidthTop, Area, Ixx, Izz FROM Frame_Section_Master')) {
      const s: RCDCSection = {
        frameSectionId: num(r.FrameSectionID),
        name: String(r.FrameSectionName ?? 'SEC'),
        depthMm: round(num(r.Depth, 1000)),
        widthMm: round(num(r.WidthTop, 1000)),
        areaCm2: round(num(r.Area, 10000)),
        ixxCm4: round(num(r.Ixx, 1e8)),
        izzCm4: round(num(r.Izz, 1e8)),
      };
      sections.push(s);
      sectionById.set(s.frameSectionId, s);
    }
  }

  // ── Materials ──
  const concreteById = new Map<number, { name: string; fck: number }>();
  if (has('Concrete_Grade_Master')) {
    for (const r of q('SELECT ConcreteGradeID, ConcreteGrade, StrengthOfConcrete FROM Concrete_Grade_Master')) {
      concreteById.set(num(r.ConcreteGradeID), { name: String(r.ConcreteGrade ?? 'CONC'), fck: num(r.StrengthOfConcrete) });
    }
  }
  const steelById = new Map<number, { name: string; fy: number }>();
  if (has('Steel_Grade_Master')) {
    for (const r of q('SELECT SteelGradeID, SteelGrade, StrengthOfSteel FROM Steel_Grade_Master')) {
      steelById.set(num(r.SteelGradeID), { name: String(r.SteelGrade ?? 'STEEL'), fy: num(r.StrengthOfSteel) });
    }
  }

  // ── Bar diameters ──
  const barDias: Record<number, RCDCBar> = {};
  if (has('Bar_Dia_Master')) {
    for (const r of q('SELECT BarDiaID, BarMark, BarDia, BarNos, BarArea FROM Bar_Dia_Master')) {
      const id = num(r.BarDiaID);
      if (!id) continue;
      barDias[id] = {
        diameterMm: num(r.BarDia),
        count: Math.max(1, Math.round(num(r.BarNos, 1, 1))),
        areaMm2: round(num(r.BarArea)),
      };
    }
  }
  const diaFor = (diaId: number): number => barDias[diaId]?.diameterMm ?? 0;

  // ── Load cases ──
  const loadCases: RCDCLoadCase[] = [];
  const symbolType: Record<string, string> = {
    DL: 'DEAD',
    LL: 'LIVE',
    SELF: 'DEAD',
    SDL: 'DEAD',
    'EQ-X': 'EQ',
    'EQ-Z': 'EQ',
    'WL-X': 'WIND',
    'WL-Z': 'WIND',
    'WIND-X': 'WIND',
    'WIND-Z': 'WIND',
    TEMP: 'TEMP',
    SNOW: 'SNOW',
  };
  if (has('Static_Load_Cases')) {
    for (const r of q('SELECT LoadID, LoadName, LoadSymbol FROM Static_Load_Cases')) {
      const symbol = String(r.LoadSymbol ?? '').toUpperCase();
      loadCases.push({
        loadId: num(r.LoadID),
        name: String(r.LoadName ?? symbol),
        symbol: symbol || String(r.LoadName ?? ''),
        type: symbolType[symbol] ?? 'OTHER',
      });
    }
    loadCases.sort((a, b) => a.loadId - b.loadId);
  }

  // ── Load combinations ──
  const combos: RCDCLoadCombination[] = [];
  const comboFactorMap = new Map<number, { loadCaseId: number; factor: number }[]>();
  if (has('Load_Combination_Master')) {
    for (const r of q('SELECT LoadCombID, LoadID, Factor FROM Load_Combination_Master WHERE IncludeFlag = 1 ORDER BY LoadCombID')) {
      const combId = num(r.LoadCombID);
      if (!combId) continue;
      const items = comboFactorMap.get(combId) ?? [];
      items.push({ loadCaseId: num(r.LoadID), factor: num(r.Factor, 1, 1) });
      comboFactorMap.set(combId, items);
    }
  }
  for (const [combId, items] of comboFactorMap) {
    combos.push({
      combId,
      name: `LC${combId}`,
      factors: items,
    });
  }
  combos.sort((a, b) => a.combId - b.combId);

  // ── Beam forces envelope (per BS_BeamNo) ──
  const beamEnvelopeByBS = new Map<number, RCDCEnvelope>();
  if (has('LoadComb_Beam_Forces')) {
    for (const r of q(
      'SELECT BS_BeamNo AS beamNo, MAX(AxialForce) AS maxAxial, MIN(AxialForce) AS minAxial, MAX(ABS(ShearY)) AS maxShear, MAX(ABS(Torsion)) AS maxTorsion, MAX(ABS(MomentY)) AS maxMomentY, MAX(ABS(MomentZ)) AS maxMomentZ FROM LoadComb_Beam_Forces GROUP BY BS_BeamNo'
    )) {
      beamEnvelopeByBS.set(num(r.beamNo), {
        maxAxial: round(num(r.maxAxial)),
        minAxial: round(num(r.minAxial)),
        maxShear: round(num(r.maxShear)),
        maxTorsion: round(num(r.maxTorsion)),
        maxMomentMajor: round(num(r.maxMomentZ)),
        maxMomentMinor: round(num(r.maxMomentY)),
      });
    }
  }

  // ── Beam option / group maps ──
  const beamOptions = new Map<number, { concreteGradeId: number; steelGradeId: number; coverMm: number; minBarDiaId: number }>();
  if (has('Beam_Option_Master')) {
    for (const r of q('SELECT BeamOptionNo, ConcreteGradeID, SteelGradeID, Cover, MinBarDiaID FROM Beam_Option_Master')) {
      beamOptions.set(num(r.BeamOptionNo), {
        concreteGradeId: num(r.ConcreteGradeID, 1, 0),
        steelGradeId: num(r.SteelGradeID, 1, 0),
        coverMm: num(r.Cover, 1, 25),
        minBarDiaId: num(r.MinBarDiaID),
      });
    }
  }
  const beamOptionLink = new Map<string, number>();
  if (has('Beam_Option_Link')) {
    for (const r of q('SELECT BeamOptionNo, BeamMemGroupNo, BeamLevelGroupNo FROM Beam_Option_Link')) {
      beamOptionLink.set(`${num(r.BeamMemGroupNo)}:${num(r.BeamLevelGroupNo)}`, num(r.BeamOptionNo));
    }
  }
  const beamLevelGroupByLevelRange: { start: number; end: number; groupNo: number }[] = [];
  if (has('Beam_Level_Groups')) {
    for (const r of q('SELECT BeamLevelGroupNo, StartLevelNo, EndLevelNo FROM Beam_Level_Groups')) {
      beamLevelGroupByLevelRange.push({ start: num(r.StartLevelNo), end: num(r.EndLevelNo), groupNo: num(r.BeamLevelGroupNo) });
    }
  }
  const beamMemGroup = new Map<number, { memGroupNo: number; levelGroupNo: number }>();
  if (has('Beam_Member_Groups')) {
    for (const r of q('SELECT BeamMemGroupNo, BeamNo, Level FROM Beam_Member_Groups')) {
      const beamNo = num(r.BeamNo);
      const lvl = num(r.Level);
      const memGroupNo = num(r.BeamMemGroupNo);
      let levelGroupNo = memGroupNo;
      const range = beamLevelGroupByLevelRange.find((g) => g.groupNo === memGroupNo && lvl >= g.start && lvl <= g.end);
      if (range) levelGroupNo = range.groupNo;
      beamMemGroup.set(beamNo, { memGroupNo, levelGroupNo });
    }
  }

  // ── Beam design tables (stations, zones, detailing) ──
  const beamStationsByGroup = new Map<string, RCDCBeamStation[]>();
  if (has('Beam_AutoDesign_Data')) {
    for (const r of q(
      'SELECT BeamMemGroupNo, BeamLevelGroupNo, Location, MomentBottom, AstBottom, AstBottomProv, AstBottom_LoadCombID, BottomFlexureDesignFlag, MomentTop, AstTop, AstTopProv, AstTop_LoadCombID, TopFlexureDesignFlag, Torsion, Shear, AsvCalc, ShearLegs, ShearDia, ShearSpacing, ShearDesignFlag, Asv_LoadCombID, AstLocation, ShearSpacingCal FROM Beam_AutoDesign_Data'
    )) {
      const key = `${num(r.BeamMemGroupNo)}:${num(r.BeamLevelGroupNo)}`;
      const list = beamStationsByGroup.get(key) ?? [];
      list.push({
        locationMm: round(num(r.Location)),
        astLocation: Math.round(num(r.AstLocation)),
        momentTop: round(num(r.MomentTop)),
        momentBottom: round(num(r.MomentBottom)),
        astTopReq: round(num(r.AstTop)),
        astTopProv: round(num(r.AstTopProv)),
        astBottomReq: round(num(r.AstBottom)),
        astBottomProv: round(num(r.AstBottomProv)),
        designFlagTop: Math.round(num(r.TopFlexureDesignFlag)),
        designFlagBottom: Math.round(num(r.BottomFlexureDesignFlag)),
        torsion: round(num(r.Torsion)),
        shear: round(num(r.Shear)),
        asvCalc: round(num(r.AsvCalc)),
        shearSpacingCal: round(num(r.ShearSpacingCal)),
        shearSpacingProv: round(num(r.ShearSpacing)),
        shearDiaMm: round(diaFor(num(r.ShearDia))),
        shearLegs: Math.round(num(r.ShearLegs)),
        shearDesignFlag: Math.round(num(r.ShearDesignFlag)),
        astTopLoadCombId: Math.round(num(r.AstTop_LoadCombID)),
        astBottomLoadCombId: Math.round(num(r.AstBottom_LoadCombID)),
        shearLoadCombId: Math.round(num(r.Asv_LoadCombID)),
      });
      beamStationsByGroup.set(key, list);
    }
  }

  const beamZonesByGroup = new Map<string, Row[]>();
  if (has('Beam_Zone_Design')) {
    for (const r of q(
      'SELECT BeamMemGroupNo, BeamLevelGroupNo, StLocation, EndLocation, MomentBottom, MomentTop, StAstBottom, EndAstBottom, AstBottomProv, StAstTop, EndAstTop, AstTopProv, Torsion, Shear, AsvCalc, ShearSpacing, TopZoneNo, BottomZoneNo, ShearZoneNo FROM Beam_Zone_Design'
    )) {
      const key = `${num(r.BeamMemGroupNo)}:${num(r.BeamLevelGroupNo)}`;
      const list = beamZonesByGroup.get(key) ?? [];
      list.push(r);
      beamZonesByGroup.set(key, list);
    }
  }

  const beamDetailByGroup = new Map<string, Row[]>();
  if (has('Beam_Detail_Option')) {
    for (const r of q(
      'SELECT BeamMemGroupNo, BeamLevelGroupNo, ReinfTypeID, LayerNo, ZoneNo, ZoneLength, DiaID, NoOfBar, ShearSpacing, NoOfLegs, StLocation, EndLocation, Ast FROM Beam_Detail_Option'
    )) {
      const key = `${num(r.BeamMemGroupNo)}:${num(r.BeamLevelGroupNo)}`;
      const list = beamDetailByGroup.get(key) ?? [];
      list.push(r);
      beamDetailByGroup.set(key, list);
    }
  }

  // ── Beams ──
  const beams: RCDCBeam[] = [];
  if (has('Beam_Master')) {
    const beamRows = q(
      'SELECT BeamNo, LevelNo, StNodeNo, EndNodeNo, FrameSectionID, BeamName, ClearSpan, StSuppElementID FROM Beam_Master'
    );
    for (const r of beamRows) {
      const beamNo = num(r.BeamNo);
      const startNodeNo = num(r.StNodeNo);
      const endNodeNo = num(r.EndNodeNo);
      const lengthM = nodeById.get(startNodeNo) && nodeById.get(endNodeNo)
        ? Math.sqrt(
            (nodeById.get(startNodeNo)!.x - nodeById.get(endNodeNo)!.x) ** 2 +
              (nodeById.get(startNodeNo)!.y - nodeById.get(endNodeNo)!.y) ** 2 +
              (nodeById.get(startNodeNo)!.z - nodeById.get(endNodeNo)!.z) ** 2
          )
        : num(r.ClearSpan);
      const group = beamMemGroup.get(beamNo);
      const memGroupNo = group?.memGroupNo ?? beamNo;
      const levelGroupNo = group?.levelGroupNo ?? beamNo;
      const groupKey = `${memGroupNo}:${levelGroupNo}`;
      const optionNo = beamOptionLink.get(groupKey) ?? 1;
      const option = beamOptions.get(optionNo) ?? { concreteGradeId: 0, steelGradeId: 0, coverMm: 25, minBarDiaId: 0 };
      const sec = sectionById.get(num(r.FrameSectionID));

      const envelRaw = beamEnvelopeByBS.get(beamNo);
      const envelope: RCDCEnvelope = envelRaw
        ? { ...envelRaw }
        : { maxAxial: 0, minAxial: 0, maxShear: 0, maxTorsion: 0, maxMomentMajor: 0, maxMomentMinor: 0 };
      if (!envelRaw) warnings.push(`Beam ${beamNo}: no load-combination forces found.`);

      const stations = beamStationsByGroup.get(groupKey) ?? [];
      for (const s of stations) {
        s.locationMm = round((s.locationMm / 1000) * lengthM * 1000);
      }
      if (stations.length) {
        for (const s of stations) {
          if (Math.abs(s.momentTop) > Math.abs(envelope.maxMomentMajor)) {
            envelope.governingLoadCombId = s.astTopLoadCombId;
          }
        }
      }

      const detailRows = beamDetailByGroup.get(groupKey) ?? [];
      const topLayers: RCDCBarLayer[] = [];
      const bottomLayers: RCDCBarLayer[] = [];
      const shearZones: RCDCShearZone[] = [];
      const detailByType = {
        1: detailRows.filter((d) => Math.round(num(d.ReinfTypeID)) === 1),
        2: detailRows.filter((d) => Math.round(num(d.ReinfTypeID)) === 2),
        3: detailRows.filter((d) => Math.round(num(d.ReinfTypeID)) === 3),
      };
      for (const d of detailByType[1]) {
        const diaId = num(d.DiaID);
        const area = num(d.Ast);
        const count = Math.max(1, Math.round(num(d.NoOfBar)));
        topLayers.push({
          zoneNo: Math.round(num(d.ZoneNo)),
          ast: round(area),
          bars: [{ diameterMm: diaFor(diaId), count, areaMm2: round(area) }],
          basicZone: 1,
          designLocation: num(d.StLocation) < 0.25 ? 1 : 2,
        });
        if (barDias[diaId]) {
          const good = barDias[diaId];
          topLayers[topLayers.length - 1].bars = [
            { diameterMm: good.diameterMm, count, areaMm2: round(count * good.areaMm2) },
          ];
        }
      }
      for (const d of detailByType[2]) {
        const diaId = num(d.DiaID);
        const area = num(d.Ast);
        const count = Math.max(1, Math.round(num(d.NoOfBar)));
        bottomLayers.push({
          zoneNo: Math.round(num(d.ZoneNo)),
          ast: round(area),
          bars: [{ diameterMm: diaFor(diaId), count, areaMm2: round(area) }],
          basicZone: 2,
          designLocation: num(d.StLocation) >= 0.4 && num(d.StLocation) <= 0.6 ? 2 : 1,
        });
        if (barDias[diaId]) {
          const good = barDias[diaId];
          bottomLayers[bottomLayers.length - 1].bars = [
            { diameterMm: good.diameterMm, count, areaMm2: round(count * good.areaMm2) },
          ];
        }
      }
      for (const d of detailByType[3]) {
        const diaId = num(d.DiaID);
        shearZones.push({
          zoneNo: Math.round(num(d.ZoneNo)),
          spacingMm: round(num(d.ShearSpacing, 1, 150)),
          diameterMm: diaFor(diaId),
          legs: Math.round(num(d.NoOfLegs)),
          asvMm2: round(num(d.Ast)),
        });
        if (barDias[diaId]) {
          shearZones[shearZones.length - 1].asvMm2 = round(
            barDias[diaId].areaMm2 * Math.max(1, Math.round(num(d.NoOfLegs)))
          );
        }
      }

      const zoneRows = beamZonesByGroup.get(groupKey) ?? [];
      const zones: RCDCBeamZone[] = zoneRows.map((z) => {
        const topZoneNo = Math.round(num(z.TopZoneNo));
        const bottomZoneNo = Math.round(num(z.BottomZoneNo));
        const shearZoneNo = Math.round(num(z.ShearZoneNo));
        const rebarTop = topLayers.find((l) => l.zoneNo === topZoneNo);
        const rebarBottom = bottomLayers.find((l) => l.zoneNo === bottomZoneNo);
        const stirrup = shearZones.find((zSheet) => zSheet.zoneNo === shearZoneNo);
        return {
          zoneNo: topZoneNo && topZoneNo === bottomZoneNo ? topZoneNo : 0,
          startMm: round(num(z.StLocation) * lengthM * 1000),
          endMm: round(num(z.EndLocation) * lengthM * 1000),
          topAstLoc: 2,
          bottomAstLoc: 2,
          momentTop: round(num(z.MomentTop)),
          momentBottom: round(num(z.MomentBottom)),
          astTopProv: round(num(z.AstTopProv)),
          astBottomProv: round(num(z.AstBottomProv)),
          shear: round(num(z.Shear)),
          asvProv: round(num(z.AsvCalc)),
          shearSpacingMm: round(num(z.ShearSpacing)),
          torsion: round(num(z.Torsion)),
          rebarTop,
          rebarBottom,
          stirrup,
        };
      });

      beams.push({
        beamNo,
        name: String(r.BeamName ?? `B${beamNo}`),
        startNodeNo,
        endNodeNo,
        levelNo: Math.round(num(r.LevelNo)),
        frameSectionId: num(r.FrameSectionID),
        widthMm: sec?.widthMm ?? 0,
        depthMm: sec?.depthMm ?? 0,
        clearSpanMm: round(lengthM * 1000),
        concreteGradeId: option.concreteGradeId,
        steelGradeId: option.steelGradeId,
        coverMm: option.coverMm,
        reinforcementTypeId: 0,
        envelope,
        stations,
        zones,
        topLayers,
        bottomLayers,
        shearZones,
      });
    }
    beams.sort((a, b) => a.beamNo - b.beamNo);
    if (!beams.length) warnings.push('No beam design records found (check Beam_Master / Beam design tables).');
  } else {
    warnings.push('No Beam_Master table — beams will be empty.');
  }

  // ── Column design maps ──
  const columnOptions = new Map<number, Record<string, any>>();
  if (has('Column_Option_Link')) {
    for (const r of q(
      'SELECT ColumnNo, ConcreteGradeID, SteelGradeID, Cover, ColumnWidth, ColumnDepth, DesignFailFlag, BracedFlagMajor, BracedFlagMinor, EffLengthFactorMajor, EffLengthFactorMinor, InteractionRatio, CapacityRatioAxial FROM Column_Option_Link'
    )) {
      columnOptions.set(num(r.ColumnNo), r);
    }
  }
  const columnDetails = new Map<number, Row[]>();
  if (has('Column_Detail_Option')) {
    for (const r of q(
      'SELECT ColumnNo, CReinfTypeID, ZoneNo, ZoneLength, BarID, BarNos, BarSpacing, NoOfLegs, LinkSets FROM Column_Detail_Option'
    )) {
      const key = num(r.ColumnNo);
      const list = columnDetails.get(key) ?? [];
      list.push(r);
      columnDetails.set(key, list);
    }
  }
  const columnRebar = new Map<number, Row[]>();
  if (has('Column_Reinforcement_Table')) {
    for (const r of q('SELECT ColumnNo, BarID, DeltaX, DeltaZ FROM Column_Reinforcement_Table')) {
      const key = num(r.ColumnNo);
      const list = columnRebar.get(key) ?? [];
      list.push(r);
      columnRebar.set(key, list);
    }
  }

  // ── Column forces envelope (per BS_ColumnNo) ──
  const columnEnvelopeByBS = new Map<number, RCDCEnvelope>();
  if (has('LoadComb_Column_Forces')) {
    for (const r of q(
      'SELECT BS_ColumnNo AS colNo, MAX(AxialForce) AS maxAxial, MIN(AxialForce) AS minAxial, MAX(ABS(ShearY)) AS maxShear, MAX(ABS(Torsion)) AS maxTorsion, MAX(ABS(MomentY)) AS maxMomentY, MAX(ABS(MomentZ)) AS maxMomentZ FROM LoadComb_Column_Forces GROUP BY BS_ColumnNo'
    )) {
      columnEnvelopeByBS.set(num(r.colNo), {
        maxAxial: round(num(r.maxAxial)),
        minAxial: round(num(r.minAxial)),
        maxShear: round(num(r.maxShear)),
        maxTorsion: round(num(r.maxTorsion)),
        maxMomentMajor: round(num(r.maxMomentZ)),
        maxMomentMinor: round(num(r.maxMomentY)),
      });
    }
  }

  // ── Columns ──
  const columns: RCDCColumn[] = [];
  if (has('Column_Master')) {
    const colRows = q(
      'SELECT ColumnNo, StNodeNo, EndNodeNo, FrameSectionID, ColumnFamilyNo, LevelNo FROM Column_Master'
    );
    // RCDC Column_Master uses ColumnNo directly for design output (Column_Option_Link.ColumnNo).
    const bsMapping = new Map<number, number>();
    for (const r of colRows) bsMapping.set(num(r.ColumnNo), num(r.ColumnNo));

    for (const r of colRows) {
      const columnNo = num(r.ColumnNo);
      const startNodeNo = num(r.StNodeNo);
      const endNodeNo = num(r.EndNodeNo);
      const heightM = nodeById.get(startNodeNo) && nodeById.get(endNodeNo)
        ? Math.abs(nodeById.get(endNodeNo)!.y - nodeById.get(startNodeNo)!.y)
        : 0;
      const optRaw = columnOptions.get(columnNo);
      const sec = sectionById.get(num(r.FrameSectionID));
      const bsNo = bsMapping.get(columnNo) ?? columnNo;
      const envelRaw = columnEnvelopeByBS.get(bsNo);

      const optLookup = optRaw ?? {
        ConcreteGradeID: 0,
        SteelGradeID: 0,
        Cover: 0.04,
        ColumnWidth: 0,
        ColumnDepth: 0,
        DesignFailFlag: 0,
        BracedFlagMajor: 1,
        BracedFlagMinor: 1,
        EffLengthFactorMajor: 1,
        EffLengthFactorMinor: 1,
        InteractionRatio: 0,
        CapacityRatioAxial: 0,
      };

      const details = columnDetails.get(columnNo) ?? [];
      const mainRow = details.find((d) => Math.round(num(d.CReinfTypeID)) === 1);
      const mainBars: RCDCBar[] = [];
      if (mainRow) {
        const diaId = num(mainRow.BarID);
        const count = Math.round(num(mainRow.BarNos));
        mainBars.push({
          diameterMm: diaFor(diaId),
          count,
          areaMm2: round(barDias[diaId]?.areaMm2 ? count * barDias[diaId]!.areaMm2 : 0),
        });
      } else if (columnRebar.has(columnNo)) {
        const barRows = columnRebar.get(columnNo)!;
        const diaId = barRows.find((b) => num(b.BarID))?.BarID;
        mainBars.push({
          diameterMm: diaFor(num(diaId)),
          count: barRows.length,
          areaMm2: round(barDias[num(diaId)]?.areaMm2 ? barRows.length * barDias[num(diaId)]!.areaMm2 : 0),
        });
      }

      const linkZones: RCDCLinkZone[] = [];
      for (const d of details.filter((d) => Math.round(num(d.CReinfTypeID)) >= 2)) {
        const reinfType = Math.round(num(d.CReinfTypeID));
        const zoneLength = num(d.ZoneLength);
        linkZones.push({
          zoneNo: Math.round(num(d.ZoneNo)),
          type: reinfType === 3 ? 1 : 2,
          startMm: 0,
          endMm: round(zoneLength),
          spacingMm: round(num(d.BarSpacing, 1, 200)),
          diameterMm: diaFor(num(d.BarID)),
          legs: Math.round(num(d.NoOfLegs)),
          linkSets: Math.round(num(d.LinkSets)),
          asvMm2: round(barDias[num(d.BarID)]?.areaMm2 ? barDias[num(d.BarID)]!.areaMm2 * Math.max(1, Math.round(num(d.NoOfLegs))) : 0),
        });
      }

      const barCoords = (columnRebar.get(columnNo) ?? [])
        .filter((b) => b.BarID)
        .map((b) => ({ dx: num(b.DeltaX), dz: num(b.DeltaZ) }));

      const statusAstProvidedMm2 = mainBars.length ? mainBars[0].areaMm2 : 0;

      const envelope: RCDCEnvelope = envelRaw
        ? { ...envelRaw }
        : { maxAxial: 0, minAxial: 0, maxShear: 0, maxTorsion: 0, maxMomentMajor: 0, maxMomentMinor: 0 };

      columns.push({
        columnNo,
        name: `C${columnNo}`,
        startNodeNo,
        endNodeNo,
        levelNo: Math.round(num(r.LevelNo)),
        frameSectionId: num(r.FrameSectionID),
        familyNo: Math.round(num(r.ColumnFamilyNo)),
        widthMm: round(num(optLookup.ColumnWidth, 1000)),
        depthMm: round(num(optLookup.ColumnDepth, 1000)),
        unsupportedLengthMm: round(heightM * 1000),
        concreteGradeId: num(optLookup.ConcreteGradeID),
        steelGradeId: num(optLookup.SteelGradeID),
        reinforcementTypeId: 0,
        coverMm: round(num(optLookup.Cover, 1000, 50)),
        interactionRatio: round(num(optLookup.InteractionRatio)),
        braced: Math.round(num(optLookup.BracedFlagMajor)) === 1 || Math.round(num(optLookup.BracedFlagMinor)) === 1,
        effectiveLengthFactorMajor: round(num(optLookup.EffLengthFactorMajor, 1, 1)),
        effectiveLengthFactorMinor: round(num(optLookup.EffLengthFactorMinor, 1, 1)),
        designFail: Math.round(num(optLookup.DesignFailFlag)) === 1,
        envelope,
        mainBars,
        barCoords,
        linkZones,
        statusAstProvidedMm2,
      });
    }
    columns.sort((a, b) => a.columnNo - b.columnNo);
  }

  // ── Slabs ──
  const slabs: RCDCSlabPanel[] = [];
  const slabSchedule: RCDCSlabSchedule[] = [];
  if (has('Slab_Panel_Master')) {
    const panelRows = q(
      'SELECT SlabPanelNo, SlabMark, PanelSpanTypeID, PanelSpanID, DeflectionCheckFlag, DesignDirection, DesignCodeID, ConcreteGradeID, SteelGradeID FROM Slab_Panel_Master'
    );
    const panelToArea = new Map<number, number>();
    if (has('Slab_Panel_Link')) {
      for (const r of q('SELECT SlabPanelNo, AreaNo FROM Slab_Panel_Link')) {
        panelToArea.set(num(r.SlabPanelNo), num(r.AreaNo));
      }
    }
    const areaNodes = new Map<number, number[]>();
    const areaNodeSrc = has('AreaNodeLink') ? 'AreaNodeLink' : has('AN_AreaNodeLink') ? 'AN_AreaNodeLink' : null;
    if (areaNodeSrc) {
      const col = areaNodeSrc === 'AN_AreaNodeLink' ? 'AN_AreaNo' : 'AreaNo';
      const nodeCol = areaNodeSrc === 'AN_AreaNodeLink' ? 'AN_NodeNo' : 'NodeNo';
      for (const r of q(`SELECT ${col} AS areaNo, ${nodeCol} AS nodeNo FROM ${areaNodeSrc}`)) {
        const areaNo = num(r.areaNo);
        const list = areaNodes.get(areaNo) ?? [];
        list.push(num(r.nodeNo));
        areaNodes.set(areaNo, list);
      }
    }
    const areaEdges = new Map<number, RCDCSlabPanel['edges']>();
    if (has('SlabEdgeMaster')) {
      for (const r of q('SELECT AreaNo, EdgeId, StNodeNo, EndNodeNo, EdgeType, EdgeName FROM SlabEdgeMaster')) {
        const areaNo = num(r.AreaNo);
        const list = areaEdges.get(areaNo) ?? [];
        list.push({
          edgeId: num(r.EdgeId),
          startNodeNo: num(r.StNodeNo),
          endNodeNo: num(r.EndNodeNo),
          edgeType: String(r.EdgeType ?? 'o'),
          edgeName: String(r.EdgeName ?? ''),
        });
        areaEdges.set(areaNo, list);
      }
    }

    const designOptions = new Map<number, Row>();
    if (has('Panel_Design_Options')) {
      for (const r of q('SELECT PanelDesignOptionNo, SlabPanelNo, PanelThickness, PanelCover, ConcreteGradeID, SteelGradeID FROM Panel_Design_Options')) {
        designOptions.set(num(r.SlabPanelNo), r);
      }
    }
    const analData = new Map<number, Row>();
    if (has('Slab_Anal_Data')) {
      for (const r of q('SELECT SlabPanelNo, Dim1, Dim2, LiveLoad, ImposedLoad FROM Slab_Anal_Data')) {
        analData.set(num(r.SlabPanelNo), r);
      }
    }
    const designDetailsByPanel = new Map<number, Row[]>();
    if (has('Panel_Design_Details')) {
      for (const r of q('SELECT PanelDesignOptionNo, SlabReinforcementTypeID, BendingMoment, PercSteel, Ast FROM Panel_Design_Details')) {
        const key = num(r.PanelDesignOptionNo);
        const list = designDetailsByPanel.get(key) ?? [];
        list.push(r);
        designDetailsByPanel.set(key, list);
      }
    }
    const reinfDetailsByPanel = new Map<number, Row[]>();
    if (has('Panel_Reinforcement_Detail')) {
      for (const r of q('SELECT PanelDesignOptionNo, SlabReinforcementTypeId, BarID, BarSpacing, ReinforcementLegs, AstDesignCalculated, CurtailmentLocation FROM Panel_Reinforcement_Detail')) {
        const key = num(r.PanelDesignOptionNo);
        const list = reinfDetailsByPanel.get(key) ?? [];
        list.push(r);
        reinfDetailsByPanel.set(key, list);
      }
    }

    for (const r of panelRows) {
      const panelNo = num(r.SlabPanelNo);
      const areaNo = panelToArea.get(panelNo) ?? panelNo;
      const opt = designOptions.get(panelNo) ?? {};
      const anal = analData.get(panelNo) ?? {};
      const nodeList = areaNodes.get(areaNo) ?? [];
      const panelNodes = nodeList.map((n) => nodeById.get(n)).filter(Boolean) as RCDCNode[];
      const xs = panelNodes.map((n) => n.x);
      const zs = panelNodes.map((n) => n.z);
      const widthMm = xs.length ? round((Math.max(...xs) - Math.min(...xs)) * 1000) : round(num(anal.Dim1, 1000));
      const heightMm = zs.length ? round((Math.max(...zs) - Math.min(...zs)) * 1000) : round(num(anal.Dim2, 1000));

      const conc = concreteById.get(num(opt.ConcreteGradeID, 1, num(r.ConcreteGradeID)));
      const steel = steelById.get(num(opt.SteelGradeID, 1, num(r.SteelGradeID)));

      // Build reinforcement details: pair design details with provided bar spacing.
      const designDet = designDetailsByPanel.get(num(opt.PanelDesignOptionNo, 1, panelNo)) ?? [];
      const reinfDet = reinfDetailsByPanel.get(num(opt.PanelDesignOptionNo, 1, panelNo)) ?? [];
      const reinforcement: RCDCSlabReinforcement[] = [];
      for (const dd of designDet) {
        const typeId = Math.round(num(dd.SlabReinforcementTypeID));
        const rd = reinfDet.find((x) => Math.round(num(x.SlabReinforcementTypeId)) === typeId);
        const barId = num(rd?.BarID);
        const spacingM = num(rd?.BarSpacing);
        const astProv = barDias[barId]
          ? round(barDias[barId].areaMm2 / Math.max(spacingM, 0.001))
          : 0;
        reinforcement.push({
          reinforcementTypeId: typeId,
          bendingMoment: round(num(dd.BendingMoment)),
          astReqMm2PerM: round(num(dd.Ast, 1e6)),
          astProvMm2PerM: round(num(rd?.AstDesignCalculated, 1e6, 0) || astProv),
          barId: Math.round(barId),
          barDiameterMm: barDias[barId]?.diameterMm ?? 0,
          barSpacingMm: round(spacingM * 1000),
          legs: Math.round(num(rd?.ReinforcementLegs)),
          curtailmentLocation: round(num(rd?.CurtailmentLocation)),
        });
      }
      const mainBottom = reinforcement
        .filter((x) => x.reinforcementTypeId >= 6 && x.reinforcementTypeId <= 8)
        .sort((a, b) => b.astProvMm2PerM - a.astProvMm2PerM)[0];
      const mainTop = reinforcement
        .filter((x) => x.reinforcementTypeId >= 9 && x.reinforcementTypeId <= 12)
        .sort((a, b) => b.astProvMm2PerM - a.astProvMm2PerM)[0];

      slabs.push({
        panelNo,
        areaNo,
        mark: String(r.SlabMark ?? `S${panelNo}`),
        levelNo: Math.round(num(r.LevelNo)),
        thicknessMm: round(num(opt.PanelThickness, 1000, 150)),
        spanTypeId: Math.round(num(r.PanelSpanTypeID)),
        designDirection: String(r.DesignDirection ?? ''),
        designCodeId: Math.round(num(r.DesignCodeID)),
        concreteGradeId: Math.round(num(r.ConcreteGradeID)),
        steelGradeId: Math.round(num(r.SteelGradeID)),
        concreteName: conc?.name ?? '',
        steelName: steel?.name ?? '',
        nodeNos: nodeList,
        edges: areaEdges.get(areaNo) ?? [],
        widthMm,
        heightMm,
        dim1Mm: round(num(anal.Dim1, 1000)),
        dim2Mm: round(num(anal.Dim2, 1000)),
        liveLoad: round(num(anal.LiveLoad)),
        finishedLoad: round(num(anal.ImposedLoad)),
        coverMm: round(num(opt.PanelCover, 1000, 25)),
        deflectionChecked: Math.round(num(r.DeflectionCheckFlag)) === 1,
        astDesign: mainBottom?.astProvMm2PerM ?? 0,
        astReqMain: reinforcement.reduce((sum, x) => sum + x.astReqMm2PerM, 0),
        astProvMain: mainBottom?.astProvMm2PerM ?? 0,
        mainBarDiameter: mainBottom?.barDiameterMm ?? 0,
        mainBarSpacing: mainBottom?.barSpacingMm ?? 0,
        mainBarDirection: 'SHORT_SPAN',
        astReqDistribution: mainTop?.astReqMm2PerM ?? 0,
        astProvDistribution: mainTop?.astProvMm2PerM ?? 0,
        distBarDiameter: mainTop?.barDiameterMm ?? 0,
        distBarSpacing: mainTop?.barSpacingMm ?? 0,
        edgeBeams: (areaEdges.get(areaNo) ?? [])
          .filter((e) => e.edgeType === 'b')
          .map((e, i) => ({ beamNo: Number(e.edgeName.replace(/\D+/g, '')) || 0, spanId: i })),
        reinforcement,
        span: round(Math.max(num(anal.Dim1), num(anal.Dim2))),
        averageClearSpan: round((num(anal.Dim1) + num(anal.Dim2)) / 2),
        liveLoadKgM2: round(num(anal.LiveLoad, 100)),
      });
    }
    slabs.sort((a, b) => a.panelNo - b.panelNo);

    if (has('SlabSchedule')) {
      for (const s of q(
        'SELECT SlabName, Thickness, BotReinfSS, BotReinfLS, TopReinfEndSS, TopReinfEndLS, TopReinfContSS, TopReinfContLS, Distribution, LevelNo FROM SlabSchedule'
      )) {
        slabSchedule.push({
          panelNo: 0,
          mark: String(s.SlabName ?? ''),
          thickness: round(num(s.Thickness, 1000)),
          schedule: String(s.BotReinfSS ?? ''),
          loadPsf: 0,
        });
      }
    }
  }

  db.close();

  const concreteGrades = Array.from(concreteById.entries()).map(([id, v]) => ({ concreteGradeId: id, name: v.name, fck: v.fck }));
  const steelGrades = Array.from(steelById.entries()).map(([id, v]) => ({ reinforcementTypeId: id, name: v.name, fy: v.fy }));

  const doc: RCDCDocument = {
    format: 'RCDC',
    schemaVersion: 1,
    metadata: {
      fileName,
      rcdcVersion: masterProps['RCDCVersion'] || '',
      dbVersion: masterProps['DBVersion'] || '',
      projectName: projectProps['ProjectName'] || '',
      engineer: projectProps['EngineerName'] || projectProps['Engineer'] || '',
      client: projectProps['ClientName'] || projectProps['Client'] || '',
      date: projectProps['Date'] || projectProps['DateOfDesign'] || '',
      analysisFileName: projectProps['AnalysisFileName'] || '',
      designCode: designCodeMap[1] || '',
    },
    levels,
    nodes,
    supports,
    sections,
    beams,
    columns,
    slabs,
    slabSchedule,
    loadCases,
    loadCombinations: combos,
    concreteGrades,
    steelGrades,
    barDiameters: barDias,
    warnings,
  };

  return doc;
}