import React, { useState, useEffect } from 'react';
import { PileCapDesignEngine, PileCapDesignOutput } from './pileCapDesignEngine';
import { ProjectPileType } from '@/features/design/pile/pileDesignEngine';
import { FoundationPunchingShear } from '@/features/codes/foundation/punchingShear';
import { X, Sparkles, Check, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react';

interface PileCapEditModalProps {
  pileCap: PileCapDesignOutput | null;
  isOpen: boolean;
  onClose: () => void;
  projectPileTypes: ProjectPileType[];
  onSave: (nodeId: number, overrides: {
    pileTypeId?: string;
    customPileCount?: number;
    customCapLength?: number;
    customCapWidth?: number;
    customCapDepth?: number;
  }) => void;
  onReset: (nodeId: number) => void;
}

export const PileCapEditModal: React.FC<PileCapEditModalProps> = ({
  pileCap,
  isOpen,
  onClose,
  projectPileTypes,
  onSave,
  onReset,
}) => {
  const [selectedPileTypeId, setSelectedPileTypeId] = useState<string>('P-1');
  const [pileCount, setPileCount] = useState<number>(4);
  const [length, setLength] = useState<number>(2500);
  const [width, setWidth] = useState<number>(2500);
  const [depth, setDepth] = useState<number>(800);

  useEffect(() => {
    if (pileCap && isOpen) {
      setSelectedPileTypeId(pileCap.assignedPileTypeId || projectPileTypes[0]?.id || 'P-1');
      setPileCount(pileCap.pileCount);
      setLength(pileCap.capLength);
      setWidth(pileCap.capWidth);
      setDepth(pileCap.capDepth);
    }
  }, [pileCap, isOpen, projectPileTypes]);

  if (!isOpen || !pileCap) return null;

  const currentPileType = projectPileTypes.find((p) => p.id === selectedPileTypeId) || projectPileTypes[0] || {
    id: 'P-1',
    diameter: 500,
    safeWorkingLoad: 450,
  };

  const Dp = currentPileType.diameter || 500;
  const Qsafe = currentPileType.safeWorkingLoad || 450;

  // Live Auto-Calculate Suggested Size for current Pile Count
  const pileSpacing = Math.round(3.0 * Dp);
  const overhang = Math.round(1.0 * Dp);

  const getSuggestedDimensions = (n: number) => {
    let sL = 0;
    let sB = 0;
    if (n === 2) {
      sL = pileSpacing + 2 * overhang;
      sB = Dp + 2 * overhang;
    } else if (n === 3) {
      // Equilateral Triangular Cap (IS 2911 Cl. 6.6)
      sL = pileSpacing + 2 * overhang;
      sB = Math.round(pileSpacing * 0.866 + 2 * overhang);
    } else if (n === 4) {
      sL = pileSpacing + 2 * overhang;
      sB = pileSpacing + 2 * overhang;
    } else if (n === 5) {
      // Regular Pentagonal Cap (IS 2911 Cl. 6.6 & SP:34)
      const Rp = pileSpacing / (2 * Math.sin(Math.PI / 5));
      sB = Math.round(2 * (Rp * Math.cos(Math.PI / 10) + overhang));
      sL = Math.round(Rp * (1 + Math.cos(Math.PI / 5)) + 2 * overhang);
    } else if (n === 6) {
      sL = 2 * pileSpacing + 2 * overhang;
      sB = pileSpacing + 2 * overhang;
    } else {
      sL = pileSpacing + 2 * overhang;
      sB = pileSpacing + 2 * overhang;
    }
    const sD = Math.max(750, Math.round(1.5 * Dp));
    return { sL, sB, sD };
  };

  const handlePileCountChange = (newCount: number) => {
    setPileCount(newCount);
    const { sL, sB, sD } = getSuggestedDimensions(newCount);
    setLength(sL);
    setWidth(sB);
    setDepth(sD);
  };

  // Live Punching Shear Check with current user-edited depth
  const cover = 60;
  const d = depth - cover - 16;
  const punchingCheck = FoundationPunchingShear.checkPunching({
    colWidth: 450,
    colDepth: 550,
    effectiveDepth: d,
    fck: 25,
    factoredPunchingForce: pileCap.factoredVerticalLoad,
  });

  const totalCapCapacity = parseFloat((pileCount * Qsafe).toFixed(1));
  const workingDemand = pileCap.workingVerticalLoad;
  const isCapacitySufficient = totalCapCapacity >= workingDemand;

  const handleSave = () => {
    onSave(pileCap.supportNodeId, {
      pileTypeId: selectedPileTypeId,
      customPileCount: pileCount,
      customCapLength: length,
      customCapWidth: width,
      customCapDepth: depth,
    });
    onClose();
  };

  const handleResetToAuto = () => {
    onReset(pileCap.supportNodeId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-2xl bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
          <div>
            <h3 className="font-mono text-sm font-bold text-deep-navy">
              EDIT PILE CAP PC-{pileCap.supportNodeId} (COLUMN C{pileCap.supportNodeId})
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Pu Max = {pileCap.factoredVerticalLoad} kN • Working Load = {pileCap.workingVerticalLoad} kN
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 font-mono text-xs">
          {/* 1. Assigned Pile Type */}
          <div className="bg-slate-50 border border-ui-border rounded p-3.5 space-y-2">
            <label className="font-bold text-slate-800 uppercase block">1. Assigned Single Pile Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Select Project Pile Type:</span>
                <select
                  value={selectedPileTypeId}
                  onChange={(e) => setSelectedPileTypeId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-ui-border rounded font-bold text-slate-900 focus:outline-none focus:border-secondary-brand"
                >
                  {projectPileTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name} ({pt.safeWorkingLoad} kN/pile)
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-white border border-ui-border rounded p-2 text-[11px] flex flex-col justify-center">
                <div className="text-slate-600">
                  Single Pile Capacity ($Q_{'{'}safe{'}'}$): <strong>{Qsafe} kN</strong>
                </div>
                <div className="text-slate-600">
                  Pile Shaft Diameter ($D_p$): <strong>{Dp} mm</strong>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Pile Count Sizing & IS Shape */}
          <div className="bg-slate-50 border border-ui-border rounded p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 uppercase">
                2. Number of Piles &amp; Geometric Shape
              </label>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {pileCount === 3
                  ? '🔺 Equilateral Triangular Cap'
                  : pileCount === 5
                  ? '⬟ Regular Pentagonal Cap'
                  : `${pileCount}-Pile Rectangular Cap`}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handlePileCountChange(n)}
                  className={`py-2 px-3 rounded font-bold border transition-all text-center ${
                    pileCount === n
                      ? 'bg-deep-navy text-white border-deep-navy shadow-sm'
                      : 'bg-white text-slate-700 border-ui-border hover:bg-slate-100'
                  }`}
                >
                  <div>{n}-Pile Cap</div>
                  <div className="text-[9px] font-normal opacity-80">
                    {n === 3 ? 'Triangular' : n === 5 ? 'Pentagon' : 'Orthogonal'}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className="text-slate-600">
                Total Cap Working Capacity = {pileCount} &times; {Qsafe} = <strong>{totalCapCapacity} kN</strong>
              </span>
              <span
                className={`font-bold px-2 py-0.5 rounded ${
                  isCapacitySufficient ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isCapacitySufficient ? 'Capacity Adequate' : 'Under Capacity (Increase Piles)'}
              </span>
            </div>
          </div>

          {/* 3. Pile Cap Plan Dimensions & Depth */}
          <div className="bg-slate-50 border border-ui-border rounded p-3.5 space-y-3">
            <label className="font-bold text-slate-800 uppercase block">
              3. Cap Dimensions (L &times; B &times; Depth)
            </label>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Length L (mm):</label>
                <input
                  type="number"
                  step="50"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-ui-border rounded font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Width B (mm):</label>
                <input
                  type="number"
                  step="50"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-ui-border rounded font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Overall Depth D (mm):</label>
                <input
                  type="number"
                  step="25"
                  value={depth}
                  onChange={(e) => setDepth(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-ui-border rounded font-bold text-slate-900"
                />
              </div>
            </div>

            {/* Live Punching Shear Check */}
            <div className="p-2.5 bg-white border border-ui-border rounded flex items-center justify-between text-[11px]">
              <div>
                <span className="text-slate-500">Punching Shear at d/2: </span>
                <span className="font-bold text-slate-800">
                  &tau;vp = {punchingCheck.tau_vp.toFixed(3)} N/mm² / &tau;cp = {punchingCheck.tau_cp.toFixed(3)} N/mm²
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  punchingCheck.status === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {punchingCheck.status === 'PASS' ? 'Punching Safe' : 'Punching Fails (Increase Depth)'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-ui-border flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetToAuto}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-600 hover:text-slate-900 bg-white border border-ui-border rounded hover:bg-slate-100"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Auto-Design</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-mono text-slate-600 hover:bg-slate-200 rounded border border-ui-border"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-mono font-bold text-white bg-secondary-brand hover:bg-blue-700 rounded shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Apply Pile Cap Size</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
