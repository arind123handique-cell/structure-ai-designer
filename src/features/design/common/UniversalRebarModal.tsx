import React from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import {
  Sliders,
  Check,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Layers,
  Building,
  Box,
  RotateCcw,
  X,
  Zap,
} from 'lucide-react';

export const ALL_LONGITUDINAL_DIAS = [12, 16, 20, 25, 28, 32];
export const ALL_SHEAR_TIE_DIAS = [8, 10, 12];

export const UniversalRebarModal: React.FC = () => {
  const {
    universalRebarSelection,
    setUniversalRebarSelection,
    isUniversalRebarModalOpen,
    setUniversalRebarModalOpen,
  } = useProjectStore();

  if (!isUniversalRebarModalOpen) return null;

  const longDias = universalRebarSelection?.longitudinalDiameters || [];
  const tieDias = universalRebarSelection?.shearTieDiameters || [];

  const toggleLongDia = (dia: number) => {
    let next: number[];
    if (longDias.includes(dia)) {
      next = longDias.filter((d) => d !== dia);
    } else {
      next = [...longDias, dia].sort((a, b) => a - b);
    }
    setUniversalRebarSelection({
      longitudinalDiameters: next,
      isConfigured: next.length > 0,
    });
  };

  const toggleTieDia = (dia: number) => {
    let next: number[];
    if (tieDias.includes(dia)) {
      next = tieDias.filter((d) => d !== dia);
    } else {
      next = [...tieDias, dia].sort((a, b) => a - b);
    }
    setUniversalRebarSelection({
      shearTieDiameters: next,
    });
  };

  const applyPreset = (preset: 'eco' | 'light' | 'heavy' | 'all') => {
    if (preset === 'eco') {
      setUniversalRebarSelection({
        longitudinalDiameters: [12, 16, 20, 25],
        shearTieDiameters: [8, 10],
        isConfigured: true,
      });
    } else if (preset === 'light') {
      setUniversalRebarSelection({
        longitudinalDiameters: [12, 16],
        shearTieDiameters: [8],
        isConfigured: true,
      });
    } else if (preset === 'heavy') {
      setUniversalRebarSelection({
        longitudinalDiameters: [16, 20, 25, 32],
        shearTieDiameters: [8, 10, 12],
        isConfigured: true,
      });
    } else if (preset === 'all') {
      setUniversalRebarSelection({
        longitudinalDiameters: [12, 16, 20, 25, 28, 32],
        shearTieDiameters: [8, 10, 12],
        isConfigured: true,
      });
    }
  };

  const isInvalid = longDias.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-surface-card border border-ui-border rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold tracking-wide flex items-center gap-2">
                UNIVERSAL REBAR SELECTION &amp; MASTER REBAR DICTIONARY
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                Global rebar inventory strictly enforced across Columns, Beams, Walls, Pile Caps &amp; Reports
              </p>
            </div>
          </div>
          <button
            onClick={() => setUniversalRebarModalOpen(false)}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Warning Banner if No Rebars Selected */}
          {isInvalid && (
            <div className="bg-red-500/15 border-2 border-red-500/50 rounded-lg p-4 flex items-start gap-3 text-red-700 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <strong className="font-bold text-red-900">UNIVERSAL REBAR SELECTION REQUIRED:</strong>
                <p className="mt-0.5 text-red-800">
                  You must select at least one main longitudinal diameter (e.g., T16, T20). Without this selection, design engines, auto-design, 3D detailing, and reports are locked.
                </p>
              </div>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <label className="text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider block mb-2">
              ⚡ Quick Diameter Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('eco')}
                className="px-3 py-2 bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 border border-ui-border rounded-lg text-left transition-all"
              >
                <div className="font-mono text-xs font-bold text-slate-800">🌱 Economical</div>
                <div className="text-[10px] text-slate-500 mt-0.5">12, 16, 20, 25mm</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('light')}
                className="px-3 py-2 bg-slate-100 hover:bg-sky-50 hover:border-sky-300 border border-ui-border rounded-lg text-left transition-all"
              >
                <div className="font-mono text-xs font-bold text-slate-800">🏠 Light Resid.</div>
                <div className="text-[10px] text-slate-500 mt-0.5">12, 16mm Only</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('heavy')}
                className="px-3 py-2 bg-slate-100 hover:bg-purple-50 hover:border-purple-300 border border-ui-border rounded-lg text-left transition-all"
              >
                <div className="font-mono text-xs font-bold text-slate-800">🏢 Commercial</div>
                <div className="text-[10px] text-slate-500 mt-0.5">16, 20, 25, 32mm</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="px-3 py-2 bg-slate-100 hover:bg-amber-50 hover:border-amber-300 border border-ui-border rounded-lg text-left transition-all"
              >
                <div className="font-mono text-xs font-bold text-slate-800">📦 Full Stock</div>
                <div className="text-[10px] text-slate-500 mt-0.5">All Standard Dias</div>
              </button>
            </div>
          </div>

          {/* Section 1: Main Longitudinal Diameters */}
          <div className="bg-slate-50 p-4 rounded-xl border border-ui-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-deep-navy">
                  1. MAIN LONGITUDINAL REBAR DIAMETERS
                </span>
                <p className="text-[11px] text-slate-500">
                  Allowed in Columns, Beams (Top/Bottom), Shear Wall Boundary Elements &amp; Foundation Mats
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                {longDias.length} Selected
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ALL_LONGITUDINAL_DIAS.map((dia) => {
                const isSelected = longDias.includes(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleLongDia(dia)}
                    className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center border font-mono transition-all ${
                      isSelected
                        ? dia === 32
                          ? 'bg-red-500/15 border-red-500 text-red-900 shadow-sm'
                          : 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white border-ui-border text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <span className="text-base font-bold">T{dia}</span>
                    <span className={`text-[10px] mt-0.5 ${isSelected ? (dia === 32 ? 'text-red-700' : 'text-emerald-100') : 'text-slate-400'}`}>
                      {dia} mm
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Shear Stirrups & Confinement Ties */}
          <div className="bg-slate-50 p-4 rounded-xl border border-ui-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-deep-navy">
                  2. TRANSVERSE TIES, STIRRUPS &amp; WEB MESH DIAMETERS
                </span>
                <p className="text-[11px] text-slate-500">
                  Used for Beam Stirrups, Column Ductile Hoops, Shear Wall Mesh &amp; Pile Helical Links
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                {tieDias.length} Selected
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {ALL_SHEAR_TIE_DIAS.map((dia) => {
                const isSelected = tieDias.includes(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleTieDia(dia)}
                    className={`py-3 px-2 rounded-xl flex flex-col items-center justify-center border font-mono transition-all ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                        : 'bg-white border-ui-border text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <span className="text-base font-bold">T{dia}</span>
                    <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>
                      {dia === 8 ? '8mm (Standard Ties)' : dia === 10 ? '10mm (Heavy Links/Web)' : '12mm (Special Confinement)'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module Enforcement Scope */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 text-[11px] text-emerald-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Universal Enforcement Guarantee:</strong>
              <p className="text-slate-600 mt-0.5">
                Every calculation engine, auto-design optimizer, 3D rebar generation, and A4 PDF export will strictly and exclusively construct rebars using these selected diameters.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3.5 border-t border-ui-border flex items-center justify-between">
          <div className="text-xs font-mono text-slate-500">
            {isInvalid ? (
              <span className="text-red-600 font-bold">⚠️ Select at least 1 main diameter</span>
            ) : (
              <span className="text-emerald-700 font-bold">✓ Ready to design with {longDias.length} main + {tieDias.length} tie diameters</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUniversalRebarModalOpen(false)}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-mono text-xs font-semibold rounded-lg border border-ui-border shadow-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isInvalid}
              onClick={() => setUniversalRebarModalOpen(false)}
              className={`px-5 py-2 font-mono text-xs font-bold rounded-lg shadow-sm transition-all ${
                isInvalid
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              Apply to All Modules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
