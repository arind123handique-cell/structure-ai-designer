export interface ShearDesignInput {
  b: number; // Width in mm
  d: number; // Effective depth in mm
  fck: number; // Concrete characteristic strength in N/mm2
  fy: number; // Stirrup yield strength in N/mm2 (e.g. 500)
  Vu: number; // Factored design shear force in kN
  Ast_prov: number; // Provided tension steel in mm2
  stirrupDiameter?: number; // Default: 8mm
  legs?: number; // Number of vertical legs (default: 2)
}

export interface ShearDesignResult {
  tau_v: number; // Nominal shear stress in N/mm2
  tau_c: number; // Concrete design shear strength in N/mm2 (Table 19)
  tau_c_max: number; // Maximum shear stress in N/mm2 (Table 20)
  Vus_req: number; // Shear force to be resisted by stirrups in kN
  Asv: number; // Stirrup area in mm2 (e.g. 2 * pi * 8^2 / 4 = 100.5 mm2)
  spacing_calc: number; // Calculated spacing in mm
  spacing_prov: number; // Practical rounded spacing in mm (e.g. 100, 125, 150)
  spacing_max: number; // Max allowable spacing in mm
  callout: string; // e.g. "2L-8mm @ 125 mm c/c"
  status: 'PASS' | 'FAIL';
  failureReason?: string;
}

export class IS456Shear {
  /**
   * Returns Table 20 maximum shear stress tau_c_max in N/mm2.
   */
  public static getTauCMax(fck: number): number {
    if (fck < 20) return 2.5;
    if (fck < 25) return 2.8;
    if (fck < 30) return 3.1;
    if (fck < 35) return 3.5;
    if (fck < 40) return 3.7;
    return 4.0;
  }

  /**
   * Evaluates IS 456 Table 19 design shear strength of concrete tau_c (N/mm2).
   * Exact SP:16 and IS 456 Table 19 grid interpolation.
   */
  public static getTauC(fck: number, pt: number): number {
    const ptClamped = Math.max(0.15, Math.min(3.0, pt));

    // Table 19 standard grid: pt values vs concrete grades
    const ptGrid = [0.15, 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];

    // Rows: M20, M25, M30, M35, M40
    const table19Data: Record<number, number[]> = {
      20: [0.28, 0.36, 0.48, 0.56, 0.62, 0.67, 0.72, 0.75, 0.79, 0.81, 0.82, 0.82, 0.82],
      25: [0.29, 0.36, 0.49, 0.57, 0.64, 0.70, 0.74, 0.78, 0.82, 0.85, 0.86, 0.86, 0.86],
      30: [0.29, 0.37, 0.50, 0.59, 0.66, 0.71, 0.76, 0.80, 0.84, 0.87, 0.90, 0.92, 0.92],
      35: [0.29, 0.37, 0.50, 0.59, 0.67, 0.73, 0.77, 0.82, 0.86, 0.90, 0.93, 0.95, 0.95],
      40: [0.30, 0.38, 0.51, 0.60, 0.68, 0.74, 0.79, 0.84, 0.88, 0.92, 0.95, 0.98, 0.98],
    };

    // Find closest fck row
    let gradeKey = 25;
    if (fck <= 20) gradeKey = 20;
    else if (fck <= 25) gradeKey = 25;
    else if (fck <= 30) gradeKey = 30;
    else if (fck <= 35) gradeKey = 35;
    else gradeKey = 40;

    const row = table19Data[gradeKey];

    // Linear interpolation across pt
    for (let i = 0; i < ptGrid.length - 1; i++) {
      if (ptClamped >= ptGrid[i] && ptClamped <= ptGrid[i + 1]) {
        const t = (ptClamped - ptGrid[i]) / (ptGrid[i + 1] - ptGrid[i]);
        return row[i] + t * (row[i + 1] - row[i]);
      }
    }

    return row[row.length - 1];
  }

  /**
   * Master shear design function as per IS 456:2000 Cl. 40 & Cl. 26.5.1.6.
   */
  public static designShear(input: ShearDesignInput): ShearDesignResult {
    const { b, d, fck, fy, Vu, Ast_prov } = input;
    const barDia = input.stirrupDiameter || 8;
    const legs = input.legs || 2;

    const Vu_kN = Math.abs(Vu);
    const Vu_N = Vu_kN * 1e3;

    // 1. Nominal shear stress tau_v
    const tau_v = Vu_N / (b * d);

    // 2. Maximum shear stress tau_c_max (IS 456 Table 20)
    const tau_c_max = this.getTauCMax(fck);

    // If tau_v > tau_c_max, section size MUST be increased (Cl. 40.2.3)
    if (tau_v > tau_c_max) {
      return {
        tau_v: parseFloat(tau_v.toFixed(3)),
        tau_c: 0,
        tau_c_max,
        Vus_req: 0,
        Asv: 0,
        spacing_calc: 0,
        spacing_prov: 0,
        spacing_max: 0,
        callout: 'REDESIGN SECTION (tau_v > tau_c_max)',
        status: 'FAIL',
        failureReason: `Nominal shear stress tau_v (${tau_v.toFixed(2)} N/mm2) exceeds maximum permissible limit tau_c_max (${tau_c_max} N/mm2). Increase beam depth or width.`,
      };
    }

    // 3. Design shear strength tau_c (IS 456 Table 19)
    const pt = (Ast_prov * 100) / (b * d);
    const tau_c = this.getTauC(fck, pt);

    // 4. Shear resisted by concrete Vc = tau_c * b * d
    const Vc_N = tau_c * b * d;

    // 5. Stirrups area Asv
    const Asv = legs * ((Math.PI * barDia * barDia) / 4);

    // 6. Max permissible spacing as per Cl. 26.5.1.5 & 26.5.1.6
    // sv_min_rebar = (0.87 * fy * Asv) / (0.4 * b)
    const sv_min_rebar = (0.87 * fy * Asv) / (0.4 * b);
    const spacing_max = Math.min(0.75 * d, 300, sv_min_rebar);

    let Vus_N = 0;
    let spacing_calc = spacing_max;

    if (Vu_N > Vc_N) {
      // Shear links required to carry excess shear
      Vus_N = Vu_N - Vc_N;
      // Formula: sv = (0.87 * fy * Asv * d) / Vus
      spacing_calc = (0.87 * fy * Asv * d) / Vus_N;
    }

    // Practical spacing rounded down to nearest 25mm interval
    const rawSpacing = Math.min(spacing_calc, spacing_max);
    let spacing_prov = Math.max(75, Math.floor(rawSpacing / 25) * 25);
    if (spacing_prov > 300) spacing_prov = 300;

    const callout = `${legs}L-${barDia}mm @ ${spacing_prov} mm c/c`;

    return {
      tau_v: parseFloat(tau_v.toFixed(3)),
      tau_c: parseFloat(tau_c.toFixed(3)),
      tau_c_max: parseFloat(tau_c_max.toFixed(2)),
      Vus_req: parseFloat((Vus_N / 1e3).toFixed(2)),
      Asv: parseFloat(Asv.toFixed(1)),
      spacing_calc: parseFloat(spacing_calc.toFixed(1)),
      spacing_prov,
      spacing_max: parseFloat(spacing_max.toFixed(1)),
      callout,
      status: 'PASS',
    };
  }
}
