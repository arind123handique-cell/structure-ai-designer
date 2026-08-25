import React from 'react';
import { BarShapeType } from '@/features/calculations/bbsEngine';

interface BbsShapeSvgProps {
  shapeType: BarShapeType;
  a: number; // in mm or m
  b: number;
  c: number;
  unit: 'mm' | 'm';
  width?: number;
  height?: number;
}

export const BbsShapeSvg: React.FC<BbsShapeSvgProps> = ({
  shapeType,
  a,
  b,
  c,
  unit,
  width = 110,
  height = 54,
}) => {
  const formatDim = (val: number) => {
    if (val === 0) return '0';
    if (unit === 'm') {
      return (val / 1000).toFixed(3);
    }
    return Math.round(val).toString();
  };

  const strokeColor = '#0f172a'; // slate-900 for high-contrast CAD look

  return (
    <svg width={width} height={height} viewBox="0 0 110 54" className="select-none font-mono">
      {shapeType === 'STRAIGHT' && (
        <g>
          {/* Straight horizontal bar */}
          <line x1="15" y1="26" x2="95" y2="26" stroke={strokeColor} strokeWidth="2.4" strokeLinecap="round" />
          <text x="55" y="42" fill="#2563eb" fontSize="8.5" fontWeight="bold" textAnchor="middle">
            b
          </text>
        </g>
      )}

      {shapeType === 'U_BAR' && (
        <g>
          {/* U-Shape bar with 90 deg hooks */}
          <path
            d="M 18 12 L 18 36 L 92 36 L 92 12"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Dimension text a and b */}
          <text x="10" y="24" fill="#2563eb" fontSize="8" fontWeight="bold" textAnchor="middle">
            a
          </text>
          <text x="55" y="48" fill="#2563eb" fontSize="8.5" fontWeight="bold" textAnchor="middle">
            b
          </text>
          <text x="100" y="24" fill="#2563eb" fontSize="8" fontWeight="bold" textAnchor="middle">
            a
          </text>
        </g>
      )}

      {shapeType === 'L_BAR' && (
        <g>
          {/* L-Shape bar with 90 deg bend */}
          <path
            d="M 22 10 L 22 38 L 92 38"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="12" y="24" fill="#2563eb" fontSize="8" fontWeight="bold" textAnchor="middle">
            a
          </text>
          <text x="57" y="48" fill="#2563eb" fontSize="8.5" fontWeight="bold" textAnchor="middle">
            b
          </text>
        </g>
      )}

      {shapeType === 'RECT_TIE' && (
        <g>
          {/* Closed rectangular stirrup / tie with 135 deg seismic hook */}
          <rect x="25" y="10" width="45" height="34" rx="4" fill="none" stroke={strokeColor} strokeWidth="2.2" />
          {/* 135 deg seismic hook ears */}
          <path d="M 68 12 L 76 6 L 68 6" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 64 10 L 72 4" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          {/* Dimension a (bottom width) and c (height) */}
          <text x="47" y="52" fill="#2563eb" fontSize="8" fontWeight="bold" textAnchor="middle">
            a
          </text>
          <text x="82" y="30" fill="#2563eb" fontSize="8" fontWeight="bold" textAnchor="start">
            c
          </text>
        </g>
      )}

      {shapeType === 'DIAMOND_TIE' && (
        <g>
          {/* Diamond internal tie */}
          <polygon points="48,8 74,27 48,46 22,27" fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinejoin="round" />
          {/* Hooks */}
          <path d="M 46 8 L 48 2 L 54 4" fill="none" stroke={strokeColor} strokeWidth="1.8" />
          <text x="48" y="29" fill="#2563eb" fontSize="7.5" fontWeight="bold" textAnchor="middle">
            a×c
          </text>
        </g>
      )}

      {shapeType === 'PENTAGON_TIE' && (
        <g>
          {/* 5-sided pentagon tie */}
          <polygon points="50,8 78,18 68,46 32,46 22,18" fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M 50 8 L 52 2 L 58 4" fill="none" stroke={strokeColor} strokeWidth="1.8" />
          <text x="50" y="32" fill="#2563eb" fontSize="7.5" fontWeight="bold" textAnchor="middle">
            5-Ties
          </text>
        </g>
      )}

      {shapeType === 'CRANKED' && (
        <g>
          <path
            d="M 12 36 L 36 36 L 48 16 L 68 16 L 80 36 L 98 36"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x="55" y="11" fill="#2563eb" fontSize="8" fontWeight="bold" textAnchor="middle">
            b
          </text>
        </g>
      )}
    </svg>
  );
};
