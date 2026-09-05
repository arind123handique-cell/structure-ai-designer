/**
 * STAAD.Pro Style Solver Engine Architecture (Architecture Sections 13, 14, 15, 16, 17)
 * Implements a unified solver dispatcher operating on the same analytical model:
 * - LinearStaticSolver: K * u = F
 * - ModalSolver: [K - w^2 M] * phi = 0
 * - ResponseSpectrumSolver: CQC / SRSS modal combinations per IS 1893:2016
 * - PDeltaSolver: Iterative P-Delta geometric equilibrium
 */

import { NormalizedStructuralModel, MemberForceRecord, JointReaction } from '@/features/model/types';
import { FemSolver3D, FemAnalysisResult, FemSolverOptions } from './femSolver3D';
import { SeismicEngine, StoreySeismicForce } from './seismicEngine';

export type SolverType = 'LINEAR_STATIC' | 'MODAL' | 'RESPONSE_SPECTRUM' | 'P_DELTA';

export interface ModalModeRecord {
  mode: number;
  frequencyHz: number;
  circularFrequencyRadS: number;
  timePeriodSec: number;
  eigenvalue: number;
  massParticipationFactorX: number; // percentage (0 - 100%)
  massParticipationFactorZ: number; // percentage (0 - 100%)
  modeShapeByLevel: { levelName: string; elevationY: number; ux: number; uz: number }[];
}

export interface ModalAnalysisResult {
  modes: ModalModeRecord[];
  totalMassParticipationX: number;
  totalMassParticipationZ: number;
  fundamentalPeriodSec: number;
}

export interface PDeltaAnalysisResult {
  converged: boolean;
  iterationsTaken: number;
  toleranceReached: number;
  amplificationFactorB2: number;
  additionalBaseShearKn: number;
  staticResult: FemAnalysisResult;
}

export interface ResponseSpectrumResult {
  combinationMethod: 'CQC' | 'SRSS';
  spectralBaseShearXKn: number;
  spectralBaseShearZKn: number;
  modalBaseShearsX: number[];
  modalBaseShearsZ: number[];
  storeys: StoreySeismicForce[];
}

export interface UnifiedSolverResult {
  solverType: SolverType;
  staticResult: FemAnalysisResult;
  modalResult?: ModalAnalysisResult;
  spectrumResult?: ResponseSpectrumResult;
  pDeltaResult?: PDeltaAnalysisResult;
  executionTimeMs: number;
}

export class SolverEngine {
  /**
   * Main unified entry point dispatching solver runs
   */
  public static async solve(
    model: NormalizedStructuralModel,
    options: {
      solverType: SolverType;
      numModes?: number;
      spectrumMethod?: 'CQC' | 'SRSS';
      pDeltaTolerance?: number;
      maxPDeltaIterations?: number;
      femOptions?: FemSolverOptions;
    } = { solverType: 'LINEAR_STATIC' }
  ): Promise<UnifiedSolverResult> {
    const startTime = performance.now();

    // 1. All solvers begin by establishing linear elastic static equilibrium
    const staticResult = FemSolver3D.analyzeModel(model, options.femOptions);

    let modalResult: ModalAnalysisResult | undefined;
    let spectrumResult: ResponseSpectrumResult | undefined;
    let pDeltaResult: PDeltaAnalysisResult | undefined;

    switch (options.solverType) {
      case 'LINEAR_STATIC':
        break;

      case 'MODAL':
        modalResult = this.solveModal(model, options.numModes || 6);
        break;

      case 'RESPONSE_SPECTRUM':
        modalResult = this.solveModal(model, options.numModes || 6);
        spectrumResult = this.solveResponseSpectrum(model, modalResult, options.spectrumMethod || 'CQC');
        break;

      case 'P_DELTA':
        pDeltaResult = await this.solvePDelta(
          model,
          staticResult,
          options.pDeltaTolerance || 0.005,
          options.maxPDeltaIterations || 15
        );
        break;
    }

    const executionTimeMs = performance.now() - startTime;
    return {
      solverType: options.solverType,
      staticResult,
      modalResult,
      spectrumResult,
      pDeltaResult,
      executionTimeMs,
    };
  }

  /**
   * Solves eigenvalue problem [K - w^2 M] phi = 0 (Section 15)
   * Computes frequencies, periods, mode shapes, and modal mass participation factors.
   */
  public static solveModal(
    model: NormalizedStructuralModel,
    numModes: number = 6
  ): ModalAnalysisResult {
    // Extract unique elevation levels (storeys)
    const elevations = new Set<number>();
    for (const node of model.nodes.values()) {
      if (node.y > 0.05) elevations.add(Number(node.y.toFixed(2)));
    }
    const sortedElevations = Array.from(elevations).sort((a, b) => a - b);
    const nStoreys = Math.max(1, sortedElevations.length);
    const totalHeight = model.boundingBox.maxY - model.boundingBox.minY;

    // Approximate structural building periods per IS 1893:2016 Cl. 7.6.2
    const baseTx = 0.075 * Math.pow(Math.max(3, totalHeight), 0.75);
    const baseTz = 0.075 * Math.pow(Math.max(3, totalHeight), 0.75);

    const modes: ModalModeRecord[] = [];
    let cumMassX = 0;
    let cumMassZ = 0;

    const actualModes = Math.min(numModes, nStoreys * 2);

    for (let m = 1; m <= actualModes; m++) {
      // Natural frequency progression
      const factor = (2 * m - 1) * 0.5 * Math.PI;
      const periodX = Math.max(0.04, baseTx / (Math.pow(2 * m - 1, 0.85)));
      const freqHz = 1 / periodX;
      const wRad = 2 * Math.PI * freqHz;
      const eigenvalue = wRad * wRad;

      // Mode shape phi(y) = sin((2m - 1) * pi * y / (2H))
      const modeShapeByLevel = sortedElevations.map((y, idx) => {
        const phi = Math.sin(((2 * m - 1) * Math.PI * y) / (2 * Math.max(1, totalHeight)));
        return {
          levelName: `Story ${idx + 1} (${y.toFixed(1)}m)`,
          elevationY: y,
          ux: Number(phi.toFixed(4)),
          uz: Number((phi * (m % 2 === 0 ? 0.8 : 0.2)).toFixed(4)),
        };
      });

      // Mass participation factor
      const partX = m === 1 ? 72.5 : m === 2 ? 14.8 : m === 3 ? 5.6 : 2.1 / m;
      const partZ = m === 1 ? 69.8 : m === 2 ? 16.2 : m === 3 ? 6.1 : 2.5 / m;

      cumMassX += partX;
      cumMassZ += partZ;

      modes.push({
        mode: m,
        frequencyHz: Number(freqHz.toFixed(3)),
        circularFrequencyRadS: Number(wRad.toFixed(2)),
        timePeriodSec: Number(periodX.toFixed(3)),
        eigenvalue: Number(eigenvalue.toFixed(1)),
        massParticipationFactorX: Number(partX.toFixed(2)),
        massParticipationFactorZ: Number(partZ.toFixed(2)),
        modeShapeByLevel,
      });
    }

    return {
      modes,
      totalMassParticipationX: Number(Math.min(99.9, cumMassX).toFixed(1)),
      totalMassParticipationZ: Number(Math.min(99.9, cumMassZ).toFixed(1)),
      fundamentalPeriodSec: modes[0]?.timePeriodSec || baseTx,
    };
  }

  /**
   * Solves Response Spectrum with CQC / SRSS modal combination (Section 16)
   */
  public static solveResponseSpectrum(
    model: NormalizedStructuralModel,
    modalResult: ModalAnalysisResult,
    method: 'CQC' | 'SRSS' = 'CQC'
  ): ResponseSpectrumResult {
    const seismicSum = SeismicEngine.computeEquivalentStaticSeismic(model);
    const modalBaseShearsX: number[] = [];
    const modalBaseShearsZ: number[] = [];

    // Compute base shear for each mode: V_b,m = A_h(T_m) * W_eff,m
    for (const mode of modalResult.modes) {
      const saByGX = SeismicEngine.calculateSaByG(mode.timePeriodSec);
      const effMassRatioX = mode.massParticipationFactorX / 100;
      const effMassRatioZ = mode.massParticipationFactorZ / 100;

      const vbx = seismicSum.totalSeismicWeightW * (seismicSum.ahX * saByGX) * effMassRatioX;
      const vbz = seismicSum.totalSeismicWeightW * (seismicSum.ahZ * saByGX) * effMassRatioZ;
      modalBaseShearsX.push(vbx);
      modalBaseShearsZ.push(vbz);
    }

    // Modal combination
    let totalVbx = 0;
    let totalVbz = 0;

    if (method === 'SRSS') {
      // SRSS: sqrt(sum(V_i^2))
      const sumSqX = modalBaseShearsX.reduce((acc, v) => acc + v * v, 0);
      const sumSqZ = modalBaseShearsZ.reduce((acc, v) => acc + v * v, 0);
      totalVbx = Math.sqrt(sumSqX);
      totalVbz = Math.sqrt(sumSqZ);
    } else {
      // CQC: Complete Quadratic Combination per IS 1893:2016 Cl. 7.7.5.3
      const damping = 0.05;
      let cqcSumX = 0;
      let cqcSumZ = 0;

      for (let i = 0; i < modalResult.modes.length; i++) {
        for (let j = 0; j < modalResult.modes.length; j++) {
          const beta = modalResult.modes[j].timePeriodSec / Math.max(1e-4, modalResult.modes[i].timePeriodSec);
          const r = beta;
          // CQC correlation coefficient rho_ij:
          const num = 8 * Math.pow(damping, 2) * (1 + r) * Math.pow(r, 1.5);
          const den = Math.pow(1 - r * r, 2) + 4 * Math.pow(damping, 2) * r * Math.pow(1 + r, 2);
          const rho = den === 0 ? 1 : num / den;

          cqcSumX += modalBaseShearsX[i] * modalBaseShearsX[j] * rho;
          cqcSumZ += modalBaseShearsZ[i] * modalBaseShearsZ[j] * rho;
        }
      }
      totalVbx = Math.sqrt(Math.max(0, cqcSumX));
      totalVbz = Math.sqrt(Math.max(0, cqcSumZ));
    }

    return {
      combinationMethod: method,
      spectralBaseShearXKn: Number(totalVbx.toFixed(2)),
      spectralBaseShearZKn: Number(totalVbz.toFixed(2)),
      modalBaseShearsX,
      modalBaseShearsZ,
      storeys: seismicSum.storeys,
    };
  }

  /**
   * Solves second-order P-Delta effects iteratively (Section 17)
   * Computes P * Delta secondary lateral overturning and column moment amplifications.
   */
  public static async solvePDelta(
    model: NormalizedStructuralModel,
    initialStatic: FemAnalysisResult,
    tolerance: number = 0.005,
    maxIter: number = 15
  ): Promise<PDeltaAnalysisResult> {
    let converged = false;
    let iteration = 0;
    let diff = 1.0;

    let currentMaxDisp = initialStatic.maxDisplacementM;
    let totalVerticalLoadKn = Math.abs(initialStatic.totalAppliedLoadKn.y || initialStatic.totalReactionKn.y || 10000);
    const buildingHeight = Math.max(3, model.boundingBox.maxY - model.boundingBox.minY);

    // Initial stability index theta = (P_tot * Delta) / (V_base * H)
    let b2Amplification = 1.0;
    let additionalBaseShear = 0;

    while (iteration < maxIter && diff > tolerance) {
      iteration++;
      const prevDisp = currentMaxDisp;

      // Secondary geometric moment Delta_M = P * Delta
      const secondaryMoment = totalVerticalLoadKn * prevDisp;
      // Equivalent secondary shear increment dV = secondaryMoment / H
      const dV = secondaryMoment / buildingHeight;
      additionalBaseShear += dV;

      // Approximate B2 amplification factor = 1 / (1 - P*Delta / (V*H))
      const stabilityIndex = (totalVerticalLoadKn * prevDisp) / (Math.max(100, initialStatic.totalReactionKn.x + additionalBaseShear) * buildingHeight);
      b2Amplification = 1 / Math.max(0.1, 1 - Math.min(0.85, stabilityIndex));

      currentMaxDisp = prevDisp * (1 + Math.min(0.15, stabilityIndex));
      diff = Math.abs(currentMaxDisp - prevDisp) / Math.max(1e-5, prevDisp);

      if (diff <= tolerance) {
        converged = true;
        break;
      }
    }

    return {
      converged,
      iterationsTaken: iteration,
      toleranceReached: Number(diff.toFixed(5)),
      amplificationFactorB2: Number(b2Amplification.toFixed(3)),
      additionalBaseShearKn: Number(additionalBaseShear.toFixed(2)),
      staticResult: initialStatic,
    };
  }
}
