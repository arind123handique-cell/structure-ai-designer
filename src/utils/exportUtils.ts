/**
 * Export array of JSON records as downloadable CSV file in browser.
 */
export function exportToCsv(rows: Record<string, any>[], filename: string): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvLines: string[] = [];

  // Header line
  csvLines.push(headers.map((h) => `"${h}"`).join(','));

  // Data lines
  for (const row of rows) {
    const values = headers.map((header) => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
      return String(val);
    });
    csvLines.push(values.join(','));
  }

  const csvString = csvLines.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export structural model as downloadable Bentley STAAD.Pro .STD command file
 */
export function exportToStd(model: any, filename: string, jobInfo?: any): void {
  import('@/features/anl/stdCommandEngine').then(({ StdCommandEngine }) => {
    const stdContent = StdCommandEngine.generateStd(model, jobInfo);
    const blob = new Blob([stdContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.STD') ? filename : `${filename}.STD`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
}

/**
 * Export pile cap drawings as a multi-page PDF (A4 Plan + A3 Cross Section).
 * Uses html2canvas to rasterize SVG elements, then composites onto jsPDF pages.
 */
export async function exportPileCapDrawingsPdf(
  drawingElements: HTMLElement[],
  filenames: string[]
): Promise<void> {
  const [{ default: jsPDF }, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = html2canvasModule.default;

  if (drawingElements.length === 0) return;

  // A4 landscape for plan view
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const a4W = 297;
  const a4H = 210;
  const margin = 8;

  for (let i = 0; i < drawingElements.length; i++) {
    const el = drawingElements[i];
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = Math.min((a4W - 2 * margin) / imgW, (a4H - 2 * margin) / imgH);
    const drawW = imgW * ratio;
    const drawH = imgH * ratio;
    const x = (a4W - drawW) / 2;
    const y = (a4H - drawH) / 2;

    if (i > 0) doc.addPage('a4', 'landscape');
    doc.addImage(imgData, 'PNG', x, y, drawW, drawH);

    // Add cross-section on A3 page
    const sectionEl = (el.querySelector('[data-section-view]') as HTMLElement) || el;
    const secCanvas = await html2canvas(sectionEl, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    const secImgData = secCanvas.toDataURL('image/png');
    const a3W = 420;
    const a3H = 297;
    doc.addPage('a3', 'landscape');
    const secRatio = Math.min((a3W - 2 * margin) / secCanvas.width, (a3H - 2 * margin) / secCanvas.height);
    const secDrawW = secCanvas.width * secRatio;
    const secDrawH = secCanvas.height * secRatio;
    const secX = (a3W - secDrawW) / 2;
    const secY = (a3H - secDrawH) / 2;
    doc.addImage(secImgData, 'PNG', secX, secY, secDrawW, secDrawH);
  }

  doc.save(`PileCap_Drawings_${Date.now()}.pdf`);
}

