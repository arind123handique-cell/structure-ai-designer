import React, { useState } from 'react';
import { MasterShearWallOutput } from './shearWallEngine';
import { Layers, Maximize2, Compass, LayoutGrid, Eye } from 'lucide-react';

interface ShearWallDrawingSvgProps {
  wall: MasterShearWallOutput;
  width?: number;
  height?: number;
  initialViewMode?: 'ALL_VIEWS' | 'PLAN_VIEW' | 'LONGITUDINAL_SECTION' | 'CROSS_SECTION';
}

export const ShearWallDrawingSvg: React.FC<ShearWallDrawingSvgProps> = ({
  wall,
  width = 920,
  height = 540,
  initialViewMode = 'ALL_VIEWS',
}) => {
  const [viewMode, setViewMode] = useState<'ALL_VIEWS' | 'PLAN_VIEW' | 'LONGITUDINAL_SECTION' | 'CROSS_SECTION'>(
    initialViewMode
  );

  const Lw_m = wall.length;
  const Hw_m = wall.height;
  const Lw_mm = Math.round(Lw_m * 1000);
  const Hw_mm = Math.round(Hw_m * 1000);
  const tw = wall.thickness;
  const fck = wall.input?.fck || 25;
  const fy = wall.input?.fy || 500;

  const hasBoundary = wall.result.boundary.isBoundaryElementRequired;
  const boundLen = wall.result.boundary.boundaryLength; // mm
  const boundBarCount = wall.result.boundary.longitudinalBarCount || 8;
  const boundBarDia = wall.result.boundary.longitudinalBarDia || 16;
  const hoopDia = wall.result.boundary.confiningHoopDia || 8;
  const hoopSpacing = wall.result.boundary.confiningHoopSpacing || 100;

  const webVertDia = wall.result.webVerticalDia || 10;
  const webVertSpacing = wall.result.webVerticalSpacing || 150;
  const webHorizDia = wall.result.webHorizontalDia || 10;
  const webHorizSpacing = wall.result.webHorizontalSpacing || 150;

  // Plastic hinge height (IS 13920 Cl. 9.4.3: max(Lw/6, 2*tw, 450mm))
  const plasticHingeHeightMm = Math.max(Math.round(Lw_mm / 6), 2 * tw, 450);

  return (
    <div className="flex flex-col items-center bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-2xl overflow-hidden font-mono select-none">
      {/* Top Controls & View Mode Selector */}
      <div className="flex flex-wrap items-center justify-between w-full mb-3 px-2 pb-2 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-rose-600 rounded">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="font-bold text-rose-400 text-xs block">
              DUCTILE RC SHEAR WALL SW-{wall.wallId} — IS 13920:2016 &amp; IS 456
            </span>
            <span className="text-[10px] text-slate-400 font-sans">
              Size: {Lw_m.toFixed(2)}m × {tw}mm × {Hw_m.toFixed(2)}m · M{fck} / Fe{fy}
            </span>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center bg-slate-900 p-0.5 rounded-md border border-slate-700 text-[11px]">
          <button
            type="button"
            onClick={() => setViewMode('ALL_VIEWS')}
            className={`px-2.5 py-1 rounded transition-all font-bold ${
              viewMode === 'ALL_VIEWS'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Views Sheet
          </button>
          <button
            type="button"
            onClick={() => setViewMode('PLAN_VIEW')}
            className={`px-2.5 py-1 rounded transition-all font-bold ${
              viewMode === 'PLAN_VIEW'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2D Plan View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('LONGITUDINAL_SECTION')}
            className={`px-2.5 py-1 rounded transition-all font-bold ${
              viewMode === 'LONGITUDINAL_SECTION'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Longitudinal Elevation
          </button>
          <button
            type="button"
            onClick={() => setViewMode('CROSS_SECTION')}
            className={`px-2.5 py-1 rounded transition-all font-bold ${
              viewMode === 'CROSS_SECTION'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cross-Section
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        width="100%"
        height={height}
        viewBox={
          viewMode === 'ALL_VIEWS'
            ? '0 0 1000 600'
            : viewMode === 'PLAN_VIEW'
            ? '0 0 900 480'
            : viewMode === 'LONGITUDINAL_SECTION'
            ? '0 0 900 520'
            : '0 0 900 480'
        }
        className="w-full h-auto text-xs"
      >
        <defs>
          <marker id="sw-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#ef4444" />
          </marker>
          <marker id="sw-arrow-start" markerWidth="8" markerHeight="8" refX="0" refY="3" orient="auto">
            <polygon points="6 0, 0 3, 6 6" fill="#ef4444" />
          </marker>
          <pattern id="concrete-hatch" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.8" fill="#475569" />
            <circle cx="8" cy="10" r="0.9" fill="#475569" />
            <circle cx="14" cy="4" r="0.7" fill="#475569" />
            <line x1="0" y1="16" x2="16" y2="0" stroke="#334155" strokeWidth="0.4" />
          </pattern>
          <pattern id="boundary-hatch" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="8" x2="8" y2="0" stroke="#f43f5e" strokeWidth="0.8" strokeOpacity="0.4" />
          </pattern>
        </defs>

        {/* ------------------------------------------------------------- */}
        {/* MODE 1: ALL VIEWS COMBINED ENGINEERING SHEET (3-IN-1)         */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'ALL_VIEWS' && (
          <g>
            {/* Sheet Border & Title Box */}
            <rect x="10" y="10" width="980" height="580" fill="none" stroke="#334155" strokeWidth="1.5" rx="3" />

            {/* Title Block Bottom Right */}
            <g transform="translate(680, 480)">
              <rect x="0" y="0" width="295" height="95" fill="#0f172a" stroke="#475569" strokeWidth="1" rx="2" />
              <text x="12" y="20" fill="#f43f5e" fontSize="11" fontWeight="bold">
                RCC DUCTILE SHEAR WALL SW-{wall.wallId}
              </text>
              <text x="12" y="38" fill="#cbd5e1" fontSize="9">
                Design Standard: IS 13920:2016 Cl. 9 &amp; 10 / IS 456
              </text>
              <text x="12" y="54" fill="#94a3b8" fontSize="8.5">
                Concrete: M{fck} · Reinforcement: Fe{fy}
              </text>
              <text x="12" y="70" fill="#a5b4fc" fontSize="8.5">
                Status: {wall.status} (Shear τv = {wall.result.nominalShearStress} N/mm²)
              </text>
              <text x="12" y="86" fill="#64748b" fontSize="8">
                CAD Scale: As Shown · Drawn to IS Engineering Norms
              </text>
            </g>

            {/* VIEW A: 2D PLAN VIEW (Top Half Left) */}
            <g transform="translate(40, 40)">
              <text x="0" y="0" fill="#38bdf8" fontSize="11" fontWeight="bold">
                VIEW A: 2D SHEAR WALL PLAN &amp; REINFORCEMENT MESH (SCALE 1:25)
              </text>

              {/* Plan Container */}
              <g transform="translate(0, 30)">
                {/* Concrete Body */}
                <rect x="0" y="0" width="580" height="65" fill="#0f172a" stroke="#f43f5e" strokeWidth="2.5" rx="2" />
                <rect x="0" y="0" width="580" height="65" fill="url(#concrete-hatch)" />

                {/* Left Boundary Element Zone (c mm) */}
                {hasBoundary && (
                  <g>
                    <rect x="0" y="0" width="95" height="65" fill="url(#boundary-hatch)" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="3,2" />
                    {/* Confining Outer Hoop */}
                    <rect x="6" y="6" width="83" height="53" fill="none" stroke="#22c55e" strokeWidth="1.5" rx="2" />
                    {/* Boundary Longitudinal Bars (e.g. 8 bars in 2 rows) */}
                    {[12, 38, 64, 82].map((bx, i) => (
                      <React.Fragment key={`lbb_${i}`}>
                        <circle cx={bx} cy="14" r="4.5" fill="#f97316" stroke="#ea580c" strokeWidth="1" />
                        <circle cx={bx} cy="51" r="4.5" fill="#f97316" stroke="#ea580c" strokeWidth="1" />
                      </React.Fragment>
                    ))}
                    {/* Internal Cross Ties */}
                    <line x1="38" y1="6" x2="38" y2="59" stroke="#22c55e" strokeWidth="1" strokeDasharray="2,2" />
                    <line x1="64" y1="6" x2="64" y2="59" stroke="#22c55e" strokeWidth="1" strokeDasharray="2,2" />
                  </g>
                )}

                {/* Right Boundary Element Zone (c mm) */}
                {hasBoundary && (
                  <g>
                    <rect x="485" y="0" width="95" height="65" fill="url(#boundary-hatch)" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="3,2" />
                    {/* Confining Outer Hoop */}
                    <rect x="491" y="6" width="83" height="53" fill="none" stroke="#22c55e" strokeWidth="1.5" rx="2" />
                    {/* Boundary Longitudinal Bars */}
                    {[498, 516, 542, 568].map((bx, i) => (
                      <React.Fragment key={`rbb_${i}`}>
                        <circle cx={bx} cy="14" r="4.5" fill="#f97316" stroke="#ea580c" strokeWidth="1" />
                        <circle cx={bx} cy="51" r="4.5" fill="#f97316" stroke="#ea580c" strokeWidth="1" />
                      </React.Fragment>
                    ))}
                    {/* Internal Cross Ties */}
                    <line x1="516" y1="6" x2="516" y2="59" stroke="#22c55e" strokeWidth="1" strokeDasharray="2,2" />
                    <line x1="542" y1="6" x2="542" y2="59" stroke="#22c55e" strokeWidth="1" strokeDasharray="2,2" />
                  </g>
                )}

                {/* Central Web Reinforcement (Double Curtains) */}
                {[120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450].map((wx, i) => (
                  <React.Fragment key={`webb_${i}`}>
                    <circle cx={wx} cy="14" r="3.5" fill="#fb7185" />
                    <circle cx={wx} cy="51" r="3.5" fill="#fb7185" />
                    {/* Web U-pins / Cross Ties every 2nd bar */}
                    {i % 2 === 0 && (
                      <line x1={wx} y1="14" x2={wx} y2="51" stroke="#38bdf8" strokeWidth="0.9" strokeDasharray="2,2" />
                    )}
                  </React.Fragment>
                ))}

                {/* Horizontal Rebar Layers (Outer Lines) */}
                <line x1="10" y1="14" x2="570" y2="14" stroke="#fb7185" strokeWidth="1" strokeDasharray="4,2" />
                <line x1="10" y1="51" x2="570" y2="51" stroke="#fb7185" strokeWidth="1" strokeDasharray="4,2" />

                {/* Plan Dimensions */}
                {/* Lw Top Dimension */}
                <line x1="0" y1="-18" x2="580" y2="-18" stroke="#ef4444" strokeWidth="1" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
                <line x1="0" y1="0" x2="0" y2="-22" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="580" y1="0" x2="580" y2="-22" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                <text x="290" y="-22" fill="#ef4444" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                  Lw = {Lw_mm} mm ({Lw_m.toFixed(2)} m)
                </text>

                {/* tw Right Dimension */}
                <line x1="600" y1="0" x2="600" y2="65" stroke="#ef4444" strokeWidth="1" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
                <line x1="580" y1="0" x2="604" y2="0" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="580" y1="65" x2="604" y2="65" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                <text x="618" y="36" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="start">
                  tw = {tw} mm
                </text>

                {/* Boundary Zone Dimension Left */}
                {hasBoundary && (
                  <g>
                    <line x1="0" y1="78" x2="95" y2="78" stroke="#e11d48" strokeWidth="0.9" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
                    <line x1="0" y1="65" x2="0" y2="82" stroke="#e11d48" strokeWidth="0.5" strokeDasharray="2,2" />
                    <line x1="95" y1="65" x2="95" y2="82" stroke="#e11d48" strokeWidth="0.5" strokeDasharray="2,2" />
                    <text x="47" y="92" fill="#f43f5e" fontSize="8" fontWeight="bold" textAnchor="middle">
                      c = {boundLen} mm
                    </text>

                    {/* Central Web Dimension */}
                    <line x1="95" y1="78" x2="485" y2="78" stroke="#64748b" strokeWidth="0.8" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
                    <line x1="485" y1="65" x2="485" y2="82" stroke="#64748b" strokeWidth="0.5" strokeDasharray="2,2" />
                    <text x="290" y="92" fill="#94a3b8" fontSize="8" textAnchor="middle">
                      Web Zone = {Lw_mm - 2 * boundLen} mm
                    </text>

                    {/* Boundary Zone Dimension Right */}
                    <line x1="485" y1="78" x2="580" y2="78" stroke="#e11d48" strokeWidth="0.9" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
                    <line x1="580" y1="65" x2="580" y2="82" stroke="#e11d48" strokeWidth="0.5" strokeDasharray="2,2" />
                    <text x="532" y="92" fill="#f43f5e" fontSize="8" fontWeight="bold" textAnchor="middle">
                      c = {boundLen} mm
                    </text>
                  </g>
                )}
              </g>
            </g>

            {/* VIEW B: LONGITUDINAL ELEVATION VIEW (Bottom Left) */}
            <g transform="translate(40, 210)">
              <text x="0" y="0" fill="#38bdf8" fontSize="11" fontWeight="bold">
                VIEW B: LONGITUDINAL ELEVATION &amp; SEISMIC CONFINEMENT DETAILS (SCALE 1:40)
              </text>

              <g transform="translate(0, 20)">
                {/* Foundation Line / Bed below */}
                <rect x="-15" y="270" width="610" height="40" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                <text x="290" y="295" fill="#94a3b8" fontSize="8.5" textAnchor="middle">
                  FOUNDATION PILE CAP / RAFT TOP LEVEL (EL. +0.000 m)
                </text>

                {/* Story Slab / Beam Level Top */}
                <rect x="-15" y="-12" width="610" height="12" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                <text x="290" y="-3" fill="#94a3b8" fontSize="8.5" textAnchor="middle">
                  UPPER FLOOR SLAB LEVEL (EL. +{Hw_m.toFixed(3)} m)
                </text>

                {/* Wall Elevation Body */}
                <rect x="0" y="0" width="580" height="270" fill="#0f172a" stroke="#f43f5e" strokeWidth="2" rx="2" />
                <rect x="0" y="0" width="580" height="270" fill="url(#concrete-hatch)" />

                {/* Plastic Hinge Zone Boundary Box (Bottom ~70px) */}
                <rect x="0" y="200" width="580" height="70" fill="#881337" fillOpacity="0.2" stroke="#e11d48" strokeWidth="1" strokeDasharray="3,3" />
                <text x="590" y="238" fill="#f43f5e" fontSize="7.5" fontWeight="bold">
                  PLASTIC HINGE ZONE (hp = {plasticHingeHeightMm}mm)
                </text>
                <text x="590" y="248" fill="#22c55e" fontSize="7">
                  Special Confinement: {hoopDia}mm @ {hoopSpacing}mm c/c
                </text>

                {/* Foundation Starter Dowel Bars (extending into foundation) */}
                {[15, 45, 75, 505, 535, 565].map((dx, i) => (
                  <g key={`fdow_${i}`}>
                    <line x1={dx} y1="200" x2={dx} y2="300" stroke="#f97316" strokeWidth="2.5" />
                    <line x1={dx} y1="300" x2={dx + 18} y2="300" stroke="#f97316" strokeWidth="2.5" />
                  </g>
                ))}

                {/* Vertical Bars in Wall Elevation */}
                {hasBoundary && (
                  <g>
                    {/* Left Boundary Vertical Bars */}
                    <line x1="15" y1="5" x2="15" y2="265" stroke="#f97316" strokeWidth="3" />
                    <line x1="45" y1="5" x2="45" y2="265" stroke="#f97316" strokeWidth="3" />
                    <line x1="75" y1="5" x2="75" y2="265" stroke="#f97316" strokeWidth="3" />

                    {/* Right Boundary Vertical Bars */}
                    <line x1="505" y1="5" x2="505" y2="265" stroke="#f97316" strokeWidth="3" />
                    <line x1="535" y1="5" x2="535" y2="265" stroke="#f97316" strokeWidth="3" />
                    <line x1="565" y1="5" x2="565" y2="265" stroke="#f97316" strokeWidth="3" />
                  </g>
                )}

                {/* Web Vertical Bars */}
                {[135, 195, 255, 315, 375, 435].map((wx, i) => (
                  <line key={`welev_${i}`} x1={wx} y1="8" x2={wx} y2="262" stroke="#fb7185" strokeWidth="1.4" strokeDasharray="4,2" />
                ))}

                {/* Tight Plastic Hinge Confining Hoops (Bottom Zone) */}
                {[205, 215, 225, 235, 245, 255, 265].map((hy, i) => (
                  <React.Fragment key={`hplastic_${i}`}>
                    <line x1="5" y1={hy} x2="90" y2={hy} stroke="#22c55e" strokeWidth="1.8" />
                    <line x1="490" y1={hy} x2="575" y2={hy} stroke="#22c55e" strokeWidth="1.8" />
                  </React.Fragment>
                ))}

                {/* Standard Upper Confining Hoops */}
                {[25, 50, 75, 100, 125, 150, 175].map((hy, i) => (
                  <React.Fragment key={`hstd_${i}`}>
                    <line x1="5" y1={hy} x2="90" y2={hy} stroke="#22c55e" strokeWidth="1.2" />
                    <line x1="490" y1={hy} x2="575" y2={hy} stroke="#22c55e" strokeWidth="1.2" />
                  </React.Fragment>
                ))}

                {/* Web Horizontal Shear Reinforcement (Full Length) */}
                {[30, 60, 90, 120, 150, 180, 210, 240].map((wy, i) => (
                  <line key={`whoriz_${i}`} x1="10" y1={wy} x2="570" y2={wy} stroke="#38bdf8" strokeWidth="1.1" strokeDasharray="5,2" />
                ))}

                {/* Elevation Hw Dimension Line */}
                <line x1="-30" y1="0" x2="-30" y2="270" stroke="#ef4444" strokeWidth="1" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
                <line x1="0" y1="0" x2="-34" y2="0" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="270" x2="-34" y2="270" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                <text x="-40" y="140" fill="#ef4444" fontSize="9.5" fontWeight="bold" textAnchor="middle" transform="rotate(-90 -40 140)">
                  Hw = {Hw_mm} mm ({Hw_m.toFixed(2)} m)
                </text>
              </g>
            </g>

            {/* VIEW C: DETAILED TRANSVERSE CROSS-SECTION (Top Right) */}
            <g transform="translate(680, 40)">
              <text x="0" y="0" fill="#38bdf8" fontSize="11" fontWeight="bold">
                VIEW C: BOUNDARY ZONE &amp; WEB DETAIL
              </text>

              <g transform="translate(0, 30)">
                {/* Large Scale Boundary Cut Box */}
                <rect x="0" y="0" width="280" height="150" fill="#0f172a" stroke="#f43f5e" strokeWidth="2" rx="3" />
                <rect x="0" y="0" width="280" height="150" fill="url(#concrete-hatch)" />

                {/* Outer Confinement Link with 135 deg seismic hooks */}
                <rect x="18" y="18" width="244" height="114" fill="none" stroke="#22c55e" strokeWidth="2.2" rx="4" />

                {/* Main Longitudinal Bars (8-T16 or 12-T20) */}
                {[
                  { cx: 32, cy: 32 }, { cx: 90, cy: 32 }, { cx: 148, cy: 32 }, { cx: 206, cy: 32 }, { cx: 248, cy: 32 },
                  { cx: 32, cy: 118 }, { cx: 90, cy: 118 }, { cx: 148, cy: 118 }, { cx: 206, cy: 118 }, { cx: 248, cy: 118 }
                ].map((pt, i) => (
                  <circle key={`bbdc_${i}`} cx={pt.cx} cy={pt.cy} r="6.5" fill="#f97316" stroke="#ea580c" strokeWidth="1.5" />
                ))}

                {/* Internal Cross Ties / Crossties holding middle bars */}
                <line x1="90" y1="18" x2="90" y2="132" stroke="#22c55e" strokeWidth="1.4" />
                <line x1="148" y1="18" x2="148" y2="132" stroke="#22c55e" strokeWidth="1.4" />
                <line x1="206" y1="18" x2="206" y2="132" stroke="#22c55e" strokeWidth="1.4" />

                {/* Rebar Details Callouts */}
                <text x="140" y="185" fill="#fb923c" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                  Boundary Steel: {wall.result.boundary.recommendedRebarCallout.split(' (')[0]}
                </text>
                <text x="140" y="200" fill="#22c55e" fontSize="8" textAnchor="middle">
                  Seismic Ties: {hoopDia}mm @ {hoopSpacing}mm c/c with 135° Hooks
                </text>
                <text x="140" y="215" fill="#38bdf8" fontSize="8" textAnchor="middle">
                  Clear Cover: 25 mm to Main Links
                </text>
              </g>
            </g>
          </g>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 2: DEDICATED 2D PLAN VIEW ONLY                           */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'PLAN_VIEW' && (
          <g transform="translate(60, 60)">
            <text x="0" y="0" fill="#38bdf8" fontSize="13" fontWeight="bold">
              2D DUCTILE SHEAR WALL CROSS-SECTION PLAN VIEW — SW-{wall.wallId}
            </text>
            <text x="0" y="18" fill="#94a3b8" fontSize="9.5">
              IS 13920:2016 Cl. 9.1.4 (Double-Curtains) &amp; Cl. 9.4 (Special Boundary Detailing)
            </text>

            <g transform="translate(0, 60)">
              {/* Full Scale Wall Body */}
              <rect x="0" y="0" width="760" height="120" fill="#0f172a" stroke="#f43f5e" strokeWidth="3" rx="3" />
              <rect x="0" y="0" width="760" height="120" fill="url(#concrete-hatch)" />

              {/* Left Boundary Element */}
              <rect x="0" y="0" width="130" height="120" fill="url(#boundary-hatch)" stroke="#e11d48" strokeWidth="2" strokeDasharray="4,2" />
              <rect x="10" y="10" width="110" height="100" fill="none" stroke="#22c55e" strokeWidth="2.5" rx="3" />
              {[22, 58, 94, 110].map((bx, i) => (
                <React.Fragment key={`plb_${i}`}>
                  <circle cx={bx} cy="24" r="7" fill="#f97316" stroke="#ea580c" strokeWidth="1.5" />
                  <circle cx={bx} cy="96" r="7" fill="#f97316" stroke="#ea580c" strokeWidth="1.5" />
                </React.Fragment>
              ))}
              <line x1="58" y1="10" x2="58" y2="110" stroke="#22c55e" strokeWidth="1.5" />
              <line x1="94" y1="10" x2="94" y2="110" stroke="#22c55e" strokeWidth="1.5" />

              {/* Right Boundary Element */}
              <rect x="630" y="0" width="130" height="120" fill="url(#boundary-hatch)" stroke="#e11d48" strokeWidth="2" strokeDasharray="4,2" />
              <rect x="640" y="10" width="110" height="100" fill="none" stroke="#22c55e" strokeWidth="2.5" rx="3" />
              {[650, 666, 702, 738].map((bx, i) => (
                <React.Fragment key={`prb_${i}`}>
                  <circle cx={bx} cy="24" r="7" fill="#f97316" stroke="#ea580c" strokeWidth="1.5" />
                  <circle cx={bx} cy="96" r="7" fill="#f97316" stroke="#ea580c" strokeWidth="1.5" />
                </React.Fragment>
              ))}
              <line x1="666" y1="10" x2="666" y2="110" stroke="#22c55e" strokeWidth="1.5" />
              <line x1="702" y1="10" x2="702" y2="110" stroke="#22c55e" strokeWidth="1.5" />

              {/* Web Double-Curtain Vertical Bars */}
              {[170, 210, 250, 290, 330, 370, 410, 450, 490, 530, 570].map((wx, i) => (
                <React.Fragment key={`pwb_${i}`}>
                  <circle cx={wx} cy="24" r="5" fill="#fb7185" />
                  <circle cx={wx} cy="96" r="5" fill="#fb7185" />
                  <line x1={wx} y1="24" x2={wx} y2="96" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3,3" />
                </React.Fragment>
              ))}

              {/* Horizontal Outer Mesh Lines */}
              <line x1="10" y1="24" x2="750" y2="24" stroke="#fb7185" strokeWidth="1.8" strokeDasharray="6,3" />
              <line x1="10" y1="96" x2="750" y2="96" stroke="#fb7185" strokeWidth="1.8" strokeDasharray="6,3" />

              {/* Dimension Lw */}
              <line x1="0" y1="-25" x2="760" y2="-25" stroke="#ef4444" strokeWidth="1.2" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
              <line x1="0" y1="0" x2="0" y2="-30" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="760" y1="0" x2="760" y2="-30" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x="380" y="-32" fill="#ef4444" fontSize="11" fontWeight="bold" textAnchor="middle">
                Lw = {Lw_mm} mm ({Lw_m.toFixed(2)} m)
              </text>

              {/* Dimension tw */}
              <line x1="785" y1="0" x2="785" y2="120" stroke="#ef4444" strokeWidth="1.2" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
              <line x1="760" y1="0" x2="790" y2="0" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="760" y1="120" x2="790" y2="120" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x="805" y="65" fill="#ef4444" fontSize="11" fontWeight="bold">
                tw = {tw} mm
              </text>

              {/* Bottom Breakdown Dimensions */}
              <line x1="0" y1="145" x2="130" y2="145" stroke="#e11d48" strokeWidth="1" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
              <line x1="0" y1="120" x2="0" y2="150" stroke="#e11d48" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="130" y1="120" x2="130" y2="150" stroke="#e11d48" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x="65" y="162" fill="#f43f5e" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                Boundary c = {boundLen} mm
              </text>

              <line x1="130" y1="145" x2="630" y2="145" stroke="#64748b" strokeWidth="1" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
              <line x1="630" y1="120" x2="630" y2="150" stroke="#64748b" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x="380" y="162" fill="#94a3b8" fontSize="9.5" textAnchor="middle">
                Web Zone = {Lw_mm - 2 * boundLen} mm (2 Curtains T{webVertDia} @ {webVertSpacing} c/c)
              </text>

              <line x1="630" y1="145" x2="760" y2="145" stroke="#e11d48" strokeWidth="1" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
              <line x1="760" y1="120" x2="760" y2="150" stroke="#e11d48" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x="695" y="162" fill="#f43f5e" fontSize="9.5" fontWeight="bold" textAnchor="middle">
                Boundary c = {boundLen} mm
              </text>
            </g>

            {/* Rebar Schedule Callout Box */}
            <g transform="translate(0, 275)">
              <rect x="0" y="0" width="760" height="90" fill="#0f172a" stroke="#334155" strokeWidth="1.2" rx="3" />
              <text x="20" y="24" fill="#38bdf8" fontSize="10" fontWeight="bold">
                REINFORCEMENT SCHEDULE &amp; CODE SPECIFICATIONS:
              </text>
              <text x="20" y="44" fill="#fb923c" fontSize="9">
                • Boundary Longitudinal Steel: {wall.result.boundary.recommendedRebarCallout}
              </text>
              <text x="20" y="60" fill="#22c55e" fontSize="9">
                • Boundary Special Confining Hoops: {hoopDia}mm Ties @ {hoopSpacing} mm c/c (IS 13920 Cl. 9.4.5)
              </text>
              <text x="20" y="76" fill="#fb7185" fontSize="9">
                • Web Mesh: 2 Curtains T{webVertDia} @ {webVertSpacing} mm c/c (Vertical) + 2 Curtains T{webHorizDia} @ {webHorizSpacing} mm c/c (Horizontal)
              </text>
            </g>
          </g>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 3: LONGITUDINAL ELEVATION SECTION ONLY                   */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'LONGITUDINAL_SECTION' && (
          <g transform="translate(80, 50)">
            <text x="0" y="0" fill="#38bdf8" fontSize="13" fontWeight="bold">
              LONGITUDINAL SECTION ELEVATION — WALL SW-{wall.wallId}
            </text>
            <text x="0" y="18" fill="#94a3b8" fontSize="9.5">
              Full Story Height Hw = {Hw_m.toFixed(2)}m with Plastic Hinge Confinement &amp; Foundation Dowel Anchors
            </text>

            <g transform="translate(0, 50)">
              {/* Foundation Top Bed */}
              <rect x="-30" y="340" width="760" height="50" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
              <text x="350" y="370" fill="#94a3b8" fontSize="10" textAnchor="middle">
                FOUNDATION RAFT / PILE CAP LEVEL (+0.000 m)
              </text>

              {/* Upper Floor Level */}
              <rect x="-30" y="-18" width="760" height="18" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
              <text x="350" y="-5" fill="#94a3b8" fontSize="10" textAnchor="middle">
                FLOOR SLAB LEVEL (+{Hw_m.toFixed(3)} m)
              </text>

              {/* Wall Elevation Body */}
              <rect x="0" y="0" width="700" height="340" fill="#0f172a" stroke="#f43f5e" strokeWidth="2.5" rx="3" />
              <rect x="0" y="0" width="700" height="340" fill="url(#concrete-hatch)" />

              {/* Plastic Hinge Zone Box (Bottom 90px) */}
              <rect x="0" y="250" width="700" height="90" fill="#881337" fillOpacity="0.25" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="4,2" />
              <text x="715" y="295" fill="#f43f5e" fontSize="9" fontWeight="bold">
                PLASTIC HINGE ZONE (hp = {plasticHingeHeightMm}mm)
              </text>
              <text x="715" y="310" fill="#22c55e" fontSize="8">
                Tight Confinement: {hoopDia}mm @ {hoopSpacing}mm c/c
              </text>

              {/* Foundation Starter Dowel Bars */}
              {[20, 60, 100, 600, 640, 680].map((dx, i) => (
                <g key={`fdow2_${i}`}>
                  <line x1={dx} y1="240" x2={dx} y2="375" stroke="#f97316" strokeWidth="3" />
                  <line x1={dx} y1="375" x2={dx + 25} y2="375" stroke="#f97316" strokeWidth="3" />
                </g>
              ))}

              {/* Vertical Longitudinal Bars in Wall */}
              {[20, 60, 100].map((bx, i) => (
                <line key={`vlb_${i}`} x1={bx} y1="8" x2={bx} y2="332" stroke="#f97316" strokeWidth="3.5" />
              ))}
              {[600, 640, 680].map((bx, i) => (
                <line key={`vrb_${i}`} x1={bx} y1="8" x2={bx} y2="332" stroke="#f97316" strokeWidth="3.5" />
              ))}

              {/* Web Vertical Bars */}
              {[160, 220, 280, 340, 400, 460, 520].map((wx, i) => (
                <line key={`wve_${i}`} x1={wx} y1="10" x2={wx} y2="330" stroke="#fb7185" strokeWidth="1.6" strokeDasharray="5,2" />
              ))}

              {/* Plastic Hinge Confining Hoops (Tight Pitch) */}
              {[255, 268, 281, 294, 307, 320, 333].map((hy, i) => (
                <React.Fragment key={`hy_ph_${i}`}>
                  <line x1="8" y1={hy} x2="112" y2={hy} stroke="#22c55e" strokeWidth="2" />
                  <line x1="588" y1={hy} x2="692" y2={hy} stroke="#22c55e" strokeWidth="2" />
                </React.Fragment>
              ))}

              {/* Standard Upper Zone Confining Hoops */}
              {[30, 60, 90, 120, 150, 180, 210, 235].map((hy, i) => (
                <React.Fragment key={`hy_std_${i}`}>
                  <line x1="8" y1={hy} x2="112" y2={hy} stroke="#22c55e" strokeWidth="1.4" />
                  <line x1="588" y1={hy} x2="692" y2={hy} stroke="#22c55e" strokeWidth="1.4" />
                </React.Fragment>
              ))}

              {/* Web Horizontal Stirrups */}
              {[35, 70, 105, 140, 175, 210, 245, 280, 315].map((wy, i) => (
                <line key={`wh_${i}`} x1="12" y1={wy} x2="688" y2={wy} stroke="#38bdf8" strokeWidth="1.3" strokeDasharray="6,3" />
              ))}

              {/* Elevation Height Dimension Hw */}
              <line x1="-45" y1="0" x2="-45" y2="340" stroke="#ef4444" strokeWidth="1.2" markerStart="url(#sw-arrow-start)" markerEnd="url(#sw-arrow)" />
              <line x1="0" y1="0" x2="-50" y2="0" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="340" x2="-50" y2="340" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
              <text x="-58" y="170" fill="#ef4444" fontSize="11" fontWeight="bold" textAnchor="middle" transform="rotate(-90 -58 170)">
                Hw = {Hw_mm} mm ({Hw_m.toFixed(2)} m)
              </text>
            </g>
          </g>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 4: DETAILED TRANSVERSE CROSS-SECTION ONLY                */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'CROSS_SECTION' && (
          <g transform="translate(100, 60)">
            <text x="0" y="0" fill="#38bdf8" fontSize="13" fontWeight="bold">
              HIGH-RESOLUTION TRANSVERSE CROSS-SECTION CUT A-A — SW-{wall.wallId}
            </text>
            <text x="0" y="18" fill="#94a3b8" fontSize="9.5">
              Detailed IS 13920 Seismic Confinement Ties, 135° Hooks, Crossties &amp; Double-Curtain Spacers
            </text>

            <g transform="translate(0, 60)">
              {/* Boundary Zone Magnified Cross-Section */}
              <rect x="0" y="0" width="680" height="220" fill="#0f172a" stroke="#f43f5e" strokeWidth="3" rx="4" />
              <rect x="0" y="0" width="680" height="220" fill="url(#concrete-hatch)" />

              {/* Boundary Zone 1 Outer Hoop */}
              <rect x="25" y="25" width="220" height="170" fill="none" stroke="#22c55e" strokeWidth="3" rx="5" />
              {/* Boundary 1 Longitudinal Bars */}
              {[
                { cx: 45, cy: 45 }, { cx: 100, cy: 45 }, { cx: 165, cy: 45 }, { cx: 225, cy: 45 },
                { cx: 45, cy: 175 }, { cx: 100, cy: 175 }, { cx: 165, cy: 175 }, { cx: 225, cy: 175 },
              ].map((pt, i) => (
                <circle key={`csb1_${i}`} cx={pt.cx} cy={pt.cy} r="9" fill="#f97316" stroke="#ea580c" strokeWidth="2" />
              ))}
              <line x1="100" y1="25" x2="100" y2="195" stroke="#22c55e" strokeWidth="2" />
              <line x1="165" y1="25" x2="165" y2="195" stroke="#22c55e" strokeWidth="2" />

              {/* Web Bars in Section */}
              {[300, 360, 420].map((wx, i) => (
                <React.Fragment key={`csweb_${i}`}>
                  <circle cx={wx} cy="45" r="6" fill="#fb7185" />
                  <circle cx={wx} cy="175" r="6" fill="#fb7185" />
                  <line x1={wx} y1="45" x2={wx} y2="175" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3,3" />
                </React.Fragment>
              ))}

              {/* Boundary Zone 2 Outer Hoop */}
              <rect x="470" y="25" width="185" height="170" fill="none" stroke="#22c55e" strokeWidth="3" rx="5" />
              {[
                { cx: 490, cy: 45 }, { cx: 550, cy: 45 }, { cx: 635, cy: 45 },
                { cx: 490, cy: 175 }, { cx: 550, cy: 175 }, { cx: 635, cy: 175 },
              ].map((pt, i) => (
                <circle key={`csb2_${i}`} cx={pt.cx} cy={pt.cy} r="9" fill="#f97316" stroke="#ea580c" strokeWidth="2" />
              ))}
              <line x1="550" y1="25" x2="550" y2="195" stroke="#22c55e" strokeWidth="2" />

              {/* Callouts */}
              <text x="340" y="260" fill="#f97316" fontSize="11" fontWeight="bold" textAnchor="middle">
                Boundary Longitudinal: {wall.result.boundary.recommendedRebarCallout}
              </text>
              <text x="340" y="280" fill="#22c55e" fontSize="10" textAnchor="middle">
                Seismic Confinement: {hoopDia}mm Closed Hoops @ {hoopSpacing} mm c/c (IS 13920 Cl. 9.4.5)
              </text>
              <text x="340" y="300" fill="#38bdf8" fontSize="10" textAnchor="middle">
                Web Double Curtains: T{webVertDia} @ {webVertSpacing} mm c/c (Vertical &amp; Horizontal)
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
