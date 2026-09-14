import { describe, it, expect } from 'vitest';
import { FoundationGeometryTrimming, FoundationCapFootprint } from '../features/design/gradebeam/foundationGeometryTrimming';
import { GradeBeamDesignEngine, GradeBeamOverride } from '../features/design/gradebeam/gradeBeamEngine';
import { IS13920GradeBeam } from '../features/codes/is13920/gradeBeam';

describe('Foundation Geometry Trimming Engine', () => {
  it('trims grade beam between two standalone rectangular pile caps without internal overlap', () => {
    // Cap 1 at (0, 0), size 2.0m x 2.0m (halfX = 1.0m, halfZ = 1.0m)
    const cap1: FoundationCapFootprint = {
      nodeId: 1,
      cx: 0,
      cz: 0,
      halfX: 1.0,
      halfZ: 1.0,
      rotationDeg: 0,
      isCombined: false,
    };

    // Cap 2 at (6.0, 0), size 2.0m x 2.0m (halfX = 1.0m, halfZ = 1.0m)
    const cap2: FoundationCapFootprint = {
      nodeId: 2,
      cx: 6.0,
      cz: 0,
      halfX: 1.0,
      halfZ: 1.0,
      rotationDeg: 0,
      isCombined: false,
    };

    const trimmed = FoundationGeometryTrimming.trimBeamToCapFaces({
      x1: 0,
      z1: 0,
      x2: 6.0,
      z2: 0,
      cap1,
      cap2,
      beamWidthM: 0.3,
    });

    // Beam must start at x=1.0 (face of Cap 1) and end at x=5.0 (face of Cap 2)
    expect(trimmed.isSuppressed).toBe(false);
    expect(trimmed.startX).toBeCloseTo(1.0, 2);
    expect(trimmed.startZ).toBeCloseTo(0, 2);
    expect(trimmed.endX).toBeCloseTo(5.0, 2);
    expect(trimmed.endZ).toBeCloseTo(0, 2);
    expect(trimmed.clearSpan).toBeCloseTo(4.0, 2);
    expect(trimmed.startOffset).toBeCloseTo(1.0, 2);
    expect(trimmed.endOffset).toBeCloseTo(1.0, 2);
  });

  it('suppresses beams connecting two columns swallowed inside the same monolithic combined pile cap', () => {
    // Combined pile cap containing both Node 1 and Node 2
    const combinedCap: FoundationCapFootprint = {
      cx: 2.5,
      cz: 0,
      halfX: 3.5,
      halfZ: 2.0,
      isCombined: true,
      minX: -1.0,
      maxX: 6.0,
      minZ: -2.0,
      maxZ: 2.0,
      absorbedNodeIds: [1, 2],
    };

    const trimmed = FoundationGeometryTrimming.trimBeamToCapFaces({
      x1: 0,
      z1: 0,
      x2: 5.0,
      z2: 0,
      cap1: combinedCap,
      cap2: combinedCap,
      beamWidthM: 0.3,
    });

    expect(trimmed.isSuppressed).toBe(true);
    expect(trimmed.clearSpan).toBe(0);
  });

  it('trims beam connecting a standalone cap to a monolithic combined pile cap', () => {
    // Standalone cap at (0, 0), halfX = 0.8m
    const cap1: FoundationCapFootprint = {
      nodeId: 1,
      cx: 0,
      cz: 0,
      halfX: 0.8,
      halfZ: 0.8,
      isCombined: false,
    };

    // Combined cap starting at x=4.0m to x=10.0m
    const cap2: FoundationCapFootprint = {
      cx: 7.0,
      cz: 0,
      halfX: 3.0,
      halfZ: 2.0,
      isCombined: true,
      minX: 4.0,
      maxX: 10.0,
      minZ: -2.0,
      maxZ: 2.0,
      absorbedNodeIds: [2, 3],
    };

    // Column 2 is at x=5.5m (inside combined cap)
    const trimmed = FoundationGeometryTrimming.trimBeamToCapFaces({
      x1: 0,
      z1: 0,
      x2: 5.5,
      z2: 0,
      cap1,
      cap2,
      beamWidthM: 0.3,
    });

    expect(trimmed.isSuppressed).toBe(false);
    // Exits Cap 1 at x = 0.8
    expect(trimmed.startX).toBeCloseTo(0.8, 2);
    // Enters Combined Cap at x = 4.0
    expect(trimmed.endX).toBeCloseTo(4.0, 2);
    expect(trimmed.clearSpan).toBeCloseTo(3.2, 2);
  });

  it('trims secondary tie beam framing into the side face of a primary grade beam', () => {
    // Secondary tie beam framing into primary beam of width 0.3m
    const trimmed = FoundationGeometryTrimming.trimBeamToCapFaces({
      x1: 0,
      z1: 0,
      x2: 0,
      z2: 4.0,
      cap1: null,
      cap2: null,
      isSecondary: true,
      primaryBeamWidthM: 0.3,
    });

    expect(trimmed.isSuppressed).toBe(false);
    expect(trimmed.startOffset).toBeCloseTo(0.15, 2); // 0.3 / 2
    expect(trimmed.endOffset).toBeCloseTo(0.15, 2);
    expect(trimmed.clearSpan).toBeCloseTo(3.7, 2);
  });
});

describe('IS 13920 Grade Beam Override and Customization', () => {
  it('applies custom section sizing and rebar overrides correctly', () => {
    const override: GradeBeamOverride = {
      b: 350,
      D: 500,
      customTopCount: 4,
      customTopDia: 20,
      customBottomCount: 4,
      customBottomDia: 20,
      customStirrupDia: 10,
      customEndSpacing: 80,
      customMidSpacing: 120,
      topRebarCallout: '4-T20 (Continuous Full Length)',
      bottomRebarCallout: '4-T20 (Continuous Full Length)',
      stirrupCallout: '2L-10mm @ 80mm c/c (End 1000mm zone) / 120mm c/c (Mid)',
    };

    const output = GradeBeamDesignEngine.design({
      gradeBeamId: 'GB-1-2',
      startNodeId: 1,
      endNodeId: 2,
      startColumnLabel: 'C1',
      endColumnLabel: 'C2',
      startPileCapLabel: 'PC-1',
      endPileCapLabel: 'PC-2',
      spanLength: 5.0,
      b: 300,
      D: 450,
      fck: 25,
      fy: 500,
      factoredPu1: 1500,
      factoredPu2: 1200,
      beamType: 'PRIMARY',
      override,
    });

    expect(output.b).toBe(350);
    expect(output.D).toBe(500);
    expect(output.isCustomized).toBe(true);
    expect(output.topRebarCallout).toBe('4-T20 (Continuous Full Length)');
    expect(output.bottomRebarCallout).toBe('4-T20 (Continuous Full Length)');
    expect(output.status).toBe('PASS');
  });

  it('validates IS 13920 live check when rebar is customized below minimum required', () => {
    const check = IS13920GradeBeam.design({
      b: 300,
      D: 450,
      spanLength: 6.0,
      fck: 25,
      fy: 500,
      factoredPu1: 3000,
      factoredPu2: 2500,
      customTopCount: 2,
      customTopDia: 12, // provided 226 mm2 < req ~680 mm2
    });

    expect(check.status).toBe('WARNING');
    expect(check.warnings.some((w) => w.includes('Custom top steel'))).toBe(true);
  });
});
