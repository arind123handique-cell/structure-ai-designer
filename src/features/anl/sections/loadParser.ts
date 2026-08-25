import { LoadCase, LoadCombination, LoadType } from '@/features/model/types';
import { TokenizedLine } from '../tokenizer/anlTokenizer';

export interface ParsedLoads {
  loadCases: Map<number, LoadCase>;
  loadCombinations: Map<number, LoadCombination>;
}

export class LoadParser {
  public static parse(lines: TokenizedLine[]): ParsedLoads {
    const loadCases = new Map<number, LoadCase>();
    const loadCombinations = new Map<number, LoadCombination>();

    let currentLoadComb: LoadCombination | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const text = line.text;
      const tokens = line.tokens;

      // Check for Load Combination e.g. "LOAD COMB 9 COMB - 1.5 DEAD + 1.5 LIVE"
      const combMatch = text.match(/LOAD\s+COMB(?:INATION)?\s+(\d+)\s*(?:COMB\s*-\s*)?(.*)/i);
      if (combMatch) {
        const combId = parseInt(combMatch[1], 10);
        const title = combMatch[2]?.trim() || `Combination ${combId}`;

        currentLoadComb = {
          id: combId,
          title,
          factors: [],
        };
        loadCombinations.set(combId, currentLoadComb);

        // Also add as a load case in the map for reference
        loadCases.set(combId, {
          id: combId,
          title,
          type: 'COMBINATION',
          isCombination: true,
        });

        // Peek next lines for case factors e.g. "3 1.5 4 1.5"
        if (i + 1 < lines.length) {
          const nextTokens = lines[i + 1].tokens;
          if (nextTokens.length >= 2 && !isNaN(parseFloat(nextTokens[0])) && !isNaN(parseFloat(nextTokens[1]))) {
            for (let k = 0; k + 1 < nextTokens.length; k += 2) {
              const lcId = parseInt(nextTokens[k], 10);
              const factor = parseFloat(nextTokens[k + 1]);
              if (!isNaN(lcId) && !isNaN(factor)) {
                currentLoadComb.factors.push({ loadCaseId: lcId, factor });
              }
            }
          }
        }
        continue;
      }

      // Check for Primary Load Case e.g. "LOAD 1 LOADTYPE SEISMIC-H TITLE EQX" or "LOAD 3 LOADTYPE DEAD TITLE DL"
      const loadMatch = text.match(/LOAD\s+(\d+)(?:\s+LOADTYPE\s+([A-Z0-9_-]+))?(?:\s+TITLE\s+(.*))?/i);
      if (loadMatch && !text.toUpperCase().includes('COMB')) {
        const id = parseInt(loadMatch[1], 10);
        const rawType = loadMatch[2]?.toUpperCase() || 'DEAD';
        const title = loadMatch[3]?.trim() || `Load Case ${id}`;

        let type: LoadType = 'DEAD';
        if (rawType.includes('LIVE')) type = 'LIVE';
        else if (rawType.includes('WIND')) type = 'WIND';
        else if (rawType.includes('SEISMIC') || rawType.includes('EQ') || rawType.includes('SPECTRUM')) type = 'SEISMIC';
        else if (rawType.includes('MASS')) type = 'MASS';
        else if (rawType.includes('TEMP')) type = 'TEMPERATURE';

        loadCases.set(id, {
          id,
          title,
          type,
          isCombination: false,
        });
      }
    }

    return { loadCases, loadCombinations };
  }
}
