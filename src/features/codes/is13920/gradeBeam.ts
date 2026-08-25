/**
 * IS 13920:2016 Clause 11.2 & IS 2911 (Part 1/Sec 2):2010 Clause 6.7
 * Deterministic Grade Beam / Foundation Tie Beam Design Engine
 */

export interface GradeBeamCheckInput {
  b: number; // mm (width, min 250mm)
  D: number; // mm (overall depth)
  spanLength: number; // meters
  fck: number; // N/mm2 (e.g. 25)
  fy: number; // N/mm2 (e.g. 500)
  cover?: number; // mm (default: 40mm)
  factoredPu1: number; // kN (Column 1 reaction)
  factoredPu2: number; // kN (Column 2 reaction)
  wallLoadKnPerM?: number; // kN/m (default: 18 kN/m for brick wall + SW)
  allowedDiameters?: number[];
}

export interface GradeBeamCheckOutput {
  status: 'PASS' | 'WARNING' | 'FAIL';
  b: number;
  D: number;
  d: number;
  spanLength: number;
  factoredTensionTiePu: number; // kN (IS 13920 Cl. 11.2.2: >= 0.10 * max(Pu1, Pu2))
  factoredDesignMomentMu: number; // kNm
  factoredDesignShearVu: number; // kN
  astReqTotal: number; // mm2
  astMinDuctile: number; // mm2
  topRebarCallout: string;
  bottomRebarCallout: string;
  throughTopCount: number;
  throughTopDia: number;
  throughBottomCount: number;
  throughBottomDia: number;
  stirrupCallout: string;
  endZoneSpacing: number; // mm
  midZoneSpacing: number; // mm
  confinementLength: number; // mm (2 * D from face)
  warnings: string[];
}

export class IS13920GradeBeam {
  public static design(input: GradeBeamCheckInput): GradeBeamCheckOutput {
    const { b, D, spanLength, fck, fy } = input;
    const cover = input.cover || 40;
    const d = D - cover - 10;
    const validDias = input.allowedDiameters && input.allowedDiameters.length > 0
      ? input.allowedDiameters
      : [12, 16, 20, 25];

    const warnings: string[] = [];

    // 1. IS 13920:2016 Cl. 11.2.1 Minimum Dimensions
    if (b < 250) {
      warnings.push(`Grade beam width b = ${b} mm is less than IS 13920 Cl. 11.2.1 minimum of 250 mm.`);
    }
    if (D < 300) {
      warnings.push(`Grade beam depth D = ${D} mm is less than minimum recommended 300 mm.`);
    }

    // 2. IS 13920:2016 Cl. 11.2.2 Minimum Axial Tension & Compression Demand
    // Tie beam connecting foundation/pile caps shall be designed for an axial force equal to 10% of larger column axial load (min 100 kN)
    const maxColumnPu = Math.max(input.factoredPu1, input.factoredPu2, 650);
    const factoredTensionTiePu = parseFloat(Math.max(0.10 * maxColumnPu, 100).toFixed(1)); // kN

    // 3. Superimposed Plinth Wall & Self-Weight Load
    const selfWeight = (b / 1000) * (D / 1000) * 25; // kN/m
    const superimposedWall = input.wallLoadKnPerM !== undefined ? input.wallLoadKnPerM : 18; // kN/m
    const totalWu = 1.5 * (selfWeight + superimposedWall); // Factored UDL (kN/m)

    // Bending moment: UDL flexure + intentional eccentricity moment
    const Mu_udl = (totalWu * spanLength * spanLength) / 10; // kNm (continuous grade beam)
    const eccentricity = 0.05 * (D / 1000); // 5% depth intentional eccentricity (m)
    const Mu_axial = factoredTensionTiePu * eccentricity;
    const factoredDesignMomentMu = parseFloat((Mu_udl + Mu_axial).toFixed(1)); // kNm

    // Shear force
    const factoredDesignShearVu = parseFloat(((totalWu * spanLength) / 2).toFixed(1)); // kN

    // 4. Longitudinal Reinforcement Design
    // Tensile steel for combined axial tension + bending moment
    const leverArm = 0.90 * d; // mm
    const Ast_flexure = (factoredDesignMomentMu * 1e6) / (0.87 * fy * leverArm); // mm2
    const Ast_axialTension = (factoredTensionTiePu * 1e3) / (0.87 * fy); // mm2

    // IS 13920 Cl. 6.2.1 minimum longitudinal steel ratio rho_min = 0.24 * sqrt(fck) / fy
    const rhoMin = (0.24 * Math.sqrt(fck)) / fy;
    const astMinDuctile = parseFloat((rhoMin * b * d).toFixed(1));

    const astReqTotal = parseFloat(Math.max(Ast_flexure + Ast_axialTension / 2, astMinDuctile).toFixed(1));

    // Sizing Top & Bottom Rebars (Minimum 2 continuous bars top and bottom)
    let throughTopDia = 16;
    let throughTopCount = 2;
    let topAstProv = (throughTopCount * Math.PI * throughTopDia * throughTopDia) / 4;

    for (const dia of validDias.filter((d) => d >= 12)) {
      const a2 = (2 * Math.PI * dia * dia) / 4;
      if (a2 >= astReqTotal) {
        throughTopDia = dia;
        throughTopCount = 2;
        topAstProv = a2;
        break;
      }
      const a3 = (3 * Math.PI * dia * dia) / 4;
      if (a3 >= astReqTotal) {
        throughTopDia = dia;
        throughTopCount = 3;
        topAstProv = a3;
        break;
      }
    }

    if (topAstProv < astReqTotal) {
      const maxDia = validDias[validDias.length - 1];
      throughTopDia = maxDia;
      throughTopCount = Math.max(2, Math.ceil(astReqTotal / ((Math.PI * maxDia * maxDia) / 4)));
      topAstProv = (throughTopCount * Math.PI * throughTopDia * throughTopDia) / 4;
    }

    let throughBottomDia = throughTopDia;
    let throughBottomCount = throughTopCount;

    const topRebarCallout = `${throughTopCount}-T${throughTopDia} (Continuous Full Length)`;
    const bottomRebarCallout = `${throughBottomCount}-T${throughBottomDia} (Continuous Full Length)`;

    // 5. Confinement Ties (IS 13920:2016 Cl. 11.2.3 & Cl. 6.3.5)
    // End zone length = 2 * D from face of pile cap
    const confinementLength = 2 * D; // mm
    // End zone spacing s <= min(d/4, 8 * db, 100 mm)
    const minMainDia = Math.min(throughTopDia, throughBottomDia);
    const endZoneSpacing = Math.max(75, Math.min(Math.floor(d / 4), 8 * minMainDia, 100));
    // Mid zone spacing s <= min(d/2, 12 * db, 200 mm)
    const midZoneSpacing = Math.max(100, Math.min(Math.floor(d / 2), 12 * minMainDia, 200));

    const stirrupCallout = `2L-8mm @ ${endZoneSpacing}mm c/c (End ${confinementLength}mm zone) / ${midZoneSpacing}mm c/c (Mid)`;

    const status: 'PASS' | 'WARNING' | 'FAIL' = warnings.length > 0 ? 'WARNING' : 'PASS';

    return {
      status,
      b,
      D,
      d,
      spanLength,
      factoredTensionTiePu,
      factoredDesignMomentMu,
      factoredDesignShearVu,
      astReqTotal,
      astMinDuctile,
      topRebarCallout,
      bottomRebarCallout,
      throughTopCount,
      throughTopDia,
      throughBottomCount,
      throughBottomDia,
      stirrupCallout,
      endZoneSpacing,
      midZoneSpacing,
      confinementLength,
      warnings,
    };
  }
}
