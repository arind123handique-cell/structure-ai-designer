export class IS456DevelopmentLength {
  /**
   * Returns design bond stress tau_bd in N/mm2 as per IS 456:2000 Cl. 26.2.1.1.
   * Values for plain bars in tension:
   * M20: 1.2, M25: 1.4, M30: 1.5, M35: 1.7, M40+: 1.9
   */
  public static getTauBd(fck: number): number {
    if (fck < 25) return 1.2;
    if (fck < 30) return 1.4;
    if (fck < 35) return 1.5;
    if (fck < 40) return 1.7;
    return 1.9;
  }

  /**
   * Calculates development length Ld in mm as per IS 456:2000 Cl. 26.2.1.
   * Formula: Ld = (phi * sigma_s) / (4 * tau_bd)
   * Note: For deformed bars (HYSD/Fe500), tau_bd is increased by 60%.
   * For compression bars, tau_bd is increased by 25%.
   */
  public static calculateLd(
    barDiameter: number,
    fy: number,
    fck: number,
    isDeformed: boolean = true,
    isCompression: boolean = false
  ): number {
    let tau_bd = this.getTauBd(fck);
    if (isDeformed) {
      tau_bd *= 1.6; // 60% increase for deformed bars
    }
    if (isCompression) {
      tau_bd *= 1.25; // 25% increase in compression
    }

    const sigma_s = 0.87 * fy;
    const Ld = (barDiameter * sigma_s) / (4 * tau_bd);
    return Math.ceil(Ld / 10) * 10; // Round up to nearest 10mm
  }
}
