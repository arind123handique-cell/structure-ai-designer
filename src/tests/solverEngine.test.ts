import { describe, it, expect } from 'vitest';
import { SolverEngine } from '@/features/calculations/solverEngine';
import { NormalizedStructuralModel } from '@/features/model/types';

describe('Modular Solver Engine (STAAD.Pro Architecture Sections 13, 14, 15, 16, 17)', () => {
  const portalModel: NormalizedStructuralModel = {
    nodes: new Map([
      [1, { id: 1, x: 0, y: 0, z: 0, isSupport: true }],
      [2, { id: 2, x: 0, y: 3.5, z: 0 }],
      [3, { id: 3, x: 5, y: 3.5, z: 0 }],
      [4, { id: 4, x: 5, y: 0, z: 0, isSupport: true }],
    ]),
    members: new Map([
      [
        1,
        {
          id: 1,
          startNodeId: 1,
          endNodeId: 2,
          length: 3.5,
          classification: 'COLUMN',
          isAutoClassified: false,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
          materialName: 'CONCRETE',
          designStatus: 'PASS',
        },
      ],
      [
        2,
        {
          id: 2,
          startNodeId: 2,
          endNodeId: 3,
          length: 5.0,
          classification: 'BEAM',
          isAutoClassified: false,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.25 },
          materialName: 'CONCRETE',
          designStatus: 'PASS',
        },
      ],
      [
        3,
        {
          id: 3,
          startNodeId: 4,
          endNodeId: 3,
          length: 3.5,
          classification: 'COLUMN',
          isAutoClassified: false,
          section: { type: 'RECTANGULAR', yd: 0.45, zd: 0.3 },
          materialName: 'CONCRETE',
          designStatus: 'PASS',
        },
      ],
    ]),
    plates: new Map(),
    supports: new Map([
      [1, { nodeId: 1, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
      [4, { nodeId: 4, type: 'FIXED', releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false } }],
    ]),
    loadCases: new Map([
      [1, { id: 1, title: 'DEAD LOAD', type: 'DEAD', isCombination: false }],
    ]),
    loadCombinations: new Map(),
    reactions: [],
    memberForces: [],
    storyDrifts: [],
    boundingBox: { minX: 0, maxX: 5, minY: 0, maxY: 3.5, minZ: 0, maxZ: 0 },
    statistics: {
      totalNodes: 4,
      totalMembers: 3,
      totalBeams: 1,
      totalColumns: 2,
      totalPlates: 0,
      totalSupports: 2,
      totalLoadCases: 1,
      totalCombinations: 0,
      maxElevation: 3.5,
      baseElevation: 0,
    },
  };

  it('runs linear static analysis via solver dispatcher', async () => {
    const result = await SolverEngine.solve(portalModel, { solverType: 'LINEAR_STATIC' });
    expect(result.solverType).toBe('LINEAR_STATIC');
    expect(result.staticResult).toBeDefined();
    expect(result.staticResult.equilibriumCheck).toBe('PASS');
  });

  it('computes natural frequencies, periods, and mass participation in Modal analysis', () => {
    const modalRes = SolverEngine.solveModal(portalModel, 4);
    expect(modalRes.modes.length).toBeGreaterThan(0);
    expect(modalRes.fundamentalPeriodSec).toBeGreaterThan(0);
    expect(modalRes.totalMassParticipationX).toBeGreaterThan(50);
    expect(modalRes.modes[0].frequencyHz).toBeGreaterThan(0);
    expect(modalRes.modes[0].modeShapeByLevel.length).toBeGreaterThan(0);
  });

  it('combines response spectrum modal forces via CQC and SRSS', () => {
    const modalRes = SolverEngine.solveModal(portalModel, 4);
    const specCQC = SolverEngine.solveResponseSpectrum(portalModel, modalRes, 'CQC');
    const specSRSS = SolverEngine.solveResponseSpectrum(portalModel, modalRes, 'SRSS');

    expect(specCQC.combinationMethod).toBe('CQC');
    expect(specCQC.spectralBaseShearXKn).toBeGreaterThan(0);
    expect(specSRSS.combinationMethod).toBe('SRSS');
    expect(specSRSS.spectralBaseShearXKn).toBeGreaterThan(0);
  });

  it('executes iterative P-Delta second-order geometric convergence', async () => {
    const pDelta = await SolverEngine.solve(portalModel, { solverType: 'P_DELTA' });
    expect(pDelta.pDeltaResult).toBeDefined();
    expect(pDelta.pDeltaResult?.converged).toBe(true);
    expect(pDelta.pDeltaResult?.amplificationFactorB2).toBeGreaterThanOrEqual(1.0);
  });
});
