import { describe, it, expect } from 'vitest';
import { ANLParser } from '@/features/anl/anlParser';

describe('ANLParser Full Pipeline', () => {
  const sampleSTAAD = `
  STAAD SPACE
  ENGINEER DATE 23-Jun-26
  JOINT COORDINATES
  1 0 0 0; 2 5.0 0 0; 3 0 3.5 0; 4 5.0 3.5 0;
  MEMBER INCIDENCES
  1 1 3; 2 2 4; 3 3 4;
  MEMBER PROPERTY
  1 2 PRIS YD 0.45 ZD 0.45
  3 PRIS YD 0.50 ZD 0.30
  SUPPORTS
  1 2 FIXED
  LOAD 1 LOADTYPE DEAD TITLE DL
  SELFWEIGHT Y -1
  LOAD 2 LOADTYPE LIVE TITLE LL
  LOAD COMB 3 COMB - 1.5 DEAD + 1.5 LIVE
  1 1.5 2 1.5
  PERFORM ANALYSIS
  PRINT SUPPORT REACTION
  SUPPORT REACTIONS -UNIT KN METE
  JOINT LOAD FORCE-X FORCE-Y FORCE-Z MOM-X MOM-Y MOM Z
  1 1 12.5 450.0 -5.0 1.2 0.0 45.0
  1 2 5.0 150.0 -2.0 0.5 0.0 15.0
  2 1 -12.5 450.0 5.0 -1.2 0.0 -45.0
  2 2 -5.0 150.0 2.0 -0.5 0.0 -15.0
  `;

  it('should parse joints accurately', () => {
    const result = ANLParser.parse(sampleSTAAD);
    expect(result.model.nodes.size).toBe(4);
    expect(result.model.nodes.get(1)).toEqual({ id: 1, x: 0, y: 0, z: 0, isSupport: true });
    expect(result.model.nodes.get(4)).toEqual({ id: 4, x: 5.0, y: 3.5, z: 0 });
  });

  it('should parse members and classify columns vs beams', () => {
    const result = ANLParser.parse(sampleSTAAD);
    expect(result.model.members.size).toBe(3);

    const col1 = result.model.members.get(1);
    const beam1 = result.model.members.get(3);

    expect(col1?.classification).toBe('COLUMN');
    expect(col1?.section.yd).toBe(0.45);
    expect(col1?.section.zd).toBe(0.45);

    expect(beam1?.classification).toBe('BEAM');
    expect(beam1?.section.yd).toBe(0.50);
    expect(beam1?.section.zd).toBe(0.30);
  });

  it('should parse load cases and combinations', () => {
    const result = ANLParser.parse(sampleSTAAD);
    expect(result.model.loadCases.size).toBe(3);
    expect(result.model.loadCases.get(1)?.title).toBe('DL');
    expect(result.model.loadCases.get(2)?.title).toBe('LL');
    expect(result.model.loadCases.get(3)?.isCombination).toBe(true);
  });

  it('should parse support reactions table', () => {
    const result = ANLParser.parse(sampleSTAAD);
    expect(result.model.reactions.length).toBe(4);
    const r1 = result.model.reactions[0];
    expect(r1.nodeId).toBe(1);
    expect(r1.loadCaseId).toBe(1);
    expect(r1.fy).toBe(450.0);
    expect(r1.fx).toBe(12.5);
  });
});
