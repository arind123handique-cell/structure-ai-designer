import { BeamDesignEngine, BeamDesignInput, BeamDesignOutput } from './beamDesignEngine';
import { NormalizedStructuralModel, Member3D } from '@/features/model/types';

export interface CandidateBeamSection {
  b: number; // mm
  D: number; // mm
  name: string;
}

export const CANDIDATE_BEAM_SECTIONS: CandidateBeamSection[] = [
  // 300 mm Width (Standard Main Beams - Low Steel % & Less Congestion)
  { b: 300, D: 400, name: '300x400 mm' },
  { b: 300, D: 450, name: '300x450 mm' },
  { b: 300, D: 500, name: '300x500 mm' },
  { b: 300, D: 550, name: '300x550 mm' },
  { b: 300, D: 600, name: '300x600 mm' },
  { b: 300, D: 750, name: '300x750 mm' },

  // 250 mm Width (Balanced Standard)
  { b: 250, D: 400, name: '250x400 mm' },
  { b: 250, D: 450, name: '250x450 mm' },
  { b: 250, D: 500, name: '250x500 mm' },
  { b: 250, D: 600, name: '250x600 mm' },

  // 230 mm Width (9" Masonry Wall Flush)
  { b: 230, D: 300, name: '230x300 mm' },
  { b: 230, D: 350, name: '230x350 mm' },
  { b: 230, D: 400, name: '230x400 mm' },
  { b: 230, D: 450, name: '230x450 mm' },
  { b: 230, D: 500, name: '230x500 mm' },
  { b: 230, D: 600, name: '230x600 mm' },

  // 350 mm Width (Heavy Transfers)
  { b: 350, D: 600, name: '350x600 mm' },
  { b: 350, D: 750, name: '350x750 mm' },
];

export interface BeamOptimizationResult {
  memberId: number;
  originalSection: { b: number; D: number; name: string };
  optimizedSection: { b: number; D: number; name: string };
  originalDesign: BeamDesignOutput;
  optimizedDesign: BeamDesignOutput;
  originalCost: number; // INR
  optimizedCost: number; // INR
  costSavingsPercent: number;
  concreteVolumeOriginal: number; // m3
  concreteVolumeOptimized: number; // m3
  steelWeightOriginal: number; // kg
  steelWeightOptimized: number; // kg
}

export interface BatchBeamOptimizationSummary {
  totalBeams: number;
  passedCount: number;
  concreteVolumeBefore: number; // m3
  concreteVolumeAfter: number; // m3
  concreteSavedPercent: number;
  steelWeightBefore: number; // kg
  steelWeightAfter: number; // kg
  steelSavedPercent: number;
  costBefore: number; // INR
  costAfter: number; // INR
  costSavedPercent: number;
  results: BeamOptimizationResult[];
  sectionUpdates: { memberId: number; yd: number; zd: number; name: string }[];
  allowedDiameters: number[];
  preferredWidth?: number;
}

export class BeamOptimizationEngine {
  private static CONCRETE_RATE_PER_M3 = 6500; // INR / m3 (M25 mix placed & pumped)
  private static STEEL_RATE_PER_KG = 75; // INR / kg (Fe500D bent & tied)

  /**
   * Calculates material quantities and cost index for a designed beam.
   */
  public static calculateCost(b_mm: number, D_mm: number, span_m: number, design: BeamDesignOutput) {
    const concreteVol = (b_mm / 1000) * (D_mm / 1000) * span_m; // m3

    // Steel weights:
    const topArea = design.curtailment?.totalTopArea || design.topRebar.totalArea || 300; // mm2
    const botArea = design.curtailment?.totalBottomArea || design.bottomRebar.totalArea || 300; // mm2
    const stirrupArea = 2 * ((Math.PI * 8 * 8) / 4); // 2-legged 8mm ties (~100.5 mm2)
    const stirrupPerimeter = Math.max(0.4, 2 * ((b_mm - 60) + (D_mm - 60)) / 1000); // m
    const spacing_mm = design.shear.spacing_prov || design.shear.spacing_calc || 150;
    const stirrupSpacing = Math.max(0.075, spacing_mm / 1000); // m
    const numStirrups = Math.ceil(span_m / stirrupSpacing);
    const stirrupTotalVol = (numStirrups * stirrupPerimeter * stirrupArea) / 1e6; // m3

    const longitudinalVol = ((topArea + botArea) / 1e6) * span_m; // m3
    const totalSteelVol = longitudinalVol + stirrupTotalVol; // m3
    const totalSteelKg = totalSteelVol * 7850; // kg

    const cost = concreteVol * this.CONCRETE_RATE_PER_M3 + totalSteelKg * this.STEEL_RATE_PER_KG;

    return {
      concreteVol: parseFloat(concreteVol.toFixed(3)),
      steelKg: parseFloat(totalSteelKg.toFixed(2)),
      cost: parseFloat(cost.toFixed(0)),
    };
  }

  /**
   * Finds the most economical cross-section and rebar layout for a single beam,
   * strictly respecting allowed Indian rebar diameters.
   */
  public static optimizeSingleBeam(
    member: Member3D,
    model: NormalizedStructuralModel,
    fck: number,
    fy: number,
    cover: number = 30,
    allowedDiameters?: number[],
    preferredWidth?: number
  ): BeamOptimizationResult {
    const spanLength = member.length;
    const currentB = Math.round((member.section.zd || 0.3) * 1000);
    const currentD = Math.round((member.section.yd || 0.45) * 1000);

    // Extract maximum forces
    const forces = model.memberForces.filter((f) => f.memberId === member.id);
    let maxMoment = 0;
    let maxShear = 0;
    let govLC = 0;

    if (forces.length > 0) {
      for (const f of forces) {
        // govLC from the shear design LD= line (mz is 0 because forceParser extracts Mu from REINF AREA table)
        if (Math.abs(f.vy) > maxShear) {
          maxShear = Math.abs(f.vy);
          govLC = f.loadCaseId;
        }
        if (Math.abs(f.mz) > maxMoment) {
          maxMoment = Math.abs(f.mz);
          govLC = f.loadCaseId;
        }
      }
    }

    if (govLC <= 0) govLC = 9; // Default to LC9 = 1.5DL+1.5LL

    // Engineering Gravity Envelope for Baseline (1.5 DL + 1.5 LL)
    const baseSW = (currentB / 1000) * (currentD / 1000) * 25;
    const baseWu = 1.5 * (baseSW + 8.5 + 8.0);
    const baseGravityMu = parseFloat(Math.max(45, (baseWu * spanLength * spanLength) / 10).toFixed(1));
    const baseGravityVu = parseFloat(Math.max(35, (baseWu * spanLength) / 2).toFixed(1));

    const baselineDesignMu = Math.max(maxMoment, baseGravityMu);
    const baselineDesignVu = Math.max(maxShear, baseGravityVu);

    const staadSummary = model.designSummaries?.get(member.id);

    // Baseline current design
    const baselineDesign = BeamDesignEngine.design({
      memberId: member.id,
      b: currentB,
      D: currentD,
      spanLength,
      fck,
      fy,
      cover,
      Mu_top: baselineDesignMu,
      Mu_bottom: baselineDesignMu * 0.7,
      Vu: baselineDesignVu,
      Ast_top_anl: staadSummary?.astTopReq,
      Ast_bottom_anl: staadSummary?.astBottomReq,
      governingLoadCase: govLC,
      allowedDiameters,
    });

    const baselineCost = this.calculateCost(currentB, currentD, spanLength, baselineDesign);

    // IS 456 Cl 23.2.1 / IS 13920 Cl 6.1 Engineering Span-to-depth minimum overall depths:
    let minEngineeringDepth = 300;
    if (spanLength >= 4.2) {
      minEngineeringDepth = 450; // L >= 4.2m -> D >= 450 mm
    } else if (spanLength >= 3.2) {
      minEngineeringDepth = 400; // 3.2m <= L < 4.2m -> D >= 400 mm
    } else if (spanLength >= 2.2) {
      minEngineeringDepth = 350; // 2.2m <= L < 3.2m -> D >= 350 mm
    }

    let bestCandidate = {
      section: { b: currentB, D: currentD, name: `${currentB}x${currentD} mm` },
      design: baselineDesign,
      costData: baselineCost,
    };

    let bestCost = baselineDesign.status === 'PASS' ? baselineCost.cost : Number.MAX_VALUE;

    // Filter candidate sections if preferred width specified (e.g. 300mm or 250mm)
    let candidatePool = CANDIDATE_BEAM_SECTIONS;
    if (preferredWidth && preferredWidth > 0) {
      const filtered = CANDIDATE_BEAM_SECTIONS.filter((c) => c.b === preferredWidth);
      if (filtered.length > 0) {
        candidatePool = filtered;
      }
    }

    // Test candidate sections from most economical to largest
    for (const cand of candidatePool) {
      // Must satisfy span-to-depth engineering minimum
      if (cand.D < minEngineeringDepth) {
        continue;
      }

      // Re-evaluate gravity load envelope for candidate section
      const candSW = (cand.b / 1000) * (cand.D / 1000) * 25;
      const candWu = 1.5 * (candSW + 8.5 + 8.0);
      const candGravityMu = parseFloat(Math.max(45, (candWu * spanLength * spanLength) / 10).toFixed(1));
      const candGravityVu = parseFloat(Math.max(35, (candWu * spanLength) / 2).toFixed(1));
      const candDesignMu = Math.max(maxMoment, candGravityMu);
      const candDesignVu = Math.max(maxShear, candGravityVu);

      const design = BeamDesignEngine.design({
        memberId: member.id,
        b: cand.b,
        D: cand.D,
        spanLength,
        fck,
        fy,
        cover,
        Mu_top: candDesignMu,
        Mu_bottom: candDesignMu * 0.7,
        Vu: candDesignVu,
        Ast_top_anl: staadSummary?.astTopReq,
        Ast_bottom_anl: staadSummary?.astBottomReq,
        governingLoadCase: govLC,
        allowedDiameters,
      });

      if (design.status === 'PASS') {
        // Enforce IS 456 Cl. 26.3.2 Anti-Crowding: Avoid crowded rebar layouts (< 25mm clear aggregate spacing)
        if (design.curtailment.isCrowded && bestCandidate.design && !bestCandidate.design.curtailment.isCrowded) {
          continue;
        }

        const costData = this.calculateCost(cand.b, cand.D, spanLength, design);
        // Strongly prefer uncrowded sections over crowded ones
        const isBetterCost = costData.cost < bestCost;
        const fixesCrowding = bestCandidate.design?.curtailment.isCrowded && !design.curtailment.isCrowded;

        if (fixesCrowding || (isBetterCost && !design.curtailment.isCrowded) || (isBetterCost && bestCost === Number.MAX_VALUE)) {
          bestCost = costData.cost;
          bestCandidate = {
            section: cand,
            design,
            costData,
          };
        }
      }
    }

    const savingsPercent =
      baselineCost.cost > 0
        ? parseFloat((((baselineCost.cost - bestCandidate.costData.cost) / baselineCost.cost) * 100).toFixed(1))
        : 0;

    return {
      memberId: member.id,
      originalSection: { b: currentB, D: currentD, name: member.section.name || `${currentB}x${currentD} mm` },
      optimizedSection: bestCandidate.section,
      originalDesign: baselineDesign,
      optimizedDesign: bestCandidate.design,
      originalCost: baselineCost.cost,
      optimizedCost: bestCandidate.costData.cost,
      costSavingsPercent: savingsPercent,
      concreteVolumeOriginal: baselineCost.concreteVol,
      concreteVolumeOptimized: bestCandidate.costData.concreteVol,
      steelWeightOriginal: baselineCost.steelKg,
      steelWeightOptimized: bestCandidate.costData.steelKg,
    };
  }

  /**
   * Runs 1-click batch economical auto-design across all selected beams with allowed rebar filter and width preference.
   */
  public static optimizeAllBeams(
    beams: Member3D[],
    model: NormalizedStructuralModel,
    fck: number,
    fy: number,
    cover: number = 30,
    allowedDiameters: number[] = [12, 16, 20, 25],
    preferredWidth?: number
  ): BatchBeamOptimizationSummary {
    const results: BeamOptimizationResult[] = [];
    const sectionUpdates: { memberId: number; yd: number; zd: number; name: string }[] = [];

    let totalConcreteBefore = 0;
    let totalConcreteAfter = 0;
    let totalSteelBefore = 0;
    let totalSteelAfter = 0;
    let totalCostBefore = 0;
    let totalCostAfter = 0;

    for (const b of beams) {
      const res = this.optimizeSingleBeam(b, model, fck, fy, cover, allowedDiameters, preferredWidth);
      results.push(res);

      sectionUpdates.push({
        memberId: b.id,
        zd: res.optimizedSection.b / 1000,
        yd: res.optimizedSection.D / 1000,
        name: res.optimizedSection.name,
      });

      totalConcreteBefore += res.concreteVolumeOriginal;
      totalConcreteAfter += res.concreteVolumeOptimized;
      totalSteelBefore += res.steelWeightOriginal;
      totalSteelAfter += res.steelWeightOptimized;
      totalCostBefore += res.originalCost;
      totalCostAfter += res.optimizedCost;
    }

    const concreteSavedPercent =
      totalConcreteBefore > 0
        ? parseFloat((((totalConcreteBefore - totalConcreteAfter) / totalConcreteBefore) * 100).toFixed(1))
        : 0;

    const steelSavedPercent =
      totalSteelBefore > 0
        ? parseFloat((((totalSteelBefore - totalSteelAfter) / totalSteelBefore) * 100).toFixed(1))
        : 0;

    const costSavedPercent =
      totalCostBefore > 0
        ? parseFloat((((totalCostBefore - totalCostAfter) / totalCostBefore) * 100).toFixed(1))
        : 0;

    return {
      totalBeams: beams.length,
      passedCount: results.filter((r) => r.optimizedDesign.status === 'PASS').length,
      concreteVolumeBefore: parseFloat(totalConcreteBefore.toFixed(1)),
      concreteVolumeAfter: parseFloat(totalConcreteAfter.toFixed(1)),
      concreteSavedPercent,
      steelWeightBefore: Math.round(totalSteelBefore),
      steelWeightAfter: Math.round(totalSteelAfter),
      steelSavedPercent,
      costBefore: Math.round(totalCostBefore),
      costAfter: Math.round(totalCostAfter),
      costSavedPercent,
      results,
      sectionUpdates,
      allowedDiameters,
      preferredWidth,
    };
  }
}
