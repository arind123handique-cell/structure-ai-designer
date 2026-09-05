import {
  IS456LoadCombinations,
  StandardLoadCombination,
} from '@/features/codes/is456/loadCombinations';
import { LoadCase, LoadCombination } from '@/features/model/types';

/**
 * Builds IS 456 / IS 1893 load combinations from the model's actual load
 * cases by mapping DL / LL / EQX / EQZ / WLX / WLZ roles to real load-case
 * titles (and ids). Only roles whose matching load case exists are included.
 */
export function buildLoadCombinationsFromModel(loadCases: LoadCase[]): LoadCombination[] {
  const resolve = (pattern: string): LoadCase | undefined => {
    const upper = pattern.toUpperCase();
    // Prefer exact title match, then token-substring match (e.g. 'Dead Load (DL)' contains 'DEAD')
    const exact = loadCases.find(
      (lc) => !lc.isCombination && lc.title.toUpperCase() === upper
    );
    if (exact) return exact;
    // Token boundaries: strip non-alphanumerics and match on the bare token
    const token = upper.replace(/[^A-Z0-9]/g, '');
    return loadCases.find(
      (lc) => !lc.isCombination && lc.title.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(token)
    );
  };

  const patterns: [keyof StandardLoadCombination['factors'], string][] = [
    ['dl', 'DEAD'],
    ['ll', 'LIVE'],
    ['eqx', 'EQX'],
    ['eqz', 'EQZ'],
    ['wlx', 'WLX'],
    ['wlz', 'WLZ'],
  ];

  const factorOf = (combo: StandardLoadCombination, role: keyof StandardLoadCombination['factors']) =>
    combo.factors[role] as number | undefined;

  return IS456LoadCombinations.getStandardCombinations()
    .filter((combo) =>
      patterns.every(([role, pattern]) => {
        const f = factorOf(combo, role);
        return f === undefined || !!resolve(pattern);
      })
    )
    .map((combo) => {
      const factors: { loadCaseId: number; factor: number }[] = [];
      for (const [role, pattern] of patterns) {
        const factor = factorOf(combo, role);
        if (factor === undefined || factor === 0) continue;
        const lc = resolve(pattern);
        if (lc) factors.push({ loadCaseId: lc.id, factor });
      }
      return {
        id: combo.id,
        title: combo.name,
        factors,
      } satisfies LoadCombination;
    });
}