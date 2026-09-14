/**
 * DXF export service — generates and downloads .dxf files from DrawingSheets.
 *
 * For detail sheets (beam sections, slab details): iterates SheetPrimitive[]
 * via the shared writeDxf() writer.
 *
 * For floor plans: renders the plan imperatively to DXF (matching the PDF
 * export pattern) using FloorPlanLevel data directly.
 */

import { DrawingSheet, SheetLayer, LAYER_GRID, LAYER_BEAM, LAYER_CONCRETE, LAYER_LABELS, LAYER_LABELS_SUPPORT, LAYER_DIMENSION, LAYER_TEXT } from '../sheet/drawingSheet';
import { FloorPlanLevel } from '../floorPlanEngine';
import { writeDxf } from './dxfWriter';

// ---------------------------------------------------------------------------
// DXF section helpers (for floor plan imperative export)
// ---------------------------------------------------------------------------

const CRLF = '\r\n';

function g(code: number, value: string | number): string {
  return `${code}${CRLF}${value}${CRLF}`;
}

function writeLine(layer: string, x1: number, y1: number, x2: number, y2: number): string {
  return g(0, 'LINE') + g(8, layer) + g(10, x1) + g(20, y1) + g(30, 0) + g(11, x2) + g(21, y2) + g(31, 0);
}

function writeLwPolyline(layer: string, pts: [number, number][], closed: boolean): string {
  if (pts.length < 2) return '';
  return g(0, 'LWPOLYLINE') + g(8, layer) + g(90, pts.length) + g(70, closed ? 1 : 0)
    + pts.map(([x, y]) => g(10, x) + g(20, y)).join('');
}

function writeCircle(layer: string, cx: number, cy: number, r: number): string {
  return g(0, 'CIRCLE') + g(8, layer) + g(10, cx) + g(20, cy) + g(30, 0) + g(40, r);
}

function writeSolid(layer: string, pts: [number, number][]): string {
  if (pts.length < 3) return '';
  const [a, b, c, d] = pts;
  return g(0, 'SOLID') + g(8, layer)
    + g(10, a[0]) + g(20, a[1]) + g(30, 0)
    + g(11, b[0]) + g(21, b[1]) + g(31, 0)
    + g(12, c[0]) + g(22, c[1]) + g(32, 0)
    + (d ? g(13, d[0]) + g(23, d[1]) + g(33, 0) : '');
}

function writeMText(layer: string, x: number, y: number, text: string, h: number): string {
  return g(0, 'MTEXT') + g(8, layer) + g(10, x) + g(20, y) + g(30, 0)
    + g(40, h) + g(1, text) + g(71, 1) + g(72, 5);
}

// ---------------------------------------------------------------------------
// Floor plan layers (matching source DXF)
// ---------------------------------------------------------------------------

const FP_LAYERS: SheetLayer[] = [
  { name: 'Grid Line', aci: 8 },
  { name: 'Beam', aci: 3 },
  { name: 'Beam Nos', aci: 7 },
  { name: 'Column', aci: 2 },
  { name: 'Column Nos', aci: 7 },
  { name: 'Slab', aci: 2 },
  { name: 'Labels', aci: 4 },
  { name: 'Dimension', aci: 31 },
  { name: 'Text', aci: 31 },
];

// ---------------------------------------------------------------------------
// Floor plan DXF generation (imperative, matching PDF pattern)
// ---------------------------------------------------------------------------

function writeFloorPlanDxf(
  fp: FloorPlanLevel,
  beamLabels: Map<number, string>,
  sheetTitle: string,
): string {
  const bounds = fp.bounds;
  const minX = bounds.minX - 1.0;
  const maxX = bounds.maxX + 1.0;
  const minZ = bounds.minZ - 1.0;
  const maxZ = bounds.maxZ + 1.0;

  let entities = '';

  // Grid lines
  fp.gridLinesX.forEach((gl) => {
    const gx = gl.coord * 1000;
    entities += writeLine('Grid Line', gx, minZ * 1000 - 1000, gx, maxZ * 1000 + 1000);
    entities += writeCircle('Grid Line', gx, maxZ * 1000 + 1500, 300);
    entities += writeMText('Grid Line', gx, maxZ * 1000 + 1500, gl.id, 200);
  });
  fp.gridLinesZ.forEach((gl) => {
    const gy = gl.coord * 1000;
    entities += writeLine('Grid Line', minX * 1000 - 1000, gy, maxX * 1000 + 1000, gy);
    entities += writeCircle('Grid Line', minX * 1000 - 1500, gy, 300);
    entities += writeMText('Grid Line', minX * 1000 - 1500, gy, gl.id, 200);
  });

  // Slabs
  if (!fp.isFoundationLevel && fp.slabs) {
    fp.slabs.forEach((s) => {
      if (s.points.length >= 3) {
        const pts: [number, number][] = s.points.map((p) => [p.x * 1000, p.z * 1000]);
        entities += writeLwPolyline('Slab', pts, true);
        const cx = s.points.reduce((a, p) => a + p.x * 1000, 0) / s.points.length;
        const cy = s.points.reduce((a, p) => a + p.z * 1000, 0) / s.points.length;
        entities += writeMText('Labels', cx, cy, s.label, 180);
      }
    });
  }

  // Beams
  fp.beams.forEach((bm) => {
    const x1 = bm.startX * 1000;
    const y1 = bm.startZ * 1000;
    const x2 = bm.endX * 1000;
    const y2 = bm.endZ * 1000;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const nx = -dy / len;
    const ny = dx / len;
    const hw = Math.max(3, ((bm.width || 0.23) / 2) * 1000);

    // Beam outline (4-point polyline)
    const pts: [number, number][] = [
      [x1 + nx * hw, y1 + ny * hw],
      [x2 + nx * hw, y2 + ny * hw],
      [x2 - nx * hw, y2 - ny * hw],
      [x1 - nx * hw, y1 - ny * hw],
    ];
    entities += writeLwPolyline('Beam', pts, true);

    // Beam label
    const label = beamLabels.get(bm.memberId) || bm.label || `B${bm.memberId}`;
    if (len >= 25) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      entities += writeMText('Beam Nos', midX, midY, label, 160);
    }
  });

  // Columns
  fp.columns.forEach((col) => {
    const cx = col.x * 1000;
    const cy = col.z * 1000;
    const cw = Math.max(8, (col.width || 0.45) * 1000);
    const cd = Math.max(8, (col.depth || 0.55) * 1000);

    // Column outline
    const pts: [number, number][] = [
      [cx - cw / 2, cy - cd / 2],
      [cx + cw / 2, cy - cd / 2],
      [cx + cw / 2, cy + cd / 2],
      [cx - cw / 2, cy + cd / 2],
    ];
    entities += writeLwPolyline('Column', pts, true);

    // X hatch
    entities += writeLine('Column', cx - cw / 2, cy - cd / 2, cx + cw / 2, cy + cd / 2);
    entities += writeLine('Column', cx - cw / 2, cy + cd / 2, cx + cw / 2, cy - cd / 2);

    // Label
    entities += writeMText('Column Nos', cx, cy + cd / 2 + 400, col.label, 200);
  });

  // Build full DXF
  const layerTable = FP_LAYERS.map((l) =>
    g(0, 'LAYER') + g(5, `1${FP_LAYERS.indexOf(l).toString().padStart(3, '0')}`)
    + g(330, '2') + g(100, 'AcDbSymbolTableRecord') + g(100, 'AcDbLayerTableRecord')
    + g(2, l.name) + g(70, 0) + g(62, l.aci) + g(6, 'Continuous')
  ).join('');

  let dxf = '';
  dxf += g(0, 'SECTION') + g(2, 'HEADER');
  dxf += g(9, '$ACADVER') + g(1, 'AC1024');
  dxf += g(9, '$INSUNITS') + g(70, 4);
  dxf += g(9, '$EXTMIN') + g(10, minX * 1000 - 2000) + g(20, minZ * 1000 - 2000) + g(30, 0);
  dxf += g(9, '$EXTMAX') + g(10, maxX * 1000 + 2000) + g(20, maxZ * 1000 + 2000) + g(30, 0);
  dxf += g(0, 'ENDSEC');

  dxf += g(0, 'SECTION') + g(2, 'TABLES');
  dxf += g(0, 'TABLE') + g(2, 'LAYER') + g(5, '2') + g(70, FP_LAYERS.length);
  dxf += layerTable;
  dxf += g(0, 'ENDTAB');
  dxf += g(0, 'ENDSEC');

  dxf += g(0, 'SECTION') + g(2, 'BLOCKS') + g(0, 'ENDSEC');

  dxf += g(0, 'SECTION') + g(2, 'ENTITIES');
  dxf += entities;
  dxf += g(0, 'ENDSEC');
  dxf += g(0, 'EOF');

  return dxf;
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function exportSheetDxf(sheet: DrawingSheet, projectName?: string): void {
  const dxf = writeDxf(sheet);
  const safeName = (projectName || 'Structure').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}_${sheet.sheetNumber}_${sheet.levelName || 'Sheet'}.dxf`;
  downloadFile(dxf, filename, 'application/dxf');
}

export function exportFloorPlanDxf(
  fp: FloorPlanLevel,
  beamLabels: Map<number, string>,
  projectName?: string,
): void {
  const dxf = writeFloorPlanDxf(fp, beamLabels, `${fp.levelName} BEAM LAYOUT PLAN`);
  const safeName = (projectName || 'Structure').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeName}_STR-${200 + (fp.levelIndex || 0)}-PLAN_${fp.levelName}_Plan.dxf`;
  downloadFile(dxf, filename, 'application/dxf');
}
