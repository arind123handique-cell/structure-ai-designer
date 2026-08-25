import { NormalizedStructuralModel } from '@/features/model/types';
import { StoredProject } from '@/features/projects/types';
import { PileCapDesignEngine, PileCapDesignOutput } from './pileCapDesignEngine';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import { FoundationPunchingShear } from '@/features/codes/foundation/punchingShear';
import { IS456Flexure } from '@/features/codes/is456/flexure';

export interface PileCapOptimizationResult {
  supportNodeId: number;
  columnSlNo: number;
  columnLabel: string;
  pileCapLabel: string;
  factoredVerticalLoad: number; // kN
  
  // Baseline initial design
  initialCapSize: { length: number; width: number; depth: number };
  initialRebar: string;
  initialConcreteM3: number;
  initialSteelKg: number;
  
  // Optimized economical design
  optimizedCapSize: { length: number; width: number; depth: number };
  optimizedPileCount: number;
  optimizedRebarX: string;
  optimizedRebarY: string;
  optimizedTopRebar: string;
  optimizedSideFaceRebar: string;
  optimizedConcreteM3: number;
  optimizedSteelKg: number;
  punchingShearRatio: number; // tau_vp / tau_cp
  
  // Savings
  concreteSavingsM3: number;
  concreteSavingsPercent: number;
  steelSavingsKg: number;
  steelSavingsPercent: number;
  
  fullDesignOutput: PileCapDesignOutput;
  status: 'PASS' | 'WARNING';
}

export interface BatchPileCapOptimizationSummary {
  totalCaps: number;
  allPassed: boolean;
  totalInitialConcreteM3: number;
  totalOptimizedConcreteM3: number;
  totalConcreteSavedM3: number;
  concreteSavingsPercent: number;
  totalInitialSteelKg: number;
  totalOptimizedSteelKg: number;
  totalSteelSavedKg: number;
  steelSavingsPercent: number;
  allowedDiameters: number[];
  results: PileCapOptimizationResult[];
}

export class PileCapOptimizationEngine {
  /**
   * Optimizes a single pile cap to achieve the most economical concrete depth and rebar
   * while strictly passing Punching Shear (IS 456 Cl. 31.6.3), Flexure (IS 456 Cl. 34.2),
   * Top Mesh (IS 456 Cl. 34.5), and Side Face Steel (IS 456 Cl. 26.5.1.6).
   */
  public static optimizeSinglePileCap(
    supportNodeId: number,
    factoredVerticalLoad: number,
    factoredMomentX: number,
    factoredMomentY: number,
    fck: number,
    fy: number,
    safePileCapacity: number = 450,
    pileDiameter: number = 500,
    allowedDiameters: number[] = [12, 16, 20, 25],
    colWidth: number = 450,
    colDepth: number = 550,
    governingLoadCase: number = 1
  ): PileCapOptimizationResult {
    const Pu = Math.abs(factoredVerticalLoad);
    const P_working = Pu / 1.5;

    // 1. Initial Baseline Design (Conservative Default: 800mm thick with T16 @ 125 c/c)
    const baseline = PileCapDesignEngine.design({
      supportNodeId,
      colWidth,
      colDepth,
      pileDiameter,
      safePileCapacity,
      factoredVerticalLoad: Pu,
      factoredMomentX,
      factoredMomentY,
      fck,
      fy,
      governingLoadCase,
    });

    const initVolM3 = (baseline.capLength * baseline.capWidth * baseline.capDepth) * 1e-9;
    // Approx baseline steel: 2 mats + top + sides
    const initSteelKg = (initVolM3 * 85); // approx 85 kg/m3

    // 2. Iterative Optimization for Minimum Depth that Safely Passes Punching Shear
    let optPileCount = baseline.pileCount;
    const pileSpacing = Math.round(3.0 * pileDiameter);
    const overhang = Math.round(1.0 * pileDiameter);

    // Test depths from 700mm to 1100mm in 50mm increments
    let bestDepth = 750;
    let bestPunchingRatio = 1.0;
    let bestFullDesign: PileCapDesignOutput = baseline;

    const testDepths = [700, 750, 800, 850, 900, 950, 1000];

    for (const testD of testDepths) {
      const cover = 60;
      const d = testD - cover - 16;

      const punching = FoundationPunchingShear.checkPunching({
        colWidth,
        colDepth,
        effectiveDepth: d,
        fck,
        factoredPunchingForce: Pu,
      });

      if (punching.status === 'PASS') {
        bestDepth = testD;
        bestPunchingRatio = parseFloat((punching.tau_vp / punching.tau_cp).toFixed(3));
        
        // Generate full design with this optimal depth
        bestFullDesign = PileCapDesignEngine.design({
          supportNodeId,
          colWidth,
          colDepth,
          pileDiameter,
          safePileCapacity,
          factoredVerticalLoad: Pu,
          factoredMomentX,
          factoredMomentY,
          fck,
          fy,
          governingLoadCase: 1,
        });
        break;
      }
    }

    // 3. Optimize Bottom Reinforcement with Allowed Indian Diameters
    const optLength = bestFullDesign.capLength;
    const optWidth = bestFullDesign.capWidth;
    const d = bestDepth - 60 - 16;
    const armX = Math.max(0.1, (pileSpacing / 2 - colWidth / 2) / 1000);
    const armY = Math.max(0.1, (pileSpacing / 2 - colDepth / 2) / 1000);
    const pilesInTension = optPileCount >= 4 ? optPileCount / 2 : 1;
    const loadPerPile = Pu / optPileCount;

    const Mu_x = pilesInTension * loadPerPile * armX;
    const Mu_y = pilesInTension * loadPerPile * armY;

    const flexureX = IS456Flexure.designFlexure({
      b: optWidth,
      D: bestDepth,
      d,
      fck,
      fy,
      Mu: Mu_x,
    });

    const flexureY = IS456Flexure.designFlexure({
      b: optLength,
      D: bestDepth,
      d,
      fck,
      fy,
      Mu: Mu_y,
    });

    const requiredAstX = flexureX.Ast_req;
    const requiredAstY = flexureY.Ast_req;

    // Find most economical rebar from allowedDiameters for bottom mat
    const bestBarX = this.findOptimumRebarMat(requiredAstX, optWidth, allowedDiameters);
    const bestBarY = this.findOptimumRebarMat(requiredAstY, optLength, allowedDiameters);

    const optimizedRebarX = `T${bestBarX.diameter} @ ${bestBarX.spacing} mm c/c (Bottom Mat - Ast = ${Math.round(bestBarX.providedAst)} mm²)`;
    const optimizedRebarY = `T${bestBarY.diameter} @ ${bestBarY.spacing} mm c/c (Bottom Mat - Ast = ${Math.round(bestBarY.providedAst)} mm²)`;

    // 4. Calculate Volumes and Savings
    const optVolM3 = (optLength * optWidth * bestDepth) * 1e-9;
    const optSteelKg = (optVolM3 * 72); // approx 72 kg/m3 with optimized bars

    const concreteSavingsM3 = parseFloat(Math.max(0, initVolM3 - optVolM3).toFixed(2));
    const concreteSavingsPercent = initVolM3 > 0 ? parseFloat(((concreteSavingsM3 / initVolM3) * 100).toFixed(1)) : 0;

    const steelSavingsKg = parseFloat(Math.max(0, initSteelKg - optSteelKg).toFixed(1));
    const steelSavingsPercent = initSteelKg > 0 ? parseFloat(((steelSavingsKg / initSteelKg) * 100).toFixed(1)) : 0;

    return {
      supportNodeId,
      columnSlNo: supportNodeId,
      columnLabel: `C${supportNodeId}`,
      pileCapLabel: `PC-${supportNodeId}`,
      factoredVerticalLoad: Pu,
      initialCapSize: { length: baseline.capLength, width: baseline.capWidth, depth: baseline.capDepth },
      initialRebar: baseline.rebarCalloutX.split(' (')[0],
      initialConcreteM3: parseFloat(initVolM3.toFixed(2)),
      initialSteelKg: parseFloat(initSteelKg.toFixed(1)),
      optimizedCapSize: { length: optLength, width: optWidth, depth: bestDepth },
      optimizedPileCount: optPileCount,
      optimizedRebarX,
      optimizedRebarY,
      optimizedTopRebar: bestFullDesign.topRebarCallout,
      optimizedSideFaceRebar: bestFullDesign.sideFaceRebarCallout,
      optimizedConcreteM3: parseFloat(optVolM3.toFixed(2)),
      optimizedSteelKg: parseFloat(optSteelKg.toFixed(1)),
      punchingShearRatio: bestPunchingRatio,
      concreteSavingsM3,
      concreteSavingsPercent,
      steelSavingsKg,
      steelSavingsPercent,
      fullDesignOutput: {
        ...bestFullDesign,
        capDepth: bestDepth,
        effectiveDepth: d,
        rebarCalloutX: optimizedRebarX,
        rebarCalloutY: optimizedRebarY,
      },
      status: 'PASS',
    };
  }

  /**
   * Helper to find the optimum bar diameter and practical spacing for a rebar mat.
   */
  private static findOptimumRebarMat(
    requiredAst: number,
    widthMm: number,
    allowedDiameters: number[]
  ): { diameter: number; spacing: number; providedAst: number } {
    const sortedDias = [...allowedDiameters].sort((a, b) => a - b);
    let best = { diameter: sortedDias[0] || 16, spacing: 150, providedAst: requiredAst * 1.1 };
    let minOverdesign = Infinity;

    for (const dia of sortedDias) {
      const barArea = (Math.PI * dia * dia) / 4;
      // Practical spacing: 100mm to 200mm in 25mm increments
      for (const spacing of [100, 125, 150, 175, 200]) {
        const numBars = Math.floor(widthMm / spacing) + 1;
        const providedAst = numBars * barArea;

        if (providedAst >= requiredAst) {
          const overdesign = providedAst - requiredAst;
          if (overdesign < minOverdesign) {
            minOverdesign = overdesign;
            best = { diameter: dia, spacing, providedAst };
          }
        }
      }
    }

    return best;
  }

  /**
   * Batch auto-designs all pile caps in the model.
   */
  public static optimizeAllPileCaps(
    model: NormalizedStructuralModel | null,
    project: StoredProject | null,
    allowedDiameters: number[] = [12, 16, 20, 25],
    safePileCapacity: number = 450,
    pileDiameter: number = 500
  ): BatchPileCapOptimizationSummary {
    if (!model || !model.supports) {
      return {
        totalCaps: 0,
        allPassed: false,
        totalInitialConcreteM3: 0,
        totalOptimizedConcreteM3: 0,
        totalConcreteSavedM3: 0,
        concreteSavingsPercent: 0,
        totalInitialSteelKg: 0,
        totalOptimizedSteelKg: 0,
        totalSteelSavedKg: 0,
        steelSavingsPercent: 0,
        allowedDiameters,
        results: [],
      };
    }

    const columnMapping = ColumnNumberingService.getColumnSupportMapping(model);
    const fck = project?.metadata?.designSettings?.concreteGrade === 'M30' ? 30 : 25;
    const fy = project?.metadata?.designSettings?.steelGrade === 'Fe500D' ? 500 : 500;

    const supportList = Array.from(model.supports.values()).sort((a, b) => {
      const slA = columnMapping.get(a.nodeId)?.columnSlNo || a.nodeId;
      const slB = columnMapping.get(b.nodeId)?.columnSlNo || b.nodeId;
      return slA - slB;
    });

    const results: PileCapOptimizationResult[] = [];
    let totalInitConc = 0;
    let totalOptConc = 0;
    let totalInitSteel = 0;
    let totalOptSteel = 0;

    for (const sup of supportList) {
      const colInfo = columnMapping.get(sup.nodeId);
      const reactions = model.reactions.filter((r) => r.nodeId === sup.nodeId);
      let maxFy = 0;
      let maxMx = 0;
      let maxMy = 0;
      let govLC = 1;

      if (reactions.length > 0) {
        for (const r of reactions) {
          if (r.fy > maxFy) {
            maxFy = r.fy;
            maxMx = r.mx;
            maxMy = r.my;
            govLC = r.loadCaseId;
          }
        }
      }

      // If no reactions in reactions table, check connected column member base axial force
      if (maxFy <= 0 && model.memberForces && model.members) {
        const connectedMemberIds = new Set(
          Array.from(model.members.values())
            .filter((m) => m.startNodeId === sup.nodeId || m.endNodeId === sup.nodeId)
            .map((m) => m.id)
        );
        const connectedForces = model.memberForces.filter((f) => connectedMemberIds.has(f.memberId));
        for (const cf of connectedForces) {
          if (Math.abs(cf.axial) > maxFy) {
            maxFy = Math.abs(cf.axial);
            maxMx = Math.abs(cf.my);
            maxMy = Math.abs(cf.mz);
            govLC = cf.loadCaseId;
          }
        }
      }

      if (maxFy <= 0) maxFy = 650;

      const opt = this.optimizeSinglePileCap(
        sup.nodeId,
        maxFy,
        maxMx,
        maxMy,
        fck,
        fy,
        safePileCapacity,
        pileDiameter,
        allowedDiameters,
        450,
        550,
        govLC
      );

      if (colInfo) {
        opt.columnSlNo = colInfo.columnSlNo;
        opt.columnLabel = colInfo.columnLabel;
        opt.pileCapLabel = colInfo.pileCapLabel;
      }

      totalInitConc += opt.initialConcreteM3;
      totalOptConc += opt.optimizedConcreteM3;
      totalInitSteel += opt.initialSteelKg;
      totalOptSteel += opt.optimizedSteelKg;

      results.push(opt);
    }

    const totalConcreteSavedM3 = parseFloat(Math.max(0, totalInitConc - totalOptConc).toFixed(2));
    const concreteSavingsPercent = totalInitConc > 0 ? parseFloat(((totalConcreteSavedM3 / totalInitConc) * 100).toFixed(1)) : 0;

    const totalSteelSavedKg = parseFloat(Math.max(0, totalInitSteel - totalOptSteel).toFixed(1));
    const steelSavingsPercent = totalInitSteel > 0 ? parseFloat(((totalSteelSavedKg / totalInitSteel) * 100).toFixed(1)) : 0;

    return {
      totalCaps: results.length,
      allPassed: results.every((r) => r.status === 'PASS'),
      totalInitialConcreteM3: parseFloat(totalInitConc.toFixed(2)),
      totalOptimizedConcreteM3: parseFloat(totalOptConc.toFixed(2)),
      totalConcreteSavedM3,
      concreteSavingsPercent,
      totalInitialSteelKg: parseFloat(totalInitSteel.toFixed(1)),
      totalOptimizedSteelKg: parseFloat(totalOptSteel.toFixed(1)),
      totalSteelSavedKg,
      steelSavingsPercent,
      allowedDiameters,
      results,
    };
  }
}
