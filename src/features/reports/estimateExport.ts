/**
 * Full Estimate Format Exporter (PWD/CPWD DETAIL ESTIMATE style).
 * Generates an Excel workbook where the design take-off and measurement are in the
 * traditional DSR measurement-sheet format used by public works departments:
 *
 *   SL. No | CODE NO | PARTICULARS |  L (×B×H measurement columns)  | QTY | UNIT | RATE | AMOUNT
 *
 * with per-item "Total =" subtotal rows, category grouping, an Abstract of Cost sheet,
 * concrete-volume schedule, and a diameter-wise bar bending / rebar take-off, ending with
 * the grand total and a "SAY = Rupees ... only" statement in Indian number words.
 */

import { BoqEngine, BuildingBoqEstimate } from '@/features/calculations/boqEngine';
import { ConcreteVolumeEngine } from '@/features/calculations/concreteVolumeEngine';
import { BbsEngine } from '@/features/calculations/bbsEngine';
import { ProjectReportDataset } from './excelExport';

// ---------------------------------------------------------------------------
// Indian number helpers
// ---------------------------------------------------------------------------

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return TENS[t] + (u ? ' ' + ONES[u] : '');
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let out = '';
  if (h) out += ONES[h] + ' Hundred';
  if (h && rest) out += ' ';
  if (rest) out += twoDigits(rest);
  return out;
}

/**
 * Converts a rupee amount to Indian number words, e.g. 12,34,567.89 ->
 * "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven And Paisa Eighty Nine".
 */
export function indianRupeesInWords(amount: number): string {
  const num = Math.abs(Math.round(amount * 100) / 100);
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let out = '';
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  if (num === 0) return 'Zero';
  if (crore) out += threeDigits(crore) + ' Crore ';
  if (lakh) out += threeDigits(lakh) + ' Lakh ';
  if (thousand) out += twoDigits(thousand) + ' Thousand ';
  if (hundred) out += threeDigits(hundred);
  if (paise) out += ' And Paisa ' + twoDigits(paise);
  return out.trim();
}

/** Formats a number with Indian digit grouping (lakh/crore). */
export function formatIndianNumber(n: number, decimals = 2): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  const intPart = Math.floor(v);
  const frac = (v - intPart).toFixed(decimals).slice(1);
  const s = String(intPart);
  if (s.length <= 3) return sign + s + frac;
  const first = s.slice(0, s.length - 3);
  const last = s.slice(-3);
  const rest = first.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return sign + rest + ',' + last + frac;
}

// ---------------------------------------------------------------------------
// Excel (SpreadsheetML) table fragments
// ---------------------------------------------------------------------------

type Cell = string | number;

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function tableHtml(headers: Cell[], rows: Cell[][], opts?: { boldLastRow?: boolean; alignRightFrom?: number }): string {
  let html = '<table class="est" border="1" cellspacing="0" cellpadding="2" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:10px;">';
  html += '<tr style="background-color:#1c3f60;color:#ffffff;font-weight:bold;">';
  for (const h of headers) html += `<th style="padding:4px 6px;border:1px solid #7f9db9;text-align:center;">${esc(String(h))}</th>`;
  html += '</tr>';
  for (let i = 0; i < rows.length; i++) {
    const isLast = opts?.boldLastRow && i === rows.length - 1;
    const bg = isLast ? '#d9e2f3' : i % 2 === 0 ? '#ffffff' : '#f3f6fa';
    html += `<tr style="background-color:${bg};${isLast ? 'font-weight:bold;' : ''}">`;
    for (let j = 0; j < headers.length; j++) {
      const cell = rows[i][j];
      const val = cell === undefined || cell === null ? '' : typeof cell === 'number' ? formatIndianNumber(cell, /%|No\.?s/.test(String(headers[j])) ? 0 : 2) : String(cell);
      const align = opts?.alignRightFrom !== undefined && j >= opts.alignRightFrom ? 'right' : j === 0 ? 'center' : 'left';
      html += `<td style="padding:3px 5px;border:1px solid #b7c8dc;text-align:${align};">${esc(val)}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}

function sectionHeader(text: string): string {
  return `<h3 style="font-family:Arial,sans-serif;font-size:11px;color:#1c3f60;margin:14px 0 4px 0;">${esc(text)}</h3>`;
}

// ---------------------------------------------------------------------------
// Workbook generation
// ---------------------------------------------------------------------------

export class FullEstimateExporter {
  public static generateEstimate(dataset: ProjectReportDataset): string {
    const { metadata, model, projectPileTypes } = dataset;
    const boq: BuildingBoqEstimate = BoqEngine.generateBuildingBoq(model, undefined, metadata.name);
    const concSummary = ConcreteVolumeEngine.calculateBuildingConcreteSummary(model, metadata, dataset);

    // ---- Sheet 1: DETAIL ESTIMATE (Measurement) ---------------------------
    const measureHeaders: Cell[] = ['SL. NO', 'CODE NO', 'PARTICULARS', 'L', '×', 'B', '×', 'H/D', 'QTY', 'UNIT', 'RATE (Rs.)', 'AMOUNT (Rs.)'];
    const measureRows: Cell[][] = [];

    const unitLabel = (u: string) => {
      switch (u) {
        case 'm2': return 'sqm';
        case 'm3': return 'cum';
        case 'kg': return 'kg';
        case 'MT': return 'MT';
        case 'Nos': return 'Nos.';
        default: return u;
      }
    };

    const categoryTitle: Record<string, string> = {
      SUBSTRUCTURE: 'A — SUBSTRUCTURE (Below Plinth Level)',
      SUPERSTRUCTURE: 'B — SUPERSTRUCTURE (Above Plinth Level)',
      REBAR: 'C — STEEL REINFORCEMENT',
      FINISHES: 'D — FINISHES & ARCHITECTURAL WORKS',
    };

    for (const cat of boq.categories) {
      measureRows.push([cat.categoryName, '', categoryTitle[cat.categoryName] || cat.categoryName, '', '', '', '', '', '', '', '', '']);
      for (const it of cat.items) {
        const product = (Number(it.nos) || 0) * (Number(it.lengthM) || 0) * (Number(it.breadthM) || 0) * (Number(it.heightOrDepthM) || 0);
        measureRows.push([
          it.itemNo,
          it.codeReference || '',
          it.description,
          it.nos,
          '×',
          it.lengthM,
          '×',
          it.breadthM,
          it.heightOrDepthM,
          unitLabel(it.unit),
          it.unitRateInr,
          it.totalAmountInr,
        ]);
        measureRows.push(['', '', `Total = ${formatIndianNumber(product)} ${unitLabel(it.unit)} @ Rs. ${formatIndianNumber(it.unitRateInr)} = Rs. ${formatIndianNumber(it.totalAmountInr)}`, '', '', '', '', '', '', '', '', '']);
      }
    }
    measureRows.push(['', '', 'TOTAL OF CIVIL WORKS =', '', '', '', '', '', '', '', '', `Rs. ${formatIndianNumber(boq.grandTotalAmountInr)}`]);
    measureRows.push(['', '', `SAY = ${indianRupeesInWords(boq.grandTotalAmountInr)} ${''}only`, '', '', '', '', '', '', '', '', boq.grandTotalAmountInr]);

    // ---- Sheet 2: ABSTRACT OF COST ----------------------------------------
    const abstractRows: Cell[][] = boq.categories.map((c, i) => [
      i + 1,
      c.categoryName,
      c.totalQuantity,
      unitLabel(c.unit),
      `${formatIndianNumber(c.totalAmountInr / Math.max(c.totalQuantity, 0.0001))}`,
      c.totalAmountInr,
    ]);
    abstractRows.push(['', 'GRAND TOTAL (CIVIL WORKS)', '', '', '', boq.grandTotalAmountInr]);
    abstractRows.push(['', `SAY = Rupees ${indianRupeesInWords(boq.grandTotalAmountInr)} only`, '', '', '', '']);

    // ---- Sheet 3: CONCRETE VOLUME SCHEDULE (CS) ---------------------------
    const csRows: Cell[][] = concSummary.components.map((c) => [
      c.component,
      c.category,
      c.count,
      c.typicalDimensions,
      c.concreteGrade,
      c.concreteM3,
      `${c.percentageShare}%`,
      c.formworkM2,
    ]);
    csRows.push(['GRAND TOTAL BUILDING CONCRETE', 'FULL STRUCTURE', concSummary.components.reduce((s, c) => s + c.count, 0), 'All Structural Parts', 'ALL GRADES', concSummary.grandTotalConcreteM3, '100.0%', concSummary.totalFormworkM2]);

    // ---- Sheet 4: BAR BENDING SCHEDULE / REBAR TAKE-OFF --------------------
    const bbs = BbsEngine.generateBuildingBbs(model, dataset as any);
    const diaCols = [8, 10, 12, 16, 20, 25, 28, 32];
    const bbsHeaders: Cell[] = ['BAR NO', 'ELEMENT TAG', 'BAR DESCRIPTION', 'DIA (mm)', 'CUTTING LEN (m)', "NO'S", ...diaCols.map((d) => `${d}Ø (m)`), 'TOTAL LEN (m)', 'WEIGHT (kg)'];
    const bbsRows: Cell[][] = bbs.items.map((item) => [
      item.barNo,
      item.elementTag,
      item.barDescription,
      item.diameter,
      item.cuttingLengthM,
      item.totalCount,
      ...diaCols.map((d) => (d === item.diameter ? item.totalLengthM : '')),
      item.totalLengthM,
      (item.totalLengthM * ((item.diameter * item.diameter) / 162.2)).toFixed(1),
    ]);
    const rebarTakeoffRows: Cell[][] = Object.entries(boq.rebarTakeoffMt).map(([dia, mt]) => [
      `${dia} mm TMT (Fe500D)`,
      `${(mt * 1000).toFixed(0)} kg`,
      `${mt.toFixed(2)} MT`,
    ]);
    rebarTakeoffRows.push(['TOTAL STEEL WEIGHT', `${(boq.totalRebarWeightMt * 1000).toFixed(0)} kg`, `${boq.totalRebarWeightMt.toFixed(2)} MT`]);

    // ---- Workbook assembly ------------------------------------------------
    const workDir = 'Sheet_Estimate';
    const nameOfWork = `Name of Work :-  ${metadata.name}${
      metadata.location ? `  (${metadata.location})` : ''
    }  —  Estimated Amount : Rs. ${formatIndianNumber(boq.grandTotalAmountInr)}`;

    const fullWorkbook = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet><x:Name>DETAIL ESTIMATE</x:Name><x:WorksheetOptions><x:DisplayGridlines/><x:FreezePanes/><x:FrozenNoSplit/></x:WorksheetOptions></x:ExcelWorksheet>
        <x:ExcelWorksheet><x:Name>ABSTRACT</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
        <x:ExcelWorksheet><x:Name>CONCRETE (CS)</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
        <x:ExcelWorksheet><x:Name>BBS - REBAR TAKE OFF</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
</head>
<body>
  <h2 style="font-family:Arial,sans-serif;text-align:center;color:#1c3f60;">GOVT. OF ASSAM — P.W.D.<br/>DETAIL ESTIMATE OF CIVIL WORKS</h2>
  <p style="font-family:Arial,sans-serif;font-size:11px;border:1px solid #1c3f60;padding:6px;">${esc(nameOfWork)}</p>
  ${sectionHeader('DETAIL ESTIMATE — MEASUREMENT OF DESIGN TAKE-OFF')}
  ${tableHtml(measureHeaders, measureRows, { alignRightFrom: 8 })}
  <br/>
  <p style="font-family:Arial,sans-serif;font-size:10px;color:#334155;">
    Note: Rates are quoted as per the applicable Schedule of Rates (DSR) &amp; IS 456:2000 / IS 13920 / IS 2911 design take-off.
  </p>
  <br/><hr/><br/>
  ${sectionHeader('ABSTRACT OF COST')}
  ${tableHtml(['SL. NO', 'PARTICULARS', 'QUANTITY', 'UNIT', 'AVERAGE RATE (Rs.)', 'AMOUNT (Rs.)'], abstractRows, { boldLastRow: true, alignRightFrom: 2 })}
  <br/><hr/><br/>
  ${sectionHeader('CONCRETE VOLUME SCHEDULE (CS) — EVERY STRUCTURAL PART SEPARATELY')}
  ${tableHtml(['STRUCTURAL COMPONENT', 'CATEGORY', 'COUNT', 'TYPICAL DIMENSIONS', 'GRADE', 'CONCRETE (m³)', '% SHARE', 'FORMWORK (m²)'], csRows, { boldLastRow: true, alignRightFrom: 4 })}
  <br/><hr/><br/>
  ${sectionHeader('BBS — DIAMETER-WISE REBAR TAKE-OFF')}
  ${tableHtml(['DIAMETER', 'WEIGHT (kg)', 'WEIGHT (MT)'], rebarTakeoffRows, { boldLastRow: true, alignRightFrom: 1 })}
  <br/>
  ${sectionHeader('BAR BENDING SCHEDULE (IS 2502 / SP:34)')}
  ${tableHtml(bbsHeaders, bbsRows, { alignRightFrom: 4 })}
</body>
</html>
`;

    void workDir;
    void projectPileTypes;
    return fullWorkbook;
  }

  public static downloadEstimate(
    dataset: ProjectReportDataset,
    filename: string = 'Full_Estimate_Civil_Works.xls'
  ): void {
    const content = this.generateEstimate(dataset);
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
