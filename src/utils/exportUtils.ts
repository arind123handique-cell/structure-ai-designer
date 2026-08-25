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
