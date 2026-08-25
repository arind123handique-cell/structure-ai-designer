import React from 'react';
import { FootingDesignOutput } from './footingDesignEngine';

interface FootingDrawingSvgProps {
  footing: FootingDesignOutput;
  width?: number;
  height?: number;
}

export const FootingDrawingSvg: React.FC<FootingDrawingSvgProps> = ({ footing, width = 720, height = 340 }) => {
  const L = footing.length;
  const B = footing.width;
  const D = footing.thickness;
  const qmax = footing.soilPressure.q_max;
  const qmin = footing.soilPressure.q_min;

  return (
    <div className="flex flex-col items-center bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-inner overflow-x-auto font-mono">
      <div className="flex items-center justify-between w-full mb-2 px-2 text-xs text-slate-400">
        <span className="font-bold text-amber-400">
          ISOLATED PAD FOOTING F-{footing.supportNodeId} — IS 456:2000
        </span>
        <span>All Dimensions in mm / m</span>
      </div>

      <svg width={width} height={height} viewBox="0 0 720 340" className="select-none text-xs">
        {/* ----------------- 1. PLAN VIEW (LEFT) ----------------- */}
        <g transform="translate(40, 40)">
          {/* Footing Concrete Boundary */}
          <rect x="0" y="0" width="250" height="230" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.5" rx="6" />

          {/* Rebar Mesh in Plan */}
          {[35, 75, 115, 155, 195, 225].map((x, i) => (
            <line key={`fx_${i}`} x1={x} y1="15" x2={x} y2="215" stroke="#f97316" strokeWidth="1.2" strokeOpacity="0.8" />
          ))}
          {[35, 75, 115, 155, 195].map((y, i) => (
            <line key={`fy_${i}`} x1="15" y1={y} x2="235" y2={y} stroke="#f97316" strokeWidth="1.2" strokeOpacity="0.8" />
          ))}

          {/* Column Pedestal */}
          <rect x="100" y="90" width="50" height="50" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
          <text x="125" y="120" fill="#38bdf8" fontSize="9" textAnchor="middle">
            COL
          </text>

          {/* Dimensions */}
          <text x="125" y="-10" fill="#94a3b8" fontSize="10" textAnchor="middle">
            L = {L.toFixed(2)} m ({Math.round(L * 1000)} mm)
          </text>
          <text x="265" y="115" fill="#94a3b8" fontSize="10" textAnchor="start">
            B = {B.toFixed(2)} m
          </text>

          <text x="125" y="255" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
            PLAN VIEW (BOTTOM MESH)
          </text>
        </g>

        {/* ----------------- 2. SECTION ELEVATION & SOIL PRESSURE (RIGHT) ----------------- */}
        <g transform="translate(420, 45)">
          {/* Column Stub */}
          <rect x="100" y="0" width="60" height="55" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
          <line x1="110" y1="5" x2="110" y2="155" stroke="#38bdf8" strokeWidth="2.5" />
          <line x1="150" y1="5" x2="150" y2="155" stroke="#38bdf8" strokeWidth="2.5" />
          {/* Column Starter Bar Hooks */}
          <line x1="110" y1="155" x2="80" y2="155" stroke="#38bdf8" strokeWidth="2.5" />
          <line x1="150" y1="155" x2="180" y2="155" stroke="#38bdf8" strokeWidth="2.5" />

          {/* Footing Slab */}
          <rect x="15" y="55" width="230" height="110" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.5" rx="4" />

          {/* Bottom Rebar Mat */}
          <line x1="25" y1="150" x2="235" y2="150" stroke="#f97316" strokeWidth="3" />
          <line x1="25" y1="150" x2="25" y2="95" stroke="#f97316" strokeWidth="3" />
          <line x1="235" y1="150" x2="235" y2="95" stroke="#f97316" strokeWidth="3" />

          {/* Soil Pressure Diagram below Footing */}
          <polygon
            points="15,175 245,175 245,215 15,195"
            fill="#d97706"
            fillOpacity="0.25"
            stroke="#d97706"
            strokeWidth="1.5"
          />
          <text x="25" y="210" fill="#fbbf24" fontSize="9">
            q_min = {qmin} kN/m²
          </text>
          <text x="240" y="230" fill="#fbbf24" fontSize="9" textAnchor="end">
            q_max = {qmax} kN/m²
          </text>

          {/* Depth Dimension */}
          <line x1="5" y1="55" x2="5" y2="165" stroke="#64748b" strokeWidth="1" />
          <line x1="0" y1="55" x2="10" y2="55" stroke="#64748b" strokeWidth="1" />
          <line x1="0" y1="165" x2="10" y2="165" stroke="#64748b" strokeWidth="1" />
          <text x="-5" y="115" fill="#94a3b8" fontSize="10" textAnchor="end">
            D = {D} mm
          </text>

          {/* Rebar Annotation */}
          <text x="130" y="255" fill="#fb923c" fontSize="10" fontWeight="bold" textAnchor="middle">
            REBAR: {footing.rebarCalloutX.split(' (')[0]} BOTH WAYS
          </text>
        </g>
      </svg>
    </div>
  );
};
