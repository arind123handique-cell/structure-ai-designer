import React from 'react';
import { GradeBeamDesignOutput } from './gradeBeamEngine';

interface GradeBeamDrawingSvgProps {
  gradeBeam: GradeBeamDesignOutput;
  width?: number;
  height?: number;
}

export const GradeBeamDrawingSvg: React.FC<GradeBeamDrawingSvgProps> = ({
  gradeBeam,
  width = 820,
  height = 420,
}) => {
  const gb = gradeBeam;

  return (
    <div className="flex flex-col items-center bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-inner overflow-x-auto font-mono select-none">
      <div className="flex items-center justify-between w-full mb-2 px-2 text-xs text-slate-400">
        <span className="font-bold text-sky-400">
          IS 13920:2016 GRADE BEAM {gb.gradeBeamId} (CONNECTING {gb.startPileCapLabel} & {gb.endPileCapLabel})
        </span>
        <span className="text-slate-500">Span L = {gb.spanLength} m • All Dimensions in mm</span>
      </div>

      <svg width={width} height={height} viewBox="0 0 820 420" className="text-xs">
        {/* Background Grid */}
        <defs>
          <pattern id="soilHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#334155" strokeWidth="0.8" strokeOpacity="0.6" />
          </pattern>
        </defs>

        {/* ---------------- 1. LONGITUDINAL ELEVATION (TOP HALF) ---------------- */}
        <g transform="translate(40, 30)">
          {/* Ground Soil Hatch under Grade Beam */}
          <rect x="0" y="160" width="540" height="40" fill="url(#soilHatch)" />
          <line x1="0" y1="160" x2="540" y2="160" stroke="#64748b" strokeWidth="1" strokeDasharray="4,4" />
          <text x="270" y="185" fill="#64748b" fontSize="9" textAnchor="middle">
            COMPACTED SOIL / GL (-0.60 m)
          </text>

          {/* Left Pile Cap */}
          <rect x="0" y="30" width="90" height="150" fill="#0f172a" stroke="#818cf8" strokeWidth="2" rx="4" />
          <text x="45" y="110" fill="#a5b4fc" fontSize="10" fontWeight="bold" textAnchor="middle">
            {gb.startPileCapLabel}
          </text>
          <text x="45" y="125" fill="#64748b" fontSize="8" textAnchor="middle">
            ({gb.startColumnLabel})
          </text>

          {/* Right Pile Cap */}
          <rect x="450" y="30" width="90" height="150" fill="#0f172a" stroke="#818cf8" strokeWidth="2" rx="4" />
          <text x="495" y="110" fill="#a5b4fc" fontSize="10" fontWeight="bold" textAnchor="middle">
            {gb.endPileCapLabel}
          </text>
          <text x="495" y="125" fill="#64748b" fontSize="8" textAnchor="middle">
            ({gb.endColumnLabel})
          </text>

          {/* Grade Beam Concrete Elevation */}
          <rect x="90" y="50" width="360" height="90" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" />

          {/* Top Continuous Steel (Red) */}
          <line x1="20" y1="65" x2="520" y2="65" stroke="#ef4444" strokeWidth="2.5" />
          {/* Top Bar Anchor Hooks in Pile Caps */}
          <line x1="20" y1="65" x2="20" y2="120" stroke="#ef4444" strokeWidth="2.5" />
          <line x1="520" y1="65" x2="520" y2="120" stroke="#ef4444" strokeWidth="2.5" />

          {/* Bottom Continuous Steel (Orange) */}
          <line x1="20" y1="125" x2="520" y2="125" stroke="#f97316" strokeWidth="2.5" />
          {/* Bottom Bar Anchor Hooks in Pile Caps */}
          <line x1="20" y1="125" x2="20" y2="85" stroke="#f97316" strokeWidth="2.5" />
          <line x1="520" y1="125" x2="520" y2="85" stroke="#f97316" strokeWidth="2.5" />

          {/* Confinement Stirrup Lines */}
          {/* Left End Confinement Zone (2D length) */}
          {[100, 115, 130, 145, 160, 175].map((x, i) => (
            <line key={`lh_${i}`} x1={x} y1="55" x2={x} y2="135" stroke="#10b981" strokeWidth="1.5" />
          ))}
          {/* Middle Zone */}
          {[205, 235, 265, 295, 325].map((x, i) => (
            <line key={`mh_${i}`} x1={x} y1="55" x2={x} y2="135" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.8" />
          ))}
          {/* Right End Confinement Zone (2D length) */}
          {[365, 380, 395, 410, 425, 440].map((x, i) => (
            <line key={`rh_${i}`} x1={x} y1="55" x2={x} y2="135" stroke="#10b981" strokeWidth="1.5" />
          ))}

          {/* Dimension Lines */}
          <line x1="90" y1="210" x2="450" y2="210" stroke="#94a3b8" strokeWidth="1" />
          <line x1="90" y1="205" x2="90" y2="215" stroke="#94a3b8" strokeWidth="1" />
          <line x1="450" y1="205" x2="450" y2="215" stroke="#94a3b8" strokeWidth="1" />
          <text x="270" y="225" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">
            CLEAR SPAN L = {gb.spanLength} m ({gb.b} × {gb.D} mm)
          </text>

          {/* Callouts */}
          <text x="270" y="42" fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle">
            TOP: {gb.topRebarCallout}
          </text>
          <text x="270" y="152" fill="#f97316" fontSize="10" fontWeight="bold" textAnchor="middle">
            BOT: {gb.bottomRebarCallout}
          </text>
          <text x="140" y="20" fill="#10b981" fontSize="9" textAnchor="middle">
            2D End Zone (@{gb.endZoneSpacing}c/c)
          </text>
          <text x="400" y="20" fill="#10b981" fontSize="9" textAnchor="middle">
            2D End Zone (@{gb.endZoneSpacing}c/c)
          </text>
        </g>

        {/* ---------------- 2. CROSS-SECTION VIEW (RIGHT) ---------------- */}
        <g transform="translate(620, 45)">
          <rect x="0" y="0" width="150" height="190" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" rx="4" />
          <text x="75" y="-12" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">
            SECTION X-X ({gb.b}×{gb.D})
          </text>

          {/* 2-Legged Confinement Stirrup Box */}
          <rect x="20" y="20" width="110" height="150" fill="none" stroke="#10b981" strokeWidth="2" rx="4" />

          {/* Corner Longitudinal Bars */}
          {/* Top 2 Corner Bars */}
          <circle cx="32" cy="32" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
          <circle cx="118" cy="32" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />

          {/* Bottom 2 Corner Bars */}
          <circle cx="32" cy="158" r="7" fill="#f97316" stroke="#ffffff" strokeWidth="1" />
          <circle cx="118" cy="158" r="7" fill="#f97316" stroke="#ffffff" strokeWidth="1" />

          {/* Side Dimension Callout */}
          <text x="75" y="100" fill="#94a3b8" fontSize="9" textAnchor="middle">
            2L-8mm Link
          </text>
          <text x="75" y="208" fill="#e2e8f0" fontSize="10" textAnchor="middle">
            b = {gb.b} mm
          </text>
          <text x="165" y="100" fill="#e2e8f0" fontSize="10" textAnchor="start">
            D = {gb.D} mm
          </text>
        </g>

        {/* ---------------- 3. BOTTOM ENGINEERING TITLE BLOCK ---------------- */}
        <g transform="translate(40, 275)">
          <rect x="0" y="0" width="740" height="105" fill="#0f172a" stroke="#334155" strokeWidth="1.5" rx="4" />

          {/* Column 1: Seismic Tie Demand */}
          <text x="20" y="24" fill="#38bdf8" fontSize="10" fontWeight="bold">
            1. IS 13920:2016 CL. 11.2 SEISMIC TIE DEMAND
          </text>
          <text x="20" y="44" fill="#cbd5e1" fontSize="10">
            • Max Connected Column Reactions: <tspan fill="#e2e8f0" fontWeight="bold">{Math.max(gb.factoredPu1, gb.factoredPu2).toFixed(1)} kN</tspan>
          </text>
          <text x="20" y="62" fill="#cbd5e1" fontSize="10">
            • Factored Axial Tie Force (P_tie ≥ 10% Pu): <tspan fill="#38bdf8" fontWeight="bold">{gb.factoredTensionTiePu} kN</tspan>
          </text>
          <text x="20" y="80" fill="#cbd5e1" fontSize="10">
            • Governing Design Bending Moment: <tspan fill="#e2e8f0" fontWeight="bold">Mu = {gb.factoredDesignMomentMu} kNm</tspan>
          </text>

          {/* Column 2: Steel & Detailing Summary */}
          <text x="390" y="24" fill="#10b981" fontSize="10" fontWeight="bold">
            2. REINFORCEMENT & CONFINEMENT DETAILING
          </text>
          <text x="390" y="44" fill="#cbd5e1" fontSize="10">
            • Top Reinforcement: <tspan fill="#ef4444" fontWeight="bold">{gb.topRebarCallout}</tspan>
          </text>
          <text x="390" y="62" fill="#cbd5e1" fontSize="10">
            • Bottom Reinforcement: <tspan fill="#f97316" fontWeight="bold">{gb.bottomRebarCallout}</tspan>
          </text>
          <text x="390" y="80" fill="#cbd5e1" fontSize="10">
            • Seismic Ties: <tspan fill="#10b981" fontWeight="bold">{gb.stirrupCallout}</tspan>
          </text>
        </g>
      </svg>
    </div>
  );
};
