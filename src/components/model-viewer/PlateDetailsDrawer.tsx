import React from 'react';
import { X, Layers, Ruler, Cpu, Building2 } from 'lucide-react';
import { Plate3D, Node3D } from '@/features/model/types';

interface PlateDetailsDrawerProps {
  plate: Plate3D;
  nodes: (Node3D | undefined)[];
  onClose: () => void;
}

export const PlateDetailsDrawer: React.FC<PlateDetailsDrawerProps> = ({ plate, nodes, onClose }) => {
  const isWall = plate.classification === 'WALL';
  const thMm = Math.round((plate.thickness || (isWall ? 0.23 : 0.15)) * 1000);
  const validNodes = nodes.filter(Boolean) as Node3D[];

  const xs = validNodes.map((n) => n.x);
  const ys = validNodes.map((n) => n.y);
  const zs = validNodes.map((n) => n.z);

  const dx = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  const dy = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
  const dz = zs.length ? Math.max(...zs) - Math.min(...zs) : 0;

  const lengthOrWidth = Math.max(dx, dz);
  const heightOrSpan = isWall ? dy : Math.min(dx, dz) || lengthOrWidth;
  const area = lengthOrWidth * (isWall ? dy : heightOrSpan);

  return (
    <div
      className="absolute inset-y-0 right-0 w-[400px] max-w-[90vw] bg-[#0b1120]/95 backdrop-blur-md border-l border-slate-700/60 shadow-2xl z-30 flex flex-col font-mono overflow-hidden"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          {isWall ? (
            <Building2 className="w-4 h-4 text-violet-400" />
          ) : (
            <Layers className="w-4 h-4 text-sky-400" />
          )}
          <span className="text-sm font-bold text-slate-100">
            {isWall ? `Shear Wall SW-${plate.id}` : `Floor Slab Plate #${plate.id}`}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              isWall
                ? 'bg-violet-900/40 text-violet-300 border-violet-500/40'
                : 'bg-sky-900/40 text-sky-300 border-sky-500/40'
            }`}
          >
            {isWall ? 'LIFT CORE' : 'DIAPHRAGM'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs text-slate-300">
        {/* Geometry section */}
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Plate Geometry</h3>
          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-800/40 p-2.5 rounded border border-slate-700/40">
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">Thickness:</span>
              <span className="text-slate-100 font-bold">{thMm} mm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">{isWall ? 'Story H:' : 'Span Y:'}</span>
              <span className="text-slate-100 font-bold">{heightOrSpan.toFixed(2)} m</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">{isWall ? 'Wall Length:' : 'Plan Length:'}</span>
              <span className="text-slate-100 font-bold">{lengthOrWidth.toFixed(2)} m</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">Surface Area:</span>
              <span className="text-emerald-300 font-bold">{area.toFixed(2)} m²</span>
            </div>
          </div>
        </section>

        {/* Boundary Nodes Table */}
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Boundary Joint Coordinates</h3>
          <div className="rounded border border-slate-700/50 bg-[#080e1a] overflow-hidden">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-slate-700/40 text-slate-500">
                  <th className="px-2.5 py-1 text-left">Joint</th>
                  <th className="px-2.5 py-1 text-right">X (m)</th>
                  <th className="px-2.5 py-1 text-right">Y (m)</th>
                  <th className="px-2.5 py-1 text-right">Z (m)</th>
                </tr>
              </thead>
              <tbody>
                {validNodes.map((n) => (
                  <tr key={n.id} className="border-b border-slate-800/30 hover:bg-slate-800/30 font-mono">
                    <td className="px-2.5 py-1 text-amber-400 font-bold">#{n.id}</td>
                    <td className="px-2.5 py-1 text-right text-slate-300">{n.x.toFixed(2)}</td>
                    <td className="px-2.5 py-1 text-right text-sky-400">{n.y.toFixed(2)}</td>
                    <td className="px-2.5 py-1 text-right text-slate-300">{n.z.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* IS 456 Reinforcement Guidelines */}
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">IS 456 / IS 13920 Guidelines</h3>
          <div className="bg-slate-800/30 border border-slate-700/40 rounded p-3 space-y-2 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Classification:</span>
              <span className="text-white font-semibold">{isWall ? 'Special RC Shear Wall' : 'Floor Diaphragm Slab'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Min. Reinforcement Ratio:</span>
              <span className="text-emerald-400 font-bold">{isWall ? '0.25% (Each Curtain)' : '0.12% (Fe500D)'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Curtain Arrangement:</span>
              <span className="text-slate-200">{thMm >= 200 ? 'Double Curtain (2 layers)' : 'Single Mesh'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Nominal Rebar Callout:</span>
              <span className="text-amber-300 font-bold">{isWall ? 'T12 @ 150 c/c (2-Curtains)' : 'T10 @ 150 c/c BTM / T8 @ 200 c/c TOP'}</span>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-600 transition-colors font-mono text-xs"
          >
            Deselect Plate
          </button>
        </section>
      </div>
    </div>
  );
};
