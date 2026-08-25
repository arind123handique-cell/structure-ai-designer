import React from 'react';
import { GlobalAutoDesignSummary } from './globalAutoDesignService';
import {
  Sparkles,
  X,
  CheckCircle2,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  Building,
} from 'lucide-react';

interface GlobalAutoDesignModalProps {
  summary: GlobalAutoDesignSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmApply: () => Promise<void>;
  isApplying: boolean;
}

export const GlobalAutoDesignModal: React.FC<GlobalAutoDesignModalProps> = ({
  summary,
  isOpen,
  onClose,
  onConfirmApply,
  isApplying,
}) => {
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-3xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-deep-navy via-slate-900 to-indigo-950 text-white border-b border-ui-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-lg text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono text-base font-bold flex items-center gap-2">
                1-CLICK AUTO-FIX & ECONOMICAL REBAR OPTIMIZER
              </h3>
              <p className="text-xs text-slate-300 font-mono">
                IS 456:2000 & IS 13920:2016 Practical Sizing & Anti-Crowding Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Key Savings KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-mono font-bold uppercase mb-1">
                <span>Concrete Savings</span>
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-900">
                {(summary.concreteVolumeBefore - summary.concreteVolumeAfter).toFixed(1)} m³
              </div>
              <div className="text-xs font-mono text-emerald-700 mt-1">
                {summary.concreteSavedPercent}% reduction ({summary.concreteVolumeBefore} → {summary.concreteVolumeAfter} m³)
              </div>
            </div>

            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="flex items-center justify-between text-indigo-800 text-xs font-mono font-bold uppercase mb-1">
                <span>Steel Savings</span>
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold font-mono text-indigo-900">
                {Math.round(summary.steelWeightBefore - summary.steelWeightAfter)} kg
              </div>
              <div className="text-xs font-mono text-indigo-700 mt-1">
                {summary.steelSavedPercent}% reduction ({Math.round(summary.steelWeightBefore)} → {Math.round(summary.steelWeightAfter)} kg)
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between text-amber-800 text-xs font-mono font-bold uppercase mb-1">
                <span>Cost Index</span>
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold font-mono text-amber-900">
                ₹{Math.round(summary.costBefore - summary.costAfter).toLocaleString('en-IN')}
              </div>
              <div className="text-xs font-mono text-amber-700 mt-1">
                {summary.costSavedPercent}% total material savings
              </div>
            </div>
          </div>

          {/* Sizing & Detailing Strategy Applied */}
          <div className="bg-slate-50 border border-ui-border rounded-lg p-4 space-y-3 font-mono text-xs text-slate-700">
            <h4 className="font-bold text-deep-navy flex items-center gap-1.5 uppercase">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Applied Code & Constructability Rules:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-white border border-ui-border rounded">
                <div className="font-bold text-slate-900 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  RCC Beams ({summary.totalBeams} members):
                </div>
                <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                  <li>Standardized to uncrowded single-layer rebar</li>
                  <li><strong>2-T16 Through Top</strong> + <strong>3-T16 Through Bottom</strong></li>
                  <li>Clear gap &ge; 25 mm for 20mm aggregate (IS 456 Cl. 26.3.2)</li>
                  <li>L/3 support extra cutoffs & continuous joint steel (IS 13920)</li>
                </ul>
              </div>

              <div className="p-3 bg-white border border-ui-border rounded">
                <div className="font-bold text-slate-900 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  RCC Columns ({summary.totalColumns} members):
                </div>
                <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                  <li>Economical steel ratio pt = 0.8% - 1.2%</li>
                  <li>Practical <strong>6-T16 / 8-T16 / 4-T20+4-T16</strong> layout</li>
                  <li>Biaxial Bresler IR &le; 1.0 (IS 456 Cl. 39.5)</li>
                  <li>Ductile link spacing s &le; 100 mm (IS 13920)</li>
                </ul>
              </div>

              <div className="p-3 bg-white border border-ui-border rounded md:col-span-2">
                <div className="font-bold text-slate-900 mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  Pile Caps ({summary.totalPileCaps} foundations):
                </div>
                <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-0.5">
                  <li>Np = ceil(1.10 &times; P_work / Qsafe) with corner pile moment interaction</li>
                  <li>Economical depth sized for two-way punching shear (&tau;vp &le; 0.25&radic;fck)</li>
                  <li>Bottom T16@125 c/c mats + Top T12@150 c/c crack control mesh</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-ui-border flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-semibold text-slate-600 hover:text-slate-800 bg-white border border-ui-border rounded shadow-sm hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirmApply}
            disabled={isApplying}
            className="flex items-center gap-2 px-6 py-2 text-xs font-mono font-bold text-white bg-secondary-brand hover:bg-blue-700 disabled:opacity-50 rounded shadow-md transition-all"
          >
            {isApplying ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Applying Optimized Designs...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Apply All Optimized Sections & Rebar ({summary.beamUpdates.length + summary.columnUpdates.length} updates)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
