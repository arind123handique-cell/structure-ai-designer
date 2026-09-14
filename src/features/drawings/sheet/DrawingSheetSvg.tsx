import React, { useMemo } from 'react';
import { DrawingSheet, SheetPrimitive, SheetBounds, layerStroke } from './drawingSheet';

interface DrawingSheetSvgProps {
  sheet: DrawingSheet;
  /** 'dark' = blueprint workspace, 'light' = AutoCAD white paper space. */
  theme?: 'dark' | 'light';
  /** Target rendered width in CSS pixels. Height is derived from the sheet aspect. */
  width?: number;
  /**
   * Shrink the rendered width so the whole sheet fits within this many CSS
   * pixels of height (used by the 'Fit: Screen' toggle).
   */
  maxHeight?: number;
  /** Extra scale applied to line weights (1 = default hairlines). */
  lineWeightScale?: number;
}

const stripFormatting = (text: string): string =>
  text
    // BricsCAD / AutoCAD text codes found in the source drawings
    .replace(/\\A1;?/g, '')
    .replace(/\\P/g, ' ')
    .replace(/%%u/gi, '')
    .replace(/%%U/gi, '');

const isUnderlined = (text: string): boolean => /%%u/i.test(text);

/**
 * Renders a `DrawingSheet` (model units = mm) as an SVG in CAD style.
 * Y is flipped from model space (up) to SVG space (down).
 */
export const DrawingSheetSvg: React.FC<DrawingSheetSvgProps> = ({
  sheet,
  theme = 'dark',
  width = 1400,
  maxHeight,
  lineWeightScale = 1,
}) => {
  const bounds: SheetBounds = sheet.bounds;
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const renderWidth = maxHeight
    ? Math.max(320, Math.min(width, (maxHeight * spanX) / spanY))
    : width;
  const height = Math.round((renderWidth * spanY) / spanX);

  // Hairline weight in model units — scales with sheet size so it looks uniform.
  const hair = (Math.max(spanX, spanY) / 2400) * lineWeightScale;

  const Y = React.useCallback((y: number) => bounds.maxY - y, [bounds.maxY]);

  const layers = useMemo(
    () => new Map(sheet.layers.map((l) => [l.name, l])),
    [sheet.layers]
  );

  const stroke = React.useCallback(
    (name: string) => layerStroke(layers.get(name) || { name, aci: 7 }, theme),
    [layers, theme]
  );

  const bg = theme === 'dark' ? '#0b1220' : '#ffffff';
  const titleColor = theme === 'dark' ? '#cfe3ff' : '#0b2545';

  const renderPrimitive = (p: SheetPrimitive, i: number) => {
    const color = stroke(p.layer);
    const sw = ('width' in p && p.width ? p.width : hair);

    switch (p.t) {
      case 'line':
        return (
          <line
            key={i}
            x1={p.x1}
            y1={Y(p.y1)}
            x2={p.x2}
            y2={Y(p.y2)}
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        );

      case 'poly': {
        const pts = p.closed ? [...p.pts, p.pts[0]] : p.pts;
        return (
          <polyline
            key={i}
            points={pts.map(([x, y]) => `${x},${Y(y)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      }

      case 'circle':
        return (
          <circle
            key={i}
            cx={p.cx}
            cy={Y(p.cy)}
            r={p.r}
            fill={p.filled ? color : 'none'}
            stroke={color}
            strokeWidth={sw}
          />
        );

      case 'solid':
        return (
          <polygon
            key={i}
            points={p.pts.map(([x, y]) => `${x},${Y(y)}`).join(' ')}
            fill={color}
            stroke={color}
            strokeWidth={sw * 0.6}
          />
        );

      case 'text': {
        const clean = stripFormatting(p.text);
        const underline = p.underline || isUnderlined(p.text);
        const w = clean.length * p.h * 0.62;
        const left =
          p.anchor === 'middle' ? p.x - w / 2 : p.anchor === 'end' ? p.x - w : p.x;
        return (
          <g key={i}>
            <text
              x={p.x}
              y={Y(p.y)}
              fill={color}
              fontSize={p.h}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
              fontWeight={p.bold ? 700 : 400}
              textAnchor={p.anchor === 'middle' ? 'middle' : p.anchor === 'end' ? 'end' : 'start'}
              style={{ whiteSpace: 'pre' }}
            >
              {clean}
            </text>
            {underline && (
              <line
                x1={left}
                y1={Y(p.y) + p.h * 0.24}
                x2={left + w}
                y2={Y(p.y) + p.h * 0.24}
                stroke={color}
                strokeWidth={hair * 0.9}
              />
            )}
          </g>
        );
      }

      case 'image':
        return (
          <image
            key={i}
            x={p.x}
            y={Y(p.y + p.h)}
            width={p.w}
            height={p.h}
            href={p.href}
            preserveAspectRatio="xMidYMid meet"
          />
        );

      default:
        return null;
    }
  };

  return (
    <svg
      width={Math.round(renderWidth)}
      height={height}
      viewBox={`${bounds.minX} 0 ${spanX} ${spanY}`}
      className="select-none"
      style={{ background: bg, display: 'block' }}
    >
      <g>
        {sheet.primitives.map(renderPrimitive)}
      </g>

      {/* Sheet identity caption drawn in-sheet, like the source drawing's label notes */}
      <text
        x={bounds.minX + spanX * 0.012}
        y={spanY * 0.012}
        fill={titleColor}
        fontSize={Math.max(spanX, spanY) * 0.012}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        fontWeight={700}
      >
        {`${sheet.sheetNumber} — ${sheet.title}${sheet.levelName ? ` (${sheet.levelName})` : ''}`}
      </text>
    </svg>
  );
};

export default DrawingSheetSvg;
