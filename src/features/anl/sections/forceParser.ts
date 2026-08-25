import { MemberForceRecord, MemberDesignSummary } from '@/features/model/types';

/**
 * ForceParser - Parses STAAD FEM Member End Forces and Concrete Design results.
 *
 * Supports two sources in STAAD ANL files:
 * 1. "PRINT MEMBER FORCES" -> "MEMBER END FORCES" full FEM analysis table:
 *    Parses every member, load combination, and end joint:
 *    AXIAL, SHEAR-Y, SHEAR-Z, TORSION, MOM-Y, MOM-Z.
 * 2. "START CONCRETE DESIGN" -> IS-13920 / IS-456 design results section:
 *    Parses beam & column dimensions, clear cover, and design warnings.
 */
export class ForceParser {
  /**
   * Parses member design results and forces from STAAD output.
   */
  public static parse(rawLines: string[]): {
    forces: MemberForceRecord[];
    designSummaries: Map<number, MemberDesignSummary>;
    warnings: { memberId?: number; message: string }[];
  } {
    const forces: MemberForceRecord[] = [];
    const designSummaries = new Map<number, MemberDesignSummary>();
    const warnings: { memberId?: number; message: string }[] = [];

    // ── STEP 1: Parse "MEMBER END FORCES" FEM Table ────────────────────
    let inEndForces = false;
    let curEndMem = 0;
    let curEndLoad = 0;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];

      if (/MEMBER END FORCES\s+STRUCTURE TYPE/i.test(line)) {
        inEndForces = true;
        continue;
      }

      if (inEndForces) {
        if (/START CONCRETE DESIGN|CONCRETE DESIGN|IS-13920/i.test(line) || /^\s*\d+\.\s+START/i.test(line)) {
          inEndForces = false;
          continue;
        }

        if (
          /^\s*MEMBER\s+LOAD\s+JT/i.test(line) ||
          /ALL UNITS ARE/i.test(line) ||
          /^-+$/.test(line.trim()) ||
          /STAAD SPACE/i.test(line) ||
          /PAGE NO/i.test(line)
        ) {
          continue;
        }

        const tokens = line.trim().split(/\s+/);
        let mem = 0,
          ld = 0,
          jt = 0,
          ax = 0,
          vy = 0,
          vz = 0,
          tor = 0,
          my = 0,
          mz = 0;

        // Line format 1: "      1    1    56      1.22     -0.50     0.22     -1.40     -0.11       0.42"
        if (
          tokens.length === 9 &&
          !isNaN(parseInt(tokens[0])) &&
          !isNaN(parseInt(tokens[1])) &&
          !isNaN(parseInt(tokens[2]))
        ) {
          curEndMem = parseInt(tokens[0]);
          curEndLoad = parseInt(tokens[1]);
          jt = parseInt(tokens[2]);
          ax = parseFloat(tokens[3]);
          vy = parseFloat(tokens[4]);
          vz = parseFloat(tokens[5]);
          tor = parseFloat(tokens[6]);
          my = parseFloat(tokens[7]);
          mz = parseFloat(tokens[8]);
          mem = curEndMem;
          ld = curEndLoad;
        }
        // Line format 2: "           2    56      0.84     -7.00     0.29    -19.49     -0.15      -1.50"
        else if (tokens.length === 8 && !isNaN(parseInt(tokens[0])) && !isNaN(parseInt(tokens[1])) && curEndMem > 0) {
          curEndLoad = parseInt(tokens[0]);
          jt = parseInt(tokens[1]);
          ax = parseFloat(tokens[2]);
          vy = parseFloat(tokens[3]);
          vz = parseFloat(tokens[4]);
          tor = parseFloat(tokens[5]);
          my = parseFloat(tokens[6]);
          mz = parseFloat(tokens[7]);
          mem = curEndMem;
          ld = curEndLoad;
        }
        // Line format 3: "                33     -1.22      0.50    -0.22      1.40     -0.17      -1.04"
        else if (tokens.length === 7 && !isNaN(parseInt(tokens[0])) && curEndMem > 0 && curEndLoad > 0) {
          jt = parseInt(tokens[0]);
          ax = parseFloat(tokens[1]);
          vy = parseFloat(tokens[2]);
          vz = parseFloat(tokens[3]);
          tor = parseFloat(tokens[4]);
          my = parseFloat(tokens[5]);
          mz = parseFloat(tokens[6]);
          mem = curEndMem;
          ld = curEndLoad;
        }

        if (mem > 0 && ld > 0) {
          forces.push({
            memberId: mem,
            loadCaseId: ld,
            sectionLocation: jt,
            axial: ax,
            vy: vy,
            vz: vz,
            torsion: tor,
            my: my,
            mz: mz,
          });

          const prev = designSummaries.get(mem) || {
            memberId: mem,
            classification: 'BEAM',
            sectionDimensions: '',
            governingLoadCase: ld,
            maxAxial: 0,
            maxShear: 0,
            maxMoment: 0,
            status: 'NOT_DESIGNED',
          };

          const absAxial = Math.abs(ax);
          const absShear = Math.max(Math.abs(vy), Math.abs(vz));
          const absMoment = Math.max(Math.abs(mz), Math.abs(my));

          if (absAxial > prev.maxAxial) prev.maxAxial = absAxial;
          if (absShear > prev.maxShear) prev.maxShear = absShear;
          if (absMoment > prev.maxMoment) {
            prev.maxMoment = absMoment;
            prev.governingLoadCase = ld;
          }

          designSummaries.set(mem, prev);
        }
      }
    }

    // ── STEP 2: Parse Concrete Design Results & Dimensions ──────────────
    let currentMemberId = 0;
    let currentClassification: 'BEAM' | 'COLUMN' = 'BEAM';
    let currentDimensions = '';
    let currentGoverningLd = 1;
    let currentMaxShear = 0;
    let currentMaxMoment = 0;
    let currentMaxAxial = 0;

    let currentDepth = 450;
    let currentWidth = 300;
    let currentCover = 30;

    let inTopReinf = false;
    let inBottomReinf = false;
    let maxTopAst = 0;
    let maxBotAst = 0;
    let currentTopSections: number[] = [];
    let currentBotSections: number[] = [];

    const saveDesignSummary = () => {
      if (currentMemberId <= 0) return;

      const existing = designSummaries.get(currentMemberId);

      // If FEM forces were already parsed, preserve real FEM moments/shears and add dimensions & Ast
      if (existing) {
        existing.sectionDimensions = currentDimensions || existing.sectionDimensions;
        existing.classification = currentClassification;
        if (maxTopAst > 0) existing.astTopReq = maxTopAst;
        if (maxBotAst > 0) existing.astBottomReq = maxBotAst;
        if (currentTopSections.length > 0) existing.astTopSections = [...currentTopSections];
        if (currentBotSections.length > 0) existing.astBottomSections = [...currentBotSections];
        designSummaries.set(currentMemberId, existing);
        return;
      }

      // Fallback back-calculation from Ast if FEM table wasn't present
      if (currentMaxMoment === 0 && (maxTopAst > 0 || maxBotAst > 0)) {
        const d = currentDepth - currentCover - 10;
        const maxAst = Math.max(maxTopAst, maxBotAst);
        currentMaxMoment = parseFloat(((maxAst * 0.87 * 500 * 0.9 * d) / 1e6).toFixed(2));
      }

      designSummaries.set(currentMemberId, {
        memberId: currentMemberId,
        classification: currentClassification,
        sectionDimensions: currentDimensions,
        governingLoadCase: currentGoverningLd,
        maxAxial: currentMaxAxial,
        maxShear: currentMaxShear,
        maxMoment: currentMaxMoment,
        astTopReq: maxTopAst > 0 ? maxTopAst : undefined,
        astBottomReq: maxBotAst > 0 ? maxBotAst : undefined,
        astTopSections: currentTopSections.length > 0 ? [...currentTopSections] : undefined,
        astBottomSections: currentBotSections.length > 0 ? [...currentBotSections] : undefined,
        status: 'NOT_DESIGNED',
      });
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];

      // Detect STAAD Warnings
      const warnMatch = line.match(/\*\*\*\s*WARNING\s*:\s*(.*)/i);
      if (warnMatch) {
        const msg = warnMatch[1].trim();
        const memberRefMatch = msg.match(/MEMBER\s*#?\s*(\d+)/i);
        const memberId = memberRefMatch ? parseInt(memberRefMatch[1], 10) : undefined;
        warnings.push({ memberId, message: msg });
      }

      // Detect BEAM / COLUMN design results header
      const memberHeader = line.match(
        /(?:B\s*E\s*A\s*M|C\s*O\s*L\s*U\s*M\s*N)\s+N\s*O\.\s*(\d+)\s+D\s*E\s*S\s*I\s*G\s*N/i
      );
      if (memberHeader) {
        saveDesignSummary();

        currentMemberId = parseInt(memberHeader[1], 10);
        currentClassification = line.toUpperCase().includes('C O L U M N') ? 'COLUMN' : 'BEAM';
        currentMaxShear = 0;
        currentMaxMoment = 0;
        currentMaxAxial = 0;
        maxTopAst = 0;
        maxBotAst = 0;
        currentTopSections = [];
        currentBotSections = [];
        currentDepth = 450;
        currentWidth = 300;
        currentCover = 30;
        currentDimensions = '';
        currentGoverningLd = 1;
        inTopReinf = false;
        inBottomReinf = false;
        continue;
      }

      if (currentMemberId <= 0) continue;

      // Extract SIZE and COVER
      const sizeMatch = line.match(/SIZE:\s*([\d\.]+)\s*mm\s*X\s*([\d\.]+)\s*mm.*COVER:\s*([\d\.]+)\s*mm/i);
      if (sizeMatch) {
        currentWidth = parseFloat(sizeMatch[1]);
        currentDepth = parseFloat(sizeMatch[2]);
        currentCover = parseFloat(sizeMatch[3]);
        currentDimensions = `${currentWidth} mm X ${currentDepth} mm`;
      } else {
        const simpleSizeMatch = line.match(/SIZE:\s*([^\n]+mm\s*X\s*[^\n]+mm)/i);
        if (simpleSizeMatch) {
          currentDimensions = simpleSizeMatch[1].trim();
        }
      }

      // Track REINF. AREA TABLE rows (TOP and BOTTOM)
      if (/SUMMARY OF REINF\.\s*AREA/i.test(line) && !/PROVIDED/i.test(line)) {
        inTopReinf = false;
        inBottomReinf = false;
        continue;
      }
      if (/SUMMARY OF PROVIDED REINF\.\s*AREA/i.test(line)) {
        inTopReinf = false;
        inBottomReinf = false;
        continue;
      }

      const topReinfMatch = line.match(/^\s+TOP\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)/);
      if (topReinfMatch && currentClassification === 'BEAM') {
        const vals = [1, 2, 3, 4, 5].map((k) => parseFloat(topReinfMatch[k]));
        currentTopSections = vals;
        const maxVal = Math.max(...vals);
        if (maxVal > maxTopAst) maxTopAst = maxVal;
        inTopReinf = true;
        inBottomReinf = false;
        continue;
      }

      const botReinfMatch = line.match(/^\s+BOTTOM\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)/);
      if (botReinfMatch && currentClassification === 'BEAM') {
        const vals = [1, 2, 3, 4, 5].map((k) => parseFloat(botReinfMatch[k]));
        currentBotSections = vals;
        const maxVal = Math.max(...vals);
        if (maxVal > maxBotAst) maxBotAst = maxVal;
        inTopReinf = false;
        inBottomReinf = true;
        continue;
      }

      // Extract SHEAR DESIGN VY / TORSION / LD lines
      const forceMatch = line.match(/VY\s*=\s*([-\d\.]+).*?(?:MX|MZ|MY)\s*=\s*([-\d\.]+).*?LD\s*=\s*(\d+)/i);
      if (forceMatch) {
        const vy = parseFloat(forceMatch[1]);
        const mVal = parseFloat(forceMatch[2]);
        const ld = parseInt(forceMatch[3], 10);

        if (!isNaN(vy) && Math.abs(vy) > currentMaxShear) currentMaxShear = Math.abs(vy);
        if (!isNaN(ld)) currentGoverningLd = ld;

        if (currentClassification === 'COLUMN' && !isNaN(mVal)) {
          if (Math.abs(mVal) > currentMaxMoment) currentMaxMoment = Math.abs(mVal);
        }

        // If no FEM table was present, push concrete design force
        if (forces.length === 0) {
          forces.push({
            memberId: currentMemberId,
            loadCaseId: ld,
            sectionLocation: 0,
            axial: currentClassification === 'COLUMN' ? Math.abs(mVal) * 0.5 : 0,
            vy,
            vz: 0,
            torsion: currentClassification === 'BEAM' ? Math.abs(mVal) : 0,
            my: 0,
            mz: 0,
          });
        }
      }
    }

    saveDesignSummary();

    return { forces, designSummaries, warnings };
  }
}
