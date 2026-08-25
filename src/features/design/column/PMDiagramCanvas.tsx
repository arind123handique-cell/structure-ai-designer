import React from 'react';
import { ColumnDesignOutput } from './columnDesignEngine';

interface PMDiagramCanvasProps {
  column: ColumnDesignOutput;
  width?: number;
  height?: number;
}

export const PMDiagramCanvas: React.FC<PMDiagramCanvasProps> = ({ column, width = 500, height = 340 }) => {
  const pointsX = column.biaxialCheck.pmPointsX;
  const Pu = Math.abs(column.axialCheck.Puz > 0 ? (column.calculationReport.sections[1].steps[0].result ? parseFloat(column.calculationReport.sections[1].steps[0].result) : 500) : 500);
  const Mux = parseFloat(column.calculationReport.sections[2].steps[0].result.split('Mux = ')[1]?.split(' kNm')[0]) || 40;

  const maxP = Math.max(...pointsX.map((p) => p.Pu_kN), Pu * 1.2, 1000);
  const maxM = Math.max(...pointsX.map((p) => p.Mu_kNm), Mux * 1.3, 100);

  // SVG coordinate transformation
  const padLeft = 60;
  const padBottom = 45;
  const padTop = 30;
  const padRight = 30;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const mapX = (mu: number) => padLeft + (mu / maxM) * plotWidth;
  const mapY = (pu: number) => padTop + plotHeight - (pu / maxP) * plotHeight;

  // Build SVG path for PM curve
  const pathD = pointsX
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(p.Mu_kNm)} ${mapY(p.Pu_kN)}`)
    .join(' ');

  const designPtX = mapX(Mux);
  const designPtY = mapY(Pu);
  const isInside = column.biaxialCheck.interactionRatio <= 1.0;

  return (
    <div className="flex flex-col items-center bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-inner overflow-x-auto font-mono">
      <div className="flex items-center justify-between w-full mb-2 px-2 text-xs text-slate-400">
        <span className="font-bold text-emerald-400">P-M INTERACTION DIAGRAM (IS 456 / SP:16)</span>
        <span className={isInside ? 'text-emerald-400' : 'text-red-400'}>
          IR = {column.biaxialCheck.interactionRatio} ({isInside ? 'PASS' : 'FAIL'})
        </span>
      </div>

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="select-none text-xs">
        {/* Axes */}
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={height - padBottom} stroke="#475569" strokeWidth="1.5" />
        <line x1={padLeft} y1={height - padBottom} x2={width - padRight} y2={height - padBottom} stroke="#475569" strokeWidth="1.5" />

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1.0].map((frac, i) => {
          const y = padTop + plotHeight * (1 - frac);
          const x = padLeft + plotWidth * frac;
          return (
            <React.Fragment key={i}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#1e293b" strokeDasharray="3,3" />
              <text x={padLeft - 8} y={y + 3} fill="#64748b" fontSize="9" textAnchor="end">
                {Math.round(maxP * frac)}
              </text>
              <line x1={x} y1={padTop} x2={x} y2={height - padBottom} stroke="#1e293b" strokeDasharray="3,3" />
              <text x={x} y={height - padBottom + 15} fill="#64748b" fontSize="9" textAnchor="middle">
                {Math.round(maxM * frac)}
              </text>
            </React.Fragment>
          );
        })}

        {/* PM Envelope Capacity Area */}
        <path d={`${pathD} L ${padLeft} ${height - padBottom} Z`} fill="#065f46" fillOpacity="0.25" />
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" />

        {/* Key PM Points on curve */}
        {pointsX.map((p, idx) => (
          <circle key={idx} cx={mapX(p.Mu_kNm)} cy={mapY(p.Pu_kN)} r="3" fill="#34d399" />
        ))}

        {/* Design Load Point (Pu, Mux) */}
        <circle
          cx={designPtX}
          cy={designPtY}
          r="6"
          fill={isInside ? '#3b82f6' : '#ef4444'}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        <text
          x={designPtX + 8}
          y={designPtY - 8}
          fill={isInside ? '#60a5fa' : '#f87171'}
          fontSize="10"
          fontWeight="bold"
        >
          Design Demand ({Mux.toFixed(1)} kNm, {Pu.toFixed(1)} kN)
        </text>

        {/* Axis Titles */}
        <text x={padLeft - 40} y={height / 2} fill="#94a3b8" fontSize="10" transform={`rotate(-90 ${padLeft - 40} ${height / 2})`} textAnchor="middle">
          Axial Load Pu (kN) →
        </text>
        <text x={padLeft + plotWidth / 2} y={height - 8} fill="#94a3b8" fontSize="10" textAnchor="middle">
          Bending Moment Mu (kNm) →
        </text>
      </svg>
    </div>
  );
};
