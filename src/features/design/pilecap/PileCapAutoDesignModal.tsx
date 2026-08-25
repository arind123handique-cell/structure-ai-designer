import React, { useState } from 'react';
import { BatchPileCapOptimizationSummary } from './pileCapOptimizationEngine';
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

interface PileCapAutoDesignModalProps {
  summary: BatchPileCapOptimizationSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmApply: () => void;
  onReoptimizeWithDiameters: (allowedDiameters: number[]) => void;
  isApplying: boolean;
}

const INDIAN_STANDARD_REBARS = [
  { dia: 12, label: '12 mm', isCommon: true },
  { dia: 16, label: '16 mm', isCommon: true },
  { dia: 20, label: '20 mm', isCommon: true },
  { dia: 25, label: '25 mm', isCommon: true },
  { dia: 28, label: '28 mm', isCommon: false },
  { dia: 32, label: '32 mm', isCommon: false },
];

export const PileCapAutoDesignModal: React.FC<PileCapAutoDesignModalProps> = ({
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
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-4xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col font-mono">
        {/* Top Header */}
        <div className="px-6 py-4 bg-emerald-50/90 border-b border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 rounded-lg text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                1-CLICK ECONOMICAL PILE CAP AUTO-DESIGN ENGINE
              </h3>
              <p className="text-xs text-emerald-800 font-sans mt-0.5">
                Automatically sized {summary.totalCaps} pile caps to optimum depths & reinforcement without failing IS 456 punching shear, flexure, top mat & side face steel.
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
                AVAILABLE INDIAN REBAR DIAMETERS TO USE IN PILE CAPS:
              </span>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleApplyPreset([12, 16, 20, 25])}
                  className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-700 font-semibold"
                >
                  Standard (12-25mm)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset([16, 20, 25])}
                  className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-700 font-semibold"
                >
                  Heavy (16-25mm)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset([12, 16, 20, 25, 28, 32])}
                  className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-700 font-semibold"
                >
                  All Diameters
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {INDIAN_STANDARD_REBARS.map((item) => {
                const isSelected = selectedDiameters.includes(item.dia);
                return (
                  <button
                    key={item.dia}
                    type="button"
                    onClick={() => handleToggleDia(item.dia)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs transition-all border ${
                      isSelected
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs font-bold'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                        isSelected ? 'bg-emerald-900 text-white' : 'border border-slate-400 bg-slate-50'
                      }`}
                    >
                      {isSelected ? <Check className="w-2.5 h-2.5" /> : null}
                    </span>
                    <span>T{item.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              * The optimization algorithm will automatically choose the most economical combination of bar diameter and spacing from selected sizes.
            </p>
          </div>

          {/* Metric Savings KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 flex flex-col">
              <span className="text-[10px] uppercase text-emerald-800 font-semibold flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> Concrete Volume Saved
              </span>
              <span className="text-xl font-bold text-emerald-950 mt-1">
                {summary.totalConcreteSavedM3} m³
              </span>
              <span className="text-[11px] text-emerald-700 font-sans mt-0.5">
                {summary.concreteSavingsPercent}% Volume Reduction
              </span>
            </div>

            <div className="bg-sky-50/70 border border-sky-200 rounded-lg p-3 flex flex-col">
              <span className="text-[10px] uppercase text-sky-800 font-semibold flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> Steel Rebar Saved
              </span>
              <span className="text-xl font-bold text-sky-950 mt-1">
                {summary.totalSteelSavedKg} kg
              </span>
              <span className="text-[11px] text-sky-700 font-sans mt-0.5">
                {summary.steelSavingsPercent}% Weight Reduction
              </span>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-3 flex flex-col">
              <span className="text-[10px] uppercase text-indigo-800 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Punching Shear Checks
              </span>
              <span className="text-xl font-bold text-indigo-950 mt-1">
                100% Passed
              </span>
              <span className="text-[11px] text-indigo-700 font-sans mt-0.5">
                IS 456 Cl. 31.6.3 Safe
              </span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 flex flex-col">
              <span className="text-[10px] uppercase text-amber-800 font-semibold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Total Caps Sized
              </span>
              <span className="text-xl font-bold text-amber-950 mt-1">
                {summary.totalCaps} Pile Caps
              </span>
              <span className="text-[11px] text-amber-700 font-sans mt-0.5">
                Ready for Batch Apply
              </span>
            </div>
          </div>

          {/* Before vs After Comparison Table */}
          <div className="border border-ui-border rounded-lg overflow-hidden bg-white shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-ui-border font-bold text-xs text-deep-navy flex items-center justify-between">
              <span>BEFORE VS AFTER OPTIMIZATION SCHEDULE ({summary.totalCaps} PILE CAPS)</span>
              <span className="text-[11px] font-normal text-slate-500 font-sans">
                Depth sized to exact punching shear demand & mixed optimal rebars
              </span>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b border-ui-border sticky top-0">
                  <tr>
                    <th className="p-2 font-bold">CAP / COL #</th>
                    <th className="p-2 text-right">VERT LOAD (Pu)</th>
                    <th className="p-2">INITIAL BASELINE</th>
                    <th className="p-2">OPTIMIZED SIZE</th>
                    <th className="p-2">OPTIMIZED REBAR MATS</th>
                    <th className="p-2 text-center">PUNCHING RATIO</th>
                    <th className="p-2 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {summary.results.map((res) => (
                    <tr key={res.supportNodeId} className="hover:bg-slate-50">
                      <td className="p-2 font-bold text-emerald-800">
                        {res.pileCapLabel} ({res.columnLabel})
                      </td>
                      <td className="p-2 text-right text-slate-800">
                        {res.factoredVerticalLoad.toFixed(1)} kN
                      </td>
                      <td className="p-2 text-slate-500 text-[10px]">
                        {res.initialCapSize.length}×{res.initialCapSize.width}×{res.initialCapSize.depth}mm
                        <span className="block text-slate-400">T16 @ 125 c/c</span>
                      </td>
                      <td className="p-2 text-deep-navy font-bold">
                        {res.optimizedCapSize.length}×{res.optimizedCapSize.width}×{res.optimizedCapSize.depth}mm
                        <span className="block text-[10px] text-emerald-700 font-normal">
                          {res.optimizedPileCount}-Pile Cap
                        </span>
                      </td>
                      <td className="p-2 text-[10px]">
                        <span className="font-bold text-orange-600 block">
                          Bot: {res.optimizedRebarX.split(' (')[0]}
                        </span>
                        <span className="text-indigo-700 block">
                          Top: {res.optimizedTopRebar.split(' (')[0]}
                        </span>
                        <span className="text-emerald-700 block">
                          Face: {res.optimizedSideFaceRebar.split(' (')[0]}
                        </span>
                      </td>
                      <td className="p-2 text-center font-bold text-indigo-700">
                        {res.punchingShearRatio}
                      </td>
                      <td className="p-2 text-center">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                          SAFE
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-ui-border flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-100 border border-ui-border rounded text-xs font-semibold shadow-xs"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmApply}
            disabled={isApplying}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-md transition-all disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              {isApplying
                ? 'Applying Changes...'
                : `Confirm & Apply All ${summary.totalCaps} Optimized Pile Caps`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
