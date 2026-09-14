import React from 'react';

interface BeamProjectionProps {
  memberId: number;
  b_mm: number;
  D_mm: number;
  length_m: number;
  topBars?: string;
  bottomBars?: string;
  stirrups?: string;
  cover_mm?: number;
}

export const BeamProjectionSVG: React.FC<BeamProjectionProps> = ({
  memberId,
  b_mm,
  D_mm,
  length_m,
  topBars = '2-T16 (Main Cont.) + 2-T12 (Support Extra)',
  bottomBars = '3-T16 (Main Cont.)',
  stirrups = '2L-T8 @ 100 c/c (Support) / 175 c/c (Mid)',
  cover_mm = 30,
}) => {
  const w = 420;
  const h = 260;

  // Longitudinal elevation dimensions
  const elevX = 40;
  const elevY = 35;
  const elevW = 250;
  const elevH = Math.max(35, Math.min(65, (D_mm / b_mm) * 45));

  // Cross section A-A dimensions
  const secX = 325;
  const secY = 35;
  const secW = 60;
  const secH = (D_mm / b_mm) * secW;

  const coverPx = Math.max(4, (cover_mm / D_mm) * elevH);

  return (
    <div className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-sky-400 tracking-wider">
          2D ENGINEERING PROJECTION · BEAM #{memberId}
        </span>
        <span className="text-[10px] text-slate-400">
          Span L = {length_m.toFixed(2)} m · {b_mm}×{D_mm} mm
        </span>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto bg-slate-900/60 rounded border border-slate-800/80">
        {/* Grids and centerlines */}
        <line x1={elevX} y1={elevY + elevH / 2} x2={elevX + elevW} y2={elevY + elevH / 2} stroke="#334155" strokeDasharray="6 3" strokeWidth="0.8" />
        <line x1={secX + secW / 2} y1={secY - 10} x2={secX + secW / 2} y2={secY + secH + 10} stroke="#334155" strokeDasharray="6 3" strokeWidth="0.8" />

        {/* --- 1. LONGITUDINAL ELEVATION --- */}
        {/* Support columns left and right */}
        <rect x={elevX - 14} y={elevY} width={14} height={elevH + 25} fill="#1e293b" stroke="#475569" strokeWidth="1" />
        <rect x={elevX + elevW} y={elevY} width={14} height={elevH + 25} fill="#1e293b" stroke="#475569" strokeWidth="1" />
        <text x={elevX - 7} y={elevY + elevH + 18} fill="#64748b" fontSize="7" textAnchor="middle">SUPPORT</text>
        <text x={elevX + elevW + 7} y={elevY + elevH + 18} fill="#64748b" fontSize="7" textAnchor="middle">SUPPORT</text>

        {/* Beam outline */}
        <rect x={elevX} y={elevY} width={elevW} height={elevH} fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />

        {/* Top Reinforcement Bars (Continuous Gold) */}
        <line x1={elevX - 8} y1={elevY + coverPx} x2={elevX + elevW + 8} y2={elevY + coverPx} stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        {/* 90 deg hooks at ends */}
        <line x1={elevX - 8} y1={elevY + coverPx} x2={elevX - 8} y2={elevY + coverPx + 15} stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
        <line x1={elevX + elevW + 8} y1={elevY + coverPx} x2={elevX + elevW + 8} y2={elevY + coverPx + 15} stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />

        {/* Bottom Reinforcement Bars (Continuous Gold) */}
        <line x1={elevX - 8} y1={elevY + elevH - coverPx} x2={elevX + elevW + 8} y2={elevY + elevH - coverPx} stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
        <line x1={elevX - 8} y1={elevY + elevH - coverPx} x2={elevX - 8} y2={elevY + elevH - coverPx - 15} stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
        <line x1={elevX + elevW + 8} y1={elevY + elevH - coverPx} x2={elevX + elevW + 8} y2={elevY + elevH - coverPx - 15} stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />

        {/* Shear Stirrup Rings (Confinement Zones L/4 at supports, normal at midspan) */}
        {/* Left confinement (denser spacing) */}
        {[0.08, 0.14, 0.20, 0.26, 0.32].map((frac, idx) => (
          <line key={`st_l_${idx}`} x1={elevX + elevW * frac} y1={elevY + coverPx - 2} x2={elevX + elevW * frac} y2={elevY + elevH - coverPx + 2} stroke="#38bdf8" strokeWidth="1.2" />
        ))}
        {/* Midspan (wider spacing) */}
        {[0.40, 0.50, 0.60].map((frac, idx) => (
          <line key={`st_m_${idx}`} x1={elevX + elevW * frac} y1={elevY + coverPx - 2} x2={elevX + elevW * frac} y2={elevY + elevH - coverPx + 2} stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="2 1" />
        ))}
        {/* Right confinement (denser spacing) */}
        {[0.68, 0.74, 0.80, 0.86, 0.92].map((frac, idx) => (
          <line key={`st_r_${idx}`} x1={elevX + elevW * frac} y1={elevY + coverPx - 2} x2={elevX + elevW * frac} y2={elevY + elevH - coverPx + 2} stroke="#38bdf8" strokeWidth="1.2" />
        ))}

        {/* Dimension Line Span */}
        <line x1={elevX} y1={elevY + elevH + 12} x2={elevX + elevW} y2={elevY + elevH + 12} stroke="#64748b" strokeWidth="1" />
        <line x1={elevX} y1={elevY + elevH + 8} x2={elevX} y2={elevY + elevH + 16} stroke="#64748b" strokeWidth="1" />
        <line x1={elevX + elevW} y1={elevY + elevH + 8} x2={elevX + elevW} y2={elevY + elevH + 16} stroke="#64748b" strokeWidth="1" />
        <text x={elevX + elevW / 2} y={elevY + elevH + 24} fill="#cbd5e1" fontSize="9" textAnchor="middle">
          CLEAR SPAN L = {length_m.toFixed(3)} m
        </text>

        {/* Section Cut Line A-A */}
        <line x1={elevX + elevW * 0.5} y1={elevY - 12} x2={elevX + elevW * 0.5} y2={elevY + elevH + 6} stroke="#f43f5e" strokeWidth="1.2" strokeDasharray="4 2" />
        <polygon points={`${elevX + elevW * 0.5 - 4},${elevY - 12} ${elevX + elevW * 0.5 + 4},${elevY - 12} ${elevX + elevW * 0.5},${elevY - 18}`} fill="#f43f5e" />
        <text x={elevX + elevW * 0.5 + 8} y={elevY - 10} fill="#f43f5e" fontSize="9" fontWeight="bold">A</text>

        {/* --- 2. CROSS SECTION A-A --- */}
        <rect x={secX} y={secY} width={secW} height={secH} fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
        {/* Stirrup Rectangular Ring */}
        <rect x={secX + 6} y={secY + 6} width={secW - 12} height={secH - 12} fill="none" stroke="#38bdf8" strokeWidth="1.5" rx="2" />
        {/* Top 2 Bars */}
        <circle cx={secX + 11} cy={secY + 11} r="3" fill="#f59e0b" />
        <circle cx={secX + secW - 11} cy={secY + 11} r="3" fill="#f59e0b" />
        {/* Bottom 3 Bars */}
        <circle cx={secX + 11} cy={secY + secH - 11} r="3.2" fill="#fbbf24" />
        <circle cx={secX + secW / 2} cy={secY + secH - 11} r="3.2" fill="#fbbf24" />
        <circle cx={secX + secW - 11} cy={secY + secH - 11} r="3.2" fill="#fbbf24" />

        <text x={secX + secW / 2} y={secY + secH + 16} fill="#f8fafc" fontSize="9" fontWeight="bold" textAnchor="middle">
          SECTION A-A
        </text>
        <text x={secX + secW / 2} y={secY + secH + 28} fill="#94a3b8" fontSize="8" textAnchor="middle">
          {b_mm}×{D_mm} mm
        </text>

        {/* Callout Annotations Footer */}
        <g transform="translate(15, 175)">
          <rect x="0" y="0" width={w - 30} height="70" fill="#020617" rx="4" stroke="#1e293b" />
          
          <circle cx="15" cy="18" r="4" fill="#f59e0b" />
          <text x="26" y="21" fill="#f8fafc" fontSize="9" fontWeight="bold">TOP REBAR:</text>
          <text x="105" y="21" fill="#fde68a" fontSize="9">{topBars}</text>

          <circle cx="15" cy="38" r="4" fill="#fbbf24" />
          <text x="26" y="41" fill="#f8fafc" fontSize="9" fontWeight="bold">BOT REBAR:</text>
          <text x="105" y="41" fill="#fde68a" fontSize="9">{bottomBars}</text>

          <line x1="10" y1="58" x2="20" y2="58" stroke="#38bdf8" strokeWidth="2.5" />
          <text x="26" y="61" fill="#f8fafc" fontSize="9" fontWeight="bold">STIRRUPS:</text>
          <text x="105" y="61" fill="#7dd3fc" fontSize="9">{stirrups}</text>
        </g>
      </svg>
    </div>
  );
};

interface ColumnProjectionProps {
  memberId: number;
  label?: string;
  columnLabel?: string;
  b_mm: number;
  D_mm: number;
  height_m: number;
  rebarCallout?: string;
  verticalBars?: string;
  tiesCallout?: string;
  tieCallout?: string;
  cover_mm?: number;
}

export const ColumnProjectionSVG: React.FC<ColumnProjectionProps> = ({
  memberId,
  label,
  columnLabel,
  b_mm,
  D_mm,
  height_m,
  rebarCallout,
  verticalBars,
  tiesCallout,
  tieCallout,
  cover_mm = 40,
}) => {
  const displayLabel = label || columnLabel || `COLUMN #${memberId}`;
  const displayRebar = verticalBars || rebarCallout || '8-T20 (Corner + Face Bars)';
  const displayTies = tieCallout || tiesCallout || 'T8 @ 100 mm c/c (Lo Confinement) / 150 mm c/c';
  const w = 420;
  const h = 270;

  // Elevation dimensions
  const colX = 70;
  const colY = 30;
  const colW = 45;
  const colH = 160;

  // Cross section B-B
  const secX = 260;
  const secY = 50;
  const secW = 90;
  const secH = Math.round((D_mm / b_mm) * secW);

  return (
    <div className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-emerald-400 tracking-wider">
          2D ENGINEERING PROJECTION · {displayLabel}
        </span>
        <span className="text-[10px] text-slate-400">
          Storey H = {height_m.toFixed(2)} m · {b_mm}×{D_mm} mm
        </span>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto bg-slate-900/60 rounded border border-slate-800/80">
        {/* Floor lines Top & Bottom */}
        <line x1="20" y1={colY} x2="170" y2={colY} stroke="#64748b" strokeWidth="1.5" />
        <line x1="20" y1={colY + colH} x2="170" y2={colY + colH} stroke="#64748b" strokeWidth="1.5" />
        <text x="25" y={colY - 5} fill="#94a3b8" fontSize="8">FLOOR BEAM LEVEL</text>
        <text x="25" y={colY + colH + 12} fill="#94a3b8" fontSize="8">PLINTH / LOWER FLOOR</text>

        {/* Column Concrete Shaft */}
        <rect x={colX} y={colY} width={colW} height={colH} fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />

        {/* Longitudinal Vertical Rebars */}
        <line x1={colX + 8} y1={colY - 12} x2={colX + 8} y2={colY + colH + 12} stroke="#f59e0b" strokeWidth="2.5" />
        <line x1={colX + colW - 8} y1={colY - 12} x2={colX + colW - 8} y2={colY + colH + 12} stroke="#f59e0b" strokeWidth="2.5" />
        {/* Center intermediate bar */}
        <line x1={colX + colW / 2} y1={colY - 12} x2={colX + colW / 2} y2={colY + colH + 12} stroke="#fbbf24" strokeWidth="2" strokeDasharray="3 2" />

        {/* IS 13920 Confinement Tie Spacing Zones */}
        {/* Top Lo zone */}
        {[8, 16, 24, 32, 40].map((yOff, idx) => (
          <line key={`c_t_${idx}`} x1={colX + 4} y1={colY + yOff} x2={colX + colW - 4} y2={colY + yOff} stroke="#38bdf8" strokeWidth="1.2" />
        ))}
        {/* Midspan zone */}
        {[55, 75, 95, 115].map((yOff, idx) => (
          <line key={`c_m_${idx}`} x1={colX + 4} y1={colY + yOff} x2={colX + colW - 4} y2={colY + yOff} stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="2 1" />
        ))}
        {/* Bottom Lo zone */}
        {[colH - 40, colH - 32, colH - 24, colH - 16, colH - 8].map((yOff, idx) => (
          <line key={`c_b_${idx}`} x1={colX + 4} y1={colY + yOff} x2={colX + colW - 4} y2={colY + yOff} stroke="#38bdf8" strokeWidth="1.2" />
        ))}

        {/* Confinement zone annotation arrow */}
        <line x1={colX + colW + 10} y1={colY} x2={colX + colW + 10} y2={colY + 45} stroke="#38bdf8" strokeWidth="0.8" />
        <text x={colX + colW + 14} y={colY + 25} fill="#38bdf8" fontSize="7">Lo (Confine)</text>

        {/* Storey Height Dimension */}
        <line x1="45" y1={colY} x2="45" y2={colY + colH} stroke="#cbd5e1" strokeWidth="1" />
        <text x="35" y={colY + colH / 2} fill="#cbd5e1" fontSize="9" textAnchor="middle" transform={`rotate(-90 35 ${colY + colH / 2})`}>
          H = {height_m.toFixed(3)} m
        </text>

        {/* --- CROSS SECTION B-B --- */}
        <rect x={secX} y={secY} width={secW} height={secH} fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
        {/* Outer Rectangular Tie */}
        <rect x={secX + 8} y={secY + 8} width={secW - 16} height={secH - 16} fill="none" stroke="#38bdf8" strokeWidth="1.5" rx="3" />
        {/* 4 Corner Rebars */}
        <circle cx={secX + 14} cy={secY + 14} r="4" fill="#f59e0b" />
        <circle cx={secX + secW - 14} cy={secY + 14} r="4" fill="#f59e0b" />
        <circle cx={secX + 14} cy={secY + secH - 14} r="4" fill="#f59e0b" />
        <circle cx={secX + secW - 14} cy={secY + secH - 14} r="4" fill="#f59e0b" />
        {/* 4 Face Rebars */}
        <circle cx={secX + secW / 2} cy={secY + 14} r="3.5" fill="#fbbf24" />
        <circle cx={secX + secW / 2} cy={secY + secH - 14} r="3.5" fill="#fbbf24" />
        <circle cx={secX + 14} cy={secY + secH / 2} r="3.5" fill="#fbbf24" />
        <circle cx={secX + secW - 14} cy={secY + secH / 2} r="3.5" fill="#fbbf24" />

        {/* Internal Cross Ties */}
        <line x1={secX + secW / 2} y1={secY + 8} x2={secX + secW / 2} y2={secY + secH - 8} stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 1" />
        <line x1={secX + 8} y1={secY + secH / 2} x2={secX + secW - 8} y2={secY + secH / 2} stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 1" />

        <text x={secX + secW / 2} y={secY + secH + 16} fill="#f8fafc" fontSize="9" fontWeight="bold" textAnchor="middle">
          SECTION B-B
        </text>
        <text x={secX + secW / 2} y={secY + secH + 28} fill="#94a3b8" fontSize="8" textAnchor="middle">
          {b_mm}×{D_mm} mm
        </text>

        {/* Footer info banner */}
        <g transform="translate(15, 205)">
          <rect x="0" y="0" width={w - 30} height="52" fill="#020617" rx="4" stroke="#1e293b" />
          <circle cx="15" cy="18" r="4" fill="#f59e0b" />
          <text x="26" y="21" fill="#f8fafc" fontSize="9" fontWeight="bold">MAIN STEEL:</text>
          <text x="105" y="21" fill="#fde68a" fontSize="9">{rebarCallout}</text>

          <line x1="10" y1="38" x2="20" y2="38" stroke="#38bdf8" strokeWidth="2.5" />
          <text x="26" y="41" fill="#f8fafc" fontSize="9" fontWeight="bold">TIES / HOOPS:</text>
          <text x="105" y="41" fill="#7dd3fc" fontSize="9">{tiesCallout}</text>
        </g>
      </svg>
    </div>
  );
};

interface PileCapProjectionProps {
  nodeId?: number;
  capLabel?: string;
  pileCount: number;
  capLength_mm: number;
  capWidth_mm: number;
  capDepth_mm: number;
  pileDiameter_mm: number;
  pileSpacing_mm?: number;
  colWidth_mm?: number;
  colDepth_mm?: number;
  rebarMesh?: string;
  rebarBottom?: string;
  rebarTop?: string;
  sideFaceCallout?: string;
}

export const PileCapProjectionSVG: React.FC<PileCapProjectionProps> = ({
  nodeId,
  capLabel,
  pileCount,
  capLength_mm,
  capWidth_mm,
  capDepth_mm,
  pileDiameter_mm,
  pileSpacing_mm,
  colWidth_mm = 450,
  colDepth_mm = 550,
  rebarBottom = '2#T16@125 C/C (B)',
  rebarTop = 'T12@150 C/C (T)',
  sideFaceCallout = '2-T12@200 C/C',
}) => {
  const W = 500;
  const H = 310;

  // --- Layout constants ---
  // Cap body sits in the middle-left of the SVG
  const capX = 90;         // left edge of cap
  const capY = 110;        // top of cap
  const capW = 300;        // cap width in SVG px
  const capH = 70;         // cap height in SVG px (proportional to depth)
  const capMidX = capX + capW / 2;

  // Column stub (centred on cap)
  const colW_px = 50;
  const colH_px = 75;
  const colX = capMidX - colW_px / 2;
  const colY = capY - colH_px;

  // PCC blinding (150 thk) below cap
  const pccH = 10;
  const pccY = capY + capH;

  // Pile geometry
  const pileRad_px = Math.max(12, (pileDiameter_mm / capLength_mm) * (capW / 2) * 0.7);
  const pileH_px = 55;
  const pileY = pccY + pccH;

  // Pile positions along cap width — distribute pileCount piles
  const pilePositions: number[] = [];
  if (pileCount <= 1) {
    pilePositions.push(capMidX);
  } else {
    const margin = capW * 0.18;
    for (let i = 0; i < pileCount; i++) {
      pilePositions.push(capX + margin + ((capW - 2 * margin) * i) / (pileCount - 1));
    }
  }

  // Cover in SVG px (cover 40mm / capDepth_mm * capH)
  const cover_px = Math.max(5, (40 / capDepth_mm) * capH);

  // Rebar Y positions inside cap
  const yTopRebar = capY + cover_px;
  const yBotRebar = capY + capH - cover_px;
  const ySideFaceTop = capY + cover_px + 6;
  const ySideFaceMid = capY + capH / 2;
  const ySideFaceBot = capY + capH - cover_px - 6;

  // BOP elevation label
  const elevationM = (capDepth_mm / 1000).toFixed(1);

  const label = capLabel || (nodeId != null ? `PC-${nodeId}` : 'PILE CAP');

  return (
    <div className="w-full bg-[#0a0e1a] p-3 rounded-lg border border-slate-800 font-mono select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-amber-400 tracking-wider">
          2D ENGINEERING PROJECTION · {label}
        </span>
        <span className="text-[10px] text-slate-400">
          {pileCount}-Pile · {capWidth_mm}×{capLength_mm}×{capDepth_mm} mm · Ø{pileDiameter_mm} PILE
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto rounded border border-slate-800/60" style={{ background: '#0a0e1a' }}>

        {/* ── COLUMN STUB ─────────────────────────────────────── */}
        {/* Column outer cyan box */}
        <rect x={colX} y={colY} width={colW_px} height={colH_px}
          fill="none" stroke="#22d3ee" strokeWidth="1.8" />
        {/* Column inner dashed outline (cover) */}
        <rect x={colX + 5} y={colY + 3} width={colW_px - 10} height={colH_px - 3}
          fill="none" stroke="#22d3ee" strokeWidth="0.8" strokeDasharray="3 2" opacity={0.5} />
        {/* Vertical rebar (red dashed) inside column */}
        {[-10, 0, 10].map((dx, i) => (
          <line key={`cvbar_${i}`}
            x1={capMidX + dx} y1={colY + 4}
            x2={capMidX + dx} y2={capY + capH - 8}
            stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 3" />
        ))}
        {/* LINKS label rotated */}
        <text x={colX + colW_px + 8} y={colY + colH_px / 2 + 4}
          fill="#f59e0b" fontSize="8.5" fontWeight="bold" letterSpacing="2">LINKS</text>

        {/* ── PILE CAP BODY ────────────────────────────────────── */}
        {/* Main concrete outline */}
        <rect x={capX} y={capY} width={capW} height={capH}
          fill="#0f1b2d" stroke="#22d3ee" strokeWidth="2" />
        {/* Inner dashed cover line top */}
        <line x1={capX + cover_px} y1={capY + cover_px}
              x2={capX + capW - cover_px} y2={capY + cover_px}
              stroke="#22d3ee" strokeWidth="0.8" strokeDasharray="3 2" opacity={0.5} />
        {/* Inner dashed cover line bottom */}
        <line x1={capX + cover_px} y1={capY + capH - cover_px}
              x2={capX + capW - cover_px} y2={capY + capH - cover_px}
              stroke="#22d3ee" strokeWidth="0.8" strokeDasharray="3 2" opacity={0.5} />

        {/* ── TOP JALI (T10) — continuous line with 90° DOWNWARD hooks at both ends + transverse dots ── */}
        {/* Top main rebar with downward legs at left and right ends */}
        <path
          d={`M ${capX + cover_px} ${yTopRebar + 32} L ${capX + cover_px} ${yTopRebar} L ${capX + capW - cover_px} ${yTopRebar} L ${capX + capW - cover_px} ${yTopRebar + 32}`}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2.2"
        />
        {/* Transverse top jali bars (cross dots) */}
        {[0.08, 0.18, 0.28, 0.38, 0.48, 0.58, 0.68, 0.78, 0.88, 0.92].map((f, i) => (
          <circle key={`top_dot_${i}`}
            cx={capX + cover_px + (capW - 2 * cover_px) * f} cy={yTopRebar + 4} r="2.8" fill="#22d3ee" />
        ))}

        {/* ── BOTTOM JALI (T16) — continuous line with 90° UPWARD hooks at both ends + transverse dots ── */}
        {/* Bottom main rebar with upward legs at left and right ends */}
        <path
          d={`M ${capX + cover_px} ${yBotRebar - 32} L ${capX + cover_px} ${yBotRebar} L ${capX + capW - cover_px} ${yBotRebar} L ${capX + capW - cover_px} ${yBotRebar - 32}`}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2.6"
        />
        {/* Transverse bottom jali bars (cross dots resting on bottom bar) */}
        {[0.08, 0.18, 0.28, 0.38, 0.48, 0.58, 0.68, 0.78, 0.88, 0.92].map((f, i) => (
          <circle key={`bot_dot_${i}`}
            cx={capX + cover_px + (capW - 2 * cover_px) * f} cy={yBotRebar - 4} r="3.2" fill="#f59e0b" />
        ))}

        {/* ── FACE REINFORCEMENT (2-T10) — horizontal lines + face dots ── */}
        {/* Face bar layers between bottom & top jali */}
        {[ySideFaceTop + 8, ySideFaceBot - 8].map((y, i) => (
          <g key={`face_layer_${i}`}>
            {/* Horizontal side face bar running across */}
            <line
              x1={capX + cover_px} y1={y}
              x2={capX + capW - cover_px} y2={y}
              stroke="#10b981" strokeWidth="1.2" strokeDasharray="4 2" opacity={0.7}
            />
            {/* Left face bar dot */}
            <circle cx={capX + cover_px + 3} cy={y} r="2.6" fill="#10b981" />
            {/* Right face bar dot */}
            <circle cx={capX + capW - cover_px - 3} cy={y} r="2.6" fill="#10b981" />
          </g>
        ))}

        {/* ── COLUMN STARTER DOWELS (gold vertical inside cap with 90° bend feet) ── */}
        {[-9, 9].map((dx, i) => (
          <g key={`cdwl_${i}`}>
            <line
              x1={capMidX + dx} y1={colY + 4}
              x2={capMidX + dx} y2={yBotRebar}
              stroke="#fbbf24" strokeWidth="2.0"
            />
            {/* 90° anchor hook resting on bottom jali */}
            <line
              x1={capMidX + dx} y1={yBotRebar}
              x2={capMidX + dx + (dx < 0 ? -18 : 18)} y2={yBotRebar}
              stroke="#fbbf24" strokeWidth="2.0"
            />
          </g>
        ))}

        {/* ── 150mm THK PCC BLINDING LAYER (projecting 150mm beyond cap on both sides) ── */}
        <rect x={capX - 15} y={pccY} width={capW + 30} height={pccH}
          fill="#3b2a0e" stroke="#92400e" strokeWidth="1.2" />
        {/* Hatching across extended PCC */}
        {[0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95].map((f, i) => (
          <line key={`hatch_${i}`}
            x1={(capX - 15) + (capW + 30) * f - 4} y1={pccY}
            x2={(capX - 15) + (capW + 30) * f + 4} y2={pccY + pccH}
            stroke="#92400e" strokeWidth="0.8" />
        ))}

        {/* ── PILES ───────────────────────────────────────────── */}
        {pilePositions.map((px, i) => (
          <g key={`pile_${i}`}>
            {/* Pile rect (elevation) */}
            <rect x={px - pileRad_px} y={pileY} width={pileRad_px * 2} height={pileH_px}
              fill="#0a1628" stroke="#22c55e" strokeWidth="1.4" strokeDasharray="5 2" />
            {/* Pile circle top (cut view) */}
            <ellipse cx={px} cy={pileY} rx={pileRad_px} ry={4}
              fill="none" stroke="#22c55e" strokeWidth="1.2" strokeDasharray="4 2" />
            {/* Cross pattern inside pile */}
            <line x1={px - pileRad_px + 4} y1={pileY + pileH_px * 0.3}
                  x2={px + pileRad_px - 4} y2={pileY + pileH_px * 0.7}
                  stroke="#22c55e" strokeWidth="0.8" opacity={0.6} />
            <line x1={px + pileRad_px - 4} y1={pileY + pileH_px * 0.3}
                  x2={px - pileRad_px + 4} y2={pileY + pileH_px * 0.7}
                  stroke="#22c55e" strokeWidth="0.8" opacity={0.6} />
          </g>
        ))}

        {/* ── DIMENSIONS & ANNOTATIONS ─────────────────────────── */}

        {/* Cap depth dimension — left side */}
        <line x1={capX - 18} y1={capY} x2={capX - 8} y2={capY} stroke="#cbd5e1" strokeWidth="0.9" />
        <line x1={capX - 18} y1={capY + capH} x2={capX - 8} y2={capY + capH} stroke="#cbd5e1" strokeWidth="0.9" />
        <line x1={capX - 13} y1={capY} x2={capX - 13} y2={capY + capH} stroke="#cbd5e1" strokeWidth="0.9" />
        <text x={capX - 36} y={capY + capH / 2 + 4} fill="#e2e8f0" fontSize="8.5" textAnchor="middle"
          transform={`rotate(-90 ${capX - 36} ${capY + capH / 2 + 4})`}>
          {capDepth_mm} mm
        </text>

        {/* Cover dimension — left */}
        <text x={capX - 55} y={capY + cover_px / 2 + capY + 4} fill="#94a3b8" fontSize="7.5" textAnchor="middle">40</text>
        <line x1={capX - 8} y1={capY} x2={capX - 48} y2={capY} stroke="#475569" strokeWidth="0.7" />
        <line x1={capX - 8} y1={capY + cover_px * 2} x2={capX - 48} y2={capY + cover_px * 2} stroke="#475569" strokeWidth="0.7" />

        {/* Side face bar label */}
        <text x={capX - 10} y={capY + capH / 2 + 3} fill="#22d3ee" fontSize="8" textAnchor="end">{sideFaceCallout}</text>

        {/* 150THK PCC label */}
        <text x={capX - 10} y={pccY + pccH / 2 + 3} fill="#b45309" fontSize="7.5" textAnchor="end">150THK PCC</text>

        {/* Pile diameter label — right */}
        <line x1={capX + capW + 5} y1={pileY + pileH_px / 2}
              x2={capX + capW + 60} y2={pileY + pileH_px / 2}
              stroke="#475569" strokeWidth="0.8" />
        <text x={capX + capW + 63} y={pileY + pileH_px / 2 + 4}
          fill="#22c55e" fontSize="8">Ø{pileDiameter_mm} PILE</text>

        {/* BOP elevation — right of cap */}
        <line x1={capX + capW + 5} y1={capY + capH}
              x2={capX + capW + 95} y2={capY + capH}
              stroke="#3b82f6" strokeWidth="1.2" />
        {/* BOP triangle */}
        <polygon
          points={`${capX + capW + 100},${capY + capH - 10} ${capX + capW + 107},${capY + capH - 10} ${capX + capW + 103},${capY + capH}`}
          fill="#3b82f6" />
        <text x={capX + capW + 109} y={capY + capH - 13} fill="#93c5fd" fontSize="8.5">EL. {elevationM}m</text>
        <text x={capX + capW + 109} y={capY + capH - 2} fill="#3b82f6" fontSize="8.5" fontWeight="bold">BOP</text>

        {/* ── TOP rebar annotation — top right ── */}
        <line x1={capX + capW * 0.65} y1={capY - 18}
              x2={capX + capW + 5} y2={capY - 18}
              stroke="#475569" strokeWidth="0.7" />
        <line x1={capX + capW * 0.65} y1={capY - 18}
              x2={capX + capW * 0.65} y2={yTopRebar}
              stroke="#475569" strokeWidth="0.7" />
        <text x={capX + capW + 7} y={capY - 22} fill="#22d3ee" fontSize="8">{rebarTop}</text>

        {/* ── BOTTOM rebar annotation — top right (below top) ── */}
        <text x={capX + capW + 7} y={capY - 10} fill="#f59e0b" fontSize="8">{rebarBottom}</text>

        {/* ── BOTTOM rebar annotation below cap ── */}
        {/* Width arrow below piles */}
        <line x1={capX} y1={pileY + pileH_px + 14}
              x2={capX + capW} y2={pileY + pileH_px + 14}
              stroke="#cbd5e1" strokeWidth="0.9"
              markerStart="url(#arrowL)" markerEnd="url(#arrowR)" />
        <text x={capMidX} y={pileY + pileH_px + 26}
          fill="#22d3ee" fontSize="8" textAnchor="middle">{rebarTop}</text>
        <text x={capMidX} y={pileY + pileH_px + 38}
          fill="#f59e0b" fontSize="8" textAnchor="middle">{rebarBottom}</text>

        {/* Arrow defs */}
        <defs>
          <marker id="arrowL" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
            <polygon points="5 0, 5 5, 0 2.5" fill="#94a3b8" />
          </marker>
          <marker id="arrowR" markerWidth="5" markerHeight="5" refX="0" refY="2.5" orient="auto">
            <polygon points="0 0, 0 5, 5 2.5" fill="#94a3b8" />
          </marker>
        </defs>
      </svg>
    </div>
  );
};

interface PileProjectionProps {
  pileTypeId?: string;
  pileLabel?: string;
  diameter_mm: number;
  length_m: number;
  barCount?: number;
  barDiameter_mm?: number;
  spiralDiameter_mm?: number;
  spiralPitch_mm?: number;
  safeWorkingLoad_kN?: number;
  cover_mm?: number;
}

export const PileProjectionSVG: React.FC<PileProjectionProps> = ({
  pileTypeId,
  pileLabel,
  diameter_mm,
  length_m,
  barCount = 6,
  barDiameter_mm = 16,
  spiralDiameter_mm = 8,
  spiralPitch_mm = 150,
  safeWorkingLoad_kN = 450,
  cover_mm = 50,
}) => {
  const displayId = pileLabel || pileTypeId || 'P-1';
  const w = 420;
  const h = 260;

  const pileX = 65;
  const pileY = 25;
  const pileW = 36;
  const pileH = 165;

  const secX = 265;
  const secY = 45;
  const secR = 40;

  return (
    <div className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-teal-400 tracking-wider">
          2D RC BORED PILE PROJECTION · {displayId}
        </span>
        <span className="text-[10px] text-slate-400">
          Ø {diameter_mm} mm · L = {length_m.toFixed(1)} m · Qsafe = {safeWorkingLoad_kN} kN
        </span>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto bg-slate-900/60 rounded border border-slate-800/80">
        {/* Cut-off level mark */}
        <line x1="20" y1={pileY} x2="150" y2={pileY} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 2" />
        <text x="22" y={pileY - 6} fill="#94a3b8" fontSize="8">PILE CUT-OFF LEVEL</text>

        {/* Cylindrical Pile Shaft */}
        <rect x={pileX} y={pileY} width={pileW} height={pileH} fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
        {/* Conical shoe tip at bottom */}
        <polygon points={`${pileX},${pileY + pileH} ${pileX + pileW},${pileY + pileH} ${pileX + pileW / 2},${pileY + pileH + 16}`} fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />

        {/* Longitudinal Cage Rebars */}
        <line x1={pileX + 6} y1={pileY - 14} x2={pileX + 6} y2={pileY + pileH - 8} stroke="#f59e0b" strokeWidth="2.5" />
        <line x1={pileX + pileW - 6} y1={pileY - 14} x2={pileX + pileW - 6} y2={pileY + pileH - 8} stroke="#f59e0b" strokeWidth="2.5" />

        {/* Helical Spiral Wrapping */}
        {[15, 30, 45, 60, 75, 90, 105, 120, 135, 150].map((yOff, idx) => (
          <line key={`sp_${idx}`} x1={pileX + 4} y1={pileY + yOff} x2={pileX + pileW - 4} y2={pileY + yOff + 8} stroke="#38bdf8" strokeWidth="1.3" />
        ))}

        {/* Length dimension */}
        <line x1="42" y1={pileY} x2="42" y2={pileY + pileH} stroke="#cbd5e1" strokeWidth="1" />
        <text x="32" y={pileY + pileH / 2} fill="#cbd5e1" fontSize="9" textAnchor="middle" transform={`rotate(-90 32 ${pileY + pileH / 2})`}>
          L = {length_m.toFixed(1)} m
        </text>

        {/* --- PILE CIRCULAR CROSS SECTION --- */}
        <circle cx={secX} cy={secY + secR} r={secR} fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
        {/* Spiral hoop circle */}
        <circle cx={secX} cy={secY + secR} r={secR - 8} fill="none" stroke="#38bdf8" strokeWidth="1.5" />

        {/* Longitudinal bars around circumference */}
        {Array.from({ length: barCount }).map((_, idx) => {
          const angle = (2 * Math.PI * idx) / barCount;
          const r = secR - 8;
          const bx = secX + r * Math.cos(angle);
          const by = secY + secR + r * Math.sin(angle);
          return <circle key={`pbar_${idx}`} cx={bx} cy={by} r="3.5" fill="#f59e0b" />;
        })}

        <text x={secX} y={secY + secR * 2 + 18} fill="#f8fafc" fontSize="9" fontWeight="bold" textAnchor="middle">
          CROSS SECTION
        </text>
        <text x={secX} y={secY + secR * 2 + 30} fill="#94a3b8" fontSize="8" textAnchor="middle">
          Ø {diameter_mm} mm · {barCount}-T{barDiameter_mm}
        </text>

        {/* Footer info banner */}
        <g transform="translate(15, 205)">
          <rect x="0" y="0" width={w - 30} height="48" fill="#020617" rx="4" stroke="#1e293b" />
          <circle cx="15" cy="16" r="4" fill="#f59e0b" />
          <text x="26" y="19" fill="#f8fafc" fontSize="9" fontWeight="bold">LONGITUDINAL REBAR:</text>
          <text x="165" y="19" fill="#fde68a" fontSize="9">{barCount}-T{barDiameter_mm} (Fe500)</text>

          <line x1="10" y1="34" x2="20" y2="34" stroke="#38bdf8" strokeWidth="2.5" />
          <text x="26" y="37" fill="#f8fafc" fontSize="9" fontWeight="bold">HELICAL SPIRAL:</text>
          <text x="165" y="37" fill="#7dd3fc" fontSize="9">Ø {spiralDiameter_mm}mm @ {spiralPitch_mm} mm pitch</text>
        </g>
      </svg>
    </div>
  );
};
