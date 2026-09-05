import { describe, it, expect } from 'vitest';
import { ResultsDatabase } from '@/features/model/resultsDatabase';
import { NormalizedStructuralModel } from '@/features/model/types';

describe('Results Database Query Service (STAAD.Pro Architecture Section 23)', () => {
  const mockModel: NormalizedStructuralModel = {
    nodes: new Map([[1, { id: 1, x: 0, y: 0, z: 0, isSupport: true }]]),
    members: new Map([
      [
        10,
        {
          id: 10,
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
    ]),
    plates: new Map(),
    supports: new Map(),
    loadCases: new Map([[1, { id: 1, title: 'DEAD LOAD', type: 'DEAD', isCombination: false }]]),
    loadCombinations: new Map(),
    nodeDisplacements: new Map([
      [1, { 1: [0.001, -0.002, 0.0005, 0.0001, 0, 0.0002] }],
    ]),
    reactions: [
      { nodeId: 1, loadCaseId: 1, fx: 15.0, fy: 850.0, fz: -8.0, mx: 12.0, my: 0.0, mz: 35.0 },
    ],
    memberForces: [
      { memberId: 10, loadCaseId: 1, sectionLocation: 0, axial: -850, vy: 15, vz: 8, torsion: 2, my: 10, mz: 35 },
      { memberId: 10, loadCaseId: 1, sectionLocation: 3.5, axial: -830, vy: 15, vz: 8, torsion: 2, my: 20, mz: -17.5 },
    ],
    designSummaries: new Map([
      [
        10,
        {
          memberId: 10,
          classification: 'COLUMN',
          sectionDimensions: '300x450mm',
          governingLoadCase: 1,
          maxAxial: 850,
          maxShear: 15,
          maxMoment: 35,
          status: 'PASS',
        },
      ],
    ]),
    storyDrifts: [
      {
        storyName: 'STOREY 1',
        height: 3.5,
        loadCaseId: 1,
        avgDispCm: 0.2,
        driftCm: 0.2,
        driftRatio: 0.00057,
        allowableRatio: 0.004,
        status: 'PASS',
      },
    ],
    boundingBox: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10 },
    statistics: {
      totalNodes: 1,
      totalMembers: 1,
      totalBeams: 0,
      totalColumns: 1,
      totalPlates: 0,
      totalSupports: 1,
      totalLoadCases: 1,
      totalCombinations: 0,
      maxElevation: 3.5,
      baseElevation: 0,
    },
  };

  it('queries node 6-DOF displacements correctly', () => {
    const db = new ResultsDatabase(mockModel);
    const disp = db.getNodeDisplacement(1, 1);
    expect(disp).not.toBeNull();
    expect(disp?.ux).toBe(0.001);
    expect(disp?.uy).toBe(-0.002);
    expect(disp?.resultantM).toBeCloseTo(Math.sqrt(0.001 ** 2 + 0.002 ** 2 + 0.0005 ** 2), 6);
  });

  it('computes member force envelopes across stations and load cases', () => {
    const db = new ResultsDatabase(mockModel);
    const env = db.getMemberEnvelopeForces(10);
    expect(env).not.toBeNull();
    expect(env?.maxShearYKn).toBe(15);
    expect(env?.maxMomentZKnm).toBe(35);
    expect(env?.minAxialKn).toBe(-850);
  });

  it('retrieves joint reactions and total equilibrium', () => {
    const db = new ResultsDatabase(mockModel);
    const rxn = db.getJointReaction(1, 1);
    expect(rxn?.fy).toBe(850.0);

    const total = db.getTotalReactions(1);
    expect(total.totalFy).toBe(850.0);
    expect(total.totalFx).toBe(15.0);
  });

  it('queries design summaries and flags failed elements', () => {
    const db = new ResultsDatabase(mockModel);
    const design = db.getDesignResult(10);
    expect(design?.status).toBe('PASS');
    expect(db.getFailedMembers()).toHaveLength(0);
  });
});
