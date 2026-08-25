import { ConcreteGrade, SteelGrade } from '@/types';

export interface FlexureDesignInput {
  b: number; // Width in mm
  D: number; // Overall depth in mm
  d: number; // Effective depth in mm
  d_prime?: number; // Cover to compression steel center in mm (default: 40mm)
  fck: number; // Concrete characteristic strength in N/mm2 (e.g. 25)
  fy: number; // Steel yield strength in N/mm2 (e.g. 500)
  Mu: number; // Factored design bending moment in kNm
}

export interface FlexureDesignResult {
  isDoublyReinforced: boolean;
  xu_max_by_d: number;
  xu_max: number; // mm
  Mu_lim: number; // kNm
  Ast_req: number; // mm2
  Asc_req: number; // mm2 (0 for singly reinforced)
  pt_req: number; // Percentage steel
  Ast_min: number; // mm2 (IS 456 Cl. 26.5.1.1)
  Ast_max: number; // mm2 (IS 456 Cl. 26.5.1.2)
  fsc?: number; // Stress in compression steel in N/mm2
  status: 'PASS' | 'FAIL';
  failureReason?: string;
}

export class IS456Flexure {
  /**
   * Returns limiting neutral axis depth ratio (xu,max / d) as per IS 456:2000 Cl. 38.1 Note.
   */
  public static getXuMaxByD(fy: number): number {
    if (fy <= 250) return 0.53;
    if (fy <= 415) return 0.48;
    if (fy <= 500) return 0.46;
    if (fy <= 550) return 0.44;
    return 0.44;
  }

  /**
   * Calculates limiting moment of resistance Mu,lim (kNm) for a singly reinforced rectangular section.
   * Formula: Mu,lim = 0.36 * fck * b * xu_max * (d - 0.42 * xu_max)
   */
  public static calculateMuLim(b: number, d: number, fck: number, fy: number): number {
    const xu_max_by_d = this.getXuMaxByD(fy);
    const xu_max = xu_max_by_d * d;
    const Mu_lim_Nmm = 0.36 * fck * b * xu_max * (d - 0.42 * xu_max);
    return Mu_lim_Nmm / 1e6; // Convert to kNm
  }

  /**
   * Calculates stress in compression steel fsc (N/mm2) as per IS 456:2000 SP:16 Table F.
   */
  public static calculateFsc(fy: number, d_prime: number, d: number): number {
    const ratio = d_prime / d;
    if (fy <= 250) {
      return 0.87 * 250; // 217.5 N/mm2
    }
    if (fy <= 415) {
      // SP 16 Table F for Fe415
      if (ratio <= 0.05) return 355;
      if (ratio <= 0.10) return 353;
      if (ratio <= 0.15) return 342;
      return 329;
    }
    // Fe 500 / Fe 500D
    if (ratio <= 0.05) return 424;
    if (ratio <= 0.10) return 412;
    if (ratio <= 0.15) return 395;
    return 370;
  }

  /**
   * Designs flexural tension and compression reinforcement as per IS 456:2000 Limit State Method.
   */
  public static designFlexure(input: FlexureDesignInput): FlexureDesignResult {
    const { b, D, d, fck, fy, Mu } = input;
    const d_prime = input.d_prime || 40;

    const xu_max_by_d = this.getXuMaxByD(fy);
    const xu_max = xu_max_by_d * d;
    const Mu_lim = this.calculateMuLim(b, d, fck, fy);

    // Minimum & Maximum steel limits as per Cl. 26.5.1.1 & 26.5.1.2
    const Ast_min = (0.85 * b * d) / fy;
    const Ast_max = 0.04 * b * D; // 4% of gross area

    const Mu_abs = Math.abs(Mu);

    // Case 1: Singly Reinforced Section (Mu <= Mu_lim)
    if (Mu_abs <= Mu_lim) {
      const Mu_Nmm = Mu_abs * 1e6;
      // Formula: Ast = (0.5 * fck / fy) * [1 - sqrt(1 - (4.6 * Mu) / (fck * b * d^2))] * b * d
      const term = 1 - (4.6 * Mu_Nmm) / (fck * b * d * d);
      const sqrtTerm = Math.sqrt(Math.max(0, term));
      const Ast_calc = ((0.5 * fck) / fy) * (1 - sqrtTerm) * b * d;
      const Ast_req = Math.max(Ast_calc, Ast_min);

      return {
        isDoublyReinforced: false,
        xu_max_by_d,
        xu_max,
        Mu_lim: parseFloat(Mu_lim.toFixed(2)),
        Ast_req: parseFloat(Ast_req.toFixed(1)),
        Asc_req: 0,
        pt_req: parseFloat(((Ast_req * 100) / (b * d)).toFixed(2)),
        Ast_min: parseFloat(Ast_min.toFixed(1)),
        Ast_max: parseFloat(Ast_max.toFixed(1)),
        status: Ast_req <= Ast_max ? 'PASS' : 'FAIL',
        failureReason: Ast_req > Ast_max ? 'Required tension steel exceeds maximum limit of 0.04*b*D' : undefined,
      };
    }

    // Case 2: Doubly Reinforced Section (Mu > Mu_lim)
    const Mu2 = Mu_abs - Mu_lim; // Excess moment to be resisted by compression steel
    const Mu2_Nmm = Mu2 * 1e6;
    const fsc = this.calculateFsc(fy, d_prime, d);
    const fcc = 0.446 * fck; // concrete stress at level of compression steel

    // Asc = Mu2 / [(fsc - fcc) * (d - d')]
    const Asc_req = Mu2_Nmm / ((fsc - fcc) * (d - d_prime));

    // Ast1 (for Mu_lim) + Ast2 (for Mu2)
    const Ast1 = ((0.5 * fck) / fy) * (1 - Math.sqrt(Math.max(0, 1 - (4.6 * Mu_lim * 1e6) / (fck * b * d * d)))) * b * d;
    const Ast2 = (Asc_req * (fsc - fcc)) / (0.87 * fy);
    const Ast_total = Math.max(Ast1 + Ast2, Ast_min);

    const totalSteel = Ast_total + Asc_req;
    const isPass = Ast_total <= Ast_max && totalSteel <= 0.06 * b * D;

    return {
      isDoublyReinforced: true,
      xu_max_by_d,
      xu_max,
      Mu_lim: parseFloat(Mu_lim.toFixed(2)),
      Ast_req: parseFloat(Ast_total.toFixed(1)),
      Asc_req: parseFloat(Asc_req.toFixed(1)),
      pt_req: parseFloat(((Ast_total * 100) / (b * d)).toFixed(2)),
      Ast_min: parseFloat(Ast_min.toFixed(1)),
      Ast_max: parseFloat(Ast_max.toFixed(1)),
      fsc,
      status: isPass ? 'PASS' : 'FAIL',
      failureReason: !isPass ? 'Steel area exceeds maximum limit for doubly reinforced beam' : undefined,
    };
  }
}
