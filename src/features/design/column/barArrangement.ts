export interface ColumnRebarOption {
  callout: string; // e.g. "8-T20" or "4-T20 + 4-T16"
  totalArea: number; // mm2
  totalBars: number;
  isMixed: boolean;
  cornerBars: { diameter: number; count: 4; callout: string; area: number };
  faceBars?: {
    diameter: number;
    count: number;
    countX: number; // Number of intermediate bars along each depth D face
    countY: number; // Number of intermediate bars along each width b face
    callout: string;
    area: number;
  };
  spacingX: number; // mm center-to-center spacing along depth D
  spacingY: number; // mm center-to-center spacing along width b
  isConfinementCompliant: boolean; // Spacing <= 300 mm and clear >= 40 mm
  pt_prov: number; // Percentage steel (0.8% - 4.0%)
}

export class ColumnBarArrangement {
  public static readonly STANDARD_INDIAN_DIAMETERS = [12, 16, 20, 25, 28, 32];

  /**
   * Generates all compliant uniform and mixed rebar arrangements satisfying IS 13920 space confinement,
   * strictly restricted to user-selected available bar diameters.
   */
  public static getAvailableOptions(
    Asc_req: number,
    b: number,
    D: number,
    cover: number = 40,
    allowedDiameters?: number[]
  ): ColumnRebarOption[] {
    const Ag = b * D;
    const tieDia = 8;
    const coreWidth = b - 2 * (cover + tieDia);
    const coreDepth = D - 2 * (cover + tieDia);

    // Strictly enforce allowed diameters; default to economical 12, 16, 20, 25
    const validDiaList = allowedDiameters && allowedDiameters.length > 0
      ? allowedDiameters
      : [12, 16, 20, 25];

    const options: ColumnRebarOption[] = [];

    // Configuration templates: (nX = bars on each D face, nY = bars on each b face)
    const layouts = [
      { nX: 0, nY: 0, name: '4-bar layout' },
      { nX: 1, nY: 0, name: '6-bar layout (D-faces)' },
      { nX: 0, nY: 1, name: '6-bar layout (b-faces)' },
      { nX: 1, nY: 1, name: '8-bar layout' },
      { nX: 2, nY: 0, name: '8-bar layout (D-faces)' },
      { nX: 2, nY: 1, name: '10-bar layout' },
      { nX: 3, nY: 0, name: '10-bar layout (D-faces)' },
      { nX: 2, nY: 2, name: '12-bar layout' },
      { nX: 3, nY: 1, name: '12-bar layout (D-heavy)' },
      { nX: 3, nY: 2, name: '14-bar layout' },
      { nX: 4, nY: 2, name: '16-bar layout' },
      { nX: 3, nY: 3, name: '16-bar square layout' },
      { nX: 4, nY: 3, name: '18-bar layout' },
      { nX: 4, nY: 4, name: '20-bar layout' },
    ];

    // Strategy 1: Uniform Bar Arrangements (All bars same diameter)
    const uniformDiameters = [12, 16, 20, 25, 28, 32].filter((d) => validDiaList.includes(d));

    for (const dia of uniformDiameters) {
      const singleArea = (Math.PI * dia * dia) / 4;

      for (const layout of layouts) {
        const totalBars = 4 + 2 * layout.nX + 2 * layout.nY;
        const totalArea = totalBars * singleArea;
        const pt = (totalArea * 100) / Ag;

        const spacingX = parseFloat((coreDepth / (layout.nX + 1)).toFixed(1));
        const spacingY = parseFloat((coreWidth / (layout.nY + 1)).toFixed(1));
        const minSpacing = Math.min(spacingX, spacingY);
        const maxSpacing = Math.max(spacingX, spacingY);
        const isConfinementCompliant = maxSpacing <= 300 && minSpacing >= Math.max(dia + 20, 40);

        if (totalArea >= Asc_req && pt >= 0.8 && pt <= 4.0 && isConfinementCompliant) {
          const cornerArea = 4 * singleArea;
          const totalFaceBars = totalBars - 4;
          const faceArea = totalFaceBars * singleArea;

          options.push({
            callout: `${totalBars}-T${dia}`,
            totalArea: parseFloat(totalArea.toFixed(1)),
            totalBars,
            isMixed: false,
            cornerBars: {
              diameter: dia,
              count: 4,
              callout: `4-T${dia}`,
              area: parseFloat(cornerArea.toFixed(1)),
            },
            faceBars:
              totalFaceBars > 0
                ? {
                    diameter: dia,
                    count: totalFaceBars,
                    countX: layout.nX,
                    countY: layout.nY,
                    callout: `${totalFaceBars}-T${dia}`,
                    area: parseFloat(faceArea.toFixed(1)),
                  }
                : undefined,
            spacingX,
            spacingY,
            isConfinementCompliant,
            pt_prov: parseFloat(pt.toFixed(2)),
          });
        }
      }
    }

    // Strategy 2: Mixed Bar Arrangements (4 Bigger Corner Bars + Smaller Face Bars)
    // Generating valid mixed pairs where cornerDia >= faceDia
    const mixedPairs: [number, number][] = [];
    for (const c of validDiaList) {
      for (const f of validDiaList) {
        if (c > f) {
          mixedPairs.push([c, f]);
        }
      }
    }

    for (const [cornerDia, faceDia] of mixedPairs) {
      const cornerArea = (4 * Math.PI * cornerDia * cornerDia) / 4;
      const singleFaceArea = (Math.PI * faceDia * faceDia) / 4;

      for (const layout of layouts) {
        const totalFaceBars = 2 * layout.nX + 2 * layout.nY;
        if (totalFaceBars === 0) continue;

        const faceArea = totalFaceBars * singleFaceArea;
        const totalArea = cornerArea + faceArea;
        const totalBars = 4 + totalFaceBars;
        const pt = (totalArea * 100) / Ag;

        const spacingX = parseFloat((coreDepth / (layout.nX + 1)).toFixed(1));
        const spacingY = parseFloat((coreWidth / (layout.nY + 1)).toFixed(1));
        const minSpacing = Math.min(spacingX, spacingY);
        const maxSpacing = Math.max(spacingX, spacingY);

        // IS 13920 Cl. 7.3.2: Max spacing <= 300 mm, clear spacing >= 40 mm
        const isConfinementCompliant = maxSpacing <= 300 && minSpacing >= Math.max(faceDia + 20, 40);

        if (totalArea >= Asc_req && pt >= 0.8 && pt <= 4.0 && isConfinementCompliant) {
          options.push({
            callout: `4-T${cornerDia} + ${totalFaceBars}-T${faceDia}`,
            totalArea: parseFloat(totalArea.toFixed(1)),
            totalBars,
            isMixed: true,
            cornerBars: {
              diameter: cornerDia,
              count: 4,
              callout: `4-T${cornerDia}`,
              area: parseFloat(cornerArea.toFixed(1)),
            },
            faceBars: {
              diameter: faceDia,
              count: totalFaceBars,
              countX: layout.nX,
              countY: layout.nY,
              callout: `${totalFaceBars}-T${faceDia}`,
              area: parseFloat(faceArea.toFixed(1)),
            },
            spacingX,
            spacingY,
            isConfinementCompliant,
            pt_prov: parseFloat(pt.toFixed(2)),
          });
        }
      }
    }

    return options;
  }

  /**
   * Evaluates practical constructability and economy score for an RCC column rebar option.
   * Strongly targets economical 0.8% to 1.0%–1.2% gross reinforcement ratio.
   */
  public static calculatePracticalityScore(
    opt: ColumnRebarOption,
    Asc_req: number,
    b: number,
    D: number
  ): number {
    const excessSteel = Math.max(0, opt.totalArea - Asc_req);
    const Ag = b * D;
    const pt = opt.pt_prov;

    // Target steel ratio is near 0.8% - 1.2% (economical design)
    const targetPt = Math.max(0.8, (Asc_req * 100) / Ag);
    let ptPenalty = 0;
    if (pt > targetPt) {
      ptPenalty = (pt - targetPt) * 500; // Strong penalty for over-reinforcing
    }

    // Ideal bar count based on section dimensions:
    let idealBars = 8;
    if (Ag <= 140000) idealBars = 6;
    else if (Ag <= 260000) idealBars = 8;
    else if (Ag <= 350000) idealBars = 10;
    else idealBars = 12;

    const barCountPenalty = Math.abs(opt.totalBars - idealBars) * 90;

    // Spacing score (Ideal: 120mm - 240mm)
    let spacingPenalty = 0;
    const minSpacing = Math.min(opt.spacingX, opt.spacingY);
    const maxSpacing = Math.max(opt.spacingX, opt.spacingY);

    if (minSpacing < 90) {
      spacingPenalty += (90 - minSpacing) * 45; // Severe penalty for crowded bars
    }
    if (maxSpacing > 280) {
      spacingPenalty += (maxSpacing - 280) * 20; // Moderate penalty for large spacing
    }

    const mixedBonusOrPenalty = opt.isMixed ? 10 : 0; // Slight preference for uniform, but mixed is welcome for exact 0.8%-1% targeting

    return excessSteel + ptPenalty + barCountPenalty + spacingPenalty + mixedBonusOrPenalty;
  }

  /**
   * Intelligently auto-selects the most practical, constructable rebar layout with ideal bar count and non-congested spacing.
   */
  public static selectBars(
    Asc_req: number,
    b: number,
    D: number,
    cover: number = 40,
    allowedDiameters?: number[]
  ): ColumnRebarOption {
    const available = this.getAvailableOptions(Asc_req, b, D, cover, allowedDiameters);
    if (available.length === 0) {
      const validDias = allowedDiameters && allowedDiameters.length > 0 ? allowedDiameters : [12, 16, 20, 25];
      const fallbackDia = validDias[validDias.length - 1];
      return this.createCustomRebarOption(fallbackDia, fallbackDia, 1, 1, b, D, cover);
    }

    // Rank all options by practical constructability score
    const ranked = available
      .map((opt) => ({
        opt,
        score: this.calculatePracticalityScore(opt, Asc_req, b, D),
      }))
      .sort((a, b) => a.score - b.score);

    return ranked[0].opt;
  }

  /**
   * Constructs a custom ColumnRebarOption from explicit corner and face bar specifications.
   */
  public static createCustomRebarOption(
    cornerDia: number,
    faceDia: number,
    nX: number,
    nY: number,
    b: number,
    D: number,
    cover: number = 40
  ): ColumnRebarOption {
    const Ag = b * D;
    const tieDia = 8;
    const coreWidth = b - 2 * (cover + tieDia);
    const coreDepth = D - 2 * (cover + tieDia);

    const cornerArea = 4 * ((Math.PI * cornerDia * cornerDia) / 4);
    const totalFaceBars = 2 * nX + 2 * nY;
    const faceArea = totalFaceBars * ((Math.PI * faceDia * faceDia) / 4);
    const totalArea = cornerArea + faceArea;
    const totalBars = 4 + totalFaceBars;
    const pt = (totalArea * 100) / Ag;

    const spacingX = parseFloat((coreDepth / (nX + 1)).toFixed(1));
    const spacingY = parseFloat((coreWidth / (nY + 1)).toFixed(1));
    const isConfinementCompliant = Math.max(spacingX, spacingY) <= 300 && Math.min(spacingX, spacingY) >= 40;

    const isMixed = totalFaceBars > 0 && cornerDia !== faceDia;
    const callout = isMixed
      ? `4-T${cornerDia} + ${totalFaceBars}-T${faceDia}`
      : `${totalBars}-T${cornerDia}`;

    return {
      callout,
      totalArea: parseFloat(totalArea.toFixed(1)),
      totalBars,
      isMixed,
      cornerBars: {
        diameter: cornerDia,
        count: 4,
        callout: `4-T${cornerDia}`,
        area: parseFloat(cornerArea.toFixed(1)),
      },
      faceBars:
        totalFaceBars > 0
          ? {
              diameter: faceDia,
              count: totalFaceBars,
              countX: nX,
              countY: nY,
              callout: `${totalFaceBars}-T${faceDia}`,
              area: parseFloat(faceArea.toFixed(1)),
            }
          : undefined,
      spacingX,
      spacingY,
      isConfinementCompliant,
      pt_prov: parseFloat(pt.toFixed(2)),
    };
  }
}
