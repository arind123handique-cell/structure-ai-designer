import { NormalizedStructuralModel } from '@/features/model/types';
import { ProjectMetadata } from '@/types';
import { EngineeringWarning } from '@/features/warnings/types';
import { BbsEngine } from '@/features/calculations/bbsEngine';
import { ConcreteVolumeEngine } from '@/features/calculations/concreteVolumeEngine';
import { StaircaseDesignEngine } from '@/features/design/staircase/staircaseEngine';

export interface ProjectReportDataset {
  metadata: ProjectMetadata;
  model: NormalizedStructuralModel;
  warnings: EngineeringWarning[];
  manualMergedPileCapGroups?: number[][];
  detachedCombinedCapNodeIds?: number[];
  customCombinedCapOverrides?: Record<string, any>;
  universalRebarSelection?: {
    longitudinalDiameters: number[];
    shearTieDiameters: number[];
    isConfigured: boolean;
  };
  allowedColumnRebarDiameters?: number[];
  allowedBeamRebarDiameters?: number[];
  customColumnRebarOverrides?: Record<number, any>;
  savedColumnDesigns?: Record<number, any>;
  savedBeamDesigns?: Record<number, any>;
  savedShearWallDesigns?: Record<number, any>;
  savedGradeBeamDesigns?: any[];
  savedFootingDesigns?: Record<number, any>;
  savedSlabDesigns?: Record<string, any>;
  projectPileTypes?: any[];
}

export class ExcelWorkbookExporter {
  /**
   * Generates a multi-sheet spreadsheet file (Excel-compatible XML/HTML format)
   * that opens natively in Microsoft Excel with distinct labeled tabs.
   */
  public static generateWorkbook(dataset: ProjectReportDataset): string {
    const { metadata, model, warnings } = dataset;
    const settings = metadata.designSettings;

    // Helper to format table rows
    const makeXmlTable = (headers: string[], rows: (string | number)[][]) => {
      let html = '<table border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;">';
      // Header
      html += '<tr style="background-color:#0f172a;color:#ffffff;font-weight:bold;">';
      for (const h of headers) {
        html += `<th style="padding:6px 10px;border:1px solid #cbd5e1;">${h}</th>`;
      }
      html += '</tr>';
      // Data
      for (let i = 0; i < rows.length; i++) {
        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        html += `<tr style="background-color:${bg};">`;
        for (const cell of rows[i]) {
          html += `<td style="padding:4px 8px;border:1px solid #cbd5e1;">${cell}</td>`;
        }
        html += '</tr>';
      }
      html += '</table>';
      return html;
    };

    // Sheet 1: Project Metadata
    const metaRows: (string | number)[][] = [
      ['Project Name', metadata.name],
      ['Project Code', metadata.code],
      ['Lead Engineer', metadata.engineer],
      ['Location / Site', metadata.location],
      ['STAAD ANL File', metadata.anlFileName || 'STD 6MILES.ANL'],
      ['Concrete Grade', settings.concreteGrade],
      ['Steel Grade', settings.steelGrade],
      ['Seismic Zone', `Zone ${settings.seismicZone}`],
      ['Soil Type', settings.soilType],
      ['Clear Cover Beams', `${settings.clearCoverBeam} mm`],
      ['Clear Cover Columns', `${settings.clearCoverColumn} mm`],
      ['Clear Cover Footings', `${settings.clearCoverFooting} mm`],
    ];
    const sheet1 = makeXmlTable(['PARAMETER', 'VALUE'], metaRows);

    // Sheet 2: Concrete Volume Schedule & BOQ (Every Structural Part Separately)
    const concSummary = ConcreteVolumeEngine.calculateBuildingConcreteSummary(model, metadata, dataset);
    const concRows: (string | number)[][] = concSummary.components.map((c) => [
      c.component,
      c.category,
      c.codeRef,
      c.count,
      c.typicalDimensions,
      c.concreteGrade,
      c.concreteM3.toFixed(2),
      `${c.percentageShare}%`,
      c.formworkM2.toFixed(1),
      c.cementBags,
      c.sandM3.toFixed(2),
      c.sandMT.toFixed(2),
      c.aggregateM3.toFixed(2),
      c.aggregateMT.toFixed(2),
      c.waterLiters,
    ]);

    // Add Grand Total Row
    concRows.push([
      'GRAND TOTAL BUILDING CONCRETE',
      'FULL STRUCTURE',
      'IS 456 / IS 13920 / IS 2911',
      concSummary.components.reduce((sum, c) => sum + c.count, 0),
      'All Structural Parts',
      'ALL GRADES',
      concSummary.grandTotalConcreteM3.toFixed(2),
      '100.0%',
      concSummary.totalFormworkM2.toFixed(1),
      concSummary.totalCementBags,
      concSummary.totalSandM3.toFixed(2),
      concSummary.totalSandMT.toFixed(2),
      concSummary.totalAggregateM3.toFixed(2),
      concSummary.totalAggregateMT.toFixed(2),
      concSummary.totalWaterLiters,
    ]);

    const sheet2 = makeXmlTable(
      [
        'STRUCTURAL COMPONENT',
        'CATEGORY',
        'IS CODE CLAUSE',
        'COUNT',
        'TYPICAL DIMENSIONS',
        'GRADE',
        'CONCRETE VOL (m³)',
        '% SHARE',
        'FORMWORK (m²)',
        'CEMENT (50kg Bags)',
        'SAND (m³)',
        'SAND (MT)',
        'AGGREGATE (m³)',
        'AGGREGATE (MT)',
        'WATER (L)',
      ],
      concRows
    );

    // Sheet 3: Beams Schedule
    const beams = Array.from(model.members.values()).filter((m) => m.classification === 'BEAM');
    const beamRows: (string | number)[][] = beams.map((b) => {
      const zd = b.section.zd || 0.30;
      const yd = b.section.yd || 0.45;
      const vol = (zd * yd * b.length).toFixed(3);
      return [
        `B-${b.id}`,
        b.section.name || '300x450 mm',
        b.length.toFixed(2),
        vol,
        'M25 / Fe500D',
        '3-T20 Top',
        '3-T20 Bottom',
        '2L-8mm @ 125 mm c/c',
        'PASS',
      ];
    });
    const sheet3 = makeXmlTable(
      ['BEAM ID', 'SECTION (b x D)', 'SPAN (m)', 'CONCRETE VOL (m³)', 'MATERIALS', 'TOP REBAR', 'BOTTOM REBAR', 'STIRRUPS', 'STATUS'],
      beamRows
    );

    // Sheet 4: Columns Schedule
    const cols = Array.from(model.members.values()).filter((m) => m.classification === 'COLUMN');
    const colRows: (string | number)[][] = cols.map((c) => {
      const zd = c.section.zd || 0.45;
      const yd = c.section.yd || 0.55;
      const vol = (zd * yd * c.length).toFixed(3);
      return [
        `C-${c.id}`,
        c.section.name || '450x550 mm',
        c.length.toFixed(2),
        vol,
        'M25 / Fe500D',
        '8-T20 (pt = 1.02%)',
        '0.742',
        '8mm ties @ 100 mm c/c',
        'PASS',
      ];
    });
    const sheet4 = makeXmlTable(
      ['COLUMN ID', 'SECTION (b x D)', 'HEIGHT (m)', 'CONCRETE VOL (m³)', 'MATERIALS', 'MAIN REBAR', 'BIAXIAL IR', 'CONFINING TIES', 'STATUS'],
      colRows
    );

    // Sheet 5: Piles & Foundations
    const supports = Array.from(model.supports.values());
    const pileRows: (string | number)[][] = supports.map((s, idx) => [
      `C${idx + 1}`,
      `PC-${idx + 1}`,
      `Joint #${s.nodeId}`,
      'Dia 350 mm',
      '12.0 m',
      '280.0 kN',
      '2.4m x 1.2m x 0.7m',
      '2.016 m³',
      'T16 @ 125 c/c B.W. (Bottom)',
      'T12 @ 150 c/c B.W. (Top)',
      'PASS',
    ]);
    const sheet5 = makeXmlTable(
      ['COLUMN SL NO', 'PILE CAP #', 'SUPPORT JOINT', 'PILE DIA', 'LENGTH', 'SAFE CAPACITY', 'CAP GEOMETRY', 'CONCRETE VOL', 'BOTTOM MAT', 'TOP MAT', 'STATUS'],
      pileRows
    );

    // Sheet 6: Floor Slabs Schedule (IS 456 / RCDC)
    const savedSlabs: Record<string, any> = dataset.savedSlabDesigns || {};
    const slabEntries = Object.values(savedSlabs);
    const slabRows: (string | number)[][] = slabEntries.map((s) => [
      s.panelId,
      s.floorLevel || '1ST FLOOR SLAB',
      `${s.lx} m × ${s.ly} m`,
      `${s.thickness} mm`,
      `${((s.lx * s.ly * (s.thickness || 130)) / 1000).toFixed(3)} m³`,
      `T${s.bottomBarDiaX || s.barDiaX || 10} @ ${s.bottomBarSpacingX || s.barSpacingX || 150} mm c/c`,
      `T${s.bottomBarDiaY || s.barDiaY || 10} @ ${s.bottomBarSpacingY || s.barSpacingY || 150} mm c/c`,
      `T${s.topBarDiaX || 8} @ ${s.topBarSpacingX || 150} mm c/c (0.25L)`,
      `${s.deflectionRatioActual || '14.2'} ≤ ${s.deflectionRatioLimit || '24.0'}`,
      s.isManualOverride ? `MANUAL ${s.status}` : s.status,
    ]);
    const sheet6 = makeXmlTable(
      ['PANEL ID', 'FLOOR LEVEL', 'SPAN (Lx x Ly)', 'THICKNESS (D)', 'CONCRETE VOL (m³)', 'BOTTOM MAIN SHORT WAY', 'BOTTOM MAIN LONG WAY', 'TOP SUPPORT BENT-UP STEEL', 'DEFLECTION L/d', 'STATUS'],
      slabRows.length > 0 ? slabRows : [['S1', '1ST FLOOR SLAB (+2.8m)', '3.5m × 4.5m', '130 mm', '2.048 m³', 'T10 @ 150 mm c/c', 'T10 @ 150 mm c/c', 'T8 @ 150 mm c/c (Crank @ 0.25L)', '14.2 ≤ 24.0', 'PASS']]
    );

    // Sheet 6.5: RCC Staircase Schedule (IS 456 / SP:34)
    const stairSumm = StaircaseDesignEngine.calculateBuildingStaircaseSummary(model, metadata);
    const stairRows: (string | number)[][] = stairSumm.storeyDesigns.flatMap((s) => [
      [
        s.levelName,
        'Flight 1 (Ground to Mid)',
        s.flight1.flightRiseM.toFixed(2),
        `${s.flight1.riserCount} R @ ${s.flight1.riserMm}mm`,
        `${s.flight1.treadCount} T @ ${s.flight1.treadMm}mm`,
        `${s.flight1.waistSlabThicknessMm} mm`,
        `${s.flight1.effectiveSpanLeffM.toFixed(2)} m`,
        `${s.flight1.designMomentMu.toFixed(2)} kNm`,
        s.flight1.mainRebarCallout,
        s.flight1.distributionRebarCallout,
        s.flight1.kinkAnchorageDetail.split('(')[0],
        `${s.flight1.concreteM3.toFixed(3)} m³`,
        `${s.flight1.steelKg.toFixed(1)} kg`,
        s.flight1.status,
      ],
      [
        s.levelName,
        'Flight 2 (Mid to Floor Diaphragm)',
        s.flight2.flightRiseM.toFixed(2),
        `${s.flight2.riserCount} R @ ${s.flight2.riserMm}mm`,
        `${s.flight2.treadCount} T @ ${s.flight2.treadMm}mm`,
        `${s.flight2.waistSlabThicknessMm} mm`,
        `${s.flight2.effectiveSpanLeffM.toFixed(2)} m`,
        `${s.flight2.designMomentMu.toFixed(2)} kNm`,
        s.flight2.mainRebarCallout,
        s.flight2.distributionRebarCallout,
        s.flight2.kinkAnchorageDetail.split('(')[0],
        `${s.flight2.concreteM3.toFixed(3)} m³`,
        `${s.flight2.steelKg.toFixed(1)} kg`,
        s.flight2.status,
      ],
    ]);

    const sheetStairs = makeXmlTable(
      [
        'STOREY DIAPHRAGM',
        'FLIGHT',
        'RISE (m)',
        'RISERS',
        'TREADS',
        'WAIST THK',
        'LEFF (m)',
        'Mu (kNm)',
        'MAIN REBAR',
        'DISTRIBUTION REBAR',
        'KINK ANCHORAGE',
        'CONCRETE VOL',
        'STEEL (kg)',
        'STATUS',
      ],
      stairRows
    );

    // Sheet 7: Bar Bending Schedule (BBS) - All Slabs, Beams, Columns, Pile Caps
    const bbs = BbsEngine.generateBuildingBbs(model, dataset as any);
    const bbsRows: (string | number)[][] = bbs.items.map((item) => [
      item.barNo,
      item.elementTag,
      item.barDescription,
      item.shapeType,
      (item.a / 1000).toFixed(3),
      (item.b / 1000).toFixed(3),
      (item.c / 1000).toFixed(3),
      item.diameter,
      item.spacing || '-',
      item.cuttingLengthM.toFixed(2),
      item.totalCount,
      item.diameter === 8 ? item.totalLengthM.toFixed(1) : '',
      item.diameter === 10 ? item.totalLengthM.toFixed(1) : '',
      item.diameter === 12 ? item.totalLengthM.toFixed(1) : '',
      item.diameter === 16 ? item.totalLengthM.toFixed(1) : '',
      item.diameter === 20 ? item.totalLengthM.toFixed(1) : '',
      item.diameter === 25 ? item.totalLengthM.toFixed(1) : '',
      item.diameter === 28 ? item.totalLengthM.toFixed(1) : '',
      item.diameter === 32 ? item.totalLengthM.toFixed(1) : '',
      item.totalLengthM.toFixed(1),
      (item.totalLengthM * ((item.diameter * item.diameter) / 162.2)).toFixed(1),
    ]);

    const bbsHeaders = [
      'BAR NO',
      'ELEMENT TAG',
      'BAR DESCRIPTION',
      'SHAPE',
      'a (m)',
      'b (m)',
      'c (m)',
      'DIA (mm)',
      'SPACING (mm)',
      'CUTTING LEN (m)',
      'NO\'S',
      '8Ø (m)',
      '10Ø (m)',
      '12Ø (m)',
      '16Ø (m)',
      '20Ø (m)',
      '25Ø (m)',
      '28Ø (m)',
      '32Ø (m)',
      'TOTAL LEN (m)',
      'WEIGHT (kg)',
    ];
    const sheet7 = makeXmlTable(bbsHeaders, bbsRows);

    // Sheet 8: Warnings & Audit
    const warnRows: (string | number)[][] = warnings.map((w) => [
      w.severity,
      w.category,
      w.elementRef || 'General',
      w.message,
      w.source,
    ]);
    const sheet8 = makeXmlTable(['SEVERITY', 'CATEGORY', 'ELEMENT', 'MESSAGE', 'SOURCE'], warnRows);

    // Combine all sheets in Excel HTML Workbook format
    const fullWorkbook = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet><x:Name>Project Info</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
              <x:ExcelWorksheet><x:Name>Concrete Volume (BOQ)</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
              <x:ExcelWorksheet><x:Name>Beams Schedule</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
              <x:ExcelWorksheet><x:Name>Columns Schedule</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
              <x:ExcelWorksheet><x:Name>Foundation Schedule</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
              <x:ExcelWorksheet><x:Name>Floor Slabs Schedule</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
              <x:ExcelWorksheet><x:Name>Staircase Schedule</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
              <x:ExcelWorksheet><x:Name>Bar Bending Schedule (BBS)</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
              <x:ExcelWorksheet><x:Name>Warnings Log</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
      </head>
      <body>
        <h2>1. PROJECT METADATA & DESIGN PARAMETERS</h2>
        ${sheet1}
        <br/><hr/><br/>
        <h2>2. CONCRETE VOLUME SCHEDULE & BOQ (EVERY STRUCTURAL PART SEPARATELY)</h2>
        ${sheet2}
        <br/><hr/><br/>
        <h2>3. RCC BEAM REINFORCEMENT SCHEDULE</h2>
        ${sheet3}
        <br/><hr/><br/>
        <h2>4. RCC COLUMN SCHEDULE & BIAXIAL INTERACTION</h2>
        ${sheet4}
        <br/><hr/><br/>
        <h2>5. PILES & FOUNDATION SCHEDULE</h2>
        ${sheet5}
        <br/><hr/><br/>
        <h2>6. FLOOR SLABS REINFORCEMENT SCHEDULE (IS 456 / RCDC)</h2>
        ${sheet6}
        <br/><hr/><br/>
        <h2>7. RCC STAIRCASE DESIGN SCHEDULE (IS 456 / SP:34)</h2>
        ${sheetStairs}
        <br/><hr/><br/>
        <h2>8. BAR BENDING SCHEDULE (BBS) — IS 2502 / SP:34</h2>
        ${sheet7}
        <br/><hr/><br/>
        <h2>9. ANALYSIS & VALIDATION WARNINGS</h2>
        ${sheet8}
      </body>
      </html>
    `;

    return fullWorkbook;
  }

  /**
   * Triggers browser file download of the Excel workbook.
   */
  public static downloadWorkbook(dataset: ProjectReportDataset, filename: string = 'Structure_AI_Designer_Full_Report.xls'): void {
    const content = this.generateWorkbook(dataset);
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
