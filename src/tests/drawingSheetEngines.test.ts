import { describe, it, expect } from 'vitest';
import { FloorPlanLevel } from '@/features/drawings/floorPlanEngine';
import {
  BeamSectionSheetEngine,
  cellWidthFor,
  detailsPerRow,
  stripWidthFor,
} from '@/features/drawings/sheet/beamSectionSheetEngine';
import { SlabDetailSheetEngine } from '@/features/drawings/sheet/slabDetailSheetEngine';
import { computeBounds } from '@/features/drawings/sheet/drawingSheet';

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
      width: 0.23,
      depth: 0.45,
      sectionName: '230x450',
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
      width: 0.25,
      depth: 0.5,
      sectionName: '250x500',
    },
    {
      memberId: 3,
      label: 'B10',
      startNodeId: 3,
      endNodeId: 4,
      startX: 9,
      startZ: 0,
      endX: 13.5,
      endZ: 0,
      length: 4.5,
      width: 0.23,
      depth: 0.45,
      sectionName: '230x450',
    },
    {
      memberId: 4,
      label: 'B11',
      startNodeId: 5,
      endNodeId: 6,
      startX: 0,
      startZ: 5,
      endX: 4.5,
      endZ: 5,
      length: 4.5,
      width: 0.23,
      depth: 0.45,
      sectionName: '230x450',
    },
    {
      memberId: 5,
      label: 'B12',
      startNodeId: 6,
      endNodeId: 7,
      startX: 4.5,
      startZ: 5,
      endX: 9,
      endZ: 5,
      length: 4.5,
      width: 0.3,
      depth: 0.45,
      sectionName: '300x450',
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
      // 4.5 x 10.6 = 2.36 aspect ratio -> spanning one way
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
  bounds: { minX: 0, maxX: 13.5, minZ: 0, maxZ: 10.6, width: 13.5, height: 10.6 },
  metrics: {
    totalBeams: 3,
    totalColumns: 3,
    totalSlabs: 2,
    totalConcreteM3: 12,
    totalSteelKg: 900,
    totalFloorAreaM2: 54,
  },
});

const project = {
  savedBeamDesigns: {},
  savedSlabDesigns: {},
  universalRebarSelection: { longitudinalDiameters: [12, 16, 20], shearTieDiameters: [8, 10] },
};

describe('Beam reinforcement cross-section sheet engine', () => {
  const input = { level: buildLevel(), project, fck: 25, fy: 500 };

  it('derives one section design per beam, ordered by mark', () => {
    const designs = BeamSectionSheetEngine.extractLevelBeams(input);
    expect(designs.map((d) => d.mark)).toEqual(['B1', 'B2', 'B10', 'B11', 'B12']);
  });

  it('reads section sizes from the model in millimetres', () => {
    const designs = BeamSectionSheetEngine.extractLevelBeams(input);
    const b1 = designs.find((d) => d.mark === 'B1')!;
    expect(b1.b).toBe(230);
    expect(b1.D).toBe(450);
    expect(b1.source).toBe('LIVE');
  });

  it('produces IS 456 rebar lines and stirrup callouts in the drawing vocabulary', () => {
    const designs = BeamSectionSheetEngine.extractLevelBeams(input);
    const b1 = designs.find((d) => d.mark === 'B1')!;
    expect(b1.top.through.callout).toMatch(/^\d+-T(12|16|20)$/);
    expect(b1.bottom.through.callout).toMatch(/^\d+-T(12|16|20)$/);
    expect([8, 10]).toContain(b1.stirrups.dia);
    expect(b1.stirrups.spacingSupport).toBeGreaterThan(0);
    expect(b1.stirrups.spacingSupport % 25).toBe(0);
  });

  it('emits zones covering the full span without gaps or overlaps', () => {
    const designs = BeamSectionSheetEngine.extractLevelBeams(input);
    designs.forEach((design) => {
      const spanMm = design.spanM * 1000;
      expect(design.zones[0].startMm).toBe(0);
      expect(design.zones[design.zones.length - 1].endMm).toBeCloseTo(spanMm, 0);
      for (let i = 1; i < design.zones.length; i++) {
        expect(design.zones[i].startMm).toBe(design.zones[i - 1].endMm);
      }
      design.zones.forEach((zone) => {
        expect(zone.label).toContain(`${design.mark} (LOC:`);
        expect(zone.stirrupCount).toBeGreaterThan(0);
      });
    });
  });

  it('builds a sheet with the DXF layer conventions and annotation vocabulary', () => {
    const sheet = BeamSectionSheetEngine.buildSheet(input);
    expect(sheet.sheetNumber).toBe('STR-201');
    expect(sheet.layers.map((l) => l.name)).toEqual(
      expect.arrayContaining(['Concrete Line', 'Reinforcement', 'Link', 'Labels', 'Text', 'Schedule Border'])
    );

    const texts = sheet.primitives.filter((p) => p.t === 'text').map((p) => (p as any).text as string);
    expect(texts).toContain('B1:230x450');
    expect(texts).toContain('(SCALE 1:25)');
    expect(texts.some((t) => /^ST  \dL-T\d+$/.test(t))).toBe(true);
    expect(texts.some((t) => /^\d+-\dL-T\d+$/.test(t))).toBe(true);
    expect(texts.some((t) => /^@\d+ C\/C$/.test(t))).toBe(true);
    expect(texts.some((t) => t.startsWith('B1 (LOC:'))).toBe(true);
    expect(sheet.notes).toContain('(SCALE: H = 1:50  / V = 1:50)');
  });

  it('lays the sections out in rows stacked downwards with a sensible extent', () => {
    const sheet = BeamSectionSheetEngine.buildSheet(input);
    const bounds = sheet.bounds;
    // 5 beams wrap to 2 rows of 4 and 1, so nothing exceeds 4 cells wide
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(4 * cellWidthFor(4.5));
    // five beams wrap onto two rows, so the sheet extends a full row pitch down
    expect(bounds.minY).toBeLessThan(-20000);
    expect(bounds.maxY - bounds.minY).toBeGreaterThan(25000);
    expect(computeBounds(sheet.primitives)).toEqual(bounds);
  });

  it('places bars and links as geometry on the reinforcement and link layers', () => {
    const sheet = BeamSectionSheetEngine.buildSheet(input);
    const circles = sheet.primitives.filter((p) => p.t === 'circle' && p.layer === 'Reinforcement');
    const links = sheet.primitives.filter((p) => p.t === 'poly' && p.layer === 'Link' && (p as any).closed);
    // 5 beams, at least 4 longitudinal bars each
    expect(circles.length).toBeGreaterThanOrEqual(20);
    expect(links.length).toBe(5);
  });

  it('supports a user-saved design, including multi-zone stirrup splits', () => {
    const savedProject = {
      ...project,
      savedBeamDesigns: {
        1: {
          curtailment: {
            throughTop: { count: 2, diameter: 16, callout: '2-T16' },
            throughBottom: { count: 3, diameter: 16, callout: '3-T16' },
            extraTopSupport: { count: 1, diameter: 16, callout: '1-T16', cutoffLength: 1.35, hasExtra: true },
            extraBottomMidspan: { count: 1, diameter: 16, callout: '1-T16', startOffset: 0.5, length: 3, hasExtra: true },
          },
          shear: { stirrupDiameter: 8, legs: 2, spacing_prov: 150 },
          ductility: {
            confinementZoneLength: 810,
            confinementHoopSpacingMax: 100,
            midSpanHoopSpacingMax: 200,
          },
        },
      },
    };

    const designs = BeamSectionSheetEngine.extractLevelBeams({ ...input, project: savedProject });
    const b1 = designs.find((d) => d.mark === 'B1')!;
    expect(b1.source).toBe('SAVED');
    expect(b1.top.through.callout).toBe('2-T16');
    expect(b1.top.extra?.callout).toBe('1-T16');
    expect(b1.bottom.through.callout).toBe('3-T16');
    expect(b1.stirrups.spacingSupport).toBe(100);
    expect(b1.stirrups.spacingMid).toBe(150);
    expect(b1.zones.length).toBe(3);
    expect(b1.zones[0].endMm).toBe(1350); // the longer of 2d and the saved cut-off
    expect(b1.zones[1].spacing).toBe(150);
    expect(b1.zones[1].stirrupCount).toBe(Math.ceil(1800 / 150) + 1);
  });

  it('sizes cells and picks columns so the sheet stays landscape', () => {
    expect(stripWidthFor(4.5)).toBe(8250); // 2x true size, capped
    expect(stripWidthFor(2.0)).toBe(4000); // 2x true size, under the cap
    expect(cellWidthFor(4.5)).toBeGreaterThan(stripWidthFor(4.5));

    const widths = Array(5).fill(cellWidthFor(4.5));
    expect(detailsPerRow(widths)).toBe(4);
    expect(detailsPerRow(Array(62).fill(cellWidthFor(4.5)))).toBeGreaterThan(6);
    expect(detailsPerRow([cellWidthFor(4.5)])).toBe(1);
  });

  it('skips foundation levels', () => {
    const level = { ...buildLevel(), isFoundationLevel: true };
    expect(BeamSectionSheetEngine.extractLevelBeams({ ...input, level })).toEqual([]);
  });
});

describe('Slab detailing sheet engine', () => {
  const input = { level: buildLevel(), project };

  it('derives a panel design per slab, flagging one-way panels by aspect ratio', () => {
    const panels = SlabDetailSheetEngine.extractLevelPanels(input);
    expect(panels.map((p) => p.panelId)).toEqual(['S1', 'S2']);
    expect(panels[0].oneWay).toBe(false); // 4.5 x 3.6 = 1.25 aspect ratio
    expect(panels[1].oneWay).toBe(true); // 4.5 x 10.6 = 2.36 aspect ratio
  });

  it('uses saved slab designs when available', () => {
    const savedProject = {
      ...project,
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
    const panels = SlabDetailSheetEngine.extractLevelPanels({ ...input, project: savedProject });
    const s1 = panels.find((p) => p.panelId === 'S1')!;
    expect(s1.source).toBe('SAVED');
    expect(s1.thickness).toBe(175);
    expect(s1.bottomMain.spacing).toBe(125);
    expect(s1.bottomSecond.spacing).toBe(175);
  });

  it('builds a slab sheet with panel marks, bar callouts and a section mark', () => {
    const sheet = SlabDetailSheetEngine.buildSheet(input);
    expect(sheet.sheetNumber).toBe('STR-301');
    const texts = sheet.primitives.filter((p) => p.t === 'text').map((p) => (p as any).text as string);
    expect(texts).toContain('SLAB S1');
    expect(texts.some((t) => /\(TWO WAY\) \(150 THK\)/.test(t))).toBe(true);
    expect(texts.some((t) => /^T\d+@\d+ C\/C \(BOTTOM [XY]\)$/.test(t))).toBe(true);
    expect(texts).toContain('SECTION X1-X1');
  });

  it('returns an empty annotated sheet when the level has no panels', () => {
    const level = { ...buildLevel(), slabs: [] };
    const sheet = SlabDetailSheetEngine.buildSheet({ ...input, level });
    expect(sheet.primitives.length).toBe(0);
    expect(sheet.notes).toEqual(['No slab panels detected at this level']);
  });
});
