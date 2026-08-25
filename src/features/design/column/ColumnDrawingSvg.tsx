import React, { useState } from 'react';
import { ColumnDesignOutput } from './columnDesignEngine';
import { Layers, Compass, Eye } from 'lucide-react';

interface ColumnDrawingSvgProps {
  column: ColumnDesignOutput;
  width?: number;
  height?: number;
}

export const ColumnDrawingSvg: React.FC<ColumnDrawingSvgProps> = ({ column, width = 860, height = 480 }) => {
  const [activeTab, setActiveTab] = useState<'COMBINED' | 'LONGITUDINAL' | 'CROSS_SECTION'>('COMBINED');

  const b = parseFloat(column.dimensions.split('×')[0]) || 450;
  const D = parseFloat(column.dimensions.split('×')[1]) || 550;
  const H = column.height || 3.5;

  const rebar = column.rebar;
  const pt = rebar.pt_prov;
  const ductility = column.ductility;
  const lo = ductility.lo;
  const s_confine = ductility.confiningTieSpacingMax;
  const s_mid = ductility.midHeightTieSpacingMax;

  // Face bars layout
  const nX = rebar.faceBars?.countX || 0; // along D
  const nY = rebar.faceBars?.countY || 0; // along b

  return (
    <div className="flex flex-col items-center bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-inner overflow-x-auto font-mono select-none">
      {/* Header with View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between w-full mb-3 px-2 text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-emerald-400">
            COLUMN C-{column.memberId} ({b}×{D} mm) — IS 13920:2016 DUCTILE DETAILING
          </span>
          <span className="px-2 py-0.5 bg-slate-800 text-emerald-300 rounded text-[10px] border border-slate-700">
            {rebar.callout} (pt = {pt}%)
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800 text-[11px]">
          <button
            onClick={() => setActiveTab('COMBINED')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'COMBINED' ? 'bg-emerald-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Combined View
          </button>
          <button
            onClick={() => setActiveTab('LONGITUDINAL')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'LONGITUDINAL' ? 'bg-emerald-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Longitudinal Elevation (IS 13920)
          </button>
          <button
            onClick={() => setActiveTab('CROSS_SECTION')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'CROSS_SECTION' ? 'bg-emerald-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cross-Section Plan
          </button>
        </div>
      </div>

      <svg width={width} height={height} viewBox="0 0 860 480" className="select-none">
        <defs>
          <pattern id="colHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#1e293b" strokeWidth="1.5" />
          </pattern>
        </defs>

        {/* ---------------- 1. IS 13920 LONGITUDINAL ELEVATION (LEFT) ---------------- */}
        {(activeTab === 'COMBINED' || activeTab === 'LONGITUDINAL') && (
          <g transform={activeTab === 'COMBINED' ? 'translate(30, 20)' : 'translate(220, 20)'}>
            {/* Top Beam Profile */}
            <rect x="0" y="20" width="340" height="45" fill="url(#colHatch)" stroke="#475569" strokeWidth="1.5" />
            <text x="50" y="47" fill="#64748b" fontSize="9">Top Beam Floor Level</text>
            <text x="240" y="47" fill="#64748b" fontSize="9">Depth = 450mm</text>

            {/* Bottom Foundation / Slab Profile */}
            <rect x="0" y="395" width="340" height="45" fill="url(#colHatch)" stroke="#475569" strokeWidth="1.5" />
            <text x="50" y="422" fill="#64748b" fontSize="9">Bottom Support / Plinth</text>

            {/* Column Concrete Core */}
            <rect x="110" y="20" width="120" height="420" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />

            {/* Longitudinal Rebar Lines (4 Corner + Face Bars) */}
            {/* Left Corner Bars */}
            <line x1="125" y1="5" x2="125" y2="455" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
            {/* Right Corner Bars */}
            <line x1="215" y1="5" x2="215" y2="455" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />

            {/* Intermediate Face Bars */}
            {rebar.faceBars && rebar.faceBars.count > 0 && (
              <>
                <line x1="155" y1="5" x2="155" y2="455" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6,2" />
                <line x1="185" y1="5" x2="185" y2="455" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6,2" />
              </>
            )}

            {/* --- ZONE 1: TOP SPECIAL CONFINING ZONE (lo) --- */}
            <rect x="110" y="65" width="120" height="85" fill="#10b981" fillOpacity="0.08" stroke="#10b981" strokeDasharray="3,3" />
            {[72, 84, 96, 108, 120, 132, 144].map((y, i) => (
              <line key={`tie_top_${i}`} x1="120" y1={y} x2="220" y2={y} stroke="#34d399" strokeWidth="1.8" />
            ))}
            {/* Joint Core Ties (through beam joint) */}
            {[30, 42, 54].map((y, i) => (
              <line key={`tie_jt_${i}`} x1="120" y1={y} x2="220" y2={y} stroke="#34d399" strokeWidth="1.2" strokeDasharray="2,2" />
            ))}

            {/* --- ZONE 2: CENTRAL LAP SPLICE & MIDDLE ZONE --- */}
            {/* Middle Standard Ties */}
            {[170, 195, 220, 245, 270, 295].map((y, i) => (
              <line key={`tie_mid_${i}`} x1="120" y1={y} x2="220" y2={y} stroke="#a7f3d0" strokeWidth="1.2" />
            ))}

            {/* Lap Splice Visual Indicator (Central Half) */}
            <g transform="translate(160, 205)">
              <rect x="-15" y="0" width="30" height="60" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1" rx="2" />
              <line x1="-5" y1="0" x2="-5" y2="60" stroke="#f59e0b" strokeWidth="2.5" />
              <line x1="5" y1="0" x2="5" y2="60" stroke="#f59e0b" strokeWidth="2.5" />
              <text x="0" y="72" fill="#fbbf24" fontSize="8" fontWeight="bold" textAnchor="middle">
                LAP SPLICE (45 db)
              </text>
            </g>

            {/* --- ZONE 3: BOTTOM SPECIAL CONFINING ZONE (lo) --- */}
            <rect x="110" y="310" width="120" height="85" fill="#10b981" fillOpacity="0.08" stroke="#10b981" strokeDasharray="3,3" />
            {[318, 330, 342, 354, 366, 378, 390].map((y, i) => (
              <line key={`tie_bot_${i}`} x1="120" y1={y} x2="220" y2={y} stroke="#34d399" strokeWidth="1.8" />
            ))}

            {/* Annotations & Dimension Callouts */}
            {/* Top Confining Zone Label */}
            <line x1="235" y1="65" x2="235" y2="150" stroke="#34d399" strokeWidth="1.5" />
            <text x="245" y="105" fill="#34d399" fontSize="9" fontWeight="bold">
              lo = {lo}mm (@ {s_confine}mm c/c)
            </text>

            {/* Mid Zone Label */}
            <line x1="235" y1="150" x2="235" y2="310" stroke="#a7f3d0" strokeWidth="1" />
            <text x="245" y="235" fill="#a7f3d0" fontSize="8.5">
              Mid Zone Ties @ {s_mid}mm c/c
            </text>

            {/* Bottom Confining Zone Label */}
            <line x1="235" y1="310" x2="235" y2="395" stroke="#34d399" strokeWidth="1.5" />
            <text x="245" y="355" fill="#34d399" fontSize="9" fontWeight="bold">
              lo = {lo}mm (@ {s_confine}mm c/c)
            </text>

            {/* Total Column Height */}
            <line x1="90" y1="65" x2="90" y2="395" stroke="#94a3b8" strokeWidth="1" />
            <line x1="85" y1="65" x2="95" y2="65" stroke="#94a3b8" strokeWidth="1" />
            <line x1="85" y1="395" x2="95" y2="395" stroke="#94a3b8" strokeWidth="1" />
            <text x="80" y="235" fill="#94a3b8" fontSize="9" textAnchor="end">
              H_clear = {H.toFixed(2)}m
            </text>

            <text x="170" y="465" fill="#e2e8f0" fontSize="10.5" fontWeight="bold" textAnchor="middle">
              IS 13920:2016 LONGITUDINAL ELEVATION & CONFINEMENT
            </text>
          </g>
        )}

        {/* ---------------- 2. CROSS-SECTION PLAN & REBAR ARRANGEMENT (RIGHT) ---------------- */}
        {(activeTab === 'COMBINED' || activeTab === 'CROSS_SECTION') && (
          <g transform={activeTab === 'COMBINED' ? 'translate(490, 40)' : 'translate(260, 40)'}>
            {/* Concrete Column Outline */}
            <rect x="20" y="20" width="220" height="270" fill="#0f172a" stroke="#94a3b8" strokeWidth="2.5" rx="6" />

            {/* Outer Closed Hoop with 135 deg Hooks */}
            <rect x="40" y="40" width="180" height="230" fill="none" stroke="#34d399" strokeWidth="2.5" rx="4" />

            {/* Inner Cross Ties / Diamond Link (for 8, 12, 16 bars) */}
            {rebar.totalBars >= 8 && (
              <polygon
                points="130,40 220,155 130,270 40,155"
                fill="none"
                stroke="#10b981"
                strokeWidth="1.8"
                strokeDasharray="4,2"
              />
            )}

            {/* Additional Rectilinear Cross Links if 12 or 16 bars */}
            {rebar.totalBars >= 12 && (
              <>
                <line x1="85" y1="40" x2="85" y2="270" stroke="#10b981" strokeWidth="1.2" strokeDasharray="3,3" />
                <line x1="175" y1="40" x2="175" y2="270" stroke="#10b981" strokeWidth="1.2" strokeDasharray="3,3" />
                <line x1="40" y1="117" x2="220" y2="117" stroke="#10b981" strokeWidth="1.2" strokeDasharray="3,3" />
                <line x1="40" y1="193" x2="220" y2="193" stroke="#10b981" strokeWidth="1.2" strokeDasharray="3,3" />
              </>
            )}

            {/* 4 Corner Bars (Large Diameter - Orange) */}
            <circle cx="50" cy="50" r="9" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="210" cy="50" r="9" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="50" cy="260" r="9" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="210" cy="260" r="9" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />

            {/* Intermediate Face Bars on D (Left and Right Faces) */}
            {nX >= 1 && (
              <>
                <circle cx="50" cy="155" r="7.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="210" cy="155" r="7.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
              </>
            )}
            {nX >= 2 && (
              <>
                <circle cx="50" cy="102" r="7.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="50" cy="208" r="7.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="210" cy="102" r="7.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="210" cy="208" r="7.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
              </>
            )}
            {nX >= 4 && (
              <>
                <circle cx="50" cy="80" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <circle cx="50" cy="130" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <circle cx="50" cy="180" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <circle cx="50" cy="230" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <circle cx="210" cy="80" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <circle cx="210" cy="130" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <circle cx="210" cy="180" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <circle cx="210" cy="230" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
              </>
            )}

            {/* Intermediate Face Bars on b (Top and Bottom Faces) */}
            {nY >= 1 && (
              <>
                <circle cx="130" cy="50" r="7.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
                <circle cx="130" cy="260" r="7.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.2" />
              </>
            )}
            {nY >= 2 && (
              <>
                <circle cx="90" cy="50" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <circle cx="170" cy="50" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <circle cx="90" cy="260" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                <circle cx="170" cy="260" r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
              </>
            )}

            {/* Dimension Lines */}
            <line x1="20" y1="5" x2="240" y2="5" stroke="#64748b" strokeWidth="1" />
            <line x1="20" y1="0" x2="20" y2="10" stroke="#64748b" strokeWidth="1" />
            <line x1="240" y1="0" x2="240" y2="10" stroke="#64748b" strokeWidth="1" />
            <text x="130" y="-2" fill="#94a3b8" fontSize="10" textAnchor="middle">
              b = {b} mm
            </text>

            <line x1="265" y1="20" x2="265" y2="290" stroke="#64748b" strokeWidth="1" />
            <line x1="260" y1="20" x2="270" y2="20" stroke="#64748b" strokeWidth="1" />
            <line x1="260" y1="290" x2="270" y2="290" stroke="#64748b" strokeWidth="1" />
            <text x="278" y="160" fill="#94a3b8" fontSize="10" textAnchor="start">
              D = {D} mm
            </text>

            {/* Spacing Callout */}
            <text x="130" y="315" fill="#f97316" fontSize="10" fontWeight="bold" textAnchor="middle">
              CORNER: {rebar.cornerBars.callout} (4 Corner Bars)
            </text>
            {rebar.faceBars && (
              <text x="130" y="332" fill="#38bdf8" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                FACES: {rebar.faceBars.callout} (sx = {rebar.spacingX}mm, sy = {rebar.spacingY}mm)
              </text>
            )}
            <text x="130" y="350" fill="#34d399" fontSize="9" textAnchor="middle">
              {ductility.recommendedTieCallout}
            </text>

            <text x="130" y="380" fill="#e2e8f0" fontSize="10.5" fontWeight="bold" textAnchor="middle">
              CROSS-SECTION PLAN (CONFINEMENT CORE)
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
