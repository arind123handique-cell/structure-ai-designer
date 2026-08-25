import React, { useState, useMemo, useEffect } from 'react';
import { CombinedPileCapGroup } from './combinedPileCapEngine';
import { NormalizedStructuralModel } from '@/features/model/types';
import { ColumnNumberingService } from '@/features/model/columnNumbering';
import {
  X,
  Unlink,
  Layers,
  CheckSquare,
  Square,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Zap,
  Box,
  CornerDownRight,
} from 'lucide-react';

interface SplitPileCapModalProps {
  group: CombinedPileCapGroup | null;
  isOpen: boolean;
  onClose: () => void;
  model: NormalizedStructuralModel | null;
  onSplit: (
    originalNodeIds: number[],
    keepNodeIds: number[],
    detachedNodeIds: number[],
    newCombinedGroupNodeIds?: number[]
  ) => void;
  onDetachNodes: (nodeIdsToDetach: number[]) => void;
  onDisbandAll: (nodeIdInGroup: number) => void;
}

export const SplitPileCapModal: React.FC<SplitPileCapModalProps> = ({
  group,
  isOpen,
  onClose,
  model,
  onSplit,
  onDetachNodes,
  onDisbandAll,
}) => {
  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [splitMode, setSplitMode] = useState<'DETACH_TO_INDIVIDUAL' | 'CREATE_SEPARATE_COMBINED'>(
    'DETACH_TO_INDIVIDUAL'
  );

  const columnSupportMapping = useMemo(() => {
    return ColumnNumberingService.getColumnSupportMapping(model);
  }, [model]);

  // Compute node details for all columns in this combined pile cap
  const jointDetails = useMemo(() => {
    if (!group || !model) return [];
    return group.nodeIds.map((nid) => {
      const node = model.nodes.get(nid);
      const colInfo = columnSupportMapping.get(nid);
      const colLabel = colInfo?.columnLabel || `Joint #${nid}`;
      const isShearWallPlate = model.plates
        ? Array.from(model.plates.values()).some((p) => p.nodeIds.includes(nid))
        : false;

      const reactions = model.reactions?.filter((r) => r.nodeId === nid) || [];
      const maxFy = reactions.length > 0 ? Math.max(...reactions.map((r) => Math.abs(r.fy))) : 650;

      return {
        nodeId: nid,
        colLabel,
        colSlNo: colInfo?.columnSlNo || nid,
        gridLabel: colInfo?.gridLabel || '',
        x: node?.x || 0,
        z: node?.z || 0,
        Pu: Math.round(maxFy),
        isShearWallNode: isShearWallPlate || nid >= 300,
      };
    });
  }, [group, model, columnSupportMapping]);

  // Initialize selection with non-shear-wall columns if mixed, or first 2 columns
  useEffect(() => {
    if (isOpen && jointDetails.length > 0) {
      const normalCols = jointDetails.filter((j) => !j.isShearWallNode).map((j) => j.nodeId);
      if (normalCols.length > 0 && normalCols.length < jointDetails.length) {
        setSelectedNodeIds(normalCols);
      } else {
        setSelectedNodeIds([]);
      }
      setSplitMode('DETACH_TO_INDIVIDUAL');
    }
  }, [isOpen, jointDetails]);

  if (!isOpen || !group) return null;

  const toggleNode = (nodeId: number) => {
    setSelectedNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  };

  const selectAll = () => setSelectedNodeIds(group.nodeIds);
  const deselectAll = () => setSelectedNodeIds([]);
  const selectNonShearWall = () => {
    const ids = jointDetails.filter((j) => !j.isShearWallNode).map((j) => j.nodeId);
    setSelectedNodeIds(ids);
  };
  const selectShearWallOnly = () => {
    const ids = jointDetails.filter((j) => j.isShearWallNode).map((j) => j.nodeId);
    setSelectedNodeIds(ids);
  };

  const remainingNodeIds = group.nodeIds.filter((nid) => !selectedNodeIds.includes(nid));

  // Action Handlers
  const handleApplyDetach = () => {
    if (selectedNodeIds.length === 0) return;
    onSplit(group.nodeIds, remainingNodeIds, selectedNodeIds);
    onClose();
  };

  const handleApplySeparateGroup = () => {
    if (selectedNodeIds.length < 2 || remainingNodeIds.length < 2) return;
    onSplit(group.nodeIds, remainingNodeIds, [], selectedNodeIds);
    onClose();
  };

  const handleApplyDisbandAll = () => {
    onDisbandAll(group.nodeIds[0]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-deep-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-in fade-in">
      <div className="w-full max-w-2xl bg-surface-card rounded-xl border border-ui-border shadow-2xl overflow-hidden flex flex-col font-mono max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-600 rounded-lg">
              <Unlink className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>SPLIT COMBINED PILE CAP — {group.label}</span>
              </h3>
              <p className="text-xs text-slate-300 font-sans mt-0.5">
                Select column joints to detach into standalone individual pile caps or partition into a separate combined group.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Current Combined Cap Info Banner */}
          <div className="bg-slate-50 border border-ui-border rounded-lg p-3.5 flex items-center justify-between text-xs font-sans">
            <div>
              <span className="font-mono text-slate-500 font-bold block">CURRENT COMBINED FOOTPRINT:</span>
              <span className="font-bold text-deep-navy text-sm font-mono">
                {group.capLength} × {group.capWidth} × {group.capDepth} mm • {group.pileCount} Piles (Total Pu = {group.totalFactoredLoad} kN)
              </span>
            </div>
            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded font-mono text-[11px] font-bold">
              {group.nodeIds.length} Column Joints
            </span>
          </div>

          {/* Quick Selection Shortcuts */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="font-bold text-slate-700 uppercase font-mono text-[11px]">
              Select Column Joints to Detach / Split:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={selectNonShearWall}
                className="px-2 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded text-[11px] font-bold"
              >
                Standard Columns (C2, C3, C6)
              </button>
              <button
                type="button"
                onClick={selectShearWallOnly}
                className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[11px] font-bold"
              >
                Shear Wall Only (C20–C24)
              </button>
              <button
                type="button"
                onClick={selectAll}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px]"
              >
                All
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px]"
              >
                None
              </button>
            </div>
          </div>

          {/* Column Joints Checkbox Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {jointDetails.map((j) => {
              const isSelected = selectedNodeIds.includes(j.nodeId);
              return (
                <div
                  key={j.nodeId}
                  onClick={() => toggleNode(j.nodeId)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-400/30'
                      : 'bg-white border-ui-border hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs font-mono text-slate-900">
                          {j.colLabel}
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          (Joint #{j.nodeId})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                        Pu: <strong className="text-slate-800 font-mono">{j.Pu} kN</strong> • ({j.x.toFixed(1)}, {j.z.toFixed(1)})
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      j.isShearWallNode
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {j.isShearWallNode ? 'Shear Wall' : 'Column'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Split Mode Selector Tabs */}
          <div className="pt-2 border-t border-ui-border space-y-2">
            <span className="font-bold text-slate-700 text-xs font-mono">
              SPLIT BEHAVIOR:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSplitMode('DETACH_TO_INDIVIDUAL')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  splitMode === 'DETACH_TO_INDIVIDUAL'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                    : 'bg-white border-ui-border text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Box className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Detach as Single Pile Caps</span>
                </div>
                <p className="text-[10px] font-sans text-slate-500 font-normal">
                  Detaches selected columns to individual 4-pile caps; remaining columns remain combined.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSplitMode('CREATE_SEPARATE_COMBINED')}
                disabled={selectedNodeIds.length < 2 || remainingNodeIds.length < 2}
                className={`p-2.5 rounded-lg border text-left transition-all disabled:opacity-40 ${
                  splitMode === 'CREATE_SEPARATE_COMBINED'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-xs'
                    : 'bg-white border-ui-border text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Split into 2 Combined Caps</span>
                </div>
                <p className="text-[10px] font-sans text-slate-500 font-normal">
                  Creates Group A ({selectedNodeIds.length} cols) and Group B ({remainingNodeIds.length} cols).
                </p>
              </button>
            </div>
          </div>

          {/* Live Outcome Preview Box */}
          <div className="bg-slate-900 text-slate-100 p-3.5 rounded-lg text-xs space-y-1.5">
            <span className="font-bold text-amber-400 text-[11px] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              RESULTING STRUCTURAL CONFIGURATION:
            </span>
            {splitMode === 'DETACH_TO_INDIVIDUAL' ? (
              <div className="space-y-1 text-[11px] font-sans text-slate-300">
                <div>
                  🟢 <strong>Remaining Combined Cap ({remainingNodeIds.length} cols):</strong>{' '}
                  {remainingNodeIds.length >= 2 ? (
                    <span className="font-mono text-emerald-400">
                      {remainingNodeIds
                        .map((id) => columnSupportMapping.get(id)?.columnLabel || `Joint #${id}`)
                        .join(' + ')}{' '}
                      (Monolithic Combined Mat)
                    </span>
                  ) : (
                    <span className="text-slate-400">None (Reverts to individual caps)</span>
                  )}
                </div>
                <div>
                  🔵 <strong>Detached Single Caps ({selectedNodeIds.length} cols):</strong>{' '}
                  {selectedNodeIds.length > 0 ? (
                    <span className="font-mono text-sky-300">
                      {selectedNodeIds
                        .map((id) => columnSupportMapping.get(id)?.columnLabel || `Joint #${id}`)
                        .join(', ')}{' '}
                      (Individual 4-Pile Foundation Caps)
                    </span>
                  ) : (
                    <span className="text-slate-400">No columns selected</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-[11px] font-sans text-slate-300">
                <div>
                  🔵 <strong>Group A ({selectedNodeIds.length} cols):</strong>{' '}
                  <span className="font-mono text-indigo-300">
                    {selectedNodeIds
                      .map((id) => columnSupportMapping.get(id)?.columnLabel || `Joint #${id}`)
                      .join(' + ')}
                  </span>
                </div>
                <div>
                  🟢 <strong>Group B ({remainingNodeIds.length} cols):</strong>{' '}
                  <span className="font-mono text-emerald-300">
                    {remainingNodeIds
                      .map((id) => columnSupportMapping.get(id)?.columnLabel || `Joint #${id}`)
                      .join(' + ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-ui-border flex items-center justify-between flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={handleApplyDisbandAll}
            className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 rounded font-bold font-mono transition-colors"
            title="Split all columns into single-column individual pile caps"
          >
            ⚡ Disband Entire Cap (All Individual)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-ui-border rounded transition-colors"
            >
              Cancel
            </button>

            {splitMode === 'DETACH_TO_INDIVIDUAL' ? (
              <button
                type="button"
                onClick={handleApplyDetach}
                disabled={selectedNodeIds.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow transition-all disabled:opacity-40"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Detach Selected ({selectedNodeIds.length}) Columns</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApplySeparateGroup}
                disabled={selectedNodeIds.length < 2 || remainingNodeIds.length < 2}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded shadow transition-all disabled:opacity-40"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Split into 2 Combined Caps</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
