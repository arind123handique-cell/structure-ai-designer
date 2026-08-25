export interface ColumnAxialInput {
  b: number; // Width in mm
  D: number; // Depth in mm
  unsupportedLength: number; // L in mm
  effectiveLengthFactor?: number; // k (default: 1.0 for braced/sway frame)
  fck: number; // N/mm2
  fy: number; // N/mm2
  Pu: number; // Factored axial load in kN
  Asc_prov?: number; // Provided steel area in mm2 (if known)
  pt?: number; // Percentage steel (default: 1.5%)
}

export interface ColumnAxialResult {
  emin_x: number; // mm
  emin_y: number; // mm
  isShortColumn: boolean;
  slenderness_x: number; // Lex / D
  slenderness_y: number; // Ley / b
  Puz: number; // Pure axial capacity in kN (Cl. 39.6)
  Pu_cap_short: number; // Short column capacity under min eccentricity in kN (Cl. 39.3)
  alpha_n: number; // Bresler exponent for biaxial interaction
  Asc_min: number; // mm2 (0.8% of Ag)
  Asc_max: number; // mm2 (4.0% of Ag)
  status: 'PASS' | 'FAIL';
  failureReason?: string;
}

export class IS456ColumnAxial {
  /**
   * Calculates minimum eccentricity emin as per IS 456:2000 Cl. 25.4.
   * emin = max(L / 500 + D / 30, 20 mm)
   */
  public static calculateEmin(unsupportedLength: number, dimension: number): number {
    const calc = unsupportedLength / 500 + dimension / 30;
    return Math.max(20, parseFloat(calc.toFixed(1)));
  }

  /**
   * Calculates Bresler interaction exponent alpha_n as per IS 456:2000 Cl. 39.6.
   * Linear between 1.0 at Pu/Puz = 0.2 and 2.0 at Pu/Puz = 0.8.
   */
  public static calculateAlphaN(Pu: number, Puz: number): number {
    if (Puz <= 0) return 1.0;
    const ratio = Math.abs(Pu) / Puz;
    if (ratio <= 0.2) return 1.0;
    if (ratio >= 0.8) return 2.0;
    const alpha = 1.0 + ((ratio - 0.2) / 0.6) * 1.0;
    return parseFloat(alpha.toFixed(3));
  }

  /**
   * Calculates axial capacity and minimum eccentricity checks.
   */
  public static checkAxial(input: ColumnAxialInput): ColumnAxialResult {
    const { b, D, unsupportedLength, fck, fy, Pu } = input;
    const k = input.effectiveLengthFactor || 1.0;
    const Ag = b * D;

    const emin_x = this.calculateEmin(unsupportedLength, D);
    const emin_y = this.calculateEmin(unsupportedLength, b);

    // Slenderness checks: Le / D <= 12 for short column (Cl. 25.1.2)
    const Lex = k * unsupportedLength;
    const Ley = k * unsupportedLength;
    const slenderness_x = parseFloat((Lex / D).toFixed(1));
    const slenderness_y = parseFloat((Ley / b).toFixed(1));
    const isShortColumn = slenderness_x < 12 && slenderness_y < 12;

    // Minimum and maximum longitudinal steel as per Cl. 26.5.3.1
    const Asc_min = 0.008 * Ag; // 0.8%
    const Asc_max = 0.040 * Ag; // 4.0%

    let Asc = input.Asc_prov;
    if (!Asc) {
      const pt = input.pt || 1.5;
      Asc = (pt / 100) * Ag;
    }
    Asc = Math.max(Asc_min, Math.min(Asc_max, Asc));

    const Ac = Ag - Asc;

    // 1. Pure axial capacity Puz = 0.45 * fck * Ac + 0.75 * fy * Asc (Cl. 39.6)
    const Puz_N = 0.45 * fck * Ac + 0.75 * fy * Asc;
    const Puz = parseFloat((Puz_N / 1e3).toFixed(2));

    // 2. Short column capacity with min eccentricity = 0.4 * fck * Ac + 0.67 * fy * Asc (Cl. 39.3)
    const Pu_cap_N = 0.4 * fck * Ac + 0.67 * fy * Asc;
    const Pu_cap_short = parseFloat((Pu_cap_N / 1e3).toFixed(2));

    const alpha_n = this.calculateAlphaN(Pu, Puz);

    const isPass = Math.abs(Pu) <= Puz;

    return {
      emin_x,
      emin_y,
      isShortColumn,
      slenderness_x,
      slenderness_y,
      Puz,
      Pu_cap_short,
      alpha_n,
      Asc_min: parseFloat(Asc_min.toFixed(1)),
      Asc_max: parseFloat(Asc_max.toFixed(1)),
      status: isPass ? 'PASS' : 'FAIL',
      failureReason: !isPass ? `Design axial load Pu (${Pu.toFixed(1)} kN) exceeds pure axial capacity Puz (${Puz} kN).` : undefined,
    };
  }
}
