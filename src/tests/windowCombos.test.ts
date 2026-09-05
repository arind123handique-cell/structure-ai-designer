import { describe, it, expect } from 'vitest';
import { buildLoadCombinationsFromModel } from '@/features/windows/combos';
import { LoadCase } from '@/features/model/types';

const loadCases: LoadCase[] = [
  { id: 1, title: 'Dead Load (DL)', type: 'DEAD', isCombination: false },
  { id: 2, title: 'Live Load (LL)', type: 'LIVE', isCombination: false },
  { id: 3, title: 'Seismic Load X (EQX)', type: 'SEISMIC', direction: 'X', isCombination: false },
  { id: 4, title: 'Seismic Load Z (EQZ)', type: 'SEISMIC', direction: 'Z', isCombination: false },
];

describe('buildLoadCombinationsFromModel', () => {
  it('maps IS 456 standard roles onto the model load cases', () => {
    const combos = buildLoadCombinationsFromModel(loadCases);
    expect(combos.length).toBeGreaterThan(0);

    const gravity = combos.find((c) => c.id === 101);
    expect(gravity).toBeDefined();
    expect(gravity!.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ loadCaseId: 1, factor: 1.5 }),
        expect.objectContaining({ loadCaseId: 2, factor: 1.5 }),
      ])
    );

    const seismic = combos.find((c) => c.id === 102);
    expect(seismic!.factors).toEqual(
      expect.arrayContaining([expect.objectContaining({ loadCaseId: 3, factor: 1.2 })])
    );
  });

  it('omits combos that need patterns not present in the model', () => {
    const partial: LoadCase[] = [loadCases[0], loadCases[1]]; // DEAD + LIVE only
    const combos = buildLoadCombinationsFromModel(partial);
    // No seismic/wind combos should survive without EQX/EQZ/WLX/WLZ patterns
    const seismic = combos.some((c) => c.id === 102 || c.id === 106);
    expect(seismic).toBe(false);
    // Gravity combos remain
    expect(combos.some((c) => c.id === 101)).toBe(true);
  });

  it('matches short pattern titles as well as long display titles', () => {
    const short: LoadCase[] = [
      { id: 1, title: 'DEAD', type: 'DEAD', isCombination: false },
      { id: 2, title: 'LIVE', type: 'LIVE', isCombination: false },
    ];
    const combos = buildLoadCombinationsFromModel(short);
    const gravity = combos.find((c) => c.id === 101);
    expect(gravity!.factors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ loadCaseId: 1, factor: 1.5 }),
        expect.objectContaining({ loadCaseId: 2, factor: 1.5 }),
      ])
    );
  });
});