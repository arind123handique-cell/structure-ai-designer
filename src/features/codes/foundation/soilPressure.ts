export interface SoilPressureInput {
  P: number; // Vertical axial load in kN (unfactored for bearing checks)
  Mx: number; // Moment about X-axis in kNm
  My: number; // Moment about Y-axis in kNm
  L: number; // Footing length in m (along X)
  B: number; // Footing width in m (along Y)
  SBC: number; // Safe bearing capacity in kN/m2 (e.g. 200)
  footingDepth?: number; // m (for self-weight)
}

export interface SoilPressureResult {
  totalLoad: number; // kN (P + footing self weight)
  area: number; // m2
  ex: number; // Eccentricity in m (Mx / P)
  ey: number; // Eccentricity in m (My / P)
  q_max: number; // Maximum base pressure in kN/m2
  q_min: number; // Minimum base pressure in kN/m2
  q_avg: number; // Average base pressure in kN/m2
  hasTension: boolean; // True if q_min < 0
  status: 'PASS' | 'WARNING' | 'FAIL';
  failureReason?: string;
}

export class FoundationSoilPressure {
  /**
   * Calculates base pressure distribution under a shallow pad footing.
   * Formula: q = (P_total / A) * (1 +/- 6*ex/L +/- 6*ey/B)
   */
  public static checkPressure(input: SoilPressureInput): SoilPressureResult {
    const { P, Mx, My, L, B, SBC } = input;
    const depth = input.footingDepth || 0.6;

    // Self weight of footing + soil surcharge approx 10% of P
    const selfWeight = L * B * depth * 24; // 24 kN/m3 for concrete
    const P_total = Math.abs(P) + selfWeight;

    const area = L * B;
    const Zx = (B * L * L) / 6; // Section modulus about X
    const Zy = (L * B * B) / 6; // Section modulus about Y

    const ex = P_total > 0 ? Math.abs(Mx) / P_total : 0;
    const ey = P_total > 0 ? Math.abs(My) / P_total : 0;

    const directStress = P_total / area;
    const bendingStressX = Zx > 0 ? Math.abs(Mx) / Zx : 0;
    const bendingStressY = Zy > 0 ? Math.abs(My) / Zy : 0;

    const q_max = parseFloat((directStress + bendingStressX + bendingStressY).toFixed(1));
    const q_min = parseFloat((directStress - bendingStressX - bendingStressY).toFixed(1));
    const q_avg = parseFloat(directStress.toFixed(1));

    const hasTension = q_min < 0;
    let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    let failureReason: string | undefined = undefined;

    if (q_max > SBC) {
      status = 'FAIL';
      failureReason = `Max base pressure (${q_max} kN/m²) exceeds allowable Soil Bearing Capacity (${SBC} kN/m²). Increase footing size.`;
    } else if (hasTension) {
      status = 'WARNING';
      failureReason = `Tension (uplift) detected at footing edge (q_min = ${q_min} kN/m²). Increase footing dimensions to reduce eccentricity.`;
    }

    return {
      totalLoad: parseFloat(P_total.toFixed(1)),
      area: parseFloat(area.toFixed(2)),
      ex: parseFloat(ex.toFixed(3)),
      ey: parseFloat(ey.toFixed(3)),
      q_max,
      q_min,
      q_avg,
      hasTension,
      status,
      failureReason,
    };
  }
}
