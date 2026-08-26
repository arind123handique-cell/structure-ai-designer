import { describe, it, expect } from 'vitest';
import { FoundationPunchingShear } from '@/features/codes/foundation/punchingShear';
import { PileCapDesignEngine } from '@/features/design/pilecap/pileCapDesignEngine';
import { CombinedPileCapEngine } from '@/features/design/pilecap/combinedPileCapEngine';

describe('IS 456 & SP:34 Rigid Pile Cap Design Engine', () => {
  it('should verify two-way punching shear on column perimeter at d/2', () => {
    const punching = FoundationPunchingShear.checkPunching({
      colWidth: 450,
      colDepth: 550,
      effectiveDepth: 700,
      fck: 25,
      factoredPunchingForce: 1200,
    });

    expect(punching.status).toBe('PASS');
    expect(punching.criticalPerimeter).toBe(4800);
    expect(punching.tau_vp).toBeCloseTo(0.357, 2);
    expect(punching.tau_cp).toBeCloseTo(1.25, 2);
  });

  it('should compute pile count correctly based on axial load, 10% self-weight, and single pile capacity', () => {
    // Pu = 1600 kN, P_working = 1066.7 kN, P_total_working = 1.10 * 1066.7 = 1173.3 kN
    // Qsafe = 450 kN/pile -> Np = ceil(1173.3 / 450) = 3 piles (3 * 450 = 1350 kN > 1173.3 kN)
    const output3Pile = PileCapDesignEngine.design({
      supportNodeId: 10,
      colWidth: 450,
      colDepth: 550,
      pileDiameter: 500,
      safePileCapacity: 450,
      factoredVerticalLoad: 1600,
      factoredMomentX: 0,
      factoredMomentY: 0,
      fck: 25,
      fy: 500,
      governingLoadCase: 5,
    });

    expect(output3Pile.pileCount).toBe(3);
    expect(output3Pile.factoredVerticalLoad).toBe(1600);
    expect(output3Pile.workingVerticalLoad).toBeCloseTo(1066.7, 1);

    // Pu = 2200 kN -> P_total_working = 1.10 * (2200 / 1.5) = 1613.3 kN -> Np = ceil(1613.3 / 450) = 4 piles
    const output4Pile = PileCapDesignEngine.design({
      supportNodeId: 11,
      colWidth: 450,
      colDepth: 550,
      pileDiameter: 500,
      safePileCapacity: 450,
      factoredVerticalLoad: 2200,
      fck: 25,
      fy: 500,
    });
    expect(output4Pile.pileCount).toBe(4);
  });

  it('should run master PileCapDesignEngine end-to-end with Top & Side Face rebar', () => {
    const output = PileCapDesignEngine.design({
      supportNodeId: 10,
      colWidth: 450,
      colDepth: 550,
      pileDiameter: 500,
      safePileCapacity: 450,
      factoredVerticalLoad: 1600,
      factoredMomentX: 25,
      factoredMomentY: 15,
      fck: 25,
      fy: 500,
      governingLoadCase: 5,
    });

    expect(output.status).toBe('PASS');
    expect(output.pileCount).toBe(3);
    expect(output.capLength).toBeGreaterThanOrEqual(2000);
    expect(output.capDepth).toBeGreaterThanOrEqual(750);
    expect(output.columnPunching.status).toBe('PASS');
    expect(output.rebarCalloutX).toContain('T16');
    expect(output.topRebarCallout).toContain('T12');
    expect(output.sideFaceRebarCallout).toContain('T12');
    expect(output.topAstProv).toBeGreaterThanOrEqual(output.topAstReq);
    expect(output.sideFaceAstProv).toBeGreaterThanOrEqual(output.sideFaceAstReq);
    expect(output.calculationReport.sections.length).toBe(5);
  });

  it('should verify 3-Pile Triangular Cap geometry, spacing, and dimensions as per IS 2911 Cl. 6.6', () => {
    const Dp = 500;
    const output = PileCapDesignEngine.design({
      supportNodeId: 3,
      colWidth: 450,
      colDepth: 550,
      pileDiameter: Dp,
      safePileCapacity: 450,
      customPileCount: 3,
      factoredVerticalLoad: 1400,
      fck: 25,
      fy: 500,
    });

    expect(output.pileCount).toBe(3);
    expect(output.capShape).toBe('TRIANGULAR');
    expect(output.pileSpacing).toBe(3 * Dp); // 1500 mm
    expect(output.edgeDistance).toBe(1 * Dp); // 500 mm (clear overhang = 250mm > 150mm)
    expect(output.capLength).toBe(2500); // Base L = 1500 + 2*500 = 2500mm
    expect(output.capWidth).toBe(2299); // Altitude B = round(1500 * sqrt(3)/2 + 1000) = 2299mm
    expect(output.capDepth).toBeGreaterThanOrEqual(750);
    expect(output.pileOffsets.length).toBe(3);

    // Verify centroid of 3-pile triangular cap is (0, 0)
    const sumX = output.pileOffsets.reduce((acc, p) => acc + p.x, 0);
    const sumY = output.pileOffsets.reduce((acc, p) => acc + p.y, 0);
    expect(Math.abs(sumX)).toBeLessThanOrEqual(1);
    expect(Math.abs(sumY)).toBeLessThanOrEqual(2);

    expect(output.columnPunching.status).toBe('PASS');
    expect(output.status).toBe('PASS');
  });

  it('should verify 5-Pile Pentagonal Cap geometry, chord spacing, and dimensions as per IS 2911 & SP:34', () => {
    const Dp = 500;
    const output = PileCapDesignEngine.design({
      supportNodeId: 5,
      colWidth: 450,
      colDepth: 550,
      pileDiameter: Dp,
      safePileCapacity: 450,
      customPileCount: 5,
      factoredVerticalLoad: 2400,
      fck: 25,
      fy: 500,
    });

    expect(output.pileCount).toBe(5);
    expect(output.capShape).toBe('PENTAGONAL');
    expect(output.pileSpacing).toBe(3 * Dp); // 1500 mm chord spacing
    expect(output.edgeDistance).toBe(1 * Dp); // 500 mm
    expect(output.capWidth).toBeGreaterThanOrEqual(3000);
    expect(output.capLength).toBeGreaterThanOrEqual(3000);
    expect(output.capDepth).toBeGreaterThanOrEqual(750);
    expect(output.pileOffsets.length).toBe(5);

    // Verify centroid of 5-pile pentagonal cap is (0, 0)
    const sumX = output.pileOffsets.reduce((acc, p) => acc + p.x, 0);
    const sumY = output.pileOffsets.reduce((acc, p) => acc + p.y, 0);
    expect(Math.abs(sumX)).toBeLessThanOrEqual(2);
    expect(Math.abs(sumY)).toBeLessThanOrEqual(2);

    // Check distance between adjacent piles in pentagon is approximately s = 1500mm
    const p1 = output.pileOffsets[0];
    const p2 = output.pileOffsets[1];
    const dist12 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    expect(dist12).toBeCloseTo(1500, -1); // Within 10mm rounding

    expect(output.columnPunching.status).toBe('PASS');
    expect(output.status).toBe('PASS');
  });

  it('should detect and design combined pile caps for merged columns and generate IS 2911 calculation report', () => {
    const nodes = [
      { nodeId: 21, x: 0, z: 0, Pu: 1200, colLabel: 'C21', colSlNo: 21 },
      { nodeId: 22, x: 1.5, z: 0, Pu: 1400, colLabel: 'C22', colSlNo: 22 },
    ];
    const grp = CombinedPileCapEngine.designMergedCap(nodes, 350, 1, true);

    expect(grp.groupId).toBe('MANUAL-1');
    expect(grp.reason).toBe('MANUAL_MERGE');
    expect(grp.label).toContain('C21+C22');
    expect(grp.totalFactoredLoad).toBe(2600);
    expect(grp.pileCount).toBeGreaterThanOrEqual(4);
    expect(grp.capLength).toBeGreaterThanOrEqual(2000);
    expect(grp.capDepth).toBeGreaterThanOrEqual(900);
    expect(grp.botRebarCallout).toContain('T16');
    expect(grp.topRebarCallout).toContain('T12');
    expect(grp.shearWallStirrupCallout).toContain('T10');
    expect(grp.status).toBe('PASS');

    const report = CombinedPileCapEngine.generateCalculationReport(grp);
    expect(report.title).toContain('PC-C21+C22');
    expect(report.designCode).toContain('IS 2911');
    expect(report.sections.length).toBe(3);
    expect(report.overallStatus).toBe('PASS');
  });

  it('should exclude detached column joints from combined pile caps so they remain standalone individual pile caps', () => {
    const mockModel: any = {
      supports: new Map([
        [2, { nodeId: 2 }],
        [3, { nodeId: 3 }],
        [6, { nodeId: 6 }],
        [364, { nodeId: 364 }],
        [365, { nodeId: 365 }],
        [366, { nodeId: 366 }],
      ]),
      nodes: new Map([
        [2, { id: 2, x: 0, y: 0, z: 0 }],
        [3, { id: 3, x: 6.0, y: 0, z: 0 }],
        [6, { id: 6, x: 12.0, y: 0, z: 0 }],
        [364, { id: 364, x: 20.0, y: 0, z: 5.0 }],
        [365, { id: 365, x: 21.0, y: 0, z: 5.0 }],
        [366, { id: 366, x: 22.0, y: 0, z: 5.0 }],
      ]),
      plates: new Map([
        [1, { id: 1, nodeIds: [364, 365, 366] }],
      ]),
      reactions: [],
      memberForces: [],
      members: new Map(),
    };

    const dummyCaps = new Map<number, any>();

    // Case 1: Auto-detection disabled — no combined cap is formed without manual merge
    const initialGroups = CombinedPileCapEngine.detectAndDesignAll(mockModel, dummyCaps, 350, []);
    expect(initialGroups.length).toBe(0);

    // Case 2: When user explicitly detaches nodes 364 and 365 — still no combined cap
    const detached = [364, 365];
    const afterDetachGroups = CombinedPileCapEngine.detectAndDesignAll(mockModel, dummyCaps, 350, [], detached);
    expect(afterDetachGroups.length).toBe(0);
  });

  it('should size combined pile cap based on single pile safe capacity Qsafe (280 kN) and support manual design overrides', () => {
    // 5-column combined shear wall foundation with Pu = 4859 kN
    const mockNodes = [
      { nodeId: 364, x: 10, z: 0, Pu: 980, colLabel: 'C20', colSlNo: 20 },
      { nodeId: 365, x: 11, z: 0, Pu: 970, colLabel: 'C21', colSlNo: 21 },
      { nodeId: 366, x: 12, z: 0, Pu: 970, colLabel: 'C22', colSlNo: 22 },
      { nodeId: 367, x: 13, z: 0, Pu: 970, colLabel: 'C23', colSlNo: 23 },
      { nodeId: 927, x: 14, z: 0, Pu: 969, colLabel: 'C24', colSlNo: 24 },
    ];

    const Dp = 350; // Dia 350mm pile
    const Qsafe = 280; // 280 kN safe pile load capacity

    // 1. Auto-Design with Qsafe = 280 kN
    const autoCap = CombinedPileCapEngine.designShearWallCap(mockNodes, Dp, 1, undefined, Qsafe);

    // Pu = 4859 kN -> P_work = 1.10 * 4859/1.5 = 3563.3 kN
    // Min piles req = ceil(3563.3 / 280) = 13 piles -> grid gives 14 or 16 piles
    expect(autoCap.pileCount).toBeGreaterThanOrEqual(13);
    const workLoadPerPile = Math.round(autoCap.totalWorkingLoad / autoCap.pileCount);
    expect(workLoadPerPile).toBeLessThanOrEqual(Qsafe);
    expect(autoCap.status).toBe('PASS');

    // 2. Manual Custom Design Overrides (e.g. 18 piles, custom size 4500x2000x1000mm)
    const customOverride = {
      customPileCount: 18,
      customCapLength: 4500,
      customCapWidth: 2000,
      customCapDepth: 1000,
      customSafePileCapacity: 280,
    };

    const manualCap = CombinedPileCapEngine.designShearWallCap(mockNodes, Dp, 1, customOverride, Qsafe);
    expect(manualCap.pileCount).toBe(18);
    expect(manualCap.capLength).toBe(4500);
    expect(manualCap.capWidth).toBe(2000);
    expect(manualCap.capDepth).toBe(1000);
    expect(manualCap.isCustomized).toBe(true);
    expect(Math.round(manualCap.totalWorkingLoad / 18)).toBeLessThanOrEqual(280);
    expect(manualCap.status).toBe('PASS');
  });

  it('should standardize uniform LxB and depth across all supports requiring the same pile count', () => {
    // 3 supports requiring 4-pile caps with varying loads (e.g. Pu = 1800, 2000, 2300 kN)
    // 2 supports requiring 2-pile caps with varying loads (e.g. Pu = 800, 950 kN)
    const inputs = [
      {
        supportNodeId: 1,
        colWidth: 450,
        colDepth: 550,
        pileDiameter: 450,
        safePileCapacity: 400,
        factoredVerticalLoad: 1800,
        fck: 25,
        fy: 500,
      },
      {
        supportNodeId: 2,
        colWidth: 450,
        colDepth: 550,
        pileDiameter: 450,
        safePileCapacity: 400,
        factoredVerticalLoad: 2000,
        fck: 25,
        fy: 500,
      },
      {
        supportNodeId: 3,
        colWidth: 450,
        colDepth: 550,
        pileDiameter: 450,
        safePileCapacity: 400,
        factoredVerticalLoad: 2100,
        fck: 25,
        fy: 500,
      },
      {
        supportNodeId: 4,
        colWidth: 400,
        colDepth: 400,
        pileDiameter: 450,
        safePileCapacity: 400,
        factoredVerticalLoad: 800,
        fck: 25,
        fy: 500,
      },
      {
        supportNodeId: 5,
        colWidth: 400,
        colDepth: 400,
        pileDiameter: 450,
        safePileCapacity: 400,
        factoredVerticalLoad: 950,
        fck: 25,
        fy: 500,
      },
    ];

    const results = PileCapDesignEngine.batchDesignAndStandardize(inputs);

    const cap1 = results.get(1)!;
    const cap2 = results.get(2)!;
    const cap3 = results.get(3)!;
    const cap4 = results.get(4)!;
    const cap5 = results.get(5)!;

    // Supports 1, 2, 3 should all be 4-pile caps and have identical L, B, and governing D
    expect(cap1.pileCount).toBe(4);
    expect(cap2.pileCount).toBe(4);
    expect(cap3.pileCount).toBe(4);
    expect(cap1.capLength).toBe(cap2.capLength);
    expect(cap1.capLength).toBe(cap3.capLength);
    expect(cap1.capWidth).toBe(cap2.capWidth);
    expect(cap1.capWidth).toBe(cap3.capWidth);
    expect(cap1.capDepth).toBe(cap2.capDepth);
    expect(cap1.capDepth).toBe(cap3.capDepth);

    // Supports 4, 5 should all be 2-pile caps and have identical L, B, and governing D
    expect(cap4.pileCount).toBe(2);
    expect(cap5.pileCount).toBe(2);
    expect(cap4.capLength).toBe(cap5.capLength);
    expect(cap4.capWidth).toBe(cap5.capWidth);
    expect(cap4.capDepth).toBe(cap5.capDepth);
  });

  it('should correctly categorize and filter pile caps into distinct pile groups (3-pile, 4-pile, 5-pile, etc.)', () => {
    const inputs = [
      { supportNodeId: 101, factoredVerticalLoad: 900, customPileCount: 2, fck: 25, fy: 500 },
      { supportNodeId: 102, factoredVerticalLoad: 1300, customPileCount: 3, fck: 25, fy: 500 },
      { supportNodeId: 103, factoredVerticalLoad: 1800, customPileCount: 4, fck: 25, fy: 500 },
      { supportNodeId: 104, factoredVerticalLoad: 2300, customPileCount: 5, fck: 25, fy: 500 },
      { supportNodeId: 105, factoredVerticalLoad: 2700, customPileCount: 6, fck: 25, fy: 500 },
      { supportNodeId: 106, factoredVerticalLoad: 1250, customPileCount: 3, fck: 25, fy: 500 },
    ];

    const designedMap = new Map<number, any>();
    inputs.forEach((inp) => {
      designedMap.set(inp.supportNodeId, PileCapDesignEngine.design(inp as any));
    });

    const allCaps = Array.from(designedMap.values());

    // Filter by group
    const filterByGroup = (group: 'ALL' | number) => {
      if (group === 'ALL') return allCaps;
      return allCaps.filter((c) => c.pileCount === group);
    };

    expect(filterByGroup('ALL').length).toBe(6);
    expect(filterByGroup(2).length).toBe(1);
    expect(filterByGroup(3).length).toBe(2);
    expect(filterByGroup(4).length).toBe(1);
    expect(filterByGroup(5).length).toBe(1);
    expect(filterByGroup(6).length).toBe(1);

    // Verify 3-pile cap items
    const threePileCaps = filterByGroup(3);
    expect(threePileCaps.every((c) => c.pileCount === 3 && c.capShape === 'TRIANGULAR')).toBe(true);

    // Verify 5-pile cap items
    const fivePileCaps = filterByGroup(5);
    expect(fivePileCaps.every((c) => c.pileCount === 5 && c.capShape === 'PENTAGONAL')).toBe(true);
  });
});




