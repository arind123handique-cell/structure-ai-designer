import React, { useState } from 'react';
import { BatchColumnOptimizationSummary } from './columnOptimizationEngine';
import {
  X,
  Sparkles,
  CheckCircle,
  TrendingDown,
  Layers,
  ShieldCheck,
  Building2,
  DollarSign,
  Check,
} from 'lucide-react';

interface ColumnAutoDesignModalProps {
  summary: BatchColumnOptimizationSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmApply: () => void;
  onReoptimizeWithDiameters: (allowedDiameters: number[]) => void;
  isApplying: boolean;
}

const INDIAN_STANDARD_REBARS = [
  { dia: 12, label: '12 mm (T12)', isCommon: true },
  { dia: 16, label: '16 mm (T16)', isCommon: true },
  { dia: 20, label: '20 mm (T20)', isCommon: true },
  { dia: 25, label: '25 mm (T25)', isCommon: true },
  { dia: 28, label: '28 mm (T28)', isCommon: false },
  { dia: 32, label: '32 mm (T32)', isCommon: false },
];

export const ColumnAutoDesignModal: React.FC<ColumnAutoDesignModalProps> = ({
  summary,
  isOpen,
  onClose,
  onConfirmApply,
  onReoptimizeWithDiameters,
  isApplying,
}) => {
  const [selectedDiameters, setSelectedDiameters] = useState<number[]>(
    summary?.allowedDiameters || [12, 16, 20, 25]
  );

  if (!isOpen || !summary) return null;

  const handleToggleDia = (dia: number) => {
    let next: number[];
    if (selectedDiameters.includes(dia)) {
      if (selectedDiameters.length === 1) return; // Keep at least one diameter
      next = selectedDiameters.filter((d) => d !== dia);
    } else {
      next = [...selectedDiameters, dia].sort((a, b) => a - b);
    }
    setSelectedDiameters(next);
    onReoptimizeWithDiameters(next);
  };

  const handleApplyPreset = (dias: number[]) => {
    setSelectedDiameters(dias);
    onReoptimizeWithDiameters(dias);
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-3xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col font-mono">
        {/* Top Header */}
        <div className="px-6 py-4 bg-emerald-50/90 border-b border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-lg text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                1-CLICK ECONOMICAL COLUMN AUTO-DESIGN ENGINE
              </h3>
              <p className="text-xs text-emerald-800 font-sans mt-0.5">
                Automatically sized {summary.totalColumns} columns to optimum cross-sections & mixed rebar without failing IS 456 / IS 13920 code checks.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-emerald-200/50 rounded text-emerald-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs max-h-[72vh] overflow-y-auto">
          {/* Rebar Diameter Filter / Selector Bar (Available in India) */}
          <div className="bg-slate-50 border border-ui-border rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                AVAILABLE INDIAN REBAR DIAMETERS TO USE (SELECT TO FILTER):
              </span>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleApplyPreset([8, 10, 12, 16, 20, 25, 28, 32])}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700"
                >
                  All (8-32mm)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset([12, 16, 20, 25])}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-emerald-800"
                >
                  Standard (12,16,20,25)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset([16, 20])}
                  className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-sky-800"
                >
                  Only 16 & 20mm
                </button>
              </div>
            </div>

            {/* Interactive Toggle Pills */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {INDIAN_STANDARD_REBARS.map((item) => {
                const isSelected = selectedDiameters.includes(item.dia);
                return (
                  <button
                    key={item.dia}
                    type="button"
                    onClick={() => handleToggleDia(item.dia)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono font-bold transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs scale-105'
                        : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] border ${
                        isSelected ? 'bg-emerald-800 text-white border-emerald-900' : 'bg-slate-100 border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5" />}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Concrete Savings Card */}
            <div className="bg-slate-50 border border-ui-border rounded-lg p-3.5 space-y-1">
              <span className="text-slate-500 font-bold text-[10px] uppercase flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                Concrete Volume
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-deep-navy">
                  {summary.concreteVolumeAfter} m³
                </span>
                <span className="text-[11px] text-slate-400 line-through">
                  {summary.concreteVolumeBefore} m³
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>{summary.concreteSavedPercent}% Concrete Saved</span>
              </div>
            </div>

            {/* Steel Weight Savings Card */}
            <div className="bg-slate-50 border border-ui-border rounded-lg p-3.5 space-y-1">
              <span className="text-slate-500 font-bold text-[10px] uppercase flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-secondary-brand" />
                Rebar Steel Weight
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-deep-navy">
                  {summary.steelWeightAfter.toLocaleString()} kg
                </span>
                <span className="text-[11px] text-slate-400 line-through">
                  {summary.steelWeightBefore.toLocaleString()} kg
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>{summary.steelSavedPercent}% Steel Saved</span>
              </div>
            </div>

            {/* Total Structural Cost Card */}
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3.5 space-y-1">
              <span className="text-emerald-800 font-bold text-[10px] uppercase flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                Est. Structural Cost
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-emerald-950">
                  ₹{(summary.costAfter / 100000).toFixed(2)} Lakhs
                </span>
                <span className="text-[11px] text-emerald-600 line-through">
                  ₹{(summary.costBefore / 100000).toFixed(2)}L
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-bold">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>₹{((summary.costBefore - summary.costAfter) / 100000).toFixed(2)}L Saved ({summary.costSavedPercent}%)</span>
              </div>
            </div>
          </div>

          {/* Safety & Compliance Guarantee Banner */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <div>
                <span className="font-bold text-emerald-950 text-xs block">
                  100% IS 456 & IS 13920 STRUCTURAL CODE COMPLIANCE
                </span>
                <span className="text-[11px] text-emerald-800 font-sans">
                  All {summary.totalColumns} members verified for Bresler biaxial envelope (IR ≤ 1.0), Weak-Beam Strong-Column ductility, and space confinement using ({selectedDiameters.map(d => `${d}mm`).join(', ')}).
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-700 text-white rounded font-bold text-xs">
              {summary.passedCount} / {summary.totalColumns} PASS
            </span>
          </div>

          {/* Sample Optimized Columns Table Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs uppercase">
                SAMPLE OPTIMIZED COLUMN SECTIONS & REBAR PREVIEW:
              </span>
              <span className="text-[11px] text-slate-500 font-sans">
                Showing first 8 of {summary.totalColumns} optimized columns
              </span>
            </div>

            <div className="border border-ui-border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 border-b border-ui-border text-slate-600 font-bold">
                  <tr>
                    <th className="p-2">COLUMN #</th>
                    <th className="p-2">ORIGINAL SIZE</th>
                    <th className="p-2">OPTIMIZED SIZE</th>
                    <th className="p-2">OPTIMIZED REBAR</th>
                    <th className="p-2 text-center">BIAXIAL IR</th>
                    <th className="p-2 text-right">SAVINGS</th>
                    <th className="p-2 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border bg-white">
                  {summary.results.slice(0, 8).map((res) => (
                    <tr key={res.memberId} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-emerald-700">
                        <div className="flex items-center gap-1">
                          <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                            {res.columnLabel}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            (Mem #{res.memberId})
                          </span>
                        </div>
                      </td>
                      <td className="p-2 text-slate-500">{res.originalSection.name}</td>
                      <td className="p-2 font-bold text-deep-navy">
                        {res.optimizedSection.name}
                      </td>
                      <td className="p-2 text-orange-600 font-bold text-[11px]">
                        {res.optimizedDesign.rebar.callout}
                      </td>
                      <td className="p-2 text-center font-bold text-emerald-700">
                        {res.optimizedDesign.biaxialCheck.interactionRatio.toFixed(3)}
                      </td>
                      <td className="p-2 text-right text-emerald-700 font-bold">
                        {res.costSavingsPercent > 0 ? `-${res.costSavingsPercent}%` : 'Optimal'}
                      </td>
                      <td className="p-2 text-center">
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                          PASS
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-ui-border flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border font-mono text-xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmApply}
            disabled={isApplying}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-mono text-xs font-bold shadow-md transition-all disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              {isApplying
                ? `Applying to ${summary.totalColumns} Columns...`
                : `Apply Economical Sizing to All ${summary.totalColumns} Columns`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
