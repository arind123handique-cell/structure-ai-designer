import React, { useState, useMemo } from 'react';
import { CombinedPileCapEngine, CombinedPileCapGroup } from './combinedPileCapEngine';
import { X, Layers, CheckCircle2, AlertTriangle, RotateCcw, RotateCw, ShieldCheck, Grid } from 'lucide-react';

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
      rotationAngle?: number;
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
  const Dp = cap.pileDiameter || 350;
  const eo = cap.edgeDistance || Dp;

  const spanXMm = Math.round(Math.abs(cap.maxX - cap.minX) * 1000);
  const spanZMm = Math.round(Math.abs(cap.maxZ - cap.minZ) * 1000);
  const isXLong = spanXMm >= spanZMm;
  const minRequiredX = spanXMm + 2 * eo;
  const minRequiredZ = spanZMm + 2 * eo;

  const [safeCapacity, setSafeCapacity] = useState<number>(defaultQsafe);
  const [pileCount, setPileCount] = useState<number>(cap.pileCount || Math.ceil(totalPwork / defaultQsafe));
  const [capLength, setCapLength] = useState<number>(cap.capLength || Math.max(minRequiredX, 2200));
  const [capWidth, setCapWidth] = useState<number>(cap.capWidth || Math.max(minRequiredZ, 2200));
  const [capDepth, setCapDepth] = useState<number>(cap.capDepth || 900);
  const [rotationAngle, setRotationAngle] = useState<number>(cap.rotationAngle || 0);
  const [botRebar, setBotRebar] = useState<string>(cap.botRebarCallout || 'T16 @ 100 mm c/c (Long Way Bot)');
  const [topRebar, setTopRebar] = useState<string>(cap.topRebarCallout || 'T12 @ 150 mm c/c (Both Ways Top)');

  // Min piles required by load capacity
  const minPilesReq = Math.ceil(totalPwork / (safeCapacity || 280));
  const loadPerPileWork = Math.round(totalPwork / (pileCount || 1));
  const loadPerPileFactored = Math.round(totalPu / (pileCount || 1));
  const isSafeCapacity = loadPerPileWork <= safeCapacity;

  const gridPreview = useMemo(() => {
    return CombinedPileCapEngine.computeOptimalGrid(pileCount, capLength, capWidth, Dp, eo);
  }, [pileCount, capLength, capWidth, Dp, eo]);

  const handleSave = () => {
    onSave(cap.groupId, {
      customPileCount: pileCount,
      customSafePileCapacity: safeCapacity,
      customCapLength: capLength,
      customCapWidth: capWidth,
      customCapDepth: capDepth,
      customBottomRebar: botRebar,
      customTopRebar: topRebar,
      rotationAngle,
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-600 font-semibold">Number of Piles in Combined Cap:</label>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 flex items-center gap-1">
                  <Grid className="w-3 h-3" />
                  <span>Grid: {gridPreview.nX} (X) × {gridPreview.nZ} (Z) = {gridPreview.pileOffsets.length} P</span>
                </span>
              </div>
              <input
                type="number"
                value={pileCount}
                onChange={(e) => setPileCount(Math.max(2, Number(e.target.value)))}
                className="w-full px-3 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-secondary-brand"
              />
              <span className="text-[10px] text-slate-500">Recommended: at least {minPilesReq} piles for safe capacity</span>
            </div>

            {/* Cap Dimension along X */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-600 font-semibold">
                  {isXLong ? 'Cap Length (Long Core Axis / X) (mm):' : 'Cap Width (Transverse / X-axis) (mm):'}
                </label>
                <span className="text-[10px] text-slate-400">Min to cover columns: {minRequiredX} mm</span>
              </div>
              <input
                type="number"
                step={50}
                value={capLength}
                onChange={(e) => setCapLength(Math.max(500, Number(e.target.value)))}
                className="w-full px-3 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-secondary-brand"
              />
              {capLength < minRequiredX && (
                <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">
                  ⚠️ Less than minimum {minRequiredX} mm to cover column boundary!
                </span>
              )}
            </div>

            {/* Cap Dimension along Z */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-600 font-semibold">
                  {isXLong ? 'Cap Width (Transverse / Z-axis) (mm):' : 'Cap Length (Long Core Axis / Z) (mm):'}
                </label>
                <span className="text-[10px] text-slate-400">Min to cover columns: {minRequiredZ} mm</span>
              </div>
              <input
                type="number"
                step={50}
                value={capWidth}
                onChange={(e) => setCapWidth(Math.max(500, Number(e.target.value)))}
                className="w-full px-3 py-1.5 bg-white border border-ui-border rounded focus:outline-none focus:ring-1 focus:ring-secondary-brand"
              />
              {capWidth < minRequiredZ && (
                <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">
                  ⚠️ Less than minimum {minRequiredZ} mm to cover column boundary!
                </span>
              )}
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

            {/* Mat Rotation & Alignment */}
            <div className="col-span-2 bg-slate-50 border border-ui-border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Mat Orientation / Rotation:</span>
                </label>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {((rotationAngle % 360) + 360) % 360}°
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setRotationAngle(deg)}
                    className={`flex-1 py-1.5 rounded font-bold border text-center transition-all ${
                      (((rotationAngle % 360) + 360) % 360) === deg
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-ui-border'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setRotationAngle((prev) => ((prev - 90) % 360 + 360) % 360)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 bg-white hover:bg-slate-100 border border-ui-border rounded font-bold text-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Rotate CCW (-90°)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRotationAngle((prev) => ((prev + 90) % 360 + 360) % 360)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 bg-white hover:bg-slate-100 border border-ui-border rounded font-bold text-slate-700"
                >
                  <RotateCw className="w-3.5 h-3.5 text-blue-600" />
                  <span>Rotate CW (+90°)</span>
                </button>
              </div>
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
