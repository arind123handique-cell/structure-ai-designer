import React from 'react';
import { ProjectPileType } from './pileDesignEngine';

interface PileDrawingSvgProps {
  pile: ProjectPileType;
  width?: number;
  height?: number;
}

export const PileDrawingSvg: React.FC<PileDrawingSvgProps> = ({ pile, width = 600, height = 360 }) => {
  const dia = pile.diameter;
  const len = pile.length;
  const rebar = pile.rebarCallout;
  const spiral = pile.spiralCallout;

  return (
    <div className="flex flex-col items-center bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-inner overflow-x-auto font-mono">
      <div className="flex items-center justify-between w-full mb-2 px-2 text-xs text-slate-400">
        <span className="font-bold text-sky-400">
          STANDARD PROJECT PILE {pile.id} (DIA {dia}mm × {len}m) — IS 2911:2010
        </span>
        <span>All Dimensions in mm</span>
      </div>

      <svg width={width} height={height} viewBox="0 0 600 360" className="select-none text-xs">
        <g transform="translate(220, 25)">
          {/* Pile Cap Interface Boundary at Top */}
          <rect x="-50" y="0" width="240" height="40" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3,3" />
          <text x="70" y="25" fill="#94a3b8" fontSize="10" textAnchor="middle">
            PILE CAP EMBEDMENT ZONE (75mm)
          </text>

          {/* Pile Shaft Body */}
          <rect x="20" y="40" width="100" height="230" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" rx="2" />

          {/* Conical Toe at Bottom */}
          <polygon points="20,270 120,270 70,295" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />

          {/* Longitudinal Rebars (Vertical orange lines) */}
          <line x1="32" y1="12" x2="32" y2="265" stroke="#f97316" strokeWidth="3" />
          <line x1="108" y1="12" x2="108" y2="265" stroke="#f97316" strokeWidth="3" />
          <line x1="70" y1="12" x2="70" y2="265" stroke="#f97316" strokeWidth="2" strokeDasharray="4,4" />

          {/* Top Dowel hooks into Pile Cap */}
          <line x1="32" y1="12" x2="15" y2="12" stroke="#f97316" strokeWidth="3" />
          <line x1="108" y1="12" x2="125" y2="12" stroke="#f97316" strokeWidth="3" />

          {/* Helical Spiral Rings */}
          {[55, 75, 95, 115, 140, 170, 200, 230, 255].map((y, i) => (
            <line key={i} x1="22" y1={y} x2="118" y2={y} stroke="#34d399" strokeWidth="1.5" strokeDasharray="2,2" />
          ))}

          {/* Dimension Lines */}
          <line x1="20" y1="315" x2="120" y2="315" stroke="#64748b" strokeWidth="1" />
          <line x1="20" y1="310" x2="20" y2="320" stroke="#64748b" strokeWidth="1" />
          <line x1="120" y1="310" x2="120" y2="320" stroke="#64748b" strokeWidth="1" />
          <text x="70" y="330" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
            Dia Dp = {dia} mm
          </text>

          <line x1="140" y1="40" x2="140" y2="295" stroke="#64748b" strokeWidth="1" />
          <line x1="135" y1="40" x2="145" y2="40" stroke="#64748b" strokeWidth="1" />
          <line x1="135" y1="295" x2="145" y2="295" stroke="#64748b" strokeWidth="1" />
          <text x="150" y="170" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="start">
            L = {len.toFixed(1)} m
          </text>

          {/* Left Text Callout Block */}
          <text x="-65" y="90" fill="#fb923c" fontSize="10.5" fontWeight="bold" textAnchor="end">
            MAIN STEEL: {rebar.split(' (')[0]}
          </text>
          <text x="-65" y="115" fill="#34d399" fontSize="9.5" textAnchor="end">
            SPIRALS: {spiral.split(' (')[0]}
          </text>
          <text x="-65" y="145" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="end">
            SAFE AXIAL LOAD: {pile.safeWorkingLoad} kN
          </text>
          <text x="-65" y="165" fill="#94a3b8" fontSize="9" textAnchor="end">
            UPLIFT CAPACITY: {pile.upliftCapacity} kN
          </text>
          <text x="-65" y="185" fill="#94a3b8" fontSize="9" textAnchor="end">
            LATERAL CAPACITY: {pile.lateralCapacity} kN
          </text>
        </g>
      </svg>
    </div>
  );
};
