export interface StandardLoadCombination {
  id: number;
  name: string;
  type: 'STRENGTH' | 'SERVICEABILITY';
  equation: string;
  factors: {
    dl: number;
    ll: number;
    eqx?: number;
    eqz?: number;
    wlx?: number;
    wlz?: number;
  };
  isGoverningFor?: string[]; // e.g. ['Max Axial Compression', 'Overturning Uplift']
  codeReference: string;
}

export class IS456LoadCombinations {
  /**
   * Returns standard Indian Standard (IS 456 Table 18 & IS 1893:2016 Cl. 6.3.2)
   * design load combinations for 3D multi-storey structures.
   */
  public static getStandardCombinations(): StandardLoadCombination[] {
    return [
      // 1. Gravity Ultimate
      {
        id: 101,
        name: '1.5(DL + LL)',
        type: 'STRENGTH',
        equation: '1.5 DL + 1.5 LL',
        factors: { dl: 1.5, ll: 1.5 },
        isGoverningFor: ['Max Gravity Floor Beams', 'Interior Column Compression'],
        codeReference: 'IS 456:2000 Table 18',
      },

      // 2. Seismic + Gravity Ultimate (1.2 Factor)
      {
        id: 102,
        name: '1.2(DL + LL + EQX)',
        type: 'STRENGTH',
        equation: '1.2 DL + 1.2 LL + 1.2 EQX',
        factors: { dl: 1.2, ll: 1.2, eqx: 1.2 },
        isGoverningFor: ['Beam-Column Joint Shear', 'Lateral Biaxial Moments'],
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },
      {
        id: 103,
        name: '1.2(DL + LL - EQX)',
        type: 'STRENGTH',
        equation: '1.2 DL + 1.2 LL - 1.2 EQX',
        factors: { dl: 1.2, ll: 1.2, eqx: -1.2 },
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },
      {
        id: 104,
        name: '1.2(DL + LL + EQZ)',
        type: 'STRENGTH',
        equation: '1.2 DL + 1.2 LL + 1.2 EQZ',
        factors: { dl: 1.2, ll: 1.2, eqz: 1.2 },
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },
      {
        id: 105,
        name: '1.2(DL + LL - EQZ)',
        type: 'STRENGTH',
        equation: '1.2 DL + 1.2 LL - 1.2 EQZ',
        factors: { dl: 1.2, ll: 1.2, eqz: -1.2 },
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },

      // 3. Seismic Ultimate Without Live Load (1.5 Factor)
      {
        id: 106,
        name: '1.5(DL + EQX)',
        type: 'STRENGTH',
        equation: '1.5 DL + 1.5 EQX',
        factors: { dl: 1.5, ll: 0, eqx: 1.5 },
        isGoverningFor: ['Exterior Column Moments', 'Shear Wall Boundary Elements'],
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },
      {
        id: 107,
        name: '1.5(DL - EQX)',
        type: 'STRENGTH',
        equation: '1.5 DL - 1.5 EQX',
        factors: { dl: 1.5, ll: 0, eqx: -1.5 },
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },
      {
        id: 108,
        name: '1.5(DL + EQZ)',
        type: 'STRENGTH',
        equation: '1.5 DL + 1.5 EQZ',
        factors: { dl: 1.5, ll: 0, eqz: 1.5 },
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },
      {
        id: 109,
        name: '1.5(DL - EQZ)',
        type: 'STRENGTH',
        equation: '1.5 DL - 1.5 EQZ',
        factors: { dl: 1.5, ll: 0, eqz: -1.5 },
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },

      // 4. Overturning / Tension / Uplift (0.9 DL + 1.5 EQ)
      {
        id: 110,
        name: '0.9DL + 1.5EQX',
        type: 'STRENGTH',
        equation: '0.9 DL + 1.5 EQX',
        factors: { dl: 0.9, ll: 0, eqx: 1.5 },
        isGoverningFor: ['Foundation Uplift / Tension', 'Corner Column Net Tension'],
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },
      {
        id: 111,
        name: '0.9DL - 1.5EQX',
        type: 'STRENGTH',
        equation: '0.9 DL - 1.5 EQX',
        factors: { dl: 0.9, ll: 0, eqx: -1.5 },
        isGoverningFor: ['Foundation Uplift / Tension'],
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },
      {
        id: 112,
        name: '0.9DL + 1.5EQZ',
        type: 'STRENGTH',
        equation: '0.9 DL + 1.5 EQZ',
        factors: { dl: 0.9, ll: 0, eqz: 1.5 },
        isGoverningFor: ['Foundation Uplift / Tension'],
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },
      {
        id: 113,
        name: '0.9DL - 1.5EQZ',
        type: 'STRENGTH',
        equation: '0.9 DL - 1.5 EQZ',
        factors: { dl: 0.9, ll: 0, eqz: -1.5 },
        isGoverningFor: ['Foundation Uplift / Tension'],
        codeReference: 'IS 1893:2016 Cl. 6.3.2.1',
      },

      // 5. Wind Load Ultimate Combinations (IS 875 Part 5)
      {
        id: 114,
        name: '1.2(DL + LL + WLX)',
        type: 'STRENGTH',
        equation: '1.2 DL + 1.2 LL + 1.2 WLX',
        factors: { dl: 1.2, ll: 1.2, wlx: 1.2 },
        codeReference: 'IS 875 (Part 5):1987',
      },
      {
        id: 115,
        name: '1.5(DL + WLX)',
        type: 'STRENGTH',
        equation: '1.5 DL + 1.5 WLX',
        factors: { dl: 1.5, ll: 0, wlx: 1.5 },
        codeReference: 'IS 875 (Part 5):1987',
      },
      {
        id: 116,
        name: '0.9DL + 1.5WLX',
        type: 'STRENGTH',
        equation: '0.9 DL + 1.5 WLX',
        factors: { dl: 0.9, ll: 0, wlx: 1.5 },
        isGoverningFor: ['Wind Uplift on Light Roofs'],
        codeReference: 'IS 875 (Part 5):1987',
      },

      // 6. Serviceability Combinations (IS 456 Table 18)
      {
        id: 201,
        name: '1.0(DL + LL) [SLS]',
        type: 'SERVICEABILITY',
        equation: '1.0 DL + 1.0 LL',
        factors: { dl: 1.0, ll: 1.0 },
        isGoverningFor: ['Floor Deflection Checks', 'Soil Bearing Pressure'],
        codeReference: 'IS 456:2000 Table 18',
      },
      {
        id: 202,
        name: '1.0DL + 0.8LL + 0.8EQX [SLS]',
        type: 'SERVICEABILITY',
        equation: '1.0 DL + 0.8 LL + 0.8 EQX',
        factors: { dl: 1.0, ll: 0.8, eqx: 0.8 },
        isGoverningFor: ['Story Drift Limit (0.004h)'],
        codeReference: 'IS 1893:2016 Cl. 7.11.1',
      },
      {
        id: 203,
        name: '1.0DL + 1.0EQX [SLS]',
        type: 'SERVICEABILITY',
        equation: '1.0 DL + 1.0 EQX',
        factors: { dl: 1.0, ll: 0, eqx: 1.0 },
        isGoverningFor: ['Lateral Deflection'],
        codeReference: 'IS 1893:2016 Cl. 7.11.1',
      },
    ];
  }
}
