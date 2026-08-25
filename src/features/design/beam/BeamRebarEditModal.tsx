import React, { useState, useEffect, useMemo } from 'react';
import { BeamDesignOutput } from './beamDesignEngine';
import { BeamBarArrangement, AstBarOption, BeamCurtailmentDetail } from './barArrangement';
import { X, Sparkles, Check, Layers, Sliders, CheckCircle, ShieldCheck, ArrowRight } from 'lucide-react';

interface BeamRebarEditModalProps {
  beam: BeamDesignOutput | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyRebar: (
    memberId: number,
    topCurtailment: { throughCount: number; throughDia: number; extraCount: number; extraDia: number },
    botCurtailment: { throughCount: number; throughDia: number; extraCount: number; extraDia: number },
    applyScope: 'SINGLE' | 'FLOOR' | 'ALL'
  ) => void;
}

export const BeamRebarEditModal: React.FC<BeamRebarEditModalProps> = ({
  beam,
  isOpen,
  onClose,
  onApplyRebar,
}) => {
  const [activeTab, setActiveTab] = useState<'TOP' | 'BOTTOM'>('TOP');

  // Top Rebar Inputs
  const [topThroughCount, setTopThroughCount] = useState<number>(2);
  const [topThroughDia, setTopThroughDia] = useState<number>(12);
  const [topExtraCount, setTopExtraCount] = useState<number>(1);
  const [topExtraDia, setTopExtraDia] = useState<number>(16);

  // Bottom Rebar Inputs
  const [botThroughCount, setBotThroughCount] = useState<number>(2);
  const [botThroughDia, setBotThroughDia] = useState<number>(12);
  const [botExtraCount, setBotExtraCount] = useState<number>(1);
  const [botExtraDia, setBotExtraDia] = useState<number>(16);

  const [applyScope, setApplyScope] = useState<'SINGLE' | 'FLOOR' | 'ALL'>('SINGLE');

  const b = beam ? parseFloat(beam.dimensions.split('×')[0]) || 300 : 300;
  const D = beam ? parseFloat(beam.dimensions.split('×')[1]) || 450 : 450;
  const span = beam?.spanLength || 4.0;

  const Ast_top_req = beam?.flexureTop.Ast_req || 280;
  const Ast_bot_req = beam?.flexureBottom.Ast_req || 210;

  // Initialize from beam
  useEffect(() => {
    if (isOpen && beam) {
      const cur = beam.curtailment;
      if (cur) {
        setTopThroughCount(cur.throughTop.count || 2);
        setTopThroughDia(cur.throughTop.diameter || 12);
        setTopExtraCount(cur.extraTopSupport.hasExtra ? cur.extraTopSupport.count : 0);
        setTopExtraDia(cur.extraTopSupport.diameter || 16);

        setBotThroughCount(cur.throughBottom.count || 2);
        setBotThroughDia(cur.throughBottom.diameter || 12);
        setBotExtraCount(cur.extraBottomMidspan.hasExtra ? cur.extraBottomMidspan.count : 0);
        setBotExtraDia(cur.extraBottomMidspan.diameter || 16);
      }
      setApplyScope('SINGLE');
    }
  }, [isOpen, beam]);

  // Ranked Ast Options for Top & Bottom
  const topAstOptions = useMemo(() => {
    return BeamBarArrangement.generateAstOptions(Ast_top_req, b, 30);
  }, [Ast_top_req, b]);

  const botAstOptions = useMemo(() => {
    return BeamBarArrangement.generateAstOptions(Ast_bot_req, b, 30);
  }, [Ast_bot_req, b]);

  // Live calculation for Top Rebar
  const liveTopArea = useMemo(() => {
    const aThru = topThroughCount * ((Math.PI * topThroughDia * topThroughDia) / 4);
    const aExtra = topExtraCount * ((Math.PI * topExtraDia * topExtraDia) / 4);
    return parseFloat((aThru + aExtra).toFixed(1));
  }, [topThroughCount, topThroughDia, topExtraCount, topExtraDia]);

  // Live calculation for Bottom Rebar
  const liveBotArea = useMemo(() => {
    const aThru = botThroughCount * ((Math.PI * botThroughDia * botThroughDia) / 4);
    const aExtra = botExtraCount * ((Math.PI * botExtraDia * botExtraDia) / 4);
    return parseFloat((aThru + aExtra).toFixed(1));
  }, [botThroughCount, botThroughDia, botExtraCount, botExtraDia]);

  if (!isOpen || !beam) return null;

  const handleApplyPreset = (opt: AstBarOption, isTop: boolean) => {
    if (isTop) {
      if (opt.type === 'UNIFORM') {
        setTopThroughCount(opt.barCount);
        setTopThroughDia(opt.mainDiameter);
        setTopExtraCount(0);
      } else if (opt.type === 'EXTRA') {
        setTopThroughCount(2);
        setTopThroughDia(12);
        setTopExtraCount(opt.barCount - 2);
        setTopExtraDia(opt.mainDiameter);
      } else {
        setTopThroughCount(2);
        setTopThroughDia(opt.mainDiameter);
        setTopExtraCount(opt.barCount - 2);
        setTopExtraDia(12);
      }
    } else {
      if (opt.type === 'UNIFORM') {
        setBotThroughCount(opt.barCount);
        setBotThroughDia(opt.mainDiameter);
        setBotExtraCount(0);
      } else if (opt.type === 'EXTRA') {
        setBotThroughCount(2);
        setBotThroughDia(12);
        setBotExtraCount(opt.barCount - 2);
        setBotExtraDia(opt.mainDiameter);
      } else {
        setBotThroughCount(2);
        setBotThroughDia(opt.mainDiameter);
        setBotExtraCount(opt.barCount - 2);
        setBotExtraDia(12);
      }
    }
  };

  const handleSave = () => {
    onApplyRebar(
      beam.memberId,
      {
        throughCount: topThroughCount,
        throughDia: topThroughDia,
        extraCount: topExtraCount,
        extraDia: topExtraDia,
      },
      {
        throughCount: botThroughCount,
        throughDia: botThroughDia,
        extraCount: botExtraCount,
        extraDia: botExtraDia,
      },
      applyScope
    );
    onClose();
  };

  const isTopCompliant = liveTopArea >= Ast_top_req;
  const isBotCompliant = liveBotArea >= Ast_bot_req;

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-2xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col font-mono">
        {/* Header */}
        <div className="px-6 py-4 bg-sky-50/80 border-b border-sky-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-700" />
            <div>
              <h3 className="font-bold text-sm text-sky-950">
                Ast REBAR OPTIMIZER & MODIFIER — BEAM B-{beam.memberId} ({b} × {D} mm)
              </h3>
              <p className="text-xs text-sky-800 font-sans mt-0.5">
                Optimize through bars and curtailed extra bars based on exact required tension steel (Ast,req).
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-sky-200/50 rounded text-sky-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-ui-border bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('TOP')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'TOP'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>TOP HOGGING STEEL (Ast,req = {Ast_top_req} mm²)</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${isTopCompliant ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {liveTopArea} mm²
            </span>
          </button>
          <button
            onClick={() => setActiveTab('BOTTOM')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'BOTTOM'
                ? 'border-sky-500 text-sky-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>BOTTOM SAGGING STEEL (Ast,req = {Ast_bot_req} mm²)</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${isBotCompliant ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {liveBotArea} mm²
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs max-h-[60vh] overflow-y-auto">
          {activeTab === 'TOP' ? (
            <div className="space-y-4">
              {/* Top Support Demand Summary */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-orange-950 font-bold block text-xs">TOP SUPPORT REBAR DEMAND (Ast,req):</span>
                  <span className="text-[11px] text-orange-800 font-sans">
                    Design Hogging Moment Mu = {Math.abs(beam.flexureTop.Mu_lim || 45).toFixed(1)} kNm
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-sm font-bold text-orange-600 block">{Ast_top_req} mm²</span>
                  <span className="text-[10px] text-slate-500">Min IS 13920: {beam.ductility.Ast_min_ductile} mm²</span>
                </div>
              </div>

              {/* Detailed Selectors for Top Rebar */}
              <div className="bg-slate-50 border border-ui-border rounded-lg p-4 space-y-3">
                <span className="font-bold text-slate-800 text-xs block">
                  MANUAL TOP REBAR CONTROLS:
                </span>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <span className="text-slate-600 font-bold block">1. Continuous Through Bars:</span>
                    <span className="text-[10px] text-slate-500 font-sans">Anchored into columns Ld</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={topThroughCount}
                      onChange={(e) => setTopThroughCount(Number(e.target.value))}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs"
                    >
                      {[2, 3, 4].map((c) => (
                        <option key={c} value={c}>{c} Bars</option>
                      ))}
                    </select>
                    <select
                      value={topThroughDia}
                      onChange={(e) => setTopThroughDia(Number(e.target.value))}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-orange-600"
                    >
                      {[12, 16, 20, 25].map((d) => (
                        <option key={d} value={d}>T{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-600 font-bold block">2. Extra Hogging Bars (@ L/3):</span>
                    <span className="text-[10px] text-slate-500 font-sans">Cut off at L/3 = {(span / 3).toFixed(2)}m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={topExtraCount}
                      onChange={(e) => setTopExtraCount(Number(e.target.value))}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs"
                    >
                      {[0, 1, 2, 3, 4].map((c) => (
                        <option key={c} value={c}>{c} Extra</option>
                      ))}
                    </select>
                    <select
                      value={topExtraDia}
                      onChange={(e) => setTopExtraDia(Number(e.target.value))}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-orange-600"
                    >
                      {[12, 16, 20, 25].map((d) => (
                        <option key={d} value={d}>T{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Ranked Ast Preset Recommendations */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 text-xs font-mono block">
                  ⚡ TOP REBAR COMBINATIONS MATCHING Ast ({Ast_top_req} mm²):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {topAstOptions.slice(0, 6).map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleApplyPreset(opt, true)}
                      className={`p-2 rounded border text-left transition-all flex items-center justify-between ${
                        opt.isCompliant
                          ? 'bg-white hover:bg-slate-50 border-ui-border text-deep-navy'
                          : 'bg-rose-50 border-rose-200 text-rose-700 opacity-60'
                      }`}
                    >
                      <div>
                        <span className="font-bold block text-xs">{opt.callout}</span>
                        <span className="text-[10px] text-slate-500 font-sans">
                          {opt.totalArea} mm² (+{Math.max(0, opt.excessArea)} mm² excess)
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                        {opt.efficiencyPercent}% Eff.
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bottom Midspan Demand Summary */}
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-sky-950 font-bold block text-xs">BOTTOM MIDSPAN REBAR DEMAND (Ast,req):</span>
                  <span className="text-[11px] text-sky-800 font-sans">
                    Design Sagging Moment Mu = {Math.abs(beam.flexureBottom.Mu_lim || 35).toFixed(1)} kNm
                  </span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-sm font-bold text-sky-600 block">{Ast_bot_req} mm²</span>
                  <span className="text-[10px] text-slate-500">Min IS 13920: {beam.ductility.Ast_min_ductile} mm²</span>
                </div>
              </div>

              {/* Detailed Selectors for Bottom Rebar */}
              <div className="bg-slate-50 border border-ui-border rounded-lg p-4 space-y-3">
                <span className="font-bold text-slate-800 text-xs block">
                  MANUAL BOTTOM REBAR CONTROLS:
                </span>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <span className="text-slate-600 font-bold block">1. Continuous Bottom Through Bars:</span>
                    <span className="text-[10px] text-slate-500 font-sans">Full span anchored into columns</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={botThroughCount}
                      onChange={(e) => setBotThroughCount(Number(e.target.value))}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs"
                    >
                      {[2, 3, 4].map((c) => (
                        <option key={c} value={c}>{c} Bars</option>
                      ))}
                    </select>
                    <select
                      value={botThroughDia}
                      onChange={(e) => setBotThroughDia(Number(e.target.value))}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-sky-600"
                    >
                      {[12, 16, 20, 25].map((d) => (
                        <option key={d} value={d}>T{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-600 font-bold block">2. Extra Sagging Bars (@ Midspan):</span>
                    <span className="text-[10px] text-slate-500 font-sans">Central 0.75L = {(0.75 * span).toFixed(2)}m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={botExtraCount}
                      onChange={(e) => setBotExtraCount(Number(e.target.value))}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs"
                    >
                      {[0, 1, 2, 3, 4].map((c) => (
                        <option key={c} value={c}>{c} Extra</option>
                      ))}
                    </select>
                    <select
                      value={botExtraDia}
                      onChange={(e) => setBotExtraDia(Number(e.target.value))}
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs text-sky-600"
                    >
                      {[12, 16, 20, 25].map((d) => (
                        <option key={d} value={d}>T{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Ranked Ast Preset Recommendations */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 text-xs font-mono block">
                  ⚡ BOTTOM REBAR COMBINATIONS MATCHING Ast ({Ast_bot_req} mm²):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {botAstOptions.slice(0, 6).map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleApplyPreset(opt, false)}
                      className={`p-2 rounded border text-left transition-all flex items-center justify-between ${
                        opt.isCompliant
                          ? 'bg-white hover:bg-slate-50 border-ui-border text-deep-navy'
                          : 'bg-rose-50 border-rose-200 text-rose-700 opacity-60'
                      }`}
                    >
                      <div>
                        <span className="font-bold block text-xs">{opt.callout}</span>
                        <span className="text-[10px] text-slate-500 font-sans">
                          {opt.totalArea} mm² (+{Math.max(0, opt.excessArea)} mm² excess)
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                        {opt.efficiencyPercent}% Eff.
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Combined Status Summary */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                CONSTRAINTS & SAFETY AUDIT:
              </span>
              <span className="text-[11px] text-emerald-900 font-sans block">
                Top: {liveTopArea} mm² (Req: {Ast_top_req} mm²) • Bot: {liveBotArea} mm² (Req: {Ast_bot_req} mm²)
              </span>
            </div>
            <span
              className={`px-2.5 py-1 rounded text-xs font-bold ${
                isTopCompliant && isBotCompliant
                  ? 'bg-emerald-200 text-emerald-950'
                  : 'bg-rose-200 text-rose-950'
              }`}
            >
              {isTopCompliant && isBotCompliant ? '100% CODE COMPLIANT' : 'DEFICIENT STEEL'}
            </span>
          </div>

          {/* Application Scope */}
          <div className="space-y-1.5 font-sans">
            <label className="block text-slate-700 text-xs font-bold font-mono">APPLICATION SCOPE:</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setApplyScope('SINGLE')}
                className={`py-2 px-2 rounded border text-[11px] font-mono transition-all ${
                  applyScope === 'SINGLE'
                    ? 'bg-secondary-brand text-white border-secondary-brand font-bold'
                    : 'bg-white text-slate-700 border-ui-border'
                }`}
              >
                Beam B-{beam.memberId} Only
              </button>
              <button
                type="button"
                onClick={() => setApplyScope('FLOOR')}
                className={`py-2 px-2 rounded border text-[11px] font-mono transition-all ${
                  applyScope === 'FLOOR'
                    ? 'bg-secondary-brand text-white border-secondary-brand font-bold'
                    : 'bg-white text-slate-700 border-ui-border'
                }`}
              >
                Active Floor Level
              </button>
              <button
                type="button"
                onClick={() => setApplyScope('ALL')}
                className={`py-2 px-2 rounded border text-[11px] font-mono transition-all ${
                  applyScope === 'ALL'
                    ? 'bg-secondary-brand text-white border-secondary-brand font-bold'
                    : 'bg-white text-slate-700 border-ui-border'
                }`}
              >
                All Beams
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
            onClick={handleSave}
            disabled={!isTopCompliant || !isBotCompliant}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-mono text-xs font-bold shadow transition-all disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Apply Ast Rebar Modification</span>
          </button>
        </div>
      </div>
    </div>
  );
};
