import React, { useState, useMemo } from 'react';
import { GradeBeamDesignOutput, GradeBeamOverride } from './gradeBeamEngine';
import { IS13920GradeBeam } from '@/features/codes/is13920/gradeBeam';
import { X, Layers, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Save } from 'lucide-react';

interface GradeBeamEditModalProps {
  gradeBeam: GradeBeamDesignOutput | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (gradeBeamId: string, override: GradeBeamOverride) => void;
  onReset: (gradeBeamId: string) => void;
}

const COMMON_WIDTHS = [250, 300, 350, 400, 450, 500, 600];
const COMMON_DEPTHS = [300, 350, 400, 450, 500, 550, 600, 700, 750, 800, 900];
const BAR_DIAMETERS = [12, 16, 20, 25, 28, 32];
const STIRRUP_DIAMETERS = [8, 10, 12];

export const GradeBeamEditModal: React.FC<GradeBeamEditModalProps> = ({
  gradeBeam,
  isOpen,
  onClose,
  onSave,
  onReset,
}) => {
  if (!isOpen || !gradeBeam) return null;

  const gb = gradeBeam;

  // Parse existing top rebar callout (e.g. "3-T16")
  const defaultTopCount = gb.override?.customTopCount || parseInt(gb.topRebarCallout.split('-T')[0]) || 2;
  const defaultTopDia = gb.override?.customTopDia || parseInt(gb.topRebarCallout.split('-T')[1]) || 16;
  const defaultBotCount = gb.override?.customBottomCount || parseInt(gb.bottomRebarCallout.split('-T')[0]) || 2;
  const defaultBotDia = gb.override?.customBottomDia || parseInt(gb.bottomRebarCallout.split('-T')[1]) || 16;
  const defaultEndSpacing = gb.override?.customEndSpacing || gb.endZoneSpacing || 100;
  const defaultMidSpacing = gb.override?.customMidSpacing || gb.midZoneSpacing || 150;
  const defaultStirrupDia = gb.override?.customStirrupDia || 8;

  const [b, setB] = useState<number>(gb.override?.b || gb.b);
  const [D, setD] = useState<number>(gb.override?.D || gb.D);
  const [topCount, setTopCount] = useState<number>(defaultTopCount);
  const [topDia, setTopDia] = useState<number>(defaultTopDia);
  const [botCount, setBotCount] = useState<number>(defaultBotCount);
  const [botDia, setBotDia] = useState<number>(defaultBotDia);
  const [stirrupDia, setStirrupDia] = useState<number>(defaultStirrupDia);
  const [endSpacing, setEndSpacing] = useState<number>(defaultEndSpacing);
  const [midSpacing, setMidSpacing] = useState<number>(defaultMidSpacing);

  // Live Engineering Verification
  const liveCheck = useMemo(() => {
    return IS13920GradeBeam.design({
      b,
      D,
      spanLength: gb.spanLength,
      fck: 25,
      fy: 500,
      factoredPu1: gb.factoredPu1,
      factoredPu2: gb.factoredPu2,
      customTopCount: topCount,
      customTopDia: topDia,
      customBottomCount: botCount,
      customBottomDia: botDia,
      customStirrupDia: stirrupDia,
      customEndSpacing: endSpacing,
      customMidSpacing: midSpacing,
    });
  }, [b, D, gb.spanLength, gb.factoredPu1, gb.factoredPu2, topCount, topDia, botCount, botDia, stirrupDia, endSpacing, midSpacing]);

  const topAstProv = Math.round((topCount * Math.PI * topDia * topDia) / 4);
  const botAstProv = Math.round((botCount * Math.PI * botDia * botDia) / 4);

  const handleSave = () => {
    const override: GradeBeamOverride = {
      b,
      D,
      customTopCount: topCount,
      customTopDia: topDia,
      customBottomCount: botCount,
      customBottomDia: botDia,
      customStirrupDia: stirrupDia,
      customEndSpacing: endSpacing,
      customMidSpacing: midSpacing,
      topRebarCallout: `${topCount}-T${topDia} (Continuous Full Length)`,
      bottomRebarCallout: `${botCount}-T${botDia} (Continuous Full Length)`,
      stirrupCallout: `2L-${stirrupDia}mm @ ${endSpacing}mm c/c (End ${2 * D}mm zone) / ${midSpacing}mm c/c (Mid)`,
    };
    onSave(gb.gradeBeamId, override);
    onClose();
  };

  const handleReset = () => {
    onReset(gb.gradeBeamId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="font-mono text-sm font-bold text-deep-navy">
                EDIT GRADE BEAM SECTION &amp; REBARS — {gb.gradeBeamId}
              </h3>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Connecting {gb.startPileCapLabel} ({gb.startColumnLabel}) ↔ {gb.endPileCapLabel} ({gb.endColumnLabel}) • Span L = {gb.spanLength}m
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs font-mono overflow-y-auto flex-1">
          {/* Status Banner */}
          <div className={`p-3 rounded border flex items-center justify-between ${
            liveCheck.status === 'PASS'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}>
            <div className="flex items-center gap-2">
              {liveCheck.status === 'PASS' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <div>
                <span className="font-bold">IS 13920:2016 STATUS: {liveCheck.status}</span>
                <div className="text-[11px] text-slate-600 font-sans">
                  Tie Force Demand P_tie = {liveCheck.factoredTensionTiePu} kN • Req Ast = {liveCheck.astReqTotal} mm²
                </div>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200">
              {b} × {D} mm
            </span>
          </div>

          {liveCheck.warnings.length > 0 && (
            <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded text-[11px] text-amber-800 space-y-1">
              {liveCheck.warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Section Sizing */}
          <div className="space-y-2 p-3 bg-slate-50 rounded border border-slate-200">
            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
              1. Concrete Cross-Section Sizing
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Width b (mm):</label>
                <div className="flex gap-2">
                  <select
                    value={b}
                    onChange={(e) => setB(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  >
                    {COMMON_WIDTHS.map((w) => (
                      <option key={w} value={w}>{w} mm</option>
                    ))}
                  </select>
                </div>
                <span className="text-[10px] text-slate-500">IS 13920 min: 250 mm</span>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Overall Depth D (mm):</label>
                <div className="flex gap-2">
                  <select
                    value={D}
                    onChange={(e) => setD(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                  >
                    {COMMON_DEPTHS.map((d) => (
                      <option key={d} value={d}>{d} mm</option>
                    ))}
                  </select>
                </div>
                <span className="text-[10px] text-slate-500">Effective depth d = {D - 50} mm</span>
              </div>
            </div>
          </div>

          {/* Longitudinal Reinforcement */}
          <div className="space-y-3 p-3 bg-slate-50 rounded border border-slate-200">
            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
              2. Continuous Longitudinal Rebar (IS 13920 Cl. 11.2 &amp; Cl. 6.2)
            </span>

            {/* Top Rebar */}
            <div className="p-2.5 bg-white rounded border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-700">Top Longitudinal Steel</span>
                <span className={`text-[11px] font-bold ${topAstProv >= liveCheck.astReqTotal ? 'text-emerald-700' : 'text-rose-700'}`}>
                  Provided: {topAstProv} mm² ({topCount}-T{topDia}) • Req: {liveCheck.astReqTotal} mm²
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 text-[10px]">Bar Count:</label>
                  <select
                    value={topCount}
                    onChange={(e) => setTopCount(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-ui-border rounded text-xs font-mono"
                  >
                    {[2, 3, 4, 5, 6, 8].map((c) => (
                      <option key={c} value={c}>{c} bars</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px]">Bar Diameter:</label>
                  <select
                    value={topDia}
                    onChange={(e) => setTopDia(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-ui-border rounded text-xs font-mono"
                  >
                    {BAR_DIAMETERS.map((d) => (
                      <option key={d} value={d}>T{d} ({d} mm)</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Bottom Rebar */}
            <div className="p-2.5 bg-white rounded border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-orange-700">Bottom Longitudinal Steel</span>
                <span className={`text-[11px] font-bold ${botAstProv >= liveCheck.astReqTotal ? 'text-emerald-700' : 'text-rose-700'}`}>
                  Provided: {botAstProv} mm² ({botCount}-T{botDia}) • Req: {liveCheck.astReqTotal} mm²
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 text-[10px]">Bar Count:</label>
                  <select
                    value={botCount}
                    onChange={(e) => setBotCount(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-ui-border rounded text-xs font-mono"
                  >
                    {[2, 3, 4, 5, 6, 8].map((c) => (
                      <option key={c} value={c}>{c} bars</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px]">Bar Diameter:</label>
                  <select
                    value={botDia}
                    onChange={(e) => setBotDia(Number(e.target.value))}
                    className="w-full px-2 py-1 bg-white border border-ui-border rounded text-xs font-mono"
                  >
                    {BAR_DIAMETERS.map((d) => (
                      <option key={d} value={d}>T{d} ({d} mm)</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Confinement Stirrups */}
          <div className="space-y-2 p-3 bg-slate-50 rounded border border-slate-200">
            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
              3. Confinement Ties / Stirrups (IS 13920 Cl. 11.2.3 &amp; Cl. 6.3.5)
            </span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Stirrup Bar:</label>
                <select
                  value={stirrupDia}
                  onChange={(e) => setStirrupDia(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-white border border-ui-border rounded text-xs font-mono"
                >
                  {STIRRUP_DIAMETERS.map((d) => (
                    <option key={d} value={d}>2L-{d} mm</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">End Zone Spacing:</label>
                <input
                  type="number"
                  step={5}
                  value={endSpacing}
                  onChange={(e) => setEndSpacing(Math.max(50, Number(e.target.value)))}
                  className="w-full px-2 py-1 bg-white border border-ui-border rounded text-xs font-mono"
                />
                <span className="text-[10px] text-slate-500">Zone len = {2 * D} mm</span>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Mid Zone Spacing:</label>
                <input
                  type="number"
                  step={5}
                  value={midSpacing}
                  onChange={(e) => setMidSpacing(Math.max(75, Number(e.target.value)))}
                  className="w-full px-2 py-1 bg-white border border-ui-border rounded text-xs font-mono"
                />
                <span className="text-[10px] text-slate-500">Max = 200 mm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-ui-border flex items-center justify-between shrink-0 font-mono text-xs">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-rose-700 border border-rose-200 rounded font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Auto</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-ui-border rounded font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
