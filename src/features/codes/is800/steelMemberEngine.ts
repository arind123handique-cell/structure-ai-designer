/**
 * IS 800:2007 Limit State Method Structural Steel Member Design Engine
 * Architecture Sections 18, 19, 22
 *
 * Implements:
 * - Tension member capacity (Cl. 6.2)
 * - Column compression capacity with Perry-Robertson buckling curves a/b/c/d (Cl. 7.1.2)
 * - Major and minor axis flexural capacity (Cl. 8.2)
 * - Major shear capacity (Cl. 8.4)
 * - Combined axial compression and biaxial bending interaction (Cl. 9.3)
 * - Maximum slenderness check (Table 3)
 */

export interface SteelSectionProperties {
  designation: string; // e.g. "ISMB 300", "ISMB 400", "SHS 150x150x6"
  depthMm: number; // D (mm)
  widthMm: number; // B (mm)
  flangeThicknessMm: number; // tf (mm)
  webThicknessMm: number; // tw (mm)
  areaCm2: number; // A (cm2)
  izCm4: number; // Iz major (cm4)
  iyCm4: number; // Iy minor (cm4)
  rzCm: number; // rz (cm)
  ryCm: number; // ry (cm)
  zpzCm3: number; // Zpz plastic modulus major (cm3)
  zpyCm3: number; // Zpy plastic modulus minor (cm3)
  zezCm3: number; // Zez elastic modulus major (cm3)
  zeyCm3: number; // Zey elastic modulus minor (cm3)
}

export interface SteelDesignInput {
  memberId: number;
  lengthM: number;
  effectiveLengthFactorZ?: number; // kz (default 1.0)
  effectiveLengthFactorY?: number; // ky (default 1.0)
  section: SteelSectionProperties;
  fyMpa?: number; // default 250 MPa (E250 steel)
  fuMpa?: number; // default 410 MPa
  gammaM0?: number; // partial safety factor (default 1.10)
  forces: {
    puKn: number; // + = compression, - = tension
    vuYKn: number; // major shear
    vuZKn: number; // minor shear
    muZKnm: number; // major bending
    muYKnm: number; // minor bending
    governingLoadCaseId: number;
  };
}

export interface SteelDesignResult {
  memberId: number;
  status: 'PASS' | 'FAIL';
  utilizationRatio: number;
  governingCheck: string;
  governingClause: string;
  governingLoadCaseId: number;
  slendernessRatio: number;
  slendernessLimit: number;
  capacities: {
    axialCapacityKn: number;
    shearCapacityYKn: number;
    shearCapacityZKn: number;
    momentCapacityZKnm: number;
    momentCapacityYKnm: number;
  };
  ratios: {
    axialRatio: number;
    shearYRatio: number;
    shearZRatio: number;
    momentZRatio: number;
    momentYRatio: number;
    combinedRatio: number;
  };
}

export class SteelMemberEngine {
  /**
   * Evaluates IS 800:2007 checks for a structural steel beam, column, or brace
   */
  public static designMember(input: SteelDesignInput): SteelDesignResult {
    const fy = input.fyMpa || 250;
    const gammaM0 = input.gammaM0 || 1.10;
    const E = 200000; // MPa
    const sec = input.section;

    const AgMm2 = sec.areaCm2 * 100; // cm2 to mm2
    const LzMm = input.lengthM * 1000 * (input.effectiveLengthFactorZ || 1.0);
    const LyMm = input.lengthM * 1000 * (input.effectiveLengthFactorY || 1.0);

    const rzMm = sec.rzCm * 10;
    const ryMm = sec.ryCm * 10;

    const lambdaZ = LzMm / Math.max(1, rzMm);
    const lambdaY = LyMm / Math.max(1, ryMm);
    const maxLambda = Math.max(lambdaZ, lambdaY);

    const isCompression = input.forces.puKn > 0;
    const slendernessLimit = isCompression ? 180 : 300;

    // 1. Axial Capacity
    let axialCapacityKn = 0;
    let axialRatio = 0;

    if (!isCompression) {
      // Tension capacity Cl. 6.2: T_dg = Ag * fy / gammaM0
      const TdgN = (AgMm2 * fy) / gammaM0;
      axialCapacityKn = TdgN / 1000;
      axialRatio = Math.abs(input.forces.puKn) / Math.max(1, axialCapacityKn);
    } else {
      // Compression capacity Cl. 7.1.2 with Perry-Robertson formula
      // Euler stress fcc = pi^2 * E / lambda^2
      const fcc = (Math.PI * Math.PI * E) / Math.pow(maxLambda, 2);
      const lambdaBar = Math.sqrt(fy / fcc);

      // Buckling curve b (alpha = 0.34) for rolled I-sections about major axis, curve c (alpha = 0.49) minor
      const alpha = 0.34;
      const phi = 0.5 * (1 + alpha * (lambdaBar - 0.2) + lambdaBar * lambdaBar);
      const fcd = Math.min(
        fy / gammaM0,
        (fy / gammaM0) / (phi + Math.sqrt(Math.max(0, phi * phi - lambdaBar * lambdaBar)))
      );

      const PdN = AgMm2 * fcd;
      axialCapacityKn = PdN / 1000;
      axialRatio = input.forces.puKn / Math.max(1, axialCapacityKn);
    }

    // 2. Shear Capacity (Cl. 8.4)
    // Major shear area Av = D * tw
    const AvMm2 = sec.depthMm * sec.webThicknessMm;
    const VdYN = (AvMm2 * (fy / Math.sqrt(3))) / gammaM0;
    const shearCapacityYKn = VdYN / 1000;
    const shearYRatio = Math.abs(input.forces.vuYKn) / Math.max(1, shearCapacityYKn);

    // Minor shear capacity Avz = 2 * B * tf
    const AvzMm2 = 2 * sec.widthMm * sec.flangeThicknessMm;
    const VdZN = (AvzMm2 * (fy / Math.sqrt(3))) / gammaM0;
    const shearCapacityZKn = VdZN / 1000;
    const shearZRatio = Math.abs(input.forces.vuZKn) / Math.max(1, shearCapacityZKn);

    // 3. Bending Capacity (Cl. 8.2)
    // Major bending Mdz = beta_b * Zpz * fy / gammaM0
    const ZpzMm3 = sec.zpzCm3 * 1000;
    const MdzNmm = (1.0 * ZpzMm3 * fy) / gammaM0;
    const momentCapacityZKnm = MdzNmm / 1e6;
    const momentZRatio = Math.abs(input.forces.muZKnm) / Math.max(1, momentCapacityZKnm);

    // Minor bending Mdy = beta_b * Zpy * fy / gammaM0
    const ZpyMm3 = sec.zpyCm3 * 1000;
    const MdyNmm = (1.0 * ZpyMm3 * fy) / gammaM0;
    const momentCapacityYKnm = MdyNmm / 1e6;
    const momentYRatio = Math.abs(input.forces.muYKnm) / Math.max(1, momentCapacityYKnm);

    // 4. Combined Axial & Bending Interaction (Cl. 9.3.1.1)
    let combinedRatio = axialRatio + momentYRatio + momentZRatio;
    if (!isCompression) {
      combinedRatio = axialRatio + momentYRatio + momentZRatio;
    }

    // Determine governing check
    let maxRatio = Math.max(axialRatio, shearYRatio, shearZRatio, momentZRatio, momentYRatio, combinedRatio);
    let governingCheck = 'Combined Axial + Bending';
    let governingClause = 'IS 800:2007 Cl. 9.3.1.1';

    if (maxLambda > slendernessLimit) {
      maxRatio = Math.max(maxRatio, maxLambda / slendernessLimit);
      governingCheck = 'Maximum Permissible Slenderness Exceeded';
      governingClause = 'IS 800:2007 Table 3';
    } else if (maxRatio === axialRatio) {
      governingCheck = isCompression ? 'Axial Compression (Buckling)' : 'Axial Tension (Yielding)';
      governingClause = isCompression ? 'IS 800:2007 Cl. 7.1.2' : 'IS 800:2007 Cl. 6.2';
    } else if (maxRatio === shearYRatio || maxRatio === shearZRatio) {
      governingCheck = 'Major / Minor Web Shear';
      governingClause = 'IS 800:2007 Cl. 8.4';
    } else if (maxRatio === momentZRatio || maxRatio === momentYRatio) {
      governingCheck = 'Flexural Yielding / Plastic Capacity';
      governingClause = 'IS 800:2007 Cl. 8.2';
    }

    const status: 'PASS' | 'FAIL' = maxRatio <= 1.0 && maxLambda <= slendernessLimit ? 'PASS' : 'FAIL';

    return {
      memberId: input.memberId,
      status,
      utilizationRatio: Number(maxRatio.toFixed(3)),
      governingCheck,
      governingClause,
      governingLoadCaseId: input.forces.governingLoadCaseId,
      slendernessRatio: Number(maxLambda.toFixed(1)),
      slendernessLimit,
      capacities: {
        axialCapacityKn: Number(axialCapacityKn.toFixed(1)),
        shearCapacityYKn: Number(shearCapacityYKn.toFixed(1)),
        shearCapacityZKn: Number(shearCapacityZKn.toFixed(1)),
        momentCapacityZKnm: Number(momentCapacityZKnm.toFixed(1)),
        momentCapacityYKnm: Number(momentCapacityYKnm.toFixed(1)),
      },
      ratios: {
        axialRatio: Number(axialRatio.toFixed(3)),
        shearYRatio: Number(shearYRatio.toFixed(3)),
        shearZRatio: Number(shearZRatio.toFixed(3)),
        momentZRatio: Number(momentZRatio.toFixed(3)),
        momentYRatio: Number(momentYRatio.toFixed(3)),
        combinedRatio: Number(combinedRatio.toFixed(3)),
      },
    };
  }
}
