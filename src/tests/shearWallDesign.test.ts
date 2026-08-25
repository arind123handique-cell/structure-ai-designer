import { describe, it, expect } from 'vitest';
import { IS13920ShearWall } from '@/features/codes/is13920/shearWall';
import { ShearWallEngine } from '@/features/design/shearwall/shearWallEngine';
import { ModelNormalizer } from '@/features/model/modelNormalizer';

describe('IS 13920:2016 Ductile Shear Wall Design Engine', () => {
  it('should verify minimum wall thickness requirements', () => {
    const wall1 = IS13920ShearWall.designWall({
      wallId: 1,
      Lw: 3000,
      tw: 230,
      Hw: 3500,
      fck: 25,
      fy: 500,
      Pu: 800,
      Vu: 150,
      Mu: 300,
      isMultiStorey: true,
    });
    expect(wall1.minThicknessCheck).toBe(true);

    const wall2 = IS13920ShearWall.designWall({
      wallId: 2,
      Lw: 3000,
      tw: 120, // Too thin
      Hw: 3500,
      fck: 25,
      fy: 500,
      Pu: 800,
      Vu: 150,
      Mu: 300,
      isMultiStorey: true,
    });
    expect(wall2.minThicknessCheck).toBe(false);
    expect(wall2.status).toBe('FAIL');
  });

  it('should trigger boundary elements when extreme fiber stress sigma_c > 0.2 fck', () => {
    // fck = 25 N/mm2 -> 0.2 * fck = 5.0 N/mm2
    // High moment Mu = 1100 kNm, Pu = 1800 kN on 3.0m x 0.23m wall
    const wall = IS13920ShearWall.designWall({
      wallId: 3,
      Lw: 3000,
      tw: 230,
      Hw: 3500,
      fck: 25,
      fy: 500,
      Pu: 1800,
      Vu: 250,
      Mu: 1100,
    });

    expect(wall.boundary.extremeFiberStress).toBeGreaterThan(5.0);
    expect(wall.boundary.isBoundaryElementRequired).toBe(true);
    expect(wall.boundary.recommendedRebarCallout).toMatch(/\d+-T\d+/);
    expect(wall.boundary.confiningHoopSpacing).toBeLessThanOrEqual(100);
  });

  it('should run master ShearWallEngine end-to-end', () => {
    const output = ShearWallEngine.design({
      wallId: 101,
      length: 3.2,
      thickness: 230,
      height: 3.5,
      fck: 25,
      fy: 500,
      Pu: 1200,
      Vu: 200,
      Mu: 450,
      governingLoadCase: 5,
    });

    expect(output.status).toBe('PASS');
    expect(output.result.webVerticalRebar).toContain('Curtains');
    expect(output.calculationReport.sections.length).toBe(3);
  });

  it('should auto-fix failing shear walls by upsizing thickness & configuring ductile detailing', () => {
    const failingInput = {
      wallId: 102,
      length: 2.5,
      thickness: 150, // Non-compliant (< 200mm)
      height: 3.5,
      fck: 20,
      fy: 500,
      Pu: 2000,
      Vu: 800, // Very high shear
      Mu: 900,
      governingLoadCase: 5,
    };

    const fixResult = ShearWallEngine.autoFix(failingInput);
    expect(fixResult.fixedInput.thickness).toBeGreaterThanOrEqual(200);
    expect(['PASS', 'WARNING']).toContain(fixResult.fixedOutput.status);
    expect(fixResult.fixedOutput.result.minThicknessCheck).toBe(true);
    expect(fixResult.fixedOutput.result.shearStatus).toBe('PASS');
    expect(fixResult.changesApplied.length).toBeGreaterThan(0);
    expect(fixResult.changesApplied.some((c) => c.includes('thickness') || c.includes('IS 13920'))).toBe(true);
  });

  it('should support manual overrides on web vertical/horizontal mesh and boundary elements', () => {
    const customWall = ShearWallEngine.design({
      wallId: 103,
      length: 3.5,
      thickness: 250,
      height: 3.5,
      fck: 30,
      fy: 500,
      Pu: 1400,
      Vu: 300,
      Mu: 650,
      governingLoadCase: 5,
      customWebVerticalDia: 12,
      customWebVerticalSpacing: 125,
      customWebHorizontalDia: 12,
      customWebHorizontalSpacing: 100,
      customWebCurtains: 2,
      customBoundaryLength: 600,
      customBoundaryBarCount: 12,
      customBoundaryBarDia: 20,
      customBoundaryTieDia: 10,
      customBoundaryTieSpacing: 75,
    });

    expect(customWall.result.webVerticalDia).toBe(12);
    expect(customWall.result.webVerticalSpacing).toBe(125);
    expect(customWall.result.webHorizontalDia).toBe(12);
    expect(customWall.result.webHorizontalSpacing).toBe(100);
    expect(customWall.result.boundary.boundaryLength).toBe(600);
    expect(customWall.result.boundary.longitudinalBarCount).toBe(12);
    expect(customWall.result.boundary.longitudinalBarDia).toBe(20);
    expect(customWall.result.boundary.confiningHoopSpacing).toBe(75);
    expect(customWall.status).toBe('PASS');
  });

  it('should accurately differentiate horizontal floor slabs from vertical lift core shear walls regardless of thickness', () => {
    const nodes = new Map();
    // Floor 1 nodes (Y = 3.2)
    nodes.set(1, { id: 1, x: 0, y: 3.2, z: 0 });
    nodes.set(2, { id: 2, x: 4, y: 3.2, z: 0 });
    nodes.set(3, { id: 3, x: 4, y: 3.2, z: 4 });
    nodes.set(4, { id: 4, x: 0, y: 3.2, z: 4 });

    // Vertical wall nodes (Lift Core from Y = 0 to Y = 3.2)
    nodes.set(10, { id: 10, x: 8, y: 0, z: 2 });
    nodes.set(11, { id: 11, x: 10, y: 0, z: 2 });
    nodes.set(12, { id: 12, x: 10, y: 3.2, z: 2 });
    nodes.set(13, { id: 13, x: 8, y: 3.2, z: 2 });

    const plates = new Map();
    // Heavy 230mm horizontal floor slab
    plates.set(101, {
      id: 101,
      nodeIds: [1, 2, 3, 4],
      thickness: 0.23,
      materialName: 'CONCRETE',
      classification: 'PLATE',
    });

    // 230mm vertical lift core shear wall plate
    plates.set(201, {
      id: 201,
      nodeIds: [10, 11, 12, 13],
      thickness: 0.23,
      materialName: 'CONCRETE',
      classification: 'PLATE',
    });

    const supports = new Map();
    supports.set(10, { nodeId: 10, type: 'FIXED', releases: {} });
    supports.set(11, { nodeId: 11, type: 'FIXED', releases: {} });

    const model = ModelNormalizer.normalize(
      nodes,
      new Map(),
      plates,
      supports,
      new Map(),
      new Map(),
      [],
      [],
      []
    );

    const slabPlate = model.plates.get(101);
    const wallPlate = model.plates.get(201);

    expect(slabPlate?.classification).toBe('SLAB');
    expect(slabPlate?.isLiftCore).toBe(false);

    expect(wallPlate?.classification).toBe('WALL');
    expect(wallPlate?.isLiftCore).toBe(true);
  });
});


