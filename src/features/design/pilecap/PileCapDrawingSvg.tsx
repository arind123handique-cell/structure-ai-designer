import React from 'react';
import { PileCapDesignOutput } from './pileCapDesignEngine';

interface PileCapDrawingSvgProps {
  pileCap: PileCapDesignOutput;
  width?: number;
  height?: number;
}

export const PileCapDrawingSvg: React.FC<PileCapDrawingSvgProps> = ({
  pileCap,
  width = 820,
  height = 420,
}) => {
  const L = pileCap.capLength;
  const B = pileCap.capWidth;
  const D = pileCap.capDepth;
  const Dp = pileCap.pileDiameter;
  const count = pileCap.pileCount;
  const shape = pileCap.capShape || (count === 3 ? 'TRIANGULAR' : count === 5 ? 'PENTAGONAL' : 'RECTANGULAR');
  const s = pileCap.pileSpacing || 3 * Dp;
  const eo = pileCap.edgeDistance || Dp;
  const pccThk = 150; // 150mm THK PCC Bedding

  // Center of Plan View SVG
  const cx = 155;
  const cy = 155;

  // Dynamic Scale
  const maxDim = Math.max(L, B, 2600);
  const scale = 175 / maxDim;

  // Pile Radius in pixels
  const rPilePx = Math.max(12, (Dp / 2) * scale);

  // Column Size in pixels
  const colW = Math.max(22, 450 * scale);
  const colH = Math.max(26, 550 * scale);

  // Scaled Pile Positions
  const getScaledPileOffsets = () => {
    if (pileCap.pileOffsets && pileCap.pileOffsets.length > 0) {
      return pileCap.pileOffsets.map((p) => ({
        px: cx + p.x * scale,
        py: cy - p.y * scale,
      }));
    }

    if (count === 3) {
      const Rp = s / Math.sqrt(3);
      return [
        { px: cx, py: cy - Rp * scale },
        { px: cx - (s / 2) * scale, py: cy + (Rp / 2) * scale },
        { px: cx + (s / 2) * scale, py: cy + (Rp / 2) * scale },
      ];
    } else if (count === 5) {
      const Rp = s / (2 * Math.sin(Math.PI / 5));
      const cos18 = Math.cos(Math.PI / 10);
      const sin18 = Math.sin(Math.PI / 10);
      const sin36 = Math.sin(Math.PI / 5);
      const cos36 = Math.cos(Math.PI / 5);
      return [
        { px: cx, py: cy - Rp * scale },
        { px: cx - Rp * cos18 * scale, py: cy - Rp * sin18 * scale },
        { px: cx - Rp * sin36 * scale, py: cy + Rp * cos36 * scale },
        { px: cx + Rp * sin36 * scale, py: cy + Rp * cos36 * scale },
        { px: cx + Rp * cos18 * scale, py: cy - Rp * sin18 * scale },
      ];
    } else if (count === 2) {
      return [
        { px: cx - (s / 2) * scale, py: cy },
        { px: cx + (s / 2) * scale, py: cy },
      ];
    } else if (count === 4) {
      return [
        { px: cx - (s / 2) * scale, py: cy - (s / 2) * scale },
        { px: cx + (s / 2) * scale, py: cy - (s / 2) * scale },
        { px: cx - (s / 2) * scale, py: cy + (s / 2) * scale },
        { px: cx + (s / 2) * scale, py: cy + (s / 2) * scale },
      ];
    } else {
      return [
        { px: cx - s * scale, py: cy - (s / 2) * scale },
        { px: cx, py: cy - (s / 2) * scale },
        { px: cx + s * scale, py: cy - (s / 2) * scale },
        { px: cx - s * scale, py: cy + (s / 2) * scale },
        { px: cx, py: cy + (s / 2) * scale },
        { px: cx + s * scale, py: cy + (s / 2) * scale },
      ];
    }
  };

  const pilePoints = getScaledPileOffsets();

  // Compute Outer Polygon Points (offsetFactor: 1.0 for Cap, >1.0 for PCC, <1.0 for Rebar Cage)
  const getCapPolygonPoints = (extraOffsetMm: number = 0) => {
    if (shape === 'TRIANGULAR') {
      const Rp = s / Math.sqrt(3);
      const curEo = eo + extraOffsetMm;
      const topY = cy - (Rp + curEo * 1.155) * scale;
      const btmY = cy + (Rp / 2 + curEo) * scale;
      const halfB = (s / 2 + curEo * 1.155) * scale;
      return `${cx},${topY} ${cx - halfB},${btmY} ${cx + halfB},${btmY}`;
    }

    if (shape === 'PENTAGONAL') {
      const Rp = s / (2 * Math.sin(Math.PI / 5));
      const Rcap = (Rp + eo + extraOffsetMm) * scale;
      const cos18 = Math.cos(Math.PI / 10);
      const sin18 = Math.sin(Math.PI / 10);
      const sin36 = Math.sin(Math.PI / 5);
      const cos36 = Math.cos(Math.PI / 5);

      const p1 = `${cx},${cy - Rcap}`;
      const p2 = `${cx - Rcap * cos18},${cy - Rcap * sin18}`;
      const p3 = `${cx - Rcap * sin36},${cy + Rcap * cos36}`;
      const p4 = `${cx + Rcap * sin36},${cy + Rcap * cos36}`;
      const p5 = `${cx + Rcap * cos18},${cy - Rcap * sin18}`;
      return `${p1} ${p2} ${p3} ${p4} ${p5}`;
    }

    const halfW = ((L + 2 * extraOffsetMm) / 2) * scale;
    const halfH = ((B + 2 * extraOffsetMm) / 2) * scale;
    return `${cx - halfW},${cy - halfH} ${cx + halfW},${cy - halfH} ${cx + halfW},${cy + halfH} ${cx - halfW},${cy + halfH}`;
  };

  const capPolygon = getCapPolygonPoints(0);
  const pccPolygon = getCapPolygonPoints(pccThk);
  const rebarPolygon = getCapPolygonPoints(-60); // 60mm clear cover

  const botRebarText = pileCap.rebarCalloutX ? pileCap.rebarCalloutX.split(' (')[0] : 'T16@150 C/C (B)';
  const topRebarText = pileCap.topRebarCallout ? pileCap.topRebarCallout.split(' (')[0] : 'T12@100 C/C (T)';
  const sideRebarText = '3-T10';

  return (
    <div className="flex flex-col items-center bg-white p-4 rounded-lg border border-slate-300 shadow-xl overflow-x-auto font-sans text-slate-800">
      {/* Top Title Bar */}
      <div className="flex items-center justify-between w-full mb-1 px-2 text-xs font-mono font-bold text-slate-700">
        <span className="text-sky-700">
          PILE CAP PC-{pileCap.supportNodeId} ({count}-PILE {shape}) — CAD DETAILING
        </span>
        <span className="text-slate-500 font-normal">IS 2911 (Part 1/Sec 2) &amp; SP:34 Standard</span>
      </div>

      <svg width={width} height={height} viewBox="0 0 820 400" className="select-none text-xs">
        {/* Definitions for Markers */}
        <defs>
          <marker id="tick-45" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
            <line x1="2" y1="8" x2="8" y2="2" stroke="#dc2626" strokeWidth="1.5" />
          </marker>
          <marker id="tick-45-slate" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
            <line x1="2" y1="8" x2="8" y2="2" stroke="#64748b" strokeWidth="1.5" />
          </marker>
        </defs>

        {/* ------------------------------------------------------------------------- */}
        {/* 1. PLAN VIEW (LEFT)                                                      */}
        {/* ------------------------------------------------------------------------- */}
        <g transform="translate(15, 10)">
          {/* Section Cut Line 1-1 / 2-2 */}
          <line x1="20" y1={cy} x2="290" y2={cy} stroke="#6366f1" strokeWidth="0.9" strokeDasharray="6,3" />
          <polygon points="20,150 10,155 20,160" fill="#4f46e5" />
          <polygon points="290,150 300,155 290,160" fill="#4f46e5" />
          <text x="8" y="145" fill="#4f46e5" fontSize="10" fontWeight="bold">
            1
          </text>
          <text x="302" y="145" fill="#4f46e5" fontSize="10" fontWeight="bold">
            1
          </text>

          {/* 1. 150 THK PCC Bedding Boundary (Blue Line) */}
          <polygon points={pccPolygon} fill="none" stroke="#2563eb" strokeWidth="1.4" />

          {/* 2. Cap Concrete Perimeter (Magenta Line) */}
          <polygon points={capPolygon} fill="#fdf4ff" fillOpacity="0.6" stroke="#c026d3" strokeWidth="2.0" />

          {/* 3. Rebar Cage Outline / Mesh (Cyan Line) */}
          <polygon points={rebarPolygon} fill="none" stroke="#06b6d4" strokeWidth="1.2" strokeDasharray="3,3" />

          {/* Internal Rebar Grid Mesh */}
          {[-45, -15, 15, 45].map((dx, i) => (
            <line
              key={`rx_${i}`}
              x1={cx + dx}
              y1={cy - (B / 2.4) * scale}
              x2={cx + dx}
              y2={cy + (B / 2.4) * scale}
              stroke="#06b6d4"
              strokeWidth="0.9"
              strokeOpacity="0.75"
            />
          ))}
          {[-45, -15, 15, 45].map((dy, i) => (
            <line
              key={`ry_${i}`}
              x1={cx - (L / 2.4) * scale}
              y1={cy + dy}
              x2={cx + (L / 2.4) * scale}
              y2={cy + dy}
              stroke="#06b6d4"
              strokeWidth="0.9"
              strokeOpacity="0.75"
            />
          ))}

          {/* 4. Bored Piles in Plan View (Bright Green Circles with Center Cross) */}
          {pilePoints.map((pt, idx) => (
            <g key={`pile_${idx}`}>
              <circle cx={pt.px} cy={pt.py} r={rPilePx} fill="#f0fdf4" stroke="#16a34a" strokeWidth="1.8" />
              <line x1={pt.px - rPilePx - 2} y1={pt.py} x2={pt.px + rPilePx + 2} y2={pt.py} stroke="#16a34a" strokeWidth="0.8" strokeDasharray="2,2" />
              <line x1={pt.px} y1={pt.py - rPilePx - 2} x2={pt.px} y2={pt.py + rPilePx + 2} stroke="#16a34a" strokeWidth="0.8" strokeDasharray="2,2" />
            </g>
          ))}

          {/* 5. Center Column Pedestal (Golden Brown with Yellow Border) */}
          <rect
            x={cx - colW / 2}
            y={cy - colH / 2}
            width={colW}
            height={colH}
            fill="#ca8a04"
            fillOpacity="0.75"
            stroke="#eab308"
            strokeWidth="1.5"
          />

          {/* 6. Dimension Lines (Along Top & Right Edges with Red Ticks) */}
          {shape === 'RECTANGULAR' ? (
            <g>
              {/* Top Width Dimension: L */}
              <line x1={cx - (L / 2) * scale} y1="35" x2={cx + (L / 2) * scale} y2="35" stroke="#dc2626" strokeWidth="0.9" markerStart="url(#tick-45)" markerEnd="url(#tick-45)" />
              <line x1={cx - (L / 2) * scale} y1="30" x2={cx - (L / 2) * scale} y2={cy - (B / 2) * scale} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
              <line x1={cx + (L / 2) * scale} y1="30" x2={cx + (L / 2) * scale} y2={cy - (B / 2) * scale} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
              <text x={cx} y="30" fill="#dc2626" fontSize="9" fontWeight="bold" textAnchor="middle">
                {L}
              </text>

              {/* Right Height Dimension: B */}
              <line x1="275" y1={cy - (B / 2) * scale} x2="275" y2={cy + (B / 2) * scale} stroke="#dc2626" strokeWidth="0.9" markerStart="url(#tick-45)" markerEnd="url(#tick-45)" />
              <line x1={cx + (L / 2) * scale} y1={cy - (B / 2) * scale} x2="280" y2={cy - (B / 2) * scale} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
              <line x1={cx + (L / 2) * scale} y1={cy + (B / 2) * scale} x2="280" y2={cy + (B / 2) * scale} stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
              <text x="290" y={cy + 3} fill="#dc2626" fontSize="9" fontWeight="bold" textAnchor="start">
                {B}
              </text>
            </g>
          ) : (
            <g>
              {/* Pentagon/Triangle Facet Dimension */}
              <text x={cx} y="28" fill="#dc2626" fontSize="8.5" fontWeight="bold" textAnchor="middle">
                s = {s} mm c/c • eo = {eo} mm
              </text>
            </g>
          )}

          {/* 7. Rebar Callout Leaders (Red Text with Leaders) */}
          <line x1={cx + 35} y1={cy + 45} x2="280" y2="280" stroke="#dc2626" strokeWidth="0.8" />
          <line x1="280" y1="280" x2="310" y2="280" stroke="#dc2626" strokeWidth="0.8" />
          <text x="282" y="275" fill="#dc2626" fontSize="8.5" fontWeight="bold">
            {topRebarText}
          </text>
          <text x="282" y="290" fill="#dc2626" fontSize="8.5" fontWeight="bold">
            {botRebarText}
          </text>

          {/* 150 THK PCC Callout */}
          <line x1={cx - (L / 2) * scale - 12} y1={cy - 20} x2="35" y2="35" stroke="#dc2626" strokeWidth="0.8" />
          <line x1="35" y1="35" x2="10" y2="35" stroke="#dc2626" strokeWidth="0.8" />
          <text x="10" y="30" fill="#dc2626" fontSize="8" fontWeight="bold">
            150THK PCC
          </text>

          {/* Side Ties Callout */}
          <line x1={cx - (L / 2) * scale + 5} y1={cy + 25} x2="40" y2="250" stroke="#dc2626" strokeWidth="0.8" />
          <line x1="40" y1="250" x2="15" y2="250" stroke="#dc2626" strokeWidth="0.8" />
          <text x="15" y="245" fill="#dc2626" fontSize="8.5" fontWeight="bold">
            {sideRebarText}
          </text>

          {/* Plan View Title (Cyan with Underline) */}
          <text x={cx} y="335" fill="#0891b2" fontSize="11" fontWeight="bold" textAnchor="middle">
            PILE CAP PC{pileCap.supportNodeId} - PLAN
          </text>
          <text x={cx} y="350" fill="#0891b2" fontSize="9" textAnchor="middle">
            (SCALE 1:50)
          </text>
        </g>

        {/* ------------------------------------------------------------------------- */}
        {/* 2. SECTION 1-1 ELEVATION (RIGHT)                                          */}
        {/* ------------------------------------------------------------------------- */}
        <g transform="translate(420, 15)">
          {/* 1. Column Extending Above Cap with Links */}
          <rect x="135" y="10" width="50" height="70" fill="#ffffff" stroke="#eab308" strokeWidth="1.5" />
          {/* Column Starter Bars */}
          <line x1="145" y1="15" x2="145" y2="210" stroke="#06b6d4" strokeWidth="2.0" />
          <line x1="175" y1="15" x2="175" y2="210" stroke="#06b6d4" strokeWidth="2.0" />
          {/* Column Starter Hook Anchors into Cap */}
          <line x1="145" y1="210" x2="125" y2="210" stroke="#06b6d4" strokeWidth="2.0" />
          <line x1="175" y1="210" x2="195" y2="210" stroke="#06b6d4" strokeWidth="2.0" />

          {/* Column Ties / Links */}
          {[25, 40, 55, 70].map((ly, i) => (
            <line key={`link_${i}`} x1="135" y1={ly} x2="185" y2={ly} stroke="#dc2626" strokeWidth="1.2" />
          ))}
          <text x="160" y="50" fill="#dc2626" fontSize="7.5" fontWeight="bold" textAnchor="middle">
            LINKS
          </text>

          {/* 2. Cap Concrete Body (Magenta Border) */}
          <rect x="25" y="80" width="270" height="145" fill="#fdf4ff" fillOpacity="0.6" stroke="#c026d3" strokeWidth="2.2" />

          {/* 3. 150 THK PCC Bedding Layer (Brown / Dark Hatch) */}
          <rect x="10" y="225" width="300" height="15" fill="#b45309" fillOpacity="0.8" stroke="#78350f" strokeWidth="1.2" />

          {/* 4. Bored Concrete Piles Shafts Entering Cap (Green Outlines) */}
          <rect x="55" y="220" width="50" height="75" fill="#f0fdf4" stroke="#16a34a" strokeWidth="1.8" />
          <rect x="215" y="220" width="50" height="75" fill="#f0fdf4" stroke="#16a34a" strokeWidth="1.8" />

          {/* Pile Dowels Projecting into Cap */}
          <line x1="65" y1="165" x2="65" y2="280" stroke="#16a34a" strokeWidth="1.8" />
          <line x1="95" y1="165" x2="95" y2="280" stroke="#16a34a" strokeWidth="1.8" />
          <line x1="225" y1="165" x2="225" y2="280" stroke="#16a34a" strokeWidth="1.8" />
          <line x1="255" y1="165" x2="255" y2="280" stroke="#16a34a" strokeWidth="1.8" />

          {/* Pile Embedment Dimension 50mm / 150mm */}
          <line x1="45" y1="225" x2="45" y2="220" stroke="#dc2626" strokeWidth="0.8" />
          <text x="40" y="224" fill="#dc2626" fontSize="7.5" fontWeight="bold" textAnchor="end">
            50
          </text>

          {/* 5. Bottom Main Rebar Mat (Red Line with 90 deg Upward Hooks) */}
          <line x1="40" y1="213" x2="280" y2="213" stroke="#dc2626" strokeWidth="2.5" />
          <line x1="40" y1="213" x2="40" y2="135" stroke="#dc2626" strokeWidth="2.5" />
          <line x1="280" y1="213" x2="280" y2="135" stroke="#dc2626" strokeWidth="2.5" />

          {/* 6. Top Shrinkage Rebar Mat (Cyan Line with Downward Hooks) */}
          <line x1="40" y1="92" x2="280" y2="92" stroke="#06b6d4" strokeWidth="2.0" />
          <line x1="40" y1="92" x2="40" y2="140" stroke="#06b6d4" strokeWidth="2.0" />
          <line x1="280" y1="92" x2="280" y2="140" stroke="#06b6d4" strokeWidth="2.0" />

          {/* 7. Side Face Skin Reinforcement Ties (Green Circles / Horizontal Lines) */}
          <circle cx="40" cy="135" r="3.5" fill="#16a34a" />
          <circle cx="40" cy="170" r="3.5" fill="#16a34a" />
          <circle cx="280" cy="135" r="3.5" fill="#16a34a" />
          <circle cx="280" cy="170" r="3.5" fill="#16a34a" />
          <line x1="40" y1="135" x2="280" y2="135" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="3,3" />
          <line x1="40" y1="170" x2="280" y2="170" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="3,3" />

          {/* 8. Elevation Dimension Lines (Depth, Cover, PCC) */}
          {/* Depth D Dimension */}
          <line x1="320" y1="80" x2="320" y2="225" stroke="#dc2626" strokeWidth="0.9" markerStart="url(#tick-45)" markerEnd="url(#tick-45)" />
          <line x1="295" y1="80" x2="325" y2="80" stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
          <line x1="295" y1="225" x2="325" y2="225" stroke="#dc2626" strokeWidth="0.5" strokeDasharray="1,1" />
          <text x="330" y="155" fill="#dc2626" fontSize="9" fontWeight="bold">
            {D}
          </text>

          {/* Clear Cover 40 / 60mm */}
          <line x1="30" y1="213" x2="30" y2="225" stroke="#dc2626" strokeWidth="0.8" />
          <text x="26" y="221" fill="#dc2626" fontSize="7" fontWeight="bold" textAnchor="end">
            60
          </text>

          {/* 9. Section Rebar Callouts with Leaders */}
          {/* Top Mat Leader */}
          <line x1="280" y1="92" x2="310" y2="60" stroke="#dc2626" strokeWidth="0.8" />
          <line x1="310" y1="60" x2="335" y2="60" stroke="#dc2626" strokeWidth="0.8" />
          <text x="312" y="55" fill="#dc2626" fontSize="8" fontWeight="bold">
            {topRebarText}
          </text>

          {/* Bottom Mat Leader */}
          <line x1="280" y1="213" x2="310" y2="245" stroke="#dc2626" strokeWidth="0.8" />
          <line x1="310" y1="245" x2="335" y2="245" stroke="#dc2626" strokeWidth="0.8" />
          <text x="312" y="240" fill="#dc2626" fontSize="8" fontWeight="bold">
            {botRebarText}
          </text>

          {/* Side Ties Leader */}
          <line x1="40" y1="135" x2="10" y2="110" stroke="#dc2626" strokeWidth="0.8" />
          <line x1="10" y1="110" x2="-10" y2="110" stroke="#dc2626" strokeWidth="0.8" />
          <text x="-10" y="105" fill="#dc2626" fontSize="8" fontWeight="bold" textAnchor="end">
            {sideRebarText}
          </text>

          {/* 150THK PCC Leader */}
          <line x1="10" y1="232" x2="-10" y2="232" stroke="#dc2626" strokeWidth="0.8" />
          <text x="-12" y="235" fill="#dc2626" fontSize="7.5" fontWeight="bold" textAnchor="end">
            150THK PCC
          </text>

          {/* Pile Diameter Callout */}
          <line x1="80" y1="270" x2="80" y2="305" stroke="#dc2626" strokeWidth="0.8" />
          <line x1="80" y1="305" x2="115" y2="305" stroke="#dc2626" strokeWidth="0.8" />
          <text x="120" y="308" fill="#dc2626" fontSize="8" fontWeight="bold">
            {Dp} Ø PILE
          </text>

          {/* Section Elevation Title (Cyan) */}
          <text x="160" y="335" fill="#0891b2" fontSize="11" fontWeight="bold" textAnchor="middle">
            SECTION 1-1
          </text>
          <text x="160" y="348" fill="#0891b2" fontSize="9" fontWeight="bold" textAnchor="middle">
            DETAIL OF PC{pileCap.supportNodeId}
          </text>
          <text x="160" y="360" fill="#0891b2" fontSize="8" textAnchor="middle">
            (SCALE 1:50)
          </text>
        </g>
      </svg>
    </div>
  );
};
