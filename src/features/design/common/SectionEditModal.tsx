import React, { useState, useEffect } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { IS13920WeakBeamStrongColumn } from '@/features/codes/is13920/weakBeamStrongColumn';
import { X, Sparkles, Check } from 'lucide-react';

interface SectionEditModalProps {
  memberId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const STANDARD_BEAM_SIZES = [
  { label: '230 × 300 mm (Economical Residential)', zd: 0.23, yd: 0.30 },
  { label: '230 × 350 mm (Standard Spandrel)', zd: 0.23, yd: 0.35 },
  { label: '230 × 450 mm (Standard Floor Beam)', zd: 0.23, yd: 0.45 },
  { label: '300 × 450 mm (Heavy Floor Beam)', zd: 0.30, yd: 0.45 },
  { label: '300 × 600 mm (Commercial Main Beam)', zd: 0.30, yd: 0.60 },
  { label: '350 × 750 mm (Transfer Girder)', zd: 0.35, yd: 0.75 },
];

const STANDARD_COL_SIZES = [
  { label: '300 × 450 mm (Low-Rise Column)', zd: 0.30, yd: 0.45 },
  { label: '450 × 450 mm (Square Column)', zd: 0.45, yd: 0.45 },
  { label: '450 × 550 mm (Standard Mid-Rise)', zd: 0.45, yd: 0.55 },
  { label: '450 × 600 mm (Ductile WBSC Column)', zd: 0.45, yd: 0.60 },
  { label: '500 × 750 mm (Heavy Ground Column)', zd: 0.50, yd: 0.75 },
  { label: '600 × 900 mm (High-Rise Core Column)', zd: 0.60, yd: 0.90 },
];

export const SectionEditModal: React.FC<SectionEditModalProps> = ({
  memberId,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { activeModel, activeProject, updateMemberSection, batchUpdateSections } = useProjectStore();

  const [width, setWidth] = useState<number>(300);
  const [depth, setDepth] = useState<number>(450);
  const [applyScope, setApplyScope] = useState<'SINGLE' | 'FLOOR' | 'ALL'>('SINGLE');

  const member = activeModel && memberId ? activeModel.members.get(memberId) : null;
  const isBeam = member?.classification === 'BEAM';

  // Get member elevation Y
  const startNode = activeModel && member ? activeModel.nodes.get(member.startNodeId) : null;
  const memberElevationY = startNode ? parseFloat(startNode.y.toFixed(1)) : 0;

  // Reset inputs when modal opens or memberId changes
  useEffect(() => {
    if (isOpen && member) {
      const w = Math.round((member.section.zd || (isBeam ? 0.3 : 0.45)) * 1000);
      const d = Math.round((member.section.yd || (isBeam ? 0.45 : 0.55)) * 1000);
      setWidth(w);
      setDepth(d);
      setApplyScope('SINGLE');
    }
  }, [isOpen, memberId, member, isBeam]);

  if (!isOpen || !memberId || !activeModel || !member) return null;

  const initialWidth = Math.round((member.section.zd || (isBeam ? 0.3 : 0.45)) * 1000);
  const initialDepth = Math.round((member.section.yd || (isBeam ? 0.45 : 0.55)) * 1000);

  const fck = activeProject?.metadata.designSettings.concreteGrade === 'M30' ? 30 : 25;
  const fy = activeProject?.metadata.designSettings.steelGrade === 'Fe500D' ? 500 : 500;

  // WBSC live evaluation
  const wbscCheck = isBeam
    ? IS13920WeakBeamStrongColumn.evaluateForColumn(450, 550, fck, fy, 850, width, depth)
    : IS13920WeakBeamStrongColumn.evaluateForColumn(width, depth, fck, fy, 850, 300, 450);

  // Concrete volume difference
  const initialArea = (initialWidth * initialDepth) / 1e6;
  const newArea = (width * depth) / 1e6;
  const areaDiffPercent = initialArea > 0 ? parseFloat((((newArea - initialArea) / initialArea) * 100).toFixed(1)) : 0;

  const standardSizes = isBeam ? STANDARD_BEAM_SIZES : STANDARD_COL_SIZES;

  const handleSave = async () => {
    const zd = width / 1000;
    const yd = depth / 1000;
    const name = `${width}x${depth} mm`;

    if (applyScope === 'ALL') {
      const updates = Array.from(activeModel.members.values())
        .filter((m) => m.classification === member.classification)
        .map((m) => ({ memberId: m.id, yd, zd, name }));
      await batchUpdateSections(updates);
    } else if (applyScope === 'FLOOR') {
      // Find all beams with same elevation Y (+-0.15m)
      const floorUpdates = Array.from(activeModel.members.values())
        .filter((m) => {
          if (m.classification !== member.classification) return false;
          const n = activeModel.nodes.get(m.startNodeId);
          const elev = n ? parseFloat(n.y.toFixed(1)) : 0;
          return Math.abs(elev - memberElevationY) <= 0.15;
        })
        .map((m) => ({ memberId: m.id, yd, zd, name }));
      await batchUpdateSections(floorUpdates);
    } else {
      await updateMemberSection(memberId, yd, zd, name);
    }

    if (onSaved) {
      onSaved();
    }
    onClose();
  };

  const handleApplyWBSCOptimization = () => {
    if (isBeam) {
      setWidth(230);
      setDepth(350);
    } else {
      setWidth(450);
      setDepth(600);
    }
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-lg bg-surface-card rounded-lg border border-ui-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-ui-border flex items-center justify-between">
          <div>
            <h3 className="font-mono text-sm font-bold text-deep-navy">
              MODIFY SECTION: {isBeam ? 'BEAM' : 'COLUMN'} #{member.id}
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Current: <strong className="text-slate-800">{member.section.name || `${initialWidth}x${initialDepth} mm`}</strong> | Floor: +{memberElevationY.toFixed(2)}m | Span: {member.length.toFixed(2)}m
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs font-mono">
          {/* Preset Quick Sizing */}
          <div>
            <label className="block text-slate-700 font-bold mb-2">QUICK RCC STANDARD SIZES:</label>
            <div className="grid grid-cols-2 gap-2">
              {standardSizes.map((s, i) => {
                const sW = Math.round(s.zd * 1000);
                const sD = Math.round(s.yd * 1000);
                const isSelected = width === sW && depth === sD;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setWidth(sW);
                      setDepth(sD);
                    }}
                    className={`p-2 rounded border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-secondary-brand text-secondary-brand font-bold ring-1 ring-secondary-brand'
                        : 'bg-white border-ui-border hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Dimension Inputs */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded border border-ui-border">
            <div>
              <label className="block text-slate-700 font-bold mb-1">WIDTH b (mm):</label>
              <input
                type="number"
                step="25"
                min="150"
                max="1200"
                value={width}
                onChange={(e) => setWidth(Math.max(100, Number(e.target.value)))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-bold text-deep-navy text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">DEPTH D (mm):</label>
              <input
                type="number"
                step="25"
                min="200"
                max="2000"
                value={depth}
                onChange={(e) => setDepth(Math.max(150, Number(e.target.value)))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded font-bold text-deep-navy text-sm"
              />
            </div>
          </div>

          {/* Weak Beam Strong Column (WBSC) Indicator */}
          <div className={`p-4 rounded border ${wbscCheck.isCompliant ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                IS 13920 Weak Beam - Strong Column Check:
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  wbscCheck.isCompliant ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                }`}
              >
                Ratio: {wbscCheck.ratio} (Req: &ge; 1.40) — {wbscCheck.status}
              </span>
            </div>
            <p className="text-[11px] font-sans text-slate-600 mt-1.5 leading-normal">
              {wbscCheck.suggestion}
            </p>

            {!wbscCheck.isCompliant && (
              <button
                type="button"
                onClick={handleApplyWBSCOptimization}
                className="mt-2 text-xs font-mono font-bold text-secondary-brand hover:underline flex items-center gap-1"
              >
                &rarr; 1-Click Economical WBSC Optimization Sizing ({isBeam ? '230x350 mm' : '450x600 mm'})
              </button>
            )}
          </div>

          {/* Material & Cost Impact */}
          <div className="flex items-center justify-between text-xs bg-slate-100 p-2.5 rounded border border-ui-border">
            <span className="text-slate-600">Cross-Section Volume Change:</span>
            <span
              className={`font-bold ${
                areaDiffPercent < 0 ? 'text-emerald-700' : areaDiffPercent > 0 ? 'text-amber-700' : 'text-slate-700'
              }`}
            >
              {areaDiffPercent > 0 ? `+${areaDiffPercent}%` : `${areaDiffPercent}%`} (Concrete & Steel Impact)
            </span>
          </div>

          {/* Apply Scope Selector */}
          <div className="space-y-2 pt-1 font-sans text-slate-700">
            <label className="font-mono text-[11px] font-bold text-slate-600 uppercase block">
              Apply Section Scope:
            </label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="applyScope"
                  checked={applyScope === 'SINGLE'}
                  onChange={() => setApplyScope('SINGLE')}
                  className="text-secondary-brand focus:ring-secondary-brand"
                />
                <span>Apply to Member #{member.id} only</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="applyScope"
                  checked={applyScope === 'FLOOR'}
                  onChange={() => setApplyScope('FLOOR')}
                  className="text-secondary-brand focus:ring-secondary-brand"
                />
                <span>Apply to all {isBeam ? 'beams' : 'columns'} on this floor (+{memberElevationY.toFixed(2)}m)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="applyScope"
                  checked={applyScope === 'ALL'}
                  onChange={() => setApplyScope('ALL')}
                  className="text-secondary-brand focus:ring-secondary-brand"
                />
                <span>Apply to all {isBeam ? 'beams' : 'columns'} across all floors</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-ui-border flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded border border-ui-border font-mono text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 bg-secondary-brand hover:bg-blue-700 text-white font-mono text-xs font-bold rounded shadow transition-all"
          >
            <Check className="w-4 h-4" />
            Apply & Recalculate
          </button>
        </div>
      </div>
    </div>
  );
};
