import { ColumnDesignEngine, ColumnDesignOutput } from './columnDesignEngine';
import { IS13920WeakBeamStrongColumn } from '@/features/codes/is13920/weakBeamStrongColumn';
import { NormalizedStructuralModel, Member3D } from '@/features/model/types';
import { ColumnNumberingService, ColumnMemberMappingInfo } from '@/features/model/columnNumbering';

export interface CandidateColumnSection {
  b: number; // mm
  D: number; // mm
  name: string;
}

// Candidate cross-sections including both standard and 90-degree rotated orientations
export const CANDIDATE_COLUMN_SECTIONS: CandidateColumnSection[] = [
  { b: 300, D: 300, name: '300x300 mm' },
  { b: 300, D: 450, name: '300x450 mm' },
  { b: 450, D: 300, name: '450x300 mm (Rotated)' },
  { b: 300, D: 600, name: '300x600 mm' },
  { b: 600, D: 300, name: '600x300 mm (Rotated)' },
  { b: 400, D: 400, name: '400x400 mm' },
  { b: 400, D: 500, name: '400x500 mm' },
  { b: 500, D: 400, name: '500x400 mm (Rotated)' },
  { b: 450, D: 450, name: '450x450 mm' },
  { b: 450, D: 550, name: '450x550 mm' },
  { b: 550, D: 450, name: '550x450 mm (Rotated)' },
  { b: 450, D: 600, name: '450x600 mm' },
  { b: 600, D: 450, name: '600x450 mm (Rotated)' },
  { b: 500, D: 500, name: '500x500 mm' },
  { b: 500, D: 600, name: '500x600 mm' },
  { b: 600, D: 500, name: '600x500 mm (Rotated)' },
  { b: 500, D: 750, name: '500x750 mm' },
  { b: 750, D: 500, name: '750x500 mm (Rotated)' },
  { b: 600, D: 600, name: '600x600 mm' },
  { b: 600, D: 750, name: '600x750 mm' },
  { b: 750, D: 600, name: '750x600 mm (Rotated)' },
  { b: 600, D: 900, name: '600x900 mm' },
  { b: 900, D: 600, name: '900x600 mm (Rotated)' },
];

export interface ColumnOptimizationResult {
  memberId: number;
  columnSlNo: number;
  columnLabel: string;
  originalSection: { b: number; D: number; name: string };
  optimizedSection: { b: number; D: number; name: string };
  originalDesign: ColumnDesignOutput;
  optimizedDesign: ColumnDesignOutput;
  originalCost: number; // INR
  optimizedCost: number; // INR
  costSavingsPercent: number;
  concreteVolumeOriginal: number; // m3
  concreteVolumeOptimized: number; // m3
  steelWeightOriginal: number; // kg
  steelWeightOptimized: number; // kg
}

export interface BatchColumnOptimizationSummary {
  totalColumns: number;
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
  results: ColumnOptimizationResult[];
  sectionUpdates: { memberId: number; yd: number; zd: number; name: string }[];
  allowedDiameters: number[];
}

export class ColumnOptimizationEngine {
  private static CONCRETE_RATE_PER_M3 = 6500; // INR / m3
  private static STEEL_RATE_PER_KG = 75; // INR / kg

  /**
   * Calculates material quantities and cost index for a designed column.
   */
  public static calculateCost(b_mm: number, D_mm: number, height_m: number, design: ColumnDesignOutput) {
    const concreteVol = (b_mm / 1000) * (D_mm / 1000) * height_m; // m3

    // Longitudinal steel volume
    const Asc = design.rebar.totalArea || (0.008 * b_mm * D_mm); // mm2
    const longVol = (Asc / 1e6) * height_m; // m3

    // Lateral tie links volume (Outer tie + inner links)
    const tieDia = 8;
    const tieArea = (Math.PI * tieDia * tieDia) / 4; // mm2
    const perimeter = 2 * ((b_mm - 60) + (D_mm - 60)) / 1000; // m
    const innerLinksLength = (b_mm - 60 + D_mm - 60) / 1000; // m
    const tieSpacing = Math.max(0.08, (design.ductility.confiningTieSpacingMax || 100) / 1000); // m
    const numTies = Math.ceil(height_m / tieSpacing);
    const tieTotalVol = (numTies * (perimeter + innerLinksLength) * tieArea) / 1e6; // m3

    const totalSteelVol = longVol + tieTotalVol; // m3
    const totalSteelKg = totalSteelVol * 7850; // kg

    const cost = concreteVol * this.CONCRETE_RATE_PER_M3 + totalSteelKg * this.STEEL_RATE_PER_KG;

    return {
      concreteVol: parseFloat(concreteVol.toFixed(3)),
      steelKg: parseFloat(totalSteelKg.toFixed(2)),
      cost: parseFloat(cost.toFixed(0)),
    };
  }

  /**
   * Finds the most economical cross-section, optimal orientation (90° rotation test),
   * and rebar layout for a single column, strictly adhering to allowed rebar diameters.
   */
  public static optimizeSingleColumn(
    member: Member3D,
    model: NormalizedStructuralModel,
    fck: number,
    fy: number,
    cover: number = 40,
    allowedDiameters?: number[],
    colInfo?: ColumnMemberMappingInfo
  ): ColumnOptimizationResult {
    const height = member.length || 3.5;
    const currentB = Math.round((member.section.zd || 0.45) * 1000);
    const currentD = Math.round((member.section.yd || 0.55) * 1000);

    // Extract maximum forces: Member forces OR support reaction for ground column
    let maxPu = 0;
    let maxMux = 0;
    let maxMuy = 0;
    let govLC = 1;

    const forces = model.memberForces.filter((f) => f.memberId === member.id);
    for (const f of forces) {
      if (Math.abs(f.axial) > maxPu) {
        maxPu = Math.abs(f.axial);
        govLC = f.loadCaseId;
      }
      if (Math.abs(f.mz) > maxMux) maxMux = Math.abs(f.mz);
      if (Math.abs(f.my) > maxMuy) maxMuy = Math.abs(f.my);
    }

    // Match ground support column reaction
    const startSup = model.supports?.get ? model.supports.get(member.startNodeId) : null;
    const endSup = model.supports?.get ? model.supports.get(member.endNodeId) : null;
    const supNodeId = startSup ? member.startNodeId : endSup ? member.endNodeId : (colInfo?.supportNodeId || null);

    if (supNodeId && model.reactions) {
      const reactions = model.reactions.filter((r) => r.nodeId === supNodeId);
      for (const r of reactions) {
        if (r.fy > maxPu) {
          maxPu = r.fy;
          govLC = r.loadCaseId;
        }
      }
    }

    if (maxPu <= 0) {
      maxPu = 650;
    }

    // Baseline current design
    const baselineDesign = ColumnDesignEngine.design({
      memberId: member.id,
      b: currentB,
      D: currentD,
      unsupportedHeight: height,
      fck,
      fy,
      cover,
      Pu: maxPu,
      Mux: maxMux,
      Muy: maxMuy,
      governingLoadCase: govLC,
      allowedDiameters,
    });

    const baselineCost = this.calculateCost(currentB, currentD, height, baselineDesign);

    let bestCandidate = {
      section: { b: currentB, D: currentD, name: `${currentB}x${currentD} mm` },
      design: baselineDesign,
      costData: baselineCost,
    };

    let bestCost = baselineDesign.status === 'PASS' ? baselineCost.cost : Number.MAX_VALUE;

    // Test candidate column sections (including 90-degree rotated orientations)
    for (const cand of CANDIDATE_COLUMN_SECTIONS) {
      // If candidate is rotated, swap moments Mux and Muy
      const isRotated = cand.name.includes('Rotated');
      const testMux = isRotated ? maxMuy : maxMux;
      const testMuy = isRotated ? maxMux : maxMuy;

      const design = ColumnDesignEngine.design({
        memberId: member.id,
        b: cand.b,
        D: cand.D,
        unsupportedHeight: height,
        fck,
        fy,
        cover,
        Pu: maxPu,
        Mux: testMux,
        Muy: testMuy,
        governingLoadCase: govLC,
        allowedDiameters,
      });

      // Check WBSC ductile ratio requirement
      const wbsc = IS13920WeakBeamStrongColumn.evaluateForColumn(cand.b, cand.D, fck, fy, 850, 300, 450);

      // Require passing status and biaxial IR <= 1.0
      if (design.status === 'PASS' && design.biaxialCheck.interactionRatio <= 1.0 && wbsc.isCompliant) {
        const costData = this.calculateCost(cand.b, cand.D, height, design);
        if (costData.cost < bestCost) {
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

    const columnLabel = colInfo?.columnLabel || `C${member.id}`;
    const columnSlNo = colInfo?.columnSlNo || member.id;

    return {
      memberId: member.id,
      columnSlNo,
      columnLabel,
      originalSection: { b: currentB, D: currentD, name: `${currentB}x${currentD} mm` },
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
   * Optimizes all columns across the entire building.
   */
  public static optimizeAllColumns(
    columns: Member3D[],
    model: NormalizedStructuralModel,
    fck: number,
    fy: number,
    cover: number = 40,
    allowedDiameters?: number[]
  ): BatchColumnOptimizationSummary {
    const columnMapping = ColumnNumberingService.getColumnMemberMapping(model);
    const results: ColumnOptimizationResult[] = [];
    const sectionUpdates: { memberId: number; yd: number; zd: number; name: string }[] = [];

    let totalCostBefore = 0;
    let totalCostAfter = 0;
    let totalConcBefore = 0;
    let totalConcAfter = 0;
    let totalSteelBefore = 0;
    let totalSteelAfter = 0;
    let passedCount = 0;

    const validDias = allowedDiameters && allowedDiameters.length > 0 ? allowedDiameters : [12, 16, 20, 25];

    for (const col of columns) {
      const colInfo = columnMapping.get(col.id);
      const res = this.optimizeSingleColumn(col, model, fck, fy, cover, validDias, colInfo);
      results.push(res);

      totalCostBefore += res.originalCost;
      totalCostAfter += res.optimizedCost;
      totalConcBefore += res.concreteVolumeOriginal;
      totalConcAfter += res.concreteVolumeOptimized;
      totalSteelBefore += res.steelWeightOriginal;
      totalSteelAfter += res.steelWeightOptimized;

      if (res.optimizedDesign.status === 'PASS') {
        passedCount++;
      }

      // Check if section changed (including 90-degree rotation)
      if (
        res.optimizedSection.b !== res.originalSection.b ||
        res.optimizedSection.D !== res.originalSection.D
      ) {
        sectionUpdates.push({
          memberId: col.id,
          yd: res.optimizedSection.D / 1000,
          zd: res.optimizedSection.b / 1000,
          name: `${res.optimizedSection.b}x${res.optimizedSection.D} mm`,
        });
      }
    }

    const costSavedPercent =
      totalCostBefore > 0
        ? parseFloat((((totalCostBefore - totalCostAfter) / totalCostBefore) * 100).toFixed(1))
        : 0;
    const concSavedPercent =
      totalConcBefore > 0
        ? parseFloat((((totalConcBefore - totalConcAfter) / totalConcBefore) * 100).toFixed(1))
        : 0;
    const steelSavedPercent =
      totalSteelBefore > 0
        ? parseFloat((((totalSteelBefore - totalSteelAfter) / totalSteelBefore) * 100).toFixed(1))
        : 0;

    return {
      totalColumns: columns.length,
      passedCount,
      concreteVolumeBefore: parseFloat(totalConcBefore.toFixed(3)),
      concreteVolumeAfter: parseFloat(totalConcAfter.toFixed(3)),
      concreteSavedPercent: concSavedPercent,
      steelWeightBefore: parseFloat(totalSteelBefore.toFixed(1)),
      steelWeightAfter: parseFloat(totalSteelAfter.toFixed(1)),
      steelSavedPercent: steelSavedPercent,
      costBefore: parseFloat(totalCostBefore.toFixed(0)),
      costAfter: parseFloat(totalCostAfter.toFixed(0)),
      costSavedPercent: costSavedPercent,
      results,
      sectionUpdates,
      allowedDiameters: validDias,
    };
  }
}
