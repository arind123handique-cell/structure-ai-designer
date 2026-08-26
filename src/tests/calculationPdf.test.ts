import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnDesignEngine } from '@/features/design/column/columnDesignEngine';
import { PileDesignEngine } from '@/features/design/pile/pileDesignEngine';
import { StoredProject } from '@/features/projects/types';
import { NormalizedStructuralModel } from '@/features/model/types';

const saveMock = vi.fn();
const addPageMock = vi.fn();
const setPageMock = vi.fn();
const getNumberOfPagesMock = vi.fn().mockReturnValue(5);

vi.mock('jspdf', () => {
  class MockJsPDF {
    save = saveMock;
    addPage = addPageMock;
    setPage = setPageMock;
    getNumberOfPages = getNumberOfPagesMock;
    setFillColor = vi.fn();
    setDrawColor = vi.fn();
    setFont = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    setLineWidth = vi.fn();
    rect = vi.fn();
    text = vi.fn();
    line = vi.fn();
  }
  return {
    default: MockJsPDF,
    jsPDF: MockJsPDF,
  };
});

// Import service after mock
import { CalculationPdfService } from '@/features/calculations/calculationPdfService';

describe('CalculationPdfService — 1-Tap Master Structural Design Calculations PDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProject: StoredProject = {
    metadata: {
      id: 'prj-test-1',
      name: 'Commercial Tech Park G+6',
      code: 'PRJ-2026-TECH',
      client: 'Tech Corp Infrastructure',
      engineer: 'Er. R. Sharma (Lead Structural)',
      location: 'Sector 62, Noida',
      date: '2026-08-26',
      description: 'Commercial high-rise RCC building',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      designSettings: {
        code: 'IS456_2000',
        concreteGrade: 'M30',
        steelGrade: 'Fe500D',
        shearRebarGrade: 'Fe500D',
        clearCoverBeam: 30,
        clearCoverColumn: 40,
        clearCoverFooting: 50,
        clearCoverSlab: 20,
        clearCoverPile: 60,
        maxAggregateSize: 20,
        seismicZone: 'IV',
        responseReductionFactor: 5,
        importanceFactor: 1.2,
        soilType: 'II_MEDIUM',
        windSpeed: 47,
        windTerrainCategory: 2,
      },
    },
    model: {
      nodes: [],
      members: [],
      plates: [],
      supports: [],
      loadCases: [],
      loadCombinations: [],
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
    },
    universalRebarSelection: {
      longitudinalDiameters: [12, 16, 20, 25],
      shearTieDiameters: [8, 10],
      isConfigured: true,
    },
    projectPileTypes: PileDesignEngine.getDefaultProjectPileTypes(),
    savedColumnDesigns: {},
    savedBeamDesigns: {},
    savedFootingDesigns: {},
    savedShearWallDesigns: {},
    savedGradeBeamDesigns: [],
    warnings: [],
  };

  const mockModel: NormalizedStructuralModel = {
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
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.55, zd: 0.45, name: '450x550 mm' },
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
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.50, zd: 0.30, name: '300x500 mm' },
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
          isAutoClassified: true,
          section: { type: 'RECTANGULAR', yd: 0.55, zd: 0.45, name: '450x550 mm' },
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
    loadCases: new Map(),
    loadCombinations: new Map(),
    reactions: [
      { nodeId: 1, fx: 15, fy: 850, fz: 10, mx: 35, my: 20, mz: 40, loadCaseId: 1 },
      { nodeId: 4, fx: 12, fy: 920, fz: 8, mx: 30, my: 18, mz: 35, loadCaseId: 1 },
    ],
    memberForces: [
      { memberId: 1, axial: 850, mz: 40, my: 25, vy: 30, vz: 0, sectionLocation: 0, torsion: 0, loadCaseId: 1 },
      { memberId: 2, axial: 0, mz: 85, my: 0, vy: 60, vz: 0, sectionLocation: 0, torsion: 0, loadCaseId: 1 },
      { memberId: 3, axial: 920, mz: 35, my: 20, vy: 28, vz: 0, sectionLocation: 0, torsion: 0, loadCaseId: 1 },
    ],
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

  it('should export 1-Tap All Design Calculations PDF without errors', () => {
    CalculationPdfService.exportAllDesignCalculationsPdf(mockModel, mockProject);

    expect(saveMock).toHaveBeenCalled();
    const fileName = saveMock.mock.calls[0][0];
    expect(fileName).toContain('All_Design_Calculations_IS456_IS13920_IS2911.pdf');
    expect(addPageMock).toHaveBeenCalled();
    expect(setPageMock).toHaveBeenCalled();
  });

  it('should export Column calculations book PDF', () => {
    CalculationPdfService.exportColumnsCalculationsPdf(mockModel, mockProject);

    expect(saveMock).toHaveBeenCalled();
    expect(addPageMock).toHaveBeenCalled();
  });

  it('should export Beam calculations book PDF', () => {
    CalculationPdfService.exportBeamsCalculationsPdf(mockModel, mockProject);

    expect(saveMock).toHaveBeenCalled();
    expect(addPageMock).toHaveBeenCalled();
  });

  it('should export Pile calculations book PDF', () => {
    CalculationPdfService.exportPilesCalculationsPdf(mockModel, mockProject);

    expect(saveMock).toHaveBeenCalled();
    expect(addPageMock).toHaveBeenCalled();
  });

  it('should export Pile Cap calculations book PDF', () => {
    CalculationPdfService.exportPileCapsCalculationsPdf(mockModel, mockProject);

    expect(saveMock).toHaveBeenCalled();
    expect(addPageMock).toHaveBeenCalled();
  });

  it('should export Single Component Calculation Sheet PDF', () => {
    const colDes = ColumnDesignEngine.design({
      memberId: 1,
      b: 450,
      D: 550,
      unsupportedHeight: 3.5,
      fck: 30,
      fy: 500,
      Pu: 850,
      Mux: 40,
      Muy: 25,
    });

    CalculationPdfService.exportSingleCalculationPdf(colDes.calculationReport, mockProject.metadata);

    expect(saveMock).toHaveBeenCalled();
    const fileName = saveMock.mock.calls[0][0];
    expect(fileName).toContain('COLUMN_1_Calculation_Sheet.pdf');
  });
});
