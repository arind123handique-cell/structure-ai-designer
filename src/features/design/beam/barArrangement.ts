export interface RebarOption {
  callout: string;
  totalArea: number; // mm2
  barCount: number;
  mainDiameter: number;
  layers: number;
  bars: { diameter: number; count: number }[];
}

export interface AstBarOption {
  callout: string;
  totalArea: number; // mm2
  barCount: number;
  mainDiameter: number;
  layers: number;
  Ast_req: number;
  excessArea: number; // mm2 (prov - req)
  efficiencyPercent: number; // (req / prov) * 100
  isCompliant: boolean;
  type: 'UNIFORM' | 'MIXED' | 'EXTRA';
}

export interface BeamCurtailmentDetail {
  // Continuous full-span through bars (anchor bars at top, main through bars at bottom)
  throughTop: {
    count: number;
    diameter: number;
    callout: string; // e.g. "2-T12"
    area: number; // mm2
  };
  // Extra top support bars (curtailed at L/3 from support face)
  extraTopSupport: {
    count: number;
    diameter: number;
    callout: string; // e.g. "1-T16"
    cutoffLength: number; // in meters (e.g. 1.35m)
    area: number;
    hasExtra: boolean;
  };
  // Continuous full-span bottom bars
  throughBottom: {
    count: number;
    diameter: number;
    callout: string; // e.g. "2-T12"
    area: number;
  };
  // Extra bottom midspan bars (curtailed over central 0.75L)
  extraBottomMidspan: {
    count: number;
    diameter: number;
    callout: string; // e.g. "1-T16"
    startOffset: number; // in meters (e.g. 0.50m)
    length: number; // in meters (e.g. 3.00m)
    area: number;
    hasExtra: boolean;
  };
  // Side face reinforcement (skin steel if D > 750mm as per IS 456 Cl. 26.5.1.6)
  sideFaceBars?: {
    countTotal: number;
    diameter: number;
    callout: string;
    area: number;
  };
  topScheduleCallout: string; // e.g. "2-T12 (Thru) + 1-T16 Extra (L/3)"
  bottomScheduleCallout: string; // e.g. "2-T12 (Thru) + 1-T16 Extra (Midspan)"
  totalTopArea: number; // mm2
  totalBottomArea: number; // mm2
  isCrowded: boolean;
  minClearSpacingTop: number; // mm
  minClearSpacingBottom: number; // mm
}

export class BeamBarArrangement {
  public static readonly STANDARD_INDIAN_DIAMETERS = [8, 10, 12, 16, 20, 25, 28, 32];

  /**
   * Generates ranked bar combinations matching or exceeding Ast_req.
   */
  public static generateAstOptions(
    Ast_req: number,
    b: number,
    cover: number = 30,
    allowedDiameters?: number[]
  ): AstBarOption[] {
    const validDias = allowedDiameters && allowedDiameters.length > 0
      ? allowedDiameters
      : [12, 16, 20, 25];

    const minBars = 2;
    const maxBarsPerRow = Math.max(2, Math.floor((b - 2 * cover - 2 * 8) / (20 + 25)));
    const options: AstBarOption[] = [];

    // 1. Uniform bar options
    for (const dia of validDias) {
      const singleArea = (Math.PI * dia * dia) / 4;
      for (let count = minBars; count <= 8; count++) {
        const totalArea = parseFloat((count * singleArea).toFixed(1));
        const excess = parseFloat((totalArea - Ast_req).toFixed(1));
        const efficiency = parseFloat(((Ast_req / totalArea) * 100).toFixed(1));
        const layers = count > maxBarsPerRow ? 2 : 1;

        options.push({
          callout: `${count}-T${dia}`,
          totalArea,
          barCount: count,
          mainDiameter: dia,
          layers,
          Ast_req,
          excessArea: excess,
          efficiencyPercent: Math.min(100, efficiency),
          isCompliant: totalArea >= Ast_req,
          type: 'UNIFORM',
        });
      }
    }

    // 2. Mixed Bar Combinations (2 Main Corner Bars + Intermediate Extra Bars)
    const baseMixedPairs: [number, number][] = [
      [20, 16],
      [20, 12],
      [25, 20],
      [25, 16],
      [16, 12],
      [28, 20],
      [12, 10],
    ];
    const mixedPairs: [number, number][] = baseMixedPairs.filter(
      ([c, e]) => validDias.includes(c) && validDias.includes(e)
    );

    for (const [cornerDia, extraDia] of mixedPairs) {
      const cornerArea = 2 * ((Math.PI * cornerDia * cornerDia) / 4);
      const singleExtraArea = (Math.PI * extraDia * extraDia) / 4;

      for (let extraCount = 1; extraCount <= 4; extraCount++) {
        const totalBars = 2 + extraCount;
        const totalArea = parseFloat((cornerArea + extraCount * singleExtraArea).toFixed(1));
        const excess = parseFloat((totalArea - Ast_req).toFixed(1));
        const efficiency = parseFloat(((Ast_req / totalArea) * 100).toFixed(1));
        const layers = totalBars > maxBarsPerRow ? 2 : 1;

        options.push({
          callout: `2-T${cornerDia} + ${extraCount}-T${extraDia}`,
          totalArea,
          barCount: totalBars,
          mainDiameter: cornerDia,
          layers,
          Ast_req,
          excessArea: excess,
          efficiencyPercent: Math.min(100, efficiency),
          isCompliant: totalArea >= Ast_req,
          type: 'MIXED',
        });
      }
    }

    // Sort compliant options by lowest excess area, then highest efficiency
    return options.sort((a, b) => {
      if (a.isCompliant && !b.isCompliant) return -1;
      if (!a.isCompliant && b.isCompliant) return 1;
      if (a.isCompliant && b.isCompliant) {
        return a.excessArea - b.excessArea;
      }
      return b.totalArea - a.totalArea;
    });
  }

  /**
   * Evaluates standard uniform bar selection.
   */
  public static selectBars(
    Ast_req: number,
    b: number,
    cover: number = 30,
    allowedDiameters?: number[]
  ): RebarOption {
    const options = this.generateAstOptions(Ast_req, b, cover, allowedDiameters);
    const compliant = options.filter((opt) => opt.isCompliant);

    if (compliant.length > 0) {
      const best = compliant[0];
      return {
        callout: best.callout,
        totalArea: best.totalArea,
        barCount: best.barCount,
        mainDiameter: best.mainDiameter,
        layers: best.layers,
        bars: [{ diameter: best.mainDiameter, count: best.barCount }],
      };
    }

    const fallbackDia = allowedDiameters && allowedDiameters.length > 0 ? allowedDiameters[allowedDiameters.length - 1] : 20;
    const singleArea = (Math.PI * fallbackDia * fallbackDia) / 4;
    const fallbackCount = Math.max(2, Math.ceil(Ast_req / singleArea));
    return {
      callout: `${fallbackCount}-T${fallbackDia}`,
      totalArea: parseFloat((fallbackCount * singleArea).toFixed(1)),
      barCount: fallbackCount,
      mainDiameter: fallbackDia,
      layers: 1,
      bars: [{ diameter: fallbackDia, count: fallbackCount }],
    };
  }

  /**
   * Generates Curtailment Detailing with Continuous Through Bars and Extra Curtailed Bars as per IS 456 / IS 13920.
   */
  public static designCurtailment(
    Ast_top_req: number,
    Ast_bottom_req: number,
    b: number,
    D: number,
    spanLength: number,
    cover: number = 30,
    allowedDiameters?: number[]
  ): BeamCurtailmentDetail {
    const validDias = allowedDiameters && allowedDiameters.length > 0
      ? allowedDiameters
      : [12, 16, 20, 25];

    const span = Math.max(1.0, spanLength);
    const availInternalWidth = b - 2 * cover - 2 * 8; // stirrup dia 8mm
    const minRequiredClearGap = 25; // mm (IS 456 Cl. 26.3.2: 20mm aggregate + 5mm)

    // Helper: calculate max bars that fit in single row with >= 25mm clear gap
    const calcMaxBars1Row = (d: number) => {
      return Math.max(2, Math.floor((availInternalWidth + minRequiredClearGap) / (d + minRequiredClearGap)));
    };

    // --- 1. TOP STEEL SELECTION (Anchor/Hanger Through Bars + Support L/3 Extra Bars) ---
    interface TopCandidate {
      thruCount: number;
      thruDia: number;
      extraCount: number;
      extraDia: number;
      totalArea: number;
      score: number;
    }

    const topCandidates: TopCandidate[] = [];

    // All practical standard through bar options
    const standardThru = [
      { count: 2, dia: 12 },
      { count: 2, dia: 16 },
      { count: 2, dia: 20 },
      { count: 3, dia: 16 },
      { count: 3, dia: 20 },
    ].filter((t) => validDias.includes(t.dia));

    // Practical extra bar options
    const standardExtra = [
      { count: 0, dia: 12 },
      { count: 1, dia: 12 },
      { count: 2, dia: 12 },
      { count: 1, dia: 16 },
      { count: 2, dia: 16 },
      { count: 1, dia: 20 },
      { count: 2, dia: 20 },
      { count: 1, dia: 25 },
    ].filter((e) => e.count === 0 || validDias.includes(e.dia));

    for (const t of standardThru) {
      const aThru = t.count * ((Math.PI * t.dia * t.dia) / 4);
      for (const e of standardExtra) {
        const aExtra = e.count * ((Math.PI * e.dia * e.dia) / 4);
        const totalArea = aThru + aExtra;
        const totalBars = t.count + e.count;

        const maxBars = calcMaxBars1Row(Math.max(t.dia, e.dia));
        if (totalArea >= Ast_top_req && totalBars <= maxBars) {
          const excessArea = totalArea - Ast_top_req;
          // Prefer continuous through bars over extra bars for construction ease
          const extraPenalty = e.count > 0 ? 30 : 0;
          const barCountPenalty = (totalBars - 2) * 20;
          const score = excessArea + extraPenalty + barCountPenalty;

          topCandidates.push({
            thruCount: t.count,
            thruDia: t.dia,
            extraCount: e.count,
            extraDia: e.dia,
            totalArea,
            score,
          });
        }
      }
    }

    // Sort by best practical constructability score (lowest score wins)
    topCandidates.sort((a, b) => a.score - b.score);

    const bestTop = topCandidates.length > 0
      ? topCandidates[0]
      : {
          thruCount: 2,
          thruDia: validDias.includes(16) ? 16 : validDias[0],
          extraCount: 0,
          extraDia: 16,
          totalArea: (2 * Math.PI * 16 * 16) / 4,
          score: 0,
        };

    const throughTopCount = bestTop.thruCount;
    const throughTopDia = bestTop.thruDia;
    const throughTopArea = (throughTopCount * Math.PI * throughTopDia * throughTopDia) / 4;

    const extraTopCount = bestTop.extraCount;
    const extraTopDia = bestTop.extraDia;
    const extraTopArea = (extraTopCount * Math.PI * extraTopDia * extraTopDia) / 4;

    const cutoffTopLength = parseFloat(Math.max(0.6, span / 3).toFixed(2));
    const topScheduleCallout =
      extraTopCount > 0
        ? `${throughTopCount}-T${throughTopDia} (Thru) + ${extraTopCount}-T${extraTopDia} Extra (L/3 = ${cutoffTopLength}m)`
        : `${throughTopCount}-T${throughTopDia} (Full Span Continuous)`;

    const totalTopArea = parseFloat((throughTopArea + extraTopArea).toFixed(1));

    // --- 2. BOTTOM STEEL SELECTION (Continuous Joint Face Bars + Midspan Extra Bars) ---
    // IS 13920:2016 Cl. 6.2.3: Continuous bottom positive steel at support joint face >= 0.5 * Top negative steel
    const minDuctileBotSupportArea = 0.5 * totalTopArea;
    const targetThroughBotArea = Math.max(minDuctileBotSupportArea, (2 * Math.PI * (validDias[0] ** 2)) / 4);

    interface BotCandidate {
      thruCount: number;
      thruDia: number;
      extraCount: number;
      extraDia: number;
      totalArea: number;
      score: number;
    }

    const botCandidates: BotCandidate[] = [];

    const standardBotThru = [
      { count: 2, dia: 12 },
      { count: 2, dia: 16 },
      { count: 3, dia: 16 },
      { count: 2, dia: 20 },
      { count: 3, dia: 20 },
    ].filter((t) => validDias.includes(t.dia));

    const standardBotExtra = [
      { count: 0, dia: 12 },
      { count: 1, dia: 12 },
      { count: 1, dia: 16 },
      { count: 2, dia: 16 },
      { count: 1, dia: 20 },
      { count: 2, dia: 20 },
    ].filter((e) => e.count === 0 || validDias.includes(e.dia));

    for (const t of standardBotThru) {
      const aThru = t.count * ((Math.PI * t.dia * t.dia) / 4);
      // Through bars must satisfy IS 13920 Cl. 6.2.3 joint face minimum
      if (aThru < targetThroughBotArea) continue;

      for (const e of standardBotExtra) {
        const aExtra = e.count * ((Math.PI * e.dia * e.dia) / 4);
        const totalArea = aThru + aExtra;
        const totalBars = t.count + e.count;

        const maxBars = calcMaxBars1Row(Math.max(t.dia, e.dia));
        if (totalArea >= Ast_bottom_req && totalBars <= maxBars) {
          const excessArea = totalArea - Ast_bottom_req;
          const extraPenalty = e.count > 0 ? 25 : 0;
          const barCountPenalty = (totalBars - 2) * 15;
          const score = excessArea + extraPenalty + barCountPenalty;

          botCandidates.push({
            thruCount: t.count,
            thruDia: t.dia,
            extraCount: e.count,
            extraDia: e.dia,
            totalArea,
            score,
          });
        }
      }
    }

    botCandidates.sort((a, b) => a.score - b.score);

    const bestBot = botCandidates.length > 0
      ? botCandidates[0]
      : {
          thruCount: 3,
          thruDia: validDias.includes(16) ? 16 : validDias[0],
          extraCount: 0,
          extraDia: 16,
          totalArea: (3 * Math.PI * 16 * 16) / 4,
          score: 0,
        };

    const throughBotCount = bestBot.thruCount;
    const throughBotDia = bestBot.thruDia;
    const throughBotArea = (throughBotCount * Math.PI * throughBotDia * throughBotDia) / 4;

    const extraBotCount = bestBot.extraCount;
    const extraBotDia = bestBot.extraDia;
    const extraBotArea = (extraBotCount * Math.PI * extraBotDia * extraBotDia) / 4;

    const midspanExtraLength = parseFloat((0.75 * span).toFixed(2));
    const bottomScheduleCallout =
      extraBotCount > 0
        ? `${throughBotCount}-T${throughBotDia} (Thru) + ${extraBotCount}-T${extraBotDia} Extra (Midspan ${midspanExtraLength}m)`
        : `${throughBotCount}-T${throughBotDia} (Full Span Continuous)`;

    // IS 456 Cl. 26.3.2 Clear Spacing & Anti-Crowding Checks
    const totalTopBars = 2 + extraTopCount;
    const totalTopBarsWidth = 2 * throughTopDia + extraTopCount * extraTopDia;
    const minClearSpacingTop = totalTopBars > 1
      ? parseFloat(((availInternalWidth - totalTopBarsWidth) / (totalTopBars - 1)).toFixed(1))
      : availInternalWidth;

    const totalBotBars = throughBotCount + extraBotCount;
    const totalBotBarsWidth = throughBotCount * throughBotDia + extraBotCount * extraBotDia;
    const minClearSpacingBottom = totalBotBars > 1
      ? parseFloat(((availInternalWidth - totalBotBarsWidth) / (totalBotBars - 1)).toFixed(1))
      : availInternalWidth;

    const isCrowded = minClearSpacingTop < minRequiredClearGap || minClearSpacingBottom < minRequiredClearGap;

    // 3. Side Face Reinforcement (IS 456 Cl. 26.5.1.6 if D > 750 mm)
    let sideFaceBars: BeamCurtailmentDetail['sideFaceBars'] | undefined;
    if (D > 750) {
      const requiredSideFaceArea = 0.001 * b * D; // 0.1% web area
      const countEachSide = Math.max(1, Math.ceil(D / 300) - 1);
      const countTotal = countEachSide * 2;
      const dia = validDias.includes(10) ? 10 : validDias[0];
      const area = (countTotal * Math.PI * dia * dia) / 4;

      sideFaceBars = {
        countTotal,
        diameter: dia,
        callout: `${countTotal}-T${dia} Side Face (${countEachSide} each face)`,
        area: parseFloat(area.toFixed(1)),
      };
    }

    return {
      throughTop: {
        count: throughTopCount,
        diameter: throughTopDia,
        callout: `2-T${throughTopDia}`,
        area: parseFloat(throughTopArea.toFixed(1)),
      },
      extraTopSupport: {
        count: extraTopCount,
        diameter: extraTopDia,
        callout: extraTopCount > 0 ? `${extraTopCount}-T${extraTopDia}` : 'None',
        cutoffLength: cutoffTopLength,
        area: parseFloat(extraTopArea.toFixed(1)),
        hasExtra: extraTopCount > 0,
      },
      throughBottom: {
        count: throughBotCount,
        diameter: throughBotDia,
        callout: `2-T${throughBotDia}`,
        area: parseFloat(throughBotArea.toFixed(1)),
      },
      extraBottomMidspan: {
        count: extraBotCount,
        diameter: extraBotDia,
        callout: extraBotCount > 0 ? `${extraBotCount}-T${extraBotDia}` : 'None',
        startOffset: parseFloat((0.125 * span).toFixed(2)),
        length: midspanExtraLength,
        area: parseFloat(extraBotArea.toFixed(1)),
        hasExtra: extraBotCount > 0,
      },
      sideFaceBars,
      topScheduleCallout,
      bottomScheduleCallout,
      totalTopArea: parseFloat((throughTopArea + extraTopArea).toFixed(1)),
      totalBottomArea: parseFloat((throughBotArea + extraBotArea).toFixed(1)),
      isCrowded,
      minClearSpacingTop,
      minClearSpacingBottom,
    };
  }
}
