import React, { useState, useEffect, useMemo } from 'react';
import { ColumnDesignOutput } from './columnDesignEngine';
import { ColumnBarArrangement, ColumnRebarOption } from './barArrangement';
import { X, Sparkles, Check, Layers, Sliders, CheckCircle, ShieldCheck, ArrowRight, Zap } from 'lucide-react';

interface ColumnRebarEditModalProps {
  column: ColumnDesignOutput | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyRebar: (memberId: number, customRebar: ColumnRebarOption, applyAll: boolean) => void;
  allowedDiameters?: number[];
}

const PRESET_CONFIGS = [
  { label: '8-T20 (8 bars, 2513 mm²) — Standard 8-Bar Practical', cornerDia: 20, faceDia: 20, nX: 1, nY: 1 },
  { label: '4-T20 + 4-T16 (8 bars, 2061 mm²) — Practical Mixed 8-Bar', cornerDia: 20, faceDia: 16, nX: 1, nY: 1 },
  { label: '10-T16 (10 bars, 2011 mm²) — Standard 10-Bar', cornerDia: 16, faceDia: 16, nX: 2, nY: 1 },
  { label: '12-T16 (12 bars, 2413 mm²) — Standard 12-Bar', cornerDia: 16, faceDia: 16, nX: 2, nY: 2 },
  { label: '4-T20 + 8-T16 (12 bars, 2865 mm²) — Heavy Demand Mixed', cornerDia: 20, faceDia: 16, nX: 2, nY: 2 },
  { label: '8-T16 (8 bars, 1608 mm²) — Light Demand 8-Bar', cornerDia: 16, faceDia: 16, nX: 1, nY: 1 },
  { label: '6-T20 (6 bars, 1885 mm²) — Standard 6-Bar', cornerDia: 20, faceDia: 20, nX: 1, nY: 0 },
  { label: '4-T16 + 12-T12 (16 bars, 2161 mm²) — 16-Bar Layout', cornerDia: 16, faceDia: 12, nX: 4, nY: 2 },
  { label: '4-T25 + 8-T20 (12 bars, 4477 mm²) — High Rise Heavy', cornerDia: 25, faceDia: 20, nX: 2, nY: 2 },
  { label: '12-T20 (12 bars, 3770 mm²) — Heavy Uniform', cornerDia: 20, faceDia: 20, nX: 2, nY: 2 },
];

export const ColumnRebarEditModal: React.FC<ColumnRebarEditModalProps> = ({
  column,
  isOpen,
  onClose,
  onApplyRebar,
  allowedDiameters,
}) => {
  const [cornerDia, setCornerDia] = useState<number>(20);
  const [faceDia, setFaceDia] = useState<number>(20);
  const [nX, setNX] = useState<number>(1); // depth face
  const [nY, setNY] = useState<number>(1); // width face
  const [applyScope, setApplyScope] = useState<'SINGLE' | 'ALL'>('SINGLE');

  const b = column ? parseFloat(column.dimensions.split('×')[0]) || 450 : 450;
  const D = column ? parseFloat(column.dimensions.split('×')[1]) || 550 : 550;
  const Ag = b * D;
  const Asc_req = column ? (0.008 * Ag) : 1980;

  // Initialize from active column
  useEffect(() => {
    if (isOpen && column) {
      setCornerDia(column.rebar.cornerBars.diameter || 20);
      if (column.rebar.faceBars) {
        setFaceDia(column.rebar.faceBars.diameter || 16);
        setNX(column.rebar.faceBars.countX ?? 1);
        setNY(column.rebar.faceBars.countY ?? 1);
      } else {
        setFaceDia(column.rebar.cornerBars.diameter || 20);
        setNX(1);
        setNY(1);
      }
      setApplyScope('SINGLE');
    }
  }, [isOpen, column]);

  // Live computed rebar option
  const liveOption: ColumnRebarOption = useMemo(() => {
    return ColumnBarArrangement.createCustomRebarOption(cornerDia, faceDia, nX, nY, b, D, 40);
  }, [cornerDia, faceDia, nX, nY, b, D]);

  // 1-Click Auto Practical Configurator
  const handleAutoPracticalConfig = () => {
    const opt = ColumnBarArrangement.selectBars(Asc_req, b, D, 40, allowedDiameters);
    setCornerDia(opt.cornerBars.diameter);
    if (opt.faceBars) {
      setFaceDia(opt.faceBars.diameter);
      setNX(opt.faceBars.countX);
      setNY(opt.faceBars.countY);
    } else {
      setFaceDia(opt.cornerBars.diameter);
      setNX(0);
      setNY(0);
    }
  };

  const validDias = allowedDiameters && allowedDiameters.length > 0 ? allowedDiameters : [12, 16, 20, 25, 28, 32];

  if (!isOpen || !column) return null;

  const handleApply = () => {
    onApplyRebar(column.memberId, liveOption, applyScope === 'ALL');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col font-mono">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-50/80 border-b border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                PRACTICAL COLUMN REBAR OPTIMIZER — COLUMN C-{column.memberId}
              </h3>
              <p className="text-xs text-emerald-800 font-sans mt-0.5">
                Clean, constructable layouts (8 to 12 bars) with non-congested spacing & IS 13920 seismic confinement.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-emerald-200/50 rounded text-emerald-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Asc Demand Banner */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-emerald-950 font-bold block text-xs">REQUIRED LONGITUDINAL STEEL (Asc,req):</span>
              <span className="text-[11px] text-emerald-800 font-sans">
                Section: {b}×{D} mm • Factored Pu = {column.axialCheck.Pu_cap_short} kN
              </span>
            </div>
            <div className="text-right font-mono">
              <span className="text-sm font-bold text-emerald-700 block">
                {liveOption.totalArea} mm² Provided
              </span>
              <span className="text-[10px] text-slate-500">
                Min 0.8% Ag: {((0.008 * b * D)).toFixed(0)} mm²
              </span>
            </div>
          </div>

          {/* ⚡ Auto Practical Configurator Button */}
          <div className="flex items-center justify-between bg-sky-50 border border-sky-200 p-2.5 rounded-lg">
            <div className="space-y-0.5">
              <span className="font-bold text-sky-950 block text-xs">⚡ SMART AUTO-CONFIGURATION:</span>
              <span className="text-[10px] text-sky-800 font-sans block">
                Picks optimal 8/10/12-bar layout with spacious non-congested spacing.
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoPracticalConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded font-bold font-mono text-xs shadow-xs transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-200" />
              <span>Auto-Configure</span>
            </button>
          </div>

          {/* Quick Presets Dropdown */}
          <div className="space-y-1.5 font-sans">
            <label className="block text-slate-700 text-xs font-bold font-mono">
              ⚡ SELECT STANDARD RCC REBAR PRESET:
            </label>
            <select
              onChange={(e) => {
                const idx = Number(e.target.value);
                const p = PRESET_CONFIGS[idx];
                if (p) {
                  setCornerDia(p.cornerDia);
                  setFaceDia(p.faceDia);
                  setNX(p.nX);
                  setNY(p.nY);
                }
              }}
              defaultValue=""
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded font-mono text-xs text-deep-navy font-bold focus:border-secondary-brand focus:outline-hidden"
            >
              <option value="" disabled>
                Choose standard column rebar combination...
              </option>
              {PRESET_CONFIGS.map((p, i) => (
                <option key={i} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Custom Bar Controls */}
          <div className="bg-slate-50 border border-ui-border rounded-lg p-4 space-y-4">
            <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-600" />
              CUSTOM LONGITUDINAL BAR DETAILED CONTROLS
            </span>

            {/* 1. Corner Bars */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <span className="text-slate-600 font-bold block">4 Corner Bars:</span>
                <span className="text-[10px] text-slate-500 font-sans">4 corner longitudinal bars</span>
              </div>
              <div>
                <select
                  value={cornerDia}
                  onChange={(e) => setCornerDia(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-orange-600"
                >
                  {validDias.map((d) => (
                    <option key={d} value={d}>
                      4 - T{d} Corner Bars
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Face Bars on Depth D */}
            <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-slate-200">
              <div>
                <span className="text-slate-600 font-bold block">Face Bars along Depth D ({D}mm):</span>
                <span className="text-[10px] text-slate-500 font-sans">Bars placed on left & right faces</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={nX}
                  onChange={(e) => setNX(Number(e.target.value))}
                  className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs"
                >
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n * 2} bars ({n} each face)
                    </option>
                  ))}
                </select>
                <select
                  value={faceDia}
                  onChange={(e) => setFaceDia(Number(e.target.value))}
                  className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-sky-600"
                >
                  {validDias.map((d) => (
                    <option key={d} value={d}>
                      T{d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Face Bars on Width b */}
            <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-slate-200">
              <div>
                <span className="text-slate-600 font-bold block">Face Bars along Width b ({b}mm):</span>
                <span className="text-[10px] text-slate-500 font-sans">Bars placed on top & bottom faces</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={nY}
                  onChange={(e) => setNY(Number(e.target.value))}
                  className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs"
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n * 2} bars ({n} each face)
                    </option>
                  ))}
                </select>
                <select
                  value={faceDia}
                  disabled
                  className="px-2 py-1.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-xs text-sky-600 opacity-80"
                >
                  <option value={faceDia}>T{faceDia}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Live Specification Callout & Space Confinement Box */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 text-xs">CONFIGURED REINFORCEMENT:</span>
              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-950 rounded text-[10px] font-bold">
                {liveOption.callout}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block">Total Bars:</span>
                <span className="font-bold text-deep-navy">{liveOption.totalBars} Bars</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Steel (Asc):</span>
                <span className="font-bold text-sky-700">{liveOption.totalArea} mm²</span>
              </div>
              <div>
                <span className="text-slate-500 block">Steel Ratio (pt):</span>
                <span className="font-bold text-emerald-700">{liveOption.pt_prov}%</span>
              </div>
            </div>
            <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-[11px]">
              <span className="text-emerald-900">
                Spacing along D: <strong>{liveOption.spacingX} mm</strong> | Spacing along b: <strong>{liveOption.spacingY} mm</strong>
              </span>
              <span className={`font-bold ${liveOption.isConfinementCompliant ? 'text-emerald-800' : 'text-rose-700'}`}>
                {liveOption.isConfinementCompliant ? '✓ Confinement OK (≤300mm)' : '✗ Exceeds 300mm'}
              </span>
            </div>
          </div>

          {/* Scope Selection */}
          <div className="space-y-1.5 font-sans">
            <label className="block text-slate-700 text-xs font-bold font-mono">APPLICATION SCOPE:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setApplyScope('SINGLE')}
                className={`py-2 px-3 rounded border text-xs font-mono transition-all ${
                  applyScope === 'SINGLE'
                    ? 'bg-secondary-brand text-white border-secondary-brand font-bold'
                    : 'bg-white text-slate-700 border-ui-border'
                }`}
              >
                Apply to Column C-{column.memberId} Only
              </button>
              <button
                type="button"
                onClick={() => setApplyScope('ALL')}
                className={`py-2 px-3 rounded border text-xs font-mono transition-all ${
                  applyScope === 'ALL'
                    ? 'bg-secondary-brand text-white border-secondary-brand font-bold'
                    : 'bg-white text-slate-700 border-ui-border'
                }`}
              >
                Apply to All Columns
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-ui-border flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border font-mono text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-mono text-xs font-bold shadow transition-all"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Apply Rebar Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
};
