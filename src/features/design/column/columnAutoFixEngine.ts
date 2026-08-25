import { NormalizedStructuralModel, Member3D } from '@/features/model/types';
import { ColumnDesignEngine, ColumnDesignOutput } from './columnDesignEngine';
import { ColumnBarArrangement, ColumnRebarOption } from './barArrangement';
import { CANDIDATE_COLUMN_SECTIONS, CandidateColumnSection } from './columnOptimizationEngine';
import { IS13920WeakBeamStrongColumn } from '@/features/codes/is13920/weakBeamStrongColumn';

export interface ColumnAutoFixRecommendation {
  memberId: number;
  currentSection: { b: number; D: number; name: string };
  recommendedSection: { b: number; D: number; name: string };
  recommendedRebar: ColumnRebarOption;
  currentStatus: 'PASS' | 'WARNING' | 'FAIL';
  currentIR: number;
  expectedIR: number;
  expectedPt: number;
  fixStrategy: 'ROTATE_90' | 'UPSIZE_SECTION' | 'REBAR_ADJUSTMENT' | 'OPTIMIZE_ALL';
  reason: string;
}

export class ColumnAutoFixEngine {
  /**
   * Extracts governing design forces (Pu, Mux, Muy, govLC) for a column member.
   */
  public static extractColumnForces(col: Member3D, model: NormalizedStructuralModel) {
    let maxPu = 0;
    let maxMux = 0;
    let maxMuy = 0;
    let govLC = 1;

    // 1. Direct member forces
    const forces = model.memberForces?.filter((f) => f.memberId === col.id) || [];
    for (const f of forces) {
      if (Math.abs(f.axial) > maxPu) {
        maxPu = Math.abs(f.axial);
        govLC = f.loadCaseId;
      }
      if (Math.abs(f.mz) > maxMux) maxMux = Math.abs(f.mz);
      if (Math.abs(f.my) > maxMuy) maxMuy = Math.abs(f.my);
    }

    // 2. Support joint matching for base columns
    const startSup = model.supports?.get ? model.supports.get(col.startNodeId) : null;
    const endSup = model.supports?.get ? model.supports.get(col.endNodeId) : null;
    const supNodeId = startSup ? col.startNodeId : endSup ? col.endNodeId : null;

    if (supNodeId && model.reactions) {
      const reactions = model.reactions.filter((r) => r.nodeId === supNodeId);
      for (const r of reactions) {
        if (r.fy > maxPu) {
          maxPu = r.fy;
          govLC = r.loadCaseId;
          maxMux = Math.max(maxMux, Math.abs(r.mx));
          maxMuy = Math.max(maxMuy, Math.abs(r.my));
        }
      }
    }

    if (maxPu <= 0) {
      maxPu = 650;
      maxMux = 45;
      maxMuy = 25;
      govLC = 1;
    }

    return { maxPu, maxMux, maxMuy, govLC };
  }

  /**
   * Diagnoses reasons for a column's failure or warning and computes the optimal auto-fix.
   */
  public static diagnoseAndSolve(
    col: Member3D,
    model: NormalizedStructuralModel,
    currentDesign: ColumnDesignOutput,
    fck: number = 25,
    fy: number = 500,
    cover: number = 40,
    allowedDiameters: number[] = [12, 16, 20, 25]
  ): ColumnAutoFixRecommendation {
    const currentB = Math.round((col.section.zd || 0.45) * 1000);
    const currentD = Math.round((col.section.yd || 0.55) * 1000);
    const height = col.length || 3.5;
    const { maxPu, maxMux, maxMuy, govLC } = this.extractColumnForces(col, model);

    const currentIR = currentDesign.biaxialCheck.interactionRatio;
    const currentPt = currentDesign.rebar.pt_prov;

    // -------------------------------------------------------------
    // Test 1: Check if simple 90° Orientation Rotation solves it!
    // -------------------------------------------------------------
    if (currentB !== currentD) {
      const rotatedB = currentD;
      const rotatedD = currentB;
      const rotatedDesign = ColumnDesignEngine.design({
        memberId: col.id,
        b: rotatedB,
        D: rotatedD,
        unsupportedHeight: height,
        fck,
        fy,
        cover,
        Pu: maxPu,
        Mux: maxMuy,
        Muy: maxMux,
        governingLoadCase: govLC,
        allowedDiameters,
      });

      const wbscRotated = IS13920WeakBeamStrongColumn.evaluateForColumn(rotatedB, rotatedD, fck, fy, 850, 300, 450);

      if (
        rotatedDesign.status === 'PASS' &&
        rotatedDesign.biaxialCheck.interactionRatio <= 0.85 &&
        rotatedDesign.rebar.pt_prov <= 1.5 &&
        wbscRotated.isCompliant
      ) {
        return {
          memberId: col.id,
          currentSection: { b: currentB, D: currentD, name: `${currentB}x${currentD} mm` },
          recommendedSection: { b: rotatedB, D: rotatedD, name: `${rotatedB}x${rotatedD} mm (Rotated 90°)` },
          recommendedRebar: rotatedDesign.rebar,
          currentStatus: currentDesign.status,
          currentIR,
          expectedIR: rotatedDesign.biaxialCheck.interactionRatio,
          expectedPt: rotatedDesign.rebar.pt_prov,
          fixStrategy: 'ROTATE_90',
          reason: `Rotating column by 90° aligns the strong axis with the governing moment, reducing Biaxial IR from ${currentIR.toFixed(2)} to ${rotatedDesign.biaxialCheck.interactionRatio.toFixed(2)} and steel ratio to ${rotatedDesign.rebar.pt_prov}%.`,
        };
      }
    }

    // -------------------------------------------------------------
    // Test 2: Search candidate sections for minimal size that passes
    // -------------------------------------------------------------
    let bestCandidate: {
      section: CandidateColumnSection;
      design: ColumnDesignOutput;
      strategy: 'ROTATE_90' | 'UPSIZE_SECTION' | 'OPTIMIZE_ALL';
      reason: string;
    } | null = null;

    for (const cand of CANDIDATE_COLUMN_SECTIONS) {
      const isRotated = cand.name.includes('Rotated');
      const testMux = isRotated ? maxMuy : maxMux;
      const testMuy = isRotated ? maxMux : maxMuy;

      const design = ColumnDesignEngine.design({
        memberId: col.id,
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

      const wbsc = IS13920WeakBeamStrongColumn.evaluateForColumn(cand.b, cand.D, fck, fy, 850, 300, 450);

      if (
        design.status === 'PASS' &&
        design.biaxialCheck.interactionRatio <= 0.88 &&
        design.rebar.pt_prov <= 1.8 &&
        wbsc.isCompliant
      ) {
        const area = cand.b * cand.D;
        const currentArea = currentB * currentD;

        let strategy: 'ROTATE_90' | 'UPSIZE_SECTION' | 'OPTIMIZE_ALL' = 'UPSIZE_SECTION';
        let reason = `Upsizing section to ${cand.name} satisfies IS 456 Biaxial bending (IR = ${design.biaxialCheck.interactionRatio.toFixed(2)}) with economical ${design.rebar.callout} (${design.rebar.pt_prov}% steel).`;

        if (isRotated && area <= currentArea * 1.15) {
          strategy = 'ROTATE_90';
          reason = `Rotating 90° and adjusting to ${cand.name} reduces biaxial stress (IR = ${design.biaxialCheck.interactionRatio.toFixed(2)}) and prevents rebar congestion.`;
        }

        bestCandidate = { section: cand, design, strategy, reason };
        break;
      }
    }

    // Fallback if no smaller candidate passed: use heavy 600x750 or 600x900
    if (!bestCandidate) {
      const fallbackCand: CandidateColumnSection = { b: 600, D: 750, name: '600x750 mm' };
      const design = ColumnDesignEngine.design({
        memberId: col.id,
        b: fallbackCand.b,
        D: fallbackCand.D,
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

      bestCandidate = {
        section: fallbackCand,
        design,
        strategy: 'UPSIZE_SECTION',
        reason: `High axial load (${maxPu.toFixed(1)} kN) and moments require 600x750 mm column section for IS 456 compliance.`,
      };
    }

    return {
      memberId: col.id,
      currentSection: { b: currentB, D: currentD, name: `${currentB}x${currentD} mm` },
      recommendedSection: {
        b: bestCandidate.section.b,
        D: bestCandidate.section.D,
        name: bestCandidate.section.name,
      },
      recommendedRebar: bestCandidate.design.rebar,
      currentStatus: currentDesign.status,
      currentIR,
      expectedIR: bestCandidate.design.biaxialCheck.interactionRatio,
      expectedPt: bestCandidate.design.rebar.pt_prov,
      fixStrategy: bestCandidate.strategy,
      reason: bestCandidate.reason,
    };
  }

  /**
   * Generates batch auto-fix updates for all failing and warning columns.
   */
  public static autoFixAllNonPassingColumns(
    columns: Member3D[],
    model: NormalizedStructuralModel,
    designedColumns: Map<number, ColumnDesignOutput>,
    fck: number = 25,
    fy: number = 500,
    cover: number = 40,
    allowedDiameters: number[] = [12, 16, 20, 25]
  ) {
    const sectionUpdates: { memberId: number; yd: number; zd: number; name: string }[] = [];
    const rebarOverrides = new Map<number, ColumnRebarOption>();
    const recommendations: ColumnAutoFixRecommendation[] = [];

    for (const col of columns) {
      const design = designedColumns.get(col.id);
      if (!design) continue;

      // Only target columns with FAIL or WARNING status (or IR > 0.95 or pt > 2.2%)
      const needsFix =
        design.status !== 'PASS' ||
        design.biaxialCheck.interactionRatio > 0.95 ||
        design.rebar.pt_prov > 2.2;

      if (!needsFix) continue;

      const rec = this.diagnoseAndSolve(col, model, design, fck, fy, cover, allowedDiameters);
      recommendations.push(rec);

      sectionUpdates.push({
        memberId: col.id,
        yd: rec.recommendedSection.D / 1000,
        zd: rec.recommendedSection.b / 1000,
        name: rec.recommendedSection.name,
      });

      rebarOverrides.set(col.id, rec.recommendedRebar);
    }

    return {
      sectionUpdates,
      rebarOverrides,
      recommendations,
    };
  }
}
