import React, { useState } from 'react';
import { CombinedPileCapGroup } from './combinedPileCapEngine';
import { X, Layers, CheckCircle2, AlertTriangle, RotateCcw, ShieldCheck } from 'lucide-react';

interface CombinedPileCapEditModalProps {
  cap: CombinedPileCapGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    groupId: string,
    override: {
      customPileCount?: number;
      customCapLength?: number;
      customCapWidth?: number;
      customCapDepth?: number;
      customSafePileCapacity?: number;
      customBottomRebar?: string;
      customTopRebar?: string;
    }
  ) => void;
  onReset: (groupId: string) => void;
}

export const CombinedPileCapEditModal: React.FC<CombinedPileCapEditModalProps> = ({
  cap,
  isOpen,
  onClose,
  onSave,
  onReset,
}) => {
  if (!isOpen || !cap) return null;

  const defaultQsafe = cap.safePileCapacity || 280;
  const totalPu = cap.totalFactoredLoad;
  const totalPwork = Math.round(1.10 * (totalPu / 1.5));

  const [safeCapacity, setSafeCapacity] = useState<number>(defaultQsafe);
  const [pileCount, setPileCount] = useState<number>(cap.pileCount || Math.ceil(totalPwork / defaultQsafe));
  const [capLength, setCapLength] = useState<number>(cap.capLength || 3850);
  const [capWidth, setCapWidth] = useState<number>(cap.capWidth || 1750);
  const [capDepth, setCapDepth] = useState<number>(cap.capDepth || 900);
  const [botRebar, setBotRebar] = useState<string>(cap.botRebarCallout || 'T16 @ 100 mm c/c (Long Way Bot)');
  const [topRebar, setTopRebar] = useState<string>(cap.topRebarCallout || 'T12 @ 150 mm c/c (Both Ways Top)');

  // Min piles required by load capacity
  const minPilesReq = Math.ceil(totalPwork / (safeCapacity || 280));
  const loadPerPileWork = Math.round(totalPwork / (pileCount || 1));
  const loadPerPileFactored = Math.round(totalPu / (pileCount || 1));
  const isSafeCapacity = loadPerPileWork <= safeCapacity;

  const handleSave = () => {
    onSave(cap.groupId, {
      customPileCount: pileCount,
      customSafePileCapacity: safeCapacity,
      customCapLength: capLength,
      customCapWidth: capWidth,
      customCapDepth: capDepth,
      customBottomRebar: botRebar,
      customTopRebar: topRebar,
    });
    onClose();
  };

  const handleReset = () => {
    onReset(cap.groupId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-2xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-mono text-sm font-bold text-deep-navy">
                MANUAL COMBINED PILE CAP DESIGN &amp; OVERRIDES — {cap.label}
              </h3>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                IS 2911:2010 &amp; IS 456:2000 Capacity, Piles Count and Mat Geometry Verification.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs font-mono">
          {/* Summary Banner */}
          <div className="bg-slate-100/80 border border-slate-300 rounded p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">FOUNDATION LOAD DEMAND</span>
              <span className="text-[11px] text-slate-600">
                Columns: <strong>{cap.columnLabels.join(', ')}</strong> ({cap.nodeIds.length} Supports)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-700">
              <div>Factored Load Pu: <strong className="text-indigo-700">{totalPu} kN</strong></div>
              <div>Working Load (1.1 Pw): <strong className="text-indigo-700">{totalPwork} kN</strong></div>
              <div>Min Piles Req (@ {safeCapacity} kN): <strong className="text-rose-700">{minPilesReq} Piles</strong></div>
            </div>
          </div>

          {/* Live Capacity Safety Banner */}
          <div className={`p-3 rounded border flex items-center justify-between text-xs ${
            isSafeCapacity ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            <div className="flex items-center gap-2">
              {isSafeCapacity ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <div>
                <strong>Working Load / Pile: {loadPerPileWork} kN</strong> (Safe Cap: {safeCapacity} kN) • Factored: {loadPerPileFactored} kN
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isSafeCapacity ? 'bg-emerald-200 text-emerald-950' : 'bg-rose-200 text-rose-950'
            }`}>
              {isSafeCapacity ? 'CAPACITY PASS' : 'OVERLOADED'}
            </span>
          </div>

          {/* Form Inputs */}
          <div className="grid grid-cols-2 gap-4">
            {/* Pile Capacity */}
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Single Pile Safe Working Load Qsafe (kN):</label>
              <input
                type="number"
                value={safeCapacity}
                onChange={(e) => setSafeCapacity(Math.max(50, Number(e.target.value)))}
                className="w-full px-3 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-secondary-brand"
              />
              <span className="text-[10px] text-slate-500">e.g. 280 kN for Dia 350mm, 450 kN for Dia 500mm</span>
            </div>

            {/* Total Pile Count */}
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Number of Piles in Combined Cap:</label>
              <input
                type="number"
                value={pileCount}
                onChange={(e) => setPileCount(Math.max(2, Number(e.target.value)))}
                className="w-full px-3 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-secondary-brand"
              />
              <span className="text-[10px] text-slate-500">Recommended: at least {minPilesReq} piles</span>
            </div>

            {/* Cap Length */}
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Cap Length L (mm):</label>
              <input
                type="number"
                step={50}
                value={capLength}
                onChange={(e) => setCapLength(Math.max(500, Number(e.target.value)))}
                className="w-full px-3 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-secondary-brand"
              />
            </div>

            {/* Cap Width */}
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Cap Width B (mm):</label>
              <input
                type="number"
                step={50}
                value={capWidth}
                onChange={(e) => setCapWidth(Math.max(500, Number(e.target.value)))}
                className="w-full px-3 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-secondary-brand"
              />
            </div>

            {/* Cap Depth */}
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Total Cap Depth D (mm):</label>
              <input
                type="number"
                step={50}
                value={capDepth}
                onChange={(e) => setCapDepth(Math.max(500, Number(e.target.value)))}
                className="w-full px-3 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-secondary-brand"
              />
              <span className="text-[10px] text-slate-500">Effective d ≈ {capDepth - 76} mm</span>
            </div>

            {/* Bottom Rebar */}
            <div>
              <label className="block text-slate-600 mb-1 font-semibold">Bottom Mesh Reinforcement:</label>
              <input
                type="text"
                value={botRebar}
                onChange={(e) => setBotRebar(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-secondary-brand"
              />
            </div>

            {/* Top Rebar */}
            <div className="col-span-2">
              <label className="block text-slate-600 mb-1 font-semibold">Top Mesh &amp; Face Reinforcement:</label>
              <input
                type="text"
                value={topRebar}
                onChange={(e) => setTopRebar(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-secondary-brand"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-ui-border flex items-center justify-between font-mono text-xs">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Auto-Design</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-ui-border rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded font-bold transition-all shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Save &amp; Apply Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
