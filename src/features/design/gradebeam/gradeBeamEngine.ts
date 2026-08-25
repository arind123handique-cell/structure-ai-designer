import { IS13920GradeBeam, GradeBeamCheckInput, GradeBeamCheckOutput } from '@/features/codes/is13920/gradeBeam';
import { DetailedCalculationReport } from '@/features/calculations/types';
import { NormalizedStructuralModel, Support3D } from '@/features/model/types';
import { ColumnNumberingService } from '@/features/model/columnNumbering';

export interface GradeBeamDesignInput {
  gradeBeamId: string; // e.g. "GB-1-2"
  startNodeId: number;
  endNodeId: number;
  startColumnLabel: string;
  endColumnLabel: string;
  startPileCapLabel: string;
  endPileCapLabel: string;
  spanLength: number; // m
  b: number; // mm (default: 300)
  D: number; // mm (default: 450)
  fck: number;
  fy: number;
  factoredPu1: number; // kN (Column 1 reaction)
  factoredPu2: number; // kN (Column 2 reaction)
  wallLoadKnPerM?: number;
  allowedDiameters?: number[];
}

export interface GradeBeamDesignOutput {
  gradeBeamId: string;
  startNodeId: number;
  endNodeId: number;
  startColumnLabel: string;
  endColumnLabel: string;
  startPileCapLabel: string;
  endPileCapLabel: string;
  spanLength: number;
  b: number;
  D: number;
  factoredPu1: number;
  factoredPu2: number;
  factoredTensionTiePu: number;
  factoredDesignMomentMu: number;
  factoredDesignShearVu: number;
  astReqTotal: number;
  topRebarCallout: string;
  bottomRebarCallout: string;
  stirrupCallout: string;
  endZoneSpacing: number;
  midZoneSpacing: number;
  confinementLength: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  calculationReport: DetailedCalculationReport;
}

export class GradeBeamDesignEngine {
  public static design(input: GradeBeamDesignInput): GradeBeamDesignOutput {
    const {
      gradeBeamId,
      startNodeId,
      endNodeId,
      startColumnLabel,
      endColumnLabel,
      startPileCapLabel,
      endPileCapLabel,
      spanLength,
      b,
      D,
      fck,
      fy,
      factoredPu1,
      factoredPu2,
      wallLoadKnPerM,
      allowedDiameters,
    } = input;

    const check = IS13920GradeBeam.design({
      b,
      D,
      spanLength,
      fck,
      fy,
      factoredPu1,
      factoredPu2,
      wallLoadKnPerM,
      allowedDiameters,
    });

    const calculationReport: DetailedCalculationReport = {
      elementId: startNodeId,
      elementType: 'GRADEBEAM',
      title: `IS 13920:2016 GRADE TIE BEAM CALCULATION SHEET — ${gradeBeamId}`,
      designCode: 'IS 13920:2016 & IS 2911:2010',
      governingLoadCase: 1,
      overallStatus: check.status,
      summaryCallout: `${b}×${D}mm | P_tie = ${check.factoredTensionTiePu} kN | Top: ${check.topRebarCallout} | Bot: ${check.bottomRebarCallout}`,
      timestamp: new Date().toISOString(),
      sections: [
        {
          title: '1. IS 13920 Cl. 11.2.2 Minimum Axial Tension & Compression Demand',
          steps: [
            {
              symbol: 'Pu,1 / Pu,2',
              description: 'Connected Pile Cap Axial Reactions',
              formula: 'Max column factored axial reactions',
              substitution: `Pu,1 = ${factoredPu1.toFixed(1)} kN, Pu,2 = ${factoredPu2.toFixed(1)} kN`,
              result: `Max Pu = ${Math.max(factoredPu1, factoredPu2).toFixed(1)} kN`,
            },
            {
              symbol: 'P_tie',
              description: 'Factored Foundation Tension Tie Force',
              formula: 'max(0.10 * max(Pu,1, Pu,2), 100 kN)',
              substitution: `max(0.10 * ${Math.max(factoredPu1, factoredPu2).toFixed(1)}, 100)`,
              result: `${check.factoredTensionTiePu} kN`,
              codeReference: 'IS 13920:2016 Cl. 11.2.2',
            },
          ],
        },
        {
          title: '2. Flexural & Shear Design (Superimposed Wall + Differential Settlement)',
          steps: [
            {
              symbol: 'b × D',
              description: 'Grade Beam Cross Section',
              formula: 'b >= 250 mm, D >= 300 mm',
              substitution: `${b} × ${D} mm (Span = ${spanLength.toFixed(2)} m)`,
              result: `${b} × ${D} mm`,
              codeReference: 'IS 13920:2016 Cl. 11.2.1',
            },
            {
              symbol: 'Mu',
              description: 'Factored Design Bending Moment',
              formula: '(wu * L² / 10) + P_tie * e',
              substitution: `Flexure UDL + Eccentricity Moment`,
              result: `${check.factoredDesignMomentMu} kNm`,
            },
            {
              symbol: 'Vu',
              description: 'Factored Design Shear Force',
              formula: 'wu * L / 2',
              substitution: `Gravity UDL Shear`,
              result: `${check.factoredDesignShearVu} kN`,
            },
          ],
        },
        {
          title: '3. Longitudinal Tension + Bending Reinforcement (IS 13920 Cl. 6.2.1)',
          steps: [
            {
              symbol: 'Ast,req',
              description: 'Required Top & Bottom Steel Area',
              formula: 'max(Ast,flexure + Ast,tension/2, 0.24 * sqrt(fck) / fy * b * d)',
              substitution: `Ast,min = ${check.astMinDuctile} mm²`,
              result: `${check.astReqTotal} mm²`,
            },
            {
              symbol: 'Top Steel',
              description: 'Provided Continuous Top Rebar',
              formula: `${check.throughTopCount}-T${check.throughTopDia}`,
              substitution: `${check.throughTopCount} × ${(Math.PI * check.throughTopDia * check.throughTopDia / 4).toFixed(0)} mm²`,
              result: check.topRebarCallout,
              status: 'PASS',
            },
            {
              symbol: 'Bottom Steel',
              description: 'Provided Continuous Bottom Rebar',
              formula: `${check.throughBottomCount}-T${check.throughBottomDia}`,
              substitution: `${check.throughBottomCount} × ${(Math.PI * check.throughBottomDia * check.throughBottomDia / 4).toFixed(0)} mm²`,
              result: check.bottomRebarCallout,
              status: 'PASS',
            },
          ],
        },
        {
          title: '4. Seismic Confinement Ties (IS 13920:2016 Cl. 11.2.3 & Cl. 6.3.5)',
          steps: [
            {
              symbol: 's_end',
              description: 'End Zone Hoops Spacing (Length = 2D = ' + check.confinementLength + ' mm)',
              formula: 'min(d/4, 8 * db, 100 mm)',
              substitution: `min(${Math.floor(check.d / 4)}, ${8 * Math.min(check.throughTopDia, check.throughBottomDia)}, 100)`,
              result: `${check.endZoneSpacing} mm c/c`,
              codeReference: 'IS 13920:2016 Cl. 6.3.5',
            },
            {
              symbol: 's_mid',
              description: 'Mid Zone Stirrup Spacing',
              formula: 'min(d/2, 12 * db, 200 mm)',
              substitution: `min(${Math.floor(check.d / 2)}, ${12 * Math.min(check.throughTopDia, check.throughBottomDia)}, 200)`,
              result: `${check.midZoneSpacing} mm c/c`,
            },
          ],
        },
      ],
    };

    return {
      gradeBeamId,
      startNodeId,
      endNodeId,
      startColumnLabel,
      endColumnLabel,
      startPileCapLabel,
      endPileCapLabel,
      spanLength,
      b,
      D,
      factoredPu1,
      factoredPu2,
      factoredTensionTiePu: check.factoredTensionTiePu,
      factoredDesignMomentMu: check.factoredDesignMomentMu,
      factoredDesignShearVu: check.factoredDesignShearVu,
      astReqTotal: check.astReqTotal,
      topRebarCallout: check.topRebarCallout,
      bottomRebarCallout: check.bottomRebarCallout,
      stirrupCallout: check.stirrupCallout,
      endZoneSpacing: check.endZoneSpacing,
      midZoneSpacing: check.midZoneSpacing,
      confinementLength: check.confinementLength,
      status: check.status,
      calculationReport,
    };
  }

  /**
   * Generates and designs all Grade Beam tie connections between support pile caps.
   */
  public static discoverAndDesignAll(
    model: NormalizedStructuralModel,
    fck: number = 25,
    fy: number = 500
  ): GradeBeamDesignOutput[] {
    if (!model || !model.supports || model.supports.size === 0) return [];

    const columnMapping = ColumnNumberingService.getColumnSupportMapping(model);
    const supports = Array.from(model.supports.values());

    // Reaction lookup
    const reactionMap = new Map<number, number>();
    for (const r of model.reactions) {
      const cur = reactionMap.get(r.nodeId) || 0;
      if (r.fy > cur) reactionMap.set(r.nodeId, r.fy);
    }

    const results: GradeBeamDesignOutput[] = [];
    const connectedPairs = new Set<string>();

    // 1. Check if model has actual foundation beam members (Y ≈ 0)
    for (const m of model.members.values()) {
      const n1 = model.nodes.get(m.startNodeId);
      const n2 = model.nodes.get(m.endNodeId);
      if (n1 && n2 && Math.abs(n1.y) < 0.1 && Math.abs(n2.y) < 0.1 && model.supports.has(m.startNodeId) && model.supports.has(m.endNodeId)) {
        const pairKey = `${Math.min(m.startNodeId, m.endNodeId)}-${Math.max(m.startNodeId, m.endNodeId)}`;
        connectedPairs.add(pairKey);

        const col1 = columnMapping.get(m.startNodeId);
        const col2 = columnMapping.get(m.endNodeId);
        const pu1 = reactionMap.get(m.startNodeId) || 1200;
        const pu2 = reactionMap.get(m.endNodeId) || 1200;

        const gbId = `GB-${col1?.columnSlNo || m.startNodeId}-${col2?.columnSlNo || m.endNodeId}`;
        const b = Math.max(300, Math.round((m.section.zd || 0.3) * 1000));
        const D = Math.max(450, Math.round((m.section.yd || 0.45) * 1000));

        results.push(
          this.design({
            gradeBeamId: gbId,
            startNodeId: m.startNodeId,
            endNodeId: m.endNodeId,
            startColumnLabel: col1?.columnLabel || `C${m.startNodeId}`,
            endColumnLabel: col2?.columnLabel || `C${m.endNodeId}`,
            startPileCapLabel: col1?.pileCapLabel || `PC-${m.startNodeId}`,
            endPileCapLabel: col2?.pileCapLabel || `PC-${m.endNodeId}`,
            spanLength: parseFloat(m.length.toFixed(2)),
            b,
            D,
            fck,
            fy,
            factoredPu1: pu1,
            factoredPu2: pu2,
          })
        );
      }
    }

    // 2. If no direct foundation members, generate grid tie beams between adjacent pile caps (distance <= 6.5m)
    if (results.length === 0) {
      for (let i = 0; i < supports.length; i++) {
        const s1 = supports[i];
        const n1 = model.nodes.get(s1.nodeId);
        if (!n1) continue;

        for (let j = i + 1; j < supports.length; j++) {
          const s2 = supports[j];
          const n2 = model.nodes.get(s2.nodeId);
          if (!n2) continue;

          const dx = Math.abs(n1.x - n2.x);
          const dz = Math.abs(n1.z - n2.z);
          const dist = Math.sqrt(dx * dx + dz * dz);

          // Connect if adjacent along orthogonal grid lines (dx < 0.2m or dz < 0.2m) and span <= 6.5m
          const isGridAligned = (dx < 0.2 && dz > 0.5 && dz <= 6.5) || (dz < 0.2 && dx > 0.5 && dx <= 6.5);

          if (isGridAligned) {
            const pairKey = `${Math.min(s1.nodeId, s2.nodeId)}-${Math.max(s1.nodeId, s2.nodeId)}`;
            if (!connectedPairs.has(pairKey)) {
              connectedPairs.add(pairKey);

              const col1 = columnMapping.get(s1.nodeId);
              const col2 = columnMapping.get(s2.nodeId);
              const pu1 = reactionMap.get(s1.nodeId) || 1350;
              const pu2 = reactionMap.get(s2.nodeId) || 1350;

              const gbId = `GB-${col1?.columnSlNo || s1.nodeId}-${col2?.columnSlNo || s2.nodeId}`;
              const spanLength = parseFloat(dist.toFixed(2));
              const b = 300;
              const D = spanLength >= 4.5 ? 500 : 450;

              results.push(
                this.design({
                  gradeBeamId: gbId,
                  startNodeId: s1.nodeId,
                  endNodeId: s2.nodeId,
                  startColumnLabel: col1?.columnLabel || `C${s1.nodeId}`,
                  endColumnLabel: col2?.columnLabel || `C${s2.nodeId}`,
                  startPileCapLabel: col1?.pileCapLabel || `PC-${s1.nodeId}`,
                  endPileCapLabel: col2?.pileCapLabel || `PC-${s2.nodeId}`,
                  spanLength,
                  b,
                  D,
                  fck,
                  fy,
                  factoredPu1: pu1,
                  factoredPu2: pu2,
                })
              );
            }
          }
        }
      }
    }

    return results;
  }
}
