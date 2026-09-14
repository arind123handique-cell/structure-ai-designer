/**
 * ASCII DXF writer — converts DrawingSheet primitives to AutoCAD DXF.
 *
 * Output is a valid AutoCAD 2018 DXF with:
 *   HEADER  — $INSUNITS = 4 (mm), units = mm
 *   TABLES  — LAYER table with ACI colours from the source drawing
 *   ENTITIES — LINE, LWPOLYLINE, CIRCLE, SOLID, MTEXT per primitive
 *   EOF
 *
 * Layers match the source DXF conventions exactly (names + ACI colours).
 * Y-coordinates are passed through as-is (model mm = DXF mm).
 */

import {
  DrawingSheet,
  SheetPrimitive,
  SheetLayer,
  SheetBounds,
  computeBounds,
} from '../sheet/drawingSheet';

// ---------------------------------------------------------------------------
// DXF section helpers
// ---------------------------------------------------------------------------

const CRLF = '\r\n';

function group(code: number, value: string | number): string {
  return `${code}${CRLF}${value}${CRLF}`;
}

// ---------------------------------------------------------------------------
// Layer table
// ---------------------------------------------------------------------------

function buildLayerTable(layers: SheetLayer[]): string {
  let s = '';
  s += group(0, 'LAYER');
  s += group(5, '2');           // handle
  s += group(330, '0');         // owner
  s += group(100, 'AcDbSymbolTable');
  s += group(70, layers.length); // count

  layers.forEach((l, i) => {
    s += group(0, 'LAYER');
    s += group(5, `1${String(i).padStart(3, '0')}`);
    s += group(330, '2');
    s += group(100, 'AcDbSymbolTableRecord');
    s += group(100, 'AcDbLayerTableRecord');
    s += group(2, l.name);
    s += group(70, 0);         // flags
    s += group(62, l.aci);     // ACI colour
    s += group(6, 'Continuous'); // linetype
  });

  return s;
}

// ---------------------------------------------------------------------------
// Entity writers
// ---------------------------------------------------------------------------

function writeLine(layer: string, x1: number, y1: number, x2: number, y2: number): string {
  let s = '';
  s += group(0, 'LINE');
  s += group(8, layer);
  s += group(10, x1);
  s += group(20, y1);
  s += group(30, 0);
  s += group(11, x2);
  s += group(21, y2);
  s += group(31, 0);
  return s;
}

function writeLwPolyline(layer: string, pts: [number, number][], closed: boolean): string {
  if (pts.length < 2) return '';
  let s = '';
  s += group(0, 'LWPOLYLINE');
  s += group(8, layer);
  s += group(90, pts.length);
  s += group(70, closed ? 1 : 0);
  pts.forEach(([x, y]) => {
    s += group(10, x);
    s += group(20, y);
  });
  return s;
}

function writeCircle(layer: string, cx: number, cy: number, r: number): string {
  let s = '';
  s += group(0, 'CIRCLE');
  s += group(8, layer);
  s += group(10, cx);
  s += group(20, cy);
  s += group(30, 0);
  s += group(40, r);
  return s;
}

function writeSolid(layer: string, pts: [number, number][]): string {
  // DXF SOLID supports 3 or 4 vertices
  if (pts.length < 3) return '';
  const [a, b, c, d] = pts;
  let s = '';
  s += group(0, 'SOLID');
  s += group(8, layer);
  s += group(10, a[0]);
  s += group(20, a[1]);
  s += group(30, 0);
  s += group(11, b[0]);
  s += group(21, b[1]);
  s += group(31, 0);
  s += group(12, c[0]);
  s += group(22, c[1]);
  s += group(32, 0);
  if (d) {
    s += group(13, d[0]);
    s += group(23, d[1]);
    s += group(33, 0);
  }
  return s;
}

function writeMText(layer: string, x: number, y: number, text: string, height: number): string {
  let s = '';
  s += group(0, 'MTEXT');
  s += group(8, layer);
  s += group(10, x);
  s += group(20, y);
  s += group(30, 0);
  s += group(40, height);      // char height
  s += group(1, text);         // text string
  s += group(71, 1);           // attachment point: top-left
  s += group(72, 5);           // drawing direction: left-to-right
  return s;
}

// ---------------------------------------------------------------------------
// Main exporter
// ---------------------------------------------------------------------------

export function writeDxf(sheet: DrawingSheet): string {
  const layers = sheet.layers;
  const bounds: SheetBounds = sheet.bounds || computeBounds(sheet.primitives);

  let dxf = '';

  // ---- HEADER section ----
  dxf += group(0, 'SECTION');
  dxf += group(2, 'HEADER');
  dxf += group(9, '$ACADVER');
  dxf += group(1, 'AC1024');        // AutoCAD 2010+
  dxf += group(9, '$INSUNITS');
  dxf += group(70, 4);             // mm
  dxf += group(9, '$EXTMIN');
  dxf += group(10, bounds.minX);
  dxf += group(20, bounds.minY);
  dxf += group(30, 0);
  dxf += group(9, '$EXTMAX');
  dxf += group(10, bounds.maxX);
  dxf += group(20, bounds.maxY);
  dxf += group(30, 0);
  dxf += group(0, 'ENDSEC');

  // ---- TABLES section ----
  dxf += group(0, 'SECTION');
  dxf += group(2, 'TABLES');

  // Layer table
  dxf += group(0, 'TABLE');
  dxf += group(2, 'LAYER');
  dxf += group(5, '2');
  dxf += group(70, layers.length);
  dxf += buildLayerTable(layers);
  dxf += group(0, 'ENDTAB');

  dxf += group(0, 'ENDSEC');

  // ---- BLOCKS section (required, can be empty) ----
  dxf += group(0, 'SECTION');
  dxf += group(2, 'BLOCKS');
  dxf += group(0, 'ENDSEC');

  // ---- ENTITIES section ----
  dxf += group(0, 'SECTION');
  dxf += group(2, 'ENTITIES');

  sheet.primitives.forEach((p: SheetPrimitive) => {
    switch (p.t) {
      case 'line':
        dxf += writeLine(p.layer, p.x1, p.y1, p.x2, p.y2);
        break;

      case 'poly':
        dxf += writeLwPolyline(p.layer, p.pts, !!p.closed);
        break;

      case 'circle':
        dxf += writeCircle(p.layer, p.cx, p.cy, p.r);
        break;

      case 'solid':
        dxf += writeSolid(p.layer, p.pts);
        break;

      case 'text':
        dxf += writeMText(p.layer, p.x, p.y, p.text, p.h);
        break;

      case 'image':
        // Skip raster images in DXF (can't embed in ASCII DXF easily)
        break;
    }
  });

  dxf += group(0, 'ENDSEC');

  // ---- EOF ----
  dxf += group(0, 'EOF');

  return dxf;
}
