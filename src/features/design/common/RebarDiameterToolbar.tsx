import React from 'react';
import { Sparkles, Sliders, Check, RotateCw } from 'lucide-react';

interface RebarDiameterToolbarProps {
  title?: string;
  allowedDiameters: number[];
  onChange: (diameters: number[]) => void;
  availableDiameters?: number[];
  onAutoOrient90?: () => void;
  isAutoOrienting?: boolean;
  showOrientationTool?: boolean;
}

const DEFAULT_AVAILABLE_DIAS = [12, 16, 20, 25, 28, 32];

export const RebarDiameterToolbar: React.FC<RebarDiameterToolbarProps> = ({
  title = 'ALLOWED REBAR DIAMETERS',
  allowedDiameters,
  onChange,
  availableDiameters = DEFAULT_AVAILABLE_DIAS,
  onAutoOrient90,
  isAutoOrienting = false,
  showOrientationTool = false,
}) => {
  const toggleDiameter = (dia: number) => {
    let next: number[];
    if (allowedDiameters.includes(dia)) {
      if (allowedDiameters.length === 1) {
        return; // Prevent deselecting everything
      }
      next = allowedDiameters.filter((d) => d !== dia);
    } else {
      next = [...allowedDiameters, dia].sort((a, b) => a - b);
    }
    onChange(next);
  };

  const setPreset = (preset: 'eco' | 'light' | 'all') => {
    if (preset === 'eco') {
      onChange([12, 16, 20, 25]);
    } else if (preset === 'light') {
      onChange([12, 16]);
    } else if (preset === 'all') {
      onChange([12, 16, 20, 25, 28, 32]);
    }
  };

  return (
    <div className="bg-surface-dark border border-slate-700/60 rounded-xl p-3.5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
      {/* Left: Rebar Switches */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[11px] mr-1">
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span>{title}:</span>
        </div>

        {/* Diameter Toggle Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {availableDiameters.map((dia) => {
            const isSelected = allowedDiameters.includes(dia);
            return (
              <button
                key={dia}
                type="button"
                onClick={() => toggleDiameter(dia)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  isSelected
                    ? dia === 32
                      ? 'bg-red-500/25 text-red-300 border border-red-500 shadow-xs'
                      : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500 shadow-xs'
                    : 'bg-slate-800/80 text-slate-500 border border-slate-700 hover:text-slate-300 hover:border-slate-600'
                }`}
                title={isSelected ? `Click to exclude ${dia}mm from design` : `Click to allow ${dia}mm in design`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    isSelected
                      ? dia === 32
                        ? 'bg-red-400'
                        : 'bg-emerald-400'
                      : 'bg-slate-600'
                  }`}
                />
                <span>T{dia}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1 ml-2 border-l border-slate-700 pl-2">
          <button
            type="button"
            onClick={() => setPreset('eco')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors"
            title="Preset: 12, 16, 20, 25mm (Target 0.8% - 1.2% pt)"
          >
            Eco (12-25)
          </button>
          <button
            type="button"
            onClick={() => setPreset('light')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors"
            title="Preset: 12, 16mm only"
          >
            Light (12-16)
          </button>
          <button
            type="button"
            onClick={() => setPreset('all')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors"
            title="Preset: All diameters (12-32mm)"
          >
            All (12-32)
          </button>
        </div>
      </div>

      {/* Right: 90° Orientation Optimization Tool (for Columns) */}
      {showOrientationTool && onAutoOrient90 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAutoOrient90}
            disabled={isAutoOrienting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/60 rounded-lg text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
            title="Automatically tests rectangular columns rotated 90° to align with governing moments, drastically reducing required reinforcement to 0.8%-1.0%"
          >
            <RotateCw className={`w-3.5 h-3.5 text-indigo-400 ${isAutoOrienting ? 'animate-spin' : ''}`} />
            <span>⚡ Auto-Orient Columns (90° Rotation)</span>
          </button>
        </div>
      )}
    </div>
  );
};
