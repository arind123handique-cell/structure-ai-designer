import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FloorPlanLevel } from '@/features/drawings/floorPlanEngine';
import { BeamSectionSheetEngine } from '@/features/drawings/sheet/beamSectionSheetEngine';
import { SlabDetailSheetEngine } from '@/features/drawings/sheet/slabDetailSheetEngine';
import { StoredProject } from '@/features/projects/types';

const saveMock = vi.fn();
const addPageMock = vi.fn();
const setPageMock = vi.fn();
const getNumberOfPagesMock = vi.fn().mockReturnValue(1);
const rectMock = vi.fn();
const lineMock = vi.fn();
const textMock = vi.fn();
const circleMock = vi.fn();
const linesMock = vi.fn();
const triangleMock = vi.fn();
const setFillColorMock = vi.fn();
const setDrawColorMock = vi.fn();
const setTextColorMock = vi.fn();
const setLineWidthMock = vi.fn();
const setFontMock = vi.fn();
const setFontSizeMock = vi.fn();
const getTextWidthMock = vi.fn().mockReturnValue(20);

vi.mock('jspdf', () => {
  class MockJsPDF {
    save = saveMock;
    addPage = addPageMock;
    setPage = setPageMock;
    getNumberOfPages = getNumberOfPagesMock;
    setFillColor = setFillColorMock;
    setDrawColor = setDrawColorMock;
    setFont = setFontMock;
    setFontSize = setFontSizeMock;
    setTextColor = setTextColorMock;
    setLineWidth = setLineWidthMock;
    setLineDashPattern = vi.fn();
    rect = rectMock;
    text = textMock;
    line = lineMock;
    circle = circleMock;
    lines = linesMock;
    triangle = triangleMock;
    getTextWidth = getTextWidthMock;
  }
  return {
    default: MockJsPDF,
    jsPDF: MockJsPDF,
  };
});

// Import service after mock
import { PdfExportService } from '@/features/drawings/pdfExportService';

const buildTestLevel = (levelIndex = 1, levelName = '1ST FLOOR FRAMING PLAN'): FloorPlanLevel => ({
  levelIndex,
  levelName,
  sheetNumber: `STR-${100 + levelIndex}`,
  elevationY: 3.5,
  isFoundationLevel: false,
  gradeBeams: [],
  combinedPileCaps: [],
  absorbedCombinedCapNodeIds: new Set<number>(),
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
  ],
  slabs: [
    {
      id: 1,
      label: 'S1',
      thickness: 150,
      areaM2: 18,
      points: [
        { x: 0, z: 0 },
        { x: 4.5, z: 0 },
        { x: 4.5, z: 4 },
        { x: 0, z: 4 },
      ],
    },
  ],
  gridLinesX: [
    { id: 'A', axis: 'X', coord: 0, label: 'A' },
    { id: 'B', axis: 'X', coord: 4.5, label: 'B' },
  ],
  gridLinesZ: [{ id: '1', axis: 'Z', coord: 0, label: '1' }],
  bounds: { minX: 0, maxX: 9, minZ: 0, maxZ: 4, width: 9, height: 4 },
  metrics: {
    totalFloorAreaM2: 36,
    totalConcreteM3: 15,
    totalSteelKg: 1200,
    totalBeams: 2,
    totalColumns: 2,
    totalSlabs: 1,
  },
});

const mockProject: StoredProject = {
  metadata: {
    id: 'prj-test-pdf',
    name: 'G+4 RCC Luxury Residency',
    code: 'PRJ-2026-VEC',
    client: 'Skyline Developers',
    engineer: 'Er. Jane Doe (Principal)',
    location: 'Sector 42, Gurgaon',
    date: '2026-09-14',
    description: 'RCC residential apartment building',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    designSettings: {
      code: 'IS456_2000',
      concreteGrade: 'M30',
      steelGrade: 'Fe500D',
      coverColumn: 40,
      coverBeam: 30,
      coverSlab: 20,
      coverFooting: 50,
      liveLoadDefault: 2.0,
      floorFinishDefault: 1.0,
      windSpeed: 47,
      seismicZone: 'ZONE_IV',
      soilType: 'MEDIUM',
      responseReductionFactor: 5,
      importanceFactor: 1.2,
    },
  },
  models: {},
} as any;

describe('PdfExportService — Vector Detail Sheet PDF Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports a single Beam Reinforcement Sections detail sheet to A3 Landscape PDF', () => {
    const level = buildTestLevel(1);
    const sheet = BeamSectionSheetEngine.buildSheet({
      level,
      project: mockProject,
      fck: 30,
      fy: 500,
    });

    expect(sheet.primitives.length).toBeGreaterThan(0);

    PdfExportService.exportDetailSheetToPdf(sheet, mockProject, undefined, {
      orientation: 'landscape',
    });

    // 1. Check save was called with the generated safeName
    expect(saveMock).toHaveBeenCalledTimes(1);
    const fileName = saveMock.mock.calls[0][0];
    expect(fileName).toContain('G_4_RCC_Luxury_Residency');
    expect(fileName).toContain('STR-201');
    expect(fileName).toContain('.pdf');

    // 2. Check title block border and outer margin rectangles were drawn
    expect(rectMock).toHaveBeenCalled();
    // 3. Check drawing primitives (lines for rebars/beams, text, circles)
    expect(lineMock).toHaveBeenCalled();
    expect(textMock).toHaveBeenCalled();

    // Check that title block texts were drawn
    const textCalls = textMock.mock.calls.map((call) => call[0]);
    expect(textCalls.some((t: string) => t.includes('STRUCTURE AI DESIGNER'))).toBe(true);
    expect(textCalls.some((t: string) => t.includes('DWG NO: STR-201'))).toBe(true);
    expect(textCalls.some((t: string) => t.includes('APPROVED'))).toBe(true);
  });

  it('exports a single Slab Detailing sheet in Portrait orientation', () => {
    const level = buildTestLevel(1);
    const sheet = SlabDetailSheetEngine.buildSheet({
      level,
      project: mockProject,
    });

    PdfExportService.exportDetailSheetToPdf(sheet, mockProject, undefined, {
      orientation: 'portrait',
    });

    expect(saveMock).toHaveBeenCalledTimes(1);
    const fileName = saveMock.mock.calls[0][0];
    expect(fileName).toContain('STR-301');

    const textCalls = textMock.mock.calls.map((call) => call[0]);
    expect(textCalls.some((t: string) => t.includes('DWG NO: STR-301'))).toBe(true);
  });

  it('exports all detail sheets into a multi-page A3 PDF set', () => {
    const level1 = buildTestLevel(1, '1ST FLOOR');
    const level2 = buildTestLevel(2, '2ND FLOOR');
    const sheet1 = BeamSectionSheetEngine.buildSheet({
      level: level1,
      project: mockProject,
      fck: 30,
      fy: 500,
    });
    const sheet2 = BeamSectionSheetEngine.buildSheet({
      level: level2,
      project: mockProject,
      fck: 30,
      fy: 500,
    });

    PdfExportService.exportAllDetailSheetsToPdf([sheet1, sheet2], mockProject, undefined, {
      orientation: 'landscape',
    });

    // Verify 1 multi-page document saved
    expect(saveMock).toHaveBeenCalledTimes(1);
    const fileName = saveMock.mock.calls[0][0];
    expect(fileName).toContain('Complete_Beam_Reinforcement_Sections_Sheets.pdf');

    // Page 2 added via addPage
    expect(addPageMock).toHaveBeenCalledTimes(1);
    expect(addPageMock).toHaveBeenCalledWith('a3', 'landscape');
  });

  it('handles empty detail sheets gracefully with notice in center of drawing', () => {
    const level = { ...buildTestLevel(1), slabs: [] };
    const emptySheet = SlabDetailSheetEngine.buildSheet({
      level,
      project: mockProject,
    });

    expect(emptySheet.primitives.length).toBe(0);

    expect(() => {
      PdfExportService.exportDetailSheetToPdf(emptySheet, mockProject);
    }).not.toThrow();

    expect(saveMock).toHaveBeenCalledTimes(1);
    const textCalls = textMock.mock.calls.map((call) => call[0]);
    expect(textCalls.some((t: string) => t.includes('No slab panels detected'))).toBe(true);
  });

  it('supports dark / blueprint theme rendering', () => {
    const level = buildTestLevel(1);
    const sheet = SlabDetailSheetEngine.buildSheet({
      level,
      project: mockProject,
    });

    expect(() => {
      PdfExportService.exportDetailSheetToPdf(sheet, mockProject, 'blueprint_test.pdf', {
        theme: 'dark',
      });
    }).not.toThrow();

    expect(saveMock).toHaveBeenCalledWith('blueprint_test.pdf');
    expect(setFillColorMock).toHaveBeenCalledWith(11, 18, 32); // Dark background fill
  });
});
