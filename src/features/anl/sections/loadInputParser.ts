import { MemberLoad, ShellLoad, LoadType } from '@/features/model/types';
import { TokenizedLine, ANLTokenizer } from '../tokenizer/anlTokenizer';

export interface ParsedLoadInput {
  memberLoads: Map<number, MemberLoad[]>;
  shellLoads: ShellLoad[];
  concreteDensity?: number; // kN/m3 (from DEFINE MATERIAL DENSITY)
  concreteE?: number; // kN/m2 (from DEFINE MATERIAL E)
  selfweightAxis?: 'Y' | 'Z';
  selfweightFactor?: number; // signed factor, e.g. -1 for downward DL
  hasExplicitDeadLoad: boolean; // true when a DEAD load case declares SELFWEIGHT / MEMBER LOAD
  deadLoadCaseId?: number;
}

/**
 * Parses actual STAAD *input* load commands from a .STD / .ANL file so that the
 * in-app FEM re-analysis applies the SAME loads STAAD used, instead of falling
 * back on generic heuristics (which overweight the structure ~6x).
 *
 * Handles:
 *   DEFINE MATERIAL ... DENSITY <n> ... E <n> ... END DEFINE MATERIAL
 *   LOAD <id> LOADTYPE Dead TITLE <t>
 *   SELFWEIGHT <axis> <factor> [LIST <ids>]
 *   MEMBER LOAD
 *   <idlist> UNI GY <udl>
 *   FLOOR LOAD / ELEMENT FLOOR LOAD ... YRANGE ... FLOAD <p> GY
 *
 * Only DEAD-load member definitions are converted to MemberLoad[] (the solver
 * applies member self-weight + member UDLs exactly). Live floor loads on shell
 * elements are captured as ShellLoad[] for documentation but are NOT converted
 * to member tributary loads here.
 */
export class LoadInputParser {
  public static parse(lines: TokenizedLine[]): ParsedLoadInput {
    const memberLoads = new Map<number, MemberLoad[]>();
    const shellLoads: ShellLoad[] = [];
    const result: ParsedLoadInput = { memberLoads, shellLoads, hasExplicitDeadLoad: false };

    let inMaterial = false;
    let currentCaseId: number | null = null;
    let currentCaseType: LoadType | null = null;
    let inMemberLoadBlock = false;
    let selfweightSeenForCase = false;

    // Material density from DEFINE MATERIAL (defaults to plain concrete 24 kN/m3)
    let density: number | undefined;
    let eMod: number | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upper = line.text.toUpperCase();
      const tokens = line.tokens;

      // Material definition
      if (/^DEFINE\s+MATERIAL/i.test(upper)) {
        inMaterial = true;
        continue;
      }
      if (inMaterial) {
        if (/^END\s+DEFINE\s+MATERIAL/i.test(upper)) {
          inMaterial = false;
          continue;
        }
        const dToks = tokens.map((t) => t.toUpperCase());
        const densIdx = dToks.indexOf('DENSITY');
        if (densIdx !== -1 && tokens[densIdx + 1]) {
          const d = parseFloat(tokens[densIdx + 1]);
          if (!isNaN(d)) density = d;
        }
        const eIdx = dToks.indexOf('E');
        if (eIdx === 0 && tokens[1]) {
          const e = parseFloat(tokens[1]);
          if (!isNaN(e)) eMod = e;
        }
        continue;
      }

      // New load case definition
      const loadCaseMatch = upper.match(/^LOAD\s+(\d+)/);
      if (loadCaseMatch && !/^LOAD\s+COMB/i.test(upper)) {
        currentCaseId = parseInt(loadCaseMatch[1], 10);
        currentCaseType = this.typeFromTokens(tokens);
        inMemberLoadBlock = false;
        selfweightSeenForCase = false;
        continue;
      }

      // EMPTY "MEMBER LOAD" marks the start of a member-load data block in the
      // current (already started) load case. However STAAD output tables also
      // print "MEMBER LOAD ..." headers; we only treat a bare "MEMBER LOAD" token
      // as input when we are inside an active, non-combination load case.
      if (/^MEMBER\s+LOAD/i.test(upper) && tokens.length <= 2 && currentCaseId != null && !this.isReferenceLoadDef(line)) {
        inMemberLoadBlock = true;
        continue;
      }

      // A member-load data line typically contains a UNI keyword.
      if (inMemberLoadBlock && /\bUNI\b/i.test(upper)) {
        this.parseMemberUdlTokens(line, currentCaseId, currentCaseType, memberLoads);
        continue;
      }

      // SELFWEIGHT (within an active load case, skip DEFINE ... reference loads)
      if (/^SELFWEIGHT\b/i.test(upper) && currentCaseId != null && !this.isReferenceLoadDef(line)) {
        const parsed = this.parseSelfweight(line);
        if (parsed) {
          selfweightSeenForCase = true;
          if (!result.selfweightAxis) result.selfweightAxis = parsed.axis;
          if (result.selfweightFactor === undefined) result.selfweightFactor = parsed.factor;
          if (currentCaseType === 'DEAD' || currentCaseType == null) {
            result.deadLoadCaseId = currentCaseId;
          }
        }
        continue;
      }

      // Floor / element floor load (live/superimposed on slabs)
      if (/^(FLOOR\s+LOAD|ELEMENT\s+FLOOR\s+LOAD)/i.test(upper) && currentCaseId != null && !this.isReferenceLoadDef(line)) {
        const shell = this.parseFloorLoad(line, currentCaseId, currentCaseType);
        if (shell) shellLoads.push(shell);
        continue;
      }

      // Skipping into another section (e.g. DEFINE IS1893, DEFINE WIND LOAD,
      // PERFORM ANALYSIS) ends any open member-load data block.
      if (/^(DEFINE|PERFORM|START|PRINT|FINISH|DESIGN|CONCRETE|STAAD)/i.test(upper)) {
        inMemberLoadBlock = false;
        currentCaseId = null;
        currentCaseType = null;
      }
    }

    if (density !== undefined) result.concreteDensity = density;
    if (eMod !== undefined) result.concreteE = eMod;
    result.hasExplicitDeadLoad =
      (result.selfweightFactor !== undefined || memberLoads.size > 0) &&
      (result.deadLoadCaseId != null || currentCaseType === 'DEAD');

    return result;
  }

  private static typeFromTokens(tokens: string[]): LoadType {
    const ltIdx = tokens.findIndex((t) => t.toUpperCase() === 'LOADTYPE');
    if (ltIdx !== -1 && tokens[ltIdx + 1]) {
      const raw = tokens[ltIdx + 1].toUpperCase();
      if (raw.includes('LIVE')) return 'LIVE';
      if (raw.includes('WIND')) return 'WIND';
      if (raw.includes('SEISMIC') || raw.includes('EQ') || raw.includes('SPECTRUM')) return 'SEISMIC';
      if (raw.includes('MASS')) return 'MASS';
      if (raw.includes('TEMP')) return 'TEMPERATURE';
      if (raw.includes('DEAD')) return 'DEAD';
    }
    return 'DEAD';
  }

  private static isReferenceLoadDef(line: TokenizedLine): boolean {
    return /DEFINE\s+REFERENCE\s+LOADS/i.test(line.text.toUpperCase());
  }

  /**
   * SELFWEIGHT [X|Y|Z] <factor> [LIST <ids>]
   */
  private static parseSelfweight(line: TokenizedLine): { axis: 'Y' | 'Z'; factor: number } | null {
    const tokens = line.tokens;
    let axis: 'Y' | 'Z' = 'Y';
    let factor = -1;
    let idx = 1;
    const first = tokens[1]?.toUpperCase();
    const firstNum = parseFloat(tokens[1]);
    if (first === 'X' || first === 'Y' || first === 'Z') {
      if (first === 'Z') axis = 'Z';
      idx = 2;
    } else if (!isNaN(firstNum)) {
      axis = 'Y';
      idx = 1;
    }
    let factorVal = parseFloat(tokens[idx]);
    if (isNaN(factorVal)) factorVal = -1;
    return { axis, factor: factorVal };
  }

  private static parseMemberUdlTokens(
    line: TokenizedLine,
    caseId: number | null,
    caseType: LoadType | null,
    memberLoads: Map<number, MemberLoad[]>
  ): void {
    const tokens = line.tokens;
    const uniIdx = tokens.findIndex((t) => t.toUpperCase() === 'UNI');
    if (uniIdx === -1) return;

    const idTokens = tokens.slice(0, uniIdx).filter((t) => !/^(GY|GX|GZ|LY|LZ|LX|MEMBER|LOAD|UNI)$/i.test(t));
    const ids = ANLTokenizer.expandIdList(idTokens);

    const rest = tokens.slice(uniIdx + 1);
    const dirTok = rest[0]?.toUpperCase() || 'GY';
    const magStr = rest[1];
    const mag = parseFloat(magStr);
    if (isNaN(mag) || ids.length === 0) return;

    let direction: MemberLoad['direction'];
    if (dirTok === 'GX') direction = 'GLOBAL_X';
    else if (dirTok === 'GZ') direction = 'GLOBAL_Z';
    else if (dirTok === 'LX' || dirTok === 'LY' || dirTok === 'LZ') direction = 'LOCAL_Y';
    else direction = 'GLOBAL_Y';

    const loadPattern = caseType === 'DEAD' || caseType == null ? 'DEAD' : caseType === 'LIVE' ? 'LIVE' : caseType === 'WIND' ? 'WIND' : 'DEAD';

    for (const mid of ids) {
      if (!memberLoads.has(mid)) memberLoads.set(mid, []);
      memberLoads.get(mid)!.push({
        memberId: mid,
        loadPattern,
        type: 'UNIFORM',
        w1: Math.abs(mag),
        direction,
      });
    }
  }

  private static parseFloorLoad(
    line: TokenizedLine,
    caseId: number | null,
    caseType: LoadType | null
  ): ShellLoad | null {
    const tokens = line.tokens;
    const floIdx = tokens.findIndex((t) => t.toUpperCase() === 'FLOAD');
    if (floIdx === -1 || !tokens[floIdx + 1]) return null;
    const pressure = Math.abs(parseFloat(tokens[floIdx + 1]));
    if (isNaN(pressure)) return null;

    // YRANGE low high — capture the top level
    const yrIdx = tokens.findIndex((t) => t.toUpperCase() === 'YRANGE');
    let levelY = 0;
    if (yrIdx !== -1 && tokens[yrIdx + 1]) {
      const levels = tokens.slice(yrIdx + 1).map((t) => parseFloat(t));
      const valid = levels.filter((v) => !isNaN(v));
      if (valid.length >= 2) levelY = valid[1];
    }

    const loadPattern = caseType === 'LIVE' ? 'LIVE' : caseType === 'DEAD' || caseType == null ? 'DEAD' : 'SDL';
    return {
      levelY,
      loadPattern,
      pressure,
      distributionType: 'TWO_WAY',
    };
  }
}
