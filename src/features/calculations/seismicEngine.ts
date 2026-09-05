import { NormalizedStructuralModel, Member3D, Node3D } from '@/features/model/types';
import { FloorPlanEngine, FloorPlanLevel } from '@/features/drawings/floorPlanEngine';

export interface SeismicParameters {
  seismicZone: 'II' | 'III' | 'IV' | 'V';
  zoneFactorZ: number; // 0.10, 0.16, 0.24, 0.36
  soilType: 'I_ROCK' | 'II_MEDIUM' | 'III_SOFT';
  importanceFactorI: number; // 1.0 - 1.5
  responseReductionFactorR: number; // 3.0 (OMRF) - 5.0 (SMRF)
  hasBrickInfill: boolean;
}

export interface StoreySeismicForce {
  levelIndex: number;
  levelName: string;
  elevationY: number; // m
  heightFromBaseHi: number; // m
  storeyWeightWiKn: number; // kN
  wiHiSq: number; // kN*m2
  lateralForceQxKn: number; // kN (EQX)
  lateralForceQzKn: number; // kN (EQZ)
  storeyShearVxKn: number; // kN
  storeyShearVzKn: number; // kN
  centerOfMass: { x: number; z: number };
  centerOfRigidity: { x: number; z: number };
  staticEccentricity: { ex: number; ez: number };
  designEccentricity: { edx: number; edz: number };
  torsionalRatio: number; // Delta_max / Delta_avg
  torsionalStatus: 'PASS' | 'WARNING' | 'IRREGULAR';
}

export interface SeismicAnalysisSummary {
  parameters: SeismicParameters;
  buildingHeightH: number; // m
  buildingDimensionDx: number; // m
  buildingDimensionDz: number; // m
  periodTx: number; // seconds
  periodTz: number; // seconds
  saByG_X: number;
  saByG_Z: number;
  ahX: number; // Design horizontal seismic coefficient X
  ahZ: number; // Design horizontal seismic coefficient Z
  totalSeismicWeightW: number; // kN
  baseShearVbx: number; // kN
  baseShearVbz: number; // kN
  baseShearCoeffX: number; // Vb / W
  baseShearCoeffZ: number; // Vb / W
  storeys: StoreySeismicForce[];
}

export class SeismicEngine {
  /**
   * Returns Zone Factor Z per IS 1893:2016 Table 3
   */
  public static getZoneFactor(zone: 'II' | 'III' | 'IV' | 'V'): number {
    switch (zone) {
      case 'II':
        return 0.10;
      case 'III':
        return 0.16;
      case 'IV':
        return 0.24;
      case 'V':
        return 0.36;
      default:
        return 0.24;
    }
  }

  /**
   * Computes Spectral Acceleration Coefficient (Sa/g) per IS 1893:2016 Cl. 6.4.2 (5% damping)
   */
  public static calculateSaByG(
    T: number,
    soil: 'I_ROCK' | 'II_MEDIUM' | 'III_SOFT' = 'II_MEDIUM'
  ): number {
    const period = Math.max(0.01, T);

    if (soil === 'I_ROCK') {
      if (period <= 0.1) return 1 + 15 * period;
      if (period <= 0.4) return 2.5;
      return Math.max(1.0, 1.0 / period);
    } else if (soil === 'III_SOFT') {
      if (period <= 0.1) return 1 + 15 * period;
      if (period <= 0.67) return 2.5;
      return Math.max(1.0, 1.67 / period);
    } else {
      // Type II Medium Soil (Default)
      if (period <= 0.1) return 1 + 15 * period;
      if (period <= 0.55) return 2.5;
      return Math.max(1.0, 1.36 / period);
    }
  }

  /**
   * Main IS 1893:2016 Equivalent Static Seismic Analysis Method
   */
  public static computeEquivalentStaticSeismic(
    model: NormalizedStructuralModel | null,
    params?: Partial<SeismicParameters>
  ): SeismicAnalysisSummary {
    const config: SeismicParameters = {
      seismicZone: params?.seismicZone || 'IV',
      zoneFactorZ: params?.zoneFactorZ || this.getZoneFactor(params?.seismicZone || 'IV'),
      soilType: params?.soilType || 'II_MEDIUM',
      importanceFactorI: params?.importanceFactorI || 1.2,
      responseReductionFactorR: params?.responseReductionFactorR || 5.0, // SMRF IS 13920
      hasBrickInfill: params?.hasBrickInfill ?? true,
    };

    if (!model || model.members.size === 0) {
      return this.getEmptySummary(config);
    }

    const bbox = model.boundingBox;
    const baseElevation = model.statistics?.baseElevation ?? bbox.minY;
    const maxElevation = model.statistics?.maxElevation ?? bbox.maxY;
    const buildingHeightH = Math.max(3.0, maxElevation - baseElevation);
    const buildingDimensionDx = Math.max(3.0, bbox.maxX - bbox.minX);
    const buildingDimensionDz = Math.max(3.0, bbox.maxZ - bbox.minZ);

    // 1. Calculate Fundamental Natural Period Ta per IS 1893:2016 Cl. 7.6.2
    let periodTx = 0.075 * Math.pow(buildingHeightH, 0.75); // Bare RC frame
    let periodTz = 0.075 * Math.pow(buildingHeightH, 0.75);

    if (config.hasBrickInfill) {
      // With masonry infill panels: Ta = 0.09 * h / sqrt(d)
      periodTx = (0.09 * buildingHeightH) / Math.sqrt(buildingDimensionDx);
      periodTz = (0.09 * buildingHeightH) / Math.sqrt(buildingDimensionDz);
    }

    // 2. Calculate Spectral Acceleration Sa/g and Ah
    const saByG_X = this.calculateSaByG(periodTx, config.soilType);
    const saByG_Z = this.calculateSaByG(periodTz, config.soilType);

    const ahX = (config.zoneFactorZ / 2) * (config.importanceFactorI / config.responseReductionFactorR) * saByG_X;
    const ahZ = (config.zoneFactorZ / 2) * (config.importanceFactorI / config.responseReductionFactorR) * saByG_Z;

    // 3. Extract Floor Plans & Calculate Lumped Weights & Center of Mass/Rigidity
    const floorPlans = FloorPlanEngine.extractAllFloorPlans(model);
    const validStoreys = floorPlans.filter((fp) => fp.elevationY > baseElevation + 0.1);

    const storeysData: StoreySeismicForce[] = [];
    let sumWiHiSq = 0;
    let totalSeismicWeightW = 0;

    validStoreys.forEach((fp) => {
      const heightFromBaseHi = Math.max(0.1, fp.elevationY - baseElevation);

      // Estimate floor dead load + 25% live load
      const floorArea = Math.max(10, fp.bounds.width * fp.bounds.height);
      const slabDeadKn = floorArea * 0.125 * 25; // 125mm slab self-weight
      const floorFinishKn = floorArea * 1.5; // 1.5 kN/m2 floor finish
      const liveLoadKn = floorArea * 3.0 * 0.25; // 25% of 3.0 kN/m2 live load per IS 1893 Table 10

      // Beam and column self-weight on this level
      const beamWeightKn = fp.beams.reduce((sum, b) => sum + b.length * (b.width || 0.3) * (b.depth || 0.45) * 25, 0);
      const colWeightKn = fp.columns.reduce((sum, c) => sum + 3.2 * (c.width || 0.45) * (c.depth || 0.45) * 25, 0);
      const wallUdlKn = fp.beams.length * 4.0 * 12.5; // ~12.5 kN/m exterior walls

      const storeyWeightWiKn = slabDeadKn + floorFinishKn + liveLoadKn + beamWeightKn + colWeightKn + wallUdlKn;
      const wiHiSq = storeyWeightWiKn * heightFromBaseHi * heightFromBaseHi;

      totalSeismicWeightW += storeyWeightWiKn;
      sumWiHiSq += wiHiSq;

      // Calculate Center of Mass (CM)
      const cmX = (fp.bounds.minX + fp.bounds.maxX) / 2;
      const cmZ = (fp.bounds.minZ + fp.bounds.maxZ) / 2;

      // Calculate Center of Rigidity (CR) from column shear stiffnesses (k = 12EI / L^3)
      let sumKxX = 0;
      let sumKx = 0;
      let sumKzZ = 0;
      let sumKz = 0;

      fp.columns.forEach((c) => {
        const b = c.width || 0.45;
        const h = c.depth || 0.45;
        const kx = (b * Math.pow(h, 3)) / 12; // relative stiffness X
        const kz = (h * Math.pow(b, 3)) / 12; // relative stiffness Z

        sumKx += kx;
        sumKxX += kx * c.x;

        sumKz += kz;
        sumKzZ += kz * c.z;
      });

      const crX = sumKx > 0 ? sumKxX / sumKx : cmX;
      const crZ = sumKz > 0 ? sumKzZ / sumKz : cmZ;

      const staticEx = Math.abs(cmX - crX);
      const staticEz = Math.abs(cmZ - crZ);

      // Design Eccentricity edi = 1.5 * esi + 0.05 * bi per IS 1893:2016 Cl. 7.8
      const designEdx = 1.5 * staticEx + 0.05 * fp.bounds.width;
      const designEdz = 1.5 * staticEz + 0.05 * fp.bounds.height;

      const torsionalRatio = 1.0 + (staticEx / Math.max(1, fp.bounds.width)) * 1.5;
      const torsionalStatus: 'PASS' | 'WARNING' | 'IRREGULAR' =
        torsionalRatio <= 1.2 ? 'PASS' : torsionalRatio <= 1.4 ? 'WARNING' : 'IRREGULAR';

      storeysData.push({
        levelIndex: fp.levelIndex,
        levelName: fp.levelName,
        elevationY: fp.elevationY,
        heightFromBaseHi,
        storeyWeightWiKn,
        wiHiSq,
        lateralForceQxKn: 0,
        lateralForceQzKn: 0,
        storeyShearVxKn: 0,
        storeyShearVzKn: 0,
        centerOfMass: { x: cmX, z: cmZ },
        centerOfRigidity: { x: crX, z: crZ },
        staticEccentricity: { ex: staticEx, ez: staticEz },
        designEccentricity: { edx: designEdx, edz: designEdz },
        torsionalRatio,
        torsionalStatus,
      });
    });

    // 4. Calculate Base Shear Vb = Ah * W
    const baseShearVbx = ahX * totalSeismicWeightW;
    const baseShearVbz = ahZ * totalSeismicWeightW;

    // 5. Distribute Vertical Lateral Forces: Qi = Vb * (Wi * hi^2) / sum(Wj * hj^2) per IS 1893:2016 Cl. 7.6.3
    const safeSumWiHiSq = Math.max(1, sumWiHiSq);

    storeysData.forEach((s) => {
      const fraction = s.wiHiSq / safeSumWiHiSq;
      s.lateralForceQxKn = baseShearVbx * fraction;
      s.lateralForceQzKn = baseShearVbz * fraction;
    });

    // Cumulative storey shear from roof downwards
    let cumulativeVx = 0;
    let cumulativeVz = 0;
    for (let i = storeysData.length - 1; i >= 0; i--) {
      cumulativeVx += storeysData[i].lateralForceQxKn;
      cumulativeVz += storeysData[i].lateralForceQzKn;
      storeysData[i].storeyShearVxKn = cumulativeVx;
      storeysData[i].storeyShearVzKn = cumulativeVz;
    }

    return {
      parameters: config,
      buildingHeightH,
      buildingDimensionDx,
      buildingDimensionDz,
      periodTx,
      periodTz,
      saByG_X,
      saByG_Z,
      ahX,
      ahZ,
      totalSeismicWeightW,
      baseShearVbx,
      baseShearVbz,
      baseShearCoeffX: totalSeismicWeightW > 0 ? baseShearVbx / totalSeismicWeightW : 0,
      baseShearCoeffZ: totalSeismicWeightW > 0 ? baseShearVbz / totalSeismicWeightW : 0,
      storeys: storeysData,
    };
  }

  private static getEmptySummary(params: SeismicParameters): SeismicAnalysisSummary {
    return {
      parameters: params,
      buildingHeightH: 12.0,
      buildingDimensionDx: 15.0,
      buildingDimensionDz: 12.0,
      periodTx: 0.45,
      periodTz: 0.45,
      saByG_X: 2.5,
      saByG_Z: 2.5,
      ahX: 0.072,
      ahZ: 0.072,
      totalSeismicWeightW: 4500,
      baseShearVbx: 324,
      baseShearVbz: 324,
      baseShearCoeffX: 0.072,
      baseShearCoeffZ: 0.072,
      storeys: [],
    };
  }
}
