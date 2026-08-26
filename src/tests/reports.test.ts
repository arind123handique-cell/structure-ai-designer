import { describe, it, expect } from 'vitest';
import { ExcelWorkbookExporter, ProjectReportDataset } from '@/features/reports/excelExport';
import { PDFReportGenerator } from '@/features/reports/pdfReportGenerator';

describe('Reports and Multi-Sheet Excel Engine', () => {
  it('should generate multi-sheet Excel workbook with all project data', () => {
    const mockDataset = {
      metadata: {
        id: 'prj-1',
        name: 'G+4 RCC Building',
        code: 'PRJ-2026',
        client: 'Client ABC',
        date: '2026-08-23',
        description: 'Residential building',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        engineer: 'Er. Test Engineer',
        location: 'Site Phase II',
        anlFileName: 'TEST.ANL',
        designSettings: {
          code: 'IS456_2000' as const,
          concreteGrade: 'M25' as const,
          steelGrade: 'Fe500D' as const,
          shearRebarGrade: 'Fe500D' as const,
          clearCoverBeam: 30,
          clearCoverColumn: 40,
          clearCoverFooting: 50,
          clearCoverSlab: 20,
          clearCoverPile: 60,
          maxAggregateSize: 20,
          seismicZone: 'IV' as const,
          responseReductionFactor: 5,
          importanceFactor: 1.2,
          soilType: 'II_MEDIUM' as const,
          windSpeed: 39,
          windTerrainCategory: 2,
        },
      },
      model: {
        nodes: new Map([
          [1, { id: 1, x: 0, y: 0, z: 0, isSupport: true }],
          [2, { id: 2, x: 5, y: 3.5, z: 0 }],
        ]),
        members: new Map([
          [
            1,
            {
              id: 1,
              startNodeId: 1,
              endNodeId: 2,
              length: 3.5,
              classification: 'COLUMN' as const,
              isAutoClassified: true,
              section: { type: 'RECTANGULAR' as const, yd: 0.55, zd: 0.45, name: '450x550 mm' },
              materialName: 'CONCRETE',
              designStatus: 'PASS' as const,
            },
          ],
          [
            2,
            {
              id: 2,
              startNodeId: 2,
              endNodeId: 3,
              length: 4.5,
              classification: 'BEAM' as const,
              isAutoClassified: true,
              section: { type: 'RECTANGULAR' as const, yd: 0.45, zd: 0.3, name: '300x450 mm' },
              materialName: 'CONCRETE',
              designStatus: 'PASS' as const,
            },
          ],
        ]),
        plates: new Map(),
        supports: new Map([[1, { nodeId: 1, type: 'FIXED' as const, releases: {} }]]),
        loadCases: new Map(),
        loadCombinations: new Map(),
        reactions: [],
        memberForces: [],
        storyDrifts: [],
        boundingBox: { minX: 0, maxX: 5, minY: 0, maxY: 3.5, minZ: 0, maxZ: 0 },
        statistics: {
          totalNodes: 2,
          totalMembers: 2,
          totalBeams: 1,
          totalColumns: 1,
          totalPlates: 0,
          totalSupports: 1,
          totalLoadCases: 1,
          totalCombinations: 1,
          maxElevation: 3.5,
          baseElevation: 0,
        },
      },
      warnings: [],
    } as unknown as ProjectReportDataset;

    const workbookXml = ExcelWorkbookExporter.generateWorkbook(mockDataset);

    expect(workbookXml).toContain('PROJECT METADATA & DESIGN PARAMETERS');
    expect(workbookXml).toContain('RCC BEAM REINFORCEMENT SCHEDULE');
    expect(workbookXml).toContain('RCC COLUMN SCHEDULE');
    expect(workbookXml).toContain('PILES & FOUNDATION SCHEDULE');
    expect(workbookXml).toContain('G+4 RCC Building');
    expect(workbookXml).toContain('Er. Test Engineer');
  });

  it('should compute comprehensive component-wise reinforcement take-off (BOQ) and detailed IS code design calculations', () => {
    const mockDataset = {
      metadata: {
        id: 'prj-1',
        name: 'G+4 RCC Building',
        code: 'PRJ-2026',
        client: 'Client ABC',
        engineer: 'Er. Test Engineer',
        location: 'Site Phase II',
        designSettings: {
          concreteGrade: 'M25',
          steelGrade: 'Fe500D',
          clearCoverBeam: 30,
          clearCoverColumn: 40,
          clearCoverFooting: 50,
          seismicZone: 'IV',
          soilType: 'II_MEDIUM',
        },
      },
      model: {
        nodes: new Map([
          [1, { id: 1, x: 0, y: 0, z: 0 }],
          [2, { id: 2, x: 5, y: 3.5, z: 0 }],
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
              section: { yd: 0.55, zd: 0.45, name: '450x550 mm' },
            },
          ],
          [
            2,
            {
              id: 2,
              startNodeId: 2,
              endNodeId: 3,
              length: 4.5,
              classification: 'BEAM',
              section: { yd: 0.45, zd: 0.3, name: '300x450 mm' },
            },
          ],
        ]),
        plates: new Map([
          [1, { id: 1, nodeIds: [1, 2, 3, 4], classification: 'WALL' }],
        ]),
        supports: new Map([[1, { nodeId: 1 }]]),
        reactions: [{ nodeId: 1, fy: 750, mx: 20, my: 15, loadCaseId: 1 }],
        memberForces: [
          { memberId: 1, axial: 750, mz: 45, my: 35, fy: 30 },
          { memberId: 2, axial: 0, mz: 65, my: 0, fy: 45 },
        ],
      },
      warnings: [],
    };

    const designs = (PDFReportGenerator as any).calculateAllComponentDesigns(
      mockDataset.model,
      mockDataset.metadata.designSettings,
      mockDataset
    );

    // Verify component summaries
    expect(designs.columnsSummary.length).toBe(1);
    expect(designs.columnsSummary[0].rebarCallout).toBeDefined();
    expect(designs.columnsSummary[0].IR).toBeLessThanOrEqual(1.0);

    expect(designs.beamsSummary.length).toBe(1);
    expect(designs.beamsSummary[0].topRebar).toBeDefined();
    expect(designs.beamsSummary[0].botRebar).toBeDefined();

    expect(designs.shearWallsSummary.length).toBeGreaterThanOrEqual(1);
    expect(designs.shearWallsSummary[0].boundaryRebar).toBeDefined();

    expect(designs.pileCapsSummary.length).toBe(1);
    expect(designs.componentBreakdowns.length).toBe(7); // Slabs, Piles, Pile Caps, Grade Beams, Columns, Beams, Shear Walls
    expect(designs.grandTotals.dia8).toBeGreaterThan(0);
    expect(designs.grandTotals.dia16).toBeGreaterThan(0);
    expect(designs.grandTotals.dia20).toBeGreaterThan(0);
    expect(designs.totalConcreteM3).toBeGreaterThan(0);
    expect(designs.totalSteelKg).toBeGreaterThan(0);
  });
});

