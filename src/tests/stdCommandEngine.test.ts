import { describe, it, expect } from 'vitest';
import { StdCommandEngine } from '@/features/anl/stdCommandEngine';
import { NormalizedStructuralModel } from '@/features/model/types';

describe('STAAD.Pro .STD Command Engine (Architecture Section 4 & 37)', () => {
  it('correctly compresses and formats integer ID ranges to STAAD syntax', () => {
    const ids = [1, 2, 3, 4, 5, 8, 10, 11, 12];
    const formatted = StdCommandEngine.formatIdRanges(ids);
    expect(formatted).toBe('1 TO 5 8 10 TO 12');
  });

  it('correctly parses STAAD ID ranges into numeric arrays', () => {
    const tokens = ['1', 'TO', '5', '8', '10', 'TO', '12'];
    const parsed = StdCommandEngine.parseIdRanges(tokens);
    expect(parsed).toEqual([1, 2, 3, 4, 5, 8, 10, 11, 12]);
  });

  it('generates a syntactically valid STAAD.Pro .STD file from a structural model', () => {
    const model: NormalizedStructuralModel = {
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
        [
          1,
          {
            nodeId: 1,
            type: 'FIXED',
            releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
          },
        ],
        [
          4,
          {
            nodeId: 4,
            type: 'FIXED',
            releases: { fx: false, fy: false, fz: false, mx: false, my: false, mz: false },
          },
        ],
      ]),
      loadCases: new Map([
        [1, { id: 1, title: 'DEAD LOAD', type: 'DEAD', isCombination: false }],
        [2, { id: 2, title: 'LIVE LOAD', type: 'LIVE', isCombination: false }],
      ]),
      loadCombinations: new Map([
        [
          101,
          {
            id: 101,
            title: '1.5 DL + 1.5 LL',
            factors: [
              { loadCaseId: 1, factor: 1.5 },
              { loadCaseId: 2, factor: 1.5 },
            ],
          },
        ],
      ]),
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
        totalLoadCases: 2,
        totalCombinations: 1,
        maxElevation: 3.5,
        baseElevation: 0,
      },
    };

    const stdOutput = StdCommandEngine.generateStd(model, {
      jobName: 'PORTAL_FRAME_TEST',
      engineer: 'Er. Test Engineer',
      date: '2026-09-05',
    });

    expect(stdOutput).toContain('STAAD SPACE');
    expect(stdOutput).toContain('START JOB INFORMATION');
    expect(stdOutput).toContain('ENGINEER DATE 2026-09-05');
    expect(stdOutput).toContain('JOINT COORDINATES');
    expect(stdOutput).toContain('1 0.0000 0.0000 0.0000;');
    expect(stdOutput).toContain('MEMBER INCIDENCES');
    expect(stdOutput).toContain('1 1 2;');
    expect(stdOutput).toContain('MEMBER PROPERTY AMERICAN');
    expect(stdOutput).toContain('PRIS YD 0.4500 ZD 0.3000');
    expect(stdOutput).toContain('SUPPORTS');
    expect(stdOutput).toContain('1 4 FIXED');
    expect(stdOutput).toContain('LOAD 1 LOADTYPE DEAD TITLE DEAD LOAD');
    expect(stdOutput).toContain('SELFWEIGHT Y -1');
    expect(stdOutput).toContain('LOAD COMB 101 1.5 DL + 1.5 LL');
    expect(stdOutput).toContain('1 1.5 2 1.5');
    expect(stdOutput).toContain('PERFORM ANALYSIS');
    expect(stdOutput).toContain('START CONCRETE DESIGN');
    expect(stdOutput).toContain('FINISH');
  });
});
