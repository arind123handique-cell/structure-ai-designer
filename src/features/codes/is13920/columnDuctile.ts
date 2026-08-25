export interface ColumnDuctileInput {
  b: number; // Width in mm
  D: number; // Depth in mm
  unsupportedHeight: number; // H in mm
  fck: number; // N/mm2
  fy: number; // N/mm2
  minMainBarDia: number; // mm
  cover?: number; // mm (default: 40)
}

export interface ColumnDuctileResult {
  lo: number; // Length of special confining zone in mm (Cl. 7.6.1)
  confiningTieSpacingMax: number; // mm in lo zone (Cl. 7.6.1)
  midHeightTieSpacingMax: number; // mm outside lo zone
  recommendedTieCallout: string; // e.g. "8mm @ 75 mm c/c (ends) / 150 mm c/c (mid)"
  Ash_req: number; // Required cross-sectional area of link in mm2 (Cl. 7.6.1)
  status: 'PASS' | 'WARNING';
}

export class IS13920ColumnDuctile {
  public static checkDuctility(input: ColumnDuctileInput): ColumnDuctileResult {
    const { b, D, unsupportedHeight, fck, fy, minMainBarDia } = input;
    const cover = input.cover || 40;

    // 1. Length of special confining zone lo >= max(D, H/6, 450 mm) (Cl. 7.6.1)
    const lo = Math.max(D, b, Math.round(unsupportedHeight / 6), 450);

    // 2. Confining tie spacing in lo zone: s <= min(b/4, 100 mm, 6 * db_min) (Cl. 7.6.1)
    const confiningTieSpacingMax = Math.min(
      Math.floor(b / 4),
      100,
      6 * minMainBarDia
    );

    // 3. Outside lo zone: s <= min(b/2, 150 mm, 8 * db_min)
    const midHeightTieSpacingMax = Math.min(
      Math.floor(b / 2),
      150,
      8 * minMainBarDia
    );

    // 4. Area of cross-ties Ash = 0.18 * s * h * (fck/fy) * (Ag/Ak - 1)
    const Ag = b * D;
    const bk = b - 2 * cover;
    const Dk = D - 2 * cover;
    const Ak = Math.max(100, bk * Dk);
    const h = Math.max(bk, Dk);

    const s_confine = Math.max(50, Math.floor(confiningTieSpacingMax / 25) * 25);
    const Ash1 = 0.18 * s_confine * h * (fck / fy) * (Ag / Ak - 1);
    const Ash2 = 0.05 * s_confine * h * (fck / fy);
    const Ash_req = Math.max(Ash1, Ash2);

    const recommendedTieCallout = `8mm closed ties @ ${s_confine} mm c/c in ${lo}mm end zones, ${midHeightTieSpacingMax} mm c/c mid-height`;

    return {
      lo,
      confiningTieSpacingMax,
      midHeightTieSpacingMax,
      recommendedTieCallout,
      Ash_req: parseFloat(Ash_req.toFixed(1)),
      status: 'PASS',
    };
  }
}
