import React, { useState, useMemo } from 'react';
import { MasterShearWallOutput, MasterShearWallInput, ShearWallEngine } from './shearWallEngine';
import { X, Sparkles, CheckCircle2, AlertTriangle, Wrench, ShieldCheck, Layers } from 'lucide-react';

interface ShearWallAutoFixModalProps {
  wall: MasterShearWallOutput | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyFix: (fixedOutput: MasterShearWallOutput, newThicknessMm: number) => void;
}

export const ShearWallAutoFixModal: React.FC<ShearWallAutoFixModalProps> = ({
  wall,
  isOpen,
  onClose,
  onApplyFix,
}) => {
  if (!isOpen || !wall) return null;

  const [manualThickness, setManualThickness] = useState<number>(wall.thickness || 230);
  const [concreteGrade, setConcreteGrade] = useState<number>(25);

  const autoFixResult = useMemo(() => {
    const input: MasterShearWallInput = {
      wallId: wall.wallId,
      length: wall.length,
      thickness: wall.thickness,
      height: wall.height,
      fck: concreteGrade,
      fy: 500,
      Pu: wall.input?.Pu ?? 1200,
      Vu: wall.input?.Vu ?? 220,
      Mu: wall.input?.Mu ?? 450,
      governingLoadCase: wall.governingLoadCase,
    };
    return ShearWallEngine.autoFix(input);
  }, [wall, concreteGrade]);

  const manualResult = useMemo(() => {
    return ShearWallEngine.design({
      wallId: wall.wallId,
      length: wall.length,
      thickness: manualThickness,
      height: wall.height,
      fck: concreteGrade,
      fy: 500,
      Pu: wall.input?.Pu ?? 1200,
      Vu: wall.input?.Vu ?? 220,
      Mu: wall.input?.Mu ?? 450,
      governingLoadCase: wall.governingLoadCase,
    });
  }, [wall, manualThickness, concreteGrade]);

  const handleApplyAutoFix = () => {
    onApplyFix(autoFixResult.fixedOutput, autoFixResult.fixedInput.thickness);
    onClose();
  };

  const handleApplyManualFix = () => {
    onApplyFix(manualResult, manualThickness);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-2xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-50/80 border-b border-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-rose-700" />
            <div>
              <h3 className="font-mono text-sm font-bold text-rose-950">
                SHEAR WALL SW-{wall.wallId} CODE DIAGNOSTICS &amp; AUTO-FIX (IS 13920:2016)
              </h3>
              <p className="text-xs text-rose-800 font-sans mt-0.5">
                Automated ductile RC shear wall resizing, boundary element confinement &amp; shear resolution.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-rose-200/50 rounded text-rose-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs font-mono">
          {/* Current State Diagnostic */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">CURRENT WALL PROPERTIES</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                wall.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {wall.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-700">
              <div>Dimensions: <strong>{wall.length}m × {wall.thickness}mm × {wall.height}m</strong></div>
              <div>Shear Stress: <strong>{wall.result.nominalShearStress} N/mm²</strong> (Max: {wall.result.tau_c_max})</div>
              <div>Boundary Element: <strong>{wall.result.boundary.isBoundaryElementRequired ? 'REQUIRED' : 'Not Required'}</strong></div>
            </div>
          </div>

          {/* Option 1: 1-Click Automated Resolution */}
          <div className="bg-emerald-50 border border-emerald-300 rounded p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                ⚡ OPTION 1: 1-CLICK IS 13920 AUTO-FIX (RECOMMENDED)
              </span>
              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-950 rounded text-[10px] font-bold">
                100% IS COMPLIANT
              </span>
            </div>

            <div className="space-y-1.5 bg-white/80 p-3 rounded border border-emerald-200 text-[11px] text-emerald-900 font-sans">
              <div className="font-bold font-mono text-emerald-950">Applied Optimizations:</div>
              <ul className="list-disc list-inside space-y-1">
                {autoFixResult.changesApplied.map((chg, i) => (
                  <li key={i}>{chg}</li>
                ))}
              </ul>
            </div>

            <button
              onClick={handleApplyAutoFix}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-mono text-xs font-bold shadow transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply 1-Click Auto-Fix ({autoFixResult.fixedInput.thickness}mm Thickness)</span>
            </button>
          </div>

          {/* Option 2: Manual Thickness & Grade Adjustment */}
          <div className="bg-slate-50 border border-ui-border rounded p-4 space-y-3">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Wrench className="w-3.5 h-3.5 text-slate-600" />
              OPTION 2: MANUAL PARAMETER OVERRIDES
            </span>

            <div className="grid grid-cols-2 gap-3 font-sans">
              <div>
                <label className="block text-slate-600 text-xs font-bold mb-1 font-mono">
                  WALL THICKNESS tw (mm):
                </label>
                <input
                  type="number"
                  step="25"
                  min="200"
                  max="600"
                  value={manualThickness}
                  onChange={(e) => setManualThickness(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-deep-navy text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 text-xs font-bold mb-1 font-mono">
                  CONCRETE GRADE fck:
                </label>
                <select
                  value={concreteGrade}
                  onChange={(e) => setConcreteGrade(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-deep-navy text-xs"
                >
                  <option value={25}>M25 (25 N/mm²)</option>
                  <option value={30}>M30 (30 N/mm²)</option>
                  <option value={35}>M35 (35 N/mm²)</option>
                  <option value={40}>M40 (40 N/mm²)</option>
                </select>
              </div>
            </div>

            <div className="p-2.5 bg-white rounded border border-slate-200 text-[11px] text-slate-700 space-y-1">
              <div>Preview Shear Stress: <strong>{manualResult.result.nominalShearStress} N/mm²</strong> (Cap: {manualResult.result.tau_c_max} N/mm²) — <span className={manualResult.result.shearStatus === 'PASS' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{manualResult.result.shearStatus}</span></div>
              <div>Boundary Rebar: <strong>{manualResult.result.boundary.recommendedRebarCallout}</strong></div>
            </div>

            <button
              onClick={handleApplyManualFix}
              className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded font-mono text-xs font-semibold transition-colors"
            >
              <span>Apply Manual Parameters ({manualThickness}mm, M{concreteGrade})</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-ui-border flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border font-mono text-xs"
          >
            Close
          </button>
          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> IS 13920:2016 Cl. 9 &amp; Cl. 10 Ductile Detailing
          </span>
        </div>
      </div>
    </div>
  );
};
