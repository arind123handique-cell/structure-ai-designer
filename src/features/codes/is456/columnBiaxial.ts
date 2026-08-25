import { IS456ColumnAxial } from './columnAxial';

export interface ColumnBiaxialInput {
  b: number; // Width in mm
  D: number; // Depth in mm
  fck: number; // N/mm2
  fy: number; // N/mm2
  Pu: number; // Factored axial load in kN
  Mux: number; // Factored moment about X-axis in kNm
  Muy: number; // Factored moment about Y-axis in kNm
  pt: number; // Longitudinal reinforcement percentage (e.g. 1.5%)
  d_prime?: number; // Cover to center of bars in mm (default: 50mm)
}

export interface PMCurvePoint {
  Pu_kN: number;
  Mu_kNm: number;
  xu_by_D: number;
}

export interface ColumnBiaxialResult {
  Mux1: number; // Uniaxial moment capacity about X-axis in kNm
  Muy1: number; // Uniaxial moment capacity about Y-axis in kNm
  Puz: number; // Pure axial capacity in kN
  alpha_n: number; // Bresler exponent
  interactionRatio: number; // (Mux/Mux1)^alpha_n + (Muy/Muy1)^alpha_n
  status: 'PASS' | 'WARNING' | 'FAIL';
  pmPointsX: PMCurvePoint[];
  pmPointsY: PMCurvePoint[];
  failureReason?: string;
}

export class IS456ColumnBiaxial {
  /**
   * Generates P-M interaction curve points for a rectangular section as per IS 456 / SP:16 principles.
   */
  public static generatePMCurve(
    b: number,
    D: number,
    fck: number,
    fy: number,
    pt: number,
    d_prime: number = 50
  ): PMCurvePoint[] {
    const Ag = b * D;
    const Asc = (pt / 100) * Ag;
    const Ac = Ag - Asc;
    const d = D - d_prime;

    // Pure axial compression point (xu -> infinity)
    const Puz = (0.45 * fck * Ac + 0.75 * fy * Asc) / 1e3;
    const points: PMCurvePoint[] = [{ Pu_kN: parseFloat(Puz.toFixed(1)), Mu_kNm: 0, xu_by_D: 999 }];

    // Discrete points from high compression (xu/D = 1.2) to pure bending (xu/D = 0.2) and tension
    const xuRatios = [1.4, 1.2, 1.0, 0.8, 0.6, 0.45, 0.35, 0.25, 0.15];

    for (const xu_by_D of xuRatios) {
      const xu = xu_by_D * D;

      // Concrete stress block compressive force: C_c = 0.36 * fck * b * min(xu, D)
      const effectiveXu = Math.min(xu, D);
      const Cc = 0.36 * fck * b * effectiveXu;
      const yc = 0.42 * effectiveXu; // Distance from top fiber to Cc

      // Moment of concrete about center of section
      const Mc = Cc * (D / 2 - yc);

      // Steel contribution (equal reinforcement top and bottom faces Ast/2 and Asc/2)
      const As1 = Asc / 2; // tension/bottom face
      const As2 = Asc / 2; // compression/top face

      // Strain in steel at top and bottom fibers
      // Top steel strain: eps_sc = 0.0035 * (xu - d_prime) / xu
      const eps_sc = (0.0035 * (xu - d_prime)) / xu;
      const fsc = Math.min(0.87 * fy, Math.max(-0.87 * fy, eps_sc * 200000));

      // Bottom steel strain: eps_st = 0.0035 * (d - xu) / xu
      const eps_st = (0.0035 * (d - xu)) / xu;
      const fst = Math.min(0.87 * fy, Math.max(-0.87 * fy, eps_st * 200000));

      const Fs_comp = As2 * (fsc - 0.446 * fck);
      const Fs_tens = As1 * fst;

      const Pu_total = (Cc + Fs_comp - Fs_tens) / 1e3; // kN
      const Mu_total = (Mc + Fs_comp * (D / 2 - d_prime) + Fs_tens * (d - D / 2)) / 1e6; // kNm

      if (Pu_total >= 0 && Mu_total >= 0) {
        points.push({
          Pu_kN: parseFloat(Pu_total.toFixed(1)),
          Mu_kNm: parseFloat(Mu_total.toFixed(1)),
          xu_by_D,
        });
      }
    }

    // Pure bending point (Pu = 0)
    const Mu_pure = (0.87 * fy * (Asc / 2) * (d - d_prime)) / 1e6;
    points.push({ Pu_kN: 0, Mu_kNm: parseFloat(Mu_pure.toFixed(1)), xu_by_D: 0.1 });

    return points.sort((a, b) => b.Pu_kN - a.Pu_kN);
  }

  /**
   * Interpolates uniaxial moment capacity Mu1 at given axial load Pu from P-M curve.
   */
  public static interpolateCapacity(pmCurve: PMCurvePoint[], Pu: number): number {
    const Pu_abs = Math.abs(Pu);

    if (Pu_abs >= pmCurve[0].Pu_kN) {
      return 0.1; // Beyond axial capacity
    }

    if (Pu_abs <= 0) {
      return pmCurve[pmCurve.length - 1].Mu_kNm;
    }

    for (let i = 0; i < pmCurve.length - 1; i++) {
      const p1 = pmCurve[i];
      const p2 = pmCurve[i + 1];

      if (Pu_abs <= p1.Pu_kN && Pu_abs >= p2.Pu_kN) {
        const t = (p1.Pu_kN - Pu_abs) / (p1.Pu_kN - p2.Pu_kN);
        const Mu = p1.Mu_kNm + t * (p2.Mu_kNm - p1.Mu_kNm);
        return Math.max(1.0, parseFloat(Mu.toFixed(1)));
      }
    }

    return pmCurve[pmCurve.length - 1].Mu_kNm;
  }

  /**
   * Checks biaxial bending interaction using Bresler formula (IS 456:2000 Cl. 39.6).
   */
  public static checkBiaxial(input: ColumnBiaxialInput): ColumnBiaxialResult {
    const { b, D, fck, fy, Pu, Mux, Muy, pt } = input;
    const d_prime = input.d_prime || 50;

    const Ag = b * D;
    const Asc = (pt / 100) * Ag;
    const Ac = Ag - Asc;

    // Pure axial capacity Puz
    const Puz = parseFloat(((0.45 * fck * Ac + 0.75 * fy * Asc) / 1e3).toFixed(2));
    const alpha_n = IS456ColumnAxial.calculateAlphaN(Pu, Puz);

    // Generate P-M interaction curves about X (major, depth D) and Y (minor, depth b)
    const pmPointsX = this.generatePMCurve(b, D, fck, fy, pt, d_prime);
    const pmPointsY = this.generatePMCurve(D, b, fck, fy, pt, d_prime);

    // Uniaxial capacities Mux1 and Muy1 at design axial load Pu
    const Mux1 = this.interpolateCapacity(pmPointsX, Pu);
    const Muy1 = this.interpolateCapacity(pmPointsY, Pu);

    // Bresler interaction ratio IR = (Mux / Mux1)^alpha_n + (Muy / Muy1)^alpha_n
    const termX = Math.pow(Math.abs(Mux) / Mux1, alpha_n);
    const termY = Math.pow(Math.abs(Muy) / Muy1, alpha_n);
    const interactionRatio = parseFloat((termX + termY).toFixed(3));

    let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    let failureReason: string | undefined = undefined;

    if (interactionRatio > 1.0) {
      status = 'FAIL';
      failureReason = `Biaxial interaction ratio (${interactionRatio}) exceeds 1.0 limit as per IS 456 Cl. 39.6.`;
    } else if (interactionRatio >= 0.9) {
      status = 'WARNING';
    }

    return {
      Mux1,
      Muy1,
      Puz,
      alpha_n,
      interactionRatio,
      status,
      pmPointsX,
      pmPointsY,
      failureReason,
    };
  }
}
