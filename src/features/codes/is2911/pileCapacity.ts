export interface PileCapacityInput {
  diameter: number; // Pile diameter in mm (e.g. 500)
  length: number; // Pile length in m (e.g. 12.0)
  fck: number; // Concrete grade N/mm2 (e.g. 25)
  fy: number; // Steel grade N/mm2 (e.g. 500)
  soilType?: 'COHESIVE_CLAY' | 'COHESIONLESS_SAND' | 'MIXED_STRATA';
  cu?: number; // Undrained cohesion in kN/m2 (default: 55 for medium clay)
  alpha?: number; // Adhesion factor (default: 0.6)
  phi?: number; // Angle of internal friction in degrees (default: 30 for sand)
  Nq?: number; // Bearing capacity factor (default: 30)
  soilDensity?: number; // Effective soil unit weight in kN/m3 (default: 18)
  FOS?: number; // Factor of safety (default: 2.5)
  manualSafeCapacity?: number; // Optional user-specified safe capacity in kN
  customBarCount?: number; // e.g. 6, 8, 10
  customBarDiameter?: number; // e.g. 16, 20, 25 mm
  customSpiralDiameter?: number; // e.g. 8, 10 mm
  customSpiralPitch?: number; // e.g. 100, 150 mm
}

export interface PileCapacityResult {
  diameter: number; // mm
  length: number; // m
  crossSectionArea: number; // m2
  perimeter: number; // m
  structuralCapacity: number; // Pc in kN
  geotechnicalUltimate: number; // Qu in kN
  skinFrictionUltimate: number; // Qs in kN
  endBearingUltimate: number; // Qb in kN
  safeWorkingLoad: number; // Qsafe in kN (Qu / FOS or manual)
  governingCapacity: number; // min(Pc, Qsafe) in kN
  minLongitudinalSteel: number; // mm2 (0.4% of Ag)
  providedLongitudinalSteel: number; // mm2
  steelPercentage: number; // pt %
  isSteelCompliant: boolean;
  recommendedRebarCallout: string; // e.g. "6-T16"
  recommendedSpiralCallout: string; // e.g. "8mm helical spiral @ 150 mm pitch"
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export class IS2911PileCapacity {
  /**
   * Calculates structural and geotechnical pile capacity as per IS 2911:2010 (Part 1/Sec 2),
   * supporting both automated empirical calculations and manual capacity overrides.
   */
  public static calculateCapacity(input: PileCapacityInput): PileCapacityResult {
    const { diameter, length, fck, fy } = input;
    const soilType = input.soilType || 'COHESIVE_CLAY';
    const cu = input.cu || 55; // kN/m2
    const alpha = input.alpha || 0.6; // adhesion factor
    const phi = input.phi || 30;
    const Nq = input.Nq || 30;
    const gamma = input.soilDensity || 18; // kN/m3
    const FOS = input.FOS || 2.5;

    const D_m = diameter / 1000;
    const Ag_m2 = (Math.PI * D_m * D_m) / 4;
    const perimeter_m = Math.PI * D_m;
    const Ag_mm2 = Ag_m2 * 1e6;

    // Minimum longitudinal steel (IS 2911 Cl. 6.11.1: 0.4% of gross concrete area)
    const minAsc = 0.004 * Ag_mm2;

    // Determine provided longitudinal reinforcement
    let barCount = input.customBarCount || (diameter >= 600 ? 8 : 6);
    let barDia = input.customBarDiameter || 16;
    let providedAsc = barCount * ((Math.PI * barDia * barDia) / 4);

    // If auto-design and provided is less than min, upgrade diameter to 20mm
    if (!input.customBarCount && !input.customBarDiameter && providedAsc < minAsc) {
      barDia = 20;
      providedAsc = barCount * ((Math.PI * barDia * barDia) / 4);
    }

    const steelPercentage = parseFloat(((providedAsc * 100) / Ag_mm2).toFixed(2));
    const isSteelCompliant = providedAsc >= minAsc;

    // 1. Structural compression capacity: Pc = 0.4 * fck * Ac + 0.67 * fy * Asc (IS 456 Cl. 39.3 / IS 2911 Cl. 6.11.1)
    const Ac_mm2 = Ag_mm2 - providedAsc;
    const Pc_N = 0.4 * fck * Ac_mm2 + 0.67 * fy * providedAsc;
    const structuralCapacity = parseFloat((Pc_N / 1e3).toFixed(1));

    // 2. Geotechnical Capacity: Qu = Qs + Qb
    let Qs_kN = 0;
    let Qb_kN = 0;

    if (soilType === 'COHESIVE_CLAY') {
      // Cohesive soil: Qs = alpha * cu * As, Qb = 9 * cu * Ab (IS 2911 Appendix B)
      const surfaceArea_m2 = perimeter_m * length;
      Qs_kN = alpha * cu * surfaceArea_m2;
      Qb_kN = 9 * cu * Ag_m2;
    } else {
      // Cohesionless sand: Qs = K * sigma_v_avg * tan(delta) * As, Qb = sigma_v_tip * Nq * Ab
      const K = 1.0;
      const delta = 0.75 * phi * (Math.PI / 180);
      const criticalDepth = Math.min(length, 15 * D_m);
      const sigma_v_avg = 0.5 * gamma * criticalDepth;
      const sigma_v_tip = gamma * criticalDepth;

      Qs_kN = K * sigma_v_avg * Math.tan(delta) * (perimeter_m * length);
      Qb_kN = sigma_v_tip * Nq * Ag_m2;
    }

    const geotechnicalUltimate = parseFloat((Qs_kN + Qb_kN).toFixed(1));
    const calculatedSafeLoad = parseFloat((geotechnicalUltimate / FOS).toFixed(1));

    // Use manual capacity override if specified by the user
    const safeWorkingLoad = input.manualSafeCapacity
      ? parseFloat(input.manualSafeCapacity.toFixed(1))
      : calculatedSafeLoad;

    const governingCapacity = Math.min(structuralCapacity, safeWorkingLoad);

    const recommendedRebarCallout = `${barCount}-T${barDia} (${parseFloat(providedAsc.toFixed(1))} mm², pt = ${steelPercentage}%)`;
    const spiralDia = input.customSpiralDiameter || 8;
    const spiralPitch = input.customSpiralPitch || Math.min(150, Math.floor(diameter / 3));
    const recommendedSpiralCallout = `${spiralDia}mm helical spiral @ ${spiralPitch} mm pitch (100 mm pitch at top 3m)`;

    const status: 'PASS' | 'WARNING' | 'FAIL' = isSteelCompliant ? 'PASS' : 'WARNING';

    return {
      diameter,
      length,
      crossSectionArea: parseFloat(Ag_m2.toFixed(3)),
      perimeter: parseFloat(perimeter_m.toFixed(3)),
      structuralCapacity,
      geotechnicalUltimate,
      skinFrictionUltimate: parseFloat(Qs_kN.toFixed(1)),
      endBearingUltimate: parseFloat(Qb_kN.toFixed(1)),
      safeWorkingLoad,
      governingCapacity: parseFloat(governingCapacity.toFixed(1)),
      minLongitudinalSteel: parseFloat(minAsc.toFixed(1)),
      providedLongitudinalSteel: parseFloat(providedAsc.toFixed(1)),
      steelPercentage,
      isSteelCompliant,
      recommendedRebarCallout,
      recommendedSpiralCallout,
      status,
    };
  }
}
