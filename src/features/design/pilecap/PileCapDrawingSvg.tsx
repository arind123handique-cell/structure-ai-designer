import React from 'react';
import { PileCapDesignOutput } from './pileCapDesignEngine';
import {
  CapOrientation,
  getTruncated3PilePolygonMm,
  get3PileDimensionsMm,
  renderQuarteredPileSvg,
  getSectionRebarPaths,
  getPileOffsetsMm,
  angleToOrientation,
} from './pileCapGeometryUtils';

interface PileCapDrawingSvgProps {
  pileCap: PileCapDesignOutput;
  width?: number;
  height?: number;
  orientation?: CapOrientation;
  dimFontSize?: number;
  showSection?: boolean;
}

export const PileCapDrawingSvg: React.FC<PileCapDrawingSvgProps> = ({
  pileCap,
  width = 860,
  height = 440,
  orientation = 'UP',
  dimFontSize = 1,
  showSection = true,
}) => {
  const L = pileCap.capLength || 1800;
  const B = pileCap.capWidth || 1800;
  const D = pileCap.capDepth || 750;
  const Dp = pileCap.pileDiameter || 500;
  const count = pileCap.pileCount || 4;
  const shape = pileCap.capShape || (count === 3 ? 'TRIANGULAR' : count === 5 ? 'PENTAGONAL' : 'RECTANGULAR');
  const s = pileCap.pileSpacing || 3 * Dp;
  const eo = pileCap.edgeDistance || Dp;
  const pccThk = 150; // 150mm THK PCC Bedding

  const rotDeg = pileCap.rotationAngle || 0;
  const effOrientation: CapOrientation = rotDeg !== 0 ? angleToOrientation(rotDeg) : orientation;

  // Center of Plan View SVG
  const cx = 175;
  const cy = 165;

  // Dynamic Scale
  const maxDim = Math.max(L, B, count === 3 ? s + 2 * eo : 2400);
  const scale = 180 / maxDim;

  // Dimension font size multiplier
  const fs = dimFontSize;

  // Pile Radius in pixels
  const rPilePx = Math.max(12, (Dp / 2) * scale);

  // Column Size in pixels
  const colW = Math.max(24, 450 * scale);
  const colH = Math.max(26, 550 * scale);

  // Scaled Pile Positions in Plan
  const getScaledPileOffsets = () => {
    if (count === 3) {
      const offsets = getPileOffsetsMm(3, s, effOrientation);
      return offsets.map((p) => ({
        px: cx + p.x * scale,
        py: cy - p.y * scale,
      }));
    }

    if (pileCap.pileOffsets && pileCap.pileOffsets.length > 0) {
      return pileCap.pileOffsets.map((p) => ({
        px: cx + p.x * scale,
        py: cy - p.y * scale,
      }));
    }

    const defaultOffsets = getPileOffsetsMm(count, s, effOrientation);
    return defaultOffsets.map((p) => ({
      px: cx + p.x * scale,
      py: cy - p.y * scale,
    }));
  };

  const pilePoints = getScaledPileOffsets();

  // Compute Outer Polygon Points for Plan
  const getCapPolygonPoints = (extraOffsetMm = 0) => {
    if (count === 3 || shape === 'TRIANGULAR') {
      const pts = getTruncated3PilePolygonMm(s, eo, effOrientation, extraOffsetMm);
      return pts.map((p) => `${cx + p.x * scale},${cy - p.y * scale}`).join(' ');
    }

    if (count === 5 || shape === 'PENTAGONAL') {
      const Rp = s / (2 * Math.sin(Math.PI / 5));
      const Rcap = (Rp + eo + extraOffsetMm) * scale;
      const rotRad = (rotDeg * Math.PI) / 180;
      const pts: string[] = [];
      for (let i = 0; i < 5; i++) {
        // In SVG (Y down): -PI/2 is top (North). Clockwise rotation adds rotRad.
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / 5 + rotRad;
        const px = cx + Rcap * Math.cos(angle);
        const py = cy + Rcap * Math.sin(angle);
        pts.push(`${px},${py}`);
      }
      return pts.join(' ');
    }

    // Rectangular / Square (2-pile, 4-pile, 6-pile)
    const isRot90or270 = rotDeg === 90 || rotDeg === 270;
    const baseL = count === 2 ? s + 2 * (eo + extraOffsetMm) : L + 2 * extraOffsetMm;
    const baseB = count === 2 ? Dp + 2 * (eo + extraOffsetMm) : B + 2 * extraOffsetMm;
    const curL = isRot90or270 ? baseB : baseL;
    const curB = isRot90or270 ? baseL : baseB;
    const halfW = (curL / 2) * scale;
    const halfH = (curB / 2) * scale;
    return `${cx - halfW},${cy - halfH} ${cx + halfW},${cy - halfH} ${cx + halfW},${cy + halfH} ${cx - halfW},${cy + halfH}`;
  };

  const capPolygon = getCapPolygonPoints(0);
  const pccPolygon = getCapPolygonPoints(pccThk);
  const rebarPolygon = getCapPolygonPoints(-60); // 60mm clear cover

  // Rebar Callouts
  const botRebarText = pileCap.rebarCalloutX
    ? pileCap.rebarCalloutX.split(' (')[0]
    : `T${pileCap.bottomBarDia || 16}@${pileCap.bottomBarSpacing || 125} C/C (B)`;
  const topRebarText = pileCap.topRebarCallout
    ? pileCap.topRebarCallout.split(' (')[0]
    : `T${pileCap.topBarDia || 12}@${pileCap.topBarSpacing || 150} C/C (T)`;
  const sideRebarText = pileCap.sideFaceRebarCallout
    ? pileCap.sideFaceRebarCallout.split(' (')[0]
    : `${pileCap.numSideLayers || 2}-T${pileCap.sideBarDia || 12}`;

  // 3-pile cap geometric details
  const dims3p = count === 3 ? get3PileDimensionsMm(s, eo) : null;

  // ---------------------------------------------------------------------------
  // SECTION 1-1 GEOMETRY & COORDINATES
  // ---------------------------------------------------------------------------
  const secBaseX = 430;
  const secBaseY = 30;
  const secCapW = Math.max(220, Math.min(320, (count === 3 ? dims3p!.lengthMm : L) * scale * 1.05));
  const secCapH = Math.max(80, Math.min(130, D * scale * 1.25));
  const secCapX = secBaseX + 60;
  const secCapY = secBaseY + 95;

  const secColW = Math.max(36, 450 * scale);
  const secColH = 65;
  const secColX = secCapX + (secCapW - secColW) / 2;
  const secColY = secCapY - secColH;

  // Pile positions in Section cut
  const totalLengthMm = count === 3 ? dims3p!.lengthMm : count === 2 ? s + 2 * eo : L;
  const secScale = secCapW / totalLengthMm;
  const secPile1X = secCapX + eo * secScale;
  const secPile2X = secCapX + (eo + s) * secScale;

  // Rebar Paths for Section
  const rebarPaths = getSectionRebarPaths(
    secCapX,
    secCapY,
    secCapW,
    secCapH,
    14, // scaled cover bottom
    10, // scaled cover top
    12, // scaled cover side
    secColW,
    secColX
  );

  return (
    <div className="flex flex-col items-center bg-white p-4 rounded-xl border border-slate-300 shadow-xl overflow-x-auto font-sans text-slate-800">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between w-full mb-2 px-2 text-xs font-mono font-bold text-slate-700">
        <span className="text-sky-700 flex items-center gap-2">
          <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded border border-sky-300">
            PC-{pileCap.supportNodeId}
          </span>
          <span>
            {count}-PILE {count === 3 ? 'TRUNCATED TRAPEZOIDAL' : shape} PILE CAP ({count === 3 ? `${dims3p!.lengthMm}×${dims3p!.widthMm}×${D}` : `${L}×${B}×${D}`} mm)
          </span>
        </span>
        <span className="text-slate-500 font-normal">
          IS 2911:2010 (Part 1/Sec 2) &amp; SP:34 Architectural Detailing
        </span>
      </div>

      <svg width={width} height={height} viewBox="0 0 860 430" className="select-none text-xs">
        <defs>
          <marker id="tick-45" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
            <line x1="2" y1="8" x2="8" y2="2" stroke="#dc2626" strokeWidth="1.6" />
          </marker>
          <marker id="cad-arrow" viewBox="0 0 12 6" refX="12" refY="3" markerWidth="7" markerHeight="4" orient="auto">
            <path d="M 0 0 L 12 3 L 0 6 z" fill="#dc2626" />
          </marker>
          <marker id="cad-arrow-start" viewBox="0 0 12 6" refX="0" refY="3" markerWidth="7" markerHeight="4" orient="auto">
            <path d="M 12 0 L 0 3 L 12 6 z" fill="#dc2626" />
          </marker>
          <marker id="cad-leader-arrow" viewBox="0 0 10 6" refX="0" refY="3" markerWidth="6" markerHeight="4" orient="auto-start-reverse">
            <polygon points="0 3, 10 0, 10 6" fill="#dc2626" />
          </marker>
        </defs>

        {/* ========================================================================= */}
        {/* 1. PLAN VIEW (LEFT)                                                      */}
        {/* ========================================================================= */}
        <g transform="translate(10, 10)">
          {/* Section Cut Line 1-1 */}
          <line x1="20" y1={cy} x2="330" y2={cy} stroke="#4f46e5" strokeWidth="1.2" strokeDasharray="8,4" />
          <polygon points="20,158 10,165 20,172" fill="#4f46e5" />
          <polygon points="330,158 340,165 330,172" fill="#4f46e5" />
          <circle cx="8" cy="165" r="8" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="1.2" />
          <text x="8" y="168.5" fill="#4f46e5" fontSize={9 * fs} fontWeight="bold" textAnchor="middle">
            1
          </text>
          <circle cx="342" cy="165" r="8" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="1.2" />
          <text x="342" y="168.5" fill="#4f46e5" fontSize={9 * fs} fontWeight="bold" textAnchor="middle">
            1
          </text>

          {/* 1. 150 THK PCC Bedding Boundary (Blue Line) */}
          <polygon points={pccPolygon} fill="none" stroke="#2563eb" strokeWidth="1.5" />

          {/* 2. Cap Concrete Perimeter (Magenta Line) */}
          <polygon points={capPolygon} fill="#fdf4ff" fillOpacity="0.8" stroke="#c026d3" strokeWidth="2.2" strokeLinejoin="round" />

          {/* 3. Rebar Cage Outline (Cyan Dashed) */}
          <polygon points={rebarPolygon} fill="none" stroke="#06b6d4" strokeWidth="1.1" strokeDasharray="3,3" />

          {/* Rebar Grid Lines inside Plan */}
          {[-30, 0, 30].map((dx, i) => (
            <line
              key={`pgx_${i}`}
              x1={cx + dx}
              y1={cy - 50}
              x2={cx + dx}
              y2={cy + 50}
              stroke="#06b6d4"
              strokeWidth="0.8"
              strokeOpacity="0.6"
              strokeDasharray="2,2"
            />
          ))}
          {[-30, 0, 30].map((dy, i) => (
            <line
              key={`pgy_${i}`}
              x1={cx - 50}
              y1={cy + dy}
              x2={cx + 50}
              y2={cy + dy}
              stroke="#06b6d4"
              strokeWidth="0.8"
              strokeOpacity="0.6"
              strokeDasharray="2,2"
            />
          ))}

          {/* 4. Bored Piles in Plan (AUTHENTIC QUARTER-SHADED AutoCAD Symbols) */}
          {pilePoints.map((pt, idx) => {
            const pileSvg = renderQuarteredPileSvg(pt.px, pt.py, rPilePx, '#1d4ed8', '#1e3a8a', 1.4);
            return (
              <g key={`p_sym_${idx}`}>
                {/* Outer white disc with stroke */}
                <circle cx={pt.px} cy={pt.py} r={rPilePx} fill="#ffffff" stroke="#1e3a8a" strokeWidth="1.5" />
                {/* Opposite Shaded Quadrants (Quadrant 1 & Quadrant 3) */}
                <path d={pileSvg.shadedQuadrantPath} fill="#2563eb" stroke="#1e3a8a" strokeWidth="0.8" />
                {/* Crosshairs extending through center */}
                {pileSvg.crosshairs.map((ch, cIdx) => (
                  <line
                    key={`ch_${idx}_${cIdx}`}
                    x1={ch.x1}
                    y1={ch.y1}
                    x2={ch.x2}
                    y2={ch.y2}
                    stroke="#1e3a8a"
                    strokeWidth="1.0"
                  />
                ))}
              </g>
            );
          })}

          {/* 5. Center Column Pedestal (Golden Brown with Yellow Border & Centerlines) */}
          <rect
            x={cx - colW / 2}
            y={cy - colH / 2}
            width={colW}
            height={colH}
            fill="#ca8a04"
            fillOpacity="0.8"
            stroke="#eab308"
            strokeWidth="1.6"
          />
          {/* Column Center Crosshairs */}
          <line x1={cx - colW / 2 - 8} y1={cy} x2={cx + colW / 2 + 8} y2={cy} stroke="#ca8a04" strokeWidth="0.8" strokeDasharray="3,2" />
          <line x1={cx} y1={cy - colH / 2 - 8} x2={cx} y2={cy + colH / 2 + 8} stroke="#ca8a04" strokeWidth="0.8" strokeDasharray="3,2" />
          <text x={cx} y={cy + 3.5} fill="#fef08a" fontSize={8 * fs} fontWeight="bold" textAnchor="middle">
            COL
          </text>

          {/* ======================================================================= */}
          {/* PLAN VIEW MULTI-TIERED RED CAD DIMENSION CHAINS                        */}
          {/* ======================================================================= */}
          {count === 3 && dims3p ? (
            <g>
              {/* 1. Top Flat Apex Width: 2 * eo (e.g. 900) */}
              {(() => {
                const topY = cy - (dims3p.RpMm + eo) * scale - 20;
                const x1 = cx - eo * scale;
                const x2 = cx + eo * scale;
                const yEdge = cy - (dims3p.RpMm + eo) * scale;
                return (
                  <g>
                    <line x1={x1} y1={yEdge} x2={x1} y2={topY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={x2} y1={yEdge} x2={x2} y2={topY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={x1} y1={topY} x2={x2} y2={topY} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <rect x={cx - 16} y={topY - 7} width={32} height={10} fill="#ffffff" rx="2" />
                    <text x={cx} y={topY} fill="#dc2626" fontSize={8 * fs} fontWeight="bold" textAnchor="middle">
                      {dims3p.apexWidthMm}
                    </text>
                  </g>
                );
              })()}

              {/* 2. Bottom Base Spacing Chain: eo | s | eo and Overall Base Width */}
              {(() => {
                const btmDimY1 = cy + (dims3p.halfRpMm + eo) * scale + 20;
                const btmDimY2 = cy + (dims3p.halfRpMm + eo) * scale + 38;
                const halfBaseW = (dims3p.lengthMm / 2) * scale;
                const xLeft = cx - halfBaseW;
                const xP1 = cx - (s / 2) * scale;
                const xP2 = cx + (s / 2) * scale;
                const xRight = cx + halfBaseW;
                const yEdge = cy + (dims3p.halfRpMm + eo) * scale;

                return (
                  <g>
                    {/* Extension lines */}
                    <line x1={xLeft} y1={yEdge} x2={xLeft} y2={btmDimY2 + 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={xP1} y1={yEdge - eo * scale} x2={xP1} y2={btmDimY1 + 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={xP2} y1={yEdge - eo * scale} x2={xP2} y2={btmDimY1 + 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={xRight} y1={yEdge} x2={xRight} y2={btmDimY2 + 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />

                    {/* Tier 1: eo | s | eo */}
                    <line x1={xLeft} y1={btmDimY1} x2={xP1} y2={btmDimY1} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <text x={(xLeft + xP1) / 2} y={btmDimY1 - 2} fill="#dc2626" fontSize={7 * fs} fontWeight="bold" textAnchor="middle">
                      {Math.round(eo)}
                    </text>

                    <line x1={xP1} y1={btmDimY1} x2={xP2} y2={btmDimY1} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <text x={cx} y={btmDimY1 - 2} fill="#dc2626" fontSize={7.5 * fs} fontWeight="bold" textAnchor="middle">
                      {s}
                    </text>

                    <line x1={xP2} y1={btmDimY1} x2={xRight} y2={btmDimY1} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <text x={(xP2 + xRight) / 2} y={btmDimY1 - 2} fill="#dc2626" fontSize={7 * fs} fontWeight="bold" textAnchor="middle">
                      {Math.round(eo)}
                    </text>

                    {/* Tier 2: Overall Base Width (dims3p.lengthMm) */}
                    <line x1={xLeft} y1={btmDimY2} x2={xRight} y2={btmDimY2} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <rect x={cx - 18} y={btmDimY2 - 6} width={36} height={10} fill="#ffffff" rx="2" />
                    <text x={cx} y={btmDimY2 + 1.5} fill="#dc2626" fontSize={8 * fs} fontWeight="bold" textAnchor="middle">
                      {dims3p.lengthMm}
                    </text>
                  </g>
                );
              })()}

              {/* 3. Right Vertical Dimension Chain: Top to Apex Pile (eo) | Apex to Col (Rp) | Col to Base (Rp/2) | Base to Bottom (eo) */}
              {(() => {
                const dimX = cx + (dims3p.lengthMm / 2) * scale + 24;
                const yTop = cy - (dims3p.RpMm + eo) * scale;
                const yP_apex = cy - dims3p.RpMm * scale;
                const yCol = cy;
                const yP_base = cy + dims3p.halfRpMm * scale;
                const yBtm = cy + (dims3p.halfRpMm + eo) * scale;

                return (
                  <g>
                    {/* Horizontal Extension Lines */}
                    <line x1={cx + eo * scale} y1={yTop} x2={dimX + 24} y2={yTop} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={cx} y1={yP_apex} x2={dimX + 4} y2={yP_apex} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={cx} y1={yCol} x2={dimX + 4} y2={yCol} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={cx + (s / 2) * scale} y1={yP_base} x2={dimX + 4} y2={yP_base} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={cx + (dims3p.lengthMm / 2) * scale} y1={yBtm} x2={dimX + 24} y2={yBtm} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />

                    {/* Chain 1: yTop -> yP_apex (eo) */}
                    <line x1={dimX} y1={yTop} x2={dimX} y2={yP_apex} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <text x={dimX + 4} y={(yTop + yP_apex) / 2 + 2.5} fill="#dc2626" fontSize={6.5 * fs} fontWeight="bold">
                      {Math.round(eo)}
                    </text>

                    {/* Chain 2: yP_apex -> yCol (Rp) */}
                    <line x1={dimX} y1={yP_apex} x2={dimX} y2={yCol} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <text x={dimX + 4} y={(yP_apex + yCol) / 2 + 2.5} fill="#dc2626" fontSize={6.5 * fs} fontWeight="bold">
                      {dims3p.RpMm}
                    </text>

                    {/* Chain 3: yCol -> yP_base (halfRp) */}
                    <line x1={dimX} y1={yCol} x2={dimX} y2={yP_base} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <text x={dimX + 4} y={(yCol + yP_base) / 2 + 2.5} fill="#dc2626" fontSize={6.5 * fs} fontWeight="bold">
                      {dims3p.halfRpMm}
                    </text>

                    {/* Chain 4: yP_base -> yBtm (eo) */}
                    <line x1={dimX} y1={yP_base} x2={dimX} y2={yBtm} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <text x={dimX + 4} y={(yP_base + yBtm) / 2 + 2.5} fill="#dc2626" fontSize={6.5 * fs} fontWeight="bold">
                      {Math.round(eo)}
                    </text>

                    {/* Overall Height (dims3p.widthMm) */}
                    <line x1={dimX + 18} y1={yTop} x2={dimX + 18} y2={yBtm} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <rect x={dimX + 13} y={cy - 6} width={26} height={10} fill="#ffffff" rx="2" />
                    <text x={dimX + 22} y={cy + 2} fill="#dc2626" fontSize={8 * fs} fontWeight="bold">
                      {dims3p.widthMm}
                    </text>
                  </g>
                );
              })()}

              {/* 4. Diagonal Chamfer Dimension along Slanted Edge (e.g. 1851) */}
              <text
                x={cx - (dims3p.lengthMm / 4) * scale - 22}
                y={cy - 12}
                fill="#dc2626"
fontSize={7.5 * fs}
                fontWeight="bold"
                transform={`rotate(-56 ${cx - (dims3p.lengthMm / 4) * scale - 22} ${cy - 12})`}
              >
                {dims3p.diagonalChamferMm}
              </text>
            </g>
          ) : (
            /* Rectangular 2-Pile / 4-Pile / 6-Pile Dimensions */
            <g>
              {/* Top Width Dimension: L */}
              {(() => {
                const isRot90or270 = rotDeg === 90 || rotDeg === 270;
                const effL = isRot90or270 ? B : L;
                const effB = isRot90or270 ? L : B;
                const topY = cy - (effB / 2) * scale - 22;
                const x1 = cx - (effL / 2) * scale;
                const x2 = cx + (effL / 2) * scale;
                const yEdge = cy - (effB / 2) * scale;
                return (
                  <g>
                    <line x1={x1} y1={yEdge} x2={x1} y2={topY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={x2} y1={yEdge} x2={x2} y2={topY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={x1} y1={topY} x2={x2} y2={topY} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <rect x={cx - 18} y={topY - 7} width={36} height={10} fill="#ffffff" rx="2" />
                    <text x={cx} y={topY} fill="#dc2626" fontSize={8.5 * fs} fontWeight="bold" textAnchor="middle">
                      {effL}
                    </text>
                  </g>
                );
              })()}

              {/* Right Height Dimension: B */}
              {(() => {
                const isRot90or270 = rotDeg === 90 || rotDeg === 270;
                const effL = isRot90or270 ? B : L;
                const effB = isRot90or270 ? L : B;
                const rightX = cx + (effL / 2) * scale + 24;
                const y1 = cy - (effB / 2) * scale;
                const y2 = cy + (effB / 2) * scale;
                const xEdge = cx + (effL / 2) * scale;
                return (
                  <g>
                    <line x1={xEdge} y1={y1} x2={rightX + 4} y2={y1} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={xEdge} y1={y2} x2={rightX + 4} y2={y2} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={rightX} y1={y1} x2={rightX} y2={y2} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <rect x={rightX - 16} y={cy - 5} width={32} height={10} fill="#ffffff" rx="2" />
                    <text x={rightX} y={cy + 2.5} fill="#dc2626" fontSize={8.5 * fs} fontWeight="bold" textAnchor="middle">
                      {effB}
                    </text>
                  </g>
                );
              })()}

              {/* Bottom Internal Spacing Chain: eo | s | eo */}
              {(() => {
                const isRot90or270 = rotDeg === 90 || rotDeg === 270;
                const effL = isRot90or270 ? B : L;
                const effB = isRot90or270 ? L : B;
                const btmY = cy + (effB / 2) * scale + 20;
                const x1 = cx - (effL / 2) * scale;
                const xP1 = cx - (s / 2) * scale;
                const xP2 = cx + (s / 2) * scale;
                const x2 = cx + (effL / 2) * scale;
                return (
                  <g>
                    <line x1={x1} y1={btmY} x2={xP1} y2={btmY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <text x={(x1 + xP1) / 2} y={btmY - 2} fill="#dc2626" fontSize={7 * fs} fontWeight="bold" textAnchor="middle">
                      {Math.round(eo)}
                    </text>
                    <line x1={xP1} y1={btmY} x2={xP2} y2={btmY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <text x={cx} y={btmY - 2} fill="#dc2626" fontSize={7.5 * fs} fontWeight="bold" textAnchor="middle">
                      {s}
                    </text>
                    <line x1={xP2} y1={btmY} x2={x2} y2={btmY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                    <text x={(xP2 + x2) / 2} y={btmY - 2} fill="#dc2626" fontSize={7 * fs} fontWeight="bold" textAnchor="middle">
                      {Math.round(eo)}
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Plan View Leader Callouts */}
          <line x1={cx + 30} y1={cy + 35} x2="300" y2="300" stroke="#dc2626" strokeWidth="0.8" />
          <line x1="300" y1="300" x2="335" y2="300" stroke="#dc2626" strokeWidth="0.8" />
          <text x="302" y="295" fill="#dc2626" fontSize={8 * fs} fontWeight="bold">
            {topRebarText}
          </text>
          <text x="302" y="310" fill="#dc2626" fontSize={8 * fs} fontWeight="bold">
            {botRebarText}
          </text>

          {/* 150 THK PCC Callout */}
          <line x1={cx - 55} y1={cy - 20} x2="35" y2="35" stroke="#dc2626" strokeWidth="0.8" />
          <line x1="35" y1="35" x2="10" y2="35" stroke="#dc2626" strokeWidth="0.8" />
          <text x="10" y="30" fill="#dc2626" fontSize={8 * fs} fontWeight="bold">
            150THK PCC
          </text>

          {/* Plan View Title */}
          <text x={cx} y="375" fill="#0284c7" fontSize={11 * fs} fontWeight="bold" textAnchor="middle">
            PILE CAP PC{pileCap.supportNodeId} - PLAN{rotDeg !== 0 ? ` (${rotDeg}°)` : ''}
          </text>
          <text x={cx} y="390" fill="#0284c7" fontSize={8.5 * fs} textAnchor="middle">
            (SCALE 1:50)
          </text>
        </g>

        {/* ========================================================================= */}
        {/* 2. SECTION 1-1 ELEVATION (RIGHT)                                          */}
        {/* ========================================================================= */}
        <g transform="translate(10, 10)">
          {/* 1. Column Stub Extending Above Cap */}
          <rect
            x={secColX}
            y={secColY}
            width={secColW}
            height={secColH}
            fill="#ffffff"
            stroke="#eab308"
            strokeWidth="1.6"
          />

          {/* Column Longitudinal Starter Bars hooking 90 deg into cap */}
          <path d={rebarPaths.columnStarterPaths[0]} fill="none" stroke="#06b6d4" strokeWidth="2.0" />
          <path d={rebarPaths.columnStarterPaths[1]} fill="none" stroke="#06b6d4" strokeWidth="2.0" />

          {/* Column Confinement Ties / Hoops */}
          {[secColY + 12, secColY + 28, secColY + 44, secColY + 60].map((ly, i) => (
            <line key={`clk_${i}`} x1={secColX} y1={ly} x2={secColX + secColW} y2={ly} stroke="#dc2626" strokeWidth="1.2" />
          ))}
          <text x={secColX + secColW / 2} y={secColY + 22} fill="#dc2626" fontSize={6.5 * fs} fontWeight="bold" textAnchor="middle">
            LINKS
          </text>

          {/* 2. Concrete Cap Body (Magenta Outline) */}
          <rect
            x={secCapX}
            y={secCapY}
            width={secCapW}
            height={secCapH}
            fill="#fdf4ff"
            fillOpacity="0.8"
            stroke="#c026d3"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* 3. 150 THK PCC Bedding Layer (Brown Solid) */}
          <rect
            x={secCapX - 12}
            y={secCapY + secCapH}
            width={secCapW + 24}
            height={14}
            fill="#b45309"
            fillOpacity="0.85"
            stroke="#78350f"
            strokeWidth="1.2"
          />

          {/* 4. Bored Concrete Piles Shafts Entering Cap by 50mm */}
          {/* Pile 1 */}
          <rect
            x={secPile1X - rPilePx}
            y={secCapY + secCapH - 6}
            width={rPilePx * 2}
            height={68}
            fill="#f0fdf4"
            stroke="#16a34a"
            strokeWidth="1.8"
          />
          {/* Pile 1 Starter Dowels into Cap */}
          <line x1={secPile1X - rPilePx + 4} y1={secCapY + secCapH - 35} x2={secPile1X - rPilePx + 4} y2={secCapY + secCapH + 55} stroke="#16a34a" strokeWidth="1.8" />
          <line x1={secPile1X + rPilePx - 4} y1={secCapY + secCapH - 35} x2={secPile1X + rPilePx - 4} y2={secCapY + secCapH + 55} stroke="#16a34a" strokeWidth="1.8" />

          {/* Pile 2 */}
          <rect
            x={secPile2X - rPilePx}
            y={secCapY + secCapH - 6}
            width={rPilePx * 2}
            height={68}
            fill="#f0fdf4"
            stroke="#16a34a"
            strokeWidth="1.8"
          />
          {/* Pile 2 Starter Dowels into Cap */}
          <line x1={secPile2X - rPilePx + 4} y1={secCapY + secCapH - 35} x2={secPile2X - rPilePx + 4} y2={secCapY + secCapH + 55} stroke="#16a34a" strokeWidth="1.8" />
          <line x1={secPile2X + rPilePx - 4} y1={secCapY + secCapH - 35} x2={secPile2X + rPilePx - 4} y2={secCapY + secCapH + 55} stroke="#16a34a" strokeWidth="1.8" />

          {/* Center Pile if 5-Pile Cap */}
          {count === 5 && (
            <>
              <rect
                x={secCapX + secCapW / 2 - rPilePx}
                y={secCapY + secCapH - 6}
                width={rPilePx * 2}
                height={68}
                fill="#f0fdf4"
                stroke="#16a34a"
                strokeWidth="1.8"
              />
              <line x1={secCapX + secCapW / 2 - rPilePx + 4} y1={secCapY + secCapH - 35} x2={secCapX + secCapW / 2 - rPilePx + 4} y2={secCapY + secCapH + 55} stroke="#16a34a" strokeWidth="1.8" />
              <line x1={secCapX + secCapW / 2 + rPilePx - 4} y1={secCapY + secCapH - 35} x2={secCapX + secCapW / 2 + rPilePx - 4} y2={secCapY + secCapH + 55} stroke="#16a34a" strokeWidth="1.8" />
            </>
          )}

          {/* 5. Bottom Main Flexural Rebar Mat (90 deg Upward Hooks) */}
          <path d={rebarPaths.bottomMatPath} fill="none" stroke="#dc2626" strokeWidth="2.6" strokeLinejoin="round" />

          {/* 6. Top Shrinkage Rebar Mat (90 deg Downward Hooks) */}
          <path d={rebarPaths.topMatPath} fill="none" stroke="#06b6d4" strokeWidth="1.8" strokeLinejoin="round" />

          {/* 7. Side Face Ties (Green Circles & Dashed Lines) */}
          {rebarPaths.sideTiePoints.map((pt, i) => (
            <circle key={`spt_${i}`} cx={pt.x} cy={pt.y} r="3.2" fill="#16a34a" stroke="#15803d" strokeWidth="0.8" />
          ))}
          <line
            x1={secCapX + 12}
            y1={secCapY + secCapH * 0.35}
            x2={secCapX + secCapW - 12}
            y2={secCapY + secCapH * 0.35}
            stroke="#16a34a"
            strokeWidth="0.8"
            strokeDasharray="3,3"
          />
          <line
            x1={secCapX + 12}
            y1={secCapY + secCapH * 0.65}
            x2={secCapX + secCapW - 12}
            y2={secCapY + secCapH * 0.65}
            stroke="#16a34a"
            strokeWidth="0.8"
            strokeDasharray="3,3"
          />

          {/* ======================================================================= */}
          {/* SECTION ELEVATION CAD DIMENSIONS                                        */}
          {/* ======================================================================= */}
          {/* Top Width Dimension above Column: L */}
          {(() => {
            const topDimY = secColY - 14;
            return (
              <g>
                <line x1={secCapX} y1={secCapY} x2={secCapX} y2={topDimY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                <line x1={secCapX + secCapW} y1={secCapY} x2={secCapX + secCapW} y2={topDimY - 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                <line x1={secCapX} y1={topDimY} x2={secCapX + secCapW} y2={topDimY} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                <rect x={secCapX + secCapW / 2 - 18} y={topDimY - 7} width={36} height={10} fill="#ffffff" rx="2" />
                <text x={secCapX + secCapW / 2} y={topDimY} fill="#dc2626" fontSize={8.5 * fs} fontWeight="bold" textAnchor="middle">
                  {count === 3 && dims3p ? dims3p.lengthMm : L}
                </text>
              </g>
            );
          })()}

          {/* Right Cap Depth Dimension: D */}
          {(() => {
            const rDimX = secCapX + secCapW + 26;
            return (
              <g>
                <line x1={secCapX + secCapW} y1={secCapY} x2={rDimX + 4} y2={secCapY} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                <line x1={secCapX + secCapW} y1={secCapY + secCapH} x2={rDimX + 4} y2={secCapY + secCapH} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                <line x1={rDimX} y1={secCapY} x2={rDimX} y2={secCapY + secCapH} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                <rect x={rDimX - 4} y={secCapY + secCapH / 2 - 5} width={28} height={10} fill="#ffffff" rx="2" />
                <text x={rDimX + 10} y={secCapY + secCapH / 2 + 3} fill="#dc2626" fontSize={8.5 * fs} fontWeight="bold">
                  {D}
                </text>
              </g>
            );
          })()}

          {/* Bottom Spacing Dimension Chain: eo | s | eo */}
          {(() => {
            const btmDimY = secCapY + secCapH + 52;
            return (
              <g>
                {/* Extension lines */}
                <line x1={secCapX} y1={secCapY + secCapH + 14} x2={secCapX} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                <line x1={secPile1X} y1={secCapY + secCapH + 62} x2={secPile1X} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                <line x1={secPile2X} y1={secCapY + secCapH + 62} x2={secPile2X} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
                <line x1={secCapX + secCapW} y1={secCapY + secCapH + 14} x2={secCapX + secCapW} y2={btmDimY + 4} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />

                {/* Left Overhang: eo */}
                <line x1={secCapX} y1={btmDimY} x2={secPile1X} y2={btmDimY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                <text x={(secCapX + secPile1X) / 2} y={btmDimY - 2} fill="#dc2626" fontSize={7 * fs} fontWeight="bold" textAnchor="middle">
                  {Math.round(eo)}
                </text>

                {/* Pile Spacing: s */}
                <line x1={secPile1X} y1={btmDimY} x2={secPile2X} y2={btmDimY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                <text x={(secPile1X + secPile2X) / 2} y={btmDimY - 2} fill="#dc2626" fontSize={7.5 * fs} fontWeight="bold" textAnchor="middle">
                  {s}
                </text>

                {/* Right Overhang: eo */}
                <line x1={secPile2X} y1={btmDimY} x2={secCapX + secCapW} y2={btmDimY} stroke="#dc2626" strokeWidth="0.8" markerStart="url(#cad-arrow-start)" markerEnd="url(#cad-arrow)" />
                <text x={(secPile2X + secCapX + secCapW) / 2} y={btmDimY - 2} fill="#dc2626" fontSize={7 * fs} fontWeight="bold" textAnchor="middle">
                  {Math.round(eo)}
                </text>
              </g>
            );
          })()}

          {/* Clear cover and Embedment annotations */}
          <line x1={secCapX + 16} y1={secCapY + secCapH - 14} x2={secCapX + 16} y2={secCapY + secCapH} stroke="#dc2626" strokeWidth="0.7" />
          <text x={secCapX + 12} y={secCapY + secCapH - 4} fill="#dc2626" fontSize={6.5 * fs} fontWeight="bold" textAnchor="end">
            60 COVER
          </text>

          <line x1={secPile1X - rPilePx - 6} y1={secCapY + secCapH} x2={secPile1X - rPilePx - 6} y2={secCapY + secCapH - 6} stroke="#dc2626" strokeWidth="0.7" />
          <text x={secPile1X - rPilePx - 8} y={secCapY + secCapH - 1} fill="#dc2626" fontSize={6.5 * fs} fontWeight="bold" textAnchor="end">
            50 EMBED
          </text>

          {/* Leaders with Callouts */}
          {/* Top Mat */}
          <line x1={secCapX + secCapW - 12} y1={secCapY + 10} x2={secCapX + secCapW + 45} y2={secCapY - 20} stroke="#dc2626" strokeWidth="0.8" />
          <line x1={secCapX + secCapW + 45} y1={secCapY - 20} x2={secCapX + secCapW + 85} y2={secCapY - 20} stroke="#dc2626" strokeWidth="0.8" />
          <text x={secCapX + secCapW + 88} y={secCapY - 23} fill="#dc2626" fontSize={8 * fs} fontWeight="bold">
            {topRebarText}
          </text>

          {/* Bottom Mat */}
          <line x1={secCapX + secCapW - 12} y1={secCapY + secCapH - 14} x2={secCapX + secCapW + 45} y2={secCapY + secCapH + 15} stroke="#dc2626" strokeWidth="0.8" />
          <line x1={secCapX + secCapW + 45} y1={secCapY + secCapH + 15} x2={secCapX + secCapW + 85} y2={secCapY + secCapH + 15} stroke="#dc2626" strokeWidth="0.8" />
          <text x={secCapX + secCapW + 88} y={secCapY + secCapH + 12} fill="#dc2626" fontSize={8 * fs} fontWeight="bold">
            {botRebarText}
          </text>

          {/* Side Ties */}
          <line x1={secCapX + 12} y1={secCapY + secCapH * 0.35} x2={secCapX - 35} y2={secCapY + 25} stroke="#dc2626" strokeWidth="0.8" />
          <line x1={secCapX - 35} y1={secCapY + 25} x2={secCapX - 70} y2={secCapY + 25} stroke="#dc2626" strokeWidth="0.8" />
          <text x={secCapX - 72} y={secCapY + 22} fill="#dc2626" fontSize={8 * fs} fontWeight="bold" textAnchor="end">
            {sideRebarText}
          </text>

          {/* Pile Diameter */}
          <line x1={secPile1X} y1={secCapY + secCapH + 50} x2={secCapX - 25} y2={secCapY + secCapH + 75} stroke="#dc2626" strokeWidth="0.8" />
          <line x1={secCapX - 25} y1={secCapY + secCapH + 75} x2={secCapX - 70} y2={secCapY + secCapH + 75} stroke="#dc2626" strokeWidth="0.8" />
          <text x={secCapX - 72} y={secCapY + secCapH + 72} fill="#dc2626" fontSize={8 * fs} fontWeight="bold" textAnchor="end">
            {Dp} Ø BORED PILE
          </text>

          {/* Section Title */}
          <text x={secCapX + secCapW / 2} y="375" fill="#0284c7" fontSize={11 * fs} fontWeight="bold" textAnchor="middle">
            SECTION 1-1
          </text>
          <text x={secCapX + secCapW / 2} y="390" fill="#0284c7" fontSize={8.5 * fs} fontWeight="bold" textAnchor="middle">
            DETAIL OF PC{pileCap.supportNodeId} (SCALE 1:50)
          </text>
        </g>
      </svg>
    </div>
  );
};
