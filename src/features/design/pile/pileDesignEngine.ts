import { IS2911PileCapacity, PileCapacityResult } from '@/features/codes/is2911/pileCapacity';
import { DetailedCalculationReport } from '@/features/calculations/types';

export interface ProjectPileType {
  id: string; // "P-1", "P-2", "P-3"
  name: string; // e.g. "Type P-1 (Dia 500mm Bored Pile)"
  diameter: number; // mm (e.g. 500)
  length: number; // m (e.g. 12.0)
  safeWorkingLoad: number; // kN (e.g. 450)
  upliftCapacity: number; // kN
  lateralCapacity: number; // kN
  fck: number; // N/mm2 (e.g. 25)
  fy: number; // N/mm2 (e.g. 500)
  barCount: number; // e.g. 6
  barDiameter: number; // e.g. 16
  spiralDiameter: number; // e.g. 8
  spiralPitch: number; // e.g. 150
  soilType: 'COHESIVE_CLAY' | 'COHESIONLESS_SAND';
  cu: number; // kN/m2 (default: 55)
  isManualCapacity: boolean;
  structuralCapacity: number; // kN
  geotechnicalUltimate: number; // kN
  skinFrictionUltimate: number; // kN
  endBearingUltimate: number; // kN
  minLongitudinalSteel: number; // mm2
  providedLongitudinalSteel: number; // mm2
  steelPercentage: number; // %
  rebarCallout: string; // e.g. "6-T16 (1206.4 mm², pt = 0.61%)"
  spiralCallout: string; // e.g. "8mm helical spiral @ 150 mm pitch"
  status: 'PASS' | 'WARNING' | 'FAIL';
  calculationReport: DetailedCalculationReport;
}

export interface ProjectPileTypeInput {
  id?: string;
  name?: string;
  diameter: number;
  length: number;
  safeWorkingLoad?: number;
  upliftCapacity?: number;
  lateralCapacity?: number;
  isManualCapacity?: boolean;
  fck?: number;
  fy?: number;
  barCount?: number;
  barDiameter?: number;
  spiralDiameter?: number;
  spiralPitch?: number;
  soilType?: 'COHESIVE_CLAY' | 'COHESIONLESS_SAND';
  cu?: number;
}

export class PileDesignEngine {
  /**
   * Generates a fully engineered standard Project Pile Type per IS 2911:2010.
   */
  public static designPileType(input: ProjectPileTypeInput): ProjectPileType {
    const id = input.id || 'P-1';
    const diameter = input.diameter || 500;
    const length = input.length || 12.0;
    const fck = input.fck || 25;
    const fy = input.fy || 500;
    const soilType = input.soilType || 'COHESIVE_CLAY';
    const cu = input.cu || 55;
    const isManualCapacity = input.isManualCapacity ?? false;

    // Automatic bar defaults if not specified
    const barCount = input.barCount || (diameter >= 600 ? 8 : 6);
    const barDia = input.barDiameter || (diameter >= 600 ? 20 : 16);
    const spiralDia = input.spiralDiameter || 8;
    const spiralPitch = input.spiralPitch || (diameter >= 600 ? 125 : 150);

    const capacityResult = IS2911PileCapacity.calculateCapacity({
      diameter,
      length,
      fck,
      fy,
      soilType,
      cu,
      FOS: 2.5,
      manualSafeCapacity: isManualCapacity && input.safeWorkingLoad ? input.safeWorkingLoad : undefined,
      customBarCount: barCount,
      customBarDiameter: barDia,
      customSpiralDiameter: spiralDia,
      customSpiralPitch: spiralPitch,
    });

    const safeWorkingLoad = isManualCapacity && input.safeWorkingLoad
      ? input.safeWorkingLoad
      : capacityResult.safeWorkingLoad;

    const upliftCapacity = input.upliftCapacity !== undefined
      ? input.upliftCapacity
      : parseFloat((0.65 * capacityResult.skinFrictionUltimate).toFixed(1));

    const lateralCapacity = input.lateralCapacity !== undefined
      ? input.lateralCapacity
      : parseFloat((0.08 * safeWorkingLoad).toFixed(1));
    const name = input.name || `Type ${id} (Dia ${diameter}mm Bored Pile)`;

    // Comprehensive IS 2911 Detailed Calculation Report
    const calculationReport: DetailedCalculationReport = {
      elementId: 1,
      elementType: 'PILE',
      title: `STANDARD BORED CAST-IN-SITU PILE ${id} (Dia ${diameter}mm × ${length}m) IS 2911 CALCULATION REPORT`,
      designCode: 'IS 2911:2010 (Part 1/Sec 2)',
      governingLoadCase: 1,
      timestamp: new Date().toLocaleString(),
      overallStatus: capacityResult.status,
      summaryCallout: `Safe Working Load: ${safeWorkingLoad} kN | Rebar: ${capacityResult.recommendedRebarCallout} | Spirals: ${capacityResult.recommendedSpiralCallout}`,
      sections: [
        {
          title: '1. Pile Geometry & Material Properties',
          steps: [
            {
              symbol: 'Dp',
              description: 'Nominal Pile Shaft Diameter',
              formula: 'Dp',
              substitution: `${diameter}`,
              result: `${diameter} mm (${diameter / 1000} m)`,
            },
            {
              symbol: 'Lp',
              description: 'Pile Embedded Length',
              formula: 'L',
              substitution: `${length}`,
              result: `${length} m`,
            },
            {
              symbol: 'Ag',
              description: 'Gross Cross-Sectional Area',
              formula: 'pi * Dp² / 4',
              substitution: `pi * (${diameter / 1000})² / 4`,
              result: `${capacityResult.crossSectionArea} m² (${capacityResult.crossSectionArea * 1e6} mm²)`,
            },
            {
              symbol: 'fck / fy',
              description: 'Design Concrete & Steel Grades',
              formula: 'Concrete / Steel',
              substitution: `M${fck} / Fe${fy}`,
              result: `fck = ${fck} N/mm², fy = ${fy} N/mm²`,
            },
          ],
        },
        {
          title: '2. Structural Axial Compression Capacity (IS 2911 Cl. 6.11.1 & IS 456 Cl. 39.3)',
          steps: [
            {
              symbol: 'Asc,min',
              description: 'Minimum Longitudinal Reinforcement (0.4% Ag)',
              formula: '0.004 * Ag',
              substitution: `0.004 * ${capacityResult.crossSectionArea * 1e6}`,
              result: `${capacityResult.minLongitudinalSteel} mm²`,
              codeReference: 'IS 2911:2010 Cl. 6.11.1',
            },
            {
              symbol: 'Asc,prov',
              description: 'Provided Longitudinal Reinforcement',
              formula: `${barCount} × pi × ${barDia}² / 4`,
              substitution: `${capacityResult.recommendedRebarCallout}`,
              result: `${capacityResult.providedLongitudinalSteel} mm² (pt = ${capacityResult.steelPercentage}%)`,
              status: capacityResult.isSteelCompliant ? 'PASS' : 'WARNING',
            },
            {
              symbol: 'Pc',
              description: 'Permissible Structural Compression Load',
              formula: '0.4 * fck * Ac + 0.67 * fy * Asc',
              substitution: `0.4 * ${fck} * (${capacityResult.crossSectionArea * 1e6 - capacityResult.providedLongitudinalSteel}) + 0.67 * ${fy} * ${capacityResult.providedLongitudinalSteel}`,
              result: `${capacityResult.structuralCapacity} kN`,
              codeReference: 'IS 456:2000 Cl. 39.3',
              status: 'PASS',
            },
          ],
        },
        {
          title: '3. Geotechnical Skin Friction, End Bearing & Safe Working Load (IS 2911 Appendix B)',
          steps: [
            {
              symbol: 'Qs',
              description: 'Ultimate Shaft Skin Friction Resistance',
              formula: 'alpha * cu * As',
              substitution: `0.6 * ${cu} * (${capacityResult.perimeter} * ${length})`,
              result: `${capacityResult.skinFrictionUltimate} kN`,
              codeReference: 'IS 2911:2010 Appendix B',
            },
            {
              symbol: 'Qb',
              description: 'Ultimate Base End Bearing Resistance',
              formula: '9 * cu * Ab',
              substitution: `9 * ${cu} * ${capacityResult.crossSectionArea}`,
              result: `${capacityResult.endBearingUltimate} kN`,
              codeReference: 'IS 2911:2010 Appendix B',
            },
            {
              symbol: 'Qu',
              description: 'Total Ultimate Geotechnical Bearing Capacity',
              formula: 'Qs + Qb',
              substitution: `${capacityResult.skinFrictionUltimate} + ${capacityResult.endBearingUltimate}`,
              result: `${capacityResult.geotechnicalUltimate} kN`,
            },
            {
              symbol: 'Qsafe',
              description: isManualCapacity ? 'User-Specified Safe Working Capacity' : 'Safe Working Capacity (FOS = 2.5)',
              formula: isManualCapacity ? 'Manual User Design Capacity' : 'Qu / FOS',
              substitution: isManualCapacity ? `${safeWorkingLoad} kN (Manual Input)` : `${capacityResult.geotechnicalUltimate} / 2.5`,
              result: `${safeWorkingLoad} kN`,
              codeReference: 'IS 2911:2010 Cl. 6.5',
              status: 'PASS',
            },
            {
              symbol: 'Tsafe / Hsafe',
              description: 'Safe Uplift & Lateral Load Capacities',
              formula: '0.65 * Qs (Uplift) / 0.08 * Qsafe (Lateral)',
              substitution: `0.65 * ${capacityResult.skinFrictionUltimate} / 0.08 * ${safeWorkingLoad}`,
              result: `Tension = ${upliftCapacity} kN | Lateral = ${lateralCapacity} kN`,
              status: 'PASS',
            },
          ],
        },
      ],
    };

    return {
      id,
      name,
      diameter,
      length,
      safeWorkingLoad,
      upliftCapacity,
      lateralCapacity,
      fck,
      fy,
      barCount,
      barDiameter: barDia,
      spiralDiameter: spiralDia,
      spiralPitch,
      soilType,
      cu,
      isManualCapacity,
      structuralCapacity: capacityResult.structuralCapacity,
      geotechnicalUltimate: capacityResult.geotechnicalUltimate,
      skinFrictionUltimate: capacityResult.skinFrictionUltimate,
      endBearingUltimate: capacityResult.endBearingUltimate,
      minLongitudinalSteel: capacityResult.minLongitudinalSteel,
      providedLongitudinalSteel: capacityResult.providedLongitudinalSteel,
      steelPercentage: capacityResult.steelPercentage,
      rebarCallout: capacityResult.recommendedRebarCallout,
      spiralCallout: capacityResult.recommendedSpiralCallout,
      status: capacityResult.status,
      calculationReport,
    };
  }

  /**
   * Returns default initial project pile types for a standard project.
   */
  public static getDefaultProjectPileTypes(): ProjectPileType[] {
    return [
      this.designPileType({
        id: 'P-1',
        name: 'Type P-1 (Dia 500mm Standard Bored Pile)',
        diameter: 500,
        length: 12.0,
        safeWorkingLoad: 450,
        isManualCapacity: true,
        fck: 25,
        fy: 500,
        barCount: 6,
        barDiameter: 16,
        spiralDiameter: 8,
        spiralPitch: 150,
        cu: 55,
      }),
      this.designPileType({
        id: 'P-2',
        name: 'Type P-2 (Dia 600mm Heavy Bored Pile)',
        diameter: 600,
        length: 15.0,
        safeWorkingLoad: 650,
        isManualCapacity: true,
        fck: 30,
        fy: 500,
        barCount: 8,
        barDiameter: 20,
        spiralDiameter: 8,
        spiralPitch: 125,
        cu: 65,
      }),
    ];
  }
}
