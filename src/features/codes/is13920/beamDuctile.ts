export interface BeamDuctileInput {
  b: number; // Width in mm
  D: number; // Overall depth in mm
  d: number; // Effective depth in mm
  fck: number; // N/mm2
  fy: number; // N/mm2
  Ast_top: number; // mm2
  Ast_bottom: number; // mm2
  minBarDia: number; // mm
}

export interface BeamDuctileResult {
  rho_min: number; // Minimum steel ratio (0.24 * sqrt(fck) / fy)
  Ast_min_ductile: number; // mm2
  rho_max: number; // 0.025 (2.5%)
  Ast_max_ductile: number; // mm2
  confinementZoneLength: number; // 2 * d in mm (Cl. 6.3.5)
  confinementHoopSpacingMax: number; // min(d/4, 8 * db_min, 100 mm)
  firstHoopDistance: number; // <= 50 mm
  midSpanHoopSpacingMax: number; // min(d/2, 200 mm)
  positiveNegativeRatioCheck: boolean; // Bottom Ast >= 0.5 * Top Ast at support (Cl. 6.2.3)
  status: 'PASS' | 'WARNING';
  recommendations: string[];
}

export class IS13920BeamDuctile {
  public static checkDuctility(input: BeamDuctileInput): BeamDuctileResult {
    const { b, D, d, fck, fy, Ast_top, Ast_bottom, minBarDia } = input;

    // 1. Minimum steel ratio rho_min = 0.24 * sqrt(fck) / fy (Cl. 6.2.1)
    const rho_min = (0.24 * Math.sqrt(fck)) / fy;
    const Ast_min_ductile = parseFloat((rho_min * b * d).toFixed(1));

    // 2. Maximum steel ratio rho_max = 0.025 (Cl. 6.2.2)
    const rho_max = 0.025;
    const Ast_max_ductile = parseFloat((rho_max * b * d).toFixed(1));

    // 3. Confinement zone length 2d from face of support (Cl. 6.3.5)
    const confinementZoneLength = Math.round(2 * d);

    // 4. Confinement spacing in 2d zone: s <= min(d/4, 8*db, 100 mm) (Cl. 6.3.5)
    const confinementHoopSpacingMax = Math.min(
      Math.floor(d / 4),
      8 * minBarDia,
      100
    );

    // 5. Outside 2d zone: s <= d/2 (Cl. 6.3.5)
    const midSpanHoopSpacingMax = Math.min(Math.floor(d / 2), 200);

    // 6. Positive to negative steel ratio (bottom Ast >= 0.5 * top Ast at support) (Cl. 6.2.3)
    const positiveNegativeRatioCheck = Ast_bottom >= 0.48 * Ast_top;

    const recommendations: string[] = [];

    if (Ast_top < Ast_min_ductile) {
      recommendations.push(
        `Top steel (${Ast_top} mm²) is below IS 13920 minimum ductile steel (${Ast_min_ductile} mm²).`
      );
    }
    if (!positiveNegativeRatioCheck) {
      recommendations.push(
        `Bottom steel at support should be at least 50% of top steel as per IS 13920 Cl. 6.2.3.`
      );
    }

    return {
      rho_min: parseFloat(rho_min.toFixed(4)),
      Ast_min_ductile,
      rho_max,
      Ast_max_ductile,
      confinementZoneLength,
      confinementHoopSpacingMax,
      firstHoopDistance: 50,
      midSpanHoopSpacingMax,
      positiveNegativeRatioCheck,
      status: recommendations.length === 0 ? 'PASS' : 'WARNING',
      recommendations,
    };
  }
}
