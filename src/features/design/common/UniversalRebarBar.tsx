import React from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { Sliders, AlertTriangle, Check, RotateCw, Sparkles, Settings2 } from 'lucide-react';
import { ALL_LONGITUDINAL_DIAS, ALL_SHEAR_TIE_DIAS } from './UniversalRebarModal';

interface UniversalRebarBarProps {
  showOrientationTool?: boolean;
  onAutoOrient90?: () => void;
  isAutoOrienting?: boolean;
  moduleName?: string;
}

export const UniversalRebarBar: React.FC<UniversalRebarBarProps> = ({
  showOrientationTool = false,
  onAutoOrient90,
  isAutoOrienting = false,
  moduleName,
}) => {
  const {
    universalRebarSelection,
    setUniversalLongitudinalDiameters,
    setUniversalShearTieDiameters,
    setUniversalRebarModalOpen,
  } = useProjectStore();

  const longDias = universalRebarSelection?.longitudinalDiameters || [];
  const tieDias = universalRebarSelection?.shearTieDiameters || [];

  const toggleLongDia = (dia: number) => {
    let next: number[];
    if (longDias.includes(dia)) {
      next = longDias.filter((d) => d !== dia);
    } else {
      next = [...longDias, dia].sort((a, b) => a - b);
    }
    setUniversalLongitudinalDiameters(next);
  };

  const toggleTieDia = (dia: number) => {
    let next: number[];
    if (tieDias.includes(dia)) {
      next = tieDias.filter((d) => d !== dia);
    } else {
      next = [...tieDias, dia].sort((a, b) => a - b);
    }
    setUniversalShearTieDiameters(next);
  };

  const isInvalid = longDias.length === 0;

  if (isInvalid) {
    return (
      <div className="bg-red-500/15 border-2 border-red-500/60 rounded-xl p-3.5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono animate-pulse">
        <div className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <strong className="font-bold text-red-950">
              ⚠️ UNIVERSAL REBAR SELECTION REQUIRED:
            </strong>{' '}
            <span>
              All design engines and calculations are locked. Select at least one rebar diameter (e.g., T16, T20) to enable {moduleName || 'structural'} design.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {ALL_LONGITUDINAL_DIAS.slice(0, 4).map((dia) => (
            <button
              key={dia}
              type="button"
              onClick={() => toggleLongDia(dia)}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-xs text-xs"
            >
              + Allow T{dia}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setUniversalRebarModalOpen(true)}
            className="px-3 py-1 bg-slate-900 text-white font-bold rounded shadow-xs text-xs flex items-center gap-1"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Configure All
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-dark border border-slate-700/60 rounded-xl p-3 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
      {/* Left: Universal Rebar Toggles */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Longitudinal Rebars */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-slate-300 font-bold text-[11px] mr-1">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>UNIVERSAL REBARS:</span>
          </div>

          {ALL_LONGITUDINAL_DIAS.map((dia) => {
            const isSelected = longDias.includes(dia);
            return (
              <button
                key={dia}
                type="button"
                onClick={() => toggleLongDia(dia)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all ${
                  isSelected
                    ? dia === 32
                      ? 'bg-red-500/25 text-red-300 border border-red-500 shadow-xs'
                      : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500 shadow-xs'
                    : 'bg-slate-800/80 text-slate-500 border border-slate-700 hover:text-slate-300'
                }`}
                title={isSelected ? `Exclude ${dia}mm from all designs` : `Allow ${dia}mm in all designs`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? (dia === 32 ? 'bg-red-400' : 'bg-emerald-400') : 'bg-slate-600'
                  }`}
                />
                <span>T{dia}</span>
              </button>
            );
          })}
        </div>

        {/* Ties / Stirrups */}
        <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
          <span className="text-[10px] text-slate-400 font-bold">TIES:</span>
          {ALL_SHEAR_TIE_DIAS.map((dia) => {
            const isSelected = tieDias.includes(dia);
            return (
              <button
                key={dia}
                type="button"
                onClick={() => toggleTieDia(dia)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                  isSelected
                    ? 'bg-sky-600/30 text-sky-300 border border-sky-500'
                    : 'bg-slate-800/80 text-slate-500 border border-slate-700'
                }`}
              >
                T{dia}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {showOrientationTool && onAutoOrient90 && (
          <button
            type="button"
            onClick={onAutoOrient90}
            disabled={isAutoOrienting}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40 rounded text-xs transition-colors"
            title="Auto-rotate rectangular columns 90° if bending moment Muy > Mux"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isAutoOrienting ? 'animate-spin' : ''}`} />
            <span>Auto-Orient 90°</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setUniversalRebarModalOpen(true)}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 rounded text-xs transition-colors"
          title="Open Master Rebar Dictionary &amp; Presets"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Configure Presets</span>
        </button>
      </div>
    </div>
  );
};
