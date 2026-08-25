export class IS2911PileGroup {
  /**
   * Calculates pile group efficiency Eg using the Converse-Labarre formula.
   * Formula: Eg = 1 - theta * [((n - 1)*m + (m - 1)*n) / (90 * m * n)]
   * where theta = arctan(d / s) in degrees.
   */
  public static calculateGroupEfficiency(
    rowsM: number,
    colsN: number,
    pileDiameter: number,
    spacing: number
  ): number {
    if (rowsM * colsN <= 1) return 1.0;

    const theta = (Math.atan(pileDiameter / spacing) * 180) / Math.PI; // degrees
    const m = rowsM;
    const n = colsN;

    const numerator = (n - 1) * m + (m - 1) * n;
    const denominator = 90 * m * n;

    const Eg = 1 - theta * (numerator / denominator);
    return Math.max(0.65, Math.min(1.0, parseFloat(Eg.toFixed(3))));
  }

  /**
   * Checks minimum spacing requirements as per IS 2911:2010 Cl. 6.6.
   * Min 2.5 * Dp for friction piles, 3.0 * Dp for end-bearing piles.
   */
  public static checkSpacing(
    pileDiameter: number,
    spacing: number,
    isEndBearing: boolean = false
  ): { isPass: boolean; minRequiredSpacing: number } {
    const factor = isEndBearing ? 3.0 : 2.5;
    const minRequiredSpacing = factor * pileDiameter;
    return {
      isPass: spacing >= minRequiredSpacing,
      minRequiredSpacing,
    };
  }
}
