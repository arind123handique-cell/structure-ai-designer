import React from 'react';
import { BeamDesignOutput } from './beamDesignEngine';

interface BeamDrawingSvgProps {
  beam: BeamDesignOutput;
  width?: number;
  height?: number;
}

export const BeamDrawingSvg: React.FC<BeamDrawingSvgProps> = ({ beam, width = 840, height = 360 }) => {
  const b = parseFloat(beam.dimensions.split('×')[0]) || 300;
  const D = parseFloat(beam.dimensions.split('×')[1]) || 450;
  const span = beam.spanLength || 4.0;

  const curtailment = beam.curtailment;
  const shearCallout = beam.shear.callout;
  const ld = beam.developmentLength;
  const confineLen = beam.ductility.confinementZoneLength;

  const hasTopExtra = curtailment.extraTopSupport.hasExtra;
  const hasBotExtra = curtailment.extraBottomMidspan.hasExtra;
  const hasSideFace = !!curtailment.sideFaceBars;

  return (
    <div className="flex flex-col items-center bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-inner overflow-x-auto">
      <div className="flex items-center justify-between w-full mb-2 px-2 text-xs font-mono text-slate-400">
        <span className="font-bold text-sky-400">
          BEAM B-{beam.memberId} ({b}×{D} mm) — REINFORCEMENT & EXTRA BARS DETAILING (IS 456 & IS 13920)
        </span>
        <span>Scale: N.T.S. • All Dimensions in mm</span>
      </div>

      <svg width={width} height={height} viewBox="0 0 840 360" className="select-none font-mono">
        <defs>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#1e293b" strokeWidth="1.5" />
          </pattern>
        </defs>

        {/* ----------------- 1. LONGITUDINAL ELEVATION (LEFT) ----------------- */}
        <g transform="translate(30, 40)">
          {/* Support Columns on left and right */}
          <rect x="0" y="0" width="40" height="200" fill="url(#hatch)" stroke="#475569" strokeWidth="1.5" />
          <rect x="440" y="0" width="40" height="200" fill="url(#hatch)" stroke="#475569" strokeWidth="1.5" />

          {/* Beam Concrete Outline */}
          <rect x="40" y="25" width="400" height="120" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />

          {/* 1. Continuous Top Through Bars (Orange) */}
          <line x1="15" y1="40" x2="465" y2="40" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
          <line x1="15" y1="40" x2="15" y2="105" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
          <line x1="465" y1="40" x2="465" y2="105" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />

          {/* 2. Extra Top Support Bars (Red - Left & Right @ L/3) */}
          {hasTopExtra && (
            <>
              {/* Left Support Extra Top */}
              <line x1="15" y1="48" x2="160" y2="48" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
              <line x1="15" y1="48" x2="15" y2="95" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
              <line x1="160" y1="45" x2="160" y2="52" stroke="#ef4444" strokeWidth="2" />

              {/* Right Support Extra Top */}
              <line x1="320" y1="48" x2="465" y2="48" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
              <line x1="465" y1="48" x2="465" y2="95" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
              <line x1="320" y1="45" x2="320" y2="52" stroke="#ef4444" strokeWidth="2" />

              <text x="95" y="60" fill="#fca5a5" fontSize="8" fontWeight="bold">
                Extra Top: {curtailment.extraTopSupport.callout} (L/3 = {curtailment.extraTopSupport.cutoffLength}m)
              </text>
              <text x="325" y="60" fill="#fca5a5" fontSize="8" fontWeight="bold">
                Extra Top: {curtailment.extraTopSupport.callout}
              </text>
            </>
          )}

          {/* 3. Continuous Bottom Through Bars (Cyan/Sky) */}
          <line x1="15" y1="130" x2="465" y2="130" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
          <line x1="15" y1="130" x2="15" y2="75" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
          <line x1="465" y1="130" x2="465" y2="75" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />

          {/* 4. Extra Bottom Midspan Bars (Emerald/Green @ 0.75L) */}
          {hasBotExtra && (
            <>
              <line x1="90" y1="122" x2="390" y2="122" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
              <line x1="90" y1="118" x2="90" y2="126" stroke="#10b981" strokeWidth="2" />
              <line x1="390" y1="118" x2="390" y2="126" stroke="#10b981" strokeWidth="2" />
              <text x="240" y="117" fill="#6ee7b7" fontSize="8" fontWeight="bold" textAnchor="middle">
                Extra Bot: {curtailment.extraBottomMidspan.callout} (Midspan {curtailment.extraBottomMidspan.length}m)
              </text>
            </>
          )}

          {/* 5. Side Face Reinforcement (if D > 750 mm) */}
          {hasSideFace && (
            <>
              <line x1="25" y1="85" x2="455" y2="85" stroke="#eab308" strokeWidth="2" strokeDasharray="4,2" />
              <text x="240" y="80" fill="#fde047" fontSize="8" textAnchor="middle">
                Side Face: {curtailment.sideFaceBars?.callout}
              </text>
            </>
          )}

          {/* Stirrups (Confinement zone left) */}
          {[50, 65, 80, 95, 110, 125].map((x, i) => (
            <line key={`st_l_${i}`} x1={x} y1="35" x2={x} y2="135" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="2,2" />
          ))}

          {/* Stirrups (Mid-span zone) */}
          {[155, 185, 215, 245, 275, 305, 335].map((x, i) => (
            <line key={`st_m_${i}`} x1={x} y1="35" x2={x} y2="135" stroke="#a855f7" strokeWidth="1.2" strokeDasharray="3,3" />
          ))}

          {/* Stirrups (Confinement zone right) */}
          {[355, 370, 385, 400, 415, 430].map((x, i) => (
            <line key={`st_r_${i}`} x1={x} y1="35" x2={x} y2="135" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="2,2" />
          ))}

          {/* Span Dimension */}
          <line x1="40" y1="165" x2="440" y2="165" stroke="#64748b" strokeWidth="1" />
          <line x1="40" y1="160" x2="40" y2="170" stroke="#64748b" strokeWidth="1" />
          <line x1="440" y1="160" x2="440" y2="170" stroke="#64748b" strokeWidth="1" />
          <text x="240" y="180" fill="#94a3b8" fontSize="10" textAnchor="middle">
            Clear Span L = {span.toFixed(2)} m ({Math.round(span * 1000)} mm)
          </text>

          {/* 2d Confinement Zone Annotation */}
          <line x1="40" y1="15" x2="140" y2="15" stroke="#c084fc" strokeWidth="1.5" />
          <text x="90" y="10" fill="#c084fc" fontSize="9" textAnchor="middle">
            2d = {confineLen}mm
          </text>

          <line x1="340" y1="15" x2="440" y2="15" stroke="#c084fc" strokeWidth="1.5" />
          <text x="390" y="10" fill="#c084fc" fontSize="9" textAnchor="middle">
            2d = {confineLen}mm
          </text>

          {/* Text Labels */}
          <text x="240" y="32" fill="#fb923c" fontSize="9" fontWeight="bold" textAnchor="middle">
            TOP THRU: {curtailment.throughTop.callout}
          </text>
          <text x="240" y="148" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">
            BOT THRU: {curtailment.throughBottom.callout}
          </text>
          <text x="240" y="98" fill="#c084fc" fontSize="9" textAnchor="middle">
            STIRRUPS: {shearCallout}
          </text>

          <text x="240" y="215" fill="#e2e8f0" fontSize="11" fontWeight="bold" textAnchor="middle">
            LONGITUDINAL ELEVATION & CURTAILMENT
          </text>
        </g>

        {/* ----------------- 2. SECTION 1-1 AT SUPPORT (TOP RIGHT) ----------------- */}
        <g transform="translate(520, 35)">
          <rect x="15" y="15" width="85" height="135" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" rx="3" />
          <rect x="23" y="23" width="69" height="119" fill="none" stroke="#a855f7" strokeWidth="1.5" rx="2" />

          {/* Top Through Corner Bars */}
          <circle cx="28" cy="28" r="5" fill="#f97316" stroke="#ffffff" strokeWidth="1" />
          <circle cx="87" cy="28" r="5" fill="#f97316" stroke="#ffffff" strokeWidth="1" />
          {/* Top Extra Bars */}
          {hasTopExtra && (
            <circle cx="57.5" cy="28" r="5.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
          )}

          {/* Bottom Through Bars */}
          <circle cx="28" cy="137" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
          <circle cx="87" cy="137" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />

          <text x="57" y="8" fill="#94a3b8" fontSize="9" textAnchor="middle">
            b = {b}mm
          </text>
          <text x="108" y="85" fill="#94a3b8" fontSize="9">
            D = {D}mm
          </text>

          <text x="57" y="165" fill="#e2e8f0" fontSize="9.5" fontWeight="bold" textAnchor="middle">
            SEC 1-1 (SUPPORT)
          </text>
          <text x="57" y="177" fill="#fb923c" fontSize="8" textAnchor="middle">
            {curtailment.throughTop.callout} {hasTopExtra ? `+ ${curtailment.extraTopSupport.callout}` : ''}
          </text>
        </g>

        {/* ----------------- 3. SECTION 2-2 AT MIDSPAN (BOTTOM RIGHT) ----------------- */}
        <g transform="translate(680, 35)">
          <rect x="15" y="15" width="85" height="135" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" rx="3" />
          <rect x="23" y="23" width="69" height="119" fill="none" stroke="#a855f7" strokeWidth="1.5" rx="2" />

          {/* Top Through Bars */}
          <circle cx="28" cy="28" r="5" fill="#f97316" stroke="#ffffff" strokeWidth="1" />
          <circle cx="87" cy="28" r="5" fill="#f97316" stroke="#ffffff" strokeWidth="1" />

          {/* Bottom Through Corner Bars */}
          <circle cx="28" cy="137" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
          <circle cx="87" cy="137" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
          {/* Bottom Extra Bars */}
          {hasBotExtra && (
            <circle cx="57.5" cy="137" r="5.5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
          )}

          <text x="57" y="8" fill="#94a3b8" fontSize="9" textAnchor="middle">
            b = {b}mm
          </text>
          <text x="108" y="85" fill="#94a3b8" fontSize="9">
            D = {D}mm
          </text>

          <text x="57" y="165" fill="#e2e8f0" fontSize="9.5" fontWeight="bold" textAnchor="middle">
            SEC 2-2 (MIDSPAN)
          </text>
          <text x="57" y="177" fill="#38bdf8" fontSize="8" textAnchor="middle">
            {curtailment.throughBottom.callout} {hasBotExtra ? `+ ${curtailment.extraBottomMidspan.callout}` : ''}
          </text>
        </g>
      </svg>
    </div>
  );
};
