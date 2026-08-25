import { IS456Shear } from '../is456/shear';

export interface OneWayShearInput {
  shearForce: number; // Vu in kN at critical section (d from column face)
  width: number; // B in mm
  effectiveDepth: number; // d in mm
  fck: number; // N/mm2
  pt_prov?: number; // Provided percentage of tension steel (default: 0.25%)
}

export interface OneWayShearResult {
  Vu: number; // kN
  tau_v: number; // N/mm2
  tau_c: number; // N/mm2 (Table 19)
  tau_c_max: number; // N/mm2 (Table 20)
  status: 'PASS' | 'FAIL';
  failureReason?: string;
}

export class FoundationOneWayShear {
  /**
   * Checks one-way shear across critical section at distance d from face of column.
   */
  public static checkOneWayShear(input: OneWayShearInput): OneWayShearResult {
    const { shearForce, width, effectiveDepth, fck } = input;
    const pt = input.pt_prov || 0.25;

    const Vu_N = Math.abs(shearForce) * 1e3;
    const tau_v = parseFloat((Vu_N / (width * effectiveDepth)).toFixed(3));
    const tau_c = parseFloat(IS456Shear.getTauC(fck, pt).toFixed(3));
    const tau_c_max = IS456Shear.getTauCMax(fck);

    const isPass = tau_v <= tau_c;

    return {
      Vu: parseFloat(shearForce.toFixed(1)),
      tau_v,
      tau_c,
      tau_c_max,
      status: isPass ? 'PASS' : 'FAIL',
      failureReason: !isPass
        ? `One-way shear stress (${tau_v} N/mm²) exceeds concrete shear capacity tau_c (${tau_c} N/mm²). Increase depth.`
        : undefined,
    };
  }
}
