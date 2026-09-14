import { describe, it, expect } from 'vitest';
import { FloorPlanLevel } from '@/features/drawings/floorPlanEngine';
import { SlabDetailSheetEngine } from '@/features/drawings/sheet/slabDetailSheetEngine';

const buildLevel = (): FloorPlanLevel => ({
  levelIndex: 1,
  levelName: '1ST FLOOR FRAMING PLAN',
  sheetNumber: 'STR-101',
  elevationY: 3.5,
  isFoundationLevel: false,
  beams: [
    {
      memberId: 1,
      label: 'B1',
      startNodeId: 1,
      endNodeId: 2,
      startX: 0,
      startZ: 0,
      endX: 4.5,
      endZ: 0,
      length: 4.5,
      width: 0.45,
      depth: 0.45,
      sectionName: '450x450',
    },
    {
      memberId: 2,
      label: 'B2',
      startNodeId: 2,
      endNodeId: 3,
      startX: 4.5,
      startZ: 0,
      endX: 9,
      endZ: 0,
      length: 4.5,
      width: 0.45,
      depth: 0.45,
      sectionName: '450x450',
    },
  ],
  columns: [
    {
      columnSlNo: 1,
      label: 'C1',
      nodeId: 1,
      x: 0,
      z: 0,
      width: 0.45,
      depth: 0.45,
      sectionName: '450x450',
      isGroundSupport: false,
    },
    {
      columnSlNo: 2,
      label: 'C2',
      nodeId: 2,
      x: 4.5,
      z: 0,
      width: 0.45,
      depth: 0.45,
      sectionName: '450x450',
      isGroundSupport: false,
    },
    {
      columnSlNo: 3,
      label: 'C3',
      nodeId: 3,
      x: 9,
      z: 0,
      width: 0.45,
      depth: 0.45,
      sectionName: '450x450',
      isGroundSupport: false,
    },
  ],
  gradeBeams: [],
  slabs: [
    {
      id: 1,
      label: 'S1',
      points: [
        { x: 0, z: 0 },
        { x: 4.5, z: 0 },
        { x: 4.5, z: 3.6 },
        { x: 0, z: 3.6 },
      ],
      thickness: 150,
      areaM2: 16.2,
    },
    {
      id: 2,
      label: 'S2',
      points: [
        { x: 4.5, z: 0 },
        { x: 9, z: 0 },
        { x: 9, z: 10.6 },
        { x: 4.5, z: 10.6 },
      ],
      thickness: 150,
      areaM2: 47.7,
    },
  ],
  gridLinesX: [
    { id: '1', axis: 'X', coord: 0, label: '1' },
    { id: '2', axis: 'X', coord: 4.5, label: '2' },
    { id: '3', axis: 'X', coord: 9, label: '3' },
  ],
  gridLinesZ: [
    { id: 'A', axis: 'Z', coord: 0, label: 'A' },
    { id: 'B', axis: 'Z', coord: 3.6, label: 'B' },
  ],
  combinedPileCaps: [],
  absorbedCombinedCapNodeIds: new Set<number>(),
  bounds: { minX: 0, maxX: 9, minZ: 0, maxZ: 10.6, width: 9, height: 10.6 },
  metrics: {
    totalBeams: 2,
    totalColumns: 3,
    totalSlabs: 2,
    totalConcreteM3: 10,
    totalSteelKg: 800,
    totalFloorAreaM2: 63.9,
  },
});

const project = {
  savedSlabDesigns: {},
};

describe('Slab continuous multi-bay longitudinal detailing engine', () => {
  const input = { level: buildLevel(), project };

  it('derives continuous multi-bay longitudinal cross-section with wireframe outline and no shaded fill', () => {
    const sheet = SlabDetailSheetEngine.buildSheet(input);

    // 1. Concrete Outline: unshaded wireframe lines/polys, NO solids on Concrete Line
    const concretePrims = sheet.primitives.filter((p) => p.layer === 'Concrete Line');
    expect(concretePrims.length).toBeGreaterThanOrEqual(1);
    expect(sheet.primitives.some((p) => p.layer === 'Concrete Line' && p.t === 'solid')).toBe(false);

    // 2. Reinforcement Detailing: contains straight bars, bent-up bars, top negative bars, and transverse distribution circles
    const rebarPrims = sheet.primitives.filter((p) => p.layer === 'Reinforcement');
    expect(rebarPrims.length).toBeGreaterThan(10);
    const rebarCircles = rebarPrims.filter((p) => p.t === 'circle');
    expect(rebarCircles.length).toBeGreaterThanOrEqual(8); // transverse distribution rebar dots

    // 3. Text Callouts
    const texts = sheet.primitives.filter((p) => p.t === 'text').map((p) => (p as any).text as string);
    expect(texts).toContain('C1');
    expect(texts).toContain('C2');
    expect(texts).toContain('C3');
    expect(texts.some((t) => t.includes('(ALT. REINF. BENT UP)'))).toBe(true);
    expect(texts.some((t) => t.includes('SLAB S1 (TWO WAY) (150 THK)'))).toBe(true);
    expect(texts).toContain('(SCALE: H - 1:50 / V - 1:50)');
    expect(texts).toContain('SECTION X1-X1');

    // 4. Dimension chains present
    const dims = sheet.primitives.filter((p) => p.layer === 'Dimension');
    expect(dims.length).toBeGreaterThan(0);
  });

  it('generates authentic 4-bay continuous slab cross-section matching reference image dimensions and SLAB.dxf', () => {
    // Reference image media_1789396742962.png / SLAB.dxf:
    // 4 bays with clear spans 1300, 1020, 4250, 3500
    // and supports at 400 mm width (C1, C1, C2, C3, C4)
    const fourBayLevel: FloorPlanLevel = {
      ...buildLevel(),
      columns: [
        { columnSlNo: 1, label: 'C1', nodeId: 1, x: 0, z: 0, width: 0.4, depth: 0.4, sectionName: '400x400', isGroundSupport: false },
        { columnSlNo: 2, label: 'C1', nodeId: 2, x: 1.7, z: 0, width: 0.4, depth: 0.4, sectionName: '400x400', isGroundSupport: false },
        { columnSlNo: 3, label: 'C2', nodeId: 3, x: 3.12, z: 0, width: 0.4, depth: 0.4, sectionName: '400x400', isGroundSupport: false },
        { columnSlNo: 4, label: 'C3', nodeId: 4, x: 7.77, z: 0, width: 0.4, depth: 0.4, sectionName: '400x400', isGroundSupport: false },
        { columnSlNo: 5, label: 'C4', nodeId: 5, x: 11.67, z: 0, width: 0.4, depth: 0.4, sectionName: '400x400', isGroundSupport: false },
      ],
      slabs: [
        { id: 1, label: 'S1', points: [{ x: 0, z: 0 }, { x: 1.7, z: 0 }, { x: 1.7, z: 3 }, { x: 0, z: 3 }], thickness: 150, areaM2: 5.1 },
        { id: 2, label: 'S2', points: [{ x: 1.7, z: 0 }, { x: 3.12, z: 0 }, { x: 3.12, z: 3 }, { x: 1.7, z: 3 }], thickness: 150, areaM2: 4.26 },
        { id: 3, label: 'S3', points: [{ x: 3.12, z: 0 }, { x: 7.77, z: 0 }, { x: 7.77, z: 3 }, { x: 3.12, z: 3 }], thickness: 150, areaM2: 13.95 },
        { id: 4, label: 'S4', points: [{ x: 7.77, z: 0 }, { x: 11.67, z: 0 }, { x: 11.67, z: 3 }, { x: 7.77, z: 3 }], thickness: 150, areaM2: 11.7 },
      ],
    };

    const savedProject = {
      savedSlabDesigns: {
        S1: { panelId: 'S1', thickness: 150, bottomBarDiaX: 8, bottomBarSpacingX: 150, bottomBarDiaY: 8, bottomBarSpacingY: 150 },
        S2: { panelId: 'S2', thickness: 150, bottomBarDiaX: 8, bottomBarSpacingX: 150, bottomBarDiaY: 8, bottomBarSpacingY: 150 },
        S3: { panelId: 'S3', thickness: 150, bottomBarDiaX: 8, bottomBarSpacingX: 150, bottomBarDiaY: 8, bottomBarSpacingY: 150 },
        S4: { panelId: 'S4', thickness: 150, bottomBarDiaX: 8, bottomBarSpacingX: 150, bottomBarDiaY: 8, bottomBarSpacingY: 150 },
      },
    };

    const sheet = SlabDetailSheetEngine.buildSheet({ level: fourBayLevel, project: savedProject });
    const texts = sheet.primitives.filter((p) => p.t === 'text').map((p) => (p as any).text as string);

    // 1. Clear span dimensions (1300, 1020, 4250, 3500)
    expect(texts).toContain('1300');
    expect(texts).toContain('1020');
    expect(texts).toContain('4250');
    expect(texts).toContain('3500');

    // 2. Support width dimensions (400)
    expect(texts).toContain('400');

    // 3. Crank offset dimensions (220, 175, 710, 585)
    expect(texts).toContain('220');
    expect(texts).toContain('175');
    expect(texts).toContain('710');
    expect(texts).toContain('585');

    // 4. Top negative moment curtailment dimensions (325, 255, 1065, 875)
    expect(texts).toContain('325');
    expect(texts).toContain('255');
    expect(texts).toContain('1065');
    expect(texts).toContain('875');

    // 5. Rebar callouts
    expect(texts).toContain('T8@150 C/C');
    expect(texts).toContain('T8@150 C/C (ALT. REINF. BENT UP)');

    // 6. Support marks below
    expect(texts).toContain('C1');
    expect(texts).toContain('C2');
    expect(texts).toContain('C3');
    expect(texts).toContain('C4');

    // 7. Slab marks in cyan
    expect(texts.some((t) => t.includes('SLAB S1'))).toBe(true);
    expect(texts.some((t) => t.includes('SLAB S2'))).toBe(true);
    expect(texts.some((t) => t.includes('SLAB S3'))).toBe(true);
    expect(texts.some((t) => t.includes('SLAB S4'))).toBe(true);

    // 8. Scale note
    expect(texts).toContain('(SCALE: H - 1:50 / V - 1:50)');
  });

  it('uses real app data from savedSlabDesigns for rebar diameter and spacing', () => {
    const savedProject = {
      savedSlabDesigns: {
        S1: {
          panelId: 'S1',
          thickness: 175,
          bottomBarDiaX: 10,
          bottomBarSpacingX: 125,
          bottomBarDiaY: 8,
          bottomBarSpacingY: 175,
        },
      },
    };
    const sheet = SlabDetailSheetEngine.buildSheet({ ...input, project: savedProject });
    const texts = sheet.primitives.filter((p) => p.t === 'text').map((p) => (p as any).text as string);
    expect(texts).toContain('T10@125 C/C');
    expect(texts).toContain('T10@125 C/C (ALT. REINF. BENT UP)');
    expect(texts.some((t) => t.includes('SLAB S1 (TWO WAY) (175 THK)'))).toBe(true);
  });
});
