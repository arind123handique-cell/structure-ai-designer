export interface PunchingShearInput {
  colWidth: number; // a in mm (e.g. 450)
  colDepth: number; // b in mm (e.g. 550)
  effectiveDepth: number; // d in mm (e.g. 600)
  fck: number; // N/mm2 (e.g. 25)
  factoredPunchingForce: number; // Vup in kN (Total downward force minus soil/pile reaction within perimeter)
}

export interface PunchingShearResult {
  criticalPerimeter: number; // bo in mm
  criticalArea: number; // mm2
  beta_c: number; // Ratio of short side to long side
  ks: number; // Factor ks = min(0.5 + beta_c, 1.0)
  tau_vp: number; // Actual punching shear stress in N/mm2
  tau_cp: number; // Permissible punching shear stress in N/mm2 (ks * 0.25 * sqrt(fck))
  utilization: number; // tau_vp / tau_cp
  status: 'PASS' | 'FAIL';
  failureReason?: string;
}

export class FoundationPunchingShear {
  /**
   * Calculates two-way punching shear as per IS 456:2000 Cl. 31.6.3.
   * Critical section is located at a distance of d/2 from the periphery of the column/loaded area.
   */
  public static checkPunching(input: PunchingShearInput): PunchingShearResult {
    const { colWidth, colDepth, effectiveDepth, fck, factoredPunchingForce } = input;
    const d = effectiveDepth;

    // Dimensions of critical perimeter at d/2
    const a_crit = colWidth + d;
    const b_crit = colDepth + d;

    // Critical perimeter bo = 2 * (a + d) + 2 * (b + d)
    const bo = 2 * (a_crit + b_crit);

    // Beta_c = short side / long side (Cl. 31.6.3.1)
    const shortSide = Math.min(colWidth, colDepth);
    const longSide = Math.max(colWidth, colDepth);
    const beta_c = parseFloat((shortSide / longSide).toFixed(2));

    // ks = 0.5 + beta_c (not greater than 1.0)
    const ks = Math.min(1.0, parseFloat((0.5 + beta_c).toFixed(2)));

    // Permissible shear stress tau_cp = ks * 0.25 * sqrt(fck) (Cl. 31.6.3.1)
    const tau_cp = parseFloat((ks * 0.25 * Math.sqrt(fck)).toFixed(3));

    // Actual punching shear stress tau_vp = Vup / (bo * d)
    const Vup_N = Math.abs(factoredPunchingForce) * 1e3;
    const tau_vp = parseFloat((Vup_N / (bo * d)).toFixed(3));

    const utilization = parseFloat((tau_vp / tau_cp).toFixed(3));
    const isPass = tau_vp <= tau_cp;

    return {
      criticalPerimeter: bo,
      criticalArea: a_crit * b_crit,
      beta_c,
      ks,
      tau_vp,
      tau_cp,
      utilization,
      status: isPass ? 'PASS' : 'FAIL',
      failureReason: !isPass
        ? `Punching shear stress tau_vp (${tau_vp} N/mm²) exceeds permissible capacity tau_cp (${tau_cp} N/mm²). Increase cap/footing depth.`
        : undefined,
    };
  }
}
