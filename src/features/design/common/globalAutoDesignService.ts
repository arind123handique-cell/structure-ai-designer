import { NormalizedStructuralModel } from '@/features/model/types';
import { BeamOptimizationEngine } from '@/features/design/beam/beamOptimizationEngine';
import { ColumnOptimizationEngine } from '@/features/design/column/columnOptimizationEngine';
import { PileCapOptimizationEngine } from '@/features/design/pilecap/pileCapOptimizationEngine';

export interface GlobalAutoDesignSummary {
  totalBeams: number;
  totalColumns: number;
  totalPileCaps: number;
  totalNodes: number;
  beamUpdates: { memberId: number; yd: number; zd: number; name: string }[];
  columnUpdates: { memberId: number; yd: number; zd: number; name: string }[];
  concreteVolumeBefore: number; // m3
  concreteVolumeAfter: number; // m3
  concreteSavedPercent: number;
  steelWeightBefore: number; // kg
  steelWeightAfter: number; // kg
  steelSavedPercent: number;
  costBefore: number; // INR
  costAfter: number; // INR
  costSavedPercent: number;
}

export class GlobalAutoDesignService {
  /**
   * Runs holistic project-wide economical auto-design and auto-fix across Beams, Columns, and Pile Caps.
   */
  public static runGlobalAutoDesign(
    model: NormalizedStructuralModel,
    concreteGrade: string = 'M25',
    steelGrade: string = 'Fe500D',
    safePileCapacity: number = 450,
    pileDiameter: number = 500
  ): GlobalAutoDesignSummary {
    const fck = concreteGrade === 'M30' ? 30 : 25;
    const fy = steelGrade === 'Fe500D' ? 500 : 500;

    const beams = Array.from(model.members.values()).filter((m) => m.classification === 'BEAM');
    const columns = Array.from(model.members.values()).filter((m) => m.classification === 'COLUMN');
    const supportNodes = Array.from(model.supports.values());

    // 1. Optimize All Beams (Target uncrowded single-layer 2-T16 top / 3-T16 bottom)
    const beamSummary = BeamOptimizationEngine.optimizeAllBeams(
      beams,
      model,
      fck,
      fy,
      30,
      [12, 16, 20, 25],
      230 // preferred width 230mm for residential G+3/G+4
    );

    // 2. Optimize All Columns (Target 0.8% - 1.2% practical steel 6-T16 / 8-T16 / 4-T20+4-T16)
    const columnSummary = ColumnOptimizationEngine.optimizeAllColumns(
      columns,
      model,
      fck,
      fy,
      40,
      [12, 16, 20, 25]
    );

    // 3. Optimize All Pile Caps (Based on 1.10 * P_working / Qsafe and punching shear)
    const pileCapSummary = PileCapOptimizationEngine.optimizeAllPileCaps(
      model,
      null,
      [12, 16, 20, 25],
      safePileCapacity,
      pileDiameter
    );

    const totalConcreteBefore = parseFloat(
      (beamSummary.concreteVolumeBefore + columnSummary.concreteVolumeBefore + pileCapSummary.totalInitialConcreteM3).toFixed(2)
    );
    const totalConcreteAfter = parseFloat(
      (beamSummary.concreteVolumeAfter + columnSummary.concreteVolumeAfter + pileCapSummary.totalOptimizedConcreteM3).toFixed(2)
    );
    const concreteSavedPercent = totalConcreteBefore > 0
      ? parseFloat((((totalConcreteBefore - totalConcreteAfter) / totalConcreteBefore) * 100).toFixed(1))
      : 0;

    const totalSteelBefore = parseFloat(
      (beamSummary.steelWeightBefore + columnSummary.steelWeightBefore + pileCapSummary.totalInitialSteelKg).toFixed(1)
    );
    const totalSteelAfter = parseFloat(
      (beamSummary.steelWeightAfter + columnSummary.steelWeightAfter + pileCapSummary.totalOptimizedSteelKg).toFixed(1)
    );
    const steelSavedPercent = totalSteelBefore > 0
      ? parseFloat((((totalSteelBefore - totalSteelAfter) / totalSteelBefore) * 100).toFixed(1))
      : 0;

    const pileCapCostBefore = pileCapSummary.totalInitialConcreteM3 * 6500 + pileCapSummary.totalInitialSteelKg * 75;
    const pileCapCostAfter = pileCapSummary.totalOptimizedConcreteM3 * 6500 + pileCapSummary.totalOptimizedSteelKg * 75;

    const totalCostBefore = beamSummary.costBefore + columnSummary.costBefore + pileCapCostBefore;
    const totalCostAfter = beamSummary.costAfter + columnSummary.costAfter + pileCapCostAfter;
    const costSavedPercent = totalCostBefore > 0
      ? parseFloat((((totalCostBefore - totalCostAfter) / totalCostBefore) * 100).toFixed(1))
      : 0;

    return {
      totalBeams: beams.length,
      totalColumns: columns.length,
      totalPileCaps: supportNodes.length,
      totalNodes: model.nodes.size,
      beamUpdates: beamSummary.sectionUpdates,
      columnUpdates: columnSummary.sectionUpdates,
      concreteVolumeBefore: totalConcreteBefore,
      concreteVolumeAfter: totalConcreteAfter,
      concreteSavedPercent,
      steelWeightBefore: totalSteelBefore,
      steelWeightAfter: totalSteelAfter,
      steelSavedPercent,
      costBefore: totalCostBefore,
      costAfter: totalCostAfter,
      costSavedPercent,
    };
  }
}
